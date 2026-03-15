# Plan 01-02 Summary: Server-Authoritative Order Pricing

## Status: Complete

## What Changed

### `src/routes/api/orders/+server.ts`

**New imports added:**

```typescript
import { fetchPrices } from '$lib/server/pricing'
import { getCardPrice } from '$lib/utils'
```

**Create path (was `unit_price: item.unitPrice`):**

- Before the `orderItems` map, fetch prices from DB and batch-fetch card types:
  ```typescript
  const prices = await fetchPrices(locals.supabase)
  const cardIds = items.map((item: OrderItem) => item.cardId)
  const { data: cardRows } = await locals.supabase.from('cards').select('id, card_type').in('id', cardIds)
  const serverCardTypeMap = new Map(cardRows?.map((r) => [r.id, r.card_type]) ?? [])
  ```
- Each item's `unit_price` is now `getCardPrice(serverCardTypeMap.get(item.cardId) ?? item.cardType, prices)`

**Merge path (`mergeIntoExistingOrder` function, was `unit_price: newItem.unitPrice`):**

- Same batch pattern applied at function start
- New items inserted with server-computed price instead of payload value

## How It Works

`fetchPrices` queries the `card_type_pricing` table (falls back to hardcoded defaults if unavailable). `getCardPrice` looks up the type in the prices map. Card types are fetched from the DB by card ID — never from the client payload.

A client sending `unitPrice: 0` or any manipulated value has no effect on what's stored.

## Commit

`18fe5cd` — fix(security): server-authoritative pricing for order create and merge
