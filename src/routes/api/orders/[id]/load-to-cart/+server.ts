import { json, error } from '@sveltejs/kit'
import type { RequestHandler } from './$types'
import { CartService } from '$lib/server/cart-service'

/**
 * Merge a submitted order back into the user's cart using identity-based matching.
 * This preserves the order as a snapshot and uses card identity to find current cards.
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
    .select('id, user_id, status')
    .eq('id', orderId)
    .single()

  if (orderError || !order) {
    throw error(404, 'Order not found')
  }

  // Verify ownership
  if (order.user_id !== locals.user.id) {
    throw error(403, 'Not authorized to load this order')
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

  // Use CartService to merge order into cart with identity-based matching
  const cartService = new CartService(locals.supabase)

  try {
    const mergeReport = await cartService.mergeOrderIntoCart(orderId, cart.id)

    // Build user-friendly response message
    const messages: string[] = []

    if (mergeReport.items_added.length > 0) {
      messages.push(`Added ${mergeReport.items_added.length} new item(s) to cart`)
    }

    if (mergeReport.items_combined.length > 0) {
      messages.push(`Combined ${mergeReport.items_combined.length} item(s) with existing cart items`)
    }

    if (mergeReport.items_removed.length > 0) {
      const removedNames = mergeReport.items_removed.slice(0, 3).map(i => i.card_name)
      const more = mergeReport.items_removed.length > 3 ? ` and ${mergeReport.items_removed.length - 3} more` : ''
      messages.push(`⚠️  ${removedNames.join(', ')}${more} no longer available`)
    }

    return json({
      success: true,
      message: messages.join('. ') || 'Order merged successfully',
      report: mergeReport
    })
  } catch (err) {
    console.error('Error merging order into cart:', err)
    throw error(500, err instanceof Error ? err.message : 'Failed to merge order into cart')
  }
}
