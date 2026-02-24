import { json, error } from '@sveltejs/kit'
import type { RequestHandler } from './$types'
import { parseDeckList } from '$lib/deck-utils'

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

interface MoxfieldDeck {
  name: string
  exportId: string
  publicId: string
  boards: {
    mainboard?: MoxfieldBoard
    sideboard?: MoxfieldBoard
    commanders?: MoxfieldBoard
    companions?: MoxfieldBoard
    [key: string]: MoxfieldBoard | undefined
  }
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
const CACHE_TTL = 5 * 60 * 1000

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

// Browser-like headers for Moxfield requests
const MOXFIELD_HEADERS: HeadersInit = {
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

const BOARD_TYPES = ['commanders', 'companions', 'mainboard', 'sideboard'] as const

async function fetchMoxfieldDeck(url: string): Promise<{ name: string; cards: DeckCard[] }> {
  const match = url.match(/moxfield\.com\/decks\/([a-zA-Z0-9_-]+)/)
  if (!match) throw new Error('Invalid Moxfield URL')
  const publicId = match[1]!

  // Strategy 1: Fetch JSON to get exportId, then fetch the plain-text export.
  // The export endpoint is a simpler text response that tends to be less aggressively
  // protected than the main JSON API, since it's also served to the download button.
  try {
    const deckResp = await fetch(`https://api2.moxfield.com/v3/decks/all/${publicId}`, {
      headers: MOXFIELD_HEADERS
    })
    console.log(`[moxfield] v3 JSON response: ${deckResp.status}`)

    if (deckResp.ok) {
      const deck: MoxfieldDeck = await deckResp.json()
      const deckName = deck.name
      const exportId = deck.exportId

      if (exportId) {
        // Fetch the plain-text Arena-format export
        const exportResp = await fetch(
          `https://api2.moxfield.com/v2/decks/all/${publicId}/export?exportId=${exportId}`,
          { headers: { ...MOXFIELD_HEADERS, Accept: 'text/plain, */*' } }
        )
        console.log(`[moxfield] export response: ${exportResp.status}`)

        if (exportResp.ok) {
          const text = await exportResp.text()
          // parseDeckList handles Arena format: "1 Card Name (SET) 123"
          const cards = parseDeckList(text)
          console.log(`[moxfield] parsed ${cards.length} cards from export`)
          return { name: deckName, cards }
        }
      }

      // exportId fetch failed — fall back to parsing the JSON boards directly
      console.log('[moxfield] falling back to JSON board parsing')
      return parseMoxfieldJsonDeck(deck)
    }

    if (deckResp.status === 404) throw new Error('Deck not found on Moxfield')
  } catch (err) {
    if (err instanceof Error && err.message === 'Deck not found on Moxfield') throw err
    console.warn('[moxfield] strategy 1 failed:', err instanceof Error ? err.message : err)
  }

  // Strategy 2: v2 JSON fallback (older API path, occasionally less restricted)
  try {
    const resp = await fetch(`https://api2.moxfield.com/v2/decks/all/${publicId}`, {
      headers: MOXFIELD_HEADERS
    })
    console.log(`[moxfield] v2 JSON response: ${resp.status}`)
    if (resp.ok) {
      const deck: MoxfieldDeck = await resp.json()
      return parseMoxfieldJsonDeck(deck)
    }
    if (resp.status === 404) throw new Error('Deck not found on Moxfield')
  } catch (err) {
    if (err instanceof Error && err.message === 'Deck not found on Moxfield') throw err
    console.warn('[moxfield] strategy 2 failed:', err instanceof Error ? err.message : err)
  }

  // All strategies failed — surface the paste-text fallback UX
  throw new Error(
    'Unable to import from Moxfield at this time. Please copy the deck list from Moxfield and use the "Paste Deck List" option instead.'
  )
}

function parseMoxfieldJsonDeck(deck: MoxfieldDeck): { name: string; cards: DeckCard[] } {
  const cards: DeckCard[] = []

  for (const boardType of BOARD_TYPES) {
    const board = deck.boards?.[boardType]
    if (!board?.cards) continue
    for (const [, entry] of Object.entries(board.cards)) {
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
        Creature: 'Creature', Creatures: 'Creature',
        Instant: 'Instant', Instants: 'Instant',
        Sorcery: 'Sorcery', Sorceries: 'Sorcery',
        Artifact: 'Artifact', Artifacts: 'Artifact',
        Enchantment: 'Enchantment', Enchantments: 'Enchantment',
        Planeswalker: 'Planeswalker', Planeswalkers: 'Planeswalker',
        Land: 'Land', Lands: 'Land'
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
