-- Add is_active column to sets table.
-- Allows admins to mark sets as out of stock / archived.
-- Defaults to true (active). Inactive sets are hidden from the public sets page.
ALTER TABLE sets ADD COLUMN is_active BOOLEAN NOT NULL DEFAULT true;

-- Index for filtering active sets on the public page
CREATE INDEX idx_sets_is_active ON sets(is_active) WHERE is_active = true;
