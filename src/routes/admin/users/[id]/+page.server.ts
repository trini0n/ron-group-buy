import { createAdminClient } from '$lib/server/admin'
import { error } from '@sveltejs/kit'

export const load = async ({ params }) => {
  const adminClient = createAdminClient()

  // Fetch user
  const { data: user, error: userError } = await adminClient.from('users').select('*').eq('id', params.id).single()

  if (userError || !user) {
    throw error(404, 'User not found')
  }

  // Fetch user's orders
  const { data: orders } = await adminClient
    .from('orders')
    .select(
      `
      id,
      order_number,
      status,
      created_at,
      items:order_items(quantity, unit_price)
    `
    )
    .eq('user_id', params.id)
    .order('created_at', { ascending: false })
    .limit(10)

  // Calculate order totals
  const ordersWithTotals =
    orders?.map((order) => {
      const total =
        order.items?.reduce((sum: number, item: { quantity: number | null; unit_price: number | string | null }) => {
          return sum + (item.quantity || 0) * Number(item.unit_price || 0)
        }, 0) || 0
      return { ...order, total }
    }) || []

  // Fetch user's addresses
  const { data: addresses } = await adminClient
    .from('addresses')
    .select('*')
    .eq('user_id', params.id)
    .order('is_default', { ascending: false })

  return {
    user,
    orders: ordersWithTotals,
    addresses: addresses || []
  }
}
