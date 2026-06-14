import type { RequestHandler } from './$types'
import { json, error } from '@sveltejs/kit'
import { createAdminClient, requireAdmin } from '$lib/server/admin'
import { logger } from '$lib/server/logger'

// PATCH /api/admin/sets/[setCode] — update set_name or sort_order
export const PATCH: RequestHandler = async ({ request, locals, params }) => {
  await requireAdmin(locals)
  const adminClient = createAdminClient()
  let body: { set_name?: string; sort_order?: number; price?: number | null }
  try {
    body = await request.json()
  } catch {
    throw error(400, 'Invalid JSON')
  }
  const updates: Record<string, unknown> = {}
  if (body.set_name !== undefined) updates.set_name = body.set_name.trim()
  if (body.sort_order !== undefined) updates.sort_order = body.sort_order
  if (body.price !== undefined) updates.price = body.price ?? null
  if (Object.keys(updates).length === 0) throw error(400, 'No updatable fields provided')
  const { data, error: dbError } = await adminClient
    .from('sets')
    .update(updates)
    .eq('set_code', params.setCode)
    .select()
    .single()
  if (dbError) {
    logger.error({ error: dbError }, 'Error updating set')
    throw error(500, 'Failed to update set')
  }
  if (!data) throw error(404, 'Set not found')
  return json(data)
}

// DELETE /api/admin/sets/[setCode] — delete set (cascades set_cards)
export const DELETE: RequestHandler = async ({ locals, params }) => {
  await requireAdmin(locals)
  const adminClient = createAdminClient()
  const { error: dbError } = await adminClient
    .from('sets')
    .delete()
    .eq('set_code', params.setCode)
  if (dbError) {
    logger.error({ error: dbError }, 'Error deleting set')
    throw error(500, 'Failed to delete set')
  }
  return new Response(null, { status: 204 })
}
