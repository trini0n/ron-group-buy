-- RLS Policy Performance Optimization
-- Wraps auth.uid() with (select auth.uid()) to enable InitPlan caching
-- See: https://supabase.com/docs/guides/database/postgres/row-level-security#call-functions-with-select

-- =============================================
-- Users table policies
-- =============================================
DROP POLICY IF EXISTS "Users can view own profile" ON users;
DROP POLICY IF EXISTS "Users can update own profile" ON users;

CREATE POLICY "Users can view own profile"
  ON users FOR SELECT
  USING (id = (SELECT auth.uid()));

CREATE POLICY "Users can update own profile"
  ON users FOR UPDATE
  USING (id = (SELECT auth.uid()));

-- =============================================
-- Addresses table policies
-- =============================================
DROP POLICY IF EXISTS "Users can view own addresses" ON addresses;
DROP POLICY IF EXISTS "Users can insert own addresses" ON addresses;
DROP POLICY IF EXISTS "Users can update own addresses" ON addresses;
DROP POLICY IF EXISTS "Users can delete own addresses" ON addresses;

CREATE POLICY "Users can view own addresses"
  ON addresses FOR SELECT
  USING (user_id = (SELECT auth.uid()));

CREATE POLICY "Users can insert own addresses"
  ON addresses FOR INSERT
  WITH CHECK (user_id = (SELECT auth.uid()));

CREATE POLICY "Users can update own addresses"
  ON addresses FOR UPDATE
  USING (user_id = (SELECT auth.uid()));

CREATE POLICY "Users can delete own addresses"
  ON addresses FOR DELETE
  USING (user_id = (SELECT auth.uid()));

-- =============================================
-- Notification preferences table policies
-- =============================================
DROP POLICY IF EXISTS "Users can view own notification preferences" ON notification_preferences;
DROP POLICY IF EXISTS "Users can insert own notification preferences" ON notification_preferences;
DROP POLICY IF EXISTS "Users can update own notification preferences" ON notification_preferences;

CREATE POLICY "Users can view own notification preferences"
  ON notification_preferences FOR SELECT
  USING (user_id = (SELECT auth.uid()));

CREATE POLICY "Users can insert own notification preferences"
  ON notification_preferences FOR INSERT
  WITH CHECK (user_id = (SELECT auth.uid()));

CREATE POLICY "Users can update own notification preferences"
  ON notification_preferences FOR UPDATE
  USING (user_id = (SELECT auth.uid()));

-- =============================================
-- Orders table policies
-- =============================================
DROP POLICY IF EXISTS "Users can view own orders" ON orders;
DROP POLICY IF EXISTS "Users can create own orders" ON orders;
DROP POLICY IF EXISTS "Users can update own pending orders" ON orders;

CREATE POLICY "Users can view own orders"
  ON orders FOR SELECT
  USING (user_id = (SELECT auth.uid()));

CREATE POLICY "Users can create own orders"
  ON orders FOR INSERT
  WITH CHECK (user_id = (SELECT auth.uid()));

CREATE POLICY "Users can update own pending orders"
  ON orders FOR UPDATE
  USING (user_id = (SELECT auth.uid()) AND status = 'pending');

-- =============================================
-- Order items table policies
-- =============================================
DROP POLICY IF EXISTS "Users can view own order items" ON order_items;
DROP POLICY IF EXISTS "Users can create order items" ON order_items;

CREATE POLICY "Users can view own order items"
  ON order_items FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM orders
      WHERE orders.id = order_items.order_id
      AND orders.user_id = (SELECT auth.uid())
    )
  );

CREATE POLICY "Users can create order items"
  ON order_items FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM orders
      WHERE orders.id = order_items.order_id
      AND orders.user_id = (SELECT auth.uid())
    )
  );

-- =============================================
-- Carts table policies
-- =============================================
DROP POLICY IF EXISTS "Users can view own cart" ON carts;
DROP POLICY IF EXISTS "Users can create own cart" ON carts;
DROP POLICY IF EXISTS "Users can update own cart" ON carts;
DROP POLICY IF EXISTS "Users can delete own cart" ON carts;

CREATE POLICY "Users can view own cart"
  ON carts FOR SELECT
  USING (user_id = (SELECT auth.uid()));

CREATE POLICY "Users can create own cart"
  ON carts FOR INSERT
  WITH CHECK (user_id = (SELECT auth.uid()));

CREATE POLICY "Users can update own cart"
  ON carts FOR UPDATE
  USING (user_id = (SELECT auth.uid()));

CREATE POLICY "Users can delete own cart"
  ON carts FOR DELETE
  USING (user_id = (SELECT auth.uid()));

-- =============================================
-- Cart items table policies
-- =============================================
DROP POLICY IF EXISTS "Users can view own cart items" ON cart_items;
DROP POLICY IF EXISTS "Users can insert own cart items" ON cart_items;
DROP POLICY IF EXISTS "Users can update own cart items" ON cart_items;
DROP POLICY IF EXISTS "Users can delete own cart items" ON cart_items;

CREATE POLICY "Users can view own cart items"
  ON cart_items FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM carts
      WHERE carts.id = cart_items.cart_id
      AND carts.user_id = (SELECT auth.uid())
    )
  );

CREATE POLICY "Users can insert own cart items"
  ON cart_items FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM carts
      WHERE carts.id = cart_items.cart_id
      AND carts.user_id = (SELECT auth.uid())
    )
  );

CREATE POLICY "Users can update own cart items"
  ON cart_items FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM carts
      WHERE carts.id = cart_items.cart_id
      AND carts.user_id = (SELECT auth.uid())
    )
  );

CREATE POLICY "Users can delete own cart items"
  ON cart_items FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM carts
      WHERE carts.id = cart_items.cart_id
      AND carts.user_id = (SELECT auth.uid())
    )
  );

-- =============================================
-- Checkout sessions table policies
-- =============================================
DROP POLICY IF EXISTS "Users can view own checkout sessions" ON checkout_sessions;
DROP POLICY IF EXISTS "Users can create own checkout sessions" ON checkout_sessions;
DROP POLICY IF EXISTS "Users can update own checkout sessions" ON checkout_sessions;

CREATE POLICY "Users can view own checkout sessions"
  ON checkout_sessions FOR SELECT
  USING (user_id = (SELECT auth.uid()));

CREATE POLICY "Users can create own checkout sessions"
  ON checkout_sessions FOR INSERT
  WITH CHECK (user_id = (SELECT auth.uid()));

CREATE POLICY "Users can update own checkout sessions"
  ON checkout_sessions FOR UPDATE
  USING (user_id = (SELECT auth.uid()));

-- =============================================
-- Cart merge history table policies
-- =============================================
DROP POLICY IF EXISTS "Users can view own cart merge history" ON cart_merge_history;
DROP POLICY IF EXISTS "Users can create own cart merge history" ON cart_merge_history;

CREATE POLICY "Users can view own cart merge history"
  ON cart_merge_history FOR SELECT
  USING (user_id = (SELECT auth.uid()));

CREATE POLICY "Users can create own cart merge history"
  ON cart_merge_history FOR INSERT
  WITH CHECK (user_id = (SELECT auth.uid()));

-- =============================================
-- Order status history table policies
-- =============================================
DROP POLICY IF EXISTS "Users can view own order status history" ON order_status_history;

CREATE POLICY "Users can view own order status history"
  ON order_status_history FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM orders
      WHERE orders.id = order_status_history.order_id
      AND orders.user_id = (SELECT auth.uid())
    )
  );
