// Bulk Cart API - POST multiple items at once
import { json, error } from '@sveltejs/kit'
import type { RequestHandler } from '@sveltejs/kit'
import { CartService } from '$lib/server/cart-service'
import { createAdminClient } from '$lib/server/admin'

// POST /api/cart/bulk - Add multiple items to cart at once
export const POST: RequestHandler = async ({ request, locals, cookies }) => {
  // Use admin client for guests to bypass RLS (guest carts don't have user_id)
  const supabase = locals.user ? locals.supabase : createAdminClient()
  const cartService = new CartService(supabase)

  const body = await request.json()
  const { items, expected_version } = body

  if (!items || !Array.isArray(items) || items.length === 0) {
    throw error(400, 'items array is required and must not be empty')
  }

  // Validate each item
  for (const item of items) {
    if (!item.card_id) {
      throw error(400, 'Each item must have a card_id')
    }
    if (!item.quantity || item.quantity < 1 || item.quantity > 99) {
      throw error(400, 'Each item quantity must be between 1 and 99')
    }
  }

  try {
    let cart

    if (locals.user) {
      // Authenticated user
      cart = await cartService.getOrCreateCart(locals.user.id)
    } else {
      // Guest - get or create guest ID
      let guestId = cookies.get('guest_cart_id')

      if (!guestId) {
        guestId = crypto.randomUUID()
        cookies.set('guest_cart_id', guestId, {
          path: '/',
          httpOnly: true,
          secure: true,
          sameSite: 'lax',
          maxAge: 60 * 60 * 24 * 90 // 90 days
        })
      }

      cart = await cartService.getOrCreateCart(undefined, guestId)
    }

    const result = await cartService.addItems(cart.id, items, expected_version)

    if (!result.success) {
      if (result.error?.includes('Version mismatch')) {
        throw error(409, result.error)
      }
      throw error(400, result.error || 'Failed to add items')
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
        })) || [],
      added: items.length
    })
  } catch (err: any) {
    if (err.status) throw err
    console.error('Error adding bulk items to cart:', err)
    throw error(500, 'Failed to add items to cart')
  }
}
