-- 0.9.0：项目数据集（CSV/TSV/JSON 原文），按内容哈希去重；图表模型只保存引用。
CREATE TABLE datasets(
  id TEXT PRIMARY KEY,
  format TEXT NOT NULL,
  bytes INTEGER NOT NULL,
  rows INTEGER NOT NULL,
  columns TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at TEXT NOT NULL
);
