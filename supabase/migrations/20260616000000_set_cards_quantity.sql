-- Add quantity tracking to set_cards and consolidate existing duplicates.
--
-- Background: migration 20260615000001 dropped the unique constraint on
-- (set_code, card_id) to allow multiple rows per card.  We now track
-- multiple copies as a quantity integer on a single row instead, which is
-- cleaner and easier to display/edit.
--
-- This migration:
--   1. Adds the quantity column (default 1 so existing rows are unaffected)
--   2. For any (set_code, card_id) pairs that already have duplicate rows,
--      sums the duplicates into the kept row's quantity, then deletes extras
--   3. Restores the unique constraint so upsert / conflict handling works again

-- ── Step 1: add quantity ─────────────────────────────────────────────────
ALTER TABLE set_cards
  ADD COLUMN IF NOT EXISTS quantity INTEGER NOT NULL DEFAULT 1;

-- ── Step 2: consolidate existing duplicates ──────────────────────────────
-- For each (set_code, card_id) group with more than one row, keep the row
-- with the smallest id (oldest), set its quantity = number of duplicate rows,
-- then delete all other rows in that group.

-- 2a. Update the kept row's quantity to the count of duplicates
WITH grouped AS (
  SELECT
    set_code,
    card_id,
    COUNT(*)           AS cnt,
    MIN(id::text)::uuid AS keep_id
  FROM set_cards
  GROUP BY set_code, card_id
  HAVING COUNT(*) > 1
)
UPDATE set_cards sc
SET quantity = g.cnt
FROM grouped g
WHERE sc.id = g.keep_id;

-- 2b. Delete all rows that are NOT the kept row
DELETE FROM set_cards
WHERE id NOT IN (
  SELECT MIN(id::text)::uuid
  FROM set_cards
  GROUP BY set_code, card_id
);

-- ── Step 3: restore unique constraint ───────────────────────────────────
ALTER TABLE set_cards
  ADD CONSTRAINT set_cards_set_code_card_id_key
  UNIQUE (set_code, card_id);
