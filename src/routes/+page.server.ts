import type { PageServerLoad } from './$types'
import type { Card } from '$lib/server/types'
import { compareSetsByReleaseDateAsc } from '$lib/server/set-release-dates'

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

export const load: PageServerLoad = async ({ locals, url }) => {
  // Parse URL search params for initial filter state
  const searchParams = url.searchParams
  const initialFilters = {
    search: searchParams.get('q') || '',
    setCode: searchParams.get('set') || '',
    colorIdentity: searchParams.get('colors')?.split(',').filter(Boolean) || [],
    colorIdentityStrict: searchParams.get('strict') === '1',
    priceCategories: searchParams.get('price')?.split(',').filter(Boolean) || ['Non-Foil', 'Foil'],
    cardTypes: searchParams.get('types')?.split(',').filter(Boolean) || [],
    frameTypes: searchParams.get('frames')?.split(',').filter(Boolean) || [],
    inStockOnly: searchParams.get('stock') === '1',
    isNew: searchParams.get('new') === '1',
    view: (searchParams.get('view') as 'grid' | 'table') || 'grid'
  }
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

  // Sort cards: by name, then by finish type, then by set release date, then by collector number
  allCards.sort((a, b) => {
    // 1. Sort by card name
    const nameCompare = a.card_name.localeCompare(b.card_name)
    if (nameCompare !== 0) return nameCompare

    // 2. Sort by finish type (Normal → Holo → Foil → Surge Foil)
    const finishCompare = getFinishSortOrder(a) - getFinishSortOrder(b)
    if (finishCompare !== 0) return finishCompare

    // 3. Sort by set code chronologically (older sets first)
    const setCodeA = a.set_code || ''
    const setCodeB = b.set_code || ''
    const setCompare = compareSetsByReleaseDateAsc(setCodeA, setCodeB)
    if (setCompare !== 0) return setCompare

    // 4. Sort by collector's number numerically
    const collNumA = parseInt(a.collector_number || '0', 10) || 0
    const collNumB = parseInt(b.collector_number || '0', 10) || 0
    return collNumA - collNumB
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
    sets,
    initialFilters
  }
}
