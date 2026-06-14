import type { PageServerLoad } from './$types'
import type { Card } from '$lib/server/types'
import { error } from '@sveltejs/kit'
import { logger } from '$lib/server/logger'

// Returns a map of lowercase set_code -> released_at (YYYY-MM-DD) from Scryfall
// Cached for 1 hour in module scope (shared across requests)
let scryfallCache: { data: Record<string, string>; timestamp: number } | null = null
const CACHE_TTL_MS = 60 * 60 * 1000

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

// Numeric-aware collector number sort
function collectorNumberSort(a: string, b: string): number {
  const na = parseInt(a, 10)
  const nb = parseInt(b, 10)
  if (!isNaN(na) && !isNaN(nb)) return na - nb
  return a.localeCompare(b)
}

export const load: PageServerLoad = async ({ locals, params, setHeaders }) => {
  setHeaders({ 'Cache-Control': 'public, max-age=300, stale-while-revalidate=60' })

  // Fetch the set (404 if not found)
  const { data: set, error: setError } = await locals.supabase
    .from('sets')
    .select('set_code, set_name, price')
    .eq('set_code', params.setCode)
    .single()

  if (setError || !set) throw error(404, 'Set not found')

  // Fetch set_cards joined to full card data
  const { data: setCards, error: cardsError } = await locals.supabase
    .from('set_cards')
    .select('card_id, cards(*)')
    .eq('set_code', params.setCode)

  if (cardsError) {
    logger.error({ error: cardsError }, 'Error fetching set cards for public detail page')
  }

  // Extract card rows from join result
  const rawCards = (setCards ?? [])
    .map((sc) => sc.cards as Card | null)
    .filter((c): c is Card => c !== null)

  // Fetch Scryfall release dates for sorting
  const releaseDates = await fetchScryfallDates()

  // Sort: primary = set release date ASC, secondary = collector_number ASC (numeric)
  const cards = rawCards.slice().sort((a, b) => {
    const dateA = releaseDates[(a.set_code ?? '').toLowerCase()] ?? '9999-99-99'
    const dateB = releaseDates[(b.set_code ?? '').toLowerCase()] ?? '9999-99-99'
    if (dateA !== dateB) return dateA.localeCompare(dateB)
    return collectorNumberSort(a.collector_number ?? '', b.collector_number ?? '')
  })

  return {
    set: {
      set_code: set.set_code,
      set_name: set.set_name,
      price: set.price ?? null
    },
    cards,
    setReleaseDates: releaseDates
  }
}
