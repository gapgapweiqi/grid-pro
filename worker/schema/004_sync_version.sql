-- Sync version tracking for multi-device consistency
-- Each company has a version counter that increments on any data mutation
CREATE TABLE IF NOT EXISTS sync_versions (
  company_id TEXT PRIMARY KEY,
  version INTEGER DEFAULT 1,
  updated_at TEXT DEFAULT (datetime('now'))
);

-- User-level version for personal data (settings, companies owned)
CREATE TABLE IF NOT EXISTS user_sync_versions (
  user_id TEXT PRIMARY KEY,
  version INTEGER DEFAULT 1,
  updated_at TEXT DEFAULT (datetime('now'))
);
