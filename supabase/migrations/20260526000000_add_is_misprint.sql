-- Add is_misprint boolean flag to cards table
-- Misprint cards are hidden by default; the opt-in Misprint filter reveals them.
ALTER TABLE cards ADD COLUMN IF NOT EXISTS is_misprint BOOLEAN DEFAULT false;

-- Partial index (only indexes true rows) — low cardinality, sparse data
CREATE INDEX IF NOT EXISTS idx_cards_is_misprint ON cards(is_misprint) WHERE is_misprint = true;

-- Recreate cards_with_duplicates view so c.* re-expands to include is_misprint.
-- PostgreSQL does NOT automatically update view column lists when ALTER TABLE
-- adds new columns — CREATE OR REPLACE is required to refresh the expansion.
CREATE OR REPLACE VIEW cards_with_duplicates
WITH (security_invoker=on) AS
SELECT
  c.*,
  COUNT(*) OVER (
    PARTITION BY
      c.card_name,
      c.set_code,
      c.collector_number,
      COALESCE(c.foil_type, c.card_type),
      COALESCE(c.language, 'en')
  ) as duplicate_count,
  ROW_NUMBER() OVER (
    PARTITION BY
      c.card_name,
      c.set_code,
      c.collector_number,
      COALESCE(c.foil_type, c.card_type),
      COALESCE(c.language, 'en')
    ORDER BY c.created_at
  ) as duplicate_row_number
FROM cards c;

COMMENT ON VIEW cards_with_duplicates IS 'Cards with pre-calculated duplicate detection using window functions. Eliminates need for full table scans in application code. Uses SECURITY INVOKER to respect RLS policies.';
