import type { DatabaseSync } from "node:sqlite";
import {
  remoteJob,
  nextState,
  type RenderState,
} from "../contracts/render-state.ts";
export function reconcileRender(db: DatabaseSync, id: string, value: unknown) {
  const incoming = remoteJob(value, id);
  const row = db.prepare("SELECT state FROM renders WHERE id=?").get(id);
  if (!row) throw new Error("任务不存在");
  const current = String(row.state) as RenderState;
  const state = nextState(current, incoming.state);
  if (state !== incoming.state) return;
  db.prepare("UPDATE renders SET state=?,error=? WHERE id=?").run(
    state,
    incoming.error,
    id,
  );
}
