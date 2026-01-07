import type { RequestHandler } from './$types'
import { json, error } from '@sveltejs/kit'
import { createAdminClient, isAdminDiscordId } from '$lib/server/admin'

// Helper to verify admin access
async function verifyAdmin(locals: App.Locals) {
  const user = locals.user
  if (!user) {
    throw error(401, 'Not authenticated')
  }

  const adminClient = createAdminClient()
  const { data: userData } = await adminClient.from('users').select('discord_id').eq('id', user.id).single()

  if (!isAdminDiscordId(userData?.discord_id)) {
    throw error(403, 'Not authorized')
  }

  return { user, adminClient }
}

export const PATCH: RequestHandler = async ({ params, request, locals }) => {
  const { adminClient } = await verifyAdmin(locals)

  const body = await request.json()
  const { admin_notes, is_blocked, blocked_reason } = body

  // Build update object
  const updateData: Record<string, unknown> = {}

  if (admin_notes !== undefined) updateData.admin_notes = admin_notes
  if (is_blocked !== undefined) updateData.is_blocked = is_blocked
  if (blocked_reason !== undefined) updateData.blocked_reason = blocked_reason

  // Update user
  const { error: updateError } = await adminClient.from('users').update(updateData).eq('id', params.id)

  if (updateError) {
    console.error('Error updating user:', updateError)
    throw error(500, 'Failed to update user')
  }

  return json({ success: true })
}
