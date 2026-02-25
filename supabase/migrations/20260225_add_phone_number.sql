-- Remove phone_number from users table
ALTER TABLE users DROP COLUMN IF EXISTS phone_number;

-- Add phone_number to addresses table
ALTER TABLE addresses ADD COLUMN IF NOT EXISTS phone_number TEXT;

-- Add shipping_phone_number to orders table
ALTER TABLE orders ADD COLUMN IF NOT EXISTS shipping_phone_number TEXT;
