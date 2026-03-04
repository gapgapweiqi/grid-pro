-- Add ref_doc_id column to documents for proper chain linking
ALTER TABLE documents ADD COLUMN ref_doc_id TEXT DEFAULT '';
CREATE INDEX IF NOT EXISTS idx_docs_ref ON documents(ref_doc_id);
