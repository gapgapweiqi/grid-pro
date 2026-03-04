-- Push notification preferences per user
CREATE TABLE IF NOT EXISTS push_preferences (
  user_id TEXT PRIMARY KEY,
  preferences TEXT NOT NULL DEFAULT '{}',
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
