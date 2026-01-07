-- Admin System Migration
-- Adds admin tracking, notes, and extended order management

-- Add admin notes column to users
ALTER TABLE users 
  ADD COLUMN IF NOT EXISTS admin_notes TEXT,
  ADD COLUMN IF NOT EXISTS is_blocked BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS blocked_reason TEXT;

-- Add admin notes column to orders
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS admin_notes TEXT,
  ADD COLUMN IF NOT EXISTS tracking_url TEXT;

-- Order status history for audit trail
CREATE TABLE IF NOT EXISTS order_status_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID REFERENCES orders(id) ON DELETE CASCADE NOT NULL,
  old_status order_status,
  new_status order_status NOT NULL,
  changed_by UUID REFERENCES users(id) ON DELETE SET NULL,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_order_status_history_order ON order_status_history(order_id);

-- Admin users table (by Discord UID)
CREATE TABLE IF NOT EXISTS admins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  discord_id TEXT UNIQUE NOT NULL,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  role TEXT DEFAULT 'admin' CHECK (role IN ('admin', 'super_admin')),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Seed initial admins (Discord UIDs)
INSERT INTO admins (discord_id, role) VALUES 
  ('83470831350448128', 'super_admin'),
  ('431606995100106762', 'admin')
ON CONFLICT (discord_id) DO NOTHING;

-- RLS policies for admins
ALTER TABLE order_status_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE admins ENABLE ROW LEVEL SECURITY;

-- Helper function to check if current user is admin
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Admin policies for orders (admins can view and update all orders)
CREATE POLICY "Admins can view all orders" ON orders 
  FOR SELECT USING (is_admin());
  
CREATE POLICY "Admins can update all orders" ON orders 
  FOR UPDATE USING (is_admin());

-- Admin policies for order items
CREATE POLICY "Admins can view all order items" ON order_items 
  FOR SELECT USING (is_admin());

-- Admin policies for users (admins can view and update all users)
CREATE POLICY "Admins can view all users" ON users 
  FOR SELECT USING (is_admin());
  
CREATE POLICY "Admins can update all users" ON users 
  FOR UPDATE USING (is_admin());

-- Admin policies for cards (admins can update cards for stock management)
CREATE POLICY "Admins can update cards" ON cards 
  FOR UPDATE USING (is_admin());

-- Order status history (viewable by order owner or admin)
CREATE POLICY "Users can view own order status history" ON order_status_history 
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM orders WHERE orders.id = order_status_history.order_id AND orders.user_id = auth.uid())
    OR is_admin()
  );
  
CREATE POLICY "Admins can insert order status history" ON order_status_history 
  FOR INSERT WITH CHECK (is_admin());

-- Admins table only viewable by admins
CREATE POLICY "Admins can view admin list" ON admins 
  FOR SELECT USING (is_admin());

-- Function to update order status with history
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute to authenticated users (function checks admin status internally)
GRANT EXECUTE ON FUNCTION update_order_status TO authenticated;
GRANT EXECUTE ON FUNCTION is_admin TO authenticated;
