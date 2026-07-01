# ACCESS_CONTROL Security Report

## Status: PASS

## Findings

All routes that accept resource IDs enforce ownership verification.

### Routes with Resource IDs

| Route | Method | Ownership Check | Pattern |
|-------|--------|----------------|---------|
| `/api/orders/[id]/pending` | POST | `order.user_id !== locals.user.id → 403` | Explicit check after fetch |
| `/api/orders/[id]/load-to-cart` | POST | `order.user_id !== locals.user.id → 403` | Explicit check after fetch |
| `/api/orders` (new order) | POST | Address ownership: `.eq('user_id', locals.user.id)` | DB-level query filter |
| `/api/profile/addresses/[id]` | PATCH | `.eq('id', params.id).eq('user_id', locals.user.id)` | DB-level filter (no match = null) |
| `/api/profile/addresses/[id]` | DELETE | `.eq('id', params.id).eq('user_id', locals.user.id)` | DB-level filter |
| `/api/cart/[itemId]` | PATCH, DELETE | via `CartService.getUserCart(locals.user.id)` + item lookup | Cart ownership |
| `/api/cart/bundles/[bundleId]` | DELETE | via cart ownership chain | Cart ownership |

### Admin Routes with Resource IDs — Intentionally Skip Ownership Check

Admin routes like `/api/admin/orders/[id]` are intentionally unrestricted for admins. This is correct — admins need to operate on any user's data.

### Supabase RLS as Defense in Depth

Even if application-level ownership checks were missing, Supabase RLS provides a second layer:
- `addresses` policies enforce `user_id = (SELECT auth.uid())` on UPDATE and DELETE
- `orders` policies enforce `user_id = (SELECT auth.uid())` on SELECT
- `order_items` only accessible through orders the user owns

### Address PATCH — No Explicit Ownership Fetch, But Safe

```typescript
// api/profile/addresses/[id]/+server.ts
await locals.supabase
  .from('addresses')
  .update(updates)
  .eq('id', params.id)
  .eq('user_id', locals.user.id)  // ← Ownership enforced at query level
  .select()
  .single()
```

If the address belongs to another user, `user_id` won't match, and the query returns null. This is safe.

### Order Access in `POST /api/orders`

When using an existing `addressId`, the code queries with `.eq('user_id', locals.user.id)`:
```typescript
const { data: address } = await locals.supabase
  .from('addresses')
  .select('*')
  .eq('id', addressId)
  .eq('user_id', locals.user.id)  // ← Prevents cross-user address usage
  .single()
```

## What's at Risk

No ownership bypass found.

## What's Already Secure

- Order endpoints use explicit `user_id !== locals.user.id` checks returning 403
- Address endpoints enforce ownership in DB queries (double-checked by RLS)
- Cart endpoints route access through the user's own cart ID
- Admin endpoints bypass ownership deliberately (by design, gated by admin check)
- RLS provides defense-in-depth for all user data

## Recommendations

1. No immediate action required.
2. Consider adding integration tests that verify cross-user access returns 403 or empty.
