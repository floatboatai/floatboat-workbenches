// ABOUTME: 官方 Docling Serve 异步客户端：任意受支持格式的原文件 multipart 提交、持久任务 ID、轮询、结果入库；不确定提交绝不自动重交。
import type { DatabaseSync } from "node:sqlite";
import type { WorkbenchServer } from "../../sdk/runtime.mjs";
import { boundedText, isRecord } from "../contracts/project.ts";
import { parseDocument } from "../contracts/docling.ts";
import { sha } from "../contracts/review.ts";
import {
  extension,
  formFields,
  jobValue,
  serveOptions,
  SERVE_FORMATS,
  type Job,
  type JobState,
} from "../contracts/jobs.ts";
import { digest, type Blobs } from "./blobs.ts";
const safeId = /^[a-zA-Z0-9-]{8,80}$/;
export const DEFAULT_SERVE_URL = "http://127.0.0.1:5001";
export const RESULT_LIMIT = 64 * 1024 * 1024;
export interface ServeConfig {
  base: string;
  key: string;
  /** True when no DOCLING_SERVE_URL is set and the standard local address is probed. */
  defaulted: boolean;
}
export function configuration(env: NodeJS.ProcessEnv = process.env): ServeConfig | null {
  const raw = env.DOCLING_SERVE_URL?.trim();
  if (raw === "off" || raw === "none") return null;
  if (!raw) return { base: DEFAULT_SERVE_URL, key: env.DOCLING_SERVE_API_KEY ?? "", defaulted: true };
  const url = new URL(raw);
  if (
    !["http:", "https:"].includes(url.protocol) ||
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    url.pathname !== "/"
  )
    throw new Error("DOCLING_SERVE_URL 需要无路径、无凭据的 HTTP(S) 服务地址。");
  return { base: url.origin, key: env.DOCLING_SERVE_API_KEY ?? "", defaulted: false };
}
export function statusValue(v: unknown): { id: string; state: JobState } {
  if (
    !isRecord(v) ||
    typeof v.task_id !== "string" ||
    !safeId.test(v.task_id) ||
    typeof v.task_status !== "string"
  )
    throw new Error("服务返回的任务格式无效。");
  const mapping: Record<string, JobState> = {
    pending: "pending",
    started: "running",
    running: "running",
    success: "running",
    partial_success: "running",
    failure: "failure",
    skipped: "failure",
  };
  const state = mapping[v.task_status];
  if (!state) throw new Error("服务返回未知任务状态。");
  return { id: v.task_id, state };
}
async function boundedBytes(response: Response, limit: number): Promise<Buffer> {
  if (!response.body) throw new Error("服务返回空响应。");
  const reader = response.body.getReader();
  let size = 0;
  const chunks: Uint8Array[] = [];
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > limit) {
      await reader.cancel();
      throw new Error(`转换结果超过 ${Math.round(limit / 1048576)} MB；请缩小页码范围或拆分文档。`);
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks);
}
async function boundedJson(response: Response, limit = 1_000_000): Promise<unknown> {
  const bytes = await boundedBytes(response, limit);
  try {
    return JSON.parse(bytes.toString("utf8")) as unknown;
  } catch {
    throw new Error("服务返回的内容不是有效 JSON。");
  }
}
const SELECT =
  "SELECT id,filename,input_hash AS inputHash,task_id AS taskId,state,message,created_at AS createdAt,updated_at AS updatedAt,source_id AS sourceId,options,result_id AS resultId FROM docling_operations";
export function createJobs(
  db: DatabaseSync,
  blobs: Blobs,
  config: ServeConfig | null,
  transport: typeof fetch = fetch,
) {
  const serviceHash = config ? digest(config.base) : "";
  db.prepare(
    "UPDATE docling_operations SET state='uncertain',message='连接中断，提交结果不确定。请核对上游任务，不会自动重交。' WHERE state='submitting'",
  ).run();
  db.prepare(
    "UPDATE docling_operations SET state='failure',message='写入输入时中断；尚未提交到服务。' WHERE state='preparing'",
  ).run();
  const get = (id: string): Job => {
    const row = db.prepare(SELECT + " WHERE id=?").get(id);
    if (!row) throw new Error("转换记录不存在。");
    return jobValue(row);
  };
  const update = (id: string, state: JobState, message: string, taskId?: string, resultId?: string) => {
    db.prepare(
      "UPDATE docling_operations SET state=?,message=?,task_id=COALESCE(?,task_id),result_id=COALESCE(?,result_id),updated_at=? WHERE id=?",
    ).run(state, message, taskId ?? null, resultId ?? null, new Date().toISOString(), id);
    return get(id);
  };
  const ensure = (id: string) => {
    if (!config) throw new Error("已关闭 Docling Serve 连接（DOCLING_SERVE_URL=off）。");
    const row = db.prepare("SELECT service_hash FROM docling_operations WHERE id=?").get(id);
    if (row && row.service_hash !== serviceHash)
      throw new Error("此任务属于另一个服务地址，请恢复原服务配置后继续。");
  };
  const fetchApi = async (route: string, init: RequestInit = {}, timeout = 20000) => {
    if (!config) throw new Error("Docling Serve 未配置。");
    return transport(config.base + route, {
      ...init,
      headers: { ...(config.key ? { "X-Api-Key": config.key } : {}), ...init.headers },
      redirect: "error",
      signal: AbortSignal.timeout(timeout),
    });
  };
  const polling = new Map<string, Promise<Job>>();
  const poll = async (id: string): Promise<Job> => {
    ensure(id);
    const job = get(id);
    if (!job.taskId || ["success", "failure", "paused"].includes(job.state)) return job;
    const finish = (state: JobState, message: string, resultId?: string) =>
      get(id).state === "paused" ? get(id) : update(id, state, message, undefined, resultId);
    try {
      const response = await fetchApi("/v1/status/poll/" + encodeURIComponent(job.taskId));
      if (!response.ok) throw new Error("无法查询任务（HTTP " + response.status + "），请重试刷新。");
      const raw = await boundedJson(response),
        status = statusValue(raw);
      if (status.id !== job.taskId) throw new Error("服务任务 ID 不匹配。");
      if (isRecord(raw) && ["success", "partial_success"].includes(String(raw.task_status))) {
        const result = await fetchApi("/v1/result/" + encodeURIComponent(job.taskId), {}, 120000);
        if (!result.ok) throw new Error("结果尚不可读取，请稍后刷新。");
        const payload = await boundedJson(result, RESULT_LIMIT);
        if (!isRecord(payload) || !isRecord(payload.document) || !isRecord(payload.document.json_content))
          throw new Error("需要 inline Docling JSON 结果；当前服务输出类型不受支持。");
        const doc = parseDocument(payload.document.json_content);
        const stored = await blobs.put("docling", doc.name || job.filename, new TextEncoder().encode(JSON.stringify(doc)));
        const errors = Array.isArray(payload.errors) ? payload.errors.length : 0;
        return finish(
          "success",
          raw.task_status === "partial_success" || errors
            ? `转换部分完成（${errors} 个错误），请逐项核对。结果可作为新文档打开。`
            : "转换完成，可作为新文档打开。",
          stored.id,
        );
      }
      return finish(
        status.state,
        status.state === "failure"
          ? "上游转换失败。请检查服务日志，再以新操作提交。"
          : status.state === "pending"
            ? "等待 Docling 转换…"
            : "Docling 正在转换…",
      );
    } catch (error) {
      return finish(
        "paused",
        "跟踪已暂停：" + (error instanceof Error ? error.message : "无法读取状态。") + " 可恢复跟踪重试。",
      );
    }
  };
  return {
    list: () => db.prepare(SELECT + " ORDER BY created_at DESC LIMIT 50").all().map(jobValue),
    get,
    async health() {
      if (!config)
        return { configured: false, reachable: false, defaulted: false, base: "", version: "", message: "已关闭 Docling Serve 连接；本地解析可用。" };
      const base = { configured: true, defaulted: config.defaulted, base: config.base };
      try {
        const r = await fetchApi("/health", {}, 3000);
        if (!r.ok)
          return { ...base, reachable: false, version: "", message: `服务健康检查失败（HTTP ${r.status}）。` };
        let version = "";
        try {
          const v = await fetchApi("/version", {}, 3000);
          if (v.ok) {
            const info = await boundedJson(v, 100000);
            if (isRecord(info) && typeof info["docling-serve"] === "string") version = info["docling-serve"];
          }
        } catch {
          version = "";
        }
        return { ...base, reachable: true, version, message: `Docling Serve 已连接${version ? " · " + version : ""}` };
      } catch {
        return {
          ...base,
          reachable: false,
          version: "",
          message: config.defaulted
            ? `本机 ${config.base} 未运行 Docling Serve。`
            : `无法连接 ${config.base}，请确认服务已启动。`,
        };
      }
    },
    async submit(value: unknown) {
      if (!isRecord(value) || typeof value.id !== "string" || !safeId.test(value.id))
        throw new Error("操作 ID 无效。");
      if (!sha(value.sourceId)) throw new Error("请先上传原文件。");
      ensure(value.id);
      const id = value.id,
        sourceId = value.sourceId,
        filename = boundedText(value.filename, 200).trim() || "document";
      if (!SERVE_FORMATS[extension(filename)])
        throw new Error("Docling Serve 不支持此扩展名。支持 PDF、Word、PowerPoint、Excel、HTML、Markdown、CSV、图片等。");
      const options = serveOptions(value.options);
      const exists = db.prepare("SELECT id,input_hash FROM docling_operations WHERE id=?").get(id);
      if (exists) {
        if (exists.input_hash !== sourceId) throw new Error("操作 ID 已用于不同输入。");
        return get(id);
      }
      const now = new Date().toISOString();
      db.prepare(
        "INSERT INTO docling_operations(id,filename,input_hash,service_hash,state,message,created_at,updated_at,source_id,options) VALUES(?,?,?,?,?,?,?,?,?,?)",
      ).run(id, filename, sourceId, serviceHash, "preparing", "正在读取原文件…", now, now, sourceId, JSON.stringify(options));
      let bytes: Buffer;
      try {
        bytes = await blobs.read(sourceId, "source");
      } catch {
        return update(id, "failure", "原文件不在当前工作台，尚未提交到服务。");
      }
      update(id, "submitting", "正在提交，关闭页面不会重交。");
      try {
        const form = new FormData();
        form.append("files", new Blob([new Uint8Array(bytes)]), filename);
        for (const [k, v] of formFields(options)) form.append(k, v);
        const response = await fetchApi("/v1/convert/file/async", { method: "POST", body: form }, 120000);
        if (!response.ok)
          return update(
            id,
            response.status >= 400 && response.status < 500 ? "failure" : "uncertain",
            "提交返回 HTTP " + response.status + "。请检查服务记录；不会自动重交。",
          );
        const status = statusValue(await boundedJson(response));
        return update(id, status.state, "已提交，正在跟踪转换状态。", status.id);
      } catch {
        return update(id, "uncertain", "提交结果不确定。请从服务日志查找任务 ID 后关联；不会自动重交。");
      }
    },
    refresh(id: string) {
      const existing = polling.get(id);
      if (existing) return existing;
      const promise = poll(id).finally(() => polling.delete(id));
      polling.set(id, promise);
      return promise;
    },
    async attach(id: string, taskId: unknown) {
      ensure(id);
      const job = get(id);
      if (job.state !== "uncertain" || typeof taskId !== "string" || !safeId.test(taskId))
        throw new Error("只能为不确定的提交关联有效任务 ID。");
      const response = await fetchApi("/v1/status/poll/" + encodeURIComponent(taskId));
      if (!response.ok) throw new Error("上游没有找到此任务，请核对任务 ID。");
      const task = statusValue(await boundedJson(response));
      if (task.id !== taskId) throw new Error("任务 ID 不匹配。");
      return update(id, task.state, "已关联上游任务，请刷新。", task.id);
    },
    pause(id: string) {
      const job = get(id);
      if (!["pending", "running"].includes(job.state)) throw new Error("此任务不能暂停本地跟踪。");
      return update(id, "paused", "已暂停本地跟踪，上游转换仍会继续。");
    },
    resume(id: string) {
      const job = get(id);
      if (job.state !== "paused") throw new Error("任务尚未暂停。");
      return update(id, "running", "已恢复跟踪，正在刷新状态。");
    },
    result(id: string) {
      const job = get(id);
      if (job.state !== "success" || !job.resultId) throw new Error("转换结果尚未就绪。");
      return {
        documentId: job.resultId,
        documentBytes: blobs.row(job.resultId)?.bytes ?? 0,
        sourceId: job.sourceId,
        sourceBytes: job.sourceId ? (blobs.row(job.sourceId)?.bytes ?? 0) : 0,
        filename: job.filename,
        taskId: job.taskId,
      };
    },
  };
}
export function registerDocling(app: WorkbenchServer, blobs: Blobs) {
  let config: ServeConfig | null = null;
  let configError = "";
  try {
    config = configuration();
  } catch (error) {
    configError = error instanceof Error ? error.message : "转换服务配置无效。";
  }
  const jobs = createJobs(app.database, blobs, config, fetch);
  const failure = (e: unknown) =>
    Response.json({ error: { message: e instanceof Error ? e.message : "转换操作失败。" } }, { status: 400 });
  type Handler = Parameters<WorkbenchServer["route"]>[2];
  const wrap =
    (fn: Handler): Handler =>
    async (context) => {
      try {
        return await fn(context);
      } catch (e) {
        return failure(e);
      }
    };
  app.route("GET", "/api/docling", () =>
    configError
      ? { configured: false, reachable: false, defaulted: false, base: "", version: "", message: configError }
      : jobs.health(),
  );
  app.route("GET", "/api/docling/jobs", () => jobs.list());
  app.route("POST", "/api/docling/jobs", wrap(({ body }) => jobs.submit(body)));
  app.route("POST", "/api/docling/jobs/:id/refresh", wrap(({ params }) => jobs.refresh(params.id)));
  app.route("POST", "/api/docling/jobs/:id/attach", wrap(({ params, body }) => jobs.attach(params.id, isRecord(body) ? body.taskId : undefined)));
  app.route("POST", "/api/docling/jobs/:id/pause", wrap(({ params }) => jobs.pause(params.id)));
  app.route("POST", "/api/docling/jobs/:id/resume", wrap(({ params }) => jobs.resume(params.id)));
  app.route("GET", "/api/docling/jobs/:id/result", wrap(({ params }) => jobs.result(params.id)));
}
