import { json, error } from '@sveltejs/kit'
import type { RequestHandler } from './$types'

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
const deckCache = new Map<string, { data: unknown; timestamp: number }>()
const CACHE_TTL = 5 * 60 * 1000 // 5 minutes

function getCached(key: string): unknown | null {
  const cached = deckCache.get(key)
  if (!cached) return null
  if (Date.now() - cached.timestamp > CACHE_TTL) {
    deckCache.delete(key)
    return null
  }
  return cached.data
}

function setCache(key: string, data: unknown) {
  deckCache.set(key, { data, timestamp: Date.now() })
  if (deckCache.size > 100) {
    const firstKey = deckCache.keys().next().value
    if (firstKey) deckCache.delete(firstKey)
  }
}

export const POST: RequestHandler = async ({ request }) => {
  const { url, source } = await request.json()

  if (!url || !source) {
    throw error(400, 'Missing URL or source')
  }

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
    // Re-throw SvelteKit errors as-is
    if (err && typeof err === 'object' && 'status' in err && 'body' in err) throw err
    console.error('[import/deck] Unhandled error:', err)
    const errorMessage = err instanceof Error ? err.message : 'Failed to fetch deck'
    throw error(500, errorMessage)
  }
}

// Browser-like headers to accompany server-side Moxfield requests
const MOXFIELD_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  Accept: 'application/json, text/plain, */*',
  'Accept-Language': 'en-US,en;q=0.9',
  Referer: 'https://www.moxfield.com/',
  Origin: 'https://www.moxfield.com',
  'Sec-Fetch-Dest': 'empty',
  'Sec-Fetch-Mode': 'cors',
  'Sec-Fetch-Site': 'same-site',
  'Cache-Control': 'no-cache'
}

const MOXFIELD_BOARD_TYPES = ['commanders', 'companions', 'mainboard', 'sideboard'] as const
type MoxfieldBoardType = (typeof MOXFIELD_BOARD_TYPES)[number]

async function fetchMoxfieldDeck(url: string): Promise<{ name: string; cards: DeckCard[] }> {
  const match = url.match(/moxfield\.com\/decks\/([a-zA-Z0-9_-]+)/)
  if (!match) throw new Error('Invalid Moxfield URL')
  const deckId = match[1]!

  // Strategy 1: v3 API (current)
  try {
    const resp = await fetch(`https://api2.moxfield.com/v3/decks/all/${deckId}`, {
      headers: MOXFIELD_HEADERS
    })
    console.log(`[moxfield] v3 response: ${resp.status}`)
    if (resp.ok) {
      const deck: MoxfieldDeck = await resp.json()
      return parseMoxfieldDeck(deck)
    }
    if (resp.status === 404) throw new Error('Deck not found on Moxfield')
  } catch (err) {
    if (err instanceof Error && err.message === 'Deck not found on Moxfield') throw err
    console.warn('[moxfield] v3 failed:', err instanceof Error ? err.message : err)
  }

  // Strategy 2: v2 API (older, sometimes less restricted)
  try {
    const resp = await fetch(`https://api2.moxfield.com/v2/decks/all/${deckId}`, {
      headers: MOXFIELD_HEADERS
    })
    console.log(`[moxfield] v2 response: ${resp.status}`)
    if (resp.ok) {
      const deck: MoxfieldDeck = await resp.json()
      return parseMoxfieldDeck(deck)
    }
    if (resp.status === 404) throw new Error('Deck not found on Moxfield')
  } catch (err) {
    if (err instanceof Error && err.message === 'Deck not found on Moxfield') throw err
    console.warn('[moxfield] v2 failed:', err instanceof Error ? err.message : err)
  }

  // Both blocked — let the client show the paste fallback UX
  throw new Error(
    'Unable to import from Moxfield at this time. Please copy the deck list from Moxfield and use the "Paste Deck List" option instead.'
  )
}

function parseMoxfieldDeck(deck: MoxfieldDeck): { name: string; cards: DeckCard[] } {
  const cards: DeckCard[] = []
  const hasBoards = !!deck.boards?.mainboard

  const getCards = (
    zone: MoxfieldBoard | Record<string, MoxfieldCard> | undefined
  ): Record<string, MoxfieldCard> => {
    if (!zone) return {}
    if ('cards' in zone && typeof zone.cards === 'object') return zone.cards as Record<string, MoxfieldCard>
    return zone as Record<string, MoxfieldCard>
  }

  const boardZones: Array<{ zone: MoxfieldBoard | Record<string, MoxfieldCard> | undefined; type: MoxfieldBoardType }> =
    hasBoards
      ? [
          { zone: deck.boards.mainboard, type: 'mainboard' },
          { zone: deck.boards.sideboard, type: 'sideboard' },
          { zone: deck.boards.commanders, type: 'commanders' },
          { zone: deck.boards.companions, type: 'companions' }
        ]
      : [
          { zone: deck.mainboard, type: 'mainboard' },
          { zone: deck.sideboard, type: 'sideboard' },
          { zone: deck.commanders, type: 'commanders' },
          { zone: deck.companions, type: 'companions' }
        ]

  for (const { zone, type: boardType } of boardZones) {
    for (const [, entry] of Object.entries(getCards(zone))) {
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
  if (!match) throw new Error('Invalid Archidekt URL')

  const deckId = match[1]
  const resp = await fetch(`https://archidekt.com/api/decks/${deckId}/`, {
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
      Accept: 'application/json',
      'Accept-Language': 'en-US,en;q=0.9',
      Referer: 'https://archidekt.com/',
      Origin: 'https://archidekt.com'
    }
  })

  if (!resp.ok) throw new Error(`Archidekt API returned ${resp.status}`)

  const deck: ArchidektDeck = await resp.json()
  const cards: DeckCard[] = []
  const seen = new Set<string>()

  for (const entry of deck.cards ?? []) {
    const cardName = entry.card.oracleCard.name
    if (seen.has(cardName)) continue
    seen.add(cardName)

    const categories = entry.categories ?? []
    let boardType: DeckCard['boardType'] = 'mainboard'
    if (categories.includes('Commander')) boardType = 'commanders'
    else if (categories.includes('Companion')) boardType = 'companions'
    else if (categories.includes('Sideboard') || categories.includes('Maybeboard')) boardType = 'sideboard'

    let typeLine =
      entry.card.typeLine ?? entry.card.oracleCard.typeLine ?? entry.card.oracleCard.type ?? ''
    if (!typeLine) {
      const typeMap: Record<string, string> = {
        Creature: 'Creature',
        Creatures: 'Creature',
        Instant: 'Instant',
        Instants: 'Instant',
        Sorcery: 'Sorcery',
        Sorceries: 'Sorcery',
        Artifact: 'Artifact',
        Artifacts: 'Artifact',
        Enchantment: 'Enchantment',
        Enchantments: 'Enchantment',
        Planeswalker: 'Planeswalker',
        Planeswalkers: 'Planeswalker',
        Land: 'Land',
        Lands: 'Land'
      }
      typeLine = categories.map((c) => typeMap[c]).find(Boolean) ?? ''
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
