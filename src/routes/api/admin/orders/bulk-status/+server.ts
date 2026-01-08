import { json, error } from '@sveltejs/kit'
import { createAdminClient, isAdminRequest } from '$lib/server/admin'
import type { RequestHandler } from './$types'

export const POST: RequestHandler = async ({ request, locals }) => {
  // Verify admin access
  if (!await isAdminRequest(locals)) {
    throw error(403, 'Admin access required')
  }

  const { orderIds, status } = await request.json()

  if (!orderIds || !Array.isArray(orderIds) || orderIds.length === 0) {
    throw error(400, 'No orders specified')
  }

  const validStatuses = ['pending', 'invoiced', 'paid', 'processing', 'shipped', 'delivered', 'cancelled']
  if (!status || !validStatuses.includes(status)) {
    throw error(400, 'Invalid status')
  }

  const adminClient = createAdminClient()

  // Get current order statuses for history
  const { data: currentOrders, error: fetchError } = await adminClient
    .from('orders')
    .select('id, status')
    .in('id', orderIds)

  if (fetchError) {
    console.error('Error fetching orders:', fetchError)
    throw error(500, 'Failed to fetch orders')
  }

  // Update all orders
  const { error: updateError } = await adminClient
    .from('orders')
    .update({ status })
    .in('id', orderIds)

  if (updateError) {
    console.error('Error updating orders:', updateError)
    throw error(500, 'Failed to update orders')
  }

  // Create status history entries for each order
  const historyEntries = currentOrders?.map(order => ({
    order_id: order.id,
    old_status: order.status,
    new_status: status,
    notes: `Bulk status update`,
    changed_by: locals.user?.id
  })) || []

  if (historyEntries.length > 0) {
    await adminClient
      .from('order_status_history')
      .insert(historyEntries)
  }

  return json({ 
    success: true, 
    updated: orderIds.length 
  })
}
