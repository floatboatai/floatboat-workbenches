// ABOUTME: 运行记录、产物文件与连接设置的 SQLite 存取，含数量与容量上限。

import { randomUUID } from "node:crypto";
import type { DatabaseSync } from "node:sqlite";
import type { ApiPrompt } from "../contracts/convert.ts";
import type { UiWorkflow } from "../contracts/workflow.ts";
import {
  runFacts,
  type OutputMeta,
  type RunDetail,
  type RunError,
  type RunStatus,
  type RunSummary,
} from "../contracts/run.ts";

export const MAX_RUNS_PER_PROJECT = 60;
export const MAX_PROJECT_OUTPUT_BYTES = 256 * 1024 * 1024;
export const MAX_OUTPUT_BYTES = 32 * 1024 * 1024;

type Row = Record<string, unknown>;
const text = (v: unknown) => String(v ?? "");
const orNull = (v: unknown) => (v === null || v === undefined ? null : Number(v));

export function createRunStore(db: DatabaseSync) {
  const outputsOf = (runId: string): OutputMeta[] =>
    db
      .prepare(
        "SELECT id,run_id,node_id,filename,subfolder,kind,mime,width,height,bytes FROM comfy_outputs WHERE run_id=? ORDER BY created_at,rowid",
      )
      .all(runId)
      .map((r: Row) => ({
        id: text(r.id),
        runId: text(r.run_id),
        nodeId: text(r.node_id),
        filename: text(r.filename),
        subfolder: text(r.subfolder),
        kind: text(r.kind),
        mime: text(r.mime),
        width: orNull(r.width),
        height: orNull(r.height),
        bytes: Number(r.bytes),
      }));

  function summary(r: Row, prompt?: ApiPrompt): RunSummary {
    const p: ApiPrompt = prompt ?? (JSON.parse(text(r.prompt)) as ApiPrompt);
    return {
      id: text(r.id),
      projectId: text(r.project_id),
      title: text(r.title),
      status: text(r.status) as RunStatus,
      createdAt: text(r.created_at),
      finishedAt: r.finished_at ? text(r.finished_at) : null,
      durationMs: orNull(r.duration_ms),
      promptId: text(r.prompt_id),
      server: text(r.server),
      error: r.error ? (JSON.parse(text(r.error)) as RunError) : null,
      outputs: outputsOf(text(r.id)),
      facts: runFacts(p),
      nodeCount: Number(r.node_count),
    };
  }

  const store = {
    create(input: {
      projectId: string;
      promptId: string;
      server: string;
      title: string;
      prompt: ApiPrompt;
      workflow: UiWorkflow;
    }): RunSummary {
      const id = randomUUID();
      db.prepare(
        "INSERT INTO comfy_runs(id,project_id,prompt_id,server,title,status,created_at,node_count,prompt,workflow) VALUES(?,?,?,?,?,?,?,?,?,?)",
      ).run(
        id,
        input.projectId,
        input.promptId,
        input.server,
        input.title,
        "queued",
        new Date().toISOString(),
        Object.keys(input.prompt).length,
        JSON.stringify(input.prompt),
        JSON.stringify(input.workflow),
      );
      store.prune(input.projectId);
      return store.summary(id)!;
    },
    summary(id: string): RunSummary | null {
      const row = db.prepare("SELECT * FROM comfy_runs WHERE id=?").get(id);
      return row ? summary(row) : null;
    },
    detail(id: string): RunDetail | null {
      const row = db.prepare("SELECT * FROM comfy_runs WHERE id=?").get(id);
      if (!row) return null;
      const prompt = JSON.parse(text(row.prompt)) as ApiPrompt;
      return { ...summary(row, prompt), prompt, workflow: JSON.parse(text(row.workflow)) as UiWorkflow };
    },
    list(projectId: string): RunSummary[] {
      return db
        .prepare("SELECT * FROM comfy_runs WHERE project_id=? ORDER BY created_at DESC,rowid DESC LIMIT ?")
        .all(projectId, MAX_RUNS_PER_PROJECT)
        .map((r) => summary(r));
    },
    active(): { id: string; promptId: string; projectId: string }[] {
      return db
        .prepare("SELECT id,prompt_id,project_id FROM comfy_runs WHERE status IN ('queued','running')")
        .all()
        .map((r: Row) => ({ id: text(r.id), promptId: text(r.prompt_id), projectId: text(r.project_id) }));
    },
    setStatus(id: string, status: RunStatus, error?: RunError | null) {
      const finished = ["success", "error", "interrupted", "cancelled"].includes(status);
      const row = db.prepare("SELECT created_at FROM comfy_runs WHERE id=?").get(id);
      if (!row) return;
      const now = new Date();
      db.prepare(
        "UPDATE comfy_runs SET status=?,finished_at=?,duration_ms=?,error=COALESCE(?,error) WHERE id=?",
      ).run(
        status,
        finished ? now.toISOString() : null,
        finished ? Math.max(0, now.getTime() - new Date(text(row.created_at)).getTime()) : null,
        error ? JSON.stringify(error) : null,
        id,
      );
    },
    addOutput(
      runId: string,
      projectId: string,
      meta: { nodeId: string; filename: string; subfolder: string; kind: string; mime: string; width: number | null; height: number | null },
      data: Uint8Array,
    ): OutputMeta | null {
      if (data.length > MAX_OUTPUT_BYTES) return null;
      const dup = db
        .prepare("SELECT id FROM comfy_outputs WHERE run_id=? AND node_id=? AND filename=? AND subfolder=? AND kind=?")
        .get(runId, meta.nodeId, meta.filename, meta.subfolder, meta.kind);
      if (dup) return outputsOf(runId).find((o) => o.id === text(dup.id)) ?? null;
      const id = randomUUID();
      db.prepare(
        "INSERT INTO comfy_outputs(id,run_id,project_id,node_id,filename,subfolder,kind,mime,width,height,bytes,data,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)",
      ).run(id, runId, projectId, meta.nodeId, meta.filename, meta.subfolder, meta.kind, meta.mime, meta.width, meta.height, data.length, data, new Date().toISOString());
      store.prune(projectId);
      return outputsOf(runId).find((o) => o.id === id) ?? null;
    },
    output(id: string): { mime: string; data: Uint8Array; filename: string } | null {
      const row = db.prepare("SELECT mime,data,filename FROM comfy_outputs WHERE id=?").get(id);
      if (!row) return null;
      return { mime: text(row.mime), data: row.data as Uint8Array, filename: text(row.filename) };
    },
    outputRun(outputId: string): string | null {
      const row = db.prepare("SELECT run_id FROM comfy_outputs WHERE id=?").get(outputId);
      return row ? text(row.run_id) : null;
    },
    remove(id: string) {
      db.prepare("DELETE FROM comfy_outputs WHERE run_id=?").run(id);
      return db.prepare("DELETE FROM comfy_runs WHERE id=?").run(id).changes > 0;
    },
    removeProject(projectId: string) {
      db.prepare("DELETE FROM comfy_outputs WHERE project_id=?").run(projectId);
      db.prepare("DELETE FROM comfy_runs WHERE project_id=?").run(projectId);
    },
    /** Drops the oldest finished runs beyond the count and storage limits. */
    prune(projectId: string) {
      const rows = db
        .prepare("SELECT id,status FROM comfy_runs WHERE project_id=? ORDER BY created_at DESC,rowid DESC")
        .all(projectId);
      rows.slice(MAX_RUNS_PER_PROJECT).forEach((r: Row) => {
        if (!["queued", "running"].includes(text(r.status))) store.remove(text(r.id));
      });
      let total = Number(
        db.prepare("SELECT COALESCE(SUM(bytes),0) AS n FROM comfy_outputs WHERE project_id=?").get(projectId)?.n ?? 0,
      );
      if (total <= MAX_PROJECT_OUTPUT_BYTES) return;
      const oldest = db
        .prepare("SELECT id,status FROM comfy_runs WHERE project_id=? ORDER BY created_at ASC,rowid ASC")
        .all(projectId);
      for (const r of oldest) {
        if (total <= MAX_PROJECT_OUTPUT_BYTES) break;
        if (["queued", "running"].includes(text(r.status))) continue;
        const size = Number(
          db.prepare("SELECT COALESCE(SUM(bytes),0) AS n FROM comfy_outputs WHERE run_id=?").get(text(r.id))?.n ?? 0,
        );
        store.remove(text(r.id));
        total -= size;
      }
    },
    getSetting(key: string): string | null {
      const row = db.prepare("SELECT value FROM comfy_settings WHERE key=?").get(key);
      return row ? text(row.value) : null;
    },
    setSetting(key: string, value: string | null) {
      if (value === null) db.prepare("DELETE FROM comfy_settings WHERE key=?").run(key);
      else
        db.prepare("INSERT INTO comfy_settings(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value").run(key, value);
    },
  };
  return store;
}
export type RunStore = ReturnType<typeof createRunStore>;
