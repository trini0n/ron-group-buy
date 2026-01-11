-- Optimize card search for deck import performance
-- Adds composite indexes for common lookup patterns

-- Composite index for exact card lookups (name + set + collector number)
CREATE INDEX IF NOT EXISTS idx_cards_name_set_cn 
ON cards (lower(card_name), lower(set_code), collector_number);

-- Optimize name-only searches with stock preference
CREATE INDEX IF NOT EXISTS idx_cards_name_lower_stock 
ON cards (lower(card_name), is_in_stock DESC);
