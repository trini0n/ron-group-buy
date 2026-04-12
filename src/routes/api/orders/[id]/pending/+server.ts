import { json, error } from '@sveltejs/kit'
import type { RequestHandler } from './$types'
import { logger } from '$lib/server/logger'
import { z } from 'zod'
import { CartService } from '$lib/server/cart-service'
import { createAdminClient } from '$lib/server/admin'
import type { Json } from '$lib/server/database.types'

const PendingOrderActionSchema = z.object({
  action: z.enum(['merge', 'cancel']),
  expectedVersion: z.number().int().nonnegative().optional()
})

/**
 * Handle pending order actions: merge into cart or cancel
 */
export const POST: RequestHandler = async ({ params, request, locals }) => {
  if (!locals.user) {
    throw error(401, 'Authentication required')
  }

  const orderId = params.id
  const parseResult = PendingOrderActionSchema.safeParse(await request.json())
  if (!parseResult.success) {
    return json({ error: 'Invalid request body', issues: parseResult.error.issues }, { status: 400 })
  }
  const { action, expectedVersion } = parseResult.data

  // Fetch the order and verify ownership
  const { data: order, error: orderError } = await locals.supabase
    .from('orders')
    .select(
      `
      id,
      user_id,
      status,
      order_items (
        card_id,
        quantity
      )
    `
    )
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
    // 1. Get or create the user's cart (must include version for optimistic lock check)
    let { data: cart } = await locals.supabase
      .from('carts')
      .select('id, version')
      .eq('user_id', locals.user.id)
      .single()

    if (!cart) {
      const { data: newCart, error: cartError } = await locals.supabase
        .from('carts')
        .insert({ user_id: locals.user.id })
        .select('id, version')
        .single()

      if (cartError || !newCart) {
        throw error(500, 'Failed to create cart')
      }
      cart = newCart
    }

    // 2. Optimistic concurrency check — client sends current version to detect concurrent modifications
    if (expectedVersion !== undefined && cart.version !== expectedVersion) {
      return json({ error: 'Cart was modified. Please refresh and try again.' }, { status: 409 })
    }

    // 3. Atomic idempotency claim — transition order status from 'pending' → 'processing'
    //    Only the first concurrent request sees claimData.length === 1 and proceeds.
    //    'processing' is a valid value in the order_status ENUM (initial_schema.sql).
    const { data: claimData } = await locals.supabase
      .from('orders')
      .update({ status: 'processing' })
      .eq('id', orderId)
      .eq('status', 'pending')
      .select('id')

    if (!claimData || claimData.length === 0) {
      // Another concurrent request already claimed this order — respond gracefully
      return json({
        success: true,
        action: 'merge',
        message: 'Order already being processed'
      })
    }

    // 4. Delegate to CartService — identity-based matching, stock validation, price snapshots
    const cartService = new CartService(locals.supabase)
    const mergeReport = await cartService.mergeOrderIntoCart(orderId, cart.id)

    // 5. Proactively invalidate any active checkout sessions for this cart
    await locals.supabase
      .from('checkout_sessions')
      .update({ status: 'invalidated' })
      .eq('cart_id', cart.id)
      .eq('status', 'active')

    // 6. Record to cart_merge_history for audit trail
    //    Must use adminClient — cart_merge_history has no INSERT RLS policy (SELECT only).
    const adminClient = createAdminClient()
    await adminClient.from('cart_merge_history').insert({
      target_cart_id: cart.id,
      source_cart_id: null,
      source_guest_id: null,
      user_id: locals.user.id,
      items_added: mergeReport.items_added.length,
      items_combined: mergeReport.items_combined.length,
      items_removed: mergeReport.items_removed.length,
      qty_adjusted: mergeReport.qty_adjusted.length,
      merge_details: {
        items_added: mergeReport.items_added,
        items_combined: mergeReport.items_combined,
        items_removed: mergeReport.items_removed,
        qty_adjusted: mergeReport.qty_adjusted
      } as unknown as Json
    })

    // 7. Fetch updated cart state to include in response (eliminates client syncFromServer round-trip)
    //    Must happen AFTER mergeOrderIntoCart writes so the trigger-bumped version is reflected.
    const updatedCart = await cartService.getCartWithItems(cart.id)

    // Delete order items then the order
    const { error: deleteMergeItemsError } = await locals.supabase.from('order_items').delete().eq('order_id', order.id)
    if (deleteMergeItemsError) {
      logger.error({ error: deleteMergeItemsError, orderId }, 'Failed to delete order items')
      throw error(500, 'Failed to delete order items')
    }
    const { error: deleteMergeOrderError } = await locals.supabase.from('orders').delete().eq('id', order.id)
    if (deleteMergeOrderError) {
      logger.error({ error: deleteMergeOrderError, orderId }, 'Failed to delete order')
      throw error(500, 'Failed to delete order')
    }

    return json({
      success: true,
      action: 'merge' as const,
      message: 'Order items merged into your cart',
      report: mergeReport,
      cart: { id: updatedCart.id, version: updatedCart.version },
      items: updatedCart.items
    })
  }

  // Cancel path: delete order items then order, return simple message
  const { error: deleteItemsError } = await locals.supabase.from('order_items').delete().eq('order_id', order.id)
  if (deleteItemsError) {
    logger.error({ error: deleteItemsError, orderId }, 'Failed to delete order items')
    throw error(500, 'Failed to delete order items')
  }
  const { error: deleteOrderError } = await locals.supabase.from('orders').delete().eq('id', order.id)
  if (deleteOrderError) {
    logger.error({ error: deleteOrderError, orderId }, 'Failed to delete order')
    throw error(500, 'Failed to delete order')
  }

  return json({
    success: true,
    action: 'cancel',
    message: 'Pending order cancelled'
  })
}
