---
phase: 20
plan: 20-01
status: complete
completed: 2026-06-15
commit: 6d900b1
---

# Summary: Plan 20-01 — StacksView Component + View Toggle Integration

## What Was Built

### New: `src/lib/components/cards/StacksView.svelte`

A self-contained Svelte 5 component implementing the Archidekt-style stacks layout:

**Data pipeline:**
- Groups `Card[]` by `set_code` (lowercase) into expansion columns
- Deduplicates within each column by `card_name + '|' + card_type` — same name, different finish = separate rows
- Sorts columns by expansion name (natural/numeric-aware sort); "Unknown Set" always last
- Sorts rows within each column by `collector_number` (numeric-aware ASC)

**UI — Desktop:**
- Horizontal scrollable flex container (`overflow-x-auto`)
- Each column: fixed width 200–280px, sticky header, scrollable card list
- Column header: Scryfall SVG set icon + expansion name + card count pill

**UI — Mobile:**
- Columns stack vertically
- Each column header is an accordion toggle (ChevronDown rotates on collapse)
- `hidden sm:block` pattern — pure CSS, no JS breakpoint detection

**Expand behaviour:**
- Per-column `expandedKey: string | null` state in a reactive `Map`
- Clicking a row expands the card image inline below it; clicking again collapses
- Only one expanded row per column; clicking a different row auto-collapses the previous
- Image priority: `ron_image_url` → Scryfall `normal` → `/images/card-placeholder.png`
- `onerror` on Ron image marks the card ID in `failedIds` Set → falls back to Scryfall
- Expanded image wrapped in `<a href={getCardUrl(card)}>` → card detail page

**Guards:**
- Cards missing `set_code` → "Unknown Set" column with no Scryfall icon
- Scryfall SVG 404 → `onerror` hides the `<img>` element (`display:none`)

### Modified: `src/routes/sets/[setCode]/+page.svelte`

- `viewMode` type extended: `'list' | 'grid' | 'stacks'`
- `Columns` icon imported from lucide-svelte
- `StacksView` imported and rendered for `viewMode === 'stacks'`
- Stacks button added to the view toggle (`id="view-toggle-stacks"`)
- Removed unused `Badge` import

## Files Changed

| File | Action |
|---|---|
| `src/lib/components/cards/StacksView.svelte` | Created (229 lines) |
| `src/routes/sets/[setCode]/+page.svelte` | Modified (+14 lines, -4 lines) |

## Type Check

`svelte-check` run — 0 errors in new/modified files. 15 pre-existing errors in unrelated files (unchanged from before this phase).

## Commit

`6d900b1` — feat(phase-20): StacksView component + view toggle integration
