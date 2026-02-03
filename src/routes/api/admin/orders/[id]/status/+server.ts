import type { RequestHandler } from './$types'
import { json, error } from '@sveltejs/kit'
import { createAdminClient, isAdmin, ORDER_STATUS_CONFIG, type OrderStatus } from '$lib/server/admin'
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

export const POST: RequestHandler = async ({ params, request, locals }) => {
  const { user, adminClient } = await verifyAdmin(locals)

  const body = await request.json()
  const { status, notes } = body

  // Validate status
  if (!status || !(status in ORDER_STATUS_CONFIG)) {
    throw error(400, 'Invalid status')
  }

  // Get current order with user info for notification
  const { data: order, error: fetchError } = await adminClient
    .from('orders')
    .select('id, order_number, status, user_id')
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
    logger.error({ orderId: params.id, error: updateError }, 'Error updating order status')
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
    logger.error({ orderId: params.id, error: historyError }, 'Error inserting status history')
    // Don't fail the request, just log the error
  }

  // Send notification for status change (async, don't block the response)
  if (oldStatus !== newStatus) {
    const notificationService = createNotificationService(adminClient)
    
    const variables: TemplateVariables = {
      order_number: order.order_number,
      status: ORDER_STATUS_CONFIG[newStatus]?.label || newStatus,
      previous_status: ORDER_STATUS_CONFIG[oldStatus]?.label || oldStatus,
      order_url: getOrderUrl(order.id),
      // Add PayPal inbox reminder when status is Invoiced
      invoiced_message: newStatus === 'invoiced' 
        ? '\n\nPlease check your PayPal email inbox for the invoice.' 
        : undefined
    }

    // Fire and forget - don't await to avoid blocking the response
    notificationService.send({
      userId: order.user_id,
      orderId: order.id,
      type: 'order_status_change',
      variables
    }).catch(err => {
      logger.error({ orderId: order.id, error: err }, 'Failed to send status change notification')
    })
  }

  return json({
    success: true,
    oldStatus,
    newStatus
  })
}
