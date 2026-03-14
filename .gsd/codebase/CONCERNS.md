# CONCERNS.md — Technical Debt & Issues

## Critical (Fix Before Launch / Next Phase)

### 1. Open Redirect Vulnerability in Auth Callback

- **File:** `src/routes/auth/callback/+server.ts` Lines 8, 39
- **Issue:** `next` query parameter used directly in redirect without validation or sanitization
- **Risk:** Phishing / open redirect abuse — attacker crafts `/auth/callback?next=https://evil.com`
- **Fix:** Validate `next` is a same-origin relative path before redirecting:
  ```typescript
  const next = url.searchParams.get('next') ?? '/'
  const safeNext = next.startsWith('/') && !next.startsWith('//') ? next : '/'
  throw redirect(303, safeNext)
  ```

### 2. Client-Controlled Order Pricing

- **File:** `src/routes/api/orders/+server.ts` Lines 16, 307, 385
- **Issue:** `unitPrice` accepted from request payload and persisted as `unit_price` for both create and merge paths
- **Risk:** Underpayment if client payload is manipulated (e.g. price set to $0.00)
- **Fix:** Look up authoritative price from DB/config at order creation time; never trust client-supplied price

### 3. Cleanup Endpoint Allows Unauthenticated Access

- **File:** `src/routes/api/admin/exports/cleanup/+server.ts` Lines 6, 8
- **Issue:** Endpoint explicitly skips auth when `CRON_SECRET` env variable is absent (fail-open behavior)
- **Risk:** Unauthorized cleanup execution in misconfigured environments
- **Fix:** Fail closed — require `CRON_SECRET` to be set, throw 500/503 on startup or 401 on request if absent

### 4. Service-Role Client Exposed in Public Search Endpoint

- **File:** `src/routes/api/import/search/+server.ts` Lines 65, 72
- **Issue:** Public (unauthenticated) POST endpoint uses admin service-role Supabase client, bypassing RLS
- **Risk:** Expanded attack surface — any RLS configuration errors in `cards` table become exploitable by anonymous traffic
- **Fix:** Use the user or anon Supabase client for public read operations; only use service-role client in admin/server-only flows

---

## Moderate

### 5. Admin Authorization Logic Duplicated Across ~12 Endpoints

- **Pattern:** `verifyAdmin` / `requireAdmin` called inline in each admin route
- **Evidence:** `src/routes/api/admin/orders/[id]/+server.ts:13`, `src/routes/api/admin/users/[id]/+server.ts:6`, `src/routes/api/admin/inventory/sync/+server.ts:118`
- **Risk:** Inconsistency drift — one route forgets the check; security audit difficulty
- **Fix:** Centralize in `+layout.server.ts` for the admin route group (already exists, verify all admin API routes also call it)

### 6. "Ensure Users Row" Logic Duplicated

- **Evidence:** `src/routes/api/orders/+server.ts:186,196`, `src/routes/api/profile/addresses/+server.ts:21,31`
- **Fix:** Extract into `src/lib/server/user-profile.ts` utility

### 7. N+1 DB Write Loops

- **Files:**
  - `src/routes/api/orders/+server.ts:391` — order merge updates items one-by-one
  - `src/routes/api/orders/[id]/pending/+server.ts:79,89` — pending→cart merge per item
  - `src/routes/api/admin/pricing/+server.ts:85,89` — pricing backfill per row
  - `src/lib/server/cart-service.ts:888,900` — identity merge per order item
- **Impact:** Slow for large orders; adds DB round trips proportional to item count
- **Fix:** Use Supabase `upsert([...])` with arrays, or batch with `in()` filters

### 8. Hardcoded Admin Discord IDs

- **File:** `src/lib/admin-shared.ts:5`
- **Issue:** Admin identity tied to code deployment, not runtime config or DB
- **Risk:** Governance/ops — adding/removing admins requires code deploy
- **Fix:** Move to `group_buy_config` table or environment variable

### 9. Import Search Silently Swallows Query Errors

- **File:** `src/routes/api/import/search/+server.ts:116,124,132`
- **Issue:** Queries destructure only `data`, discarding `error`
- **Fix:** Check `error` from each query and log/handle appropriately

### 10. Export Manifest Read-Modify-Write Race Condition

- **File:** `src/lib/server/export-storage.ts:30,45,59,60`
- **Issue:** Manifest file is read, modified, and written back without any locking
- **Risk:** Two concurrent export operations could overwrite each other's manifest entries
- **Fix:** Use atomic write or mutex; OK to defer if concurrent exports are rate-limited elsewhere

---

## Minor

### 11. TODO Comments in Tests

- `src/routes/api/admin/exports/__tests__/exports.test.ts:381,389`
- Planned assertions not yet written for exported file content validation

### 12. Inconsistent Response Field Naming

- **File:** `src/routes/api/cart/merge/+server.ts:35,42,114`
- Mixed `snake_case` and `camelCase` in merge API response objects
- **Fix:** Standardize on camelCase for JSON API responses

### 13. Potentially Dead Code

- `updateNotificationStatus` defined in `src/lib/server/notifications/service.ts:115` with no callers found
- Verify + remove if unused

### 14. Import Alias Inconsistency

- Some files use `$components/...`, others use `$lib/components/...`
- Prefer `$components` (the registered alias); standardize gradually

### 15. `console.error` Used Instead of Structured Logger

- Structured logger exists at `src/lib/server/logger.ts`
- Many server files use raw `console.error(...)` instead
- Fix: migrate to `logger.error(...)` for consistent log output

---

## Performance

### Sequential Image Resync

- **File:** `src/routes/api/admin/inventory/resync-images/+server.ts:102,164`
- Images resynced sequentially with rate limiting delays
- Fine for small catalogs; becomes slow for bulk operations

### Export File Path Assumptions

- **File:** `src/lib/server/export-storage.ts:6,7`
- Hardcoded `/tmp/` paths — fine for Vercel but fragile for other runtimes
- If ever running outside Vercel, path needs reconfiguration

---

## Type Safety Gaps

### High Volume of `any` Casts (~137 occurrences including tests)

Key runtime hotspots:

- `src/routes/api/orders/+server.ts:216`
- `src/lib/server/cart-service.ts:148`
- `src/routes/api/import/search/+server.ts:148`
- `src/routes/admin/users/+page.svelte:26`

### `@ts-ignore` Markers Indicating Schema Drift

- `src/routes/api/orders/+server.ts:154,287`
- `src/routes/profile/+page.svelte:41`
- **Cause:** Generated `database.types.ts` is behind current schema
- **Fix:** Run `npm run db:generate` and resolve type mismatches

---

## Missing / Incomplete Features

### Checkout Session APIs (Unintegrated)

- Methods exist in `src/lib/server/cart-service.ts:721,773,810` but no callers found in routes

### PayPal Integration

- Credentials in `.env.example` (`PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET`, `PAYPAL_MODE`)
- No implementation in source code

### Email Integration

- `RESEND_API_KEY` in `.env.example`
- No Resend implementation in source; only Discord notifications exist

### `qty_adjusted` Pipeline

- Merge report structures include `qty_adjusted` collection but current code paths don't appear to populate it

---

## Refactor Priority Order

1. **P0 (Security):** Open redirect (#1), client price (#2), cleanup auth (#3), public service-role (#4)
2. **P1 (Correctness):** N+1 writes (#7), manifest race (#10), error silencing (#9)
3. **P2 (Maintainability):** Admin auth consolidation (#5), duplicate user-row logic (#6), type debt (#`any`, `@ts-ignore`)
4. **P3 (Hygiene):** Dead code (#13), alias consistency (#14), structured logging (#15)
