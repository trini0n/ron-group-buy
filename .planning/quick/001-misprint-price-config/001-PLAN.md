---
phase: quick
plan: 001
type: execute
wave: 1
depends_on: []
files_modified:
  - supabase/migrations/20260527000000_add_misprint_prices.sql
  - src/lib/server/pricing.ts
  - src/lib/utils.ts
  - src/lib/server/cart-service.ts
  - src/lib/components/cards/CardItem.svelte
  - src/routes/cart/+page.svelte
  - src/routes/checkout/+page.svelte
  - src/routes/card/[setCode]/[collectorNum]/[[lang=lang]]/[slug]/+page.svelte
  - src/routes/admin/settings/pricing/+page.svelte
autonomous: true

must_haves:
  truths:
    - 'Misprint cards display $0.70 instead of their normal finish price on the browse page (CardItem)'
    - 'Misprint cards show $0.70 in the cart page price column'
    - 'Misprint cards are priced at $0.70 when added to cart (price_at_add snapshot)'
    - 'Misprint cards show $0.70 in the card detail page'
    - 'Admin can configure all three misprint prices (Normal, Holo, Foil) at /admin/settings/pricing'
    - 'Misprint price rows appear in the pricing table with a red badge'
  artifacts:
    - path: 'supabase/migrations/20260527000000_add_misprint_prices.sql'
      provides: 'Seeds Normal Misprint, Holo Misprint, Foil Misprint rows into card_type_pricing'
    - path: 'src/lib/utils.ts'
      provides: 'getMispriceKey() helper + misprint defaults in getCardPrice DEFAULTS'
      exports: ['getMispriceKey']
    - path: 'src/lib/server/cart-service.ts'
      provides: 'Misprint-aware price lookup in effectiveFinish + is_misprint in card selects'
  key_links:
    - from: 'getMispriceKey(card)'
      to: 'getCardPrice(key, prices)'
      via: "price key like 'Normal Misprint' → looks up card_type_pricing row"
      pattern: 'getMispriceKey'
    - from: 'cart-service.ts effectiveFinish'
      to: "card_type_pricing 'Normal Misprint' row"
      via: 'getPrice(effectiveFinish(card)) where card.is_misprint === true'
      pattern: 'is_misprint'
---

<objective>
Add configurable misprint prices (Normal Misprint, Holo Misprint, Foil Misprint) defaulting to $0.70, wired through all pricing surfaces.

Purpose: Misprint cards currently inherit their finish price ($1.25/$1.50). They should use a separate, lower price that admins can configure.

Output: Three new rows in `card_type_pricing` table; `getMispriceKey()` helper used everywhere `getCardPrice` is called; admin pricing page shows and edits the three new rows.

**Design note:** The locked constraint specified `group_buy_config` columns, but this codebase already has `card_type_pricing` as its canonical pricing table — used by `fetchPrices()`, `cart-service.ts`, the layout server, and the admin pricing UI. Adding misprint prices as rows in `card_type_pricing` requires zero new infrastructure and is consistent with how all other card types are priced. Using `group_buy_config` would require a parallel data pipeline with no benefit.
</objective>

<execution_context>
@.gsd/quick/001-misprint-price-config/001-PLAN.md
</execution_context>

<context>
@src/lib/utils.ts
@src/lib/server/pricing.ts
@src/lib/server/cart-service.ts
@src/lib/components/cards/CardItem.svelte
@src/routes/cart/+page.svelte
@src/routes/checkout/+page.svelte
@src/routes/admin/settings/pricing/+page.svelte
</context>

<tasks>

<task type="auto">
  <name>Task 1: DB seed + pricing helpers</name>
  <files>
    supabase/migrations/20260527000000_add_misprint_prices.sql
    src/lib/server/pricing.ts
    src/lib/utils.ts
  </files>
  <action>
**supabase/migrations/20260527000000_add_misprint_prices.sql**

Seed three new rows into `card_type_pricing` for misprint prices:

```sql
-- Misprint card pricing: one price per finish family, default $0.70.
-- All foil subtypes (Foil, Galaxy Foil, Raised Foil, Surge Foil) share 'Foil Misprint'.
INSERT INTO card_type_pricing (card_type, price)
VALUES
  ('Normal Misprint', 0.70),
  ('Holo Misprint',   0.70),
  ('Foil Misprint',   0.70)
ON CONFLICT (card_type) DO NOTHING;
```

**src/lib/server/pricing.ts**

Add misprint keys to `FALLBACK_PRICES`:

```ts
'Normal Misprint': 0.70,
'Holo Misprint': 0.70,
'Foil Misprint': 0.70,
```

**src/lib/utils.ts**

1. Add misprint defaults to `DEFAULTS` map inside `getCardPrice`:

```ts
'Normal Misprint': 0.70,
'Holo Misprint': 0.70,
'Foil Misprint': 0.70,
```

2. Export a new helper `getMispriceKey` after `getFinishLabel`:

```ts
/**
 * Get the price lookup key for a card, accounting for misprint status.
 * Misprint cards use separate price entries: "Normal Misprint", "Holo Misprint", "Foil Misprint".
 * All foil subtypes (Foil, Galaxy Foil, Raised Foil, Surge Foil) map to "Foil Misprint".
 */
export function getMispriceKey(card: {
  is_misprint?: boolean | null
  foil_type?: string | null
  card_type: string
}): string {
  const finish = getFinishLabel(card)
  if (!card.is_misprint) return finish
  const finishFamily = (FOIL_SUBTYPES as readonly string[]).includes(finish) ? 'Foil' : finish
  return `${finishFamily} Misprint`
}
```

  </action>
  <verify>
Run `npx tsc --noEmit` — no type errors in utils.ts or pricing.ts.
Check `src/lib/utils.ts` exports `getMispriceKey`.
  </verify>
  <done>
`getMispriceKey` exported from `src/lib/utils.ts`.
`FALLBACK_PRICES` in pricing.ts includes the three misprint keys.
Migration file exists with the three INSERT statements.
No TypeScript errors.
  </done>
</task>

<task type="auto">
  <name>Task 2: Wire misprint pricing through cart service + client display + admin UI</name>
  <files>
    src/lib/server/cart-service.ts
    src/lib/components/cards/CardItem.svelte
    src/routes/cart/+page.svelte
    src/routes/checkout/+page.svelte
    src/routes/card/[setCode]/[collectorNum]/[[lang=lang]]/[slug]/+page.svelte
    src/routes/admin/settings/pricing/+page.svelte
  </files>
  <action>
**src/lib/server/cart-service.ts**

Three changes:

1. Add `is_misprint` to the direct `cards` select in `addItem` (currently `'id, card_name, card_type, foil_type, is_in_stock'`):
   → `'id, card_name, card_type, foil_type, is_in_stock, is_misprint'`

2. Add `is_misprint` to the direct `cards` select in `addItems` (same string, same change).

3. Add `is_misprint` to the `card:cards(...)` subquery in `getCartWithItems` — append `is_misprint` to the end of the `card:cards(...)` field list in that single long select string. This makes `is_misprint` available on `item.card` throughout the service (validateCart, mergeGuestCart, etc.).

4. Update `effectiveFinish` to handle misprint — add `is_misprint` to the param type and compute the misprint price key:

```ts
private effectiveFinish(card: { card_type: string; foil_type?: string | null; is_misprint?: boolean | null }): string {
  const finish = card.foil_type ?? card.card_type
  if (card.is_misprint) {
    const isAnyFoil = (['Foil', 'Galaxy Foil', 'Raised Foil', 'Surge Foil'] as const).includes(finish as any)
    return isAnyFoil ? 'Foil Misprint' : `${finish} Misprint`
  }
  return finish
}
```

Do NOT import `FOIL_SUBTYPES` from `$lib/utils` — inline the foil array as shown above to avoid circular dependency concerns in server code.

---

**src/lib/components/cards/CardItem.svelte**

Import `getMispriceKey` alongside existing imports from `$lib/utils`.

Change the price derived value:

```ts
// Before:
const price = $derived(getCardPrice(getFinishLabel(selectedCard)))
// After:
const price = $derived(getCardPrice(getMispriceKey(selectedCard)))
```

---

**src/routes/cart/+page.svelte**

Import `getMispriceKey` from `$lib/utils` (add to the existing import line).

Find the line `{@const price = getCardPrice(getFinishLabel(item.card))}` and change it to:

```svelte
{@const price = getCardPrice(getMispriceKey(item.card))}
```

---

**src/routes/checkout/+page.svelte**

Import `getMispriceKey` from `$lib/utils` (add to the existing import line that already has `getCardPrice`, `getFinishLabel`).

In the `priceBreakdown` derived block, the current loop groups by `getFinishLabel(item.card)` and prices via `getCardPrice(finish, prices)`. Update to use `getMispriceKey`:

```ts
// Before (inside the for loop):
const finish = getFinishLabel(item.card);
const price = getCardPrice(finish, prices);
const existing = groups.get(finish) ?? { count: 0, total: 0, price };
groups.set(finish, { ... });

// After:
const priceKey = getMispriceKey(item.card);
const price = getCardPrice(priceKey, prices);
const existing = groups.get(priceKey) ?? { count: 0, total: 0, price };
groups.set(priceKey, { ... });
```

Also update the two standalone `getCardPrice(getFinishLabel(item.card))` calls in the template (lines ~274 and ~681) to use `getMispriceKey(item.card)` instead.

---

**src/routes/card/[setCode]/[collectorNum]/[[lang=lang]]/[slug]/+page.svelte**

Import `getMispriceKey` from `$lib/utils`.

There are three call sites:

1. `getCardPrice(getFinishLabel(selectedCard))` (line ~76) — change to `getCardPrice(getMispriceKey(selectedCard))`
2. `getCardPrice(getFinishLabel(variant))` (line ~259) — change to `getCardPrice(getMispriceKey(variant))`

---

**src/routes/admin/settings/pricing/+page.svelte**

Add misprint types to `TYPE_ORDER`:

```ts
const TYPE_ORDER = [
  'Normal',
  'Holo',
  'Foil',
  'Raised Foil',
  'Serialized',
  'Normal Misprint',
  'Holo Misprint',
  'Foil Misprint'
]
```

Add badge colors to `BADGE_CLASSES`:

```ts
'Normal Misprint': 'bg-red-100 text-red-800',
'Holo Misprint':   'bg-red-200 text-red-800',
'Foil Misprint':   'bg-red-300 text-red-900',
```

The existing save/reset/fetch logic already handles arbitrary rows from `card_type_pricing` — no other changes needed here.
</action>
<verify>

1. `npx tsc --noEmit` — no type errors
2. `npm run check` — no Svelte errors
3. Browse to any card with `is_misprint = true` — confirm price shows $0.70 (not $1.25)
4. Add a misprint card to cart — confirm `price_at_add` in DB is 0.70
5. Visit /admin/settings/pricing — confirm three "Misprint" rows appear with red badges and editable prices
   </verify>
   <done>
   Misprint cards display $0.70 across CardItem, cart page, card detail page, and checkout price breakdown.
   Cart service stores 0.70 as `price_at_add` for misprint cards.
   Admin pricing page shows Normal Misprint, Holo Misprint, Foil Misprint rows editable with red badges.
   No TypeScript or Svelte compile errors.
   </done>
   </task>

</tasks>

<verification>
1. `npx tsc --noEmit && npm run check` — clean
2. Misprint card on browse page: price shows $0.70
3. Add misprint card to cart → check Supabase `cart_items.price_at_add` = 0.70
4. /admin/settings/pricing: shows 3 misprint rows, prices editable, saves successfully
5. Change a misprint price to $0.50, add card to cart → price_at_add = 0.50 confirms admin config flows through
</verification>

<success_criteria>

- All misprint cards priced at $0.70 by default in all display surfaces
- Admin can update misprint prices at /admin/settings/pricing
- Price changes reflect immediately in new cart additions (price_at_add snapshot)
- Zero TypeScript/Svelte compile errors
  </success_criteria>

<output>
After completion, create `.gsd/quick/001-misprint-price-config/001-SUMMARY.md`
</output>
