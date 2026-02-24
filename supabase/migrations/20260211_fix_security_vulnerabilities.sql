-- Fix critical security vulnerabilities identified by Supabase Security Advisor
-- 1. Remove SECURITY DEFINER from cards_with_duplicates view
-- 2. Enable RLS on gphoto_url_cache table

-- ============================================================================
-- Fix 1: Convert cards_with_duplicates view to SECURITY INVOKER
-- ============================================================================
-- This ensures the view respects RLS policies and runs with the querying user's
-- permissions instead of bypassing them with the creator's permissions.

CREATE OR REPLACE VIEW cards_with_duplicates 
WITH (security_invoker=on) AS
SELECT 
  c.*,
  -- Count duplicates in the same group (name + set + collector + finish + language)
  COUNT(*) OVER (
    PARTITION BY 
      c.card_name,
      c.set_code,
      c.collector_number,
      COALESCE(c.foil_type, c.card_type),
      COALESCE(c.language, 'en')
  ) as duplicate_count,
  -- Assign row number within each duplicate group (for debugging)
  ROW_NUMBER() OVER (
    PARTITION BY 
      c.card_name,
      c.set_code,
      c.collector_number,
      COALESCE(c.foil_type, c.card_type),
      COALESCE(c.language, 'en')
    ORDER BY c.created_at
  ) as duplicate_row_number
FROM cards c;

-- Also update the function to use SECURITY INVOKER
CREATE OR REPLACE FUNCTION get_duplicate_cards_count()
RETURNS INTEGER AS $$
  SELECT COUNT(DISTINCT id)::INTEGER
  FROM cards_with_duplicates
  WHERE duplicate_count > 1;
$$ LANGUAGE SQL STABLE SECURITY INVOKER;

COMMENT ON VIEW cards_with_duplicates IS 'Cards with pre-calculated duplicate detection using window functions. Eliminates need for full table scans in application code. Uses SECURITY INVOKER to respect RLS policies.';
COMMENT ON FUNCTION get_duplicate_cards_count() IS 'Returns total number of cards that have duplicates. Used for admin inventory summary. Uses SECURITY INVOKER to respect RLS policies.';

-- ============================================================================
-- Fix 2: Enable RLS on gphoto_url_cache table
-- ============================================================================
-- This table should only be accessed via service role (adminClient) on the server.
-- We enable RLS and create a restrictive policy to satisfy security requirements.

ALTER TABLE gphoto_url_cache ENABLE ROW LEVEL SECURITY;

-- Create restrictive policy that denies all direct access
-- The service role bypasses RLS, so server-side code will continue to work
CREATE POLICY "Service role only access"
  ON gphoto_url_cache
  FOR ALL
  USING (false);

COMMENT ON POLICY "Service role only access" ON gphoto_url_cache IS 'Denies all direct access. Table is only accessible via service role (adminClient) on the server.';
