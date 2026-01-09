import type { PageServerLoad } from './$types'

export const load: PageServerLoad = async ({ locals, parent }) => {
  // Get layout data which includes groupBuyConfig
  const parentData = await parent()

  // Check for existing pending order in this group buy
  let existingPendingOrder = null
  if (locals.user && parentData.groupBuyConfig?.id) {
    const { data: pendingOrder } = await locals.supabase
      .from('orders')
      .select(`
        id,
        order_number,
        order_items (
          id,
          quantity,
          unit_price
        )
      `)
      .eq('user_id', locals.user.id)
      .eq('group_buy_id', parentData.groupBuyConfig.id)
      .eq('status', 'pending')
      .single()

    if (pendingOrder) {
      const itemCount = pendingOrder.order_items?.reduce(
        (sum: number, item: { quantity: number | null }) => sum + (item.quantity ?? 1), 0
      ) ?? 0
      const total = pendingOrder.order_items?.reduce(
        (sum: number, item: { quantity: number | null; unit_price: number | string }) => 
          sum + (item.quantity ?? 1) * Number(item.unit_price), 0
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
