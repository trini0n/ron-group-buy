---
updated: 2026-06-11
---

# Project State

## Current Position

**Milestone:** v1.1 — Admin New Card Checker
**Phase:** 16 complete — Misprint Card Filter Type
**Plan:** all 3 plans complete
**Status:** Phase 16 fully complete + critical issues resolved
**Last activity:** 2026-06-11 — Codebase map generated; 4 critical issues fixed (C-01/C-02/C-03/C-04)

## Next Steps

1. Execute Phase 11 (Admin New Card Checker)
2. Add GOOGLE_SHEETS_LIBRARY_URL to local .env (the old hardcoded URL)
3. Note: 2 pre-existing test failures in groupAndSortOrderItems (unrelated to recent work)

## Active Decisions

| Decision      | Choice                                                    | Made       | Affects      |
| ------------- | --------------------------------------------------------- | ---------- | ------------ |
| Match logic   | set_code + collector_number + card_type family            | 2026-05-03 | API endpoint |
| Foil matching | card_type IN (Foil, Galaxy Foil, Raised Foil, Surge Foil) | 2026-05-03 | API endpoint |
| UI placement  | Modal triggered from Admin Inventory page                 | 2026-05-03 | Phase 11     |

## Blockers

None.

## Accumulated Context

### Pending Todos

0 pending todos — is:TAG autocomplete shipped ✓

### Roadmap Evolution

- Phase 12 added: Add filtering cards by tagged / oracletag type (lands: shockland, fetchland, vergeland, etc.)
- Phase 13 added: is:TAG autocomplete dropdown in search bar
- Phase 16 added: Misprint card filter type (hidden by default, opt-in filter, excluded from all search including decklist)

## Session Context

First milestone being tracked in GSD. Previous work (v1.0) retroactively recorded.
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