# Debug: Foil Marked OOS When Holo Version Exists

**Status:** RESOLVED
**Date:** 2026-06-14

## Symptom

During inventory sync (import from Google Sheets), foil versions of cards that also have a Holo version are automatically marked as Out of Stock.

## Root Cause

**File:** `src/routes/api/admin/inventory/sync/+server.ts` (line 139)
**File:** `src/lib/server/card-identity.ts` (identity key generation)

The duplicate detection system generates a card identity key as:
`set_code | collector_number | card_name | is_foil | is_etched | language`

`card_type` (Normal / Holo / Foil) is NOT included. So a Holo card (H-XXXX) and a Foil card (F-XXXX) of the same name/set/collector# can produce the SAME identity key when both have a non-empty Foil? column:

- Holo: `Foil? = "Holo"` ? `is_foil = true`
- Foil: `Foil? = "TRUE"` ? `is_foil = true`

Both keys match ? lower serial marked OOS by detectDuplicatesInBatch().

## Fix

Add `card_type` to `CardWithIdentity` and `CardIdentity`, and include it in the generated identity key.

## Verification

Run: `npm run test -- card-identity`
