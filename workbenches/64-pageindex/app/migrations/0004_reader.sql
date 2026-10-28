CREATE TABLE reader_documents(id TEXT PRIMARY KEY,payload TEXT NOT NULL,created_at TEXT NOT NULL);
CREATE TABLE reader_questions(id TEXT PRIMARY KEY,project_id TEXT NOT NULL,document_id TEXT NOT NULL,question TEXT NOT NULL,status TEXT NOT NULL,result TEXT,error TEXT NOT NULL DEFAULT '',created_at TEXT NOT NULL);
CREATE INDEX reader_questions_project ON reader_questions(project_id,created_at);
