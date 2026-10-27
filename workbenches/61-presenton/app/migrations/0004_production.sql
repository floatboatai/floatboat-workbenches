CREATE TABLE presenton_jobs (
 id TEXT PRIMARY KEY,
 project_id TEXT NOT NULL,
 title TEXT NOT NULL,
 kind TEXT NOT NULL,
 state TEXT NOT NULL,
 origin TEXT NOT NULL,
 input_json TEXT NOT NULL,
 task_id TEXT NOT NULL DEFAULT '',
 presentation_id TEXT NOT NULL DEFAULT '',
 path TEXT NOT NULL DEFAULT '',
 result_json TEXT NOT NULL DEFAULT '{}',
 message TEXT NOT NULL DEFAULT '',
 artifact_json TEXT,
 created_at TEXT NOT NULL,
 updated_at TEXT NOT NULL
);
CREATE INDEX presenton_jobs_project ON presenton_jobs(project_id, created_at);
