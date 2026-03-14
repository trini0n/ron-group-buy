# Plan 02-03 Summary: Extract ensureUserRow Shared Utility

## Status: Complete

## What Changed

### New: `src/lib/server/user-profile.ts`
Created with exported `ensureUserRow(supabase, user)`:
- Checks if the user's row exists in `public.users`
- If missing (PGRST116 / no data): uses `createAdminClient()` to bypass RLS and insert the row
- If other DB error: throws 500 "Failed to verify user account"
- On create error: throws 500 "User account sync failed"

### `src/routes/api/orders/+server.ts`
- Added import: `import { ensureUserRow } from '$lib/server/user-profile'`
- Replaced ~35-line inline check+create block with: `await ensureUserRow(locals.supabase, locals.user)`

### `src/routes/api/profile/addresses/+server.ts`
- Added import: `import { ensureUserRow } from '$lib/server/user-profile'`
- Replaced identical ~35-line inline check+create block with: `await ensureUserRow(locals.supabase, locals.user)`

## Why
The duplicate "auto-create users row" fallback was copy-pasted exactly. Any future change (new field, different error message, logging improvement) would need to be made in both places. Now there's a single source of truth.

## Commit
`307f86f` — refactor(correctness): extract ensureUserRow shared utility
