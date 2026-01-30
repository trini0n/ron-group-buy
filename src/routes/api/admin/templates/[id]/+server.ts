/**
 * Admin API for managing a specific notification template
 * PATCH: Update template
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

export const PATCH = async ({ params, request, locals }: RequestEvent) => {
  const { adminClient } = await verifyAdmin(locals)

  const templateId = params.id as string
  const body = await request.json()
  const { body_template, subject, is_active } = body as {
    body_template?: string
    subject?: string
    is_active?: boolean
  }

  // Build update object
  const updateData: Record<string, unknown> = {}
  if (body_template !== undefined) updateData.body_template = body_template
  if (subject !== undefined) updateData.subject = subject
  if (is_active !== undefined) updateData.is_active = is_active

  const { data: template, error: updateError } = await adminClient
    .from('notification_templates')
    .update(updateData)
    .eq('id', templateId)
    .select()
    .single()

  if (updateError) {
    throw error(500, 'Failed to update template')
  }

  return json({ template })
}
