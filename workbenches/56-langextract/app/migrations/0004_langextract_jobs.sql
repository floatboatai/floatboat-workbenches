CREATE TABLE langextract_jobs (
 id TEXT PRIMARY KEY,
 project_id TEXT NOT NULL,
 input_json TEXT NOT NULL,
 status TEXT NOT NULL,
 result_json TEXT,
 message TEXT NOT NULL DEFAULT '',
 created_at TEXT NOT NULL,
 updated_at TEXT NOT NULL
);
