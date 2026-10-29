// ABOUTME: 运行结果表、分片导入、本机评测任务（持久、幂等、可停止、重启标为中断）与 0.4 项目迁移。
import { createHash, randomUUID } from "node:crypto";
import type { DatabaseSync } from "node:sqlite";
import { parseSuite } from "../contracts/config.ts";
import { parseConfigText } from "../contracts/config.ts";
import { isRecord } from "../contracts/project.ts";
import { MAX_RESULT_BYTES, parseRun, recordingsOf, runStats, type RecordingEntry } from "../contracts/results.ts";
import { legacySuiteToYaml, runIdPattern, type RunOrigin, type RunRef } from "../contracts/evaluation.ts";
import { evaluateSuite, type HostModel } from "./evaluator.ts";
import type { Sandbox } from "./sandbox.ts";
import { StoreError } from "./store.ts";

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export const MAX_UPLOAD_PART = 1_500_000;

export function createRuns(db: DatabaseSync) {
  db.exec("UPDATE eval_tasks SET state='interrupted',error='服务重启时评测尚未完成；已执行的模型调用不会自动重放，请检查后重新运行。' WHERE state IN ('queued','running')");
  db.exec("DELETE FROM eval_uploads WHERE created_at < datetime('now','-1 day')");
  function ref(row: Record<string, unknown>): RunRef {
    return {
      id: String(row.id),
      name: String(row.name),
      origin: String(row.origin) as RunOrigin,
      createdAt: String(row.created_at),
      stats: JSON.parse(String(row.stats)),
    };
  }
  function store(id: string, name: string, origin: RunOrigin, value: unknown): RunRef {
    if (!runIdPattern.test(id)) throw new StoreError(400, "运行标识无效。");
    const existing = db.prepare("SELECT id,name,origin,stats,created_at FROM eval_runs WHERE id=?").get(id);
    if (existing) return ref(existing);
    const raw = JSON.stringify(value);
    if (Buffer.byteLength(raw) > MAX_RESULT_BYTES) throw new StoreError(413, "结果超过 40MB，请分批导出。");
    const view = parseRun(value);
    const stats = runStats(view);
    db.prepare("INSERT INTO eval_runs(id,name,origin,raw,stats,bytes,created_at) VALUES(?,?,?,?,?,?,?)").run(
      id,
      name.slice(0, 200) || "评测运行",
      origin,
      raw,
      JSON.stringify(stats),
      Buffer.byteLength(raw),
      new Date().toISOString(),
    );
    return ref(db.prepare("SELECT id,name,origin,stats,created_at FROM eval_runs WHERE id=?").get(id)!);
  }
  function raw(id: string): string {
    if (!runIdPattern.test(id)) throw new StoreError(400, "运行标识无效。");
    const row = db.prepare("SELECT raw FROM eval_runs WHERE id=?").get(id);
    if (!row) throw new StoreError(404, "运行结果不在本机（可能来自另一台设备的项目），请重新导入结果文件。");
    return String(row.raw);
  }
  function recordings(sources: unknown): Map<string, RecordingEntry & { runId: string }> {
    const out = new Map<string, RecordingEntry & { runId: string }>();
    if (!Array.isArray(sources)) return out;
    for (const id of sources.slice(0, 60)) {
      if (typeof id !== "string" || !runIdPattern.test(id)) continue;
      const row = db.prepare("SELECT raw FROM eval_runs WHERE id=?").get(id);
      if (!row) continue;
      try {
        for (const [k, v] of recordingsOf(JSON.parse(String(row.raw)))) if (!out.has(k)) out.set(k, { ...v, runId: id });
      } catch {
        /* 损坏的旧结果不作为录制来源 */
      }
    }
    return out;
  }
  /** 分片导入：每片 ≤1.5MB 文本，最后一片到达后拼接、校验并入库；同一 uploadId 重放返回同一运行。 */
  function importPart(body: unknown): { done: false; received: number } | { done: true; run: RunRef } {
    if (!isRecord(body) || typeof body.uploadId !== "string" || !uuid.test(body.uploadId)) throw new StoreError(400, "导入标识无效。");
    const id = `imp-${body.uploadId.toLowerCase()}`;
    const done = db.prepare("SELECT id,name,origin,stats,created_at FROM eval_runs WHERE id=?").get(id);
    if (done) return { done: true, run: ref(done) };
    const part = Number(body.part),
      total = Number(body.total);
    if (!Number.isSafeInteger(total) || total < 1 || total > 120 || !Number.isSafeInteger(part) || part < 0 || part >= total)
      throw new StoreError(400, "导入分片编号无效。");
    if (typeof body.data !== "string" || body.data.length > MAX_UPLOAD_PART) throw new StoreError(413, "导入分片超过容量。");
    db.prepare("INSERT OR REPLACE INTO eval_uploads(id,part,total,data,created_at) VALUES(?,?,?,?,datetime('now'))").run(id, part, total, body.data);
    const parts = db.prepare("SELECT part,data FROM eval_uploads WHERE id=? AND total=? ORDER BY part").all(id, total);
    if (parts.length < total) return { done: false, received: parts.length };
    const text = parts.map((p) => String(p.data)).join("");
    let value: unknown;
    try {
      value = JSON.parse(text);
    } catch {
      db.prepare("DELETE FROM eval_uploads WHERE id=?").run(id);
      throw new StoreError(400, "结果文件不是完整 JSON。");
    }
    try {
      const run = store(id, typeof body.name === "string" ? body.name : "导入的结果", "import", value);
      db.prepare("DELETE FROM eval_uploads WHERE id=?").run(id);
      return { done: true, run };
    } catch (e) {
      db.prepare("DELETE FROM eval_uploads WHERE id=?").run(id);
      throw e instanceof StoreError ? e : new StoreError(400, e instanceof Error ? e.message : "结果文件无效。");
    }
  }
  return { store, raw, recordings, importPart, ref };
}
export type Runs = ReturnType<typeof createRuns>;

export interface TaskView {
  id: string;
  state: "queued" | "running" | "completed" | "failed" | "cancelled" | "interrupted";
  done: number;
  total: number;
  hostCalls: number;
  run: RunRef | null;
  error: string;
}
export function createTasks(db: DatabaseSync, runs: Runs, deps: { sandbox: Sandbox; host: () => HostModel | null; track?: <T>(p: () => Promise<T>) => Promise<T> }) {
  const controllers = new Map<string, AbortController>();
  function view(id: string): TaskView {
    if (!uuid.test(id)) throw new StoreError(400, "任务标识无效。");
    const row = db.prepare("SELECT * FROM eval_tasks WHERE id=?").get(id);
    if (!row) throw new StoreError(404, "评测任务尚未提交。");
    let run: RunRef | null = null;
    if (row.run_id) {
      const r = db.prepare("SELECT id,name,origin,stats,created_at FROM eval_runs WHERE id=?").get(String(row.run_id));
      if (r) run = runs.ref(r);
    }
    return {
      id,
      state: String(row.state) as TaskView["state"],
      done: Number(row.done),
      total: Number(row.total),
      hostCalls: Number(row.host_calls),
      run,
      error: String(row.error),
    };
  }
  const update = (id: string, fields: Record<string, string | number | null>) => {
    const keys = Object.keys(fields);
    db.prepare(`UPDATE eval_tasks SET ${keys.map((k) => `${k}=?`).join(",")},updated_at=? WHERE id=?`).run(
      ...keys.map((k) => fields[k]),
      new Date().toISOString(),
      id,
    );
  };
  function start(body: unknown): TaskView {
    if (!isRecord(body) || typeof body.id !== "string" || !uuid.test(body.id)) throw new StoreError(400, "任务标识无效。");
    const id = body.id;
    if (typeof body.config !== "string") throw new StoreError(400, "缺少评测配置。");
    const sources = Array.isArray(body.sources) ? body.sources.filter((x): x is string => typeof x === "string" && runIdPattern.test(x)).slice(0, 60) : [];
    const allowHost = body.allowHost === true;
    const name = typeof body.name === "string" ? body.name.slice(0, 200) : "本机评测";
    const digest = createHash("sha256").update(JSON.stringify([body.config, sources, allowHost, name])).digest("hex");
    const existing = db.prepare("SELECT digest FROM eval_tasks WHERE id=?").get(id);
    if (existing) {
      if (existing.digest !== digest) throw new StoreError(409, "同一任务标识不能用于不同输入。");
      return view(id);
    }
    let suite;
    try {
      suite = parseSuite(body.config);
    } catch (e) {
      throw new StoreError(400, e instanceof Error ? e.message : "配置无效。");
    }
    const hostCalls = suite.columns.filter((c) => c.provider.kind === "host").length * suite.tests.length;
    if (hostCalls && !allowHost) throw new StoreError(400, `此配置包含 Floatboat 模型列，将发起 ${hostCalls} 次真实模型调用；请在运行前确认。`);
    if (hostCalls && !deps.host()) throw new StoreError(400, "此配置包含 Floatboat 模型列，但工作台没有连接 Floatboat。");
    const now = new Date().toISOString();
    db.prepare("INSERT INTO eval_tasks(id,digest,state,done,total,host_calls,created_at,updated_at) VALUES(?,?,'queued',0,?,?,?,?)").run(
      id,
      digest,
      suite.columns.length * suite.tests.length,
      hostCalls,
      now,
      now,
    );
    const controller = new AbortController();
    controllers.set(id, controller);
    const recordings = runs.recordings(sources);
    const config = parseConfigText(body.config);
    const work = async () => {
      update(id, { state: "running" });
      let last = 0;
      try {
        const result = await evaluateSuite(suite, config, {
          sandbox: deps.sandbox,
          recordings,
          host: hostCalls ? deps.host() : null,
          allowHost,
          signal: controller.signal,
          evalId: `eval-${id.slice(0, 8)}`,
          onProgress(done) {
            if (done - last >= 10 || done === suite.columns.length * suite.tests.length) {
              last = done;
              update(id, { done });
            }
          },
        });
        if (controller.signal.aborted) throw new Error("评测已停止。");
        const run = runs.store(`run-${id}`, name, "local", result);
        update(id, { state: "completed", run_id: run.id, done: suite.columns.length * suite.tests.length });
      } catch (e) {
        if (controller.signal.aborted) update(id, { state: "cancelled", error: "已停止；已完成的模型调用不会重放。" });
        else update(id, { state: "failed", error: e instanceof Error ? e.message.slice(0, 2000) : "评测失败" });
      } finally {
        controllers.delete(id);
      }
    };
    void (deps.track ? deps.track(work) : work());
    return view(id);
  }
  function cancel(id: string) {
    const c = controllers.get(id);
    if (c) c.abort();
    return view(id);
  }
  return { start, view, cancel, controllers };
}

/** 把 0.4 项目（报告内嵌在项目里）迁移为 0.9：报告进入运行表，复核记录改用稳定单元格键。 */
export function migrateLegacyProjects(db: DatabaseSync, runs: Runs) {
  const rows = db.prepare("SELECT id,payload,revision FROM projects").all();
  for (const row of rows) {
    let data: unknown;
    try {
      data = JSON.parse(String(row.payload));
    } catch {
      continue;
    }
    if (!isRecord(data) || data.version === 2 || !Array.isArray(data.reports)) continue;
    const refs: RunRef[] = [];
    const reviews: Record<string, unknown> = {};
    const idMap = new Map<string, string>();
    for (const r of data.reports) {
      if (!isRecord(r) || typeof r.raw !== "string" || typeof r.id !== "string") continue;
      try {
        const value: unknown = JSON.parse(r.raw);
        const runId = `legacy-${createHash("sha256").update(`${row.id}:${r.id}`).digest("hex").slice(0, 24)}`;
        refs.push(runs.store(runId, typeof r.name === "string" ? r.name : "0.4 报告", "import", value));
        idMap.set(r.id, runId);
        const view = parseRun(value);
        if (isRecord(data.reviews))
          for (const [k, v] of Object.entries(data.reviews)) {
            const m = /^(.+):(\d+):(\d+)$/.exec(k);
            if (!m || m[1] !== r.id) continue;
            const cell = view.cells.find((c) => c.test === Number(m[2]) && c.column === Number(m[3]));
            if (cell) reviews[`${runId}:${cell.key}`] = v;
          }
      } catch {
        /* 无法解析的旧报告跳过 */
      }
    }
    const next = {
      version: 2,
      config: typeof data.suite === "string" ? legacySuiteToYaml(data.suite) : "",
      runs: refs,
      current: typeof data.activeId === "string" ? (idMap.get(data.activeId) ?? refs[0]?.id ?? "") : (refs[0]?.id ?? ""),
      baseline: { kind: "none" },
      reviews,
      releases: {},
      gate: { minPassRate: 0.9, maxRegressions: 0, allowErrors: false },
    };
    db.prepare("UPDATE projects SET payload=?,revision=revision+1,updated_at=? WHERE id=? AND revision=?").run(
      JSON.stringify(next),
      new Date().toISOString(),
      String(row.id),
      Number(row.revision),
    );
  }
}
export const newId = () => randomUUID();
