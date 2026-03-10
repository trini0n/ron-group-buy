-- Card Type Pricing Table
-- Stores per-card-type prices. Admins can update these via the admin panel.
-- When prices change, pending order_items can be backfilled (handled at the API layer).

CREATE TABLE card_type_pricing (
  card_type TEXT PRIMARY KEY,
  price DECIMAL(4,2) NOT NULL CHECK (price >= 0),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE card_type_pricing ENABLE ROW LEVEL SECURITY;

-- Publicly readable (needed for client-side display)
CREATE POLICY "Pricing readable by all" ON card_type_pricing FOR SELECT USING (true);

-- Seed with all card types and their default prices
INSERT INTO card_type_pricing (card_type, price) VALUES
  ('Normal', 1.25),
  ('Holo', 1.25),
  ('Foil', 1.50),
  ('Raised Foil', 3.00),
  ('Serialized', 2.50);

-- Auto-update updated_at on any change
CREATE TRIGGER update_card_type_pricing_updated_at
  BEFORE UPDATE ON card_type_pricing
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
