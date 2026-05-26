-- Add is_misprint boolean flag to cards table
-- Misprint cards are hidden by default; the opt-in Misprint filter reveals them.
ALTER TABLE cards ADD COLUMN IF NOT EXISTS is_misprint BOOLEAN DEFAULT false;

-- Partial index (only indexes true rows) — low cardinality, sparse data
CREATE INDEX IF NOT EXISTS idx_cards_is_misprint ON cards(is_misprint) WHERE is_misprint = true;
