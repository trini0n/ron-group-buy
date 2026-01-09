-- Add DELETE policies for orders and order_items tables
-- These are needed to allow users to delete their own pending orders

-- =============================================
-- Orders table DELETE policy
-- =============================================
-- Users can only delete their own pending orders
CREATE POLICY "Users can delete own pending orders"
  ON orders FOR DELETE
  USING (user_id = (SELECT auth.uid()) AND status = 'pending');

-- =============================================
-- Order items table DELETE policy
-- =============================================
-- Users can delete order items from their own pending orders
CREATE POLICY "Users can delete own order items"
  ON order_items FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM orders
      WHERE orders.id = order_items.order_id
      AND orders.user_id = (SELECT auth.uid())
      AND orders.status = 'pending'
    )
  );
