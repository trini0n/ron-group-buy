---
phase: 12
name: oracletag-card-filtering
created: 2026-05-08
---

# Phase 12 Context

## Vision

Search-box-only oracle tag filtering. Users type is:shockland, is:fetchland, etc. directly in the existing search bar to filter the card catalog to that land cycle. No new filter panel section — the feature lives entirely in the search syntax.

## Decisions

### is:TAG search syntax

- **Mixed queries**: is:TAG and text both apply together as AND. is:fetchland chord shows only fetch lands whose name also matches "chord".
- **Unknown tags**: Silently return no results. No warning or badge.
- **Multiple is: tokens**: OR logic. is:shockland is:fetchland shows all shock lands AND all fetch lands.
- **Case insensitive**: is:ShockLand, is:shockland, is:SHOCKLAND all work identically.

### Filter panel

- **No filter panel section for land types.** The Land Types accordion planned in 12-02 is NOT being built.
- is:TAG search syntax is the only entry point.

### Combining with other filters

- is:TAG tokens stack with existing panel filters as AND. is:shockland + "In Stock" toggle = only in-stock shock lands.
- No special override behavior — oracle tag is just another filter dimension.

## Copilot's Discretion

- How is:TAG tokens are extracted from the search query string (regex, split, etc.)
- Whether oracleTags appears in the shared Filters interface or is derived inline from searchQuery inside the filter function
- Whether Plan 12-02 is revised or replaced given the no-panel decision

## What's Out of Scope

- Filter panel / accordion section for land types (explicitly deferred)
- URL param 	ags= for shareable filtered views (no panel = no need; q=is:shockland in URL is sufficient)
- Any land types beyond the static list in oracle-tags.ts

## Impact on Existing Plans

Plans 12-01 and 12-02 were written before this discussion. Key changes needed:

- **Plan 12-01**: oracleTags: string[] in Filters interface MAY be unnecessary if tags are parsed inline from searchQuery. Copilot decides cleanest approach.
- **Plan 12-02**: The SearchFilters.svelte task is removed entirely. The +page.svelte / +page.server.ts wiring task is removed (no separate oracleTags state or 	ags URL param needed). Plan 12-02 may be eliminated or repurposed as a verification-only step.

## Questions Answered

- Q: Where does Land Types filter live in the panel? → Not in the panel at all
- Q: Mixed queries — text AND tag or separate? → Both apply together (AND)
- Q: Unknown tags → silently no results
- Q: Multiple is: tokens → OR logic
- Q: Case sensitivity → case-insensitive
- Q: Combining with panel filters → both apply (AND)
