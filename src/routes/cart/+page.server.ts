import type { PageServerLoad } from './$types'

export const load: PageServerLoad = async ({ locals, parent }) => {
  // Get layout data which includes groupBuyConfig
  const parentData = await parent()

  // Check for existing pending order in this group buy.
  // Also catches orders where group_buy_id is NULL — orders placed when no group buy was
  // active, or placed before the group_buy_id column was backfilled, would otherwise be
  // permanently invisible and un-mergeable.
  let existingPendingOrder = null
  if (locals.user) {
    const groupBuyId = parentData.groupBuyConfig?.id ?? null

    let orderQuery = locals.supabase
      .from('orders')
      .select(
        `
        id,
        order_number,
        order_items (
          id,
          quantity,
          unit_price
        )
      `
      )
      .eq('user_id', locals.user.id)
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
      .limit(1)

    // Prefer orders for the current group buy; fall back to any pending order
    // (group_buy_id = current OR group_buy_id IS NULL)
    if (groupBuyId) {
      orderQuery = orderQuery.or(`group_buy_id.eq.${groupBuyId},group_buy_id.is.null`)
    }

    const { data: pendingOrder } = await orderQuery.maybeSingle()

    if (pendingOrder) {
      const itemCount =
        pendingOrder.order_items?.reduce(
          (sum: number, item: { quantity: number | null }) => sum + (item.quantity ?? 1),
          0
        ) ?? 0
      const total =
        pendingOrder.order_items?.reduce(
          (sum: number, item: { quantity: number | null; unit_price: number | string }) =>
            sum + (item.quantity ?? 1) * Number(item.unit_price),
          0
        ) ?? 0

      existingPendingOrder = {
        id: pendingOrder.id,
        orderNumber: pendingOrder.order_number,
        itemCount,
        total
      }
    }
  }

  return {
    user: locals.user,
    groupBuyConfig: parentData.groupBuyConfig,
    existingPendingOrder
  }
}
