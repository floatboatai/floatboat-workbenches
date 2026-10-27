import type { DatabaseSync } from "node:sqlite";
import { isRecord } from "../contracts/project.ts";
import {
  runInput,
  importedDocuments,
  type Job,
  type JobStatus,
  type RunInput,
} from "../contracts/evidence.ts";
import { StoreError } from "./store.ts";
export const jobId = (v: unknown): string => {
  if (
    typeof v !== "string" ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      v,
    )
  )
    throw new StoreError(400, "任务标识无效。");
  return v;
};
export function jobStore(db: DatabaseSync) {
  const get = (id: string): Job => {
    const row = db
      .prepare("SELECT * FROM langextract_jobs WHERE id=?")
      .get(jobId(id));
    if (!row) throw new StoreError(404, "任务尚未提交或不存在。");
    return {
      id: String(row.id),
      projectId: String(row.project_id),
      input: runInput(JSON.parse(String(row.input_json))),
      status: String(row.status) as JobStatus,
      result:
        row.result_json === null ? null : JSON.parse(String(row.result_json)),
      message: String(row.message),
      createdAt: String(row.created_at),
      updatedAt: String(row.updated_at),
    };
  };
  return {
    get,
    list: () =>
      db
        .prepare(
          "SELECT id FROM langextract_jobs ORDER BY created_at DESC LIMIT 30",
        )
        .all()
        .map((row) => get(String(row.id))),
    create(id: string, projectId: string, input: RunInput) {
      jobId(id);
      if (!/^[A-Za-z0-9_-]{1,120}$/.test(projectId))
        throw new StoreError(400, "请先保存项目。");
      const serialized = JSON.stringify(runInput(input));
      const old = db
        .prepare(
          "SELECT id,input_json,project_id FROM langextract_jobs WHERE id=?",
        )
        .get(id);
      if (old) {
        if (old.input_json !== serialized || old.project_id !== projectId)
          throw new StoreError(409, "任务标识已用于另一份输入，请创建新任务。");
        return { job: get(id), created: false };
      }
      const now = new Date().toISOString();
      db.prepare(
        "INSERT INTO langextract_jobs(id,project_id,input_json,status,created_at,updated_at) VALUES(?,?,?,?,?,?)",
      ).run(id, projectId, serialized, "submitting", now, now);
      return { job: get(id), created: true };
    },
    update(
      id: string,
      status: JobStatus,
      message: string,
      result: unknown[] | null = null,
    ) {
      const current = get(id);
      if (
        ["succeeded", "failed", "cancelled", "interrupted"].includes(
          current.status,
        )
      )
        return current;
      if (current.status === "running" && status === "queued") return current;
      const canonical =
        result === null
          ? null
          : importedDocuments(result, "service").documents.map((d) => ({
              document_id: d.id,
              text: d.originalText,
              extractions: d.extractions,
            }));
      if (
        canonical &&
        (canonical.length !== current.input.documents.length ||
          canonical.some(
            (d) =>
              !current.input.documents.some(
                (source) =>
                  source.id === d.document_id && source.text === d.text,
              ),
          ))
      )
        throw new StoreError(502, "服务结果与提交的原文快照不一致。");
      db.prepare(
        "UPDATE langextract_jobs SET status=?,message=?,result_json=?,updated_at=? WHERE id=?",
      ).run(
        status,
        message,
        canonical === null ? null : JSON.stringify(canonical),
        new Date().toISOString(),
        id,
      );
      return get(id);
    },
  };
}
export interface ServiceConfig {
  base: URL;
  token: string;
}
export function serviceConfig(
  env: Record<string, string | undefined> = process.env,
): ServiceConfig | null {
  const raw = env.LANGEXTRACT_SERVICE_URL,
    token = env.LANGEXTRACT_SERVICE_TOKEN;
  if (!raw && !token) return null;
  if (!raw || !token || token.length < 16)
    throw Error("服务配置不完整：需要服务地址和至少16字符的连接密钥。");
  const base = new URL(raw);
  if (
    !["http:", "https:"].includes(base.protocol) ||
    base.username ||
    base.password ||
    base.search ||
    base.hash
  )
    throw Error("服务地址格式无效。");
  if (
    base.protocol === "http:" &&
    !["127.0.0.1", "localhost", "[::1]"].includes(base.hostname)
  )
    throw Error("远程服务必须使用 HTTPS。");
  base.pathname = base.pathname.replace(/\/$/, "") + "/";
  return { base, token };
}
export async function callService(
  config: ServiceConfig,
  path: string,
  method = "GET",
  body?: unknown,
): Promise<unknown> {
  const response = await fetch(new URL(path, config.base), {
    method,
    redirect: "error",
    headers: {
      authorization: `Bearer ${config.token}`,
      "content-type": "application/json",
    },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(12000),
  });
  if (!response.ok)
    throw new StoreError(
      response.status === 404 ? 404 : 503,
      response.status === 401
        ? "服务认证失败，请检查服务端连接配置。"
        : response.status === 404
          ? "服务中没有此任务，请保留原标识核对。"
          : "抽取服务暂不可用，请稍后查询原任务。",
    );
  if (!response.body) throw Error("服务响应为空。");
  const reader = response.body.getReader(),
    chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 850000) throw Error("抽取结果过大，请拆分资料后重试。");
      chunks.push(value);
    }
  } finally {
    await reader.cancel().catch(() => {});
  }
  const data = new Uint8Array(size);
  let offset = 0;
  for (const c of chunks) {
    data.set(c, offset);
    offset += c.length;
  }
  return JSON.parse(new TextDecoder().decode(data));
}
export function serviceResult(value: unknown, expectedId: string): {
  status: JobStatus;
  message: string;
  result: unknown[] | null;
} {
  if (
    !isRecord(value) ||
    value.id !== expectedId ||
    ![
      "queued",
      "running",
      "succeeded",
      "failed",
      "interrupted",
      "cancelled",
    ].includes(String(value.status))
  )
    throw Error("服务任务响应格式无效。");
  const status = value.status as JobStatus;
  const message =
    typeof value.message === "string" ? value.message.slice(0, 2000) : "";
  if (status === "succeeded" && !Array.isArray(value.result))
    throw Error("已完成任务缺少结果。");
  return {
    status,
    message,
    result: status === "succeeded" ? (value.result as unknown[]) : null,
  };
}
