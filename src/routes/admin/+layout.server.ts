import { redirect } from '@sveltejs/kit'
import { isAdminDiscordId, createAdminClient } from '$lib/server/admin'

export const load = async ({ locals, url }) => {
  const user = locals.user

  // Check if user is logged in
  if (!user) {
    throw redirect(303, `/auth/login?redirectTo=${encodeURIComponent(url.pathname)}`)
  }

  // Get user's Discord ID from the users table
  const adminClient = createAdminClient()
  const { data: userData } = await adminClient
    .from('users')
    .select('discord_id, name, email')
    .eq('id', user.id)
    .single()

  const discordId = userData?.discord_id

  // Check if user has admin access
  if (!isAdminDiscordId(discordId)) {
    throw redirect(303, '/?error=unauthorized')
  }

  // Fetch admin stats for the dashboard
  const [ordersResult, usersResult, cardsResult] = await Promise.all([
    adminClient.from('orders').select('id, status', { count: 'exact' }),
    adminClient.from('users').select('id', { count: 'exact' }),
    adminClient.from('cards').select('id, is_in_stock', { count: 'exact' })
  ])

  // Count orders by status
  const ordersByStatus = {
    pending: 0,
    invoiced: 0,
    paid: 0,
    processing: 0,
    shipped: 0,
    delivered: 0,
    cancelled: 0
  }

  ordersResult.data?.forEach((order) => {
    if (order.status && order.status in ordersByStatus) {
      ordersByStatus[order.status as keyof typeof ordersByStatus]++
    }
  })

  // Count out of stock cards
  const outOfStockCount = cardsResult.data?.filter((c) => !c.is_in_stock).length || 0

  return {
    admin: {
      discordId,
      name: userData?.name,
      email: userData?.email
    },
    stats: {
      totalOrders: ordersResult.count || 0,
      ordersByStatus,
      totalUsers: usersResult.count || 0,
      totalCards: cardsResult.count || 0,
      outOfStockCards: outOfStockCount
    }
  }
}
