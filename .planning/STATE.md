---
updated: 2026-06-14
---

# Project State

## Current Position

**Milestone:** v1.2 — Sets
**Phase:** 19 — Set Bundle Cart + Checkout
**Plan:** 3 plans ready — 19-01, 19-02, 19-03
**Status:** Planned, ready to execute
**Last activity:** 2026-06-14 — Phase 19 discussion + 3 plans written

## Next Steps

1. Apply `supabase/migrations/20260614000002_cart_bundles.sql` in Supabase Dashboard
2. Run `npm run db:generate:remote` after migration
3. `/execute 19` — run phases in wave order (19-01 → 19-02 → 19-03)

## Active Decisions

| Decision          | Choice                                                                          | Made       | Affects      |
| ----------------- | ------------------------------------------------------------------------------- | ---------- | ------------ |
| Sets table design | `sets` (set_code PK, set_name, sort_order) + `set_cards` join; no FK on cards  | 2026-06-14 | Phase 17 DB  |
| Card association  | `setCode coll# lang` per line; all card_type matches included                  | 2026-06-14 | Phase 17 API |
| Sets sort (public)| `sort_order ASC`, then `set_name ASC`                                          | 2026-06-14 | Phase 18 UI  |
| Cards sort        | Scryfall release date ASC → collector_number ASC (numeric-aware)                | 2026-06-14 | Phase 18 UI  |
| Auth              | Sets pages are public (no auth required)                                        | 2026-06-14 | Phase 18 UI  |

## Blockers

None.

## Accumulated Context

### Pending Todos

0 pending todos

### Roadmap Evolution

- Phase 17 added: Sets Foundation — DB migration + admin CRUD + card association UI
- Phase 18 added: Public /sets listing + /sets/[setCode] detail pages

### Milestone History

| Milestone | Phases   | Status    |
| --------- | -------- | --------- |
| v1.0      | 1–10     | Shipped   |
| v1.1      | 11–16    | Completed |
| v1.2      | 17–18    | In flight |

## Session Context

### Quick Tasks Completed

| #   | Description | Date | Commits | Directory |
| --- | ----------- | ---- | ------- | --------- |
| 001 | Misprint price config by finish (Normal/Holo/Foil, default $0.70) | 2026-05-25 | 70a3607, 5aed55d | .planning/quick/001-misprint-price-config/ |
| 002 | Fix Moxfield deck URL import (v2 endpoint, browser headers, better error UX) | 2026-06-12 | — | .planning/quick/20260612-moxfield-import-fix/ |
| 003 | Codebase map (.planning/codebase/ — 7 docs, 2568 lines) | 2026-06-11 | 21edd47 | .planning/codebase/ |
| 004 | Fix C-03: Google Sheets URL env var (GOOGLE_SHEETS_LIBRARY_URL) | 2026-06-11 | 26c7688 | — |
| 005 | Fix C-02: Typed RPC defs for replace_order + create_order_with_items | 2026-06-11 | f3d17b3 | — |
| 006 | Fix C-01: TS errors in bulk-tracking + CheckNewCardsModal (0 errors now) | 2026-06-11 | 61f7a7a | — |
| 007 | Fix C-04: IP rate limiting on /api/import/deck (10/min) + /search (30/min) | 2026-06-11 | 3ebd8ba | — |