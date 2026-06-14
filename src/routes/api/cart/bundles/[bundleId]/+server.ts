// Bundle Cart Item API — PATCH update quantity, DELETE remove
import { json, error } from '@sveltejs/kit'
import type { RequestHandler } from './$types'
import { CartService } from '$lib/server/cart-service'
import { createAdminClient } from '$lib/server/admin'
import { logger } from '$lib/server/logger'
import { z } from 'zod'

const UpdateQuantitySchema = z.object({
  quantity: z.number().int().min(0).max(99)
})

async function resolveCart(locals: App.Locals, cookies: { get: (k: string) => string | undefined }, cartService: CartService) {
  if (locals.user) {
    return cartService.getUserCart(locals.user.id)
  }
  const guestId = cookies.get('guest_cart_id')
  if (guestId) {
    return cartService.getGuestCart(guestId)
  }
  return null
}

// PATCH /api/cart/bundles/[bundleId] — update quantity
export const PATCH: RequestHandler = async ({ request, locals, cookies, params }) => {
  const supabase = locals.user ? locals.supabase : createAdminClient()
  const cartService = new CartService(supabase)
  const bundleId = params.bundleId

  const parseResult = UpdateQuantitySchema.safeParse(await request.json())
  if (!parseResult.success) {
    return json({ error: 'Invalid request body' }, { status: 400 })
  }

  try {
    const cart = await resolveCart(locals, cookies, cartService)
    if (!cart) throw error(404, 'Cart not found')

    const result = await cartService.updateBundleQuantity(cart.id, bundleId, parseResult.data.quantity)
    if (!result.success) throw error(400, result.error || 'Failed to update bundle')

    return json({ success: true, bundles: result.bundles })
  } catch (err: any) {
    if (err.status) throw err
    logger.error({ error: err }, 'Error updating bundle quantity')
    throw error(500, 'Failed to update bundle quantity')
  }
}

// DELETE /api/cart/bundles/[bundleId] — remove bundle
export const DELETE: RequestHandler = async ({ locals, cookies, params }) => {
  const supabase = locals.user ? locals.supabase : createAdminClient()
  const cartService = new CartService(supabase)
  const bundleId = params.bundleId

  try {
    const cart = await resolveCart(locals, cookies, cartService)
    if (!cart) throw error(404, 'Cart not found')

    const result = await cartService.removeBundleItem(cart.id, bundleId)
    if (!result.success) throw error(400, result.error || 'Failed to remove bundle')

    return json({ success: true, bundles: result.bundles })
  } catch (err: any) {
    if (err.status) throw err
    logger.error({ error: err }, 'Error removing bundle from cart')
    throw error(500, 'Failed to remove bundle from cart')
  }
}
