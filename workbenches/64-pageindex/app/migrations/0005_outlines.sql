-- 可选PageIndex服务生成的章节树，独立于浏览器提取的原文与书签目录保存。
CREATE TABLE reader_outlines(document_id TEXT NOT NULL,source TEXT NOT NULL,payload TEXT NOT NULL,created_at TEXT NOT NULL,PRIMARY KEY(document_id,source));
