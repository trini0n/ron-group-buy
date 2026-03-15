# Phase 04: Type Safety — Research Findings

**Date**: 2026-03-14  
**Goal**: `svelte-check` passes clean — all `@ts-ignore` / `as any` casts removed, Svelte 5 `state_referenced_locally` warnings resolved, notification settings compile error fixed.

---

## 1. DB Type Regeneration

### Exact Command

```bash
npm run db:generate
```

Which runs:

```bash
supabase gen types typescript --local > src/lib/server/database.types.ts
```

- Uses `--local` flag → connects to the local Supabase Docker instance (must be running: `supabase start`)
- Requires the `supabase` CLI (`devDependency`: `"supabase": "^2.70.5"`)
- Output file: `src/lib/server/database.types.ts`

**Remote alternative** (if no local Docker):

```bash
supabase gen types typescript --project-id <PROJECT_ID> > src/lib/server/database.types.ts
```

Project ID is found in the Supabase dashboard URL: `https://supabase.com/dashboard/project/<PROJECT_ID>`.

### What's Missing from Current Types

The current `database.types.ts` was last generated **before** these migrations ran:

| Migration                                  | Added                                                                                           |
| ------------------------------------------ | ----------------------------------------------------------------------------------------------- |
| `20260225_add_phone_number.sql`            | `addresses.phone_number TEXT` (nullable), `orders.shipping_phone_number TEXT` (nullable)        |
| `20260310000000_card_type_pricing.sql`     | `card_type_pricing` table (`card_type TEXT PK`, `price DECIMAL(4,2)`, `updated_at TIMESTAMPTZ`) |
| `20260113000000_notifications_feature.sql` | `notification_templates` table — `is_active BOOLEAN DEFAULT true` (no NOT NULL → nullable)      |

**Confirmed**: `phone_number`, `shipping_phone_number`, and `card_type_pricing` are **absent** from the current `database.types.ts`. The `notification_templates` table is also absent.

### Post-Regen Shape

After regen, the generated types will include:

```ts
// addresses.Row
phone_number: string | null

// addresses.Insert / addresses.Update
phone_number?: string | null

// orders.Row
shipping_phone_number: string | null

// orders.Insert / orders.Update
shipping_phone_number?: string | null

// card_type_pricing.Row
card_type: string
price: number          // DECIMAL maps to number
updated_at: string | null

// notification_templates.Row
is_active: boolean | null   // BOOLEAN DEFAULT true, no NOT NULL
```

### Regen Risk

- **Low risk**: regen is purely additive when adding new tables/columns. Existing table shapes are re-read from the live schema.
- **Real risk**: if any existing column type changed in a migration (e.g., a TEXT → UUID rename), regen will update it and break downstream usages. Review the diff after running `db:generate`.
- **`__InternalSupabase.PostgrestVersion`** is preserved by the CLI — no action needed.
- After regen, run `npm run check` immediately to surface any breakage before fixing the `@ts-ignore` annotations.

---

## 2. Schema Drift: `@ts-ignore` Removal Patterns

### Affected Files (6 `@ts-ignore` annotations)

#### `src/routes/api/orders/+server.ts`

Five `@ts-ignore` blocks, all related to `phone_number` on `addresses` and `shipping_phone_number` on `orders`.

**Pattern A — reading a field from an address row** (lines 172, 183):

```ts
// BEFORE
// @ts-ignore: phone_number not yet typed in generated types
if (address.phone_number !== String(phoneNumber).trim()) {
  ...
  // @ts-ignore: phone_number not yet typed in generated types
  address.phone_number = String(phoneNumber).trim()
}

// AFTER (after db:generate adds phone_number to addresses.Row)
if (address.phone_number !== String(phoneNumber).trim()) {
  ...
  address.phone_number = String(phoneNumber).trim()
}
```

**Pattern B — writing in `.update({})` call** (line 176):

```ts
// BEFORE
// @ts-ignore: phone_number not yet typed in generated types
.update({ phone_number: String(phoneNumber).trim() })

// AFTER
.update({ phone_number: String(phoneNumber).trim() })
```

**Pattern C — writing in `.insert({})` call** (line 204):

```ts
// BEFORE
const { data: savedAddress, error: saveError } = await locals.supabase.from('addresses').insert({
  user_id: locals.user.id,
  ...newAddress,
  // @ts-ignore: phone_number not yet typed in generated types
  phone_number: String(phoneNumber).trim(),
  is_default: true
})

// AFTER
const { data: savedAddress, error: saveError } = await locals.supabase.from('addresses').insert({
  user_id: locals.user.id,
  ...newAddress,
  phone_number: String(phoneNumber).trim(),
  is_default: true
})
```

**Pattern D — in order insert** (line 266):

```ts
// BEFORE
// @ts-ignore: shipping_phone_number not yet typed in generated types
shipping_phone_number: String(phoneNumber).trim(),

// AFTER
shipping_phone_number: String(phoneNumber).trim(),
```

#### `src/routes/profile/+page.svelte`

One `@ts-ignore` in an inline interface definition (lines 42, 660–661 use the same workaround). The profile page defines a local address interface with the field commented:

```ts
// BEFORE
interface Address {
  // ...
  // @ts-ignore: added phone_number to db
  phone_number?: string | null
}

// AFTER
interface Address {
  // ...
  phone_number?: string | null // now in generated types — no ignore needed
}
```

**Note**: The profile page defines its own `Address` interface rather than importing the DB type directly. The `@ts-ignore` can simply be deleted; the field is already typed correctly as `string | null`.

#### `src/routes/orders/[id]/+page.svelte`

One `@ts-ignore` at line 207 — same pattern as profile. After regen, the address type will include `phone_number`.

---

## 3. `supabase as any` Casts

### `src/lib/server/pricing.ts` (line 26)

**Root cause**: `fetchPrices` accepts `SupabaseClient` (generic, no `Database` type argument), so `.from('card_type_pricing')` is unknown. After regen, `card_type_pricing` will exist in the `Database` type.

**Fix — change the parameter type**:

```ts
// BEFORE
import type { SupabaseClient } from '@supabase/supabase-js'
// ...
export async function fetchPrices(supabase: SupabaseClient): Promise<CardPrices> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from('card_type_pricing')
    .select('card_type, price')

// AFTER
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '$lib/server/database.types'
// ...
export async function fetchPrices(supabase: SupabaseClient<Database>): Promise<CardPrices> {
  const { data, error } = await supabase
    .from('card_type_pricing')
    .select('card_type, price')
```

After this change, each `row` in `data` will be typed as `{ card_type: string; price: number; updated_at: string | null }` — the explicit cast in the `.map()` can be removed or kept (it's harmless but redundant).

**All callers of `fetchPrices`** already pass `locals.supabase` which is `SupabaseClient<Database>` — no call-site changes needed.

### `src/routes/admin/settings/pricing/+page.server.ts` (line 17)

**Root cause**: same — `card_type_pricing` absent from generated types.

```ts
// BEFORE
const { data: pricing, error: dbError } = await (locals.supabase as any)
  .from('card_type_pricing')
  .select('card_type, price')
  .order('card_type')

// AFTER
const { data: pricing, error: dbError } = await locals.supabase
  .from('card_type_pricing')
  .select('card_type, price')
  .order('card_type')
```

`locals.supabase` is already `SupabaseClient<Database>` (declared in `src/app.d.ts`). Once `card_type_pricing` is in the generated types, this cast is unnecessary.

---

## 4. `checkForNewProviderConflict` — `supabase: any` Parameter

### Location: `src/routes/auth/callback/+server.ts` (lines 53, 114)

**Root cause**: The private helper `checkForNewProviderConflict` was written with `supabase: any` even though `checkProviderConflict` (which it calls) is already properly typed as `SupabaseClient<Database>`.

**Fix — import and use the correct type**:

```ts
// BEFORE (auth/callback/+server.ts)
import { redirect } from '@sveltejs/kit'
import type { RequestHandler } from './$types'
import { createAdminClient } from '$lib/server/admin'
import { checkProviderConflict, buildConflictRedirectUrl } from '$lib/auth/conflicts'
import { logger } from '$lib/server/logger'
// ...
async function checkForNewProviderConflict(
  supabase: any,
  user: { ... }
) {

// AFTER
import { redirect } from '@sveltejs/kit'
import type { RequestHandler } from './$types'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '$lib/server/database.types'
import { createAdminClient } from '$lib/server/admin'
import { checkProviderConflict, buildConflictRedirectUrl } from '$lib/auth/conflicts'
import { logger } from '$lib/server/logger'
// ...
async function checkForNewProviderConflict(
  supabase: SupabaseClient<Database>,
  user: { ... }
) {
```

**Correct import path**: `SupabaseClient` from `@supabase/supabase-js` (not `@supabase/ssr`). This is consistent with:

- `src/app.d.ts`: `import type { SupabaseClient, Session, User } from '@supabase/supabase-js'`
- `src/lib/server/pricing.ts`: `import type { SupabaseClient } from '@supabase/supabase-js'`
- `src/lib/auth/conflicts.ts`: `import type { SupabaseClient } from '@supabase/supabase-js'`

The `@supabase/ssr` package provides `createServerClient` / `createBrowserClient` factories — the `SupabaseClient` type itself always comes from `@supabase/supabase-js`.

The call site passes `locals.supabase` which is already `SupabaseClient<Database>` — this change just propagates the type correctly into the helper.

---

## 5. Svelte 5 `state_referenced_locally` Warnings (8 total)

### Understanding the Warning

Svelte 5 emits `state_referenced_locally` when a reactive value (prop or `$state`) is captured as the **initial value** of another `$state()` variable. The problem: the captured value is frozen at init time and doesn't follow subsequent changes.

```svelte
// WRONG — captures initial value of `card` only
let selectedCard = $state<Card>(card);

// ALSO WRONG — captures initial values of `filters` fields
let prevFilters = $state({
  setCodes: filters.setCodes.join(','),
  ...
});
```

### Fix 1: `src/lib/components/cards/CardItem.svelte` (line 23)

**Context**: `selectedCard` needs to be mutable (user can change the selected finish variant), so `$derived` is not suitable by itself. The correct approach — already partially in place — is to initialize to an empty/sentinel value and populate via `$effect`:

```svelte
// BEFORE (original — triggers warning)
let selectedCard = $state<Card>(card);

// AFTER (already in the file per current read, but kept here for completeness)
let selectedCard = $state<Card>({} as Card);

$effect(() => {
  const inStock = finishVariants.find(v => v.is_in_stock);
  selectedCard = inStock || finishVariants[0] || card;
});
```

**Current state of file**: The file already shows `$state<Card>({} as Card)` with `$effect(...)`. If `svelte-check` still warns on this file, confirm the `svelte-check-output.txt` is stale (it was generated before the current code was written). Run a fresh `npm run check` to verify.

**Alternative (cleaner) — use `$derived` if no user mutation needed on init**:

```svelte
// If selectedCard only derives from props and user clicks:
let selectedCard = $derived(
  finishVariants.find(v => v.is_in_stock) || finishVariants[0] || card
);
```

This removes the warning entirely. However `$derived` values are read-only; if `selectedCard` is assigned on user interaction, keep the `$state({}) + $effect` pattern.

### Fix 2: `src/routes/+page.svelte` (lines 57–65, 8 warnings)

**Context**: `prevFilters` is used to detect "actual filter changes" vs pagination changes. It captures `filters` state inline in `$state({...})` which references the live `filters` object — 8 separate `state_referenced_locally` warnings (one per field of `filters`, plus `viewMode`).

**Root cause** (line 57–65):

```ts
let prevFilters = $state({
  setCodes: filters.setCodes.join(','), // 6 warnings — all reference `filters`
  colorIdentity: filters.colorIdentity.join(','),
  colorIdentityStrict: filters.colorIdentityStrict,
  priceCategories: filters.priceCategories.join(','),
  cardTypes: filters.cardTypes.join(','),
  frameTypes: filters.frameTypes.join(','),
  inStockOnly: filters.inStockOnly,
  isNew: filters.isNew,
  viewMode: viewMode // 1 warning — references `viewMode`
})
```

**Fix — initialize with stable defaults, populate in `onMount` or use `untrack`**:

```ts
import { untrack } from 'svelte'

// Option A: use untrack to snapshot initial values without establishing reactivity
let prevFilters = $state(
  untrack(() => ({
    setCodes: filters.setCodes.join(','),
    colorIdentity: filters.colorIdentity.join(','),
    colorIdentityStrict: filters.colorIdentityStrict,
    priceCategories: filters.priceCategories.join(','),
    cardTypes: filters.cardTypes.join(','),
    frameTypes: filters.frameTypes.join(','),
    inStockOnly: filters.inStockOnly,
    isNew: filters.isNew,
    viewMode: viewMode
  }))
)
```

**Note**: `untrack` is already imported in this file (`import { untrack } from 'svelte'`) and used for `initialFilters`. Wrapping the `$state({...})` init in `untrack(() => ...)` is the idiomatic Svelte 5 solution — it reads the current values without creating reactive dependencies, eliminating all 8 warnings.

**Option B — `$derived`** (if `prevFilters` is purely derived, never manually updated):

```ts
const prevFilters = $derived({
  setCodes: filters.setCodes.join(','),
  ...
});
```

However, based on the codebase, `prevFilters` appears to be compared against the current state and then updated — meaning it needs to be mutable `$state`. Use **Option A (`untrack`)**.

---

## 6. Notification Settings Compile Error

### Location: `src/routes/admin/settings/notifications/+page.svelte` (line 174)

**Full svelte-check error**:

```
Error: Argument of type '{ body_template: string; channel: string; created_at: string | null;
  id: string; is_active: boolean | null; subject: string | null; type: string;
  updated_at: string | null; }' is not assignable to parameter of type 'NotificationTemplate'.
  Types of property 'is_active' are incompatible.
    Type 'boolean | null' is not assignable to type 'boolean'.
```

### Root Cause Analysis

There are **two** `NotificationTemplate` definitions:

| Source                                            | `is_active` type            |
| ------------------------------------------------- | --------------------------- |
| Local interface in `+page.svelte` (line 20)       | `boolean \| null`           |
| `src/lib/server/notifications/types.ts` (line 72) | `boolean` (strict, no null) |

The DB column `is_active BOOLEAN DEFAULT true` has **no NOT NULL constraint** (migration line 47) → the DB/Supabase treats it as nullable. After `db:generate`, the `notification_templates` table will appear in `database.types.ts` with `is_active: boolean | null`.

The server-side `NotificationTemplate` in `types.ts` has `is_active: boolean` (wrong — too strict). The server load function returns templates as this type. SvelteKit's type inference then types `data.templates` items with `is_active: boolean`. When that is passed to `openEditDialog(template: NotificationTemplate)` where the local `NotificationTemplate.is_active: boolean | null`, the direction of assignability is fine (`boolean` ⊆ `boolean | null`).

However there is a second error at line 181 (the `toggleActive` call) and the actual mismatch occurs because `data.templates` actual runtime values can have `is_active: null`, causing Supabase's return type to widen to `boolean | null`. The `openEditDialog` function resolves `NotificationTemplate` from the local interface scope, but TypeScript may resolve it from the server-generated PageData type in certain SvelteKit versions.

**Definitive fix**: Update the server-side type to match DB reality, then use a null-coalescing guard in the component.

### Fix A — Update server-side `NotificationTemplate` type

In `src/lib/server/notifications/types.ts`:

```ts
// BEFORE
export interface NotificationTemplate {
  id: string
  type: NotificationType
  channel: NotificationChannel
  subject: string | null
  body_template: string
  is_active: boolean // ← too strict; DB column has no NOT NULL
  updated_at: string
  created_at: string
}

// AFTER
export interface NotificationTemplate {
  id: string
  type: NotificationType
  channel: NotificationChannel
  subject: string | null
  body_template: string
  is_active: boolean | null // matches DB column (BOOLEAN DEFAULT true, nullable)
  updated_at: string | null // also no NOT NULL in DB
  created_at: string
}
```

### Fix B — Update local interface in `+page.svelte`

The local `NotificationTemplate` in the svelte file already has `is_active: boolean | null` (line 26). No change needed there. Verify it's consistent after Fix A.

### Fix C — Null-coalesce at usage sites in the component

In the toggle and edit logic where a strict `boolean` is needed:

```ts
// openEditDialog — when copying template into editingTemplate
function openEditDialog(template: NotificationTemplate) {
  editingTemplate = { ...template, is_active: template.is_active ?? true }
  // ...
}

// toggleActive — when flipping the flag
async function toggleActive(template: NotificationTemplate) {
  const newIsActive = !(template.is_active ?? true)
  // ...
}
```

**Recommendation**: Apply both Fix A (server type) and Fix C (null coalesce at usage) — Fix A makes the types honest, Fix C makes the runtime logic safe.

---

## 7. `src/routes/card/[setCode]/[collectorNum]/[slug]/+page.svelte`

The svelte-check output also shows one additional `state_referenced_locally` warning (not in CONCERNS.md):

```
Warn: This reference only captures the initial value of `data`. Did you mean to reference it
inside a derived instead?
  let selectedCard = $state<CardType>(data.card);
```

**Fix** (same `untrack` pattern):

```svelte
let selectedCard = $state<CardType>(untrack(() => data.card));
```

Or if `selectedCard` needs reactivity when the route changes (it likely does for SvelteKit navigation):

```svelte
let selectedCard = $derived(data.card);
// (plus any user selection override logic handled separately)
```

---

## 8. Implementation Order

The correct order to execute this phase to avoid breaking intermediate states:

1. **Start Supabase local** — `supabase start` (or ensure Docker is running)
2. **Regenerate types** — `npm run db:generate` → review the diff in `database.types.ts`
3. **Remove `@ts-ignore` in `+server.ts` and `.svelte` files** — now safe since schema fields exist in types
4. **Fix `as any` casts** — update `pricing.ts` parameter type and remove casts in `pricing/+page.server.ts`
5. **Fix `checkForNewProviderConflict`** — add `SupabaseClient<Database>` import and fix parameter type
6. **Fix Svelte 5 warnings** — apply `untrack(...)` wrapper to `prevFilters` init; verify `CardItem.svelte` is already fixed
7. **Fix notification type** — update server `NotificationTemplate.is_active` to `boolean | null`; add null coalesce guards
8. **Run `npm run check`** — verify 0 errors, 0 warnings
9. **Run `npm run test:unit`** — confirm no regression

---

## 9. Key Imports Reference

```ts
// Correct SupabaseClient import for this codebase
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '$lib/server/database.types'

// Typed client (matches app.d.ts and all server files)
type TypedSupabase = SupabaseClient<Database>

// untrack — already in node_modules svelte
import { untrack } from 'svelte'
```

---

## 10. Summary of Changes

| File                                                           | Change                                                         | Type           |
| -------------------------------------------------------------- | -------------------------------------------------------------- | -------------- |
| `src/lib/server/database.types.ts`                             | `npm run db:generate`                                          | regen          |
| `src/routes/api/orders/+server.ts`                             | Remove 5× `@ts-ignore`                                         | delete comment |
| `src/routes/profile/+page.svelte`                              | Remove 1× `@ts-ignore`                                         | delete comment |
| `src/routes/orders/[id]/+page.svelte`                          | Remove 1× `@ts-ignore`                                         | delete comment |
| `src/lib/server/pricing.ts`                                    | `SupabaseClient` → `SupabaseClient<Database>`, remove `as any` | edit           |
| `src/routes/admin/settings/pricing/+page.server.ts`            | Remove `as any`                                                | edit           |
| `src/routes/auth/callback/+server.ts`                          | Add imports, `supabase: any` → `SupabaseClient<Database>`      | edit           |
| `src/routes/+page.svelte`                                      | Wrap `prevFilters` init in `untrack(...)`                      | edit           |
| `src/lib/components/cards/CardItem.svelte`                     | Verify already fixed; confirm no warnings                      | verify         |
| `src/routes/card/[setCode]/[collectorNum]/[slug]/+page.svelte` | `$state(data.card)` → `$state(untrack(() => data.card))`       | edit           |
| `src/lib/server/notifications/types.ts`                        | `is_active: boolean` → `boolean \| null`                       | edit           |
| `src/routes/admin/settings/notifications/+page.svelte`         | Add `?? true / ?? false` null guards                           | edit           |

**Total**: 1 regen + 12 file edits/verifications → target: 0 errors, 0 warnings.
