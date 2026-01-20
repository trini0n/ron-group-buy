-- Create cache table for Google Photos URL conversions
-- This prevents redundant external fetches and reduces origin transfer

CREATE TABLE IF NOT EXISTS gphoto_url_cache (
  share_url TEXT PRIMARY KEY,
  direct_url TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ DEFAULT NOW() + INTERVAL '30 days'
);

-- Index for efficient expiry-based queries
CREATE INDEX IF NOT EXISTS idx_gphoto_cache_expires ON gphoto_url_cache(expires_at);

-- Optional: Cleanup function to remove expired entries
CREATE OR REPLACE FUNCTION cleanup_expired_gphoto_cache()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM gphoto_url_cache
  WHERE expires_at < NOW();
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

COMMENT ON TABLE gphoto_url_cache IS 'Cache for Google Photos URL conversions to reduce external API calls and origin transfer';
