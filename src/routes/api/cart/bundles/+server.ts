// Bundle Cart API — GET list, POST add
import { json, error } from '@sveltejs/kit'
import type { RequestHandler } from './$types'
import { CartService } from '$lib/server/cart-service'
import { createAdminClient } from '$lib/server/admin'
import { logger } from '$lib/server/logger'
import { z } from 'zod'

const AddBundleSchema = z.object({
  set_code: z.string().min(1),
  quantity: z.number().int().min(1).max(99).default(1)
})

// GET /api/cart/bundles — list bundles for current cart
export const GET: RequestHandler = async ({ locals, cookies }) => {
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

    if (!cart) return json({ bundles: [] })
    return json({ bundles: cart.bundles })
  } catch (err) {
    logger.error({ error: err }, 'Error fetching cart bundles')
    throw error(500, 'Failed to fetch cart bundles')
  }
}

// POST /api/cart/bundles — add a set bundle to cart
export const POST: RequestHandler = async ({ request, locals, cookies }) => {
  const supabase = locals.user ? locals.supabase : createAdminClient()
  const cartService = new CartService(supabase)

  const parseResult = AddBundleSchema.safeParse(await request.json())
  if (!parseResult.success) {
    return json({ error: 'Invalid request body', issues: parseResult.error.issues }, { status: 400 })
  }
  const { set_code, quantity } = parseResult.data

  try {
    let cart
    if (locals.user) {
      cart = await cartService.getOrCreateCart(locals.user.id)
    } else {
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

    const result = await cartService.addBundle(cart.id, set_code, quantity)

    if (!result.success) {
      throw error(400, result.error || 'Failed to add bundle')
    }

    return json({ success: true, bundles: result.bundles })
  } catch (err: any) {
    if (err.status) throw err
    logger.error({ error: err }, 'Error adding bundle to cart')
    throw error(500, 'Failed to add bundle to cart')
  }
}
