---
updated: 2026-06-15
---

# Project State

## Current Position

**Milestone:** v1.3 — Sets Stacks View
**Phase:** 20 — Stacks View Component + Toggle Integration
**Plan:** 0/1 plans executed
**Status:** In planning — REQUIREMENTS-v1.3.md + ROADMAP-v1.3.md written, ready to execute
**Last activity:** 2026-06-15 — Milestone v1.3 planning complete; v1.2 (phases 17–19) shipped

## Next Steps

1. `/gsd-plan-phase 20` — plan the single phase in detail
2. `/execute 20` — execute Phase 20

## Active Decisions

| Decision | Choice | Made | Affects |
|---|---|---|---|
| Sets table design | `sets` (set_code PK, set_name, sort_order) + `set_cards` join; no FK on cards | 2026-06-14 | Phase 17 DB |
| Card association | `setCode coll# lang` per line; all card_type matches included | 2026-06-14 | Phase 17 API |
| Sets sort (public) | `sort_order ASC`, then natural sort by name within type sections | 2026-06-14 | Phase 18 UI |
| Cards sort | Scryfall release date ASC → collector_number ASC (numeric-aware) | 2026-06-14 | Phase 18 UI |
| Auth | Sets pages are public (no auth required) | 2026-06-14 | Phase 18 UI |
| Stacks grouping | MTG expansion (set_code on card) | 2026-06-15 | Phase 20 |
| Stacks expanded info | Image only, click → card detail page | 2026-06-15 | Phase 20 |
| Stacks duplicates | Collapse to one row with ×N badge | 2026-06-15 | Phase 20 |
| Stacks mobile | Accordion per column | 2026-06-15 | Phase 20 |
| Stacks icons | Scryfall SVG set symbol in column header | 2026-06-15 | Phase 20 |

## Blockers

None.

## Accumulated Context

### Pending Todos

0 pending todos

### Roadmap Evolution

- Phase 17 added: Sets Foundation — DB migration + admin CRUD + card association UI
- Phase 18 added: Public /sets listing + /sets/[setCode] detail pages
- Phase 19 added: Set Bundle Cart + Checkout
- Phase 20 added: Stacks View for Set Detail Page (v1.3)

### Milestone History

| Milestone | Phases | Status |
|---|---|---|
| v1.0 | 1–10 | Shipped |
| v1.1 | 11–16 | Completed |
| v1.2 | 17–19 | Shipped |
| v1.3 | 20 | In planning |

## Session Context

### Quick Tasks Completed

| # | Description | Date | Commits | Directory |
|---|---|---|---|---|
| 001 | Misprint price config by finish (Normal/Holo/Foil, default $0.70) | 2026-05-25 | 70a3607, 5aed55d | .planning/quick/001-misprint-price-config/ |
| 002 | Fix Moxfield deck URL import (v2 endpoint, browser headers, better error UX) | 2026-06-12 | — | .planning/quick/20260612-moxfield-import-fix/ |
| 003 | Codebase map (.planning/codebase/ — 7 docs, 2568 lines) | 2026-06-11 | 21edd47 | .planning/codebase/ |
| 004 | Fix C-03: Google Sheets URL env var (GOOGLE_SHEETS_LIBRARY_URL) | 2026-06-11 | 26c7688 | — |
| 005 | Fix C-02: Typed RPC defs for replace_order + create_order_with_items | 2026-06-11 | f3d17b3 | — |
| 006 | Fix C-01: TS errors in bulk-tracking + CheckNewCardsModal (0 errors now) | 2026-06-11 | 61f7a7a | — |
| 007 | Fix C-04: IP rate limiting on /api/import/deck (10/min) + /search (30/min) | 2026-06-11 | 3ebd8ba | — |
| 008 | Sets UI overhaul: type sections, search, list view, no code badges, 56 default | 2026-06-14 | c41d148 | — |
| 009 | Allow duplicate cards per set + natural sort by name number | 2026-06-15 | 2c95e39 | — |