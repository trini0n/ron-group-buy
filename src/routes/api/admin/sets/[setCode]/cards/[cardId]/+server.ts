import type { RequestHandler } from './$types'
import { error } from '@sveltejs/kit'
import { createAdminClient, requireAdmin } from '$lib/server/admin'
import { logger } from '$lib/server/logger'

// DELETE /api/admin/sets/[setCode]/cards/[cardId]
export const DELETE: RequestHandler = async ({ locals, params }) => {
  await requireAdmin(locals)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const adminClient = createAdminClient() as any

  const { error: dbError } = await adminClient
    .from('set_cards')
    .delete()
    .eq('set_code', params.setCode)
    .eq('card_id', params.cardId)

  if (dbError) {
    logger.error({ error: dbError }, 'Error removing card from set')
    throw error(500, 'Failed to remove card from set')
  }

  return new Response(null, { status: 204 })
}
