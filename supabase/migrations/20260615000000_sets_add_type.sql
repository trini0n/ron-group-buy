-- Add set_type column to sets table
-- Valid values: 'Normal', 'Holo / Mixed', 'Foil'
ALTER TABLE sets ADD COLUMN set_type TEXT NOT NULL DEFAULT 'Normal'
  CHECK (set_type IN ('Normal', 'Holo / Mixed', 'Foil'));
