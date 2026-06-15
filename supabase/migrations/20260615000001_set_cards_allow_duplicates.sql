-- Allow multiple copies of the same card in a set
-- Drop the unique constraint on (set_code, card_id)
ALTER TABLE set_cards DROP CONSTRAINT IF EXISTS set_cards_set_code_card_id_key;
