---
status: awaiting_human_verify
trigger: 'Misprint cards display correct $0.70 price during cart/checkout, but after order is submitted the price reverts to $1.50. Export also needs to stay consistent at $0.70.'
created: 2026-05-30T00:00:00Z
updated: 2026-05-30T00:00:00Z
---

## Current Focus

reasoning_checkpoint:
hypothesis: "order submission fetches cards with `.select('id, card_type, foil_type')` —
missing `is_misprint` — so serverFinishMap maps card IDs to 'Normal'/'Foil'/etc.
instead of 'Normal Misprint'/'Foil Misprint'. getCardPrice() then returns $1.25/$1.50
instead of $0.70."
confirming_evidence: - "Line 299: `.select('id, card_type, foil_type')` — is_misprint absent" - "serverFinishMap = foil_type ?? card_type with NO misprint branch" - "CartService.effectiveFinish() has the misprint logic; the order handler did NOT" - "export-builder.ts reads unit_price from DB directly — downstream, not independent" - "mergeIntoExistingOrder had the same missing is_misprint on its identical query"
falsification_test: "If is_misprint were included and finish was 'Normal Misprint',
getCardPrice would return 0.70 — the same logic CartService uses correctly"
fix_rationale: "Added is_misprint to both .select() calls and applied misprint finish
logic identical to CartService.effectiveFinish() — addresses root cause directly"
blind_spots: "none remaining"
next_action: human verification — submit a misprint card order and confirm $0.70 is stored

## Symptoms

<!-- Written during gathering, then IMMUTABLE -->

expected: Misprint cards keep the $0.70 price after order submission (both in UI and export)
actual: Price immediately reverts to $1.50 after the order is submitted — shown in the order view and export
errors: None reported — silent data corruption
reproduction: Add a misprint card to cart (shows $0.70), complete checkout/submit order → misprint card now shows $1.50
started: Misprint category was added relatively recently; this bug likely stems from that addition

## Eliminated

- hypothesis: "Export recalculates price independently"
  evidence: "export-builder.ts reads unit_price directly from order_items — no recalculation"
  timestamp: 2026-05-30

## Evidence

- timestamp: 2026-05-30
  checked: "src/lib/utils.ts lines 47-49"
  found: "Normal Misprint / Holo Misprint / Foil Misprint all priced at 0.7 in DEFAULTS map"
  implication: "Price definition is correct; problem is in key resolution at submission time"

- timestamp: 2026-05-30
  checked: "src/lib/server/cart-service.ts effectiveFinish()"
  found: "CartService correctly applies misprint suffix — fetches is_misprint from card object"
  implication: "Cart display path is correct; order submission path is different code"

- timestamp: 2026-05-30
  checked: "src/routes/api/orders/+server.ts lines ~297-312"
  found: ".select('id, card_type, foil_type') missing is_misprint; serverFinishMap uses foil_type ?? card_type with no misprint branch — always produces 'Normal'/'Holo'/'Foil' etc."
  implication: "getCardPrice() called with non-misprint finish key → returns $1.25 or $1.50 instead of $0.70"

- timestamp: 2026-05-30
  checked: "mergeIntoExistingOrder function (~line 397)"
  found: "Identical bug: .select('id, card_type, foil_type') missing is_misprint; mergeFinishMap has same no-misprint logic"
  implication: "Both create and merge paths were affected"

## Resolution

root_cause: >
src/routes/api/orders/+server.ts fetched card rows with `.select('id, card_type, foil_type')`
(missing `is_misprint`) in both the main order creation path and mergeIntoExistingOrder.
The effective finish map (used for price lookup) computed `foil_type ?? card_type` without
any misprint suffix, so getCardPrice() received 'Normal'/'Foil'/etc. and returned the
standard price ($1.25/$1.50) instead of the misprint price ($0.70).
fix: >
Added `is_misprint` to both `.select()` calls. Updated serverFinishMap and mergeFinishMap
to apply the same misprint suffix logic as CartService.effectiveFinish():
if is_misprint, foil finishes → 'Foil Misprint'; others → '{finish} Misprint'.
verification: awaiting human confirmation
files_changed:

- src/routes/api/orders/+server.ts
