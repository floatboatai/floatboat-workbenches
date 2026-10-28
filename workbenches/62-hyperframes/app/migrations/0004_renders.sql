CREATE TABLE renders(id TEXT PRIMARY KEY,project_id TEXT NOT NULL,snapshot TEXT NOT NULL,state TEXT NOT NULL,created_at TEXT NOT NULL,error TEXT NOT NULL DEFAULT '');
CREATE INDEX renders_project ON renders(project_id,created_at);
