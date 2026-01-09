// Cart Item API - PATCH, DELETE operations for individual items
import { json, error } from '@sveltejs/kit'
import type { RequestHandler } from './$types'
import { CartService } from '$lib/server/cart-service'
import { createAdminClient } from '$lib/server/admin'

// PATCH /api/cart/[itemId] - Update item quantity
export const PATCH: RequestHandler = async ({ params, request, locals, cookies }) => {
  // Use admin client for guests to bypass RLS (guest carts don't have user_id)
  const supabase = locals.user ? locals.supabase : createAdminClient()
  const cartService = new CartService(supabase)
  const { itemId } = params
  const guestId = cookies.get('guest_cart_id')

  const body = await request.json()
  const { quantity, expected_version } = body

  if (typeof quantity !== 'number' || quantity < 0 || quantity > 99) {
    throw error(400, 'quantity must be between 0 and 99')
  }

  try {
    let cart

    if (locals.user) {
      cart = await cartService.getUserCart(locals.user.id)
    } else if (guestId) {
      cart = await cartService.getGuestCart(guestId)
    }

    if (!cart) {
      throw error(404, 'Cart not found')
    }

    const result = await cartService.updateItemQuantity(cart.id, itemId, quantity, expected_version)

    if (!result.success) {
      if (result.error?.includes('Version mismatch')) {
        throw error(409, result.error)
      }
      throw error(400, result.error || 'Failed to update item')
    }

    return json({
      success: true,
      cart: {
        id: result.cart.id,
        version: result.cart.version
      },
      items:
        result.cart.items?.map((item) => ({
          id: item.id,
          card: item.card,
          quantity: item.quantity
        })) || []
    })
  } catch (err: any) {
    if (err.status) throw err
    console.error('Error updating cart item:', err)
    throw error(500, 'Failed to update item')
  }
}

// DELETE /api/cart/[itemId] - Remove item from cart
export const DELETE: RequestHandler = async ({ params, locals, cookies }) => {
  // Use admin client for guests to bypass RLS (guest carts don't have user_id)
  const supabase = locals.user ? locals.supabase : createAdminClient()
  const cartService = new CartService(supabase)
  const { itemId } = params
  const guestId = cookies.get('guest_cart_id')

  try {
    let cart

    if (locals.user) {
      cart = await cartService.getUserCart(locals.user.id)
    } else if (guestId) {
      cart = await cartService.getGuestCart(guestId)
    }

    if (!cart) {
      throw error(404, 'Cart not found')
    }

    const result = await cartService.removeItem(cart.id, itemId)

    if (!result.success) {
      throw error(400, result.error || 'Failed to remove item')
    }

    return json({
      success: true,
      cart: {
        id: result.cart.id,
        version: result.cart.version
      },
      items:
        result.cart.items?.map((item) => ({
          id: item.id,
          card: item.card,
          quantity: item.quantity
        })) || []
    })
  } catch (err: any) {
    if (err.status) throw err
    console.error('Error removing cart item:', err)
    throw error(500, 'Failed to remove item')
  }
}
