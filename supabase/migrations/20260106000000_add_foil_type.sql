-- Add foil_type column to store specific foil types (e.g., "Surge Foil")
ALTER TABLE cards ADD COLUMN IF NOT EXISTS foil_type TEXT;

-- Add comment for documentation
COMMENT ON COLUMN cards.foil_type IS 'Specific foil type (e.g., Surge Foil, Etched Foil). NULL for regular foil or non-foil cards.';
