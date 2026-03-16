# 06-02 Summary: Zod Validation on All POST Handlers

## Status: COMPLETE

## What was done

Added Zod `safeParse` validation to every POST handler that reads a request body. Pattern applied uniformly:

```ts
const parseResult = Schema.safeParse(await request.json())
if (!parseResult.success) {
  return json({ error: 'Invalid request body', issues: parseResult.error.issues }, { status: 400 })
}
const { field1, field2 } = parseResult.data
```

### Files modified (13)

| File                                           | Schema                                                              |
| ---------------------------------------------- | ------------------------------------------------------------------- |
| `api/cart/+server.ts`                          | `AddToCartSchema` — card_id, quantity (default 1), expected_version |
| `api/cart/bulk/+server.ts`                     | `BulkCartSchema` — items array (min 1), expected_version            |
| `api/cart/merge/+server.ts`                    | `MergeCartSchema` — confirm/skip booleans (default false)           |
| `api/orders/+server.ts`                        | `CreateOrderSchema` — full order body including checkout_session_id |
| `api/orders/[id]/pending/+server.ts`           | `PendingOrderActionSchema` — action enum(merge, cancel)             |
| `api/profile/addresses/+server.ts`             | `CreateAddressSchema` — address fields                              |
| `api/admin/config/+server.ts`                  | `CreateConfigSchema` — name, dates, is_active                       |
| `api/admin/orders/[id]/status/+server.ts`      | `UpdateOrderStatusSchema` — status string, notes                    |
| `api/admin/orders/bulk-status/+server.ts`      | `BulkStatusSchema` — orderIds array, status enum                    |
| `api/admin/sync-alerts/+server.ts`             | `ResolveSyncAlertSchema` — alertId, notes                           |
| `api/admin/inventory/resync-images/+server.ts` | `ResyncImagesSchema` — card_ids array (min 1, max 50)               |
| `api/admin/orders/[id]/notify/+server.ts`      | `NotifyOrderSchema` — type, customMessage                           |
| `api/admin/users/[id]/admin/+server.ts`        | `ToggleAdminSchema` — isAdmin boolean                               |

### Orders handler specifics

- `phoneNumber` and `paypalEmail` use `.trim().min(1)` — whitespace-only values rejected at Zod level
- E.164 regex check retained as business-logic validation after Zod parse
- `shippingType` and `action` manual enum checks removed (covered by `z.enum(...)`)
- Also added `checkout_session_id` field for plan 06-03 wiring

### Test updates

- `src/routes/api/orders/__tests__/orders-phone.test.ts` — 4 test assertions updated from `rejects.toThrow()` to check resolved `{ error: 'Invalid request body', issues }` response (because `json` is mocked to return data, not throw)

## Verification

- `npm run check` — zero new errors
- `npm run test -- --run` — orders-phone tests all pass; 5 pre-existing failures unchanged
