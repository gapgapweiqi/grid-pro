-- Add stripe_customer_id column to users table for Stripe Elements integration
ALTER TABLE users ADD COLUMN stripe_customer_id TEXT DEFAULT '';
