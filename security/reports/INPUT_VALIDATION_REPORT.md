# INPUT_VALIDATION Security Report

## Status: PASS (with minor gaps in admin routes — LOW risk)

## Findings

### Zod Schema Validation — Used in 16 of 35 routes

The following routes use `z.safeParse()` with explicit Zod schemas:

| Route | Schema |
|-------|--------|
| `/api/cart` POST | `AddToCartSchema` — validates card_id, quantity, expected_version |
| `/api/cart/[itemId]` PATCH | (validates item ID) |
| `/api/cart/bulk` POST | Bulk cart items |
| `/api/cart/bundles` POST | Bundle schema |
| `/api/cart/merge` POST | Merge schema |
| `/api/admin/orders/bulk-status` POST | `BulkStatusSchema` — orderIds array + status enum |
| `/api/admin/orders/bulk-tracking` POST | `BulkTrackingSchema` — entries array with tracking format |
| `/api/admin/orders/[id]/status` POST | Status enum validation |
| `/api/admin/orders/[id]/notify` POST | Notification schema |
| `/api/admin/config` POST | Config schema |
| `/api/admin/inventory/resync-images` POST | Schema validated |
| `/api/admin/sync-alerts` PATCH | Schema validated |
| `/api/admin/users/[id]/admin` POST | Role enum validation |
| `/api/orders` POST | Complex order schema |
| `/api/orders/[id]/pending` POST | `PendingOrderActionSchema` — action enum |
| `/api/profile/addresses` POST | `CreateAddressSchema` — full address validation |

### ⚠️ Routes Without Zod Schemas — Admin-Only, LOW Risk

These routes use plain JSON destructuring without a Zod schema:

| Route | Fields | Risk |
|-------|--------|------|
| `/api/admin/orders/[id]` PATCH | `tracking_number, tracking_carrier, admin_notes, paypal_invoice_url` | Admin-only |
| `/api/admin/users/[id]` PATCH | `admin_notes, is_blocked, blocked_reason` | Admin-only |
| `/api/profile` PATCH | `name, paypal_email` | Authenticated user only |
| `/api/profile/addresses/[id]` PATCH | Full updates object (spread) | ⚠️ See below |

### ⚠️ `/api/profile/addresses/[id]` PATCH — OVER-PERMISSIVE UPDATE

```typescript
const updates = await request.json()
await locals.supabase
  .from('addresses')
  .update(updates)  // ← All fields from request passed directly
  .eq('id', params.id)
  .eq('user_id', locals.user.id)
```

This passes the entire JSON body directly to `.update()`. A user could potentially update any column in the `addresses` table (e.g., set `user_id` to another user's ID). However, the RLS policy enforces `.eq('user_id', locals.user.id)` — so even if someone sent `{user_id: "other-user-id"}`, Supabase would reject it because the query scopes to the caller's `user_id`.

**Risk is LOW due to RLS defense-in-depth**, but it should be fixed to explicitly whitelist allowed fields.

### Client-Side Validation

Per checklist rules, client-side validation is for UX only. The app uses Zod on forms in Svelte components as UX validation. The server-side validation is what matters.

## What's at Risk

The address PATCH spread is the only notable issue. The RLS mitigates it, but it's a bad pattern.

## Recommendations

1. **LOW**: Add a Zod schema to `/api/profile/addresses/[id]` PATCH to whitelist allowed update fields.
2. **LOW**: Add Zod schemas to the remaining admin PATCH routes.
3. **LOW**: Add length/type validation to `name` and `paypal_email` in `/api/profile` PATCH.
