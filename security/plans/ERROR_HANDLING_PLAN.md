# ERROR_HANDLING Fix Plan

## Status: Partially fixed — user-facing routes corrected; admin routes noted as LOW

## Changes Made

- `src/routes/api/profile/addresses/[id]/+server.ts` — Replaced `throw error(500, \`...: ${updateError.message}\`)` with generic `'Failed to update address'` (PATCH) and `'Failed to delete address'` (DELETE)
- `src/routes/api/orders/[id]/load-to-cart/+server.ts` — Replaced `err.message` exposure with generic `'Failed to merge order into cart'`

## Remaining LOW-Risk Items (Admin-Only)

These admin routes still expose `error.message` or `err.message`. Since they're admin-only, the risk is low, but they should be cleaned up:

| Route | Line | Current |
|-------|------|---------|
| `api/admin/pricing/+server.ts` | 37 | `throw error(500, dbError.message)` |
| `api/admin/pricing/+server.ts` | 58 | `throw error(500, upsertError.message)` |
| `api/admin/sets/[setCode]/cards/+server.ts` | 282 | `\`...: ${insertError.message}\`` |
| `api/admin/orders/[id]/group-buy/+server.ts` | 45 | `\`...: ${updateError.message}\`` |
| `api/admin/users/[id]/reset-password/+server.ts` | 65, 75 | `resetError.message`, `err.message` |
| `api/admin/inventory/sync/+server.ts` | 406 | `err.message` |
| `api/admin/inventory/resync-images/+server.ts` | 181 | `err.message` |
| `api/admin/exports/groupbuy/[id]/+server.ts` | 57 | `err.message` |
| `api/admin/exports/order/[id]/+server.ts` | 46 | `err.message` |

## Verification Goals

- [x] User-facing routes use generic error messages (FIXED — addresses and load-to-cart)
- [x] Internal error details logged server-side only (CONFIRMED — logger.error used before throw)
- [x] No stack traces in API responses (CONFIRMED — SvelteKit error() never includes stacks)
- [x] No SQL error codes in API responses (FIXED for user-facing routes)
- [ ] Admin routes also use generic messages (remaining LOW items)

## Manual Verification (for the human)

1. Trigger a DB error in the address update (e.g., send an invalid address ID)
2. Check the response body — should say `"Failed to update address"`, not the DB error
3. Check server logs — should show the full error details
