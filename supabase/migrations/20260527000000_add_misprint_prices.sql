-- Misprint card pricing: one price per finish family, default $0.70.
-- All foil subtypes (Foil, Galaxy Foil, Raised Foil, Surge Foil) share 'Foil Misprint'.
INSERT INTO card_type_pricing (card_type, price)
VALUES
  ('Normal Misprint', 0.70),
  ('Holo Misprint',   0.70),
  ('Foil Misprint',   0.70)
ON CONFLICT (card_type) DO NOTHING;
