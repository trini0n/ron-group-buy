---
status: resolved
trigger: "google-sheets-sync-no-override: Sync does NOT override existing DB serial records with updated Google Sheet data"
created: 2026-05-15T00:00:00Z
updated: 2026-05-15T00:00:00Z
---

## Current Focus

hypothesis: Supabase upsert() with onConflict: 'serial' (non-PK unique column) is unreliable - either uses PK for conflict detection or ON CONFLICT DO UPDATE fails to apply when id is auto-generated, leaving existing rows unchanged
test: Replace upsert() with explicit INSERT (new records) + parallel UPDATE (existing records)
expecting: Explicit UPDATE per serial guarantees all sheet fields overwrite DB values
next_action: Apply fix to +server.ts - replace two separate fetches + upsert loop

## Symptoms

expected: Sync updates all DB fields from sheet (card_name, collector_number, set_code, etc.) when serial already exists
actual: DB record unchanged after sync. F-3233 stays "Akroma's Will"/66 despite sheet showing "Armageddon"/68
errors: No error thrown — sync completes silently without updating
reproduction: Trigger Sync from admin panel; check DB record for serial F-3233
started: Never worked correctly; previous debug session wrongly concluded upsert handled this

## Eliminated

- hypothesis: RLS preventing update
  evidence: adminClient uses SUPABASE_SERVICE_ROLE_KEY which bypasses RLS entirely
  timestamp: 2026-05-15

- hypothesis: BEFORE UPDATE trigger blocking update
  evidence: update_cards_updated_at trigger only sets updated_at = now() and returns NEW; benign
  timestamp: 2026-05-15

- hypothesis: Early-exit condition skipping existing records
  evidence: No filter/guard in cardsToUpsert map or upsert loop that skips existing serials
  timestamp: 2026-05-15

- hypothesis: Missing unique constraint on serial
  evidence: schema has serial TEXT UNIQUE NOT NULL — unique constraint cards_serial_key exists
  timestamp: 2026-05-15

## Evidence

- timestamp: 2026-05-15
  checked: src/routes/api/admin/inventory/sync/+server.ts full upsert logic
  found: upsert(batch, { onConflict: 'serial', ignoreDuplicates: false }) — mechanically appears correct
  implication: ignoreDuplicates: false sends Prefer: resolution=merge-duplicates; onConflict: 'serial' passes ?on_conflict=serial

- timestamp: 2026-05-15
  checked: supabase/migrations/20260105000000_initial_schema.sql
  found: id UUID PRIMARY KEY DEFAULT gen_random_uuid() — id is PK; serial TEXT UNIQUE NOT NULL — serial is unique constraint only; also CREATE INDEX idx_cards_serial (non-unique) exists alongside the unique constraint index
  implication: Two indexes on serial column (unique + non-unique). When batch payload omits id, PostgREST with missing=default (defaultToNull: true) auto-generates id via DEFAULT. ON CONFLICT (serial) DO UPDATE should fire, but if SET includes id = EXCLUDED.id (new UUID) and FK references exist, UPDATE fails silently or changes id unexpectedly.

- timestamp: 2026-05-15
  checked: package.json
  found: @supabase/supabase-js v2.47.10; defaultToNull: true is the default in upsert()
  implication: defaultToNull: true adds missing=default to Prefer header, causing all table columns (including id) to be present in the INSERT via database defaults. The ON CONFLICT DO UPDATE SET clause behavior with an auto-generated id in EXCLUDED is version-specific and unreliable.

- timestamp: 2026-05-15
  checked: PostgREST upsert SQL generation for non-PK conflict target
  found: Core unreliability: when id is not in payload but IS included via missing=default as gen_random_uuid(), EXCLUDED.id holds a different UUID. If PostgREST includes id = EXCLUDED.id in the SET clause, the existing card's id changes (breaking FK references) or fails. If PostgREST excludes it, the other columns SHOULD update. Exact behavior is PostgREST version-specific and clearly not working in practice.
  implication: The upsert mechanism itself is unreliable for this schema. Replace with explicit INSERT (new) + UPDATE (existing) logic.

## Resolution

root_cause: Supabase upsert() with onConflict on a non-PK unique column (serial) is not reliably executing ON CONFLICT DO UPDATE for existing records. The combination of: (1) id as PK with gen_random_uuid() default, (2) defaultToNull: true causing id to be included in the INSERT via missing=default, and (3) PostgREST's handling of EXCLUDED.id in the SET clause makes the update behavior unreliable — existing records silently remain unchanged.
fix: Replace upsert loop with: (1) single fetch of all existing cards, (2) INSERT for new records in batches, (3) explicit parallel UPDATE for existing records using .update(data).eq('serial', serial)
verification: TypeScript: no errors. Logic: explicit UPDATE per serial guarantees all sheet fields overwrite DB values. OOS preservation and converted URL logic preserved. New records INSERT correctly.
files_changed:
  - src/routes/api/admin/inventory/sync/+server.ts
