CREATE TABLE docling_operations (
 id TEXT PRIMARY KEY,
 filename TEXT NOT NULL,
 input_hash TEXT NOT NULL,
 service_hash TEXT NOT NULL,
 task_id TEXT,
 state TEXT NOT NULL,
 message TEXT NOT NULL,
 created_at TEXT NOT NULL,
 updated_at TEXT NOT NULL
);
