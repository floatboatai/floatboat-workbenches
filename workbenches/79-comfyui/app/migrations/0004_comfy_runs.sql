-- ComfyUI run records, fetched output files and connection settings live beside (not inside) the autosaved workflow.
CREATE TABLE comfy_runs(
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  prompt_id TEXT NOT NULL,
  server TEXT NOT NULL,
  title TEXT NOT NULL,
  status TEXT NOT NULL,
  created_at TEXT NOT NULL,
  finished_at TEXT,
  duration_ms INTEGER,
  node_count INTEGER NOT NULL,
  error TEXT,
  prompt TEXT NOT NULL,
  workflow TEXT NOT NULL
);
CREATE INDEX comfy_runs_project ON comfy_runs(project_id, created_at);
CREATE TABLE comfy_outputs(
  id TEXT PRIMARY KEY,
  run_id TEXT NOT NULL,
  project_id TEXT NOT NULL,
  node_id TEXT NOT NULL,
  filename TEXT NOT NULL,
  subfolder TEXT NOT NULL,
  kind TEXT NOT NULL,
  mime TEXT NOT NULL,
  width INTEGER,
  height INTEGER,
  bytes INTEGER NOT NULL,
  data BLOB NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX comfy_outputs_run ON comfy_outputs(run_id);
CREATE INDEX comfy_outputs_project ON comfy_outputs(project_id, created_at);
CREATE TABLE comfy_settings(key TEXT PRIMARY KEY, value TEXT NOT NULL);
