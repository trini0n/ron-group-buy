-- Add group_buy_id to orders table
-- This ties orders to specific group buy periods for organization and tracking

-- Add the group_buy_id column if it doesn't exist
ALTER TABLE orders ADD COLUMN IF NOT EXISTS group_buy_id UUID REFERENCES group_buy_config(id);

-- Create index for efficient filtering by group buy
CREATE INDEX IF NOT EXISTS idx_orders_group_buy ON orders(group_buy_id);

-- Backfill existing orders with the most recent group buy
-- (Comment this out if you want to leave existing orders unassigned)
UPDATE orders 
SET group_buy_id = (
  SELECT id FROM group_buy_config 
  ORDER BY created_at DESC 
  LIMIT 1
)
WHERE group_buy_id IS NULL;
