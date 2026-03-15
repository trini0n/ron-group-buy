# Plan 02-01 Summary: Batch N+1 DB Write Loops

## Status: Complete

## What Changed

### `src/routes/api/orders/+server.ts` (merge path)

- **Before**: `for (const update of itemsToUpdate) { await supabase.update(...).eq('id', update.id) }` — O(n) sequential calls
- **After**: `await Promise.all(itemsToUpdate.map(u => supabase.update(...).eq('id', u.id)))` — O(1) clock time, concurrent

### `src/routes/api/orders/[id]/pending/+server.ts` (cart merge)

- **Before**: Per-item `await supabase.from('cart_items').update(...)` and `.insert(...)` inside a `for` loop
- **After**: Collect `cartItemsToUpdate[]` and `cartItemsToInsert[]` in the loop, flush with `.upsert(onConflict: cart_id,card_id)` and `.insert(array)` — 2 calls max

### `src/routes/api/admin/pricing/+server.ts` (backfill)

- **Before**: Per-item `await supabase.from('order_items').update({ unit_price }).eq('id', item.id)` — O(items)
- **After**: Group items by `card_type_snapshot` (max ~5 types), run `Promise.all` with one `.update().in('id', ids)` per type — O(card_types) ≈ O(1)

### `src/lib/server/cart-service.ts` (identity lookup)

- **Before**: Sequential `for` loop calling `await findCardsByIdentity(...)` per order item
- **After**: Pre-warm price cache, then `Promise.all(order.order_items.map(item => findCardsByIdentity(...)))` — all identity lookups fire in parallel

## Commit

`aff2c92` — perf(correctness): batch N+1 DB write loops in orders, pending merge, pricing backfill
