import type { RequestHandler } from './$types'
import { json, error } from '@sveltejs/kit'
import { createAdminClient, isAdminDiscordId, ORDER_STATUS_CONFIG, type OrderStatus } from '$lib/server/admin'

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

export const POST: RequestHandler = async ({ params, request, locals }) => {
  const { user, adminClient } = await verifyAdmin(locals)

  const body = await request.json()
  const { status, notes } = body

  // Validate status
  if (!status || !(status in ORDER_STATUS_CONFIG)) {
    throw error(400, 'Invalid status')
  }

  // Get current order status
  const { data: order, error: fetchError } = await adminClient
    .from('orders')
    .select('status')
    .eq('id', params.id)
    .single()

  if (fetchError || !order) {
    throw error(404, 'Order not found')
  }

  const oldStatus = order.status as OrderStatus
  const newStatus = status as OrderStatus

  // Update order status
  const updateData: Record<string, unknown> = {
    status: newStatus
  }

  // Set shipped_at timestamp when marking as shipped
  if (newStatus === 'shipped' && oldStatus !== 'shipped') {
    updateData.shipped_at = new Date().toISOString()
  }

  // Set paid_at timestamp when marking as paid
  if (newStatus === 'paid' && oldStatus !== 'paid') {
    updateData.paid_at = new Date().toISOString()
  }

  const { error: updateError } = await adminClient.from('orders').update(updateData).eq('id', params.id)

  if (updateError) {
    console.error('Error updating order status:', updateError)
    throw error(500, 'Failed to update order status')
  }

  // Insert status history record
  const { error: historyError } = await adminClient.from('order_status_history').insert({
    order_id: params.id,
    old_status: oldStatus,
    new_status: newStatus,
    changed_by: user.id,
    notes: notes || null
  })

  if (historyError) {
    console.error('Error inserting status history:', historyError)
    // Don't fail the request, just log the error
  }

  return json({
    success: true,
    oldStatus,
    newStatus
  })
}
