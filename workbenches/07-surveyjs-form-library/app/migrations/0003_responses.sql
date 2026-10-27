CREATE TABLE responses (id TEXT PRIMARY KEY,project_id TEXT NOT NULL,schema_json TEXT NOT NULL,answers_json TEXT NOT NULL,created_at TEXT NOT NULL,FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE);
CREATE INDEX responses_by_project ON responses(project_id,created_at);
