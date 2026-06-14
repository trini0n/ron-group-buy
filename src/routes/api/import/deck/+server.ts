import { json, error } from '@sveltejs/kit'
import type { RequestHandler } from './$types'
import { logger } from '$lib/server/logger'
import { LRUCache } from 'lru-cache'
import { createRateLimiter, getClientIp } from '$lib/server/rate-limiter'

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

const deckCache = new LRUCache<string, object>({
  max: 100,
  ttl: 5 * 60 * 1000
})

// Rate limiter: 10 requests/min per IP — proxies Moxfield/Archidekt, so strict limit
const deckImportLimiter = createRateLimiter({ limit: 10, windowMs: 60_000 })

export const POST: RequestHandler = async ({ request }) => {
  const { limited } = deckImportLimiter(getClientIp(request))
  if (limited) {
    throw error(429, 'Too many requests — please wait before importing another deck')
  }

  const { url, source } = await request.json()

  if (!url || !source) {
    throw error(400, 'Missing URL or source')
  }

  const cacheKey = `${source}:${url}`
  const cached = deckCache.get(cacheKey) ?? null
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
    deckCache.set(cacheKey, response)
    return json(response)
  } catch (err) {
    // Re-throw SvelteKit errors as-is
    if (err && typeof err === 'object' && 'status' in err && 'body' in err) throw err
    logger.error({ error: err }, '[import/deck] Unhandled error')
    const errorMessage = err instanceof Error ? err.message : 'Failed to fetch deck'
    throw error(500, errorMessage)
  }
}

const MOXFIELD_HEADERS = {
  'User-Agent': 'RonsGroupBuy/1.0',
  Accept: 'application/json',
}

const BOARD_TYPES = ['commanders', 'companions', 'mainboard', 'sideboard'] as const

async function fetchMoxfieldDeck(url: string): Promise<{ name: string; cards: DeckCard[] }> {
  const match = url.match(/moxfield\.com\/decks\/([a-zA-Z0-9_-]+)/)
  if (!match?.[1]) throw new Error('Invalid Moxfield URL')
  const publicId = match[1]

  const metaRes = await fetch(`https://api2.moxfield.com/v3/decks/all/${publicId}`, {
    headers: MOXFIELD_HEADERS
  })
  logger.info({ status: metaRes.status }, '[moxfield] v3 metadata response')

  if (metaRes.status === 404) throw error(404, 'Deck not found on Moxfield')
  if (!metaRes.ok)
    throw error(
      422,
      `Moxfield blocked this request (${metaRes.status}). Please copy the deck list from Moxfield and use the Paste Deck List option instead.`
    )

  const deck: MoxfieldDeck = await metaRes.json()
  const result = parseMoxfieldJsonDeck(deck)
  if (result.cards.length === 0)
    throw error(422, 'No cards found in this Moxfield deck. The deck may be private or empty.')
  return result
}

// Normalize MDFCs: take first face only ("A // B" or "A / B" → "A")
function normalizeMdfc(name: string): string {
  const doubleParts = name.split(' // ')
  if (doubleParts.length > 1) return doubleParts[0].trim()
  const singleParts = name.split(' / ')
  if (singleParts.length > 1) return singleParts[0].trim()
  return name.trim()
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
        name: normalizeMdfc(entry.card.name),
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

    let typeLine = entry.card.typeLine ?? entry.card.oracleCard.typeLine ?? entry.card.oracleCard.type ?? ''
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
