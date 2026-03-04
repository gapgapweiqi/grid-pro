-- Coupon / Promo code support for billing
CREATE TABLE IF NOT EXISTS billing_coupons (
  coupon_id TEXT PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  description TEXT DEFAULT '',
  discount_type TEXT NOT NULL DEFAULT 'PERCENT' CHECK(discount_type IN ('PERCENT', 'AMOUNT')),
  discount_value REAL NOT NULL DEFAULT 0,
  max_uses INTEGER DEFAULT NULL,
  used_count INTEGER NOT NULL DEFAULT 0,
  min_amount INTEGER DEFAULT 0,
  applicable_products TEXT DEFAULT '',  -- comma-separated: 'OWNER_ACCESS,TEAM_SEAT' or empty = all
  starts_at TEXT DEFAULT '',
  expires_at TEXT DEFAULT '',
  is_active INTEGER DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- Track which user used which coupon (prevent reuse)
CREATE TABLE IF NOT EXISTS billing_coupon_uses (
  id TEXT PRIMARY KEY,
  coupon_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  order_id TEXT DEFAULT '',
  used_at TEXT NOT NULL,
  FOREIGN KEY (coupon_id) REFERENCES billing_coupons(coupon_id),
  FOREIGN KEY (user_id) REFERENCES users(user_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_coupon_user ON billing_coupon_uses(coupon_id, user_id);
CREATE INDEX IF NOT EXISTS idx_coupon_code ON billing_coupons(code);

-- Add coupon_id to billing_orders
ALTER TABLE billing_orders ADD COLUMN coupon_id TEXT DEFAULT '';
ALTER TABLE billing_orders ADD COLUMN discount_amount INTEGER DEFAULT 0;
