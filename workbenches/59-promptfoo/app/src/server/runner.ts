import { createHash } from "node:crypto";
import type { DatabaseSync } from "node:sqlite";
import { isRecord } from "../contracts/project.ts";
import { parseEvaluation, validateSuite } from "../contracts/evaluation.ts";
export const jobId = (value: unknown) => {
  if (typeof value !== "string" || !/^eval-[a-f0-9-]{36}$/.test(value))
    throw new Error("任务标识无效。");
  return value;
};
export function createRunner(
  db: DatabaseSync,
  origin: string | undefined = process.env.PROMPTFOO_RUNNER_URL,
  key: string | undefined = process.env.PROMPTFOO_RUNNER_TOKEN,
  fetcher: typeof fetch = fetch,
) {
  let base: URL | null = null;
  if (origin) {
    base = new URL(origin);
    if (
      !["http:", "https:"].includes(base.protocol) ||
      base.username ||
      base.password ||
      base.search ||
      base.hash ||
      base.pathname !== "/"
    )
      throw new Error(
        "PROMPTFOO_RUNNER_URL 需要无路径、无凭据的 HTTP(S) 来源。",
      );
    if (
      base.protocol === "http:" &&
      !["127.0.0.1", "localhost", "[::1]"].includes(base.hostname)
    )
      throw new Error("远程执行器必须使用 HTTPS。");
  }
  async function call(path: string, method = "GET", payload?: unknown) {
    if (!base)
      throw new Error("未连接评测执行器，请先按项目说明启动独立服务。");
    const response = await fetcher(new URL(path, base), {
      method,
      redirect: "error",
      signal: AbortSignal.timeout(15000),
      headers: {
        "content-type": "application/json",
        ...(key ? { authorization: `Bearer ${key}` } : {}),
      },
      ...(payload ? { body: JSON.stringify(payload) } : {}),
    });
    if (!response.ok)
      throw new Error(
        `评测服务返回 ${response.status}，请检查服务状态和配置。`,
      );
    if (!response.body) throw new Error("评测服务没有返回内容。");
    const reader = response.body.getReader();
    const parts: Uint8Array[] = [];
    let total = 0;
    try {
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        total += value.length;
        if (total > 700000) throw new Error("评测结果超过容量，请拆分测试集。");
        parts.push(value);
      }
    } finally {
      await reader.cancel().catch(() => {});
    }
    let result: unknown;
    try {
      result = JSON.parse(Buffer.concat(parts).toString());
    } catch {
      throw new Error("评测服务响应无效。");
    }
    return result;
  }
  function read(id: string) {
    const row = db
      .prepare(
        "SELECT id,state,report,error,created_at AS createdAt,updated_at AS updatedAt FROM evaluation_jobs WHERE id=?",
      )
      .get(jobId(id));
    if (!row)
      throw Object.assign(new Error("评测任务尚未提交。"), { status: 404 });
    return {
      id: String(row.id),
      state: String(row.state),
      report: typeof row.report === "string" ? row.report : null,
      error: String(row.error),
      createdAt: String(row.createdAt),
      updatedAt: String(row.updatedAt),
    };
  }
  function accept(id: string, value: unknown) {
    if (
      !isRecord(value) ||
      value.id !== id ||
      !["queued", "running", "completed", "failed", "interrupted"].includes(
        String(value.state),
      )
    )
      throw new Error("执行器返回了无效的任务状态。");
    const current = read(id);
    if (["completed", "failed", "interrupted"].includes(current.state))
      return current;
    const state = String(value.state);
    if (current.state === "running" && state === "queued") return current;
    let report: null | string = null;
    if (state === "completed") {
      report = JSON.stringify(value.report);
      parseEvaluation(report);
    }
    const error =
      state === "failed" || state === "interrupted"
        ? "执行未完成，请检查执行器记录，保留现有输入后重新创建任务。"
        : "";
    db.prepare(
      "UPDATE evaluation_jobs SET state=?,report=?,error=?,updated_at=? WHERE id=?",
    ).run(state, report, error, new Date().toISOString(), id);
    return read(id);
  }
  return {
    read,
    async health() {
      if (!base)
        return {
          connected: false,
          modelConfigured: false,
          message: "执行器未配置；可以导入报告并继续复核。",
        };
      try {
        const r = await call("/health");
        if (
          !isRecord(r) ||
          r.service !== "floatboat-promptfoo-runner" ||
          r.version !== "0.125.1"
        )
          throw new Error("执行器协议或版本不匹配。");
        return {
          connected: true,
          modelConfigured: r.modelConfigured === true,
          message: "Promptfoo 0.125.1 执行器已连接",
        };
      } catch {
        return {
          connected: false,
          modelConfigured: false,
          message: "执行器暂不可达，请检查服务。已有报告仍可编辑。",
        };
      }
    },
    async start(id: string, input: unknown) {
      jobId(id);
      const suite = validateSuite(input),
        payload = JSON.stringify(suite),
        digest = createHash("sha256").update(payload).digest("hex");
      const existing = db
        .prepare("SELECT digest FROM evaluation_jobs WHERE id=?")
        .get(id);
      if (existing) {
        if (existing.digest !== digest)
          throw new Error("同一任务标识不能用于不同输入。");
        const prior = read(id);
        if (prior.state === "uncertain") {
          try {
            return accept(id, await call("/jobs", "POST", { id, suite }));
          } catch {
            return read(id);
          }
        }
        return prior;
      }
      if (!base)
        throw new Error("未连接评测执行器，请先按项目说明启动独立服务。");
      const now = new Date().toISOString();
      db.prepare(
        "INSERT INTO evaluation_jobs(id,digest,payload,state,created_at,updated_at) VALUES(?,?,?,'submitting',?,?)",
      ).run(id, digest, payload, now, now);
      try {
        return accept(id, await call("/jobs", "POST", { id, suite }));
      } catch {
        db.prepare(
          "UPDATE evaluation_jobs SET state='uncertain',error=?,updated_at=? WHERE id=? AND state='submitting'",
        ).run(
          "提交回执未确认；请查询此任务，不要重复启动。",
          new Date().toISOString(),
          id,
        );
        return read(id);
      }
    },
    async poll(id: string) {
      const current = read(id);
      if (["completed", "failed", "interrupted"].includes(current.state))
        return current;
      try {
        return accept(id, await call(`/jobs/${jobId(id)}`));
      } catch {
        return {
          ...read(id),
          error: ["completed", "failed", "interrupted"].includes(read(id).state)
            ? read(id).error
            : "暂时无法查询此任务；输入与任务编号已保留。",
        };
      }
    },
  };
}
