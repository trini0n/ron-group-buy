import { json } from '@sveltejs/kit'
import type { RequestHandler } from './$types'
import { createAdminClient } from '$lib/server/admin'

interface DeckCard {
  quantity: number
  name: string
  set?: string
  collectorNumber?: string
  boardType?: string
  typeLine?: string
  foil?: boolean
}

interface CardMatch {
  id: string
  serial: string
  card_name: string
  set_code: string
  set_name: string
  collector_number: string | null
  card_type: string
  foil_type: string | null
  is_in_stock: boolean
  scryfall_id: string | null
  type_line: string | null
  language: string | null
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

function isFoil(card: CardMatch): boolean {
  return card.card_type === 'Foil' || card.card_type === 'Holo' || !!card.foil_type
}

async function searchCard(supabase: ReturnType<typeof createAdminClient>, card: DeckCard): Promise<SearchResult> {
  // Normalize card name for searching
  // Handle DFC names like "Card A // Card B" - search for either half
  const cardName = card.name.trim()
  const nameParts = cardName.split(' // ')
  const primaryName = nameParts[0].trim()

  let exactMatch: CardMatch | null = null
  let alternatives: CardMatch[] = []

  // Helper to sort matches by foil preference
  const sortMatches = (matches: CardMatch[]) => {
    return matches.sort((a, b) => {
      // 1. Stock status
      if (a.is_in_stock !== b.is_in_stock) return a.is_in_stock ? -1 : 1
      
      // 2. Foil preference
      const aFoil = isFoil(a)
      const bFoil = isFoil(b)
      
      if (card.foil) {
        if (aFoil !== bFoil) return aFoil ? -1 : 1
      }
      
      return 0
    })
  }

  // First, try to find matches with set and collector number
  if (card.set && card.collectorNumber) {
    const { data } = await supabase
      .from('cards')
      .select(
        'id, serial, card_name, set_code, set_name, collector_number, card_type, foil_type, is_in_stock, scryfall_id, type_line, language'
      )
      .ilike('card_name', primaryName)
      .ilike('set_code', card.set)
      .eq('collector_number', card.collectorNumber)
      
    if (data && data.length > 0) {
      const sorted = sortMatches(data)
      exactMatch = sorted[0]
      // Add other finishes as alternatives
      if (sorted.length > 1) {
        alternatives.push(...sorted.slice(1))
      }
    }
  }

  // If no exact match with collector number, try just set
  if (!exactMatch && card.set) {
    const { data } = await supabase
      .from('cards')
      .select(
        'id, serial, card_name, set_code, set_name, collector_number, card_type, foil_type, is_in_stock, scryfall_id, type_line, language'
      )
      .ilike('card_name', primaryName)
      .ilike('set_code', card.set)
      
    if (data && data.length > 0) {
      const sorted = sortMatches(data)
      exactMatch = sorted[0]
      // Add others as alternatives
      if (sorted.length > 1) {
        alternatives.push(...sorted.slice(1))
      }
    }
  }

  // Search for alternatives (same card name, different sets)
  if (alternatives.length < 30) {
    const { data: altData } = await supabase
      .from('cards')
      .select(
        'id, serial, card_name, set_code, set_name, collector_number, card_type, foil_type, is_in_stock, scryfall_id, type_line, language'
      )
      .ilike('card_name', primaryName)
      .order('is_in_stock', { ascending: false })
      .order('set_code', { ascending: false })
      .limit(100)

    if (altData) {
      // Filter out the exact match
      const newAlts = altData.filter((alt) => alt.id !== exactMatch?.id)
      alternatives.push(...newAlts)
    }
  }

  // Deduplicate alternatives
  alternatives = Array.from(new Map(alternatives.map(item => [item.id, item])).values())
  
  // Cap alternatives
  alternatives = alternatives.slice(0, 50)

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
      .select(
        'id, serial, card_name, set_code, set_name, collector_number, card_type, foil_type, is_in_stock, scryfall_id, type_line, language'
      )
      .ilike('card_name', `%${primaryName}%`)
      .order('is_in_stock', { ascending: false })
      .limit(5)

    if (fuzzyData && fuzzyData.length > 0) {
      alternatives = fuzzyData
    }
  }

  // If requestedCard doesn't have typeLine but we found a match, populate it
  const matchedTypeLine = exactMatch?.type_line || alternatives[0]?.type_line || null;
  const updatedCard = { ...card };
  if (!updatedCard.typeLine && matchedTypeLine) {
    updatedCard.typeLine = matchedTypeLine;
  }

  return {
    requestedCard: updatedCard,
    exactMatch,
    alternatives,
    selected: null
  }
}
