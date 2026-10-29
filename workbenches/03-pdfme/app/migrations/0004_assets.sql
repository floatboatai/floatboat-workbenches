-- PDF 底图、图片与数据表原文件；项目中只保存 fbasset:<sha256> 引用。
CREATE TABLE assets(
  id TEXT PRIMARY KEY,
  mime TEXT NOT NULL,
  size INTEGER NOT NULL,
  data BLOB NOT NULL,
  created_at TEXT NOT NULL
);
CREATE TABLE asset_parts(
  asset_id TEXT NOT NULL,
  part INTEGER NOT NULL,
  data BLOB NOT NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY(asset_id, part)
);
