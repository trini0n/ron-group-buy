---
status: investigating
trigger: "inventory-blank-after-misprint-migration"
created: 2026-05-25T00:00:00Z
updated: 2026-05-25T00:00:00Z
---

## Current Focus

hypothesis: cards_with_duplicates view missing is_misprint column — PostgreSQL does not auto-update views on ALTER TABLE ADD COLUMN; view was last recreated in 20260211 migration before is_misprint was added
test: confirmed view definition uses c.* expanded at creation time; no migration recreates the view after 20260526000000_add_is_misprint.sql adds the column
expecting: admin inventory query selecting is_misprint from view returns Supabase error -> error handler returns cards: []
next_action: apply fix — update migration to CREATE OR REPLACE VIEW after column add

## Symptoms

expected: Cards appear in catalog (/) and admin inventory (/admin/inventory) as normal
actual: Zero cards shown on both pages, despite sync reporting "7498 cards synced, 0 errors. Total: 7505"
errors: None reported — pages load without errors, just show empty state
reproduction: Run the sync after applying the is_misprint migration; visit / or /admin/inventory
started: After applying supabase/migrations/20260526000000_add_is_misprint.sql and updating the Google Sheet Misprint column

## Eliminated

- hypothesis: inverted filter logic in CardGrid.svelte
  evidence: filter is if (!f.isMisprint && card.is_misprint) return false — correct; hides misprints when toggle is off; with is_misprint=false on all cards, condition is never true
  timestamp: 2026-05-25T00:00:00Z

- hypothesis: parseBoolean sets is_misprint=true for all cards
  evidence: parseBoolean returns true ONLY for 'TRUE' string; empty Misprint column -> false for all cards
  timestamp: 2026-05-25T00:00:00Z

- hypothesis: RLS regression in migration
  evidence: migration only adds a column and a partial index; no policy changes
  timestamp: 2026-05-25T00:00:00Z

## Evidence

- timestamp: 2026-05-25T00:00:00Z
  checked: 20260526000000_add_is_misprint.sql
  found: only ALTER TABLE ADD COLUMN + CREATE INDEX; no view recreation
  implication: cards_with_duplicates view not updated

- timestamp: 2026-05-25T00:00:00Z
  checked: 20260211_fix_security_vulnerabilities.sql (last view recreation)
  found: CREATE OR REPLACE VIEW cards_with_duplicates WITH (security_invoker=on) AS SELECT c.*, COUNT(*) OVER (...), ROW_NUMBER() OVER (...) FROM cards c
  implication: c.* was expanded at Feb 11 creation time — is_misprint did not exist then

- timestamp: 2026-05-25T00:00:00Z
  checked: src/routes/admin/inventory/+page.server.ts lines 30-35
  found: .from('cards_with_duplicates').select('...is_misprint...') — error handler returns cards: []
  implication: query fails with "column is_misprint does not exist" -> empty admin inventory

- timestamp: 2026-05-25T00:00:00Z
  checked: src/routes/+page.server.ts fetchCards()
  found: queries cards table directly; includes is_misprint in select; has 5-min in-memory cache
  implication: homepage query should succeed (cards table HAS is_misprint); homepage empty state likely transient or same view-related cause

## Resolution

root_cause: cards_with_duplicates view was not recreated after is_misprint was added to the cards table. PostgreSQL stores view column lists at creation time — c.* does not auto-expand when new columns are added. The admin inventory server selects is_misprint from the view, gets "column does not exist", the error handler returns cards: [].
fix: update 20260526000000_add_is_misprint.sql to CREATE OR REPLACE VIEW cards_with_duplicates after the ALTER TABLE, re-expanding c.* to include the new column
verification: pending
files_changed: [supabase/migrations/20260526000000_add_is_misprint.sql]
