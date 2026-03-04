-- Billing tables for one-time Stripe payments
-- Owner access: 790 THB, Additional seat: 490 THB each (max 10 seats)

CREATE TABLE IF NOT EXISTS billing_products (
  product_id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT DEFAULT '',
  price_thb INTEGER NOT NULL DEFAULT 0,
  stripe_price_id TEXT DEFAULT '',
  product_type TEXT NOT NULL CHECK(product_type IN ('OWNER_ACCESS', 'TEAM_SEAT')),
  is_active INTEGER DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS billing_orders (
  order_id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  company_id TEXT NOT NULL,
  stripe_session_id TEXT DEFAULT '',
  stripe_payment_intent_id TEXT DEFAULT '',
  order_type TEXT NOT NULL CHECK(order_type IN ('OWNER_ACCESS', 'TEAM_SEAT')),
  quantity INTEGER NOT NULL DEFAULT 1,
  amount_thb INTEGER NOT NULL DEFAULT 0,
  currency TEXT DEFAULT 'THB',
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK(status IN ('PENDING', 'PAID', 'FAILED', 'REFUNDED')),
  paid_at TEXT DEFAULT '',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(user_id)
);

CREATE TABLE IF NOT EXISTS billing_entitlements (
  entitlement_id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  company_id TEXT NOT NULL,
  entitlement_type TEXT NOT NULL CHECK(entitlement_type IN ('OWNER_ACCESS', 'TEAM_SEAT')),
  granted_seats INTEGER NOT NULL DEFAULT 0,
  source TEXT NOT NULL DEFAULT 'STRIPE' CHECK(source IN ('STRIPE', 'ADMIN_OVERRIDE')),
  order_id TEXT DEFAULT '',
  is_active INTEGER DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(user_id)
);

-- Add billing_status and is_admin to users
ALTER TABLE users ADD COLUMN billing_status TEXT DEFAULT 'UNPAID';
ALTER TABLE users ADD COLUMN is_admin INTEGER DEFAULT 0;

-- Seed billing products
INSERT INTO billing_products (product_id, name, description, price_thb, stripe_price_id, product_type, is_active, created_at, updated_at)
VALUES
  ('prod_owner', 'Owner Access', 'เปิดใช้งานระบบสำหรับเจ้าของ', 790, 'price_1T5HoxENw98quIw6YcwSD7In', 'OWNER_ACCESS', 1, datetime('now'), datetime('now')),
  ('prod_seat', 'Team Seat', 'เพิ่มสมาชิกทีม 1 ที่นั่ง', 490, 'price_1T5HpaENw98quIw6U0gXwvRo', 'TEAM_SEAT', 1, datetime('now'), datetime('now'));

-- Seed admin user
UPDATE users SET is_admin = 1, billing_status = 'PAID' WHERE email = 'kingkazma.tankap@gmail.com';

CREATE INDEX IF NOT EXISTS idx_orders_user ON billing_orders(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_company ON billing_orders(company_id);
CREATE INDEX IF NOT EXISTS idx_entitlements_user ON billing_entitlements(user_id);
CREATE INDEX IF NOT EXISTS idx_entitlements_company ON billing_entitlements(company_id);
