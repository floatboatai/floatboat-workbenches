-- 推演结果（本地确定性推演或导入的 MiroFish 原生动作）按内容寻址保存；分片上传接住大于单次请求上限的原生文件。
CREATE TABLE run_results (id TEXT PRIMARY KEY, kind TEXT NOT NULL, payload TEXT NOT NULL, created_at TEXT NOT NULL);
CREATE TABLE uploads (id TEXT PRIMARY KEY, name TEXT NOT NULL, platform TEXT NOT NULL, chunks INTEGER NOT NULL, result TEXT, created_at TEXT NOT NULL);
CREATE TABLE upload_chunks (upload_id TEXT NOT NULL, seq INTEGER NOT NULL, data TEXT NOT NULL, PRIMARY KEY (upload_id, seq));
