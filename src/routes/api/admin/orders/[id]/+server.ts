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
  const { tracking_number, tracking_carrier, admin_notes, paypal_invoice_url } = body

  // Build update object
  const updateData: Record<string, unknown> = {}

  if (tracking_number !== undefined) updateData.tracking_number = tracking_number
  if (tracking_carrier !== undefined) updateData.tracking_carrier = tracking_carrier
  if (admin_notes !== undefined) updateData.admin_notes = admin_notes
  if (paypal_invoice_url !== undefined) updateData.paypal_invoice_url = paypal_invoice_url

  // Update order
  const { error: updateError } = await adminClient.from('orders').update(updateData).eq('id', params.id)

  if (updateError) {
    console.error('Error updating order:', updateError)
    throw error(500, 'Failed to update order')
  }

  return json({ success: true })
}
