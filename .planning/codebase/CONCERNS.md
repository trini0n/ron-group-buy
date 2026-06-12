---
updated: 2026-06-11
focus: concerns, risks, technical debt
---

# CONCERNS.md — Known Issues, Risks & Technical Debt

## Overview

This document catalogues all known concerns, risks, and technical debt for the group-buy
SvelteKit/Supabase application as of 2026-06-11. Concerns are organized by severity.

**Summary counts:**
- 79 TypeScript/Svelte errors across 14 files (from `npm run check` output)
- 11 Svelte runes warnings in 3 files
- ~50 `as any` casts (type safety holes throughout production code)
- 0 E2E tests; no browser/integration test layer
- Coverage tracking limited to 5 source files only
- Phase 11 (Admin New Card Checker) requirements still show all unchecked in REQUIREMENTS.md

---

## Critical

### C-01 — 79 TypeScript Errors in `npm run check` (Build Integrity Risk)

**Files affected:** 14 files including production routes and lib modules
**Error type:** Predominantly `noUncheckedIndexedAccess` violations — array/regex captures not
guarded against `undefined` before use.

**Production-impacting errors (non-test):**

| File | Error |
|------|-------|
| `src/lib/utils.ts:256` | `string \| undefined` not assignable to `string` (regex capture groups) |
| `src/lib/deck-utils.ts:36` | `Object is possibly 'undefined'` — split result used unguarded |
| `src/lib/deck-utils.ts:79,80,93,94` | Regex capture groups used as `string` without guard |
| `src/lib/stores/cart.svelte.ts:176,248` | Array element via index possibly `undefined`, `.quantity` mutated directly |
| `src/routes/api/import/deck/+server.ts:224` | `JSON.parse(scriptMatch[1])` — capture group `string \| undefined` |
| `src/routes/card/[setCode]/.../+page.server.ts:58,66` | `card` possibly `undefined` — used without null check; could crash page load |
| `src/routes/import/+page.svelte` | Multiple `CardMatch \| undefined` passed as `CardMatch \| null` (11 errors) |
| `src/lib/components/cards/CardGrid.svelte:157` | `group.primary` assignment accepts `undefined` from `.find()` |
| `src/lib/components/cards/CardTableView.svelte` | Split result index `[0]` used without guard |
| `src/lib/server/card-identity.ts:164,213-215` | `kept` and `firstCard` possibly `undefined`, accessed directly |
| `src/lib/server/card-identity.ts:290` | Returns `undefined` where `null` expected |
| `src/routes/admin/settings/notifications/+page.svelte` | DB row `is_active: boolean \| null` not assignable to `boolean` in `NotificationTemplate` |

**Risk:** `noUncheckedIndexedAccess` is intentionally enabled in `tsconfig.json`. The card detail
page server crash is highest priority: `+page.server.ts:58` calls `card.card_name` without a
prior null check. If `findCardBySerial` returns `undefined` (card deleted/not found), the handler
throws an unhandled server error rather than a graceful 404.

---

### C-02 — `as any` Casts on RPC Function Names (Type-Unsafe DB Calls)

**Files:**
- `src/routes/api/orders/+server.ts:336` — `rpc('replace_order' as any, ...)`
- `src/routes/api/orders/+server.ts:364` — `rpc('create_order_with_items' as any, ...)`

**Risk:** The generated `database.types.ts` does not include these RPC functions, so their
parameter shapes are completely unchecked by TypeScript. A parameter rename or signature change
in the SQL migration would silently break order creation/replacement at runtime.

**Root cause:** The type file was not regenerated after adding the `20260323000000_atomic_order_functions.sql`
migration. Run `npm run db:generate` after any migration that adds or modifies functions.

---

### C-03 — Hardcoded Public Google Sheets URL in Source Code

**Files:**
- `src/routes/api/admin/inventory/sync/+server.ts:11`
- `src/routes/api/admin/inventory/resync-images/+server.ts:15`

Both files embed the full published Google Sheets CSV URL as a string literal.

**Risk:**
1. If the spreadsheet is re-published under a new URL, two files must be updated manually.
2. The spreadsheet ID is embedded in git history forever — cannot be rotated without rebase.
3. No env var override — local dev and production always hit the same live sheet.
4. If the sheet is ever made private, sync silently breaks with no graceful error.

**Fix:** Move to `GOOGLE_SHEETS_LIBRARY_URL` env var; document in `.env.example`.

---

### C-04 — No Rate Limiting on Public/Unauthenticated API Endpoints

**Endpoints with no auth and no rate limiting:**
- `POST /api/import/deck` — proxies requests to Moxfield and Archidekt APIs
- `POST /api/import/search` — runs Supabase queries for card name lookups

Both are callable by anyone without authentication. A client could spam them to drive up
Supabase read costs or cause third-party API bans.

The LRU cache (`max: 100` for decks) covers repeated identical requests but not novel deck IDs.

**Risk:** DoS amplification through Supabase reads and external API proxying with no throttle.

---

## High

### H-01 — `as any` Pattern Widespread in Production Code

**Count:** ~45 `as any` casts in non-test production files.

**Significant instances:**

| File | Context |
|------|---------|
| `src/routes/api/admin/pricing/+server.ts:32,54` | `(locals.supabase as any).from('card_type_pricing')` — table not in generated types |
| `src/routes/checkout/+page.svelte:81,93,122,131,178` | Multiple `data as any` casts to access fields not in page data types |
| `src/routes/admin/users/[id]/+page.svelte:36-38` | `(data.user as any).admin_notes`, `.is_blocked`, `.blocked_reason` |
| `src/routes/admin/users/+page.svelte:322` | `(user as any).is_blocked` |
| `src/routes/admin/orders/[id]/+page.svelte:591-592` | `(order as any).shipping_phone_number` |
| `src/lib/server/cart-service.ts:55` | `finish as any` for array includes check |
| `src/routes/api/import/search/+server.ts:129` | `allMatches[0] as any` loses match type |

**Root cause:** Database schema has evolved faster than `database.types.ts`. Fields added via
migrations (phone_number, is_blocked, blocked_reason, admin_notes, card_type_pricing) are not
in the generated types, so code uses `as any` workarounds.

**Fix:** Run `npm run db:generate` after every migration; add to PR checklist.

---

### H-02 — Svelte 5 Runes Misuse Warnings (State Reactivity Bugs)

**Files:** `src/routes/+page.svelte` (8 warnings), `src/lib/components/cards/CardItem.svelte`,
`src/routes/card/[setCode]/[collectorNum]/[slug]/+page.svelte`

**Warning type:** `state_referenced_locally` — using a reactive `$state` value inside another
`$state(...)` initializer captures only the initial snapshot, not a live reactive reference.

**Concrete bug:** In `+page.svelte`, `prevFilters` is initialized with
`$state({ setCodes: filters.setCodes.join(','), ... })`. If `filters` updates before `prevFilters`
is read, the stale snapshot causes incorrect change detection — the page may fail to re-fetch
results when filters reset or change programmatically.

**Fix:** Replace `$state({ ...filters.x... })` with `$derived({ ...filters.x... })` for snapshot
objects that should stay in sync with their sources.

---

### H-03 — Admin Authorization: Inconsistent Check Pattern

Three different patterns exist across admin API endpoints:

- **Pattern A** (most endpoints): Looks up `discord_id` from `users` then calls `isAdmin()` — 2 DB round-trips
- **Pattern B** (bulk-status, bulk-tracking): Uses `isAdminRequest(locals)` — 1 combined check
- **Pattern C** (`/api/admin/pricing`): Local `requireAdmin` — returns 403 (not 401) for unauthenticated users

**Risk:**
- Pattern C violates HTTP semantics (should be 401 for unauthenticated).
- Duplication means a future security change must be applied in multiple places.
- Pattern A is most common but is the least efficient (double DB hit).

**Fix:** Standardize all admin routes to `requireAdmin(locals)` from `$lib/server/admin`.

---

### H-04 — External API Fetches with No Timeout or Abort Signal

**File:** `src/routes/api/import/deck/+server.ts`

Moxfield fetch chain (v3 JSON → export endpoint → v2 JSON → plain-text parse) and the
Archidekt fetch have no `AbortController` or `signal` option. If Moxfield is slow, the entire
request handler hangs until Node's default socket timeout (potentially minutes).

**Risk:** Slow third-party responses block Vercel serverless function slots, consuming quota and
degrading the entire app for all users during high-traffic periods.

**Fix:** Wrap each external fetch with `AbortController` + `setTimeout` (e.g., 10s per attempt).

---

### H-05 — `import/+page.svelte` Is a 1,441-Line Monolith (55 KB)

The deck import page is a single Svelte component containing: deck URL input and parsing, card
search and result display, finish-variant carousel logic, cart-add flow, and all associated
TypeScript business logic.

This file contributes ~20 of the 79 TypeScript errors and all import-related Svelte warnings.

**Risk:** (a) Difficult to isolate bugs, (b) large client bundle chunk, (c) long compile times,
(d) high cognitive load for contributors.

**Fix:** Extract into sub-components: `DeckUrlInput`, `CardSearchResults`, `FinishCarousel`,
`ImportCartSummary`. Move shared parse logic into `deck-utils.ts`.

---

### H-06 — Phase 11 Requirements All Unchecked in REQUIREMENTS.md

`REQUIREMENTS.md` contains 15 requirements (INPUT-01..04, MATCH-01..04, OUTPUT-01..04, UX-01..03)
all marked `[ ]` (unchecked). STATE.md shows Phase 16 as complete. The `check-new` endpoint and
`CheckNewCardsModal.svelte` both exist in the codebase, suggesting Phase 11 was implemented but
requirements were never marked done.

**Risk:** Loss of traceability; unclear which requirements are satisfied vs. never built.

**Fix:** Audit Phase 11 deliverables against requirements and mark completed items `[x]`.

---

## Medium

### M-01 — Generated Types Not Regenerated After Every Migration

Several migrations added tables/columns not in `database.types.ts`:
- `card_type_pricing` (`20260310000000`) → worked around with `as any`
- `shipping_phone_number` (`20260225_add_phone_number`) → `as any`
- `admin_notes`, `is_blocked`, `blocked_reason` user fields → `as any`
- `is_misprint` column (`20260526000000`) → status unclear

**Fix:** Add `npm run db:generate` as a required post-migration step in the runbook.

---

### M-02 — Coverage Tracking Covers Only 5 Source Files

`vitest.config.ts` coverage `include` only tracks:
`utils.ts`, `admin-shared.ts`, `deck-utils.ts`, `cart-types.ts`, `search-utils.ts`

Critical modules with no tracked coverage:
- `src/lib/server/card-identity.ts` (deduplication logic — has tests but not tracked)
- `src/lib/server/cart-service.ts` (36 KB cart management)
- `src/lib/server/export-builder.ts` (order export XLS generation)
- `src/lib/server/notifications/service.ts` (notification dispatch)
- `src/routes/api/orders/+server.ts` (order creation/replacement — core business logic)

---

### M-03 — No E2E / Integration Tests

No Playwright or Cypress. All testing is unit-level via Vitest with jsdom.

Critical flows not tested at any integration level:
- Checkout (cart → address → order creation via `create_order_with_items` RPC)
- Deck import from URL → search → add to cart
- Admin inventory sync (Google Sheets → DB upsert)
- Authentication flow (OAuth → session → protected routes)

---

### M-04 — LRU Caches Are Process-Scoped (Not Distributed)

`CARD_CACHE` (10,000 entries) in `/api/import/search` and `deckCache` (100 entries) in
`/api/import/deck` are in-memory. On Vercel, each serverless invocation may be a separate
instance. Caches are not shared across instances and are wiped on cold starts.

**Risk:** Cache misses are more frequent than expected; cache invalidation (e.g., after a card
stock update) does not propagate across all running instances.

---

### M-05 — `console.log` Used in Server API Handlers

The project has a structured `logger` utility (`src/lib/server/logger.ts`) but these files
bypass it with raw `console.log`:
- `src/routes/api/admin/inventory/sync/+server.ts` — 10+ instances
- `src/routes/api/admin/inventory/resync-images/+server.ts` — 6 instances
- `src/routes/api/import/deck/+server.ts` — 3 instances

**Risk:** Inconsistent log format makes aggregation difficult; raw logs may leak internal paths.

---

### M-06 — Hardcoded `card_type` Strings Without Shared Enum

Card type strings (`'Normal'`, `'Holo'`, `'Foil'`, `'Galaxy Foil'`, `'Raised Foil'`,
`'Surge Foil'`, `'Serialized'`, `'Normal Misprint'`, `'Holo Misprint'`, `'Foil Misprint'`)
are repeated across `pricing.ts`, `cart-service.ts`, `sync/+server.ts`, and Svelte components.

There is no shared `CardType` enum or const union. A new card type addition requires
grep-and-replace across multiple files.

---

### M-07 — Deck Import Has No Authentication Requirement

`POST /api/import/deck` and `POST /api/import/search` require no `locals.user` session. Both
accept arbitrary input from any unauthenticated client.

**Recommendation:** Either document this as intentional (and add IP-based throttle), or gate
behind authentication given checkout requires login anyway.

---

### M-08 — `ADMIN_EMERGENCY_UUIDS` Bypass in Admin Auth

`src/lib/server/admin.ts` grants admin access to any UUID in `ADMIN_EMERGENCY_UUIDS` env var,
bypassing Discord ID verification.

**Risk:** If `ADMIN_EMERGENCY_UUIDS` is accidentally set in production (e.g., from a shared env
file), arbitrary UUIDs gain admin access. There is no audit log for emergency-UUID-based actions.

---

### M-09 — `set-release-dates.ts` Appears to Be Dead Code

`src/lib/server/set-release-dates.ts` is 25,648 bytes but has no `import` usage found anywhere
in the `src/` directory. It appears to be unused dead code inflating the server-side bundle.

**Fix:** Verify if used by any external script; if not, delete it.

---

## Low

### L-01 — Svelte Warning in Old Card Route

`src/routes/card/[setCode]/[collectorNum]/[slug]/+page.svelte:18` captures `data.card` in
`$state(data.card)` without reactive wrapping (same `state_referenced_locally` bug as H-02).

---

### L-02 — Test Mocks Use Heavy `as any` Pattern

The exports test file (`exports.test.ts`) uses `as any` on ~20 mock objects. Type changes in the
production API will not surface as test compilation errors.

---

### L-03 — README.md Refers to Outdated Project Structure

`README.md` shows `routes/cards/[serial]/` but the actual route is
`routes/card/[setCode]/[collectorNum]/[[lang=lang]]/[slug]/`. Misleads new contributors.

---

### L-04 — Prices Hardcoded in Two Places

Card prices appear in `FALLBACK_PRICES` in `pricing.ts` (source of truth for DB fallback) and
in `README.md` documentation. README shows only 3 types; Raised Foil price (`$3.00`) is
documented nowhere in the README.

---

### L-05 — Moxfield Scraping Uses Browser User-Agent Spoofing

`MOXFIELD_HEADERS` spoofs a Chrome User-Agent and `Sec-Fetch-*` headers to bypass Cloudflare.
This is fragile: Moxfield API or Cloudflare rule changes could silently break deck import.
No monitoring exists for this endpoint's success rate.

---

### L-06 — Notification System Supports Discord Only

`RESEND_API_KEY` is in `.env.example` but there are no email notification code paths in the
notification service. Users without Discord linked receive no order status notifications.

---

### L-07 — `card_type` in `CardRecord` Typed Too Narrowly

In `sync/+server.ts`, `CardRecord.card_type` is typed as `'Normal' | 'Holo' | 'Foil'` only,
excluding Galaxy Foil, Raised Foil, Surge Foil, Serialized, and Misprint variants. The actual
sync logic uses `getCardTypeFromSerial` which may produce these values, causing a silent
type narrowing mismatch.

---

### L-08 — No CSRF Token Validation on Mutation API Routes

SvelteKit CSRF protection only applies to form actions, not `fetch()`-based API routes. Mutation
endpoints rely solely on HttpOnly/SameSite session cookies. No explicit CSRF token layer exists.

---

### L-09 — Phases 14 and 15 Not Implemented

`ROADMAP.md` lists Phases 14 (Scryfall-format parser + language-aware matching) and 15 (updated
bracket-format parser) as planned with no plan files checked. Phase 11 is a prerequisite for
both and appears implemented. These phases remain blocking for language-aware card matching.

---

## Dependency Risks

| Package | Concern |
|---------|---------|
| `bits-ui ^1.8.0` | Relatively new Svelte 5 UI library; API churn possible |
| `@supabase/ssr ^0.5.2` | SSR adapter still pre-1.0; breaking changes possible |
| `svelte ^5.12.0` | Svelte 5 runes API stabilized but ecosystem tooling still maturing |
| `exceljs ^4.4.0` | Heavy dependency (~2 MB) used only for admin Excel export |
| `lru-cache ^11.0.2` | In-memory only; incompatible with distributed/edge deployment |
| `@types/exceljs ^0.5.3` | Version locked at 0.5.3 — potentially stale type defs |

---

## Testing Gaps Summary

| Area | Unit Tests | Integration Tests | E2E Tests |
|------|-----------|-------------------|-----------|
| Card search / import | Partial | None | None |
| Cart operations | Partial | None | None |
| Order creation (RPC) | Phone validation only | None | None |
| Admin inventory sync | None | None | None |
| Excel export builder | Partial | None | None |
| Authentication flows | None | None | None |
| Notification delivery | None | None | None |
| Admin auth logic | None | None | None |

---

## Deployment / Ops Risks

| Risk | Detail |
|------|--------|
| Vercel cold-start cache loss | In-memory LRU caches reset on every cold start |
| Google Sheets as data source | Inventory sync depends on a public sheet; no retry, no SLA |
| No rollback plan for migrations | 24 migration files — no down scripts; rollback requires manual SQL |
| Single admin entry point | Admin protected only by Discord ID allowlist; no MFA, no audit log |
| Moxfield scraping fragility | Deck import breaks if Moxfield updates Cloudflare config or API |
| DISCORD_BOT_TOKEN optional | If not set, order status notifications silently fail |
| No health check endpoint | No /health or /ping route; no application-level health monitoring |
