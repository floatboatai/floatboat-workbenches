-- 0.9.0：乐谱原件改为按 SHA-256 存入原件库，项目只保存引用、索引、显示设置与批注。
CREATE TABLE score_sources(
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL,
  size INTEGER NOT NULL,
  data BLOB NOT NULL,
  xml TEXT,
  score_index TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE TABLE score_source_parts(
  source_id TEXT NOT NULL,
  part INTEGER NOT NULL,
  data BLOB NOT NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY(source_id, part)
);
