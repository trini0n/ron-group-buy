---
phase: 12-oracletag-card-filtering
plan: '01'
subsystem: card-catalog
tags: [oracle-tags, search, filtering, lands]
requires: []
provides:
  - Static oracle tag data (16 land cycles)
  - is:TAG search-box syntax for card catalog
affects:
  - Any future search autocomplete (pending todo)
tech-stack:
  added: []
  patterns:
    - Inline query token parsing (is:TAG extracted before text search)
    - OR semantics across multiple is:TAG tokens
    - AND semantics between is:TAG and text query + panel filters
key-files:
  created:
    - src/lib/data/oracle-tags.ts
  modified:
    - src/lib/components/cards/CardGrid.svelte
    - src/lib/components/cards/CardTableView.svelte
decisions:
  - is:TAG lives in search box only — no filter panel UI
  - Multiple is: tokens use OR logic
  - is:TAG AND text query AND panel filters all stack as AND
  - Unknown tags silently return no results (no error)
  - Case-insensitive matching
metrics:
  duration: ~10 minutes
  completed: 2026-05-08
---

# Phase 12 Plan 01: OracleTag Card Filtering Summary

**One-liner:** Static oracle tag data + is:TAG inline search-box parsing for 16 land cycles in CardGrid and CardTableView.

## What Was Built

### Task 1: src/lib/data/oracle-tags.ts

Created a new static data file with three exports:

- **`ORACLE_TAGS`** — `Record<string, readonly string[]>` mapping 16 lowercase tag keys to arrays of exact card names. Cycles covered: shockland, fetchland, checkland, fastland, painland, scryland, vergeland, bounceland, filterland, triome, bondland, slowland, canopyland, bicycle, manland, basicland.
- **`ORACLE_TAG_LABELS`** — Human-readable display names for each tag key.
- **`matchesOracleTag(cardName, tag)`** — Case-insensitive helper that returns `false` for unknown tags (no error thrown).

### Task 2: CardGrid.svelte + CardTableView.svelte

Added `is:TAG` parsing inline into both filter functions:

1. **Import added** to both components: `import { matchesOracleTag } from '$lib/data/oracle-tags'`
2. **Token extraction** at the top of each filter function body:
   ```ts
   const isTokens = [...query.matchAll(/\bis:(\S+)/gi)].map((m) => m[1].toLowerCase())
   const textQuery = query.replace(/\bis:\S+/gi, '').trim()
   ```
3. **Oracle tag predicate** (OR across tokens): card must match at least one `is:` token
4. **Text predicate** uses `textQuery` (is:TAG tokens stripped) — ANDs with oracle tag result
5. **Panel filters** continue to AND with everything — unchanged

**Nothing else was touched:** `Filters` interface, `Props` interface, `SearchFilters.svelte`, `+page.svelte`, `+page.server.ts` all untouched.

## Commits

| Hash    | Message                                                         |
| ------- | --------------------------------------------------------------- |
| 5b0809a | feat(12-01): create oracle-tags static data file                |
| 1a775c3 | feat(12-01): add is:TAG inline parsing to card filter functions |

## Decisions Made

| Decision              | Choice                        | Rationale                                               |
| --------------------- | ----------------------------- | ------------------------------------------------------- |
| UI placement          | Search box only               | No filter panel section, SearchFilters.svelte untouched |
| Multi-token logic     | OR across is: tokens          | `is:shockland is:fetchland` shows both cycles           |
| Cross-filter stacking | AND with text + panel filters | `is:shockland blood` → Blood Crypt only                 |
| Unknown tags          | Silent empty result           | No console error, just no cards                         |
| Case sensitivity      | Case-insensitive              | `is:ShockLand` === `is:shockland`                       |

## Deviations from Plan

None — plan executed exactly as written.

## Verification

- TypeScript: No new errors introduced in modified files (pre-existing errors in unrelated server routes)
- Both files import `matchesOracleTag` from `$lib/data/oracle-tags`
- `Filters` interface in both files is unchanged (no `oracleTags` field)
- `oracle-tags.ts` exports: `ORACLE_TAGS` (16 keys), `ORACLE_TAG_LABELS` (16 keys), `matchesOracleTag`
