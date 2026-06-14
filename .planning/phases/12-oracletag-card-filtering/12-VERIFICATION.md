---
phase: 12-oracletag-card-filtering
verified: 2026-05-08T00:00:00Z
status: passed
score: 6/6 must-haves verified
gaps: []
---

# Phase 12: Oracle Tag Card Filtering — Verification Report

**Phase Goal:** Users can type `is:TAG` (e.g. `is:shockland`, `is:fetchland`) directly in the search box to filter the card catalog to named land cycles.
**Verified:** 2026-05-08
**Status:** ✅ PASSED
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| #  | Truth                                                              | Status     | Evidence                                                                                        |
|----|-------------------------------------------------------------------|------------|-------------------------------------------------------------------------------------------------|
| 1  | Typing `is:shockland` shows only the 10 shock lands              | ✓ VERIFIED | isTokens=['shockland']; ORACLE_TAGS['shockland'] = 10 entries; no textQuery gate after          |
| 2  | `is:shockland is:fetchland` shows 20 cards (OR)                  | ✓ VERIFIED | `isTokens.some((tag) => matchesOracleTag(...))` — OR across tokens; 10+10=20 pass               |
| 3  | `is:shockland blood` shows only Blood Crypt (AND)                 | ✓ VERIFIED | Tag gate first (10 shock lands), then textQuery='blood' eliminates all except Blood Crypt       |
| 4  | `is:unknowntag` → 0 results, no console error                    | ✓ VERIFIED | `ORACLE_TAGS['unknowntag']` = undefined → `return false` silently; no console.error call        |
| 5  | `is:ShockLand` produces same results as `is:shockland`            | ✓ VERIFIED | Regex `/\bis:(\S+)/gi` (i flag) + `.map(m => m[1].toLowerCase())` normalizes to 'shockland'    |
| 6  | Panel inStockOnly + `is:shockland` stacks as AND                  | ✓ VERIFIED | oracle tag gate is separate from `if (f.inStockOnly && !card.is_in_stock) return false` gate    |

**Score:** 6/6 truths verified

---

### Required Artifacts

| Artifact                                        | Expected                                                   | Status     | Details                                                                  |
|-------------------------------------------------|------------------------------------------------------------|------------|--------------------------------------------------------------------------|
| `src/lib/data/oracle-tags.ts`                   | exports ORACLE_TAGS (16 keys), ORACLE_TAG_LABELS, matchesOracleTag | ✓ VERIFIED | 16 keys confirmed; 16 labels confirmed; function exists and is correct   |
| `src/lib/components/cards/CardGrid.svelte`      | imports matchesOracleTag, parses is:TAG inline             | ✓ VERIFIED | Import on line 9; isTokens parsing on line ~61; OR logic on line ~68     |
| `src/lib/components/cards/CardTableView.svelte` | imports matchesOracleTag, parses is:TAG inline             | ✓ VERIFIED | Import on line 19; isTokens parsing on line 127; OR logic on line 133    |

---

### Key Link Verification

| From                    | To                         | Via                                     | Status     | Details                                                               |
|-------------------------|----------------------------|-----------------------------------------|------------|-----------------------------------------------------------------------|
| `CardGrid.svelte`       | `$lib/data/oracle-tags`    | `import { matchesOracleTag }`           | ✓ WIRED    | Line 9: `import { matchesOracleTag } from '$lib/data/oracle-tags'`   |
| `CardTableView.svelte`  | `$lib/data/oracle-tags`    | `import { matchesOracleTag }`           | ✓ WIRED    | Line 19: `import { matchesOracleTag } from '$lib/data/oracle-tags'`  |
| `filterAndGroupCards()` | `matchesOracleTag`         | `isTokens.some(tag => matchesOracleTag(card.card_name, tag))` | ✓ WIRED | Called inside filter predicate — OR logic across all is:TAG tokens |
| `filterCards()`         | `matchesOracleTag`         | `isTokens.some(tag => matchesOracleTag(card.card_name, tag))` | ✓ WIRED | Identical pattern in CardTableView                                   |

---

### Locked Constraints Verification

| Constraint                                                  | Status     | Evidence                                                                      |
|-------------------------------------------------------------|------------|-------------------------------------------------------------------------------|
| `SearchFilters.svelte` NOT modified (no oracleTags panel)  | ✓ CLEAN    | Filters interface: no oracleTags field; no oracle-tags import                 |
| `+page.svelte` NOT modified                                 | ✓ CLEAN    | filters state object: no oracleTags field; no oracle-tags import              |
| `+page.server.ts` NOT modified                              | ✓ CLEAN    | No oracle-tags import; standard card fetch logic only                         |
| Filters interface has no oracleTags field                  | ✓ CLEAN    | Confirmed in CardGrid, CardTableView, and SearchFilters Filters interfaces    |

---

### TypeScript Validation

`npx tsc --noEmit` — **zero errors in Phase 12 files**.

Pre-existing errors in unrelated admin API routes (`check-new/+server.ts`, `bulk-tracking/+server.ts`) were present before Phase 12 and are not regressions.

---

### Anti-Patterns Found

None detected. No TODOs, FIXMEs, placeholder content, empty returns, or console.log stubs in oracle-tags.ts, CardGrid.svelte, or CardTableView.svelte.

---

### Filter Logic Trace (Key Behaviors)

**OR across tags (`is:shockland is:fetchland`):**
```typescript
const isTokens = [...query.matchAll(/\bis:(\S+)/gi)].map((m) => m[1].toLowerCase())
// isTokens = ['shockland', 'fetchland']
if (isTokens.length > 0) {
  if (!isTokens.some((tag) => matchesOracleTag(card.card_name, tag))) return false
  // .some() = OR: card passes if it matches ANY token
}
```

**AND with text query (`is:shockland blood`):**
```typescript
const textQuery = query.replace(/\bis:\S+/gi, '').trim()
// textQuery = 'blood'  (is:shockland stripped out)
// Gate 1: oracle tag filter (passes only shock lands)
// Gate 2: text filter (passes only names containing 'blood')
// Both gates must pass = AND
```

**Silent unknown tag (`is:unknowntag`):**
```typescript
export function matchesOracleTag(cardName: string, tag: string): boolean {
  const cardNames = ORACLE_TAGS[tag.toLowerCase()]  // undefined for unknown tag
  if (!cardNames) return false  // silent false — no console.error
  ...
}
```

**Case-insensitive (`is:ShockLand`):**
```typescript
const isTokens = [...query.matchAll(/\bis:(\S+)/gi)]  // i flag on regex
  .map((m) => m[1].toLowerCase())  // explicit lowercase
// 'ShockLand' -> 'shockland'
```

**Panel filter AND stacking (inStockOnly + is:shockland):**
```typescript
// Oracle tag gate (from is:TAG) and inStockOnly gate are independent sequential guards:
if (isTokens.length > 0) {
  if (!isTokens.some((tag) => matchesOracleTag(card.card_name, tag))) return false
}
// ... (other filters) ...
if (f.inStockOnly && !card.is_in_stock) return false  // separate AND gate
```

---

### Human Verification Required

None required for automated checks. All 6 must-haves are verifiable through pure static analysis of deterministic filter functions.

The following constitutes optional acceptance testing but does not block the pass verdict:

| Test | Expected |
|------|----------|
| Type `is:shockland` in live search box | See exactly Blood Crypt, Breeding Pool, Godless Shrine, Hallowed Fountain, Overgrown Tomb, Sacred Foundry, Steam Vents, Stomping Ground, Temple Garden, Watery Grave |
| Type `is:ShockLand` (mixed case) | Same 10 results |
| Type `is:shockland is:fetchland` | 20 results: all 10 shock + 10 fetch lands |
| Type `is:shockland blood` | 1 result: Blood Crypt only |
| Type `is:unknowntag` | 0 results, no console error |
| Enable "In Stock Only" + type `is:shockland` | Only in-stock shock lands |

---

_Verified: 2026-05-08_
_Verifier: GitHub Copilot (gsd-verifier)_
