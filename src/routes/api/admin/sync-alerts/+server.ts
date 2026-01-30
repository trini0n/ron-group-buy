import { json, error } from '@sveltejs/kit'
import type { RequestHandler } from './$types'
import { createAdminClient, isAdmin } from '$lib/server/admin'

// Helper to verify admin access
async function verifyAdmin(locals: App.Locals) {
  const user = locals.user
  if (!user) {
    throw error(401, 'Not authenticated')
  }

  const adminClient = createAdminClient()
  const { data: userData } = await adminClient.from('users').select('discord_id').eq('id', user.id).single()

  if (!(await isAdmin(userData?.discord_id))) {
    throw error(403, 'Not authorized')
  }

  return { user, adminClient }
}

// GET - Fetch sync duplicate alerts
export const GET: RequestHandler = async ({ locals, url }) => {
  const { adminClient } = await verifyAdmin(locals)

  const showResolved = url.searchParams.get('resolved') === 'true'

  let query = adminClient
    .from('sync_duplicate_alerts')
    .select('*')
    .order('sync_timestamp', { ascending: false })

  if (!showResolved) {
    query = query.eq('resolved', false)
  }

  const { data: alerts, error: fetchError } = await query

  if (fetchError) {
    console.error('Error fetching sync alerts:', fetchError)
    throw error(500, 'Failed to fetch sync alerts')
  }

  return json({
    alerts: alerts || [],
    count: alerts?.length || 0
  })
}

// POST - Mark alert as resolved
export const POST: RequestHandler = async ({ locals, request }) => {
  const { user, adminClient } = await verifyAdmin(locals)

  const body = await request.json()
  const { alertId, notes } = body

  if (!alertId) {
    throw error(400, 'Alert ID is required')
  }

  const { error: updateError } = await adminClient
    .from('sync_duplicate_alerts')
    .update({
      resolved: true,
      resolved_at: new Date().toISOString(),
      resolved_by: user.id,
      notes: notes || null
    })
    .eq('id', alertId)

  if (updateError) {
    console.error('Error resolving alert:', updateError)
    throw error(500, 'Failed to resolve alert')
  }

  return json({ success: true })
}
