import type { DatabaseSync } from "node:sqlite";
import {
  jobId,
  jobInfo,
  jobInput,
  remoteResult,
  terminal,
  type Job,
  type JobInput,
} from "../contracts/job.ts";
import { StoreError } from "./store.ts";
import { isRecord } from "../contracts/project.ts";
import { validateSegments } from "../contracts/subtitles.ts";
import { wireOptions } from "../contracts/options.ts";

/** Key-sorted JSON so option echoes compare independent of the service's dict order. */
export function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (isRecord(value))
    return `{${Object.keys(value)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${canonical(value[k])}`)
      .join(",")}}`;
  return JSON.stringify(value ?? null);
}
export const SERVICE_PROTOCOL = 2;
export type ServiceReason = "ok" | "unreachable" | "auth" | "incompatible" | "outdated";
export interface ServiceHealth {
  connected: boolean;
  reason: ServiceReason;
  model: string;
  multilingual: boolean;
  url: string;
  message: string;
}

export function configuredService(
  raw = process.env.FASTER_WHISPER_URL ?? "http://127.0.0.1:8768",
) {
  const base = new URL(raw);
  if (
    !["http:", "https:"].includes(base.protocol) ||
    base.username ||
    base.password ||
    base.search ||
    base.hash ||
    base.pathname !== "/"
  )
    throw new Error("转写服务地址必须是无路径和凭据的 HTTP(S) 来源。");
  if (base.protocol === "http:" && !["127.0.0.1", "localhost", "[::1]"].includes(base.hostname))
    throw new Error("远程转写服务必须使用 HTTPS。");
  return base;
}
export function createJobs(
  db: DatabaseSync,
  readAudio: (id: string) => Promise<Uint8Array>,
  fetcher: typeof fetch = fetch,
  base = configuredService(),
  token = process.env.FASTER_WHISPER_TOKEN ?? "",
) {
  async function remote(path: string, init: RequestInit = {}) {
    const response = await fetcher(new URL(path, base), {
      ...init,
      redirect: "error",
      signal: AbortSignal.timeout(15000),
      headers: {
        ...(token ? { authorization: `Bearer ${token}` } : {}),
        ...init.headers,
      },
    });
    const limit = 8_000_000,
      reader = response.body?.getReader();
    let total = 0;
    const chunks: Uint8Array[] = [];
    if (reader) {
      try {
        while (true) {
          const part = await reader.read();
          if (part.done) break;
          total += part.value.length;
          if (total > limit) throw new Error("转写结果超过容量限制。");
          chunks.push(part.value);
        }
      } finally {
        await reader.cancel().catch(() => {});
        reader.releaseLock();
      }
    }
    const value: unknown = JSON.parse(
      Buffer.concat(chunks).toString("utf8") || "{}",
    );
    if (!response.ok)
      throw new StoreError(
        response.status,
        isRecord(value) && typeof value.error === "string"
          ? value.error.slice(0, 500)
          : "转写服务请求失败。",
      );
    return value;
  }
  const get = (id: string): Job => {
    const row = db
      .prepare("SELECT * FROM transcription_jobs WHERE id=?")
      .get(jobId(id));
    if (!row) throw new StoreError(404, "转写任务不存在。");
    return {
      id: String(row.id),
      projectId: String(row.project_id),
      input: jobInput(JSON.parse(String(row.input))),
      status: String(row.status) as Job["status"],
      createdAt: String(row.created_at),
      updatedAt: String(row.updated_at),
      error: String(row.error),
      model: String(row.model),
      segments:
        row.segments === null
          ? null
          : validateSegments(JSON.parse(String(row.segments))),
      info: row.info === null || row.info === undefined ? null : jobInfo(JSON.parse(String(row.info))),
    };
  };
  function storeRemote(id: string, value: unknown) {
    const original = get(id);
    if (
      !isRecord(value) ||
      value.id !== id ||
      value.audioSha256 !== original.input.source.id ||
      value.language !== original.input.language ||
      canonical(value.options) !== canonical(wireOptions(original.input.options))
    )
      throw new Error("转写服务返回了不匹配的任务。");
    if (terminal.includes(original.status)) return original;
    const r = remoteResult(value);
    if (original.status === "running" && r.status === "queued") return original;
    db.prepare(
      "UPDATE transcription_jobs SET status=?,error=?,model=?,segments=?,info=?,updated_at=? WHERE id=?",
    ).run(
      r.status,
      r.error,
      r.model,
      r.segments === null ? null : JSON.stringify(r.segments),
      r.info === null ? null : JSON.stringify(r.info),
      new Date().toISOString(),
      id,
    );
    return get(id);
  }
  function unknown(id: string, error: unknown) {
    const current = get(id);
    if (terminal.includes(current.status)) return current;
    db.prepare(
      "UPDATE transcription_jobs SET status=?,error=?,updated_at=? WHERE id=?",
    ).run(
      "unknown",
      error instanceof Error
        ? "服务暂不可达或响应无效。任务可能已接收，请检查状态后再决定是否重试。"
        : "任务状态未知。",
      new Date().toISOString(),
      id,
    );
    return get(id);
  }
  async function submit(id: string) {
    const job = get(id),
      bytes = await readAudio(job.input.source.id);
    try {
      return storeRemote(
        id,
        await remote(
          `/v1/jobs/${id}?language=${encodeURIComponent(job.input.language)}&options=${encodeURIComponent(JSON.stringify(wireOptions(job.input.options)))}`,
          {
            method: "PUT",
            body: new Uint8Array(bytes),
            headers: {
              "content-type": "application/octet-stream",
              "x-audio-sha256": job.input.source.id,
            },
          },
        ),
      );
    } catch (e) {
      if (
        e instanceof StoreError &&
        [400, 401, 403, 409, 413, 422].includes(e.status)
      ) {
        db.prepare(
          "UPDATE transcription_jobs SET status=?,error=?,updated_at=? WHERE id=? AND status IN ('submitting','unknown')",
        ).run(
          "failed",
          "服务拒绝任务，请检查模型语言、服务授权与音频格式。",
          new Date().toISOString(),
          id,
        );
        return get(id);
      }
      return unknown(id, e);
    }
  }
  return {
    get,
    list: () =>
      db
        .prepare(
          "SELECT id FROM transcription_jobs ORDER BY created_at DESC LIMIT 30",
        )
        .all()
        .map((row) => ({ ...get(String(row.id)), segments: null })),
    async health(): Promise<ServiceHealth> {
      const url = base.origin;
      const off = (reason: ServiceReason, message: string, model = ""): ServiceHealth => ({
        connected: false,
        reason,
        model,
        multilingual: true,
        url,
        message,
      });
      let r: unknown;
      try {
        r = await remote("/health");
      } catch (e) {
        if (e instanceof StoreError && (e.status === 401 || e.status === 403))
          return off("auth", "服务拒绝了访问：两端的 FASTER_WHISPER_TOKEN 需要一致。");
        return off("unreachable", `没有在 ${url} 找到转写服务。可以继续校对与导出；需要新转写时按下方命令启动。`);
      }
      if (!isRecord(r) || r.engine !== "faster-whisper" || typeof r.model !== "string")
        return off("incompatible", `${url} 上运行的不是本工作台的 faster-whisper 服务。`);
      const model = r.model.slice(0, 120);
      if (r.protocol !== SERVICE_PROTOCOL)
        return off(
          "outdated",
          "服务版本过旧，不支持逐词时间戳、VAD 与翻译参数。请用本项目 service/server.py 重启服务。",
          model,
        );
      return {
        connected: true,
        reason: "ok",
        model,
        multilingual: r.multilingual !== false,
        url,
        message: "转写服务已连接",
      };
    },
    async create(id: string, projectId: string, input: JobInput) {
      jobId(id);
      jobId(projectId);
      input = jobInput(input);
      const existing = db
        .prepare("SELECT id FROM transcription_jobs WHERE id=?")
        .get(id);
      if (existing) {
        const old = get(id);
        if (
          old.projectId !== projectId ||
          JSON.stringify(old.input) !== JSON.stringify(input)
        )
          throw new StoreError(409, "相同任务标识不能对应不同输入。");
        return old;
      }
      if (!db.prepare("SELECT id FROM projects WHERE id=?").get(projectId))
        throw new StoreError(400, "请先保存项目后再开始转写。");
      await readAudio(input.source.id);
      const now = new Date().toISOString();
      const inserted = db
        .prepare(
          "INSERT OR IGNORE INTO transcription_jobs(id,project_id,input,status,created_at,updated_at) VALUES(?,?,?,?,?,?)",
        )
        .run(id, projectId, JSON.stringify(input), "submitting", now, now);
      if (!inserted.changes) {
        const winner = get(id);
        if (
          winner.projectId !== projectId ||
          JSON.stringify(winner.input) !== JSON.stringify(input)
        )
          throw new StoreError(409, "相同任务标识不能对应不同输入。");
        return winner;
      }
      return submit(id);
    },
    async reconcile(id: string) {
      const job = get(id);
      if (terminal.includes(job.status)) return job;
      try {
        return storeRemote(id, await remote(`/v1/jobs/${job.id}`));
      } catch (e) {
        return unknown(id, e);
      }
    },
    async retry(id: string) {
      const job = get(id);
      if (job.status !== "unknown" && job.status !== "submitting")
        throw new StoreError(409, "仅状态未知的任务可以使用原标识重试提交。");
      return submit(job.id);
    },
    async cancel(id: string) {
      const job = get(id);
      if (terminal.includes(job.status)) return job;
      try {
        return storeRemote(
          id,
          await remote(`/v1/jobs/${job.id}/cancel`, { method: "POST" }),
        );
      } catch (e) {
        return unknown(id, e);
      }
    },
  };
}
