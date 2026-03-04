-- GridPro D1 Database Schema
-- Run: wrangler d1 execute gridpro-db --local --file=./schema/001_init.sql

-- Users & Auth
CREATE TABLE IF NOT EXISTS users (
  user_id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT DEFAULT '',
  name TEXT DEFAULT '',
  avatar_url TEXT DEFAULT '',
  auth_provider TEXT DEFAULT 'email',
  google_id TEXT DEFAULT '',
  google_access_token TEXT DEFAULT '',
  google_refresh_token TEXT DEFAULT '',
  google_token_expires_at TEXT DEFAULT '',
  drive_folder_id TEXT DEFAULT '',
  is_active INTEGER DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- Master entities (companies, customers, products, salespersons)
CREATE TABLE IF NOT EXISTS master (
  entity_id TEXT PRIMARY KEY,
  entity_type TEXT NOT NULL,
  user_id TEXT NOT NULL,
  company_id TEXT NOT NULL,
  code TEXT DEFAULT '',
  name TEXT NOT NULL DEFAULT '',
  name2 TEXT DEFAULT '',
  tax_id TEXT DEFAULT '',
  phone TEXT DEFAULT '',
  email TEXT DEFAULT '',
  address TEXT DEFAULT '',
  tags TEXT DEFAULT '',
  status TEXT DEFAULT 'ACTIVE',
  is_deleted INTEGER DEFAULT 0,
  json TEXT DEFAULT '{}',
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_master_type_company ON master(entity_type, company_id);
CREATE INDEX IF NOT EXISTS idx_master_user ON master(user_id);

-- Documents
CREATE TABLE IF NOT EXISTS documents (
  doc_id TEXT PRIMARY KEY,
  doc_type TEXT NOT NULL,
  user_id TEXT NOT NULL,
  company_id TEXT NOT NULL,
  customer_id TEXT DEFAULT '',
  doc_no TEXT NOT NULL,
  doc_date TEXT DEFAULT '',
  due_date TEXT DEFAULT '',
  ref_doc_no TEXT DEFAULT '',
  currency TEXT DEFAULT 'THB',
  subtotal REAL DEFAULT 0,
  discount_enabled INTEGER DEFAULT 0,
  discount_type TEXT DEFAULT 'AMOUNT',
  discount_value REAL DEFAULT 0,
  vat_enabled INTEGER DEFAULT 0,
  vat_rate REAL DEFAULT 7,
  wht_enabled INTEGER DEFAULT 0,
  wht_rate REAL DEFAULT 3,
  total_before_tax REAL DEFAULT 0,
  vat_amount REAL DEFAULT 0,
  wht_amount REAL DEFAULT 0,
  grand_total REAL DEFAULT 0,
  payment_status TEXT DEFAULT 'UNPAID',
  doc_status TEXT DEFAULT 'DRAFT',
  notes TEXT DEFAULT '',
  terms TEXT DEFAULT '',
  signature_enabled INTEGER DEFAULT 0,
  pdf_file_id TEXT DEFAULT '',
  is_deleted INTEGER DEFAULT 0,
  json TEXT DEFAULT '{}',
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_docs_company_type ON documents(company_id, doc_type);
CREATE INDEX IF NOT EXISTS idx_docs_company_payment ON documents(company_id, payment_status);
CREATE INDEX IF NOT EXISTS idx_docs_user ON documents(user_id);

-- Document Lines
CREATE TABLE IF NOT EXISTS doc_lines (
  line_id TEXT PRIMARY KEY,
  doc_id TEXT NOT NULL,
  line_no INTEGER DEFAULT 0,
  product_id TEXT DEFAULT '',
  code TEXT DEFAULT '',
  name TEXT DEFAULT '',
  description TEXT DEFAULT '',
  qty REAL DEFAULT 0,
  unit TEXT DEFAULT '',
  unit_price REAL DEFAULT 0,
  discount_type TEXT DEFAULT '',
  discount_value REAL DEFAULT 0,
  line_total REAL DEFAULT 0,
  json TEXT DEFAULT '{}',
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (doc_id) REFERENCES documents(doc_id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_lines_docid ON doc_lines(doc_id);

-- Settings
CREATE TABLE IF NOT EXISTS settings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  key TEXT NOT NULL,
  scope_type TEXT DEFAULT 'GLOBAL',
  scope_id TEXT DEFAULT '',
  value TEXT DEFAULT '',
  updated_at TEXT DEFAULT (datetime('now')),
  UNIQUE(key, scope_type, scope_id)
);

-- Team Members
CREATE TABLE IF NOT EXISTS team_members (
  member_id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL,
  user_id TEXT DEFAULT '',
  email TEXT NOT NULL,
  name TEXT DEFAULT '',
  role TEXT DEFAULT 'member',
  permissions TEXT DEFAULT '[]',
  status TEXT DEFAULT 'pending',
  invite_token TEXT DEFAULT '',
  invite_expires_at TEXT DEFAULT '',
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_team_company ON team_members(company_id);
CREATE INDEX IF NOT EXISTS idx_team_token ON team_members(invite_token);

-- Events / Audit Log
CREATE TABLE IF NOT EXISTS events (
  event_id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  company_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  ref_type TEXT DEFAULT '',
  ref_id TEXT DEFAULT '',
  user_email TEXT DEFAULT '',
  amount REAL DEFAULT 0,
  from_status TEXT DEFAULT '',
  to_status TEXT DEFAULT '',
  note TEXT DEFAULT '',
  json TEXT DEFAULT '{}',
  created_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_events_company ON events(company_id);

-- Files (metadata — actual files stored on Google Drive)
CREATE TABLE IF NOT EXISTS files (
  file_id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  company_id TEXT NOT NULL,
  ref_type TEXT DEFAULT '',
  ref_id TEXT DEFAULT '',
  mime_type TEXT DEFAULT '',
  name TEXT DEFAULT '',
  size INTEGER DEFAULT 0,
  drive_file_id TEXT DEFAULT '',
  drive_url TEXT DEFAULT '',
  is_deleted INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_files_company ON files(company_id);

-- Sequences (doc number generation)
CREATE TABLE IF NOT EXISTS sequences (
  id TEXT PRIMARY KEY,
  current_value INTEGER DEFAULT 0,
  updated_at TEXT DEFAULT (datetime('now'))
);
