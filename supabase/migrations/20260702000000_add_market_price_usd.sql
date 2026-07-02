-- Migration: Add market_price_usd to cards table
-- Apply in Supabase Dashboard > SQL Editor, or via: supabase db push

ALTER TABLE cards
  ADD COLUMN IF NOT EXISTS market_price_usd numeric(10,2),
  ADD COLUMN IF NOT EXISTS market_price_updated_at timestamptz;

COMMENT ON COLUMN cards.market_price_usd IS
  'Finish-aware market price in USD, synced from Scryfall. EUR converted at 1.08 when USD unavailable.';

COMMENT ON COLUMN cards.market_price_updated_at IS
  'Timestamp of the last successful market price sync from Scryfall.';
