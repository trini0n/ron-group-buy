import type { PageServerLoad } from './$types'
import type { Card } from '$lib/server/types'
import { error } from '@sveltejs/kit'
import { logger } from '$lib/server/logger'

// Returns a map of lowercase set_code -> released_at (YYYY-MM-DD) from Scryfall
// Cached for 1 hour in module scope (shared across requests)
let scryfallCache: { data: Record<string, string>; timestamp: number } | null = null
const CACHE_TTL_MS = 60 * 60 * 1000

// "Umbrella" sets where cards have individual release dates different from the set date.
const UMBRELLA_SET_CODES = new Set(['sld', 'purl', 'pmei'])

// Cache for per-card release dates (scryfall_id -> released_at)
let cardReleaseDatesCache: { data: Record<string, string>; timestamp: number } | null = null

async function fetchScryfallDates(): Promise<Record<string, string>> {
  if (scryfallCache && Date.now() - scryfallCache.timestamp < CACHE_TTL_MS) {
    return scryfallCache.data
  }
  try {
    const res = await fetch('https://api.scryfall.com/sets', {
      headers: { 'User-Agent': 'RonGroupBuy/1.0' }
    })
    if (!res.ok) return scryfallCache?.data ?? {}
    const json = (await res.json()) as { data: { code: string; released_at: string }[] }
    const dates: Record<string, string> = {}
    for (const s of json.data) {
      if (s.code && s.released_at) dates[s.code.toLowerCase()] = s.released_at
    }
    scryfallCache = { data: dates, timestamp: Date.now() }
    return dates
  } catch (err) {
    logger.error({ err }, 'Failed to fetch Scryfall set dates for /sets/[setCode]')
    return scryfallCache?.data ?? {}
  }
}

/**
 * Fetch per-card release dates for cards in umbrella sets (SLD, PURL, PMEI).
 * Uses Scryfall's /cards/collection endpoint (75 IDs per batch).
 */
async function fetchCardReleaseDates(cards: Card[]): Promise<Record<string, string>> {
  if (cardReleaseDatesCache && Date.now() - cardReleaseDatesCache.timestamp < CACHE_TTL_MS) {
    return cardReleaseDatesCache.data
  }

  const scryfallIds = new Set<string>()
  for (const card of cards) {
    if (card.scryfall_id && card.set_code && UMBRELLA_SET_CODES.has(card.set_code.toLowerCase())) {
      scryfallIds.add(card.scryfall_id)
    }
  }

  if (scryfallIds.size === 0) {
    cardReleaseDatesCache = { data: {}, timestamp: Date.now() }
    return {}
  }

  const dates: Record<string, string> = {}
  const ids = [...scryfallIds]
  const BATCH_SIZE = 75

  try {
    for (let i = 0; i < ids.length; i += BATCH_SIZE) {
      const chunk = ids.slice(i, i + BATCH_SIZE)
      const res = await fetch('https://api.scryfall.com/cards/collection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'User-Agent': 'RonGroupBuy/1.0' },
        body: JSON.stringify({ identifiers: chunk.map((id) => ({ id })) })
      })
      if (!res.ok) continue
      const body = (await res.json()) as { data: Array<{ id: string; released_at?: string }> }
      for (const card of body.data) {
        if (card.id && card.released_at) dates[card.id] = card.released_at
      }
      if (i + BATCH_SIZE < ids.length) await new Promise((r) => setTimeout(r, 100))
    }
    cardReleaseDatesCache = { data: dates, timestamp: Date.now() }
    return dates
  } catch (err) {
    logger.error({ err }, 'Failed to fetch per-card release dates for /sets/[setCode]')
    return cardReleaseDatesCache?.data ?? {}
  }
}

// Numeric-aware collector number sort
function collectorNumberSort(a: string, b: string): number {
  const na = parseInt(a, 10)
  const nb = parseInt(b, 10)
  if (!isNaN(na) && !isNaN(nb)) return na - nb
  return a.localeCompare(b)
}

export const load: PageServerLoad = async ({ locals, params, setHeaders }) => {
  setHeaders({ 'Cache-Control': 'private, max-age=60' })

  // Fetch the set (404 if not found)
  const { data: set, error: setError } = await locals.supabase
    .from('sets')
    .select('set_code, set_name, price, card_list_text, release_date')
    .eq('set_code', params.setCode)
    .single()

  if (setError || !set) throw error(404, 'Set not found')

  // Fetch set_cards with quantity, joined to full card data
  const { data: setCards, error: cardsError } = await locals.supabase
    .from('set_cards')
    .select('quantity, cards(*)')
    .eq('set_code', params.setCode)

  if (cardsError) {
    logger.error({ error: cardsError }, 'Error fetching set cards for public detail page')
  }

  // Fetch Scryfall release dates for sorting
  const releaseDates = await fetchScryfallDates()

  // Build card entries: one entry per unique set_cards row, carrying quantity.
  const rawEntries = (setCards ?? [])
    .map((sc) => ({ card: sc.cards as Card | null, quantity: (sc.quantity as number) ?? 1 }))
    .filter((e): e is { card: Card; quantity: number } => e.card !== null)

  // Fetch per-card release dates for umbrella sets (SLD, PURL, PMEI)
  const allCards = rawEntries.map((e) => e.card)
  const perCardDates = await fetchCardReleaseDates(allCards)

  // Sort by release date then collector number.
  // Prefer per-card date (umbrella sets) over set-level date.
  const cardEntries = rawEntries.sort((a, b) => {
    const aSetCode = (a.card.set_code ?? '').toLowerCase()
    const bSetCode = (b.card.set_code ?? '').toLowerCase()
    const dateA = (a.card.scryfall_id && perCardDates[a.card.scryfall_id]) || releaseDates[aSetCode] || '9999-99-99'
    const dateB = (b.card.scryfall_id && perCardDates[b.card.scryfall_id]) || releaseDates[bSetCode] || '9999-99-99'
    if (dateA !== dateB) return dateA.localeCompare(dateB)
    return collectorNumberSort(a.card.collector_number ?? '', b.card.collector_number ?? '')
  })

  // Expand by quantity so StacksView's count badge works (it counts duplicate
  // card objects). E.g. quantity:3 → card appears 3 times in the array.
  const cards = cardEntries.flatMap(({ card, quantity }) =>
    Array.from({ length: quantity }, () => card)
  )

  return {
    set: {
      set_code: set.set_code,
      set_name: set.set_name,
      price: set.price ?? null,
      release_date: set.release_date ?? null,
      card_list_text: set.card_list_text ?? null
    },
    cards,
    // Also pass unique entries for list view (shows quantity inline)
    cardEntries,
    setReleaseDates: releaseDates
  }
}
