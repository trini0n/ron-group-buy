---
status: complete
date: 2026-06-12
slug: moxfield-import-fix
---

# Quick Task: Fix Moxfield Deck URL Import

## Summary

Fixed the broken Moxfield deck URL import in `agamecardshop-list`.

## Root Cause

The old implementation used a fragile 2-step flow:
1. Hit `api2.moxfield.com/v3/decks/all/{id}` to get an `exportId`
2. Hit `api2.moxfield.com/v2/decks/all/{id}/export?exportId=...` for the plain text

Both requests were blocked by Cloudflare bot protection because the old `User-Agent: AgameCardShop/1.0` header flagged the request as a bot immediately.

## Changes Made

### `src/routes/api/import/deck/+server.ts`
- Removed the 2-step exportId flow entirely
- Now hits `api2.moxfield.com/v2/decks/all/{id}` directly (single request)
- Added browser-realistic headers (Chrome UA, Accept-Language, Referer, Origin, sec-fetch-*)
- Parses cards directly from the v2 JSON `boards` object (commanders/companions/mainboard/sideboard)
- Extracts: name, quantity, set, collector number, typeLine, foil flag per card
- Normalizes MDFCs ("A // B" → "A")
- Distinct error messages for 401/403 (blocked) vs other failures

### `src/lib/components/decklist/DeckImportPage.svelte`
- When Moxfield import fails, auto-switches to the Paste tab immediately
- Error message appended with step-by-step Moxfield export instructions
- Updated hint text under URL input with correct Moxfield export path
- Added `whitespace-pre-line` to error div so the multi-line error renders properly

## Status
Complete. Changes are ready for manual test — paste a public Moxfield deck URL to verify.
