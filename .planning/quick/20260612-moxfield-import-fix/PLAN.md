# Quick Task: Fix Moxfield Deck URL Import

## Problem
The Moxfield URL import in `agamecardshop-list` does not work. The current implementation:
1. Calls `api2.moxfield.com/v3/decks/all/{id}` to get metadata + `exportId`
2. Calls `api2.moxfield.com/v2/decks/all/{id}/export?exportId=...` to get the plain text

Both requests are blocked by Cloudflare bot protection (requires browser-like TLS fingerprinting, cookies, and JS challenges that Node.js `fetch` cannot pass).

## Root Cause
Moxfield uses Cloudflare with aggressive bot detection. Server-side `fetch` from a SvelteKit API route is fingerprinted and blocked. No official public API exists.

## Fix Strategy
A multi-layer approach:

### Layer 1: Try undocumented but more lenient v2 endpoint (no exportId needed)
`GET https://api2.moxfield.com/v2/decks/all/{id}` 
- Returns full deck JSON including boards + card names directly
- Does not require a 2-step exportId flow
- Add full browser-realistic headers (Accept, Accept-Language, Referer, sec-fetch-*, etc.)

### Layer 2: Parse cards directly from v2 JSON (skip text export)
- The v2 response includes `boards.mainboard.cards`, `boards.commanders.cards`, etc.
- Each card entry has `card.name`, `card.type_line`, `quantity`
- We can build `DeckCard[]` directly without parsing a text export

### Layer 3: Better error UX
- When Moxfield fails, auto-switch UI to the Paste tab with a clear message
- Include a link to Moxfield's export instructions in the error

## Files to Change
1. `src/routes/api/import/deck/+server.ts` — rewrite `fetchMoxfield()`
2. `src/lib/components/decklist/DeckImportPage.svelte` — improve error UX (auto-switch to paste tab)

## Verification
- Manual test: paste a Moxfield deck URL and confirm it either works or gracefully falls back with a helpful error
- If v2 also gets blocked: the error message now guides the user to paste mode with clear instructions
