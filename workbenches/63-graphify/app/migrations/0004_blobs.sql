-- 内容地址库：上传的原文与图谱 JSON 按 SHA-256 存放，项目只保存引用。
CREATE TABLE blobs(hash TEXT PRIMARY KEY,kind TEXT NOT NULL,bytes INTEGER NOT NULL,body TEXT NOT NULL,created_at TEXT NOT NULL);
