CREATE TABLE autosave_drafts (
  id TEXT PRIMARY KEY,
  project_id TEXT,
  project_revision INTEGER,
  revision INTEGER NOT NULL,
  mutation_id TEXT NOT NULL,
  snapshot TEXT NOT NULL,
  receipt TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX autosave_drafts_project ON autosave_drafts(project_id, updated_at);
