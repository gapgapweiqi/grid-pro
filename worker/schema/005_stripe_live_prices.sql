-- Update billing_products with live Stripe price IDs
UPDATE billing_products SET stripe_price_id = 'price_1T5HoxENw98quIw6YcwSD7In' WHERE product_type = 'OWNER_ACCESS';
UPDATE billing_products SET stripe_price_id = 'price_1T5HpaENw98quIw6U0gXwvRo' WHERE product_type = 'TEAM_SEAT';
