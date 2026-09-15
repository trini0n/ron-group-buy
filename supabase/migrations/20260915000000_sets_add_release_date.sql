-- Add release_date column to sets table.
-- Records when the set became available in the group buy.
ALTER TABLE sets ADD COLUMN release_date DATE;

-- Index for sorting sets by release date (newest first, nulls last)
CREATE INDEX idx_sets_release_date ON sets(release_date DESC NULLS LAST);
