import { createAdminClient } from '$lib/server/admin'

export const load = async ({ url }) => {
  const adminClient = createAdminClient()

  // Parse filters from URL
  const searchQuery = url.searchParams.get('q')
  const stockFilter = url.searchParams.get('stock') // 'in', 'out', or null
  const setsParam = url.searchParams.get('sets')
  const setFilter = setsParam ? setsParam.split(',').filter(Boolean) : []
  const duplicatesOnly = url.searchParams.get('duplicates') === '1'
  const page = parseInt(url.searchParams.get('page') || '1')
  const perPage = 50

  // First, identify all duplicate card keys (name + set + collector number + finish + language)
  // Note: Supabase has a default 1000 row limit, so we need to fetch all cards with pagination
  const allCardsForDupes: Array<{
    id: string
    serial: string
    card_name: string
    set_code: string | null
    collector_number: string | null
    card_type: string
    foil_type: string | null
    language: string | null
  }> = []

  const batchSize = 1000
  let offset = 0
  let hasMore = true

  while (hasMore) {
    const { data: batch } = await adminClient
      .from('cards')
      .select('id, serial, card_name, set_code, collector_number, card_type, foil_type, language')
      .range(offset, offset + batchSize - 1)

    if (batch && batch.length > 0) {
      allCardsForDupes.push(...batch)
      offset += batchSize
      hasMore = batch.length === batchSize
    } else {
      hasMore = false
    }
  }

  // Build a map of card keys to their serials
  const cardKeyToSerials = new Map<string, string[]>()
  const duplicateIds = new Set<string>()

  allCardsForDupes?.forEach((card) => {
    const finish = card.foil_type || card.card_type
    const key = `${card.card_name}|${card.set_code}|${card.collector_number}|${finish}|${card.language || 'en'}`

    if (!cardKeyToSerials.has(key)) {
      cardKeyToSerials.set(key, [])
    }
    cardKeyToSerials.get(key)!.push(card.id)
  })

  // Mark all cards that have duplicates
  cardKeyToSerials.forEach((ids) => {
    if (ids.length > 1) {
      ids.forEach((id) => duplicateIds.add(id))
    }
  })

  // Build query
  let query = adminClient
    .from('cards')
    .select(
      'id, serial, card_name, set_name, set_code, collector_number, card_type, is_in_stock, is_new, foil_type, language, scryfall_id, ron_image_url',
      { count: 'exact' }
    )
    .order('card_name', { ascending: true })

  // Apply filters
  if (searchQuery) {
    query = query.or(`card_name.ilike.%${searchQuery}%,serial.ilike.%${searchQuery}%`)
  }

  if (stockFilter === 'in') {
    query = query.eq('is_in_stock', true)
  } else if (stockFilter === 'out') {
    query = query.eq('is_in_stock', false)
  }

  if (setFilter.length > 0) {
    query = query.in('set_code', setFilter)
  }

  // For duplicates filtering, we need to fetch all matching cards first and then filter client-side
  // because Supabase's .in() filter has limitations with large arrays
  type InventoryCard = {
    id: string
    serial: string
    card_name: string
    set_name: string | null
    set_code: string | null
    collector_number: string | null
    card_type: string
    is_in_stock: boolean | null
    is_new: boolean | null
    foil_type: string | null
    language: string | null
    scryfall_id: string | null
    ron_image_url: string | null
  }
  let cards: InventoryCard[] | null = null
  let count: number | null = null
  let error: Error | null = null

  if (duplicatesOnly) {
    // Fetch all cards that match filters (without pagination) so we can filter by duplicates client-side
    const allMatchingCards: InventoryCard[] = []
    let fetchOffset = 0
    const fetchBatchSize = 1000
    let fetchHasMore = true

    while (fetchHasMore) {
      let batchQuery = adminClient
        .from('cards')
        .select('id, serial, card_name, set_name, set_code, collector_number, card_type, is_in_stock, is_new, foil_type, language, scryfall_id, ron_image_url')
        .order('card_name', { ascending: true })
        .range(fetchOffset, fetchOffset + fetchBatchSize - 1)

      // Apply same filters
      if (searchQuery) {
        batchQuery = batchQuery.or(`card_name.ilike.%${searchQuery}%,serial.ilike.%${searchQuery}%`)
      }
      if (stockFilter === 'in') {
        batchQuery = batchQuery.eq('is_in_stock', true)
      } else if (stockFilter === 'out') {
        batchQuery = batchQuery.eq('is_in_stock', false)
      }
      if (setFilter.length > 0) {
        batchQuery = batchQuery.in('set_code', setFilter)
      }

      const { data: batch, error: batchError } = await batchQuery

      if (batchError) {
        error = batchError as unknown as Error
        fetchHasMore = false
      } else if (batch && batch.length > 0) {
        allMatchingCards.push(...batch)
        fetchOffset += fetchBatchSize
        fetchHasMore = batch.length === fetchBatchSize
      } else {
        fetchHasMore = false
      }
    }

    // Filter to only duplicates
    const duplicateCards = allMatchingCards.filter((card) => duplicateIds.has(card.id))
    count = duplicateCards.length

    // Apply pagination to the filtered results
    const from = (page - 1) * perPage
    const to = from + perPage
    cards = duplicateCards.slice(from, to)
  } else {
    // Normal pagination - use Supabase's built-in pagination
    const from = (page - 1) * perPage
    const to = from + perPage - 1
    query = query.range(from, to)

    const result = await query
    cards = result.data
    count = result.count
    error = result.error as Error | null
  }

  if (error) {
    console.error('Error fetching cards:', error)
    return { cards: [], totalCount: 0, page, perPage, sets: [], duplicateIds: [] }
  }

  // Add isDuplicate flag to each card
  const cardsWithDupeFlag = (cards || []).map((card) => ({
    ...card,
    isDuplicate: duplicateIds.has(card.id)
  }))

  // Get unique sets for filter dropdown
  const { data: setsData } = await adminClient.from('cards').select('set_code, set_name').not('set_code', 'is', null)

  // Deduplicate sets
  const setsMap = new Map<string, string>()
  setsData?.forEach((card) => {
    if (card.set_code && !setsMap.has(card.set_code)) {
      setsMap.set(card.set_code, card.set_name || card.set_code)
    }
  })

  const sets = Array.from(setsMap.entries())
    .map(([code, name]) => ({ code, name }))
    .sort((a, b) => a.name.localeCompare(b.name))

  return {
    cards: cardsWithDupeFlag,
    totalCount: count || 0,
    totalDuplicates: duplicateIds.size,
    page,
    perPage,
    searchQuery,
    stockFilter,
    setFilter: setsParam || '',
    duplicatesOnly,
    sets
  }
}
