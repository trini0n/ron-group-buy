import type { RequestHandler } from './$types'
import { json, error } from '@sveltejs/kit'
import { createAdminClient, requireAdmin } from '$lib/server/admin'
import { logger } from '$lib/server/logger'

// GET /api/admin/sets — list all sets with card count
export const GET: RequestHandler = async ({ locals }) => {
  await requireAdmin(locals)
  const adminClient = createAdminClient()
  const { data, error: dbError } = await adminClient
    .from('sets')
    .select('set_code, set_name, sort_order, created_at, set_cards(count)')
    .order('sort_order', { ascending: true })
    .order('set_name', { ascending: true })
  if (dbError) {
    logger.error({ error: dbError }, 'Error fetching sets')
    throw error(500, 'Failed to fetch sets')
  }
  return json(data)
}

// POST /api/admin/sets — create a new set
export const POST: RequestHandler = async ({ request, locals }) => {
  await requireAdmin(locals)
  const adminClient = createAdminClient()
  const VALID_TYPES = ['Normal', 'Holo / Mixed', 'Foil']
  let body: { set_code: string; set_name: string; price?: number | null; set_type?: string }
  try {
    body = await request.json()
  } catch {
    throw error(400, 'Invalid JSON')
  }
  const { set_code, set_name, price, set_type } = body
  if (!set_code?.trim() || !set_name?.trim()) {
    throw error(400, 'set_code and set_name are required')
  }
  if (set_type !== undefined && !VALID_TYPES.includes(set_type)) {
    throw error(400, 'Invalid set_type')
  }
  const { data, error: dbError } = await adminClient
    .from('sets')
    .insert({
      set_code: set_code.trim().toUpperCase(),
      set_name: set_name.trim(),
      ...(price !== undefined ? { price: price ?? null } : {}),
      ...(set_type !== undefined ? { set_type } : {})
    })
    .select()
    .single()
  if (dbError) {
    if (dbError.code === '23505') throw error(409, 'A set with this code already exists')
    logger.error({ error: dbError }, 'Error creating set')
    throw error(500, 'Failed to create set')
  }
  return json(data, { status: 201 })
}
