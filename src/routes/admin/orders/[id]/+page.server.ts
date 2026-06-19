import { createAdminClient } from '$lib/server/admin'
import { error } from '@sveltejs/kit'
import { groupAndSortOrderItems } from '$lib/utils'

export const load = async ({ params }: { params: { id: string } }) => {
  const adminClient = createAdminClient()

  // Fetch order with user and items
  const { data: order, error: orderError } = await adminClient
    .from('orders')
    .select(
      `
      *,
      user:users(id, name, email, paypal_email, discord_username, discord_id, admin_notes),
      items:order_items(
        id,
        card_id,
        card_serial,
        card_name,
        card_type,
        quantity,
        unit_price,
        card:cards(
          set_code,
          collector_number,
          scryfall_id,
          ron_image_url,
          card_type,
          foil_type,
          is_retro,
          is_extended,
          is_showcase,
          is_borderless,
          is_etched
        )
      ),
      bundle_items:order_bundle_items(
        id,
        set_code,
        set_name,
        quantity,
        price_at_purchase
      )
    `
    )
    .eq('id', params.id)
    .single()

  if (orderError || !order) {
    throw error(404, 'Order not found')
  }

  // Fetch order status history
  const { data: statusHistory } = await adminClient
    .from('order_status_history')
    .select(
      `
      *,
      changed_by_user:users!order_status_history_changed_by_fkey(name, email)
    `
    )
    .eq('order_id', params.id)
    .order('created_at', { ascending: false })

  // Calculate order totals (cards + bundles)
  const cardSubtotal =
    order.items?.reduce((sum: number, item: { quantity: number | null; unit_price: number | string | null }) => {
      return sum + (item.quantity || 0) * Number(item.unit_price || 0)
    }, 0) || 0

  const bundleSubtotal =
    (order.bundle_items ?? []).reduce(
      (sum: number, b: { quantity: number | null; price_at_purchase: number | string | null }) =>
        sum + (b.quantity ?? 1) * Number(b.price_at_purchase || 0),
      0
    )

  const subtotal = cardSubtotal + bundleSubtotal

  const cardCount =
    order.items?.reduce((sum: number, item: { quantity: number | null }) => sum + (item.quantity || 0), 0) || 0

  const bundleCount =
    (order.bundle_items ?? []).reduce((sum: number, b: { quantity: number | null }) => sum + (b.quantity || 1), 0)

  const itemCount = cardCount + bundleCount

  // Fetch all group buys for selection dropdown
  const { data: groupBuys } = await adminClient
    .from('group_buy_config')
    .select('id, name, is_active')
    .order('created_at', { ascending: false })

  return {
    order: {
      ...order,
      items: groupAndSortOrderItems(order.items || []),
      subtotal,
      itemCount
    },
    statusHistory: statusHistory || [],
    groupBuys: groupBuys || []
  }
}
