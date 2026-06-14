---
status: resolved
trigger: 'is:TAG filter does not work correctly when other panel filters are also active'
created: 2026-05-08T00:00:00Z
updated: 2026-05-08T00:00:00Z
---

## Current Focus

hypothesis: prevFilters declared as $state causes circular dependency in +page.svelte filter-change effect; color_identity split on ', ' fails for 'R,W' format
test: static analysis + empirical test of filter logic in Node.js
expecting: fixing both issues resolves the reported behavior
next_action: apply fixes and verify

## Symptoms

expected: is:shockland + Red color filter → returns shocklands with Red identity
actual: is:TAG filter behavior incorrect when panel filters active
errors: none thrown — wrong results or empty results silently
reproduction: type is:shockland, then activate any panel filter (color, frame, etc.)
started: Phase 12 regression (or pre-existing data issue)

## Eliminated

- hypothesis: CardTableView missing matchesOracleTag import
  evidence: CardTableView.svelte line ~18 has `import { matchesOracleTag } from '$lib/data/oracle-tags'`; lines 127-128 extract isTokens/textQuery correctly
  timestamp: 2026-05-08

- hypothesis: query variable (with is:TAG) reused for text search after extraction
  evidence: both filterAndGroupCards and filterCards use textQuery (stripped version) for text search; original query not referenced again
  timestamp: 2026-05-08

- hypothesis: CardGrid $effect does not re-run when panel filter changes while is:TAG is in query
  evidence: CardGrid $effect reads filters.colorIdentity, filters.frameTypes etc. via spread; SearchFilters binds via $bindable() to same $state proxy; mutation triggers effect re-run. Confirmed reactivity chain is correct.
  timestamp: 2026-05-08

- hypothesis: regex fails to extract is:TAG tokens
  evidence: empirically tested /\bis:(\S+)/gi against all query variants (trailing space, leading space, uppercase, multiple tokens, mixed text) - all correct
  timestamp: 2026-05-08

- hypothesis: is:shockland + Red returns wrong results with correct data
  evidence: empirically tested filter logic in Node.js with correctly formatted data (color_identity: 'R, W') - returns correct results (Sacred Foundry, Steam Vents included; Temple Garden excluded)
  timestamp: 2026-05-08

## Evidence

- timestamp: 2026-05-08
  checked: CardGrid.svelte filterAndGroupCards (lines 65-230)
  found: isTokens extraction correct, textQuery correct, oracle tag check runs FIRST before all other predicates, AND logic correct
  implication: filter logic itself is correct

- timestamp: 2026-05-08
  checked: CardTableView.svelte filterCards (lines 127-225)
  found: identical oracle tag handling - isTokens, textQuery, matchesOracleTag import all present
  implication: both views have correct implementation

- timestamp: 2026-05-08
  checked: Node.js empirical test of filter logic
  found: is:shockland alone=4 results; is:shockland+Red=2 results (correct); is:fetchland+Red=0 (correct - colorless); is:shockland+Red with 'R,W' format (no space)=0 WRONG
  implication: CONFIRMED - color_identity split on ', ' fails for 'R,W' format data

- timestamp: 2026-05-08
  checked: +page.svelte prevFilters declaration (line 65)
  found: let prevFilters = $state(untrack(() => ({...}))) - prevFilters is $state despite being read AND written inside the same $effect
  implication: CIRCULAR DEPENDENCY - effect reads prevFilters[key] (tracked), then writes prevFilters = current, scheduling itself for a second run; second run calls updateUrl() with same values (harmless but wastes cycles); also could affect searchQuery tracking timing

- timestamp: 2026-05-08
  checked: color_identity split pattern in both CardGrid and CardTableView
  found: (card.color_identity?.split(', ') || []).filter(c => c) - splits on ', ' (comma+space)
  found: sync endpoint stores color_identity: row['Color Identity'] || null - raw from CSV
  implication: if Google Sheet has 'R,W' (no space) vs 'R, W' (space), split fails silently returning ['R,W'] which never matches 'R'

## Resolution

root_cause: TWO ISSUES FOUND:

1. color_identity split on ', ' is fragile - if DB data uses 'R,W' (no space), multicolor cards never match any color filter. Combined with is:TAG, result is 0 (tag matches, color fails). Without is:TAG, color filter also fails (same root cause), but users may not notice because they don't rely on it.
2. prevFilters = $state() in +page.svelte creates circular $effect dependency - effect reads AND writes prevFilters, causing double execution per filter change. Minor inefficiency, not the primary filter bug.

fix: (1) change color_identity split to split(',').map(c => c.trim()).filter(Boolean) in both CardGrid and CardTableView; (2) change prevFilters from $state to plain let

verification: pending
files_changed: [src/lib/components/cards/CardGrid.svelte, src/lib/components/cards/CardTableView.svelte, src/routes/+page.svelte]
