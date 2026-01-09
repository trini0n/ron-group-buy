import { redirect } from '@sveltejs/kit'
import type { PageServerLoad } from './$types'

export const load: PageServerLoad = async ({ locals }) => {
  // Require authentication for checkout
  if (!locals.user) {
    throw redirect(303, '/auth/login?next=/checkout')
  }

  // Check if email is verified
  const isEmailVerified =
    locals.user.email_confirmed_at != null ||
    // OAuth providers are considered verified
    locals.user.app_metadata?.provider !== 'email'

  // Get user's saved addresses
  const { data: addresses } = await locals.supabase
    .from('addresses')
    .select('*')
    .eq('user_id', locals.user.id)
    .order('is_default', { ascending: false })

  // Check if group buy is open
  const { data: groupBuyConfig } = await locals.supabase
    .from('group_buy_config')
    .select('*')
    .eq('is_active', true)
    .single()

  // Check for existing pending order in this group buy
  let existingPendingOrder = null
  if (groupBuyConfig) {
    const { data: pendingOrder } = await locals.supabase
      .from('orders')
      .select(`
        id,
        order_number,
        order_items (
          id,
          quantity,
          unit_price
        )
      `)
      .eq('user_id', locals.user.id)
      .eq('group_buy_id', groupBuyConfig.id)
      .eq('status', 'pending')
      .single()

    if (pendingOrder) {
      const itemCount = pendingOrder.order_items?.reduce(
        (sum: number, item: { quantity: number | null }) => sum + (item.quantity ?? 1), 0
      ) ?? 0
      const total = pendingOrder.order_items?.reduce(
        (sum: number, item: { quantity: number | null; unit_price: number | string }) => 
          sum + (item.quantity ?? 1) * Number(item.unit_price), 0
      ) ?? 0

      existingPendingOrder = {
        id: pendingOrder.id,
        orderNumber: pendingOrder.order_number,
        itemCount,
        total
      }
    }
  }

  return {
    addresses: addresses || [],
    groupBuyConfig,
    isEmailVerified,
    userEmail: locals.user.email,
    existingPendingOrder
  }
}
