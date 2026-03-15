# Plan 01-03 Summary: Fail-Closed Cleanup Auth + Service-Role Search Fix

## Status: Complete

## What Changed

### `src/routes/api/admin/exports/cleanup/+server.ts`

**Before (fail-open):** If `CRON_SECRET` was absent, the endpoint executed unauthenticated.

**After (fail-closed):**

```typescript
const cronSecret = process.env.CRON_SECRET?.trim()
if (!cronSecret) {
  throw error(503, 'CRON_SECRET not configured')
}
const authHeader = request.headers.get('authorization')
if (authHeader !== `Bearer ${cronSecret}`) {
  throw error(401, 'Unauthorized')
}
```

- Missing `CRON_SECRET` → 503 before any auth check
- Wrong/absent Bearer token → 401
- No code path bypasses both checks

### `src/routes/api/import/search/+server.ts`

**Before:** Used `createAdminClient()` (service-role, bypasses RLS) for all card queries.

**After:** Uses `locals.supabase` (request-scoped anon/user client).

Changes:

- Removed `createAdminClient` import
- Added `locals` to POST handler destructuring: `async ({ request, locals })`
- `const supabase = locals.supabase` replaces `const adminClient = createAdminClient()`
- Helper function signatures changed from `ReturnType<typeof createAdminClient>` to `SupabaseClient` (imported from `@supabase/supabase-js`)

## Why Service-Role Was Safe to Remove

The `cards` table has a public SELECT policy (`USING (true)`), so the anon client has identical read access for this endpoint's queries. Service-role was unnecessary and increased attack surface.

## Commit

`bbe320a` — fix(security): fail-closed cron auth and remove service-role in import search
