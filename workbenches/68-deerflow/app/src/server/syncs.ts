import type { DatabaseSync } from "node:sqlite";
import { threadValue, nativeValue, compactNative } from "../contracts/native.ts";
import { StoreError } from "./store.ts";
export type Sync = {
  id: string;
  projectId: string;
  threadId: string;
  status: string;
  native: string;
  error: string;
  createdAt: string;
  updatedAt: string;
};
export function createSyncs(
  db: DatabaseSync,
  fetcher: (id: string) => Promise<string>,
) {
  const read = (id: string): Sync => {
    const r = db.prepare("SELECT * FROM deerflow_syncs WHERE id=?").get(id);
    if (!r) throw new StoreError(404, "同步记录不存在。");
    return {
      id: String(r.id),
      projectId: String(r.project_id),
      threadId: String(r.thread_id),
      status: String(r.status),
      native: String(r.native),
      error: String(r.error),
      createdAt: String(r.created_at),
      updatedAt: String(r.updated_at),
    };
  };
  async function perform(id: string) {
    const r = read(id);
    try {
      const value = compactNative(await fetcher(r.threadId));
      nativeValue(value);
      db.prepare(
        "UPDATE deerflow_syncs SET status='completed',native=?,error='',updated_at=? WHERE id=? AND status='running'",
      ).run(value, new Date().toISOString(), id);
    } catch (e) {
      db.prepare(
        "UPDATE deerflow_syncs SET status='failed',error=?,updated_at=? WHERE id=? AND status='running'",
      ).run(
        e instanceof Error ? e.message.slice(0, 300) : "同步失败。",
        new Date().toISOString(),
        id,
      );
    }
  }
  db.prepare(
    "UPDATE deerflow_syncs SET status='interrupted',error='服务重启，请核对后重新同步。' WHERE status='running'",
  ).run();
  return {
    read,
    list(projectId: string) {
      return db
        .prepare(
          "SELECT id FROM deerflow_syncs WHERE project_id=? ORDER BY created_at DESC LIMIT 20",
        )
        .all(projectId)
        .map((x) => ({ ...read(String(x.id)), native: "" }));
    },
    async start(projectId: string, id: string, threadId: string) {
      if (!/^[0-9a-f-]{36}$/i.test(id) || !projectId)
        throw new Error("同步编号无效。");
      threadValue(threadId);
      const old = db
        .prepare("SELECT id FROM deerflow_syncs WHERE id=?")
        .get(id);
      if (old) {
        const r = read(id);
        if (r.projectId !== projectId || r.threadId !== threadId)
          throw new StoreError(409, "同步编号与输入不一致。");
        return r;
      }
      if (!db.prepare("SELECT id FROM projects WHERE id=?").get(projectId))
        throw new StoreError(404, "请先保存当前项目。");
      const now = new Date().toISOString();
      db.prepare(
        "INSERT INTO deerflow_syncs(id,project_id,thread_id,status,created_at,updated_at) VALUES(?,?,?,'running',?,?)",
      ).run(id, projectId, threadId, now, now);
      await perform(id);
      return read(id);
    },
  };
}
