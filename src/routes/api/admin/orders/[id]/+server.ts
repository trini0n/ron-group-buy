import type { RequestHandler } from './$types'
import { json, error } from '@sveltejs/kit'
import { createAdminClient, isAdminDiscordId } from '$lib/server/admin'
import { createNotificationService } from '$lib/server/notifications'
import type { TemplateVariables } from '$lib/server/notifications'
import { logger } from '$lib/server/logger'

// Base URL for order links
const getOrderUrl = (orderId: string) => `/orders/${orderId}`

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

  // Get current order to check if tracking is being added
  const { data: currentOrder } = await adminClient
    .from('orders')
    .select('id, order_number, user_id, tracking_number')
    .eq('id', params.id)
    .single()

  const isAddingTracking = tracking_number && !currentOrder?.tracking_number

  // Build update object
  const updateData: Record<string, unknown> = {}

  if (tracking_number !== undefined) updateData.tracking_number = tracking_number
  if (tracking_carrier !== undefined) updateData.tracking_carrier = tracking_carrier
  if (admin_notes !== undefined) updateData.admin_notes = admin_notes
  if (paypal_invoice_url !== undefined) updateData.paypal_invoice_url = paypal_invoice_url

  // Update order
  const { error: updateError } = await adminClient.from('orders').update(updateData).eq('id', params.id)

  if (updateError) {
    logger.error({ orderId: params.id, error: updateError }, 'Error updating order')
    throw error(500, 'Failed to update order')
  }

  // Send tracking notification if tracking number was just added
  if (isAddingTracking && currentOrder) {
    const notificationService = createNotificationService(adminClient)
    
    // Build tracking URL
    let trackingUrl = ''
    const carrier = (tracking_carrier || '').toLowerCase()
    if (carrier.includes('usps')) {
      trackingUrl = `https://tools.usps.com/go/TrackConfirmAction?qtc_tLabels1=${tracking_number}`
    } else if (carrier.includes('ups')) {
      trackingUrl = `https://www.ups.com/track?tracknum=${tracking_number}`
    } else if (carrier.includes('fedex')) {
      trackingUrl = `https://www.fedex.com/fedextrack/?trknbr=${tracking_number}`
    } else {
      trackingUrl = `https://parcelsapp.com/en/tracking/${tracking_number}`
    }

    const variables: TemplateVariables = {
      order_number: currentOrder.order_number,
      order_url: getOrderUrl(currentOrder.id),
      tracking_number,
      tracking_carrier: tracking_carrier || 'Carrier',
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
