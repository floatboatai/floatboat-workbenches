CREATE TABLE transcription_jobs (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  input TEXT NOT NULL,
  status TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  error TEXT NOT NULL DEFAULT '',
  model TEXT NOT NULL DEFAULT '',
  segments TEXT
);
CREATE INDEX transcription_jobs_project ON transcription_jobs(project_id,created_at);
