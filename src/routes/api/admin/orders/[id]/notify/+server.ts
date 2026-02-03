/**
 * Admin API endpoint for manually triggering notifications
 * POST: Send notification for an order
 */

import type { RequestHandler } from './$types'
import { json, error } from '@sveltejs/kit'
import { createAdminClient, isAdmin } from '$lib/server/admin'
import { createNotificationService } from '$lib/server/notifications'
import type { NotificationType, TemplateVariables } from '$lib/server/notifications'
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
  const { adminClient } = await verifyAdmin(locals)

  const body = await request.json()
  const { type, customMessage } = body as { 
    type?: NotificationType
    customMessage?: string 
  }

  // Get order details
  const { data: order, error: orderError } = await adminClient
    .from('orders')
    .select(`
      id,
      order_number,
      status,
      user_id,
      tracking_number,
      tracking_carrier,
      paypal_invoice_url
    `)
    .eq('id', params.id)
    .single()

  if (orderError || !order) {
    throw error(404, 'Order not found')
  }

  const notificationService = createNotificationService(adminClient)

  // If custom message provided, send directly
  if (customMessage) {
    const result = await notificationService.sendCustom(
      order.user_id,
      order.id,
      customMessage
    )
    return json({ success: result.success, error: result.error })
  }

  // Otherwise, send a templated notification based on type
  const notificationType = type || 'order_status_change'
  
  // Build tracking URL if tracking exists (use 17track.net as universal tracker)
  const trackingUrl = order.tracking_number 
    ? `https://t.17track.net/en#nums=${order.tracking_number}`
    : ''

  const variables: TemplateVariables = {
    order_number: order.order_number,
    status: order.status ?? undefined,
    order_url: getOrderUrl(order.id),
    tracking_number: order.tracking_number || undefined,
    tracking_carrier: order.tracking_carrier || undefined,
    tracking_url: trackingUrl || undefined
  }

  const result = await notificationService.send({
    userId: order.user_id,
    orderId: order.id,
    type: notificationType,
    variables
  })

  return json({ 
    success: result.success, 
    error: result.error,
    messageId: result.messageId 
  })
}
