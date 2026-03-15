-- Backfill card_type for Raised Foil and Serialized cards
-- based on serial suffix conventions:
--   serial ends with 'r' → Raised Foil (e.g. F-3005r)
--   serial ends with 'z' → Serialized   (e.g. F-3034z)
--
-- Only updates cards currently typed as 'Foil' to avoid touching
-- any records that were already correctly classified.

UPDATE cards
SET card_type = 'Raised Foil'
WHERE serial ~ 'r$'
  AND card_type = 'Foil';

UPDATE cards
SET card_type = 'Serialized'
WHERE serial ~ 'z$'
  AND card_type = 'Foil';
