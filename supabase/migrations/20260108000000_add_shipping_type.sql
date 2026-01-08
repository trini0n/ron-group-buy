-- Add shipping type column to orders table
ALTER TABLE orders ADD COLUMN shipping_type TEXT DEFAULT 'regular';

-- Add check constraint to validate shipping type values
ALTER TABLE orders ADD CONSTRAINT orders_shipping_type_check 
  CHECK (shipping_type IN ('regular', 'express'));
