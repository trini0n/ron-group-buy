import { json, error } from '@sveltejs/kit'
import { createAdminClient, isAdminRequest } from '$lib/server/admin'
import { createNotificationService } from '$lib/server/notifications'
import { PUBLIC_APP_URL } from '$env/static/public'
import type { RequestHandler } from './$types'
import { logger } from '$lib/server/logger'
import { z } from 'zod'

const TrackingEntrySchema = z.object({
  order_number: z.string().min(1),
  regular_tracking: z.string().optional().nullable(),
  express_tracking: z.string().optional().nullable()
})

const BulkTrackingSchema = z.object({
  entries: z.array(TrackingEntrySchema).min(1)
})

export const POST: RequestHandler = async ({ request, locals }) => {
  // Distinguish 401 (not logged in) from 403 (not admin)
  if (!locals.user) {
    throw error(401, 'Authentication required')
  }
  if (!(await isAdminRequest(locals))) {
    throw error(403, 'Admin access required')
  }

  const parseResult = BulkTrackingSchema.safeParse(await request.json())
  if (!parseResult.success) {
    return json({ error: 'Invalid request body', issues: parseResult.error.issues }, { status: 400 })
  }
  const { entries } = parseResult.data

  const adminClient = createAdminClient()

  // Fetch all matching orders by order_number
  const orderNumbers = entries.map((e) => e.order_number)
  const { data: orders, error: fetchError } = await adminClient
    .from('orders')
    .select('id, order_number, status, shipping_type, tracking_number, user_id')
    .in('order_number', orderNumbers)

  if (fetchError) {
    logger.error({ error: fetchError }, 'Error fetching orders for bulk tracking')
    throw error(500, 'Failed to fetch orders')
  }

  const orderMap = new Map(orders?.map((o) => [o.order_number, o]) ?? [])

  const results: { order_number: string; success: boolean; error?: string; skipped?: boolean }[] = []
  const notificationService = createNotificationService(adminClient)

  for (const entry of entries) {
    const order = orderMap.get(entry.order_number)
    if (!order) {
      results.push({ order_number: entry.order_number, success: false, error: 'Order not found' })
      continue
    }

    // Determine which tracking number applies based on shipping_type
    // Express orders get express_tracking (FedEx), regular orders get regular_tracking
    const isExpress = order.shipping_type === 'express'
    const trackingNumber = isExpress
      ? (entry.express_tracking ?? null)
      : (entry.regular_tracking ?? null)
    const trackingCarrier = isExpress ? 'FedEx' : null

    // Skip if no applicable tracking for this order's shipping type
    if (!trackingNumber) {
      results.push({ order_number: entry.order_number, success: true, skipped: true })
      continue
    }

    // Skip if tracking is already set to the same value
    if (order.tracking_number === trackingNumber) {
      results.push({ order_number: entry.order_number, success: true, skipped: true })
      continue
    }

    const isAddingTracking = !order.tracking_number
    const previousStatus = order.status

    const updateData: Record<string, unknown> = {
      tracking_number: trackingNumber,
      ...(trackingCarrier ? { tracking_carrier: trackingCarrier } : {})
    }

    // Auto-update status to 'shipped' when tracking is first added
    if (isAddingTracking) {
      updateData.status = 'shipped'
      updateData.shipped_at = new Date().toISOString()
    }

    const { error: updateError } = await adminClient
      .from('orders')
      .update(updateData)
      .eq('id', order.id)

    if (updateError) {
      logger.error({ orderId: order.id, error: updateError }, 'Error updating order tracking')
      results.push({ order_number: entry.order_number, success: false, error: 'Failed to update order' })
      continue
    }

    // Record status history entries
    if (isAddingTracking) {
      type OrderStatus = 'pending' | 'invoiced' | 'paid' | 'processing' | 'shipped' | 'delivered' | 'cancelled'
      const historyEntries: { order_id: string; old_status: OrderStatus; new_status: OrderStatus; changed_by: string | null; notes: string }[] = []

      if (previousStatus && previousStatus !== 'shipped') {
        historyEntries.push({
          order_id: order.id,
          old_status: previousStatus as OrderStatus,
          new_status: 'shipped',
          changed_by: locals.user?.id ?? null,
          notes: 'Status auto-updated when tracking number was added via bulk upload'
        })
      }

      historyEntries.push({
        order_id: order.id,
        old_status: 'shipped',
        new_status: 'shipped',
        changed_by: locals.user?.id ?? null,
        notes: `Tracking number added via bulk upload: ${trackingNumber}${trackingCarrier ? ` (${trackingCarrier})` : ''}`
      })

      await adminClient.from('order_status_history').insert(historyEntries)
    }

    // Send tracking notification (fire and forget)
    if (isAddingTracking) {
      const trackingUrl = `https://t.17track.net/en#nums=${trackingNumber}`
      notificationService
        .send({
          userId: order.user_id,
          orderId: order.id,
          type: 'tracking_added',
          variables: {
            order_number: order.order_number,
            order_url: `${PUBLIC_APP_URL}/orders/${order.id}`,
            tracking_number: trackingNumber,
            tracking_carrier: trackingCarrier ?? undefined,
            tracking_url: trackingUrl
          }
        })
        .catch((err) => {
          logger.error({ orderId: order.id, error: err }, 'Failed to send tracking notification')
        })
    }

    results.push({ order_number: entry.order_number, success: true })
  }

  const updated = results.filter((r) => r.success && !r.skipped).length
  const skipped = results.filter((r) => r.skipped).length
  const failed = results.filter((r) => !r.success).length

  return json({ success: true, updated, skipped, failed, results })
}
