CREATE TABLE docling_blobs (
 id TEXT PRIMARY KEY,
 kind TEXT NOT NULL,
 name TEXT NOT NULL,
 bytes INTEGER NOT NULL,
 received INTEGER NOT NULL,
 state TEXT NOT NULL,
 created_at TEXT NOT NULL,
 updated_at TEXT NOT NULL
);
ALTER TABLE docling_operations ADD COLUMN source_id TEXT;
ALTER TABLE docling_operations ADD COLUMN options TEXT;
ALTER TABLE docling_operations ADD COLUMN result_id TEXT;
