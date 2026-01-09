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

  // Get admin status for users with discord_id
  const discordIds = users?.filter((u) => u.discord_id).map((u) => u.discord_id as string) || []
  const { data: admins } = await adminClient.from('admins').select('discord_id, role').in('discord_id', discordIds)

  const adminByDiscordId = new Map<string, string>()
  admins?.forEach((admin) => {
    if (admin.discord_id) {
      adminByDiscordId.set(admin.discord_id, admin.role ?? 'admin')
    }
  })

  const usersWithStats =
    users?.map((user) => ({
      ...user,
      orderCount: ordersPerUser.get(user.id) || 0,
      isAdmin: user.discord_id ? adminByDiscordId.has(user.discord_id) : false,
      adminRole: user.discord_id ? adminByDiscordId.get(user.discord_id) || null : null
    })) || []

  return {
    users: usersWithStats,
    totalCount: count || 0,
    page,
    perPage,
    searchQuery
  }
}
