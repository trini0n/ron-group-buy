-- Add paypal_email column to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS paypal_email TEXT;

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_users_paypal_email ON users(paypal_email);
