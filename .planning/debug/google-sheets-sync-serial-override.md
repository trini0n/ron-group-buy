---
status: resolved
trigger: 'google-sheets-sync-serial-override'
created: 2026-05-15T00:00:00Z
updated: 2026-05-15T00:00:00Z
---

## Current Focus

hypothesis: CONFIRMED — OOS priority logic was missing; serial identity override was already working
test: Read sync code end-to-end; checked upsert config and OOS merge logic
expecting: Found specific gap in OOS TRUE-priority logic
next_action: DONE — fix applied and verified (no compile errors)

## Symptoms

expected: When sync triggered, if setcode/collector#/language on DB record doesn't match sheet data for same serial, DB should be updated. For OOS: if either sheet or DB has TRUE, result is TRUE.
actual: Serial identity fields (setcode/collector#/language) already updated via upsert. OOS was blindly overwritten by sheet value — DB OOS=TRUE could be reset to in-stock.
errors: No explicit error — logic/behavior gap
reproduction: Trigger a Sync with Google Sheets action from the app
started: Unclear if ever worked; OOS priority was never implemented

## Eliminated

- hypothesis: setcode/collector#/language override is missing
  evidence: upsert uses onConflict: 'serial', ignoreDuplicates: false which updates ALL fields on conflict — Google Sheet values already win for identity fields
  timestamp: 2026-05-15

## Evidence

- timestamp: 2026-05-15
  checked: src/routes/api/admin/inventory/sync/+server.ts — parseSheetCsv
  found: is_in_stock derived from sheet OOS column only; no DB value consulted
  implication: If a card is manually marked OOS in DB, sync would reset it to in-stock

- timestamp: 2026-05-15
  checked: cardsToUpsert map — only preserved ron_image_url from DB, not is_in_stock
  found: No OOS merge logic existed
  implication: DB OOS=TRUE was silently overwritten by sheet OOS=FALSE on every sync

- timestamp: 2026-05-15
  checked: upsert config — onConflict: 'serial', ignoreDuplicates: false
  found: All fields updated on serial conflict — setcode/collector#/language already get overridden from sheet
  implication: Serial identity override was already working; no fix needed there

## Resolution

root_cause: The cardsToUpsert map only fetched DB values for ron_image_url preservation. It never fetched existing is_in_stock values, so OOS priority (TRUE wins) was never applied — sheet OOS=FALSE would silently reset DB OOS=TRUE.
fix: Added a batched fetch of all DB serials where is_in_stock=false into a Set (existingOosSerials). In the cardsToUpsert map, applied OOS priority: is_in_stock = existingOosSerials.has(card.serial) ? false : card.is_in_stock. This ensures DB OOS=TRUE is preserved even when sheet says in-stock, while sheet OOS=TRUE always wins for new or in-stock cards.
verification: No TypeScript compile errors. Logic confirmed: existingOosSerials.has() short-circuits to false (OOS) regardless of sheet value; sheet OOS=TRUE still wins because card.is_in_stock is already false in that case.
files_changed:

- src/routes/api/admin/inventory/sync/+server.ts
