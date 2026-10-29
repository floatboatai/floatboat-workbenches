CREATE TABLE langextract_host_runs (
 id TEXT PRIMARY KEY,
 project_id TEXT NOT NULL,
 model TEXT NOT NULL,
 input_json TEXT NOT NULL,
 status TEXT NOT NULL,
 done INTEGER NOT NULL DEFAULT 0,
 total INTEGER NOT NULL DEFAULT 0,
 warnings_json TEXT NOT NULL DEFAULT '[]',
 result_json TEXT,
 message TEXT NOT NULL DEFAULT '',
 created_at TEXT NOT NULL,
 updated_at TEXT NOT NULL
);
CREATE INDEX langextract_host_runs_created ON langextract_host_runs(created_at);
