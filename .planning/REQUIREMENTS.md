---
milestone: v1.2
created: 2026-06-14
---

# REQUIREMENTS.md — v1.2 Sets

## Milestone Requirements

### Sets — Data Model

- [ ] **SETS-01**: A `sets` table exists with `set_code` (PK), `set_name`, `sort_order`, `created_at`, `updated_at`
- [ ] **SETS-02**: A `set_cards` join table links sets to cards (`set_code FK → sets`, `card_id FK → cards`, unique constraint)
- [ ] **SETS-03**: Both `sets` and `set_cards` are publicly readable via RLS; write operations require service role

### Admin — Set Management

- [ ] **ADMIN-01**: Admin can create a set (set_code + set_name) from the admin UI
- [ ] **ADMIN-02**: Admin can edit a set's name from the admin UI
- [ ] **ADMIN-03**: Admin can delete a set (cascades set_cards rows)
- [ ] **ADMIN-04**: Admin can reorder sets; order persists via `sort_order` column
- [ ] **ADMIN-05**: Admin sets list shows set_code, set_name, and card count per set

### Admin — Card Association

- [ ] **ASSOC-01**: Admin can paste a list of `setCode coll# lang` lines into a textarea to add cards to a set
- [ ] **ASSOC-02**: Each line is resolved to matching card(s) in the library by `set_code + collector_number + language`
- [ ] **ASSOC-03**: Lines that match multiple cards (e.g. Normal + Foil of same card) include all matches
- [ ] **ASSOC-04**: Unresolvable lines are reported back to the admin with the failing line and reason
- [ ] **ASSOC-05**: Duplicate card associations are silently ignored (upsert / ON CONFLICT DO NOTHING)
- [ ] **ASSOC-06**: Admin can remove individual cards from a set

### Public — Sets Listing Page (`/sets`)

- [ ] **PUB-01**: A public `/sets` page lists all sets (no auth required)
- [ ] **PUB-02**: Sets are ordered by `sort_order ASC`, then `set_name ASC`
- [ ] **PUB-03**: Each set entry shows: set name, set code badge, card count
- [ ] **PUB-04**: Empty state displayed when no sets are defined
- [ ] **PUB-05**: Each set entry links to `/sets/[setCode]`

### Public — Set Detail Page (`/sets/[setCode]`)

- [ ] **DETAIL-01**: `/sets/[setCode]` shows the set name, code, and all associated cards
- [ ] **DETAIL-02**: Returns 404 if the set code does not exist in the `sets` table
- [ ] **DETAIL-03**: Cards are sorted by Scryfall release date of their `set_code` ASC, then `collector_number` ASC (numeric-aware)
- [ ] **DETAIL-04**: Empty state displayed when a set has no cards associated
- [ ] **DETAIL-05**: Each card links to its existing card detail page

### Navigation

- [ ] **NAV-01**: "Sets" link appears in the public site header/nav
- [ ] **NAV-02**: "Sets" link appears in the admin sidebar

---

## Out of Scope

- Auto-populating `set_cards` from the existing CSV sync pipeline
- Filtering the main catalog by sets from the `sets` table (catalog continues to use `cards.set_code`)
- Set images / logos / icons
- Per-set release date management (uses Scryfall as source of truth for sorting)

---

## Traceability

| REQ-ID        | Phase | Plan   |
|---------------|-------|--------|
| SETS-01..03   | 17    | 17-01  |
| ADMIN-01..05  | 17    | 17-01  |
| ASSOC-01..06  | 17    | 17-02  |
| PUB-01..05    | 18    | 18-01  |
| DETAIL-01..05 | 18    | 18-01  |
| NAV-01..02    | 17+18 | 17-01, 18-01 |
