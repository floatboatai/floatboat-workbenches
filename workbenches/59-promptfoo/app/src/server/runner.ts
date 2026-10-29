// ABOUTME: 可选的官方 promptfoo 0.125.1 执行器连接：把当前配置与录制输出交给独立进程做交叉核对。
import { createHash } from "node:crypto";
import type { DatabaseSync } from "node:sqlite";
import { isRecord } from "../contracts/project.ts";
import { parseRun } from "../contracts/results.ts";
import { parseSuite } from "../contracts/config.ts";
import type { Runs } from "./runs.ts";
import { StoreError } from "./store.ts";

export const RUNNER_START = "cd workbenches/59-promptfoo/service && pnpm install --frozen-lockfile --ignore-scripts && pnpm start";
export const jobId = (value: unknown) => {
  if (typeof value !== "string" || !/^eval-[a-f0-9-]{36}$/.test(value)) throw new StoreError(400, "任务标识无效。");
  return value;
};
export function createRunner(
  db: DatabaseSync,
  runs: Runs,
  origin: string | undefined = process.env.PROMPTFOO_RUNNER_URL,
  key: string | undefined = process.env.PROMPTFOO_RUNNER_TOKEN,
  fetcher: typeof fetch = fetch,
) {
  let base: URL | null = null;
  let configError = "";
  if (origin) {
    try {
      base = new URL(origin);
      if (!["http:", "https:"].includes(base.protocol) || base.username || base.password || base.search || base.hash || base.pathname !== "/")
        throw new Error("PROMPTFOO_RUNNER_URL 需要无路径、无凭据的 HTTP(S) 来源。");
      if (base.protocol === "http:" && !["127.0.0.1", "localhost", "[::1]"].includes(base.hostname)) throw new Error("远程执行器必须使用 HTTPS。");
    } catch (e) {
      base = null;
      configError = e instanceof Error ? e.message : "PROMPTFOO_RUNNER_URL 无效。";
    }
  }
  async function call(path: string, method = "GET", payload?: unknown) {
    if (!base) throw new StoreError(400, "未连接官方执行器。");
    const response = await fetcher(new URL(path, base), {
      method,
      redirect: "error",
      signal: AbortSignal.timeout(20000),
      headers: { "content-type": "application/json", ...(key ? { authorization: `Bearer ${key}` } : {}) },
      ...(payload ? { body: JSON.stringify(payload) } : {}),
    });
    if (!response.body) throw new Error("执行器没有返回内容。");
    const reader = response.body.getReader();
    const parts: Uint8Array[] = [];
    let total = 0;
    try {
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        total += value.length;
        if (total > 45_000_000) throw new Error("执行器结果超过 45MB。");
        parts.push(value);
      }
    } finally {
      await reader.cancel().catch(() => {});
    }
    let result: unknown;
    try {
      result = JSON.parse(Buffer.concat(parts).toString());
    } catch {
      throw new Error("执行器响应无效。");
    }
    if (!response.ok)
      throw new StoreError(400, isRecord(result) && typeof result.error === "string" ? `官方执行器拒绝：${result.error}` : `官方执行器返回 ${response.status}。`);
    return result;
  }
  function read(id: string) {
    const row = db.prepare("SELECT id,state,report,error FROM evaluation_jobs WHERE id=?").get(jobId(id));
    if (!row) throw new StoreError(404, "核对任务尚未提交。");
    const runId = `off-${String(row.id).slice(5)}`;
    const run = row.state === "completed" ? db.prepare("SELECT id,name,origin,stats,created_at FROM eval_runs WHERE id=?").get(runId) : undefined;
    return { id: String(row.id), state: String(row.state), error: String(row.error), run: run ? runs.ref(run) : null };
  }
  function accept(id: string, value: unknown) {
    if (!isRecord(value) || value.id !== id || !["queued", "running", "completed", "failed", "interrupted"].includes(String(value.state)))
      throw new Error("执行器返回了无效的任务状态。");
    const current = read(id);
    if (["completed", "failed", "interrupted"].includes(current.state)) return current;
    const state = String(value.state);
    if (current.state === "running" && state === "queued") return current;
    let error = "";
    if (state === "completed") {
      parseRun(value.report);
      runs.store(`off-${id.slice(5)}`, "官方 promptfoo 0.125.1 核对", "official", value.report);
    } else if (state === "failed" || state === "interrupted")
      error = typeof value.error === "string" && value.error ? value.error.slice(0, 1000) : "执行未完成，请检查执行器记录。";
    db.prepare("UPDATE evaluation_jobs SET state=?,error=?,updated_at=? WHERE id=?").run(state, error, new Date().toISOString(), id);
    return read(id);
  }
  return {
    read,
    async health() {
      if (!base)
        return {
          connected: false,
          configured: false,
          message: configError || "官方 promptfoo 执行器为可选项，未配置。本机评测不需要它。",
          start: RUNNER_START,
        };
      try {
        const r = await call("/health");
        if (!isRecord(r) || r.service !== "floatboat-promptfoo-runner" || r.version !== "0.125.1" || r.protocol !== 2)
          throw new Error("执行器协议或版本不匹配，请更新 service/。");
        return { connected: true, configured: true, allowJavascript: r.allowJavascript === true, message: "官方 promptfoo 0.125.1 执行器已连接", start: RUNNER_START };
      } catch (e) {
        return {
          connected: false,
          configured: true,
          message: `官方执行器暂不可达（${base.origin}）：${e instanceof Error ? e.message.slice(0, 120) : ""}`,
          start: RUNNER_START,
        };
      }
    },
    async start(body: unknown) {
      if (!isRecord(body) || typeof body.config !== "string") throw new StoreError(400, "核对请求无效。");
      const id = jobId(body.id);
      try {
        parseSuite(body.config);
      } catch (e) {
        throw new StoreError(400, e instanceof Error ? e.message : "配置无效。");
      }
      const sources = Array.isArray(body.sources) ? body.sources : [];
      const recordings = [...runs.recordings(sources)].map(([k, v]) => [k, { output: v.output, latencyMs: v.latencyMs, cost: v.cost, tokenUsage: v.tokenUsage, finishReason: v.finishReason }]);
      const payload = JSON.stringify({ config: body.config, recordings });
      const digest = createHash("sha256").update(payload).digest("hex");
      const existing = db.prepare("SELECT digest,state FROM evaluation_jobs WHERE id=?").get(id);
      if (existing) {
        if (existing.digest !== digest) throw new StoreError(409, "同一任务标识不能用于不同输入。");
        if (existing.state !== "uncertain") return read(id);
      } else {
        if (!base) throw new StoreError(400, "未连接官方执行器。");
        const now = new Date().toISOString();
        db.prepare("INSERT INTO evaluation_jobs(id,digest,payload,state,created_at,updated_at) VALUES(?,?,?,'submitting',?,?)").run(id, digest, "", now, now);
      }
      try {
        return accept(id, await call("/jobs", "POST", { id, config: body.config, recordings }));
      } catch (e) {
        if (e instanceof StoreError) {
          db.prepare("UPDATE evaluation_jobs SET state='failed',error=?,updated_at=? WHERE id=? AND state NOT IN ('completed','failed','interrupted')").run(e.message, new Date().toISOString(), id);
          return read(id);
        }
        db.prepare("UPDATE evaluation_jobs SET state='uncertain',error=?,updated_at=? WHERE id=? AND state='submitting'").run(
          "提交回执未确认；可重试同一任务，不会重复执行。",
          new Date().toISOString(),
          id,
        );
        return read(id);
      }
    },
    async poll(id: string) {
      const current = read(id);
      if (["completed", "failed", "interrupted"].includes(current.state)) return current;
      try {
        return accept(id, await call(`/jobs/${jobId(id)}`));
      } catch {
        return { ...read(id), error: "暂时无法查询此任务；任务编号已保留。" };
      }
    },
  };
}
