-- Add line_id column for LINE Login
ALTER TABLE users ADD COLUMN line_id TEXT;
CREATE INDEX IF NOT EXISTS idx_users_line_id ON users(line_id);
