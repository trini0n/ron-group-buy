import { createAdminClient } from '$lib/server/admin'

export const load = async ({ url, setHeaders }) => {
  // Short cache for admin pages (1 minute) - balances freshness with reduced origin hits
  setHeaders({
    'Cache-Control': 'private, max-age=60'
  });

  const adminClient = createAdminClient()

  // Parse filters from URL
  const searchQuery = url.searchParams.get('q')
  const stockFilter = url.searchParams.get('stock') // 'in', 'out', or null
  const setsParam = url.searchParams.get('sets')
  const setFilter = setsParam ? setsParam.split(',').filter(Boolean) : []
  const duplicatesOnly = url.searchParams.get('duplicates') === '1'
  const page = parseInt(url.searchParams.get('page') || '1')
  const perPage = 50

  // Use SQL view with window functions for duplicate detection (eliminates full table scans)
  // Build query using cards_with_duplicates view
  let query = adminClient
    .from('cards_with_duplicates')
    .select(
      'id, serial, card_name, set_name, set_code, collector_number, card_type, is_in_stock, is_new, foil_type, language, scryfall_id, ron_image_url, duplicate_count',
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

  // Filter by duplicates using the pre-calculated duplicate_count column
  if (duplicatesOnly) {
    query = query.gt('duplicate_count', 1)
  }

  // Apply pagination
  const from = (page - 1) * perPage
  const to = from + perPage - 1
  query = query.range(from, to)

  // Execute single query (no more full table scans!)
  const { data: cards, count, error } = await query

  if (error) {
    console.error('Error fetching cards:', error)
    return { cards: [], totalCount: 0, totalDuplicates: 0, page, perPage, sets: [], searchQuery, stockFilter, setFilter: setsParam || '', duplicatesOnly }
  }

  // Get total duplicate count using SQL function (fast, no table scan)
  const { data: duplicateCountData } = await adminClient.rpc('get_duplicate_cards_count')
  const totalDuplicates = duplicateCountData || 0

  // Add isDuplicate flag based on duplicate_count
  const cardsWithDupeFlag = (cards || []).map((card) => ({
    ...card,
    isDuplicate: card.duplicate_count > 1
  }))

  // Get unique sets for filter dropdown (optimized query)
  const { data: setsData } = await adminClient
    .from('cards')
    .select('set_code, set_name')
    .not('set_code', 'is', null)
    .limit(1000) // Reasonable limit instead of fetching all

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
    totalDuplicates,
    page,
    perPage,
    searchQuery,
    stockFilter,
    setFilter: setsParam || '',
    duplicatesOnly,
    sets
  }
}
