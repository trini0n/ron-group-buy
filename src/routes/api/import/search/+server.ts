import { json } from '@sveltejs/kit'
import type { RequestHandler } from './$types'
import { createAdminClient } from '$lib/server/admin'

interface DeckCard {
  quantity: number
  name: string
  set?: string
  collectorNumber?: string
}

interface CardMatch {
  id: string
  serial: string
  card_name: string
  set_code: string
  set_name: string
  collector_number: string | null
  card_type: string
  is_in_stock: boolean
  scryfall_id: string | null
}

interface SearchResult {
  requestedCard: DeckCard
  exactMatch: CardMatch | null
  alternatives: CardMatch[]
  selected: CardMatch | null
}

export const POST: RequestHandler = async ({ request }) => {
  const { cards } = (await request.json()) as { cards: DeckCard[] }

  if (!cards || !Array.isArray(cards)) {
    return json({ error: 'Invalid cards array' }, { status: 400 })
  }

  const adminClient = createAdminClient()
  const results: SearchResult[] = []

  for (const card of cards) {
    const result = await searchCard(adminClient, card)
    results.push(result)
  }

  return json(results)
}

async function searchCard(supabase: ReturnType<typeof createAdminClient>, card: DeckCard): Promise<SearchResult> {
  // Normalize card name for searching
  // Handle DFC names like "Card A // Card B" - search for either half
  const cardName = card.name.trim()
  const nameParts = cardName.split(' // ')
  const primaryName = nameParts[0].trim()

  let exactMatch: CardMatch | null = null
  let alternatives: CardMatch[] = []

  // First, try to find exact match with set and collector number
  if (card.set && card.collectorNumber) {
    const { data } = await supabase
      .from('cards')
      .select('id, serial, card_name, set_code, set_name, collector_number, card_type, is_in_stock, scryfall_id')
      .ilike('card_name', primaryName)
      .ilike('set_code', card.set)
      .eq('collector_number', card.collectorNumber)
      .limit(1)

    if (data && data.length > 0) {
      exactMatch = data[0]
    }
  }

  // If no exact match with collector number, try just set
  if (!exactMatch && card.set) {
    const { data } = await supabase
      .from('cards')
      .select('id, serial, card_name, set_code, set_name, collector_number, card_type, is_in_stock, scryfall_id')
      .ilike('card_name', primaryName)
      .ilike('set_code', card.set)
      .limit(1)

    if (data && data.length > 0) {
      exactMatch = data[0]
    }
  }

  // Search for alternatives (same card name, different sets)
  const { data: altData } = await supabase
    .from('cards')
    .select('id, serial, card_name, set_code, set_name, collector_number, card_type, is_in_stock, scryfall_id')
    .ilike('card_name', primaryName)
    .order('is_in_stock', { ascending: false })
    .order('set_code', { ascending: false })
    .limit(10)

  if (altData) {
    // Filter out the exact match from alternatives
    alternatives = altData.filter((alt) => alt.id !== exactMatch?.id)
  }

  // If we still don't have an exact match but have alternatives, check if the first one matches closely
  if (!exactMatch && alternatives.length > 0) {
    // Check if any alternative exactly matches the card name (case-insensitive)
    const closeMatch = alternatives.find((alt) => alt.card_name.toLowerCase() === primaryName.toLowerCase())
    if (closeMatch) {
      exactMatch = closeMatch
      alternatives = alternatives.filter((alt) => alt.id !== closeMatch.id)
    }
  }

  // If still no match, try fuzzy search with ILIKE pattern
  if (!exactMatch && alternatives.length === 0) {
    const { data: fuzzyData } = await supabase
      .from('cards')
      .select('id, serial, card_name, set_code, set_name, collector_number, card_type, is_in_stock, scryfall_id')
      .ilike('card_name', `%${primaryName}%`)
      .order('is_in_stock', { ascending: false })
      .limit(5)

    if (fuzzyData && fuzzyData.length > 0) {
      alternatives = fuzzyData
    }
  }

  return {
    requestedCard: card,
    exactMatch,
    alternatives,
    selected: null
  }
}
