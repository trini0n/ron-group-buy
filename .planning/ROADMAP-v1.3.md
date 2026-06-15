---
milestone: v1.3
created: 2026-06-15
phases: 1
requirements: 9
---

# ROADMAP.md — v1.3 Sets Stacks View

> Continues from v1.2 (phases 17–19). This milestone adds Phase 20.

---

## Phase 20: Stacks View for Set Detail Page

**Goal:** Add a "Stacks" view mode to `/sets/[setCode]` that groups cards by their MTG expansion into scrollable vertical columns, with inline image expand on row click, Scryfall set icons in column headers, and a mobile accordion layout.

**Depends on:** Phase 19 (complete)
**Plans:** 1 plan

### Plans

#### 20-01: StacksView Component + View Toggle Integration

**Tasks:**

1. **Create `StacksView.svelte`** component at `src/lib/components/cards/StacksView.svelte`
   - Accept `cards: Card[]` as prop
   - Group cards by `set_code` → sort groups by `set_name` (natural sort)
   - Within each group: deduplicate by `card_name + card_type`, sort by `collector_number` (numeric-aware)
   - Render desktop layout: horizontal flex container, each column ~220–260px wide, full-height scroll
   - Render mobile layout: vertical accordion stack (each column is a collapsible section)
   - Column header: Scryfall set symbol SVG + set name + card count pill
   - Card rows: name + `×N` badge if count > 1
   - Per-column `expandedCardId` state; clicking a row toggles inline image expand
   - Expanded image: `ron_image_url` → Scryfall `normal` → placeholder, wrapped in `<a href=/card/[serial]>`
   - "Unknown Set" catch-all column for cards missing `set_code`

2. **Update `src/routes/sets/[setCode]/+page.svelte`**
   - Add `'stacks'` to the `viewMode` state type: `'list' | 'grid' | 'stacks'`
   - Add Stacks button to the view toggle (with `Columns` icon from lucide-svelte)
   - Render `<StacksView cards={data.cards} />` when `viewMode === 'stacks'`
   - Remove the unused `Badge` import (set_code badge was already removed)

**Success criteria:**

1. View toggle shows List | Grid | Stacks; clicking Stacks renders the new component
2. Cards are correctly grouped into expansion columns; column headers show set icon + name + count
3. Scryfall SVG icons load correctly; a broken icon falls back gracefully (no broken img)
4. Clicking a compact row expands the card image inline; clicking again collapses it
5. Only one card is expanded per column at a time
6. Clicking the expanded image navigates to `/card/[serial]`
7. On mobile, each column renders as a collapsible accordion, all open by default
8. Duplicate cards (same name + finish) are collapsed to one row with `×N` badge
9. List and Grid modes are unaffected

**Requirements covered:** STACKS-01, STACKS-02, STACKS-03, STACKS-04, STACKS-05, STACKS-06, STACKS-07, STACKS-08, STACKS-09

---

## Requirements Coverage

| REQ-ID    | Phase | ✓ |
| --------- | ----- | - |
| STACKS-01 | 20    | — |
| STACKS-02 | 20    | — |
| STACKS-03 | 20    | — |
| STACKS-04 | 20    | — |
| STACKS-05 | 20    | — |
| STACKS-06 | 20    | — |
| STACKS-07 | 20    | — |
| STACKS-08 | 20    | — |
| STACKS-09 | 20    | — |

Coverage: 0/9 requirements (0%) — milestone in planning
