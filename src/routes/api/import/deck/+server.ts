import { json, error } from '@sveltejs/kit'
import type { RequestHandler } from './$types'

interface MoxfieldCard {
  quantity: number
  card: {
    name: string
    set: string
    cn: string // collector number
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
  // Legacy structure (older API versions)
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
    }
    edition: {
      editioncode: string
    }
    collectorNumber: string
  }
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

export const POST: RequestHandler = async ({ request }) => {
  const { url, source } = await request.json()

  if (!url || !source) {
    throw error(400, 'Missing URL or source')
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

    return json({ name: deckName, cards })
  } catch (err) {
    console.error('Error fetching deck:', err)
    throw error(500, err instanceof Error ? err.message : 'Failed to fetch deck')
  }
}

async function fetchMoxfieldDeck(url: string): Promise<{ name: string; cards: DeckCard[] }> {
  // Extract deck ID from URL
  // Format: https://www.moxfield.com/decks/xxxxx
  const match = url.match(/moxfield\.com\/decks\/([a-zA-Z0-9_-]+)/)
  if (!match) {
    throw new Error('Invalid Moxfield URL')
  }

  const deckId = match[1]
  const apiUrl = `https://api2.moxfield.com/v3/decks/all/${deckId}`

  const response = await fetch(apiUrl, {
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      Accept: 'application/json',
      'Accept-Language': 'en-US,en;q=0.9',
      Referer: 'https://www.moxfield.com/',
      Origin: 'https://www.moxfield.com'
    }
  })

  if (!response.ok) {
    const text = await response.text()
    console.error('Moxfield API error:', response.status, text.substring(0, 500))
    throw new Error(`Moxfield API returned ${response.status}`)
  }

  const deck: MoxfieldDeck = await response.json()
  const cards: DeckCard[] = []

  // Handle both old API structure (direct properties) and new v3 structure (boards object with nested cards)
  const hasBoards = deck.boards && deck.boards.mainboard

  // Get card records from either new or old structure
  const getCards = (zone: MoxfieldBoard | Record<string, MoxfieldCard> | undefined): Record<string, MoxfieldCard> => {
    if (!zone) return {}
    // New structure has cards property, old structure is the cards directly
    if ('cards' in zone && typeof zone.cards === 'object') {
      return zone.cards as Record<string, MoxfieldCard>
    }
    return zone as Record<string, MoxfieldCard>
  }

  // Collect cards from all zones
  const zones = hasBoards
    ? [deck.boards.mainboard, deck.boards.sideboard, deck.boards.commanders, deck.boards.companions]
    : [deck.mainboard, deck.sideboard, deck.commanders, deck.companions]

  for (const zone of zones) {
    const cards_map = getCards(zone)
    for (const [, entry] of Object.entries(cards_map)) {
      if (!entry.card) continue
      // Determine board type
      let boardType: DeckCard['boardType'] = 'mainboard'
      if (zone === deck.boards?.commanders || zone === deck.commanders) boardType = 'commanders'
      else if (zone === deck.boards?.companions || zone === deck.companions) boardType = 'companions'
      else if (zone === deck.boards?.sideboard || zone === deck.sideboard) boardType = 'sideboard'
      
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
  // Extract deck ID from URL
  // Format: https://archidekt.com/decks/xxxxx/deckname
  const match = url.match(/archidekt\.com\/decks\/(\d+)/)
  if (!match) {
    throw new Error('Invalid Archidekt URL')
  }

  const deckId = match[1]
  const apiUrl = `https://archidekt.com/api/decks/${deckId}/`

  const response = await fetch(apiUrl, {
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      Accept: 'application/json',
      'Accept-Language': 'en-US,en;q=0.9',
      Referer: 'https://archidekt.com/',
      Origin: 'https://archidekt.com'
    }
  })

  if (!response.ok) {
    const text = await response.text()
    console.error('Archidekt API error:', response.status, text.substring(0, 500))
    throw new Error(`Archidekt API returned ${response.status}`)
  }

  const deck: ArchidektDeck = await response.json()
  const cards: DeckCard[] = []

  for (const entry of deck.cards || []) {
    cards.push({
      quantity: entry.quantity,
      name: entry.card.oracleCard.name,
      set: entry.card.edition?.editioncode?.toUpperCase(),
      collectorNumber: entry.card.collectorNumber
    })
  }

  return { name: deck.name, cards }
}
