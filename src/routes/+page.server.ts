import type { PageServerLoad } from './$types'
import type { Card } from '$lib/server/types'

// Define finish order for sorting: Normal → Holo → Foil → Surge Foil
const FINISH_ORDER: Record<string, number> = {
  Normal: 0,
  Holo: 1,
  Foil: 2,
  'Surge Foil': 3
}

function getFinishSortOrder(card: Card): number {
  // Use foil_type if present (e.g., "Surge Foil"), otherwise use card_type
  const finish = card.foil_type || card.card_type
  return FINISH_ORDER[finish] ?? 99
}

export const load: PageServerLoad = async ({ locals }) => {
  // Fetch ALL cards in batches (Supabase has a 1000 row limit per request)
  const batchSize = 1000
  let allCards: Card[] = []
  let offset = 0
  let hasMore = true

  while (hasMore) {
    const { data: batch, error } = await locals.supabase
      .from('cards')
      .select('*')
      .order('card_name', { ascending: true })
      .range(offset, offset + batchSize - 1)

    if (error) {
      console.error('Error fetching cards:', error)
      break
    }

    if (batch && batch.length > 0) {
      allCards = [...allCards, ...batch]
      offset += batchSize
      hasMore = batch.length === batchSize
    } else {
      hasMore = false
    }
  }

  // Sort cards: by name, then by finish type (Normal → Holo → Foil → Surge Foil)
  allCards.sort((a, b) => {
    const nameCompare = a.card_name.localeCompare(b.card_name)
    if (nameCompare !== 0) return nameCompare
    return getFinishSortOrder(a) - getFinishSortOrder(b)
  })

  // Derive unique sets from the cards data (more reliable than separate query)
  const setsMap = new Map<string, string>()
  allCards.forEach((card) => {
    if (card.set_code && card.set_name && !setsMap.has(card.set_code)) {
      setsMap.set(card.set_code, card.set_name)
    }
  })

  const sets = Array.from(setsMap.entries())
    .map(([code, name]) => ({ code, name }))
    .sort((a, b) => a.name.localeCompare(b.name))

  return {
    cards: allCards,
    sets
  }
}
