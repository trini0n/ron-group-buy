/**
 * Admin Pricing API
 *
 * GET  /api/admin/pricing — returns all card type prices
 * PATCH /api/admin/pricing — updates prices and backfills pending order_items
 *
 * Note: `card_type_pricing` is a new table added in migration 20260310000000.
 * The Supabase generated types won't include it until `supabase gen types` is re-run
 * after applying the migration, so we cast to `any` for those queries.
 */
import { json, error } from '@sveltejs/kit'
import type { RequestEvent } from '@sveltejs/kit'
import { isAdmin } from '$lib/server/admin'
import { logger } from '$lib/server/logger'

async function requireAdmin(locals: RequestEvent['locals']) {
  const { data: userData } = await locals.supabase
    .from('users')
    .select('discord_id')
    .eq('id', locals.user?.id ?? '')
    .single()

  if (!locals.user || !(await isAdmin(userData?.discord_id))) {
    throw error(403, 'Forbidden')
  }
}

export async function GET({ locals }: RequestEvent) {
  await requireAdmin(locals)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error: dbError } = await (locals.supabase as any)
    .from('card_type_pricing')
    .select('card_type, price')
    .order('card_type')

  if (dbError) throw error(500, dbError.message)

  return json(data)
}

export async function PATCH({ locals, request }: RequestEvent) {
  await requireAdmin(locals)

  const body: { card_type: string; price: number }[] = await request.json()

  if (
    !Array.isArray(body) ||
    body.some((r) => typeof r.card_type !== 'string' || typeof r.price !== 'number')
  ) {
    throw error(400, 'Invalid payload')
  }

  const upserts = body.map((r) => ({ card_type: r.card_type, price: r.price }))

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: upsertError } = await (locals.supabase as any)
    .from('card_type_pricing')
    .upsert(upserts, { onConflict: 'card_type' })

  if (upsertError) throw error(500, upsertError.message)

  const priceMap: Record<string, number> = Object.fromEntries(
    body.map((r) => [r.card_type, r.price])
  )

  // Fetch pending order IDs for the active group buy
  const { data: pendingOrders } = await locals.supabase
    .from('orders')
    .select('id')
    .eq('status', 'pending')

  const pendingOrderIds = (pendingOrders ?? []).map((o: { id: string }) => o.id)

  if (pendingOrderIds.length > 0) {
    // Fetch pending order_items
    const { data: pendingItems, error: itemsErr } = await locals.supabase
      .from('order_items')
      .select('id, card_type_snapshot')
      .in('order_id', pendingOrderIds)

    if (itemsErr) {
      logger.error({ error: itemsErr }, 'Failed to fetch pending order items for price backfill')
    } else if (pendingItems?.length) {
      // Batch-update by card_type_snapshot — at most ~5 types so O(types) not O(items)
      const typeToItemIds = new Map<string, string[]>()
      for (const item of pendingItems as unknown as { id: string; card_type_snapshot: string | null }[]) {
        if (item.card_type_snapshot && item.card_type_snapshot in priceMap) {
          const bucket = typeToItemIds.get(item.card_type_snapshot)
          if (bucket) {
            bucket.push(item.id)
          } else {
            typeToItemIds.set(item.card_type_snapshot, [item.id])
          }
        }
      }
      await Promise.all(
        Array.from(typeToItemIds.entries()).map(([cardType, ids]) =>
          locals.supabase
            .from('order_items')
            .update({ unit_price: priceMap[cardType] })
            .in('id', ids)
        )
      )
    }
  }

  return json({ success: true, updated: upserts.length })
}
