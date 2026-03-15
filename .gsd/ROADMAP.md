# Roadmap: Group Buy Security & Quality Hardening

## Overview

Address all technical debt and security concerns identified during codebase mapping (see `.gsd/codebase/CONCERNS.md`). Work ordered from most critical (security vulnerabilities) down to hygiene improvements, ensuring the app is safe to operate before optimizing for maintainability.

## Phases

- [x] **Phase 01: Security** - Fix all 4 P0 security vulnerabilities before any other work
- [x] **Phase 02: Correctness** - Fix P1 correctness bugs (N+1 writes, race conditions, silent errors) and P2 maintainability (admin auth consolidation, duplicate logic, type debt)
- [x] **Phase 03: Hygiene** - P3 cleanup (dead code, logging, alias consistency, test TODOs)
- [ ] **Phase 04: Type Safety** - Regenerate DB types, eliminate all `@ts-ignore` / `as any` casts, fix Svelte 5 reactivity warnings, resolve notification settings compile error
- [ ] **Phase 05: Security Hardening** - Move admin IDs off client bundle, add admin lockout fallback, server-side phone validation, gphoto SSRF hostname check
- [ ] **Phase 06: Reliability & Performance** - Replace unbounded deck Map with LRU cache, eliminate duplicate AdminClient, Zod validation on POST bodies, wire checkout session locking, gate layout DB queries

## Phase Details

### Phase 01: Security

**Goal**: All 4 P0 security vulnerabilities are patched — open redirect closed, pricing server-authoritative, cleanup endpoint fail-closed, public endpoints use appropriate Supabase client
**Depends on**: Nothing (first phase)
**Requirements**: CONCERNS.md §Critical items 1–4
**Success Criteria** (what must be TRUE):

1. Auth callback `next` redirects only to same-origin paths — `https://evil.com` as `next` results in redirect to `/`
2. Order creation always uses server-side price lookup — client-supplied `unitPrice` is ignored
3. Cleanup endpoint returns 401/500 when `CRON_SECRET` is absent — never executes unauthenticated
4. Import search endpoint uses anon/user Supabase client, not service-role
   **Plans**: 3 plans (01-01 open redirect, 01-02 pricing, 01-03 cleanup+search)

Plans:

- [x] 01-01: Fix open redirect in auth callback + conflict page
- [x] 01-02: Server-authoritative order pricing
- [x] 01-03: Fail-closed cleanup + service-role search fix

### Phase 02: Correctness & Maintainability

**Goal**: P1 correctness bugs fixed (N+1 loops, manifest race condition, silent query errors), P2 duplication eliminated (admin auth, user-row logic), type debt meaningfully reduced
**Depends on**: Phase 01
**Requirements**: CONCERNS.md §Moderate items 5–10, §Type Safety Gaps
**Success Criteria** (what must be TRUE):

1. Multi-item order operations use batched DB writes (upsert arrays), not per-item loops
2. Export manifest writes are race-condition safe
3. Import search surfaces query errors instead of silently continuing
4. Admin auth check is not duplicated — single source enforcement
5. `@ts-ignore` markers removed or replaced with proper types
   **Plans**: 3 plans (02-01 N+1 batching, 02-02 race+errors, 02-03 user-row dedup)

Plans:

- [x] 02-01: Batch N+1 DB write loops
- [x] 02-02: Export manifest race + silent query errors
- [x] 02-03: Extract ensureUserRow shared utility

### Phase 03: Hygiene

**Goal**: Codebase cleaned of dead code, console.error replaced with structured logger, import alias standardized, test TODOs addressed
**Depends on**: Phase 02
**Requirements**: CONCERNS.md §Minor items 11–15
**Success Criteria** (what must be TRUE):

1. `updateNotificationStatus` removed or integrated
2. All server-side `console.error` calls use `logger.error` instead
3. Import alias inconsistencies resolved (`$components` vs `$lib/components`)
4. Export test TODOs replaced with real assertions
   **Plans**: 3 plans (03-01 dead code, 03-02 structured logging, 03-03 test TODOs)

Plans:

- [x] 03-01: Remove dead updateNotificationStatus
- [x] 03-02: Migrate console.error to logger.error
- [x] 03-03: Implement export test assertions

### Phase 04: Type Safety

**Goal**: `svelte-check` passes clean — all `@ts-ignore` / `as any` casts removed via DB type regeneration, Svelte 5 `state_referenced_locally` warnings resolved, notification settings compile error fixed
**Depends on**: Phase 03
**Requirements**: CONCERNS.md §Tech Debt (schema drift, `supabase as any`, auth callback `any`), §Known Bugs (Svelte 5 reactivity, notification TypeScript error)
**Success Criteria** (what must be TRUE):

1. `npm run check` reports zero errors and zero `state_referenced_locally` warnings
2. All `@ts-ignore` markers removed from `src/routes/api/orders/+server.ts`, `src/routes/profile/+page.svelte`, `src/routes/orders/[id]/+page.svelte`
3. `supabase as any` casts removed from `src/lib/server/pricing.ts` and `src/routes/admin/settings/pricing/+page.server.ts`
4. `checkForNewProviderConflict` in `src/routes/auth/callback/+server.ts` typed as `SupabaseClient<Database>` not `any`
5. Notification settings edit dialog no longer throws compile error (`is_active: boolean | null` handled)

**Plans**: 2 plans (04-01 DB type regen + cast removal, 04-02 Svelte 5 reactivity + notification fix)

Plans:

- [ ] 04-01: Regenerate DB types and remove @ts-ignore / as any casts _(planned)_
- [ ] 04-02: Fix Svelte 5 state*referenced_locally + notification settings TypeScript error *(planned)\_

### Phase 05: Security Hardening

**Goal**: Remaining security surface reduced — admin Discord IDs moved off client bundle to env var, admin lockout fallback added for non-Discord accounts, phone numbers validated server-side, gphoto SSRF final hostname validated
**Depends on**: Phase 04
**Requirements**: CONCERNS.md §Security Considerations (hardcoded admin IDs, phone validation, admin lockout risk, SSRF in gphoto)
**Success Criteria** (what must be TRUE):

1. `src/lib/admin-shared.ts` contains no hardcoded Discord IDs — IDs read from `ADMIN_DISCORD_IDS` env var in `src/lib/server/admin.ts` only
2. Admin access works via Discord link OR via Supabase UUID/email emergency fallback
3. Orders API rejects phone numbers that fail E.164-format server-side validation with a 400 response
4. `gphoto-converter.ts` validates the resolved fetch response hostname is `lh3.googleusercontent.com` before returning the URL

**Plans**: 2 plans (05-01 admin IDs + lockout fallback, 05-02 phone validation + gphoto SSRF check)

Plans:

- [ ] 05-01: Move admin IDs to env var + add non-Discord admin lockout fallback
- [ ] 05-02: Server-side phone format validation + gphoto SSRF final hostname check

### Phase 06: Reliability & Performance

**Goal**: Memory leak fixed, admin client overhead eliminated, all POST bodies validated with Zod, checkout session locking wired to checkout route so concurrent cart modification during checkout is rejected, layout DB queries gated behind auth
**Depends on**: Phase 05
**Requirements**: CONCERNS.md §Tech Debt (unbounded Map, duplicate AdminClient, no Zod validation), §Performance Bottlenecks (layout load), §Missing Critical Features (checkout session locking)
**Success Criteria** (what must be TRUE):

1. Deck import cache uses `LRUCache` with a bounded `max` — plain `Map` removed from `src/routes/api/import/deck/+server.ts`
2. `isAdmin()` accepts an optional pre-created admin client and does not open a second connection when one is passed
3. All POST handlers in `src/routes/api/` validate request body via Zod schema, returning 400 with field errors on invalid payload
4. Checkout flow calls `CartService.createCheckoutSession()` when checkout begins and `CartService.validateCheckoutSession()` on submit — stale/modified carts are rejected
5. `fetchPrices()` in `src/routes/+layout.server.ts` is only called for authenticated sessions

**Plans**: 3 plans (06-01 LRU cache + AdminClient, 06-02 Zod on POST bodies, 06-03 checkout session locking + layout gate)

Plans:

- [ ] 06-01: Replace deck Map with LRUCache + fix duplicate AdminClient creation
- [ ] 06-02: Add Zod schemas to all POST API route bodies
- [ ] 06-03: Wire checkout session locking to checkout route + gate layout fetchPrices behind auth
