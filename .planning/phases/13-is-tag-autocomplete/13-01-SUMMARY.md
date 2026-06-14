---
phase: 13-is-tag-autocomplete
plan: '01'
subsystem: card-catalog
tags: [autocomplete, oracle-tags, search, ui, svelte5]
requires: ['12-01']
provides:
  - is:TAG autocomplete dropdown in search bar
  - Partial is:TAG token no-op (unknown tokens don't wipe results)
affects:
  - Any future search UX enhancements
tech-stack:
  added: []
  patterns:
    - Svelte 5 runes component with $derived visibility logic
    - onmousedown-before-blur pattern for dropdown item selection
    - Emergent Space-dismiss via regex end-of-string anchor
key-files:
  created:
    - src/lib/components/cards/IsTagAutocomplete.svelte
  modified:
    - src/lib/components/cards/CardGrid.svelte
    - src/lib/components/cards/CardTableView.svelte
    - src/routes/+page.svelte
decisions:
  - knownIsTokens filters out unknown tags before oracle predicate (partial tokens are no-ops)
  - onmousedown + e.preventDefault() used instead of onclick to prevent input blur before select
  - Space-dismissal is emergent from /is:(\S*)$/i regex (space breaks the match)
  - dismissedAtQuery state tracks per-query dismissal without a boolean toggle
metrics:
  duration: ~15 minutes
  completed: 2026-05-08
---

# Phase 13 Plan 01: is:TAG Autocomplete Dropdown Summary

**One-liner:** is:TAG autocomplete dropdown + partial token no-op fix for the card catalog search bar.

## What Was Built

### Task 1: Partial token no-op fix — CardGrid.svelte + CardTableView.svelte

Fixed a pre-existing bug where unknown/partial `is:` tokens (e.g. `is:sh`) caused all cards to be filtered out instead of being treated as no-ops.

**Changes in both files:**

- Updated import: `import { matchesOracleTag, ORACLE_TAGS } from '$lib/data/oracle-tags'`
- Added after `isTokens`: `const knownIsTokens = isTokens.filter((t) => t in ORACLE_TAGS)`
- Oracle predicate now uses `knownIsTokens` — partial/unknown tokens skip the filter entirely
- `isTokens` still used for `textQuery` strip (all `is:` removed from text search regardless)
- Also fixed pre-existing `noUncheckedIndexedAccess` TypeScript error: `m[1].toLowerCase()` → `m[1]?.toLowerCase() ?? ''`

### Task 2: IsTagAutocomplete.svelte (new component)

Created `src/lib/components/cards/IsTagAutocomplete.svelte` — a Svelte 5 runes component that shows an alphabetical autocomplete dropdown when the search query ends with an `is:partial` token.

Key implementation details:

- **`partialText`** — `$derived` from `/is:(\S*)$/i` regex on `query`. Returns `null` when no trailing `is:` token present.
- **`filteredTags`** — `$derived` from `Object.keys(ORACLE_TAGS).sort()` filtered by `t.startsWith(partialText)`
- **`visible`** — `$derived(partialText !== null && filteredTags.length > 0 && query !== dismissedAtQuery)`
- **`handleSelect(tag)`** — calls `onselect(query.replace(/is:\S*$/i, 'is:' + tag + ' '))`. Trailing space causes regex not to match → dropdown closes naturally.
- **Click-outside** — `$effect` registers `mousedown` on document; sets `dismissedAtQuery = query` when click is outside `dropdownEl`
- **Space-dismiss** — emergent: space breaks `\S*` end-of-string match, `partialText` becomes `null`, dropdown disappears on next render
- **Dropdown layout** — `absolute left-0 right-0 top-full z-50 mt-1 max-h-64 overflow-y-auto rounded-md border bg-popover shadow-md`
- **Items** — `ORACLE_TAG_LABELS[tag]` on left, `is:tag` in muted text on right

### Task 3: +page.svelte wiring

Three changes:

1. Added import: `import IsTagAutocomplete from '$lib/components/cards/IsTagAutocomplete.svelte'`
2. Added `handleAutocompleteSelect(newQuery)` — sets `searchQuery`, clears debounce timer, resets page to 1, calls `updateUrl()`
3. Placed `<IsTagAutocomplete query={searchQuery} onselect={handleAutocompleteSelect} />` inside the existing `<div class="relative flex-1">` after the `<Input>` element

## Commits

| Hash    | Message                                                  |
| ------- | -------------------------------------------------------- |
| 24f29e2 | fix(13-01): partial is:TAG tokens are now no-ops         |
| 3e458cf | feat(13-01): create IsTagAutocomplete dropdown component |
| 42342d7 | feat(13-01): wire IsTagAutocomplete into search bar      |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed pre-existing `noUncheckedIndexedAccess` type error in CardGrid + CardTableView**

- **Found during:** Task 1 verification (`svelte-check`)
- **Issue:** `m[1].toLowerCase()` in `isTokens` map was typed as `string | undefined` due to `noUncheckedIndexedAccess: true` in tsconfig. The regex `(\S+)` guarantees `m[1]` is always defined when matched, but TypeScript can't infer this.
- **Fix:** Changed to `m[1]?.toLowerCase() ?? ''` — safe fallback (empty string never matches any tag key)
- **Files modified:** CardGrid.svelte, CardTableView.svelte (included in Task 1 commit)

**Total deviations:** 1 auto-fixed (pre-existing type error)

## Decisions Made

| Decision                          | Choice                                | Rationale                                                  |
| --------------------------------- | ------------------------------------- | ---------------------------------------------------------- |
| Dropdown dismiss mechanism        | dismissedAtQuery state per query      | Avoids boolean toggle that would prevent re-show on retype |
| Space-dismiss                     | Emergent from regex anchor            | No explicit keydown needed — clean and minimal             |
| Select event type                 | onmousedown + e.preventDefault()      | Fires before input blur so selection registers correctly   |
| Partial token filtering placement | knownIsTokens before oracle predicate | Unknown tags ignored, not silently rejected                |
