-- Fix: orders UPDATE RLS policy blocks the pending→processing status transition
--
-- The previous policy had no WITH CHECK clause, so PostgreSQL defaulted WITH CHECK
-- to the same expression as USING: (user_id = auth.uid() AND status = 'pending').
-- After setting status='processing', the WITH CHECK evaluates the NEW row, which now
-- has status='processing' ≠ 'pending' — causing a silent RLS violation.  The update
-- returns 0 rows, the idempotency claim in pending/+server.ts hits the early return,
-- and the client shows a misleading "Order items added to your cart" toast with nothing
-- actually merged.
--
-- Fix: add an explicit WITH CHECK that only requires user ownership, allowing status to
-- change from 'pending' to 'processing'.  The USING clause still restricts targeting to
-- pending orders only (so users cannot re-update already-processing/completed orders).

DROP POLICY IF EXISTS "Users can update own pending orders" ON orders;

CREATE POLICY "Users can update own pending orders"
  ON orders FOR UPDATE
  USING  (user_id = (SELECT auth.uid()) AND status = 'pending')
  WITH CHECK (user_id = (SELECT auth.uid()) AND status = 'processing');
