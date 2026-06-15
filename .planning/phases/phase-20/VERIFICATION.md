---
phase: 20
verified: 2026-06-15
verdict: PASS
---

# Phase 20 Verification

## Must-Haves

| # | Criterion | Evidence | ✓ |
|---|---|---|---|
| 1 | View toggle shows List \| Grid \| Stacks | `viewMode === 'stacks'` state + `id="view-toggle-stacks"` button + `{:else if viewMode === 'stacks'}` render branch in `+page.svelte` L8-9, L89-94, L124 | ✅ |
| 2 | Cards grouped into expansion columns; headers show icon + name + count | `groupMap` by `set_code` in `StacksView.svelte` L62–73; column header renders Scryfall img + setName + totalCount pill L157–186 | ✅ |
| 3 | Scryfall SVG icons load; broken icon disappears gracefully | `onerror={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none' }}` in StacksView.svelte L163 | ✅ |
| 4 | Clicking a row expands card image inline; clicking again collapses | `toggleExpand` toggles `expandedKey = key` or `null` (L126–129); `{#if isExpanded}` block renders image (L222–236) | ✅ |
| 5 | Only one card expanded per column at a time | `expandedKey` is a single `string \| null` per column in the `colStates` Map (L111) — setting a new key replaces the old one | ✅ |
| 6 | Clicking expanded image navigates to card detail | `<a href={getCardUrl(row.card)}>` wraps the `<img>` (L226–235) | ✅ |
| 7 | Mobile: columns are vertical accordions, all open by default | `collapsed: false` default (L120); `{state.collapsed ? 'hidden' : 'block'} sm:block` on card list div (L196); `toggleCollapse` on column header button (L192) | ✅ |
| 8 | Duplicate cards (same name + finish) collapsed to one row with ×N badge | Dedup Map keyed by `card_name + '|' + card_type` (L78–87); `{#if row.count > 1}<span>×{row.count}</span>` (L212–218) | ✅ |
| 9 | List and Grid modes unaffected; no changes to CardGrid/CardItem | `CardGrid.svelte` and `CardItem.svelte` untouched; List/Grid branches unchanged in `+page.svelte` | ✅ |

## Type Check

- `svelte-check` run post-commit: **0 errors** in `StacksView.svelte` or `sets/[setCode]/+page.svelte`
- 15 pre-existing errors in unrelated files (not introduced by this phase)

## Verdict: ✅ PASS

All 9 must-haves verified against actual codebase. Phase 20 complete.
