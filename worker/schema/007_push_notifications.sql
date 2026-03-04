-- Push Notification Subscriptions
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  endpoint TEXT NOT NULL,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  tags TEXT DEFAULT '[]',
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(user_id)
);

CREATE INDEX IF NOT EXISTS idx_push_subs_user ON push_subscriptions(user_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_push_subs_endpoint ON push_subscriptions(endpoint);

-- Notification Log (for admin history)
CREATE TABLE IF NOT EXISTS notification_log (
  id TEXT PRIMARY KEY,
  sender_id TEXT NOT NULL,
  target_type TEXT NOT NULL DEFAULT 'broadcast',
  target_value TEXT DEFAULT '',
  title TEXT NOT NULL,
  body TEXT DEFAULT '',
  image_url TEXT DEFAULT '',
  sent_count INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now'))
);
