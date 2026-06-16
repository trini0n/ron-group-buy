import type { RequestHandler } from './$types'
import { json, error } from '@sveltejs/kit'
import { createAdminClient, requireAdmin } from '$lib/server/admin'
import { logger } from '$lib/server/logger'

// DELETE /api/admin/sets/[setCode]/cards/[cardId]
// Decrements quantity by 1. If quantity reaches 0, removes the row entirely.
export const DELETE: RequestHandler = async ({ locals, params }) => {
  await requireAdmin(locals)
  const adminClient = createAdminClient()

  // Fetch the current row so we know the quantity
  const { data: existing, error: fetchError } = await adminClient
    .from('set_cards')
    .select('id, quantity')
    .eq('set_code', params.setCode)
    .eq('card_id', params.cardId)
    .single()

  if (fetchError || !existing) {
    // Row doesn't exist — treat as already removed (idempotent)
    return new Response(null, { status: 204 })
  }

  if (existing.quantity > 1) {
    // Decrement quantity
    const { error: updateError } = await adminClient
      .from('set_cards')
      .update({ quantity: existing.quantity - 1 })
      .eq('id', existing.id)

    if (updateError) {
      logger.error({ error: updateError }, 'Error decrementing set_card quantity')
      throw error(500, 'Failed to update card quantity')
    }
    return json({ quantity: existing.quantity - 1 }, { status: 200 })
  }

  // quantity === 1 → remove the row entirely
  const { error: dbError } = await adminClient
    .from('set_cards')
    .delete()
    .eq('id', existing.id)

  if (dbError) {
    logger.error({ error: dbError }, 'Error removing card from set')
    throw error(500, 'Failed to remove card from set')
  }

  return new Response(null, { status: 204 })
}
