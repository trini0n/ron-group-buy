-- Security Hardening Migration
-- Addresses findings from the 2026-06-23 Supabase security audit.
--
-- M-1  sync_duplicate_alerts: over-permissive policies allow any authenticated
--      user to read and update admin-only internal data.
-- M-2  cart_bundles: single FOR ALL policy with no explicit DELETE; split into
--      per-operation policies with (SELECT auth.uid()) caching and WITH CHECK.
-- L-2  SECURITY DEFINER functions missing SET search_path: is_admin(),
--      update_order_status(), and increment_cart_version() are all vulnerable
--      to search-path injection without an explicit search_path pin.
-- L-3  Dead service_role RLS policies on notifications and
--      notification_templates: auth.role() = 'service_role' is never true
--      inside an RLS check (service role bypasses RLS entirely); these clauses
--      create a false sense of security without providing any protection.

-- ============================================================================
-- M-1: sync_duplicate_alerts — restrict to admins only
-- ============================================================================

-- The original policies granted read AND update access to any authenticated
-- user with the comment "rely on API-level auth for now".  This leaves the
-- full audit trail (internal serials, inventory metadata) readable by any
-- logged-in customer, and allows them to corrupt alert resolution state.

DROP POLICY IF EXISTS "Authenticated users can view sync alerts" ON sync_duplicate_alerts;
DROP POLICY IF EXISTS "Authenticated users can update sync alerts" ON sync_duplicate_alerts;

-- Only admins may read duplicate alerts
CREATE POLICY "Admins can view sync alerts"
  ON sync_duplicate_alerts FOR SELECT
  USING (is_admin());

-- Only admins may resolve / annotate alerts
CREATE POLICY "Admins can update sync alerts"
  ON sync_duplicate_alerts FOR UPDATE
  USING (is_admin())
  WITH CHECK (is_admin());

-- INSERT and DELETE remain denied for all non-service-role callers (no policy
-- = implicit deny).  The sync process writes via createAdminClient() which
-- uses the service role key and therefore bypasses RLS.

-- ============================================================================
-- M-2: cart_bundles — replace generic FOR ALL with explicit per-op policies
-- ============================================================================

-- The original single-policy approach used FOR ALL with only a USING clause.
-- PostgreSQL implicitly applies USING as WITH CHECK for INSERTs/UPDATEs in
-- that case, which works but is fragile and omits DELETE entirely.
-- We also add (SELECT auth.uid()) to enable InitPlan caching, matching the
-- pattern used by every other table in the schema since migration 20260109.

DROP POLICY IF EXISTS "cart_bundles_user_access" ON public.cart_bundles;

CREATE POLICY "cart_bundles_select"
  ON public.cart_bundles FOR SELECT
  USING (
    cart_id IN (
      SELECT id FROM public.carts WHERE user_id = (SELECT auth.uid())
    )
  );

CREATE POLICY "cart_bundles_insert"
  ON public.cart_bundles FOR INSERT
  WITH CHECK (
    cart_id IN (
      SELECT id FROM public.carts WHERE user_id = (SELECT auth.uid())
    )
  );

CREATE POLICY "cart_bundles_update"
  ON public.cart_bundles FOR UPDATE
  USING (
    cart_id IN (
      SELECT id FROM public.carts WHERE user_id = (SELECT auth.uid())
    )
  )
  WITH CHECK (
    cart_id IN (
      SELECT id FROM public.carts WHERE user_id = (SELECT auth.uid())
    )
  );

CREATE POLICY "cart_bundles_delete"
  ON public.cart_bundles FOR DELETE
  USING (
    cart_id IN (
      SELECT id FROM public.carts WHERE user_id = (SELECT auth.uid())
    )
  );

-- ============================================================================
-- L-2: Pin search_path on all SECURITY DEFINER functions
-- ============================================================================
-- Without SET search_path, a malicious user with CREATE SCHEMA privileges
-- could shadow pg_catalog or public functions via schema injection.
-- Adding SET search_path = public, pg_temp is a no-cost hardening step
-- recommended by the PostgreSQL documentation and Supabase Security Advisor.

-- is_admin() — originally defined in 20260106200000_admin_system.sql
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
DECLARE
  user_discord_id TEXT;
BEGIN
  -- Get the discord_id from users table for current auth user
  SELECT discord_id INTO user_discord_id
  FROM users
  WHERE id = auth.uid();

  -- Check if this discord_id is in admins table
  RETURN EXISTS (
    SELECT 1 FROM admins WHERE discord_id = user_discord_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

-- update_order_status() — originally defined in 20260106200000_admin_system.sql
CREATE OR REPLACE FUNCTION update_order_status(
  p_order_id UUID,
  p_new_status order_status,
  p_notes TEXT DEFAULT NULL,
  p_admin_user_id UUID DEFAULT NULL
)
RETURNS VOID AS $$
DECLARE
  v_old_status order_status;
BEGIN
  -- Get current status
  SELECT status INTO v_old_status FROM orders WHERE id = p_order_id;

  -- Update order
  UPDATE orders
  SET status = p_new_status,
      updated_at = now()
  WHERE id = p_order_id;

  -- Insert history record
  INSERT INTO order_status_history (order_id, old_status, new_status, changed_by, notes)
  VALUES (p_order_id, v_old_status, p_new_status, p_admin_user_id, p_notes);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

-- increment_cart_version() — originally defined in 20260106100000_enhanced_carts.sql
CREATE OR REPLACE FUNCTION increment_cart_version()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE carts
  SET version = version + 1,
      last_activity_at = now()
  WHERE id = COALESCE(NEW.cart_id, OLD.cart_id);
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

-- ============================================================================
-- L-3: Remove dead auth.role() = 'service_role' RLS policies
-- ============================================================================
-- The service role bypasses RLS entirely — it never evaluates USING clauses.
-- These policies are unreachable dead code that create a false sense of
-- security.  Removing them clarifies intent without changing behaviour.

-- notifications table
DROP POLICY IF EXISTS "Service role can manage notifications" ON notifications;

-- notification_templates table
DROP POLICY IF EXISTS "Service role can manage templates" ON notification_templates;

-- NOTE: Writes to these tables already work correctly via createAdminClient()
-- (service role key), which bypasses RLS by design.  No replacement policy is
-- needed; the behaviour is unchanged after this drop.
