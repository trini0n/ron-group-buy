import { createAdminClient } from '$lib/server/admin'
import { sortOrdersByShippingAndDate } from '$lib/utils'

export const load = async ({ url }) => {
  const adminClient = createAdminClient()

  // Parse filters from URL (no status filter - we show all statuses now)
  const searchQuery = url.searchParams.get('q')
  const groupBuyFilter = url.searchParams.get('groupBuy')
  const perPage = 25

  // Parse status-specific page parameters (e.g., pending_page=1, invoiced_page=2)
  const statusPages: Record<string, number> = {}
  for (const [key, value] of url.searchParams.entries()) {
    if (key.endsWith('_page')) {
      const status = key.replace('_page', '')
      statusPages[status] = parseInt(value) || 1
    }
  }

  // Fetch all group buys with order counts
  const { data: groupBuys } = await adminClient
    .from('group_buy_config')
    .select('id, name, is_active, created_at')
    .order('created_at', { ascending: false })

  // Get order counts per group buy
  const { data: orderCountsRaw } = await adminClient
    .from('orders')
    .select('group_buy_id')
  
  const orderCounts = new Map<string | null, number>()
  orderCountsRaw?.forEach(order => {
    const gbId = order.group_buy_id
    orderCounts.set(gbId, (orderCounts.get(gbId) || 0) + 1)
  })

  // Build group buys with counts
  const groupBuysWithCounts = groupBuys?.map(gb => ({
    ...gb,
    orderCount: orderCounts.get(gb.id) || 0
  })) || []

  // Add "Unassigned" category for orders without group_buy_id
  const unassignedCount = orderCounts.get(null) || 0

  // Total order count (unfiltered) for the "All Orders" display
  const allOrdersCount = orderCountsRaw?.length || 0

  // Build query - fetch all orders without status filter
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
    `
    )

  // Apply search filter
  if (searchQuery) {
    query = query.or(`order_number.ilike.%${searchQuery}%,shipping_name.ilike.%${searchQuery}%`)
  }

  // Filter by group buy
  if (groupBuyFilter === 'unassigned') {
    query = query.is('group_buy_id', null)
  } else if (groupBuyFilter) {
    query = query.eq('group_buy_id', groupBuyFilter)
  }

  // Fetch all matching orders
  const { data: allOrders, error } = await query

  if (error) {
    console.error('Error fetching orders:', error)
    // Still return groupBuys even if orders query fails
    return { 
      ordersByStatus: {},
      allOrdersCount,
      groupBuys: groupBuysWithCounts, 
      unassignedCount,
      searchQuery,
      groupBuyFilter
    }
  }

  // Shipping pricing constants (same as checkout)
  const SHIPPING_RATES = {
    us: { regular: 6.00, express: 40.00, tariff: 9.00 },
    international: { regular: 6.00, express: 25.00, tariff: 0 }
  }

  // Calculate totals for each order (including shipping and tariff)
  const ordersWithTotals =
    allOrders?.map((order) => {
      const subtotal =
        order.items?.reduce((sum: number, item: { quantity: number | null; unit_price: number | string | null }) => {
          return sum + (item.quantity || 0) * Number(item.unit_price || 0)
        }, 0) || 0

      const itemCount =
        order.items?.reduce((sum: number, item: { quantity: number | null }) => sum + (item.quantity || 0), 0) || 0

      // Calculate shipping and tariff
      const country = order.shipping_country?.toUpperCase() || ''
      const isUS = country === 'US' || country === 'USA' || country === 'UNITED STATES'
      const rates = isUS ? SHIPPING_RATES.us : SHIPPING_RATES.international
      const shippingCost = order.shipping_type === 'express' ? rates.express : rates.regular
      const tariffCost = rates.tariff

      // Grand total includes subtotal + shipping + tariff
      const total = subtotal + shippingCost + tariffCost

      return {
        ...order,
        subtotal,
        total,
        itemCount
      }
    }) || []

  // Sort all orders by shipping type (express first) then created_at
  const sortedOrders = sortOrdersByShippingAndDate(ordersWithTotals)

  // Group orders by status
  const ordersByStatus: Record<string, typeof sortedOrders> = {}
  for (const order of sortedOrders) {
    const status = order.status || 'pending'
    if (!ordersByStatus[status]) {
      ordersByStatus[status] = []
    }
    ordersByStatus[status].push(order)
  }

  // Sort within each status group by updated_at (ascending - earliest updates first, newest last)
  // This ensures newly updated orders appear at the end (on the last page)
  for (const status in ordersByStatus) {
    ordersByStatus[status].sort((a, b) => {
      const dateA = a.updated_at ? new Date(a.updated_at).getTime() : 0
      const dateB = b.updated_at ? new Date(b.updated_at).getTime() : 0
      return dateA - dateB
    })
  }

  // Apply per-status pagination
  const paginatedByStatus: Record<string, {
    orders: typeof sortedOrders
    totalCount: number
    currentPage: number
    totalPages: number
  }> = {}

  for (const [status, orders] of Object.entries(ordersByStatus)) {
    const requestedPage = statusPages[status] || 1
    const totalCount = orders.length
    const totalPages = Math.ceil(totalCount / perPage)
    
    // Clamp current page to valid range [1, totalPages]
    // If user was on page 2 but now there's only 1 page, show page 1
    const currentPage = Math.min(Math.max(requestedPage, 1), totalPages || 1)
    
    const from = (currentPage - 1) * perPage
    const to = from + perPage
    const paginatedOrders = orders.slice(from, to)

    paginatedByStatus[status] = {
      orders: paginatedOrders,
      totalCount,
      currentPage,
      totalPages
    }
  }

  return {
    ordersByStatus: paginatedByStatus,
    allOrdersCount,
    searchQuery,
    groupBuyFilter,
    groupBuys: groupBuysWithCounts,
    unassignedCount
  }
}
