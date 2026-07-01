# SSRF Security Report

## Status: PASS

## Findings

### URL Fetches in Server-Side Code

Four `fetch()` calls were identified in server-side code:

#### 1. `POST /api/admin/inventory/sync` — Google Sheets CSV
```typescript
const LIBRARY_CSV_URL = env.GOOGLE_SHEETS_LIBRARY_URL ?? ''
const response = await fetch(LIBRARY_CSV_URL)
```
The URL is **environment-variable-only** — not user-supplied. Only admins can trigger this endpoint. Admin-authenticated request → fetches a hardcoded env var URL. **No SSRF risk.**

#### 2. `POST /api/admin/inventory/resync-images` — Google Sheets CSV
Same pattern as above, same env var URL. **No SSRF risk.**

#### 3. `POST /api/import/deck` — Moxfield URL
```typescript
// In fetchMoxfieldDeck():
const match = url.match(/moxfield\.com\/decks\/([a-zA-Z0-9_-]+)/)
if (!match?.[1]) throw new Error('Invalid Moxfield URL')
const publicId = match[1]
const metaRes = await fetch(`https://api2.moxfield.com/v3/decks/all/${publicId}`, ...)
```
The user supplies the `url`, but the regex extracts only the `publicId` (alphanumeric + `_-` chars). The fetch is then made to a **hardcoded URL** (`https://api2.moxfield.com/...`) with only the ID interpolated. The ID cannot contain protocol separators or path traversal characters. **No SSRF risk** — the destination is hardcoded.

#### 4. `POST /api/import/deck` — Archidekt URL
```typescript
// In fetchArchidektDeck():
const match = url.match(/archidekt\.com\/decks\/(\d+)/)
if (!match) throw new Error('Invalid Archidekt URL')
const deckId = match[1]  // digits only
const resp = await fetch(`https://archidekt.com/api/decks/${deckId}/`, ...)
```
Same pattern — regex extracts a numeric-only ID, fetch goes to a **hardcoded URL**. **No SSRF risk.**

### Summary

None of the URL fetches allow arbitrary URLs. All fall into one of two safe categories:
1. **Env-var-only URLs** — controlled by the operator, not users
2. **Hardcoded base URLs** with user-controlled only extracting safe IDs via strict regex

There is no feature where a user can supply a raw URL that the server fetches directly.

## What's at Risk

Nothing — no SSRF vectors found.

## What's Already Secure

- Google Sheets URL is from env var only (operator-controlled)
- Moxfield/Archidekt URLs are hardcoded — only the deck ID is user-supplied and validated by strict regex
- No image proxy or arbitrary URL fetching feature exists

## Recommendations

1. No action required.
2. If a user-supplied URL fetch feature is added in the future (e.g., webhook testing, image proxy), implement SSRF protection with private IP blocking.
