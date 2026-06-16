-- Add plain text card list to sets table.
-- Allows admins to paste a freeform list of cards that is shown on the
-- public set detail page when no cards have been imported via set_cards.
ALTER TABLE sets
  ADD COLUMN IF NOT EXISTS card_list_text TEXT;
