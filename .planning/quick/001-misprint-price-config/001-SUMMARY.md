---
quick: 001
title: Misprint Price Config
completed: 2026-05-25
duration: ~20 minutes
tasks: 2/2
commits:
  - '70a3607 feat(quick-001): DB seed + pricing helpers'
  - '5aed55d feat(quick-001): wire misprint pricing through all surfaces'
---

# Quick Task 001: Misprint Price Config — Summary

**One-liner:** Configurable misprint prices ($0.70 default) wired through all pricing surfaces via `getMispriceKey()` helper and three new `card_type_pricing` rows.

## What Was Done

### Task 1: DB seed + pricing helpers

- Created `supabase/migrations/20260527000000_add_misprint_prices.sql` — seeds Normal Misprint, Holo Misprint, Foil Misprint at $0.70 with `ON CONFLICT DO NOTHING`
- Added misprint keys to `FALLBACK_PRICES` in `src/lib/server/pricing.ts`
- Added misprint defaults to `DEFAULTS` in `getCardPrice` in `src/lib/utils.ts`
- Exported `getMispriceKey(card)` from `src/lib/utils.ts` — returns finish label normally, or `"Normal Misprint"` / `"Holo Misprint"` / `"Foil Misprint"` when `card.is_misprint` is truthy; all foil subtypes (Foil, Galaxy Foil, Raised Foil, Surge Foil) map to `"Foil Misprint"`

### Task 2: Wire misprint pricing through all surfaces

- **`src/lib/server/cart-service.ts`**: Added `is_misprint` to card selects in `addItem`, `addItems`, and `getCartWithItems`; updated `effectiveFinish()` to return misprint price keys
- **`src/lib/components/cards/CardItem.svelte`**: Imported `getMispriceKey`; changed `price` derived to use `getMispriceKey(selectedCard)`
- **`src/routes/cart/+page.svelte`**: Imported `getMispriceKey`; changed cart item price display to use `getMispriceKey(item.card)`
- **`src/routes/checkout/+page.svelte`**: Imported `getMispriceKey`; updated `priceBreakdown` loop (groups by `priceKey`), `unitPrice` in order submission, and the items list panel
- **`src/routes/card/.../+page.svelte`**: Imported `getMispriceKey`; updated `price` derived (selectedCard) and variant price display
- **`src/routes/admin/settings/pricing/+page.svelte`**: Added misprint types to `TYPE_ORDER` and red badge colors to `BADGE_CLASSES`

## Decisions Made

| Decision               | Choice                   | Rationale                                                 |
| ---------------------- | ------------------------ | --------------------------------------------------------- |
| Pricing storage        | `card_type_pricing` rows | Consistent with existing pattern; zero new infrastructure |
| Foil subtypes mapping  | All → `Foil Misprint`    | Simplest admin UX; one price for all foil misprints       |
| Server-side foil check | Inline array (no import) | Avoids circular dependency risk in server code            |

## Deviations from Plan

None — plan executed exactly as written.

## Files Modified

| File                                                                         | Change                                                   |
| ---------------------------------------------------------------------------- | -------------------------------------------------------- |
| `supabase/migrations/20260527000000_add_misprint_prices.sql`                 | Created — seeds 3 misprint price rows                    |
| `src/lib/server/pricing.ts`                                                  | Added 3 misprint keys to FALLBACK_PRICES                 |
| `src/lib/utils.ts`                                                           | Added misprint DEFAULTS + exported getMispriceKey        |
| `src/lib/server/cart-service.ts`                                             | is_misprint in selects + misprint-aware effectiveFinish  |
| `src/lib/components/cards/CardItem.svelte`                                   | getMispriceKey for price display                         |
| `src/routes/cart/+page.svelte`                                               | getMispriceKey for cart item price                       |
| `src/routes/checkout/+page.svelte`                                           | getMispriceKey in priceBreakdown + unitPrice + item list |
| `src/routes/card/[setCode]/[collectorNum]/[[lang=lang]]/[slug]/+page.svelte` | getMispriceKey for selectedCard + variant prices         |
| `src/routes/admin/settings/pricing/+page.svelte`                             | TYPE_ORDER + BADGE_CLASSES for misprint rows             |
