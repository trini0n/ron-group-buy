import { json, error } from '@sveltejs/kit'
import type { RequestHandler } from './$types'
import MoxfieldApi from 'moxfield-api'

interface MoxfieldCard {
  quantity: number
  card: {
    name: string
    set: string
    cn: string
    type_line?: string
  }
}

interface MoxfieldBoard {
  count: number
  cards: Record<string, MoxfieldCard>
}

interface MoxfieldBoards {
  mainboard: MoxfieldBoard
  sideboard: MoxfieldBoard
  commanders: MoxfieldBoard
  companions: MoxfieldBoard
}

interface MoxfieldDeck {
  name: string
  boards: MoxfieldBoards
  mainboard?: Record<string, MoxfieldCard>
  sideboard?: Record<string, MoxfieldCard>
  commanders?: Record<string, MoxfieldCard>
  companions?: Record<string, MoxfieldCard>
}

interface ArchidektCard {
  quantity: number
  card: {
    oracleCard: {
      name: string
      typeLine?: string
      type?: string
    }
    edition: {
      editioncode: string
    }
    collectorNumber: string
    typeLine?: string
  }
  categories?: string[]
}

interface ArchidektDeck {
  name: string
  cards: ArchidektCard[]
}

interface DeckCard {
  quantity: number
  name: string
  set?: string
  collectorNumber?: string
  boardType?: string
  typeLine?: string
}

// Simple in-memory cache with 5 minute TTL
const deckCache = new Map<string, { data: any; timestamp: number }>()
const CACHE_TTL = 5 * 60 * 1000 // 5 minutes

function getCached(key: string): any | null {
  const cached = deckCache.get(key)
  if (!cached) return null
  if (Date.now() - cached.timestamp > CACHE_TTL) {
    deckCache.delete(key)
    return null
  }
  return cached.data
}

function setCache(key: string, data: any) {
  deckCache.set(key, { data, timestamp: Date.now() })
  // Limit cache size
  if (deckCache.size > 100) {
    const firstKey = deckCache.keys().next().value
    if (firstKey) {
      deckCache.delete(firstKey)
    }
  }
}

export const POST: RequestHandler = async ({ request }) => {
  const { url, source } = await request.json()

  if (!url || !source) {
    throw error(400, 'Missing URL or source')
  }

  // Check cache first
  const cacheKey = `${source}:${url}`
  const cached = getCached(cacheKey)
  if (cached) {
    return json(cached)
  }

  try {
    let cards: DeckCard[] = []
    let deckName = ''

    if (source === 'moxfield') {
      const result = await fetchMoxfieldDeck(url)
      cards = result.cards
      deckName = result.name
    } else if (source === 'archidekt') {
      const result = await fetchArchidektDeck(url)
      cards = result.cards
      deckName = result.name
    } else {
      throw error(400, 'Unsupported deck source')
    }

    const response = { name: deckName, cards }
    setCache(cacheKey, response)
    return json(response)
  } catch (err) {
    console.error('Error fetching deck:', err)
    const errorMessage = err instanceof Error ? err.message : 'Failed to fetch deck'
    throw error(500, errorMessage)
  }
}

async function fetchWithRetry(url: string, options: RequestInit, maxRetries = 2): Promise<Response> {
  let lastError: Error | null = null
  
  for (let i = 0; i <= maxRetries; i++) {
    try {
      // Add small delay between retries
      if (i > 0) {
        await new Promise(resolve => setTimeout(resolve, 1000 * i))
      }
      
      const response = await fetch(url, options)
      if (response.ok) return response
      
      // Don't retry on 4xx errors (except 429)
      if (response.status >= 400 && response.status < 500 && response.status !== 429) {
        throw new Error(`API returned ${response.status}`)
      }
      
      lastError = new Error(`API returned ${response.status}`)
    } catch (err) {
      lastError = err instanceof Error ? err : new Error('Fetch failed')
    }
  }
  
  throw lastError || new Error('Max retries exceeded')
}

const MOXFIELD_BOARD_TYPES = ['commanders', 'companions', 'mainboard', 'sideboard'] as const
type MoxfieldBoardType = (typeof MOXFIELD_BOARD_TYPES)[number]

async function fetchMoxfieldDeck(url: string): Promise<{ name: string; cards: DeckCard[] }> {
  const match = url.match(/moxfield\.com\/decks\/([a-zA-Z0-9_-]+)/)
  if (!match) {
    throw new Error('Invalid Moxfield URL')
  }

  const deckId = match[1]!

  // Strategy 1: Use the moxfield-api library (primary)
  try {
    const moxfield = new MoxfieldApi()
    const deck = await moxfield.deckList.findById(deckId)
    return parseMoxfieldLibraryDeck(deck)
  } catch (libErr) {
    console.log('moxfield-api library failed, falling back to direct fetch...', libErr)
  }

  // Strategy 2: Direct API fetch with browser-like headers (fallback)
  const apiUrl = `https://api2.moxfield.com/v3/decks/all/${deckId}`
  try {
    const response = await fetchWithRetry(apiUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
        'Accept': 'application/json',
        'Accept-Language': 'en-US,en;q=0.9',
        'Referer': 'https://www.moxfield.com/',
        'Origin': 'https://www.moxfield.com',
        'DNT': '1',
        'Connection': 'keep-alive',
        'Sec-Fetch-Dest': 'empty',
        'Sec-Fetch-Mode': 'cors',
        'Sec-Fetch-Site': 'same-site'
      }
    })

    const deck: MoxfieldDeck = await response.json()
    return parseMoxfieldDeck(deck)
  } catch (apiErr) {
    console.log('Moxfield direct API failed:', apiErr)
  }

  // Both strategies failed
  throw new Error(
    'Unable to import from Moxfield at this time. Please copy the deck list from Moxfield and use the "Paste Deck List" option instead.'
  )
}

/**
 * Parse a deck returned by the moxfield-api library.
 * The library returns a DeckListType whose boards have cards as a Record<string, entry>
 * where each entry has: { card: { name, set, cn, type_line }, quantity, boardType }.
 */
function parseMoxfieldLibraryDeck(deck: any): { name: string; cards: DeckCard[] } {
  const cards: DeckCard[] = []

  const boardTypeMap: MoxfieldBoardType[] = ['commanders', 'companions', 'mainboard', 'sideboard']

  for (const boardType of boardTypeMap) {
    const board = deck.boards?.[boardType]
    if (!board?.cards) continue

    for (const [, entry] of Object.entries(board.cards as Record<string, any>)) {
      if (!entry?.card) continue
      cards.push({
        quantity: entry.quantity,
        name: entry.card.name,
        set: entry.card.set?.toUpperCase(),
        collectorNumber: entry.card.cn,
        boardType,
        typeLine: entry.card.type_line ?? undefined
      })
    }
  }

  return { name: deck.name ?? 'Imported Deck', cards }
}

function parseMoxfieldDeck(deck: MoxfieldDeck): { name: string; cards: DeckCard[] } {
  const cards: DeckCard[] = []
  const hasBoards = deck.boards && deck.boards.mainboard

  const getCards = (zone: MoxfieldBoard | Record<string, MoxfieldCard> | undefined): Record<string, MoxfieldCard> => {
    if (!zone) return {}
    if ('cards' in zone && typeof zone.cards === 'object') {
      return zone.cards as Record<string, MoxfieldCard>
    }
    return zone as Record<string, MoxfieldCard>
  }

  const boardTypeMap = hasBoards
    ? [
        { zone: deck.boards.mainboard, type: 'mainboard' as DeckCard['boardType'] },
        { zone: deck.boards.sideboard, type: 'sideboard' as DeckCard['boardType'] },
        { zone: deck.boards.commanders, type: 'commanders' as DeckCard['boardType'] },
        { zone: deck.boards.companions, type: 'companions' as DeckCard['boardType'] }
      ]
    : [
        { zone: deck.mainboard, type: 'mainboard' as DeckCard['boardType'] },
        { zone: deck.sideboard, type: 'sideboard' as DeckCard['boardType'] },
        { zone: deck.commanders, type: 'commanders' as DeckCard['boardType'] },
        { zone: deck.companions, type: 'companions' as DeckCard['boardType'] }
      ]

  for (const { zone, type: boardType } of boardTypeMap) {
    const cards_map = getCards(zone)
    for (const [, entry] of Object.entries(cards_map)) {
      if (!entry.card) continue
      
      cards.push({
        quantity: entry.quantity,
        name: entry.card.name,
        set: entry.card.set?.toUpperCase(),
        collectorNumber: entry.card.cn,
        boardType,
        typeLine: entry.card.type_line
      })
    }
  }

  return { name: deck.name, cards }
}

async function fetchArchidektDeck(url: string): Promise<{ name: string; cards: DeckCard[] }> {
  const match = url.match(/archidekt\.com\/decks\/(\d+)/)
  if (!match) {
    throw new Error('Invalid Archidekt URL')
  }

  const deckId = match[1]
  const apiUrl = `https://archidekt.com/api/decks/${deckId}/`

  const response = await fetchWithRetry(apiUrl, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
      'Accept': 'application/json',
      'Accept-Language': 'en-US,en;q=0.9',
      'Referer': 'https://archidekt.com/',
      'Origin': 'https://archidekt.com'
    }
  })

  const deck: ArchidektDeck = await response.json()
  const cards: DeckCard[] = []
  const seenCards = new Set<string>()

  for (const entry of deck.cards || []) {
    const cardName = entry.card.oracleCard.name
    
    // Deduplicate
    if (seenCards.has(cardName)) continue
    seenCards.add(cardName)
    
    // Determine board type from categories
    const categories = entry.categories || []
    let boardType: DeckCard['boardType'] = 'mainboard'
    if (categories.includes('Commander')) boardType = 'commanders'
    else if (categories.includes('Companion')) boardType = 'companions'
    else if (categories.includes('Sideboard') || categories.includes('Maybeboard')) boardType = 'sideboard'

    // Get type line
    let typeLine = entry.card.typeLine 
      || entry.card.oracleCard.typeLine 
      || entry.card.oracleCard.type 
      || ''
    
    if (!typeLine && categories.length > 0) {
      if (categories.includes('Creature') || categories.includes('Creatures')) typeLine = 'Creature'
      else if (categories.includes('Instant') || categories.includes('Instants')) typeLine = 'Instant'
      else if (categories.includes('Sorcery') || categories.includes('Sorceries')) typeLine = 'Sorcery'
      else if (categories.includes('Artifact') || categories.includes('Artifacts')) typeLine = 'Artifact'
      else if (categories.includes('Enchantment') || categories.includes('Enchantments')) typeLine = 'Enchantment'
      else if (categories.includes('Planeswalker') || categories.includes('Planeswalkers')) typeLine = 'Planeswalker'
      else if (categories.includes('Land') || categories.includes('Lands')) typeLine = 'Land'
    }

    cards.push({
      quantity: entry.quantity,
      name: cardName,
      set: entry.card.edition?.editioncode?.toUpperCase(),
      collectorNumber: entry.card.collectorNumber,
      boardType,
      typeLine
    })
  }

  return { name: deck.name, cards }
}
