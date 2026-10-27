CREATE TABLE lg_checkpoints (
  thread_id TEXT NOT NULL, namespace TEXT NOT NULL, checkpoint_id TEXT NOT NULL,
  parent_id TEXT, checkpoint_type TEXT NOT NULL, checkpoint BLOB NOT NULL,
  metadata_type TEXT NOT NULL, metadata BLOB NOT NULL,
  PRIMARY KEY(thread_id, namespace, checkpoint_id)
);
CREATE TABLE lg_writes (
  thread_id TEXT NOT NULL, namespace TEXT NOT NULL, checkpoint_id TEXT NOT NULL,
  task_id TEXT NOT NULL, task_path TEXT NOT NULL, idx INTEGER NOT NULL,
  channel TEXT NOT NULL, value_type TEXT NOT NULL, value BLOB NOT NULL,
  PRIMARY KEY(thread_id, namespace, checkpoint_id, task_id, idx)
);
CREATE TABLE lg_runs (
  id TEXT PRIMARY KEY, project_id TEXT NOT NULL, title TEXT NOT NULL, input_json TEXT NOT NULL,
  status TEXT NOT NULL, version INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL, updated_at TEXT NOT NULL, error TEXT NOT NULL DEFAULT '',
  prepared_json TEXT, review_json TEXT, output_json TEXT
);
CREATE INDEX lg_runs_project ON lg_runs(project_id, created_at);
CREATE TABLE lg_actions (
  id TEXT PRIMARY KEY, run_id TEXT NOT NULL, request_json TEXT NOT NULL,
  created_at TEXT NOT NULL
);
