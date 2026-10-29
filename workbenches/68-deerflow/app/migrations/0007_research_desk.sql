-- 0.9.0：DeerFlow 流式事件账本、运行中快照与页面保存的服务地址。
ALTER TABLE deerflow_research_runs ADD COLUMN live_native TEXT NOT NULL DEFAULT '';
ALTER TABLE deerflow_research_runs ADD COLUMN stream_status TEXT NOT NULL DEFAULT '';
ALTER TABLE deerflow_research_runs ADD COLUMN last_event_id TEXT NOT NULL DEFAULT '';
CREATE TABLE deerflow_run_events(run_id TEXT NOT NULL,seq INTEGER NOT NULL,upstream_id TEXT NOT NULL DEFAULT '',event TEXT NOT NULL,summary TEXT NOT NULL,created_at TEXT NOT NULL,PRIMARY KEY(run_id,seq));
CREATE TABLE deerflow_settings(key TEXT PRIMARY KEY,value TEXT NOT NULL,updated_at TEXT NOT NULL);
