import { createAdminClient } from '$lib/server/admin'

export const load = async ({ url }) => {
  const adminClient = createAdminClient()

  // Parse filters from URL
  const searchQuery = url.searchParams.get('q')
  const page = parseInt(url.searchParams.get('page') || '1')
  const perPage = 25

  // Build query
  let query = adminClient.from('users').select('*', { count: 'exact' }).order('created_at', { ascending: false })

  // Apply search filter
  if (searchQuery) {
    query = query.or(`name.ilike.%${searchQuery}%,email.ilike.%${searchQuery}%,discord_username.ilike.%${searchQuery}%`)
  }

  // Pagination
  const from = (page - 1) * perPage
  const to = from + perPage - 1
  query = query.range(from, to)

  const { data: users, count, error } = await query

  if (error) {
    console.error('Error fetching users:', error)
    return { users: [], totalCount: 0, page, perPage }
  }

  // Get order counts for each user
  const userIds = users?.map((u) => u.id) || []
  const { data: orderCounts } = await adminClient.from('orders').select('user_id').in('user_id', userIds)

  // Count orders per user
  const ordersPerUser = new Map<string, number>()
  orderCounts?.forEach((order) => {
    const count = ordersPerUser.get(order.user_id) || 0
    ordersPerUser.set(order.user_id, count + 1)
  })

  const usersWithStats =
    users?.map((user) => ({
      ...user,
      orderCount: ordersPerUser.get(user.id) || 0
    })) || []

  return {
    users: usersWithStats,
    totalCount: count || 0,
    page,
    perPage,
    searchQuery
  }
}
