import { json, error } from '@sveltejs/kit'
import type { RequestHandler } from './$types'
import { CartService } from '$lib/server/cart-service'
import { logger } from '$lib/server/logger'

export const POST: RequestHandler = async ({ locals }) => {
  if (!locals.user) {
    throw error(401, 'Authentication required')
  }

  const cartService = new CartService(locals.supabase)

  const cart = await cartService.getUserCart(locals.user.id)
  if (!cart || cart.items.length === 0) {
    throw error(400, 'Cart is empty')
  }

  const result = await cartService.createCheckoutSession(cart.id, locals.user.id)

  if ('error' in result) {
    logger.error({ error: result.error, userId: locals.user.id }, 'Failed to create checkout session')
    throw error(400, result.error)
  }

  return json(result)
}
