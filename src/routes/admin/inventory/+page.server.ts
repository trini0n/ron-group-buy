import { createAdminClient } from '$lib/server/admin'

export const load = async ({ url }) => {
  const adminClient = createAdminClient()

  // Parse filters from URL
  const searchQuery = url.searchParams.get('q')
  const stockFilter = url.searchParams.get('stock') // 'in', 'out', or null
  const setFilter = url.searchParams.get('set')
  const page = parseInt(url.searchParams.get('page') || '1')
  const perPage = 50

  // Build query
  let query = adminClient
    .from('cards')
    .select('id, serial, card_name, set_name, set_code, card_type, is_in_stock, is_new, foil_type', { count: 'exact' })
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

  if (setFilter) {
    query = query.ilike('set_code', setFilter)
  }

  // Pagination
  const from = (page - 1) * perPage
  const to = from + perPage - 1
  query = query.range(from, to)

  const { data: cards, count, error } = await query

  if (error) {
    console.error('Error fetching cards:', error)
    return { cards: [], totalCount: 0, page, perPage, sets: [] }
  }

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
    cards: cards || [],
    totalCount: count || 0,
    page,
    perPage,
    searchQuery,
    stockFilter,
    setFilter,
    sets
  }
}
