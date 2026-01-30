import type { RequestHandler } from './$types'
import { json, error } from '@sveltejs/kit'
import { createAdminClient, isAdmin } from '$lib/server/admin'
import { createNotificationService } from '$lib/server/notifications'
import type { TemplateVariables } from '$lib/server/notifications'
import { logger } from '$lib/server/logger'
import { PUBLIC_APP_URL } from '$env/static/public'

// Base URL for order links (full URL for Discord)
const getOrderUrl = (orderId: string) => `${PUBLIC_APP_URL}/orders/${orderId}`

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

export const PATCH: RequestHandler = async ({ params, request, locals }) => {
  const { user, adminClient } = await verifyAdmin(locals)

  const body = await request.json()
  const { tracking_number, tracking_carrier, admin_notes, paypal_invoice_url } = body

  // Get current order to check if tracking is being added
  const { data: currentOrder } = await adminClient
    .from('orders')
    .select('id, order_number, user_id, tracking_number, status')
    .eq('id', params.id)
    .single()

  const isAddingTracking = tracking_number && !currentOrder?.tracking_number
  const previousStatus = currentOrder?.status

  // Build update object
  const updateData: Record<string, unknown> = {}

  if (tracking_number !== undefined) updateData.tracking_number = tracking_number
  if (tracking_carrier !== undefined) updateData.tracking_carrier = tracking_carrier
  if (admin_notes !== undefined) updateData.admin_notes = admin_notes
  if (paypal_invoice_url !== undefined) updateData.paypal_invoice_url = paypal_invoice_url

  // Auto-update status to 'shipped' when tracking number is added
  if (isAddingTracking) {
    updateData.status = 'shipped'
    updateData.shipped_at = new Date().toISOString()
  }

  // Update order
  const { error: updateError } = await adminClient.from('orders').update(updateData).eq('id', params.id)

  if (updateError) {
    logger.error({ orderId: params.id, error: updateError }, 'Error updating order')
    throw error(500, 'Failed to update order')
  }

  // Add status history entries when tracking is added
  if (isAddingTracking && currentOrder) {
    // If status changed, add status change entry
    if (previousStatus && previousStatus !== 'shipped') {
      await adminClient.from('order_status_history').insert({
        order_id: params.id,
        old_status: previousStatus,
        new_status: 'shipped',
        changed_by: user.id,
        notes: 'Status auto-updated when tracking number was added'
      })
    }

    // Add tracking number entry
    await adminClient.from('order_status_history').insert({
      order_id: params.id,
      old_status: 'shipped',
      new_status: 'shipped',
      changed_by: user.id,
      notes: `Tracking number added to order: ${tracking_number}`
    })
  }

  // Send tracking notification if tracking number was just added
  if (isAddingTracking && currentOrder) {
    const notificationService = createNotificationService(adminClient)
    
    // Build tracking URL (use 17track.net as universal tracker)
    const trackingUrl = `https://t.17track.net/en#nums=${tracking_number}`

    const variables: TemplateVariables = {
      order_number: currentOrder.order_number,
      order_url: getOrderUrl(currentOrder.id),
      tracking_number,
      tracking_carrier: tracking_carrier || undefined, // Don't pass 'Carrier' fallback
      tracking_url: trackingUrl
    }

    // Fire and forget
    notificationService.send({
      userId: currentOrder.user_id,
      orderId: currentOrder.id,
      type: 'tracking_added',
      variables
    }).catch(err => {
      logger.error({ orderId: currentOrder.id, error: err }, 'Failed to send tracking notification')
    })
  }

  return json({ success: true })
}

export const DELETE: RequestHandler = async ({ params, locals }) => {
  const { adminClient } = await verifyAdmin(locals)

  // First, delete all order items associated with this order
  const { error: itemsError } = await adminClient.from('order_items').delete().eq('order_id', params.id)

  if (itemsError) {
    console.error('Error deleting order items:', itemsError)
    throw error(500, 'Failed to delete order items')
  }

  // Then delete the order itself
  const { error: orderError } = await adminClient.from('orders').delete().eq('id', params.id)

  if (orderError) {
    console.error('Error deleting order:', orderError)
    throw error(500, 'Failed to delete order')
  }

  return json({ success: true })
}
