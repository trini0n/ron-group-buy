// Cart Merge API - Handle merging guest cart on login
import { json, error } from '@sveltejs/kit'
import type { RequestHandler } from './$types'
import { CartService } from '$lib/server/cart-service'
import { createAdminClient } from '$lib/server/admin'

// GET /api/cart/merge - Check if merge is needed
export const GET: RequestHandler = async ({ locals, cookies }) => {
  if (!locals.user) {
    throw error(401, 'Authentication required')
  }

  // Use admin client to access guest cart data (bypass RLS)
  const cartService = new CartService(createAdminClient())
  const guestId = cookies.get('guest_cart_id')

  if (!guestId) {
    return json({
      merge_needed: false,
      requires_confirmation: false
    })
  }

  try {
    const guestCart = await cartService.getGuestCart(guestId)

    if (!guestCart || guestCart.items.length === 0) {
      return json({
        merge_needed: false,
        requires_confirmation: false
      })
    }

    const userCart = await cartService.getUserCart(locals.user.id)
    const requiresConfirmation = await cartService.shouldPromptMerge(guestId, locals.user.id)

    // Preview what would be merged
    const preview = await cartService.mergeGuestCart(guestId, locals.user.id, { dry_run: true })

    return json({
      merge_needed: true,
      requires_confirmation: requiresConfirmation,
      user_has_cart: !!userCart && userCart.items.length > 0,
      guest_cart_items: guestCart.items.length,
      preview: {
        items_to_add: preview.items_added.length,
        items_to_combine: preview.items_combined.length,
        items_to_remove: preview.items_removed.length,
        details: preview
      }
    })
  } catch (err) {
    console.error('Error checking merge status:', err)
    throw error(500, 'Failed to check merge status')
  }
}

// POST /api/cart/merge - Execute merge
export const POST: RequestHandler = async ({ request, locals, cookies }) => {
  if (!locals.user) {
    throw error(401, 'Authentication required')
  }

  // Use admin client to access guest cart data (bypass RLS)
  const cartService = new CartService(createAdminClient())
  const guestId = cookies.get('guest_cart_id')

  if (!guestId) {
    return json({
      success: true,
      merged: false,
      message: 'No guest cart to merge'
    })
  }

  const body = await request.json().catch(() => ({}))
  const { confirm = false, skip = false } = body

  try {
    const guestCart = await cartService.getGuestCart(guestId)

    if (!guestCart || guestCart.items.length === 0) {
      // Clear the guest cookie
      cookies.delete('guest_cart_id', { path: '/' })

      return json({
        success: true,
        merged: false,
        message: 'No guest cart items to merge'
      })
    }

    // Check if user already has a cart
    const userCart = await cartService.getUserCart(locals.user.id)
    const requiresConfirmation = await cartService.shouldPromptMerge(guestId, locals.user.id)

    if (skip) {
      // User chose to skip merge - clear guest cart
      await cartService.clearCart(guestCart.id)
      cookies.delete('guest_cart_id', { path: '/' })

      return json({
        success: true,
        merged: false,
        message: 'Guest cart discarded'
      })
    }

    // If confirmation required and not provided, reject
    if (requiresConfirmation && !confirm) {
      return json({
        success: false,
        merged: false,
        requires_confirmation: true,
        message: 'User confirmation required to merge stale cart'
      })
    }

    // If user has no cart, just claim the guest cart
    if (!userCart) {
      await cartService.claimGuestCart(guestId, locals.user.id)
      cookies.delete('guest_cart_id', { path: '/' })

      return json({
        success: true,
        merged: true,
        claimed: true,
        message: 'Guest cart claimed as user cart',
        report: {
          items_added: guestCart.items.map((i) => ({
            card_name: i.card?.card_name || 'Unknown',
            quantity: i.quantity
          })),
          items_combined: [],
          items_removed: [],
          qty_adjusted: []
        }
      })
    }

    // Perform merge
    const report = await cartService.mergeGuestCart(guestId, locals.user.id)

    // Clear guest cookie
    cookies.delete('guest_cart_id', { path: '/' })

    return json({
      success: true,
      merged: true,
      report,
      message: 'Cart merged successfully'
    })
  } catch (err) {
    console.error('Error merging cart:', err)
    throw error(500, 'Failed to merge cart')
  }
}
