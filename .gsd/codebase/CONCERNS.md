# Codebase Concerns

**Analysis Date:** 2026-03-14

> **Audit note — resolved since last review:** Open redirect in `auth/callback` (validated), client-supplied unit prices replaced with server-side DB lookup in orders API, cleanup cron endpoint now fails-closed (503), public import/search endpoint switched from service-role to anon client, import search query errors no longer silently swallowed, export manifest race condition resolved with in-process mutex (`export-storage.ts`).

---

## Tech Debt

**Schema drift: `phone_number` / `shipping_phone_number` not in generated types:**

- Issue: `database.types.ts` was generated before these columns were added; 6 `@ts-ignore` comments paper over the gap in `api/orders/+server.ts` and `profile/+page.svelte`, plus `(address as any).phone_number` casts in two components
- Files: `src/routes/api/orders/+server.ts` (lines 172, 176, 183, 204, 266), `src/routes/profile/+page.svelte` (lines 42, 660–661), `src/routes/orders/[id]/+page.svelte` (line 207)
- Impact: Type errors silently bypassed; future refactors won't catch misuse statically
- Fix approach: Run `npm run db:generate` against the live schema; remove all `@ts-ignore` markers once types are regenerated

**`supabase as any` cast in pricing and admin-pricing routes:**

- Issue: `fetchPrices` in `src/lib/server/pricing.ts:26` casts `supabase` to `any` because `card_type_pricing` is absent from generated types; same cast in `src/routes/admin/settings/pricing/+page.server.ts:17`
- Files: `src/lib/server/pricing.ts`, `src/routes/admin/settings/pricing/+page.server.ts`
- Impact: Pricing queries have no compile-time type safety; `data` comes back as `any[]`
- Fix approach: Regenerate types (same root cause as above); remove casts

**`checkForNewProviderConflict` typed as `supabase: any`:**

- Issue: Helper function in `src/routes/auth/callback/+server.ts` (lines 53, 114) accepts `supabase: any` instead of a typed `SupabaseClient`, bypassing type checking on all DB calls inside it
- Files: `src/routes/auth/callback/+server.ts`
- Impact: Auth callback DB calls are invisible to the compiler
- Fix approach: Replace `any` with `SupabaseClient<Database>`

**Unbounded in-memory deck cache (Map with no size limit):**

- Issue: `src/routes/api/import/deck/+server.ts` implements a plain `Map<string, {data, timestamp}>` for deck cache. Entries are only evicted on access (TTL check at read time); if unique deck IDs are requested and never re-requested, the Map grows without bound across the process lifetime
- Files: `src/routes/api/import/deck/+server.ts` (lines 68–80)
- Impact: Memory leak under sustained load with many unique deck IDs; could force process restart
- Fix approach: Replace `Map` + manual TTL with `LRUCache` (already used for card search cache in `api/import/search/+server.ts`)

**No Zod/schema validation on POST request bodies:**

- Issue: All API route handlers call `await request.json()` and destructure fields directly without schema validation; e.g. `api/orders/+server.ts`, `api/cart/+server.ts`, `api/admin/inventory/resync-images/+server.ts`
- Files: `src/routes/api/orders/+server.ts`, `src/routes/api/cart/+server.ts`, `src/routes/api/admin/**`
- Impact: Malformed payloads cause runtime errors rather than clean 400 responses; missing fields silently become `undefined`
- Fix approach: Add Zod schemas at each API boundary; `zod` is already a declared dependency

**Hardcoded admin Discord IDs in client-accessible file:**

- Issue: `ADMIN_DISCORD_IDS` in `src/lib/admin-shared.ts:5` hardcodes two Discord IDs; this file has no `server` qualifier so it is importable from client-side code
- Files: `src/lib/admin-shared.ts`
- Impact: Changing admin roster requires a code deploy; actual Discord IDs are embedded in the shipped JS bundle
- Fix approach: Move super-admin IDs to an environment variable (`ADMIN_DISCORD_IDS=id1,id2`) read only in `src/lib/server/admin.ts`; keep `admin-shared.ts` for UI display constants only

**Duplicate `AdminClient` creation per `isAdmin()` call:**

- Issue: `isAdmin()` in `src/lib/server/admin.ts:38` calls `createAdminClient()` unconditionally; `isAdminRequest()` at line 60 also calls `createAdminClient()` before delegating to `isAdmin()` — 2 service-role clients per admin check; admin layout load creates a third via its own call
- Files: `src/lib/server/admin.ts`, `src/routes/admin/+layout.server.ts`
- Impact: Excess Supabase connection overhead on every admin page load
- Fix approach: Accept an optional `adminClient` parameter in `isAdmin()`; pass through from callers that already hold one

**`console.log` debug artifacts in server code:**

- Issue: Two `console.log` calls with emoji strings remain in production server code (`✅ Cache hit` and `💾 Cached conversion`) in `src/lib/server/gphoto-converter.ts`
- Files: `src/lib/server/gphoto-converter.ts` (lines 41, 94)
- Impact: Noise in production logs; inconsistent with structured logger pattern used elsewhere
- Fix approach: Replace with `logger.debug(...)` calls

---

## Known Bugs

**Svelte 5 reactivity: `selectedCard` in `CardItem.svelte` won't update when `card` prop changes:**

- Symptoms: When a card's data is updated externally (e.g. stock status change during SPA navigation), the `selectedCard` state retains its initial render value
- Files: `src/lib/components/cards/CardItem.svelte` (line 23) — `let selectedCard = $state<Card>(card)`
- Trigger: Any re-render where the parent passes a different `card` object; confirmed by `svelte-check` warning `state_referenced_locally`
- Workaround: None currently; stale card state requires full page reload

**Svelte 5 reactivity: `prevFilters` in main page captures initial filter values only:**

- Symptoms: Filter-change detection logic uses stale initial values; URL sync for filter state may fail to detect changes correctly after first load
- Files: `src/routes/+page.svelte` (lines 57–65) — 8 `state_referenced_locally` warnings in `svelte-check-output.txt`
- Trigger: Applying any filter after the page has already initialized with default filter values
- Workaround: Replace `$state({...filters...})` initialization with a `$derived` expression

**TypeScript compile error in notification settings page:**

- Symptoms: `svelte-check` reports: `Argument of type '{ is_active: boolean | null; ... }' is not assignable to parameter of type 'NotificationTemplate'` — `is_active` is `boolean | null` in DB types but `NotificationTemplate` demands `boolean`
- Files: `src/routes/admin/settings/notifications/+page.svelte` (line 174)
- Trigger: Clicking Edit on any notification template that has `is_active = null` in the database
- Workaround: Coerce with `{ ...template, is_active: template.is_active ?? false }` before passing to dialog; or update `NotificationTemplate` interface to accept `boolean | null`

---

## Security Considerations

**Hardcoded admin IDs in client bundle:**

- Risk: Actual Discord IDs of administrators are shipped in client-side JS (imported from `admin-shared.ts` which has no server restriction)
- Files: `src/lib/admin-shared.ts`
- Current mitigation: IDs alone cannot grant access without server-side `isAdmin()` verification; RLS and `requireAdmin()` protect data
- Recommendations: Move to server-only env variable to avoid exposing identity data to all visitors

**Phone number stored without server-side format validation:**

- Risk: Phone numbers accepted as free-text strings; no E.164 normalization or length/format validation server-side; malformed entries could affect order processing or contact attempts
- Files: `src/routes/api/orders/+server.ts` (line 54), `src/lib/components/`
- Current mitigation: `country-telephone-data` package used client-side for dial code selection; `String().trim()` applied server-side
- Recommendations: Add server-side regex or libphonenumber validation at API boundary

**Admin route protection relies on Discord ID from `users` table:**

- Risk: Email-only accounts have no `discord_id`; a hardcoded super-admin who signs in via Google/email would fail `isAdmin()` since `users.discord_id` is null — potential lockout
- Files: `src/lib/server/admin.ts` (line 37), `src/routes/admin/+layout.server.ts` (line 23)
- Current mitigation: Hardcoded Discord ID check allows Discord-linked admins through without DB entry
- Recommendations: Add an emergency fallback by Supabase user UUID or email for accounts that can't link Discord

**SSRF potential in Google Photos URL conversion:**

- Risk: `getDirectPhotoUrl()` fetches URLs that originate from DB records; if a `ron_image_url` column is ever written with a crafted URL, the `photos.app.goo.gl` short-link prefix is allowed — short-links can redirect to arbitrary hosts
- Files: `src/lib/server/gphoto-converter.ts` (lines 19–57)
- Current mitigation: URL prefix allow-list (`photos.google.com/share`, `photos.app.goo.gl`) at lines 23–27; `User-Agent` header set
- Recommendations: Validate the final resolved hostname of the `fetch` response is `lh3.googleusercontent.com`

---

## Performance Bottlenecks

**Order merge: N parallel individual `update` calls instead of batch:**

- Problem: `mergeIntoExistingOrder` at `src/routes/api/orders/+server.ts:390` issues one `UPDATE` per order item (via `Promise.all`); still N network round-trips to Supabase even though concurrent
- Files: `src/routes/api/orders/+server.ts` (lines 388–396)
- Cause: Supabase JS client lacks a native batch-update-by-ID; items have different row IDs and different quantity values
- Improvement path: Use a Postgres `rpc()` function that accepts an array of `(id, quantity)` tuples; or restructure to upsert on a composite unique key

**Sequential image resync with per-request delays:**

- Problem: `api/admin/inventory/resync-images/+server.ts` converts URLs one by one with `await delay()` between each; 50-card batch takes ≥50 × delay ms
- Files: `src/routes/api/admin/inventory/resync-images/+server.ts` (lines 99, 161)
- Cause: Rate-limit avoidance against Google Photos scraping
- Improvement path: Most conversions hit the DB cache; parallel fetching with a concurrency limit of 3–5 (semaphore) would be faster than strictly sequential

**Layout load executes two DB queries for all unauthenticated visitors:**

- Problem: `src/routes/+layout.server.ts` always fetches `group_buy_config` and calls `fetchPrices()` regardless of auth state; 2 extra DB round-trips on every unauthenticated page load
- Files: `src/routes/+layout.server.ts` (lines 6–29)
- Cause: Prices and config fetched unconditionally to populate the layout
- Improvement path: Gate `fetchPrices()` behind `if (locals.user)` for routes where pricing is only needed by authenticated users

---

## Fragile Areas

**Google Photos URL extraction via HTML scraping:**

- Files: `src/lib/server/gphoto-converter.ts` (lines 62–80)
- Why fragile: Parses `lh3.googleusercontent.com` URLs from raw HTML using a regex; Google can change page structure without notice, breaking all unconverted image imports
- Safe modification: Always test after any Google Photos navigation change; DB cache (30-day TTL) masks failures until entries expire
- Test coverage: No unit tests for `getDirectPhotoUrl`

**`generateOrderNumber()` collision probability:**

- Files: `src/routes/api/orders/+server.ts` (lines 8–12)
- Why fragile: Order numbers built from `Date.now().toString(36)` + 4 random base-36 chars; at millisecond resolution with concurrent requests, timestamp portion can repeat; relies on ~1.6M random combinations for uniqueness; no visible DB `UNIQUE` constraint enforcement in code
- Safe modification: Add a `UNIQUE` constraint on `orders.order_number` in DB and handle the rare conflict with a retry
- Test coverage: Not tested

**Cart version optimistic concurrency check at application layer:**

- Files: `src/lib/server/cart-service.ts` (lines ~337–345), `src/routes/api/cart/+server.ts`
- Why fragile: Version check performed in application code; a brief race window exists where two concurrent add-to-cart requests could both pass the version check before either writes
- Safe modification: Move version increment to a Postgres function or use row-level locking
- Test coverage: Mock-based unit tests only; no concurrent load testing

---

## Scaling Limits

**LRU card search cache is per-process (not shared):**

- Current capacity: 10,000 entries, 5-minute TTL (per `lru-cache` config in `api/import/search/+server.ts:44`)
- Limit: On Vercel serverless, each function instance has its own cache; under high concurrency with many short-lived instances the cache hit rate approaches 0, causing a DB query for every import card lookup
- Scaling path: Migrate card name lookup cache to a shared Redis/Upstash store or use Supabase edge caching

**Export files in `/tmp/exports`:**

- Current capacity: Vercel ephemeral `/tmp` filesystem (512 MB limit per function)
- Limit: Multiple concurrent large exports could exhaust `/tmp`; ephemeral storage lost on function restart so exports are not durable across restarts
- Scaling path: Move export files to Supabase Storage or an S3-compatible bucket; update path config in `src/lib/server/export-storage.ts`

**In-memory deck import cache (unbounded `Map`):**

- Current capacity: Unlimited (plain `Map` with TTL-on-read, no eviction for entries never re-accessed)
- Limit: Grows without bound if many unique deck IDs are imported in non-overlapping sessions
- Scaling path: Replace with `LRUCache` with a `max` of ~500 entries, same pattern already in `api/import/search/+server.ts`

---

## Dependencies at Risk

**`lucide-svelte` and `@lucide/svelte` both listed as devDependencies:**

- Risk: Two icon packages included simultaneously (`lucide-svelte: ^0.468.0` and `@lucide/svelte: ^0.482.0`); different versions with slightly different APIs
- Impact: Bundle size bloat; potential rendering inconsistency; upgrade path applies to two packages
- Migration plan: Audit all icon imports; standardize on `@lucide/svelte` (current package name); remove `lucide-svelte`

**`@supabase/ssr: ^0.5.2` — pre-1.0 with caret range:**

- Risk: `@supabase/ssr` is still pre-1.0; breaking changes between minor versions are possible; `^0.5.2` allows auto-upgrade to `0.6.x`
- Impact: `createServerClient` / `createBrowserClient` API changes could break auth silently on `npm install`
- Migration plan: Pin to exact version until `@supabase/ssr` reaches 1.0; run `npm outdated` before each deploy

---

## Missing Critical Features

**PayPal payment processing not implemented:**

- Problem: Checkout collects PayPal email address but no actual payment capture, webhook verification, or transaction confirmation exists; `PAYPAL_CLIENT_ID` / `PAYPAL_CLIENT_SECRET` / `PAYPAL_MODE` in `.env.example` have no corresponding implementation
- Blocks: Orders can be placed without any payment verification; admin must manually confirm payment receipt out-of-band

**Email notifications not implemented:**

- Problem: `RESEND_API_KEY` exists in `.env.example`; only Discord DM notifications are implemented in `src/lib/server/notifications/`; users without Discord linked receive no order status updates
- Blocks: Email-only users never receive invoice, shipping, or delivery notifications

**Checkout session locking unintegrated:**

- Problem: `CartService` includes `createCheckoutSession()` (line 721) and `validateCheckoutSession()` (line 773) but no route calls these methods — the checkout page bypasses the session mechanism entirely
- Blocks: Cart contents could change between user beginning checkout and submitting order; no lock prevents concurrent modification

---

## Test Coverage Gaps

**Auth flow routes:**

- What's not tested: `src/routes/auth/callback/+server.ts`, login, reset-password routes — OAuth exchange, conflict detection, sync-user-data path
- Files: `src/routes/auth/**`
- Risk: Regressions in login, OAuth exchange, or conflict handling go undetected
- Priority: High

**Order creation and merge flow:**

- What's not tested: Full POST to `src/routes/api/orders/+server.ts` — create, merge, replace paths; price resolution from DB; address validation
- Files: `src/routes/api/orders/+server.ts`
- Risk: Core business logic with no automated checks; price or address bugs reach production undetected
- Priority: High

**Admin route protection:**

- What's not tested: Admin layout guard (`src/routes/admin/+layout.server.ts`), `requireAdmin()` in API routes, `isAdmin()` DB fallback path
- Files: `src/lib/server/admin.ts`, `src/routes/admin/+layout.server.ts`
- Risk: Authorization bypass regressions not caught; hardcoded ID list changes not validated
- Priority: High

**Checkout page client-side validation:**

- What's not tested: `src/routes/checkout/+page.svelte` — form validation, address selection, phone/Discord username enforcement
- Files: `src/routes/checkout/+page.svelte`
- Risk: Client-side validation regressions (e.g. Discord username requirement) could allow malformed order submissions
- Priority: Medium

**Notification service:**

- What's not tested: `src/lib/server/notifications/service.ts` — `send()`, preference gating, `getActiveGroupBuyName()` fallback logic
- Files: `src/lib/server/notifications/service.ts`
- Risk: Notification delivery failures or template variable substitution errors not caught until production
- Priority: Medium

**Google Photos URL converter:**

- What's not tested: `src/lib/server/gphoto-converter.ts` — `getDirectPhotoUrl()`, cache hit/miss paths, URL normalization, size-suffix stripping
- Files: `src/lib/server/gphoto-converter.ts`
- Risk: Fragile HTML parsing; a Google Photos structure change would go undetected and silently corrupt stored image URLs
- Priority: Medium

---

_Concerns audit: 2026-03-14_
