# ERROR_HANDLING Security Report

## Status: PARTIAL FAIL — Some routes expose internal error messages

## Findings

### Error Message Exposure

Several routes expose internal error messages directly to API callers:

**Admin-only routes (LOW risk — admin has elevated trust):**
- `api/admin/pricing/+server.ts:37` — `throw error(500, dbError.message)`
- `api/admin/pricing/+server.ts:58` — `throw error(500, upsertError.message)`
- `api/admin/sets/[setCode]/cards/+server.ts:282` — `throw error(500, \`...: ${insertError.message}\`)`
- `api/admin/orders/[id]/group-buy/+server.ts:45` — `throw error(500, \`...: ${updateError.message}\`)`
- `api/admin/users/[id]/reset-password/+server.ts:65` — `throw error(500, resetError.message || ...)`
- `api/admin/users/[id]/reset-password/+server.ts:75` — `throw error(500, err.message || ...)`
- `api/admin/inventory/sync/+server.ts:406` — `throw error(500, err instanceof Error ? err.message : ...)`
- `api/admin/inventory/resync-images/+server.ts:181` — `throw error(500, err instanceof Error ? err.message : ...)`

**Admin-export routes (LOW risk):**
- `api/admin/exports/groupbuy/[id]/+server.ts:57` — `throw error(500, \`...: ${(err as Error).message}\`)`
- `api/admin/exports/order/[id]/+server.ts:46` — `throw error(500, \`...: ${(err as Error).message}\`)`

**User-facing routes (MEDIUM risk — exposes internals to users):**
- `api/orders/[id]/load-to-cart/+server.ts:95` — `throw error(500, err instanceof Error ? err.message : 'Failed to merge...')`
- `api/profile/addresses/[id]/+server.ts:43` — `throw error(500, \`Failed to update address: ${updateError.message}\`)`
- `api/profile/addresses/[id]/+server.ts:74` — `throw error(500, \`Failed to delete address: ${deleteError.message}\`)`

### Error Messages That Could Leak Info

Database error messages can contain:
- SQL error codes (e.g., `ERROR: duplicate key value violates unique constraint "addresses_pkey"`)
- Table names, column names
- Data values that triggered the error
- PostgreSQL internals

### What's Good

The vast majority (>80%) of 500 errors use generic messages like:
- `'Failed to update order'`
- `'Failed to fetch cart'`
- `'Authentication required'`

These are safe — they don't expose internals.

### Logger Usage

Errors are logged via `logger.error({ error: err }, '...')` before throwing the generic message in most places. This is the correct pattern: log details server-side, return generic messages to clients.

## What's at Risk

The user-facing address PATCH/DELETE errors can expose Supabase error messages to users. This includes potential database schema information.

## Recommendations

1. **MEDIUM**: Fix user-facing routes to use generic error messages (3 routes)
2. **LOW**: Fix admin routes that expose error.message (acceptable risk since admin-only)
