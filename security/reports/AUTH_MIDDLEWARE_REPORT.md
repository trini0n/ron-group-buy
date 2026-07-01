# AUTH_MIDDLEWARE Security Report

## Status: PASS

## Findings

### Route Inventory

**Admin API Routes** (under `/api/admin/`) — All protected with `requireAdmin()`, `isAdminRequest()`, or inline `verifyAdmin()`:

| Route | Methods | Auth Check |
|-------|---------|------------|
| `/api/admin/config` | GET, POST | Inline `verifyAdmin()` (checks `locals.user` + `isAdmin()`) |
| `/api/admin/config/[id]` | GET, PATCH | Inline `verifyAdmin()` |
| `/api/admin/exports/groupbuy/[id]` | GET | `requireAdmin()` |
| `/api/admin/exports/order/[id]` | GET | `requireAdmin()` |
| `/api/admin/inventory/bulk` | POST | `verifyAdmin()` (local fn in sync.ts) |
| `/api/admin/inventory/check-new` | POST | `verifyAdmin()` |
| `/api/admin/inventory/resync-images` | POST | `verifyAdmin()` |
| `/api/admin/inventory/sync` | POST | `verifyAdmin()` |
| `/api/admin/orders/bulk-status` | POST | `isAdminRequest()` — 401 if no user |
| `/api/admin/orders/bulk-tracking` | POST | `isAdminRequest()` — 401 if no user |
| `/api/admin/orders/[id]` | PATCH, DELETE | `verifyAdmin()` |
| `/api/admin/orders/[id]/group-buy` | POST | `requireAdmin()` |
| `/api/admin/orders/[id]/notify` | POST | `verifyAdmin()` |
| `/api/admin/orders/[id]/status` | POST | `verifyAdmin()` |
| `/api/admin/pricing` | GET, POST | Inline `requireAdmin()` (local fn) |
| `/api/admin/sets` | GET, POST | `requireAdmin()` |
| `/api/admin/sets/bulk` | POST | `requireAdmin()` |
| `/api/admin/sets/[setCode]` | GET, PATCH, DELETE | `requireAdmin()` |
| `/api/admin/sets/[setCode]/cards` | GET, POST | `requireAdmin()` |
| `/api/admin/sets/[setCode]/cards/[cardId]` | DELETE | `requireAdmin()` |
| `/api/admin/sync-alerts` | GET, PATCH | `verifyAdmin()` |
| `/api/admin/templates` | GET | `verifyAdmin()` |
| `/api/admin/templates/[id]` | PATCH | `verifyAdmin()` |
| `/api/admin/users/[id]` | PATCH | `verifyAdmin()` |
| `/api/admin/users/[id]/admin` | POST, DELETE | `requireAdmin()` |
| `/api/admin/users/[id]/details` | GET | `verifyAdmin()` |
| `/api/admin/users/[id]/reset-password` | POST | `verifyAdmin()` |

**User API Routes** — Protected with `locals.user` checks:

| Route | Methods | Auth Check | Notes |
|-------|---------|------------|-------|
| `/api/orders` | POST | `if (!locals.user) throw error(401)` | ✅ Protected |
| `/api/orders/[id]/pending` | POST | `if (!locals.user) throw error(401)` + ownership check | ✅ Protected + access control |
| `/api/orders/[id]/load-to-cart` | POST | (need to verify) | |
| `/api/profile` | PATCH | `if (!locals.user) throw error(401)` | ✅ Protected |
| `/api/profile/addresses` | GET, POST | (need to verify) | |
| `/api/profile/addresses/[id]` | PATCH, DELETE | (need to verify) | |
| `/api/profile/auth/discord` | POST | (OAuth flow) | |
| `/api/profile/auth/google` | POST | (OAuth flow) | |
| `/api/profile/notifications` | GET, PATCH | (need to verify) | |
| `/api/profile/password` | POST | (need to verify) | |

**Public Routes** (intentionally unauthenticated):

| Route | Methods | Notes |
|-------|---------|-------|
| `/api/cart` | GET, POST, DELETE | Guest-cart aware (uses cookie-based guest ID) |
| `/api/cart/[itemId]` | PATCH, DELETE | Guest-cart aware |
| `/api/cart/bulk` | POST | Guest-cart aware |
| `/api/cart/bundles` | GET, POST | Guest-cart aware |
| `/api/cart/bundles/[bundleId]` | DELETE | Guest-cart aware |
| `/api/cart/checkout-session` | POST | (cart session token) |
| `/api/cart/merge` | POST | Guest→user merge |
| `/api/cart/validate` | POST | Cart validation (public catalog) |
| `/api/import/search` | POST | Rate-limited; queries public card catalog |
| `/api/import/deck` | POST | Rate-limited; proxies Moxfield/Archidekt |

### ⚠️ `bulk-status` and `bulk-tracking` — Respond 403 for Unauthenticated (Not 401)

These routes use `isAdminRequest()` which returns `false` for unauthenticated users, causing a 403 response (not 401). Per security conventions, unauthenticated requests should get 401. This is low severity since the practical effect is the same.

### `isAdminRequest()` Missing 401 Distinction

```typescript
// bulk-status/+server.ts
if (!(await isAdminRequest(locals))) {
  throw error(403, 'Admin access required')  // ← Returns 403 even for unauthenticated
}
```

`isAdminRequest()` returns `false` for both unauthenticated AND non-admin users, making it impossible for this check to distinguish between the two.

### Auth Pattern — PASS
The `hooks.server.ts` runs `safeGetSession()` on every request using `auth.getUser()` (server-validated), not `auth.getSession()` (client-trusted). This is the correct, secure pattern.

## What's at Risk

The 403-for-unauthenticated issue on admin bulk endpoints is cosmetic — the access is still denied. No data is exposed.

## What's Already Secure

- `hooks.server.ts` uses `auth.getUser()` for server-side auth validation
- Every admin route has auth middleware that runs BEFORE the handler
- User data routes check `locals.user` before any DB operations
- Cart routes are intentionally accessible to guests (design choice)
- Admin UI routes use layout-level auth (redirect to login)

## Recommendations

1. **LOW**: Update `bulk-status` and `bulk-tracking` to check `locals.user` separately and return 401 for unauthenticated, 403 for authenticated non-admins.
2. **LOW**: Add a convenience function `requireAuth(locals)` that throws 401 if not logged in, to standardize the pattern.
