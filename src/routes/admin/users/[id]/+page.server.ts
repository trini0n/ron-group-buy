import { createAdminClient } from '$lib/server/admin'
import { error } from '@sveltejs/kit'
import { logger } from '$lib/server/logger'

export const load = async ({ params }: { params: { id: string } }) => {
  const adminClient = createAdminClient()

  // Fetch user
  const { data: user, error: userError } = await adminClient.from('users').select('id, email, name, avatar_url, discord_username, discord_id, google_id, paypal_email, created_at, admin_notes, is_blocked, blocked_reason').eq('id', params.id).single()

  if (userError || !user) {
    throw error(404, 'User not found')
  }

  // Fetch auth identities from Supabase Auth
  let authMethods = {
    hasGoogle: false,
    hasDiscord: false,
    hasPassword: false
  }
  let authIdentities: Array<{ id: string; provider: string }> = []

  try {
    const { data: authData, error: authError } = await adminClient.auth.admin.getUserById(params.id)

    if (!authError && authData?.user?.identities) {
      const identities = authData.user.identities
      authMethods = {
        hasGoogle: identities.some((i: any) => i.provider === 'google'),
        hasDiscord: identities.some((i: any) => i.provider === 'discord'),
        hasPassword: identities.some((i: any) => i.provider === 'email')
      }
      authIdentities = identities.map((i: any) => ({
        id: i.id,
        provider: i.provider
      }))
    }
  } catch (err) {
    logger.error({ error: err }, 'Error fetching auth identities for admin user detail')
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
    .select('id, user_id, name, line1, line2, city, state, postal_code, country, phone_number, is_default')
    .eq('user_id', params.id)
    .order('is_default', { ascending: false })

  return {
    user,
    orders: ordersWithTotals,
    addresses: addresses || [],
    authMethods,
    authIdentities
  }
}

