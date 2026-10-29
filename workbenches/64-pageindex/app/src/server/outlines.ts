// ABOUTME: 可选PageIndex服务：健康检查、章节树生成任务（flash/classic）与章节树保存、导入。
import type { WorkbenchServer } from "../../sdk/runtime.mjs";
import { isRecord, boundedText } from "../contracts/project.ts";
import {
  identifier,
  outlineValue,
  OUTLINE_SOURCES,
  type DocumentIndex,
  type OutlineSource,
  type OutlineTree,
} from "../contracts/reader.ts";
export const SERVICE_DEFAULT = "http://127.0.0.1:8784";
export function serviceUrl(raw = process.env.PAGEINDEX_SERVICE_URL): string {
  const value = new URL(raw || SERVICE_DEFAULT);
  if (
    value.username ||
    value.password ||
    value.search ||
    value.hash ||
    (value.protocol !== "https:" &&
      !(
        value.protocol === "http:" &&
        ["127.0.0.1", "localhost", "[::1]"].includes(value.hostname)
      ))
  )
    throw new Error("PageIndex服务地址需为本机HTTP或远程HTTPS。");
  return value.href.replace(/\/$/, "");
}
async function service(
  path: string,
  input: unknown,
  timeout: number,
): Promise<Response> {
  let response: Response;
  try {
    response = await fetch(serviceUrl() + path, {
      method: input === undefined ? "GET" : "POST",
      redirect: "error",
      headers: { "content-type": "application/json" },
      body: input === undefined ? undefined : JSON.stringify(input),
      signal: AbortSignal.timeout(timeout),
    });
  } catch {
    throw new Error("PageIndex服务未连接或请求超时。");
  }
  if (!response.ok) {
    let reason = "";
    try {
      const body: unknown = await response.json();
      if (isRecord(body) && typeof body.error === "string")
        reason = body.error.slice(0, 300);
    } catch {
      /* Service error bodies are optional. */
    }
    throw new Error(
      `PageIndex服务未完成（状态${response.status}${reason ? "：" + reason : ""}）。`,
    );
  }
  return response;
}
async function bounded(response: Response, max: number): Promise<Uint8Array> {
  if (!response.body) throw new Error("服务未返回内容。");
  const reader = response.body.getReader(),
    parts: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > max) throw new Error("服务响应超过容量。");
      parts.push(value);
    }
  } catch (e) {
    await reader.cancel().catch(() => {});
    throw e;
  }
  return Buffer.concat(parts);
}
export type OutlineJob = {
  documentId: string;
  mode: OutlineSource;
  status: "running" | "completed" | "failed";
  error: string;
  startedAt: string;
};
export type ServiceStatus = {
  available: boolean;
  url: string;
  version: string;
  modes: OutlineSource[];
  model: string;
  message: string;
};
export function createOutlines(
  app: WorkbenchServer,
  get: (id: string) => DocumentIndex,
  read: (id: string) => Promise<Buffer>,
) {
  const db = app.database,
    jobs = new Map<string, OutlineJob>();
  function saveOutline(id: string, tree: OutlineTree) {
    db.prepare(
      "INSERT INTO reader_outlines(document_id,source,payload,created_at) VALUES(?,?,?,?) ON CONFLICT(document_id,source) DO UPDATE SET payload=excluded.payload,created_at=excluded.created_at",
    ).run(id, tree.source, JSON.stringify(tree), tree.at);
  }
  async function health(): Promise<ServiceStatus> {
    let url = SERVICE_DEFAULT;
    try {
      url = serviceUrl();
      const r: unknown = JSON.parse(
        new TextDecoder().decode(
          await bounded(await service("/health", undefined, 3000), 10000),
        ),
      );
      if (!isRecord(r) || r.service !== "floatboat-pageindex")
        throw new Error("该地址不是PageIndex工作台服务。");
      const modes = (Array.isArray(r.modes) ? r.modes : ["flash"])
        .map((m) => `pageindex-${String(m)}`)
        .filter((m): m is OutlineSource =>
          OUTLINE_SOURCES.includes(m as OutlineSource),
        );
      return {
        available: true,
        url,
        version: typeof r.version === "string" ? r.version.slice(0, 40) : "",
        modes,
        model: typeof r.model === "string" ? r.model.slice(0, 120) : "",
        message: `PageIndex ${String(r.version ?? "")} 已连接`,
      };
    } catch (e) {
      return {
        available: false,
        url,
        version: "",
        modes: [],
        model: "",
        message: e instanceof Error ? e.message : "PageIndex服务未连接。",
      };
    }
  }
  async function runOutline(job: OutlineJob) {
    try {
      const doc = get(job.documentId);
      const mode = job.mode === "pageindex-classic" ? "classic" : "flash";
      const raw: unknown = JSON.parse(
        new TextDecoder().decode(
          await bounded(
            await service(
              "/index",
              { pdf: (await read(doc.source.id)).toString("base64"), mode },
              mode === "classic" ? 30 * 60_000 : 5 * 60_000,
            ),
            8_000_000,
          ),
        ),
      );
      if (
        !isRecord(raw) ||
        raw.engine !== "pageindex" ||
        raw.sha256 !== doc.source.id ||
        raw.pages !== doc.source.pages ||
        !isRecord(raw.index)
      )
        throw new Error("PageIndex结果与当前文档不一致。");
      const tree = outlineValue(
        {
          source: job.mode,
          engine: `pageindex ${boundedText(raw.version, 40)} ${mode}`,
          description:
            typeof raw.index.doc_description === "string"
              ? raw.index.doc_description
              : "",
          structure: withIds(raw.index.structure),
          at: new Date().toISOString(),
        },
        doc.source.pages,
      );
      saveOutline(doc.source.id, tree);
      job.status = "completed";
    } catch (e) {
      job.status = "failed";
      job.error = e instanceof Error ? e.message : "PageIndex章节树未完成。";
    }
  }
  return {
    health,
    startOutline(id: string, mode: unknown): OutlineJob {
      const doc = get(id);
      if (!OUTLINE_SOURCES.includes(mode as OutlineSource))
        throw new Error("章节树模式无效。");
      const running = jobs.get(doc.source.id);
      if (running?.status === "running") return running;
      const job: OutlineJob = {
        documentId: doc.source.id,
        mode: mode as OutlineSource,
        status: "running",
        error: "",
        startedAt: new Date().toISOString(),
      };
      jobs.set(doc.source.id, job);
      void app.trackTask(() => runOutline(job), "pageindex.outline").catch(() => {});
      return job;
    },
    outlineJob(id: string): OutlineJob | null {
      return jobs.get(identifier(id)) ?? null;
    },
    /** Restores a previously built PageIndex tree from a portable project. */
    importOutline(id: string, raw: unknown) {
      const doc = get(id);
      const tree = outlineValue(raw, doc.source.pages);
      saveOutline(doc.source.id, tree);
      return get(id);
    },
  };
}
/** PageIndex trees may omit or repeat node IDs; when they do, assign stable IDs in reading order. */
export function withIds(raw: unknown): unknown {
  const ids: unknown[] = [];
  const collect = (value: unknown) => {
    if (Array.isArray(value))
      for (const item of value)
        if (isRecord(item)) {
          ids.push(item.node_id);
          collect(item.nodes);
        }
  };
  collect(raw);
  const keep =
    ids.every((id) => typeof id === "string" && id.length > 0) &&
    new Set(ids).size === ids.length;
  let n = 0;
  const walk = (value: unknown): unknown =>
    Array.isArray(value)
      ? value.map((item) => {
          if (!isRecord(item)) return item;
          n++;
          const copy: Record<string, unknown> = { ...item };
          delete copy.text;
          delete copy.nodes;
          if (!keep) copy.node_id = String(n).padStart(4, "0");
          return Array.isArray(item.nodes) && item.nodes.length
            ? { ...copy, nodes: walk(item.nodes) }
            : copy;
        })
      : value;
  return walk(raw);
}
