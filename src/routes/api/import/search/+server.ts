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
  set_code: string | null
  set_name: string | null
  collector_number: string | null
  card_type: string
  foil_type: string | null
  is_in_stock: boolean | null
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

// In-memory cache for card data
interface CacheEntry {
  cards: CardMatch[]
  timestamp: number
}

const CARD_CACHE = new Map<string, CacheEntry>()
const CACHE_TTL_MS = 5 * 60 * 1000 // 5 minutes

function getCacheKey(name: string): string {
  return name.toLowerCase().trim()
}

function getFromCache(name: string): CardMatch[] | null {
  const key = getCacheKey(name)
  const entry = CARD_CACHE.get(key)
  if (!entry) return null
  
  // Check if cache is expired
  if (Date.now() - entry.timestamp > CACHE_TTL_MS) {
    CARD_CACHE.delete(key)
    return null
  }
  
  return entry.cards
}

function setInCache(name: string, cards: CardMatch[]): void {
  const key = getCacheKey(name)
  CARD_CACHE.set(key, { cards, timestamp: Date.now() })
  
  // Limit cache size to prevent memory issues
  if (CARD_CACHE.size > 10000) {
    // Remove oldest entries
    const keys = Array.from(CARD_CACHE.keys())
    for (let i = 0; i < 1000; i++) {
      CARD_CACHE.delete(keys[i])
    }
  }
}

const CARD_SELECT_COLUMNS = 
  'id, serial, card_name, set_code, set_name, collector_number, card_type, foil_type, is_in_stock, scryfall_id, type_line, language'

export const POST: RequestHandler = async ({ request }) => {
  const { cards } = (await request.json()) as { cards: DeckCard[] }

  if (!cards || !Array.isArray(cards)) {
    return json({ error: 'Invalid cards array' }, { status: 400 })
  }

  const adminClient = createAdminClient()
  
  // Search all cards in parallel (massive speedup from sequential)
  const results = await parallelSearchCards(adminClient, cards)

  return json(results)
}

function isFoil(card: CardMatch): boolean {
  return card.card_type === 'Foil' || card.card_type === 'Holo' || !!card.foil_type
}

function sortMatches(matches: CardMatch[], preferFoil?: boolean): CardMatch[] {
  return [...matches].sort((a, b) => {
    // 1. Stock status - in stock first
    if (a.is_in_stock !== b.is_in_stock) return a.is_in_stock ? -1 : 1
    
    // 2. Foil preference if specified
    if (preferFoil) {
      const aFoil = isFoil(a)
      const bFoil = isFoil(b)
      if (aFoil !== bFoil) return aFoil ? -1 : 1
    }
    
    return 0
  })
}

async function searchSingleCard(
  supabase: ReturnType<typeof createAdminClient>,
  card: DeckCard
): Promise<SearchResult> {
  const primaryName = card.name.split(' // ')[0].trim()
  const cacheKey = getCacheKey(primaryName)
  
  // Check cache first
  let allMatches = getFromCache(primaryName)
  
  if (!allMatches) {
    // Query for all cards matching this name
    // Use separate queries to avoid issues with special characters in OR syntax
    
    // Query 1: Exact card_name match
    const { data: exactMatches } = await supabase
      .from('cards')
      .select(CARD_SELECT_COLUMNS + ', flavor_name')
      .ilike('card_name', primaryName)
      .order('is_in_stock', { ascending: false })
      .limit(100)
    
    // Query 2: Flavor name match
    const { data: flavorMatches } = await supabase
      .from('cards')
      .select(CARD_SELECT_COLUMNS + ', flavor_name')
      .ilike('flavor_name', primaryName)
      .order('is_in_stock', { ascending: false })
      .limit(100)
    
    // Query 3: Double-faced card match (card_name starts with "primaryName // ")
    const { data: doubleFacedMatches } = await supabase
      .from('cards')
      .select(CARD_SELECT_COLUMNS + ', flavor_name')
      .ilike('card_name', `${primaryName} // %`)
      .order('is_in_stock', { ascending: false })
      .limit(100)
    
    // Combine results and deduplicate by ID
    const allResults = [
      ...(exactMatches || []),
      ...(flavorMatches || []),
      ...(doubleFacedMatches || [])
    ]
    
    // Deduplicate by card ID
    const seen = new Set<string>()
    allMatches = allResults.filter((card: any) => {
      if (seen.has(card.id)) return false
      seen.add(card.id)
      return true
    }) as unknown as CardMatch[]
    
    
    // If we found matches via flavor_name, expand to include ALL variants of the canonical card
    if (allMatches && allMatches.length > 0) {
      const firstMatch = allMatches[0] as any
      // Check if this was a flavor name match (searched name doesn't match card_name)
      if (firstMatch.card_name.toLowerCase() !== primaryName.toLowerCase()) {
        // This was a flavor name match - fetch all variants of the canonical card
        const canonicalName = firstMatch.card_name
        const { data: allVariants } = await supabase
          .from('cards')
          .select(CARD_SELECT_COLUMNS + ', flavor_name')
          .ilike('card_name', canonicalName)
          .order('is_in_stock', { ascending: false })
          .limit(100)
        
        // Use all variants instead of just the flavor match
        if (allVariants && allVariants.length > 0) {
          allMatches = allVariants as unknown as CardMatch[]
        }
      }
    }
    
    setInCache(primaryName, allMatches || [])
  }
  
  // Ensure allMatches is never null
  if (!allMatches) {
    allMatches = []
  }
  
  let exactMatch: CardMatch | null = null
  let alternatives: CardMatch[] = []
  
  // Sort by stock and foil preference
  const sorted = sortMatches(allMatches, card.foil)
  
  // Try to find exact match by set + collector number
  if (card.set && card.collectorNumber) {
    exactMatch = sorted.find(m => 
      m.set_code?.toLowerCase() === card.set?.toLowerCase() &&
      m.collector_number === card.collectorNumber
    ) || null
  }
  
  // Fallback: match by set only
  if (!exactMatch && card.set) {
    exactMatch = sorted.find(m => 
      m.set_code?.toLowerCase() === card.set?.toLowerCase()
    ) || null
  }
  
  // Fallback: first available match
  if (!exactMatch && sorted.length > 0) {
    exactMatch = sorted[0]
  }
  
  // Build alternatives (exclude exact match)
  alternatives = sorted.filter(m => m.id !== exactMatch?.id).slice(0, 50)
  
  // Populate typeLine from match if not present
  const updatedCard = { ...card }
  if (!updatedCard.typeLine && (exactMatch?.type_line || alternatives[0]?.type_line)) {
    updatedCard.typeLine = exactMatch?.type_line || alternatives[0]?.type_line || undefined
  }
  
  return {
    requestedCard: updatedCard,
    exactMatch,
    alternatives,
    selected: null
  }
}

async function parallelSearchCards(
  supabase: ReturnType<typeof createAdminClient>, 
  cards: DeckCard[]
): Promise<SearchResult[]> {
  // Deduplicate by card name to reduce queries
  const uniqueCards = new Map<string, DeckCard>()
  const cardIndexMap = new Map<string, number[]>()
  
  for (let i = 0; i < cards.length; i++) {
    const card = cards[i]
    const key = getCacheKey(card.name.split(' // ')[0].trim())
    
    if (!uniqueCards.has(key)) {
      uniqueCards.set(key, card)
      cardIndexMap.set(key, [])
    }
    cardIndexMap.get(key)!.push(i)
  }
  
  // Search unique cards in parallel
  const uniqueCardsArray = Array.from(uniqueCards.values())
  const uniqueResults = await Promise.all(
    uniqueCardsArray.map(card => searchSingleCard(supabase, card))
  )
  
  // Map results back to original card order
  const results: SearchResult[] = new Array(cards.length)
  
  for (let i = 0; i < uniqueCardsArray.length; i++) {
    const card = uniqueCardsArray[i]
    const key = getCacheKey(card.name.split(' // ')[0].trim())
    const indices = cardIndexMap.get(key)!
    const result = uniqueResults[i]
    
    for (const idx of indices) {
      // Clone result for each original card position
      results[idx] = {
        ...result,
        requestedCard: { ...cards[idx], typeLine: result.requestedCard.typeLine }
      }
    }
  }
  
  return results
}
