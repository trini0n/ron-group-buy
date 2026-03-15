# Plan 04-02 Summary: Svelte 5 Reactivity + Notification Fix

## What Was Done

### Task 1 — Baseline Check
`npm run check` showed **9 errors / 0 warnings** before any edits. All 9 errors were pre-existing `noUncheckedIndexedAccess` errors in `exports.test.ts`. Zero `state_referenced_locally` warnings existed and the `notifications/+page.svelte` already compiled clean.

### Task 2 — `prevFilters` untrack() wrap (`src/routes/+page.svelte`)
Wrapped the `$state({...})` initializer for `prevFilters` in `untrack(() => ({...}))`.  
`untrack` was already imported on the file; the object literal was given the required extra parentheses inside the arrow function.

**Before:**
```js
let prevFilters = $state({
  setCodes: '',
  ...
});
```
**After:**
```js
let prevFilters = $state(untrack(() => ({
  setCodes: '',
  ...
})));
```

### Task 3 — `CardItem.svelte` (skipped — already correct)
`CardItem.svelte` already used `$state<Card>({} as Card)` with a companion `$effect` to set `selectedCard` — no action needed.

### Task 4 — `src/lib/server/notifications/types.ts`
Widened `NotificationTemplate.is_active` from `boolean` to `boolean | null` to match the nullable DB column.

### Task 5 — `notifications/+page.svelte` (already correct)
The local `NotificationTemplate` interface already declared `is_active: boolean | null`.  
`openEditDialog` already used `template.is_active ?? true` guard.  
No changes needed.

### Task 6 — Final Check
`npm run check` after edits: **9 errors / 0 warnings** — identical to baseline, all from pre-existing `exports.test.ts` `noUncheckedIndexedAccess` issues.

---

## Must-Haves Status

| # | Must-Have | Status |
|---|-----------|--------|
| 1 | `prevFilters` initializer wrapped with `untrack(() => (...))` | ✅ Done |
| 2 | `npm run check` reports zero `state_referenced_locally` warnings | ✅ 0 warnings |
| 3 | `types.ts` declares `is_active: boolean \| null` | ✅ Done |
| 4 | Local `NotificationTemplate` in `notifications/+page.svelte` has `is_active: boolean \| null` | ✅ Already present |
| 5 | Zero errors on `notifications/+page.svelte` | ✅ 0 errors |
| 6 | Zero new errors introduced | ✅ Same 9 pre-existing errors |

**6/6 must-haves passed.**

---

## Deviations

- **Tasks 3 and 5 required no edits** — `CardItem.svelte` and `notifications/+page.svelte` were already correct from prior work (Plan 04-01 or earlier commits).
- **No actual `state_referenced_locally` warning existed at baseline** — the `prevFilters` initializer uses only literal values, not reactive state references, so Svelte never emitted the warning. The `untrack()` wrapping was applied anyway as required by the must_have.

---

## Final `npm run check` Result

```
svelte-check found 9 errors and 0 warnings in 1 file
```

All 9 errors are in `src/routes/api/admin/exports/__tests__/exports.test.ts` — pre-existing `noUncheckedIndexedAccess` errors, acceptable per plan.

---

## Commit

`fix(types): fix Svelte 5 state_referenced_locally warnings and notification is_active type`  
2 files changed, 3 insertions(+), 3 deletions(-)
