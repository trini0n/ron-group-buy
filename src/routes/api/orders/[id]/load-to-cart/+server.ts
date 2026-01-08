import { json, error } from '@sveltejs/kit'
import type { RequestHandler } from './$types'

/**
 * Load a pending order's items back into the user's cart for editing.
 * This clears the current cart and replaces it with the order's items.
 */
export const POST: RequestHandler = async ({ params, locals }) => {
  // Require authentication
  if (!locals.user) {
    throw error(401, 'Authentication required')
  }

  const orderId = params.id

  // Fetch the order and verify ownership
  const { data: order, error: orderError } = await locals.supabase
    .from('orders')
    .select(`
      id,
      user_id,
      status,
      group_buy_id,
      order_items (
        card_id,
        card_serial,
        card_name,
        card_type,
        quantity,
        unit_price
      )
    `)
    .eq('id', orderId)
    .single()

  if (orderError || !order) {
    throw error(404, 'Order not found')
  }

  // Verify ownership
  if (order.user_id !== locals.user.id) {
    throw error(403, 'Not authorized to edit this order')
  }

  // Verify order is still pending
  if (order.status !== 'pending') {
    throw error(400, 'Only pending orders can be edited')
  }

  // Verify the group buy is still active
  if (order.group_buy_id) {
    const { data: groupBuy } = await locals.supabase
      .from('group_buy_config')
      .select('is_active')
      .eq('id', order.group_buy_id)
      .single()

    if (!groupBuy?.is_active) {
      throw error(400, 'The group buy for this order is no longer active')
    }
  }

  // Get or create the user's cart
  let { data: cart } = await locals.supabase
    .from('carts')
    .select('id')
    .eq('user_id', locals.user.id)
    .single()

  if (!cart) {
    const { data: newCart, error: cartError } = await locals.supabase
      .from('carts')
      .insert({ user_id: locals.user.id })
      .select('id')
      .single()

    if (cartError || !newCart) {
      throw error(500, 'Failed to create cart')
    }
    cart = newCart
  }

  // Clear current cart items
  await locals.supabase
    .from('cart_items')
    .delete()
    .eq('cart_id', cart.id)

  // Copy order items to cart
  const cartItems = order.order_items.map((item: {
    card_id: string
    quantity: number
  }) => ({
    cart_id: cart.id,
    card_id: item.card_id,
    quantity: item.quantity
  }))

  if (cartItems.length > 0) {
    const { error: insertError } = await locals.supabase
      .from('cart_items')
      .insert(cartItems)

    if (insertError) {
      console.error('Error copying items to cart:', insertError)
      throw error(500, 'Failed to load order items to cart')
    }
  }

  // Delete the pending order since we're loading it for editing
  // The user will create a new order when they checkout
  await locals.supabase
    .from('order_items')
    .delete()
    .eq('order_id', order.id)

  await locals.supabase
    .from('orders')
    .delete()
    .eq('id', order.id)

  return json({
    success: true,
    itemsLoaded: cartItems.length,
    message: 'Order loaded to cart for editing. Your original order has been removed.'
  })
}
