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
  const { data: allCardsForDupes } = await adminClient
    .from('cards')
    .select('id, serial, card_name, set_code, collector_number, card_type, foil_type, language')

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

  // Filter to only duplicates if requested
  if (duplicatesOnly) {
    query = query.in('id', Array.from(duplicateIds))
  }

  // Pagination
  const from = (page - 1) * perPage
  const to = from + perPage - 1
  query = query.range(from, to)

  const { data: cards, count, error } = await query

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
