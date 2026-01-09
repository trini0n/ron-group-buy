// Cart Validation API - Revalidate cart contents
import { json, error } from '@sveltejs/kit'
import type { RequestHandler } from './$types'
import { CartService } from '$lib/server/cart-service'
import { createAdminClient } from '$lib/server/admin'

// POST /api/cart/validate - Validate cart and get detailed changes report
export const POST: RequestHandler = async ({ locals, cookies }) => {
  // Use admin client for guests to bypass RLS (guest carts don't have user_id)
  const supabase = locals.user ? locals.supabase : createAdminClient()
  const cartService = new CartService(supabase)
  const guestId = cookies.get('guest_cart_id')

  try {
    let cart

    if (locals.user) {
      cart = await cartService.getUserCart(locals.user.id)
    } else if (guestId) {
      cart = await cartService.getGuestCart(guestId)
    }

    if (!cart) {
      return json({
        valid: true,
        cart_exists: false,
        validation: null
      })
    }

    const validation = await cartService.validateCart(cart.id)

    // Calculate totals
    let subtotal = 0
    for (const item of validation.valid_items) {
      subtotal += item.current_price * item.quantity
    }

    return json({
      valid: validation.invalid_items.length === 0,
      cart_exists: true,
      cart: {
        id: cart.id,
        version: cart.version
      },
      validation,
      totals: {
        subtotal,
        item_count: validation.valid_items.reduce((sum, i) => sum + i.quantity, 0)
      },
      // Explicit change flags for UX
      has_invalid_items: validation.invalid_items.length > 0,
      has_price_changes: validation.price_changes.length > 0,
      has_quantity_adjustments: validation.quantity_adjustments.length > 0
    })
  } catch (err) {
    console.error('Error validating cart:', err)
    throw error(500, 'Failed to validate cart')
  }
}
