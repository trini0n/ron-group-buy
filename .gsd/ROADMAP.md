# Roadmap: Group Buy Security & Quality Hardening

## Overview

Address all technical debt and security concerns identified during codebase mapping (see `.gsd/codebase/CONCERNS.md`). Work ordered from most critical (security vulnerabilities) down to hygiene improvements, ensuring the app is safe to operate before optimizing for maintainability.

## Phases

- [x] **Phase 01: Security** - Fix all 4 P0 security vulnerabilities before any other work
- [x] **Phase 02: Correctness** - Fix P1 correctness bugs (N+1 writes, race conditions, silent errors) and P2 maintainability (admin auth consolidation, duplicate logic, type debt)
- [x] **Phase 03: Hygiene** - P3 cleanup (dead code, logging, alias consistency, test TODOs)

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
