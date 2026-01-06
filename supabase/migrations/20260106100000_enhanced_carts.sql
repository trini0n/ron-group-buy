-- Enhanced Cart System Migration
-- Supports guest carts, versioning, price snapshots, and merge tracking

-- Drop existing cart policies first (we'll recreate them)
DROP POLICY IF EXISTS "Users can view own cart" ON carts;
DROP POLICY IF EXISTS "Users can insert own cart" ON carts;
DROP POLICY IF EXISTS "Users can update own cart" ON carts;
DROP POLICY IF EXISTS "Users can delete own cart" ON carts;
DROP POLICY IF EXISTS "Users can view own cart items" ON cart_items;
DROP POLICY IF EXISTS "Users can insert own cart items" ON cart_items;
DROP POLICY IF EXISTS "Users can update own cart items" ON cart_items;
DROP POLICY IF EXISTS "Users can delete own cart items" ON cart_items;

-- Drop existing constraints that conflict
ALTER TABLE carts DROP CONSTRAINT IF EXISTS carts_user_id_key;
ALTER TABLE carts DROP CONSTRAINT IF EXISTS carts_user_id_fkey;

-- Modify carts table for guest support and versioning
ALTER TABLE carts 
  ALTER COLUMN user_id DROP NOT NULL,
  ADD COLUMN IF NOT EXISTS guest_id UUID,
  ADD COLUMN IF NOT EXISTS version INTEGER DEFAULT 1,
  ADD COLUMN IF NOT EXISTS last_activity_at TIMESTAMPTZ DEFAULT now(),
  ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS merged_into_cart_id UUID REFERENCES carts(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS previous_user_id UUID;

-- Add back user_id foreign key (nullable now)
ALTER TABLE carts 
  ADD CONSTRAINT carts_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- Ensure either user_id or guest_id is set
ALTER TABLE carts 
  ADD CONSTRAINT cart_owner_check CHECK (user_id IS NOT NULL OR guest_id IS NOT NULL);

-- Unique constraints
CREATE UNIQUE INDEX IF NOT EXISTS carts_user_id_unique ON carts(user_id) WHERE user_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS carts_guest_id_unique ON carts(guest_id) WHERE guest_id IS NOT NULL;

-- Modify cart_items for price snapshots and tracking
ALTER TABLE cart_items
  ADD COLUMN IF NOT EXISTS price_at_add DECIMAL(10,2),
  ADD COLUMN IF NOT EXISTS card_name_snapshot TEXT,
  ADD COLUMN IF NOT EXISTS card_type_snapshot TEXT,
  ADD COLUMN IF NOT EXISTS is_in_stock_snapshot BOOLEAN DEFAULT true;

-- Index for guest cart lookups and expiration
CREATE INDEX IF NOT EXISTS idx_carts_guest_id ON carts(guest_id) WHERE guest_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_carts_expires_at ON carts(expires_at) WHERE expires_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_carts_last_activity ON carts(last_activity_at);

-- Cart merge history for audit trail
CREATE TABLE IF NOT EXISTS cart_merge_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  target_cart_id UUID REFERENCES carts(id) ON DELETE SET NULL,
  source_cart_id UUID,
  source_guest_id UUID,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  items_added INTEGER DEFAULT 0,
  items_combined INTEGER DEFAULT 0,
  items_removed INTEGER DEFAULT 0,
  qty_adjusted INTEGER DEFAULT 0,
  merge_details JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Checkout sessions for drift detection
CREATE TABLE IF NOT EXISTS checkout_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cart_id UUID REFERENCES carts(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  cart_version_at_start INTEGER NOT NULL,
  cart_hash TEXT NOT NULL, -- Hash of cart contents for drift detection
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'completed', 'expired', 'invalidated')),
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_checkout_sessions_cart ON checkout_sessions(cart_id);
CREATE INDEX IF NOT EXISTS idx_checkout_sessions_status ON checkout_sessions(status);

-- Function to increment cart version on any change
CREATE OR REPLACE FUNCTION increment_cart_version()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE carts 
  SET version = version + 1, 
      last_activity_at = now()
  WHERE id = COALESCE(NEW.cart_id, OLD.cart_id);
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger cart version on item changes
DROP TRIGGER IF EXISTS cart_items_version_trigger ON cart_items;
CREATE TRIGGER cart_items_version_trigger
AFTER INSERT OR UPDATE OR DELETE ON cart_items
FOR EACH ROW EXECUTE FUNCTION increment_cart_version();

-- Function to set cart expiration for guests
CREATE OR REPLACE FUNCTION set_guest_cart_expiration()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.guest_id IS NOT NULL AND NEW.expires_at IS NULL THEN
    NEW.expires_at := NOW() + INTERVAL '90 days';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_guest_cart_expiration_trigger ON carts;
CREATE TRIGGER set_guest_cart_expiration_trigger
BEFORE INSERT ON carts
FOR EACH ROW EXECUTE FUNCTION set_guest_cart_expiration();

-- Function to extend guest cart TTL on activity
CREATE OR REPLACE FUNCTION extend_guest_cart_ttl()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.guest_id IS NOT NULL THEN
    NEW.expires_at := NOW() + INTERVAL '90 days';
    NEW.last_activity_at := NOW();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS extend_guest_cart_ttl_trigger ON carts;
CREATE TRIGGER extend_guest_cart_ttl_trigger
BEFORE UPDATE ON carts
FOR EACH ROW EXECUTE FUNCTION extend_guest_cart_ttl();

-- RLS Policies for carts (support both user and guest access)
-- Note: Guest access is handled via service role in API routes

CREATE POLICY "Users can view own cart" ON carts 
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own cart" ON carts 
  FOR INSERT WITH CHECK (auth.uid() = user_id OR user_id IS NULL);

CREATE POLICY "Users can update own cart" ON carts 
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own cart" ON carts 
  FOR DELETE USING (auth.uid() = user_id);

-- Cart items policies
CREATE POLICY "Users can view own cart items" ON cart_items 
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM carts WHERE carts.id = cart_items.cart_id AND carts.user_id = auth.uid())
  );

CREATE POLICY "Users can insert own cart items" ON cart_items 
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM carts WHERE carts.id = cart_items.cart_id AND carts.user_id = auth.uid())
  );

CREATE POLICY "Users can update own cart items" ON cart_items 
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM carts WHERE carts.id = cart_items.cart_id AND carts.user_id = auth.uid())
  );

CREATE POLICY "Users can delete own cart items" ON cart_items 
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM carts WHERE carts.id = cart_items.cart_id AND carts.user_id = auth.uid())
  );

-- Checkout sessions RLS
ALTER TABLE checkout_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own checkout sessions" ON checkout_sessions 
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own checkout sessions" ON checkout_sessions 
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own checkout sessions" ON checkout_sessions 
  FOR UPDATE USING (auth.uid() = user_id);

-- Merge history is readable by involved user
ALTER TABLE cart_merge_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own merge history" ON cart_merge_history 
  FOR SELECT USING (auth.uid() = user_id);

-- Cleanup job: Delete expired guest carts (run via cron)
-- This would be set up as a Supabase Edge Function or external cron
-- DELETE FROM carts WHERE expires_at < NOW() AND guest_id IS NOT NULL;

COMMENT ON TABLE carts IS 'Shopping carts supporting both authenticated users and guests';
COMMENT ON COLUMN carts.guest_id IS 'UUID for guest cart identification (stored in cookie)';
COMMENT ON COLUMN carts.version IS 'Optimistic concurrency version, incremented on every change';
COMMENT ON COLUMN carts.expires_at IS 'Expiration time for guest carts (90 days TTL)';
COMMENT ON COLUMN carts.merged_into_cart_id IS 'If this cart was merged, references the target cart';
COMMENT ON COLUMN carts.previous_user_id IS 'Tracks if guest cart was previously associated with a user';

COMMENT ON TABLE cart_merge_history IS 'Audit trail of cart merges for debugging and user communication';
COMMENT ON TABLE checkout_sessions IS 'Tracks checkout sessions for drift detection';
