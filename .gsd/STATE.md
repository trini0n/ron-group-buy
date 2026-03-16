# Project State

## Project Reference

See: `.gsd/codebase/CONCERNS.md` (codebase mapping completed 2026-03-14)

**Core value:** Group buy web app — SvelteKit + Supabase, production hardening pass
**Current focus:** Phase 05 — Security Hardening

## Current Position

Phase: 6 of 6 (Reliability & Performance) — COMPLETE
Plan: 3 of 3
Status: All 6 phases complete — roadmap finished
Last activity: 2026-03-15 — Phase 06 all 3 plans executed and verified (all must_haves passed)

Progress: ██████████████ 100%

## Accumulated Context

**Codebase:** SvelteKit 5 (Svelte runes) + Supabase + Vercel. All mutations through `+server.ts` API endpoints. Admin auth via `src/lib/server/admin.ts`. Service-role client must never be used in public routes.

**Key files for Phase 01:**

- `src/routes/auth/callback/+server.ts` — open redirect fix
- `src/routes/api/orders/+server.ts` — server-side pricing
- `src/routes/api/admin/exports/cleanup/+server.ts` — fail-closed auth
- `src/routes/api/import/search/+server.ts` — replace service-role with anon client

**Decisions Made:**

- Security fixes are non-negotiable P0 — must be correct, not just cosmetic
- Pricing must be looked up from DB/config, never from client payload
- `CRON_SECRET` absence must be a hard failure (fail-closed)
