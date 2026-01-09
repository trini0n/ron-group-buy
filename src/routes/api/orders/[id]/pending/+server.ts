import { json, error } from '@sveltejs/kit'
import type { RequestHandler } from './$types'

/**
 * Handle pending order actions: merge into cart or cancel
 */
export const POST: RequestHandler = async ({ params, request, locals }) => {
  if (!locals.user) {
    throw error(401, 'Authentication required')
  }

  const orderId = params.id
  const body = await request.json()
  const { action } = body

  if (!action || !['merge', 'cancel'].includes(action)) {
    throw error(400, 'Invalid action. Must be "merge" or "cancel"')
  }

  // Fetch the order and verify ownership
  const { data: order, error: orderError } = await locals.supabase
    .from('orders')
    .select(`
      id,
      user_id,
      status,
      order_items (
        card_id,
        quantity
      )
    `)
    .eq('id', orderId)
    .single()

  if (orderError || !order) {
    throw error(404, 'Order not found')
  }

  if (order.user_id !== locals.user.id) {
    throw error(403, 'Not authorized')
  }

  if (order.status !== 'pending') {
    throw error(400, 'Only pending orders can be modified')
  }

  if (action === 'merge') {
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

    // Get existing cart items
    const { data: existingCartItems } = await locals.supabase
      .from('cart_items')
      .select('card_id, quantity')
      .eq('cart_id', cart.id)

    const existingCartMap = new Map(
      existingCartItems?.map(item => [item.card_id, item.quantity]) ?? []
    )

    // Merge order items into cart
    for (const item of order.order_items || []) {
      if (!item.card_id) continue

      const existingQty = existingCartMap.get(item.card_id) ?? 0
      const newQty = existingQty + (item.quantity ?? 1)

      if (existingQty > 0) {
        // Update existing cart item
        await locals.supabase
          .from('cart_items')
          .update({ quantity: newQty })
          .eq('cart_id', cart.id)
          .eq('card_id', item.card_id)
      } else {
        // Insert new cart item
        await locals.supabase
          .from('cart_items')
          .insert({
            cart_id: cart.id,
            card_id: item.card_id,
            quantity: item.quantity ?? 1
          })
      }
    }
  }

  // Delete the pending order (both for merge and cancel)
  // First delete order items
  const { error: deleteItemsError } = await locals.supabase
    .from('order_items')
    .delete()
    .eq('order_id', order.id)

  if (deleteItemsError) {
    console.error('Failed to delete order items:', deleteItemsError)
    throw error(500, 'Failed to delete order items')
  }

  // Then delete the order
  const { error: deleteOrderError } = await locals.supabase
    .from('orders')
    .delete()
    .eq('id', order.id)

  if (deleteOrderError) {
    console.error('Failed to delete order:', deleteOrderError)
    throw error(500, 'Failed to delete order')
  }

  return json({
    success: true,
    action,
    message: action === 'merge' 
      ? 'Order items merged into your cart' 
      : 'Pending order cancelled'
  })
}
