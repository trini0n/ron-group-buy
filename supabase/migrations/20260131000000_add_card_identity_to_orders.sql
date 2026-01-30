-- Migration: Add Card Identity Fields for Stable Order Merging
-- This enables identity-based matching when inventory serials change during resync

-- Add identity fields to order_items for stable matching across resyncs
ALTER TABLE order_items
  ADD COLUMN set_code TEXT,
  ADD COLUMN collector_number TEXT,
  ADD COLUMN is_foil BOOLEAN DEFAULT false,
  ADD COLUMN is_etched BOOLEAN DEFAULT false,
  ADD COLUMN language TEXT DEFAULT 'en';

-- Create index for fast identity lookups (primary path: with collector_number)
CREATE INDEX idx_order_items_identity 
  ON order_items(set_code, collector_number, card_name, is_foil, is_etched, language)
  WHERE set_code IS NOT NULL AND collector_number IS NOT NULL;

-- Fallback index for cards missing collector_number
CREATE INDEX idx_order_items_identity_fallback
  ON order_items(set_code, card_name, is_foil, language)
  WHERE set_code IS NOT NULL AND collector_number IS NULL;

-- Create composite index on cards for identity matching (primary path)
CREATE INDEX idx_cards_identity
  ON cards(set_code, collector_number, card_name, is_foil, is_etched, language)
  WHERE is_in_stock = true AND collector_number IS NOT NULL;

-- Fallback index on cards for missing collector_number
CREATE INDEX idx_cards_identity_fallback
  ON cards(set_code, card_name, is_foil, language)
  WHERE is_in_stock = true AND collector_number IS NULL;

-- Create table for sync duplicate alerts
-- Tracks when multiple serials map to the same card identity during sync
CREATE TABLE sync_duplicate_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sync_timestamp TIMESTAMPTZ DEFAULT now(),
  card_identity_key TEXT NOT NULL,
  card_name TEXT NOT NULL,
  set_code TEXT,
  collector_number TEXT,
  duplicate_serials TEXT[] NOT NULL,
  kept_serial TEXT NOT NULL,
  marked_oos_serials TEXT[] NOT NULL,
  resolved BOOLEAN DEFAULT false,
  resolved_at TIMESTAMPTZ,
  resolved_by UUID REFERENCES users(id),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Index for quickly finding unresolved alerts
CREATE INDEX idx_sync_alerts_unresolved 
  ON sync_duplicate_alerts(resolved, sync_timestamp DESC)
  WHERE resolved = false;

-- Index for all alerts by timestamp
CREATE INDEX idx_sync_alerts_timestamp 
  ON sync_duplicate_alerts(sync_timestamp DESC);

-- Enable Row Level Security
ALTER TABLE sync_duplicate_alerts ENABLE ROW LEVEL SECURITY;

-- Admin-only access to duplicate alerts
-- Note: Admin policies will be enforced at application level via isAdmin() check
-- For now, we'll create a permissive policy and rely on API-level auth
CREATE POLICY "Authenticated users can view sync alerts" 
  ON sync_duplicate_alerts FOR SELECT 
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update sync alerts" 
  ON sync_duplicate_alerts FOR UPDATE 
  USING (auth.uid() IS NOT NULL);

-- Comment on table for documentation
COMMENT ON TABLE sync_duplicate_alerts IS 
  'Tracks duplicate card identities detected during Google Sheets sync. When multiple serials map to the same card (by set_code, collector_number, name, foil, etched, language), the highest serial is kept and lower serials are marked out of stock.';

COMMENT ON COLUMN sync_duplicate_alerts.card_identity_key IS 
  'Normalized identity key in format: set_code|collector_number|card_name|is_foil|is_etched|language';

COMMENT ON COLUMN sync_duplicate_alerts.kept_serial IS 
  'The highest serial number that was kept in stock';

COMMENT ON COLUMN sync_duplicate_alerts.marked_oos_serials IS 
  'Array of lower serial numbers that were marked as out of stock';
