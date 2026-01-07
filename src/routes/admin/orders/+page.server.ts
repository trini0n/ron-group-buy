import { createAdminClient } from '$lib/server/admin'

export const load = async ({ url }) => {
  const adminClient = createAdminClient()

  // Parse filters from URL
  const statusFilter = url.searchParams.get('status')
  const searchQuery = url.searchParams.get('q')
  const page = parseInt(url.searchParams.get('page') || '1')
  const perPage = 25

  // Build query
  let query = adminClient
    .from('orders')
    .select(
      `
      *,
      user:users(id, name, email, discord_username),
      items:order_items(
        id,
        card_serial,
        card_name,
        card_type,
        quantity,
        unit_price
      )
    `,
      { count: 'exact' }
    )
    .order('created_at', { ascending: false })

  // Apply filters
  if (statusFilter) {
    query = query.eq('status', statusFilter)
  }

  if (searchQuery) {
    query = query.or(`order_number.ilike.%${searchQuery}%,shipping_name.ilike.%${searchQuery}%`)
  }

  // Pagination
  const from = (page - 1) * perPage
  const to = from + perPage - 1
  query = query.range(from, to)

  const { data: orders, count, error } = await query

  if (error) {
    console.error('Error fetching orders:', error)
    return { orders: [], totalCount: 0, page, perPage }
  }

  // Calculate totals for each order
  const ordersWithTotals =
    orders?.map((order) => {
      const total =
        order.items?.reduce((sum: number, item: { quantity: number | null; unit_price: number | string | null }) => {
          return sum + (item.quantity || 0) * Number(item.unit_price || 0)
        }, 0) || 0

      const itemCount =
        order.items?.reduce((sum: number, item: { quantity: number | null }) => sum + (item.quantity || 0), 0) || 0

      return {
        ...order,
        total,
        itemCount
      }
    }) || []

  return {
    orders: ordersWithTotals,
    totalCount: count || 0,
    page,
    perPage,
    statusFilter,
    searchQuery
  }
}
