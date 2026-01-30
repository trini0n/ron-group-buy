/**
 * Admin API for managing notification templates
 * GET: List all templates
 * PUT: Update a template
 */

import { json, error, type RequestEvent } from '@sveltejs/kit'
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

export const GET = async ({ locals }: RequestEvent) => {
  const { adminClient } = await verifyAdmin(locals)

  const { data: templates, error: fetchError } = await adminClient
    .from('notification_templates')
    .select('*')
    .order('type', { ascending: true })

  if (fetchError) {
    throw error(500, 'Failed to fetch templates')
  }

  return json({ templates })
}
