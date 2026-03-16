import { json, error } from '@sveltejs/kit'
import { createAdminClient, isAdminRequest } from '$lib/server/admin'
import { createNotificationService } from '$lib/server/notifications'
import { PUBLIC_APP_URL } from '$env/static/public'
import type { RequestHandler } from './$types'
import { logger } from '$lib/server/logger'
import { z } from 'zod'

const VALID_ORDER_STATUSES = ['pending', 'invoiced', 'paid', 'processing', 'shipped', 'delivered', 'cancelled'] as const
const BulkStatusSchema = z.object({
  orderIds: z.array(z.string().min(1)).min(1),
  status: z.enum(VALID_ORDER_STATUSES)
})

export const POST: RequestHandler = async ({ request, locals }) => {
  // Verify admin access
  if (!(await isAdminRequest(locals))) {
    throw error(403, 'Admin access required')
  }

  const parseResult = BulkStatusSchema.safeParse(await request.json())
  if (!parseResult.success) {
    return json({ error: 'Invalid request body', issues: parseResult.error.issues }, { status: 400 })
  }
  const { orderIds, status } = parseResult.data

  const adminClient = createAdminClient()

  // Get current order statuses and user info for notifications
  const { data: currentOrders, error: fetchError } = await adminClient
    .from('orders')
    .select(
      `
      id,
      status,
      order_number,
      user_id,
      tracking_number,
      tracking_carrier,
      users!inner(discord_id),
      group_buy_config(name)
    `
    )
    .in('id', orderIds)

  if (fetchError) {
    logger.error({ error: fetchError }, 'Error fetching orders')
    throw error(500, 'Failed to fetch orders')
  }

  // Update all orders
  const { error: updateError } = await adminClient.from('orders').update({ status }).in('id', orderIds)

  if (updateError) {
    logger.error({ error: updateError }, 'Error updating orders')
    throw error(500, 'Failed to update orders')
  }

  // Create status history entries for each order
  const historyEntries =
    currentOrders?.map((order) => ({
      order_id: order.id,
      old_status: order.status,
      new_status: status,
      notes: `Bulk status update`,
      changed_by: locals.user?.id
    })) || []

  if (historyEntries.length > 0) {
    await adminClient.from('order_status_history').insert(historyEntries)
  }

  // Queue notifications for users with Discord connected
  const notificationService = createNotificationService(adminClient)
  let notificationsSent = 0

  for (const order of currentOrders || []) {
    // Only send if user has Discord connected
    if (order.users?.discord_id) {
      try {
        // Build tracking URL if tracking exists
        const trackingUrl = order.tracking_number ? `https://t.17track.net/en#nums=${order.tracking_number}` : undefined

        const result = await notificationService.send({
          userId: order.user_id,
          orderId: order.id,
          type: 'order_status_change',
          variables: {
            order_number: order.order_number,
            status: status,
            order_url: `${PUBLIC_APP_URL}/orders/${order.id}`,
            tracking_number: order.tracking_number || undefined,
            tracking_carrier: order.tracking_carrier || undefined,
            tracking_url: trackingUrl,
            group_buy_name: order.group_buy_config?.name || undefined
          }
        })

        if (result.success) {
          notificationsSent++
        }
      } catch (err) {
        logger.error({ error: err, orderId: order.id }, 'Failed to send notification for order')
        // Continue processing other notifications
      }
    }
  }

  return json({
    success: true,
    updated: orderIds.length,
    notificationsSent
  })
}
