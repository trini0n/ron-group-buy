---
phase: 17
plan: 2
status: complete
---

# Plan 17.2 Summary — Admin Set Detail Page + Card Association API

## What Was Built

### Card Association API (`POST /api/admin/sets/[setCode]/cards`)
- Accepts `{ lines: string[] }` where each line is `setCode coll# [lang]` (lang defaults to `en`)
- Parse step: splits on whitespace, validates ≥2 tokens; push parse errors for malformed lines
- Resolve step: batch queries `cards` by `set_code` + `collector_number` (fully typed, no cast); filters by language client-side
- Lookup: `SET|collNum|lang` → card ID(s) — all matching card types included (ASSOC-03)
- Upsert into `set_cards` with `ignoreDuplicates: true` — silently skips already-associated cards (ASSOC-05)
- Returns `{ added: number, already_present: number, errors: [{line, reason}] }`

### Remove Card API (`DELETE /api/admin/sets/[setCode]/cards/[cardId]`)
- Deletes row from `set_cards` matching `set_code + card_id`
- Returns 204 on success

### Admin Set Detail Page (`/admin/sets/[setCode]`)

**Page server (`+page.server.ts`):**
- Returns 404 if `sets.set_code` not found (DETAIL-02)
- Fetches `set_cards` joined to card data (card_name, set_code, collector_number, language, card_type, serial)
- All return shapes explicitly typed via interfaces

**Page UI (`+page.svelte`):**
- Breadcrumb: "← Back to Sets" link
- Header: set_name + set_code badge + card count subtitle
- **Add Cards section** (collapsible): 
  - Format hint with code example (`setCode collectorNumber [lang]`)
  - Textarea with monospace font, 6 rows, resizable
  - Live line count display
  - On submit: POST `{ lines }` → toast success with `N added (M already present)` counts
  - Error list below textarea: red, monospace, per-line `original — reason` format (ASSOC-04)
  - `invalidateAll()` on any successful add
- **Cards table**: Set | Coll# | Lang | Card Name (links to `/card/[set]/[coll]`) | Type | Serial | Remove
- Remove button: DELETE API → toast → `invalidateAll()`
- Empty state: Library icon + instructional text (ASSOC empty case)

## Requirements Satisfied
ASSOC-01, ASSOC-02, ASSOC-03, ASSOC-04, ASSOC-05, ASSOC-06

## TypeScript Notes
- All `sets` and `set_cards` queries use `(adminClient as any)` cast — these tables don't exist in the generated `database.types.ts` yet because the migration hasn't been applied to production Supabase
- After applying the migration and running `npm run db:generate`, the casts can be removed
- The `cards` table query in the association API remains fully typed (no cast needed)

## Commits
- `337f0c4` feat(phase-17): add card association and remove-card API routes
- `ee5861a` feat(phase-17): admin set detail page with card association and remove card
- `ec9f230` fix(phase-17): resolve TypeScript errors in sets routes
