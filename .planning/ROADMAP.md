---
milestone: v1.2
created: 2026-06-14
phases: 2
requirements: 25
---

# ROADMAP.md — v1.2 Sets

> Continues from v1.1 (phases 11–16). This milestone adds Phases 17–18.

---

## Phase 11: Admin New Card Checker

**Goal:** Admin can paste a card list, select a card type, and instantly see which cards are missing from the library — with a copyable result.

**Requirements covered:**
INPUT-01, INPUT-02, INPUT-03, INPUT-04,
MATCH-01, MATCH-02, MATCH-03, MATCH-04,
OUTPUT-01, OUTPUT-02, OUTPUT-03, OUTPUT-04,
UX-01, UX-02, UX-03

**Success criteria:**

1. Admin can paste `Card Name | SetCode | Collector#` list (any supported delimiter) and see results
2. Selecting "Normal", "Holo", or "Foil" correctly scopes the database query
3. Result list shows ONLY cards absent from the library
4. One-click copy of results works
5. Count summary shows `X of Y cards are new`
6. No regressions to existing inventory page functionality

### Plans

#### 11-01: New Card Checker — API + UI

**Tasks:**

1. Create `POST /api/admin/inventory/check-new` endpoint
   - Accept `{ cards: [{card_name, set_code, collector_number}], card_type: "Normal"|"Holo"|"Foil" }`
   - Query DB: find which (set_code, collector_number) tuples already exist for the given type family
   - Return `{ new_cards: [...], existing_count: N, new_count: N }`

2. Add `CheckNewCardsModal` Svelte component
   - Textarea for pasting input
   - Card type radio/select (Normal | Holo | Foil)
   - Parse input (pipe or comma delimited, forgiving)
   - Call API, display results
   - Copy-to-clipboard button for results

3. Wire modal to Admin Inventory page
   - Add "Check New Cards" button to inventory header toolbar
   - Open/close modal state

---

## Phase 12: OracleTag Card Filtering

**Goal:** Users can filter the card catalog by oracle tag land types (`is:shockland`, `is:fetchland`, etc.) by typing `is:TAG` directly in the existing search box. URL-shareable via the existing `q=` param.
**Depends on:** Phase 11
**Plans:** 1 plan

Plans:

- [x] 12-01-PLAN.md — Oracle tag data file + is:TAG inline parsing in CardGrid/CardTableView

**Details:**
Add filtering cards by oracle tag land type via search-box syntax only. Users type `is:shockland`, `is:fetchland`, `is:vergeland`, etc. in the existing search bar to filter to that land cycle. No new filter panel section. Multiple `is:` tokens use OR logic; `is:TAG` combined with text uses AND.

---

## Phase 13: is:TAG Autocomplete Dropdown

**Goal:** Users can type is: in the search bar and see an autocomplete dropdown of oracle tag options; partial tokens don't wipe results.
**Depends on:** Phase 12
**Plans:** 1 plan

Plans:

- [x] 13-01-PLAN.md — Partial token no-op fix + IsTagAutocomplete component + page wiring

**Details:**
When user types `is:` in the search bar, show an alphabetical dropdown of available oracle tag options beneath the search input. List filters as the user types more characters. Selecting an option autofills the complete token. List dismisses on option select, Space, or click outside. While `is:` token is incomplete, treat it as a no-op for filtering (don't wipe results).

---

## Requirements Coverage

| REQ-ID    | Phase | ✓   |
| --------- | ----- | --- |
| INPUT-01  | 11    | —   |
| INPUT-02  | 11    | —   |
| INPUT-03  | 11    | —   |
| INPUT-04  | 11    | —   |
| MATCH-01  | 11    | —   |
| MATCH-02  | 11    | —   |
| MATCH-03  | 11    | —   |
| MATCH-04  | 11    | —   |
| OUTPUT-01 | 11    | —   |
| OUTPUT-02 | 11    | —   |
| OUTPUT-03 | 11    | —   |
| OUTPUT-04 | 11    | —   |
| UX-01     | 11    | —   |
| UX-02     | 11    | —   |
| UX-03     | 11    | —   |

Coverage: 15/15 requirements (100%) ✓

---

## Phase 14: New Card Checker — Scryfall Format + Language Matching

**Goal:** The new card checker accepts `{card_name} [{card_frame}] [{setCode}] #{cn} {language}` format from pasted lists, and matches on language in addition to set_code + collector_number.
**Depends on:** Phase 11
**Plans:** 1 plan

Plans:

- [ ] 14-01 — Scryfall-format parser + language-aware match key in modal + API

---

## Phase 15: Check New Cards — Updated Bracket Format Parser

**Goal:** Update the Scryfall-style parser to accept `Card Name [lang] [frame] [set] #CN` where `[lang]` (2-letter code) appears before frame/set, both optional. Set + CN + language identify the card.
**Depends on:** Phase 14
**Plans:** 1 plan

Plans:

- [ ] 15-01 — Rewrite parseScryfallLine to handle optional [lang] before [frame] and [set]

---

## Phase 16: Misprint Card Filter Type

**Goal:** Misprint cards are hidden from the catalog, search results, and decklist search by default. A dedicated "Misprint" filter toggle makes them visible. Without the filter, misprint cards never appear in any results.
**Depends on:** Phase 15
**Plans:** 3 plans

Plans:

- [x] 16-01-PLAN.md — DB migration + sync script + type system foundation
- [x] 16-02-PLAN.md — Catalog filter UI (SearchFilters checkbox, CardGrid/TableView exclusion, CardItem badge, URL params)
- [x] 16-03-PLAN.md — Decklist search exclusion + admin inventory display + Google Apps Script updates

**Details:**
Add a `misprint` boolean flag to cards. Misprint cards are excluded from all catalog listings, text/name search results, and decklist search results unless the user explicitly enables the Misprint filter. The filter is opt-in and unchecked by default.

---

## Phase 17: Sets Foundation — DB + Admin CRUD

**Goal:** Create the `sets` and `set_cards` DB tables, admin UI to manage sets (create/edit/delete/reorder), and the card-association UI (paste `setCode coll# lang` lines).
**Depends on:** Phase 16
**Status:** ✅ Complete
**Plans:** 2 plans

Plans:

- [x] 17-01 — DB migration + Admin sets list + set create/edit/delete + admin nav link
- [x] 17-02 — Admin set detail page: card association textarea + remove card

**Success criteria:**
1. `sets` table exists with `set_code`, `set_name`, `sort_order`; `set_cards` join table with FK constraints
2. Admin can create, edit, delete, and reorder sets
3. Admin can paste `setCode coll# lang` lines and see which resolved / errored
4. Admin can remove individual cards from a set
5. No regressions to existing inventory or card catalog

**Requirements covered:**
SETS-01, SETS-02, SETS-03,
ADMIN-01, ADMIN-02, ADMIN-03, ADMIN-04, ADMIN-05,
ASSOC-01, ASSOC-02, ASSOC-03, ASSOC-04, ASSOC-05, ASSOC-06,
NAV-02

---

## Phase 18: Public Sets Listing + Detail Pages

**Goal:** Public `/sets` listing page and `/sets/[setCode]` detail page showing the admin-curated card list for each set.
**Depends on:** Phase 17
**Plans:** 1 plan

Plans:

- [ ] 18-01 — `/sets` listing + `/sets/[setCode]` detail + public nav link

**Success criteria:**
1. `/sets` renders all sets sorted by `sort_order` then `set_name`; shows card count per set
2. `/sets/[setCode]` renders full card list sorted by Scryfall release date → collector number
3. Invalid `setCode` returns 404
4. Empty states render correctly for both pages
5. Each card links to its existing detail page
6. "Sets" appears in the public nav
7. No regressions to existing catalog or admin

**Requirements covered:**
PUB-01, PUB-02, PUB-03, PUB-04, PUB-05,
DETAIL-01, DETAIL-02, DETAIL-03, DETAIL-04, DETAIL-05,
NAV-01

---

## Requirements Coverage

| REQ-ID        | Phase | ✓ |
| ------------- | ----- | - |
| SETS-01       | 17    | — |
| SETS-02       | 17    | — |
| SETS-03       | 17    | — |
| ADMIN-01      | 17    | — |
| ADMIN-02      | 17    | — |
| ADMIN-03      | 17    | — |
| ADMIN-04      | 17    | — |
| ADMIN-05      | 17    | — |
| ASSOC-01      | 17    | — |
| ASSOC-02      | 17    | — |
| ASSOC-03      | 17    | — |
| ASSOC-04      | 17    | — |
| ASSOC-05      | 17    | — |
| ASSOC-06      | 17    | — |
| PUB-01        | 18    | — |
| PUB-02        | 18    | — |
| PUB-03        | 18    | — |
| PUB-04        | 18    | — |
| PUB-05        | 18    | — |
| DETAIL-01     | 18    | — |
| DETAIL-02     | 18    | — |
| DETAIL-03     | 18    | — |
| DETAIL-04     | 18    | — |
| DETAIL-05     | 18    | — |
| NAV-01        | 18    | — |
| NAV-02        | 17    | — |

Coverage: 0/26 requirements (0%) — milestone starting
