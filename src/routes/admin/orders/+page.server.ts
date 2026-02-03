import { createAdminClient } from '$lib/server/admin'
import { sortOrdersByShippingAndDate } from '$lib/utils'

export const load = async ({ url }) => {
  const adminClient = createAdminClient()

  // Parse filters from URL
  const statusFilter = url.searchParams.get('status')
  const searchQuery = url.searchParams.get('q')
  const groupBuyFilter = url.searchParams.get('groupBuy')
  const page = parseInt(url.searchParams.get('page') || '1')
  const perPage = 25

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

  // Build query - remove .order() call, we'll sort in JavaScript
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

  // Apply filters
  if (statusFilter) {
    query = query.eq('status', statusFilter as 'pending' | 'invoiced' | 'paid' | 'processing' | 'shipped' | 'delivered' | 'cancelled')
  }

  if (searchQuery) {
    query = query.or(`order_number.ilike.%${searchQuery}%,shipping_name.ilike.%${searchQuery}%`)
  }

  // Filter by group buy
  if (groupBuyFilter === 'unassigned') {
    query = query.is('group_buy_id', null)
  } else if (groupBuyFilter) {
    query = query.eq('group_buy_id', groupBuyFilter)
  }

  // Fetch all matching orders without pagination (we'll sort and paginate in JavaScript)
  const { data: allOrders, count, error } = await query

  if (error) {
    console.error('Error fetching orders:', error)
    // Still return groupBuys even if orders query fails
    return { 
      orders: [], 
      totalCount: 0, 
      allOrdersCount,
      page, 
      perPage, 
      groupBuys: groupBuysWithCounts, 
      unassignedCount,
      statusFilter,
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

  // Sort orders by shipping type (express first) then created_at
  const sortedOrders = sortOrdersByShippingAndDate(ordersWithTotals)
  
  // Apply pagination
  const from = (page - 1) * perPage
  const to = from + perPage
  const paginatedOrders = sortedOrders.slice(from, to)

  return {
    orders: paginatedOrders,
    totalCount: count || 0,
    allOrdersCount,
    page,
    perPage,
    statusFilter,
    searchQuery,
    groupBuyFilter,
    groupBuys: groupBuysWithCounts,
    unassignedCount
  }
}
