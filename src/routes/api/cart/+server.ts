// Cart API - GET, POST operations
import { json, error } from '@sveltejs/kit'
import type { RequestHandler } from './$types'
import { CartService } from '$lib/server/cart-service'

// GET /api/cart - Get current cart with validation
export const GET: RequestHandler = async ({ locals, cookies }) => {
  const cartService = new CartService(locals.supabase)
  const guestId = cookies.get('guest_cart_id')

  try {
    let cart

    if (locals.user) {
      // Authenticated user
      cart = await cartService.getUserCart(locals.user.id)
    } else if (guestId) {
      // Guest with existing cart
      cart = await cartService.getGuestCart(guestId)
    }

    if (!cart) {
      return json({
        cart: null,
        items: [],
        version: 0,
        validation: null
      })
    }

    // Validate cart and return any issues
    const validation = await cartService.validateCart(cart.id)

    return json({
      cart: {
        id: cart.id,
        version: cart.version,
        user_id: cart.user_id,
        guest_id: cart.guest_id
      },
      items: cart.items.map((item) => ({
        id: item.id,
        card: item.card,
        quantity: item.quantity,
        price_at_add: item.price_at_add,
        added_at: item.added_at
      })),
      version: cart.version,
      validation
    })
  } catch (err) {
    console.error('Error fetching cart:', err)
    throw error(500, 'Failed to fetch cart')
  }
}

// POST /api/cart - Add item to cart
export const POST: RequestHandler = async ({ request, locals, cookies }) => {
  const cartService = new CartService(locals.supabase)

  const body = await request.json()
  const { card_id, quantity = 1, expected_version } = body

  if (!card_id) {
    throw error(400, 'card_id is required')
  }

  if (quantity < 1 || quantity > 99) {
    throw error(400, 'quantity must be between 1 and 99')
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

    const result = await cartService.addItem(cart.id, card_id, quantity, expected_version)

    if (!result.success) {
      if (result.error?.includes('Version mismatch')) {
        throw error(409, result.error)
      }
      throw error(400, result.error || 'Failed to add item')
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
    console.error('Error adding to cart:', err)
    throw error(500, 'Failed to add item to cart')
  }
}

// DELETE /api/cart - Clear entire cart
export const DELETE: RequestHandler = async ({ locals, cookies }) => {
  const cartService = new CartService(locals.supabase)
  const guestId = cookies.get('guest_cart_id')

  try {
    let cart

    if (locals.user) {
      cart = await cartService.getUserCart(locals.user.id)
    } else if (guestId) {
      cart = await cartService.getGuestCart(guestId)
    }

    if (!cart) {
      return json({ success: true })
    }

    await cartService.clearCart(cart.id)

    return json({ success: true })
  } catch (err) {
    console.error('Error clearing cart:', err)
    throw error(500, 'Failed to clear cart')
  }
}
