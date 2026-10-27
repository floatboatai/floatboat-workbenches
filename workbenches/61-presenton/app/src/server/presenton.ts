import { taskValue, identifier } from "../contracts/deck.ts";
import { isRecord } from "../contracts/project.ts";
export type Config = { origin: string; key: string };
export function configFrom(
  env: Record<string, string | undefined>,
): Config | null {
  const raw = env.PRESENTON_URL?.trim();
  if (!raw) return null;
  const u = new URL(raw);
  if (
    !["http:", "https:"].includes(u.protocol) ||
    u.username ||
    u.password ||
    u.search ||
    u.hash ||
    u.pathname !== "/"
  )
    throw new Error("PRESENTON_URL 必须是无路径的服务源地址。");
  if (
    u.protocol === "http:" &&
    !["localhost", "127.0.0.1", "[::1]"].includes(u.hostname)
  )
    throw new Error("远程 Presenton 服务必须使用 HTTPS。");
  return { origin: u.origin, key: env.PRESENTON_API_KEY?.trim() || "" };
}
export function artifactUrl(raw: unknown, origin: string): URL {
  if (
    typeof raw !== "string" ||
    raw.length > 2000 ||
    /[\\\u0000-\u001f]/.test(raw) ||
    /%(?:2f|5c|2e|25)/i.test(raw) ||
    raw.split(/[/?#]/).includes("..")
  )
    throw new Error("生成文件路径不安全。");
  const u = new URL(raw, origin);
  if (
    u.origin !== origin ||
    u.username ||
    u.password ||
    u.search ||
    u.hash ||
    !/^\/app_data\/exports\/(?:[A-Za-z0-9_ .%-]+\/)*[A-Za-z0-9_ .%()-]+\.(pptx|pdf)$/i.test(
      u.pathname,
    )
  )
    throw new Error("文件必须位于已配置 Presenton 的 app_data/exports 目录。");
  return u;
}
export async function boundedResponse(
  response: Response,
  max: number,
): Promise<Uint8Array> {
  if (Number(response.headers.get("content-length") || 0) > max)
    throw new Error("服务返回的文件超过容量。");
  if (!response.body) throw new Error("服务返回空响应。");
  const reader = response.body.getReader();
  let size = 0;
  const chunks: Uint8Array[] = [];
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > max) throw new Error("服务返回的文件超过容量。");
      chunks.push(value);
    }
  } catch (e) {
    await reader.cancel().catch(() => {});
    throw e;
  }
  const result = new Uint8Array(size);
  let offset = 0;
  for (const part of chunks) {
    result.set(part, offset);
    offset += part.length;
  }
  return result;
}
export function createPresenton(config: Config, fetcher: typeof fetch = fetch) {
  async function call(
    path: string,
    method = "GET",
    body?: unknown,
    timeout = 30000,
    maxBytes = 750000,
  ) {
    let response: Response;
    try {
      response = await fetcher(config.origin + path, {
        method,
        redirect: "error",
        signal: AbortSignal.timeout(timeout),
        headers: {
          accept: "application/json",
          ...(body === undefined ? {} : { "content-type": "application/json" }),
          ...(config.key ? { authorization: `Bearer ${config.key}` } : {}),
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });
    } catch {
      throw new Error("Presenton 连接中断或超时；请检查服务后查询原任务。");
    }
    if (!response.ok)
      throw new Error(
        `Presenton 返回 HTTP ${response.status}，请检查服务与授权。`,
      );
    let value: unknown;
    try {
      value = JSON.parse(
        new TextDecoder().decode(await boundedResponse(response, maxBytes)),
      );
    } catch {
      throw new Error("Presenton 响应无效或超过容量。");
    }
    return value;
  }
  return {
    origin: config.origin,
    async health() {
      const value = await call(
        "/openapi.json",
        "GET",
        undefined,
        30000,
        3000000,
      );
      if (
        !isRecord(value) ||
        !isRecord(value.paths) ||
        !("/api/v1/ppt/presentation/generate/async" in value.paths)
      )
        throw new Error("此服务未提供所需的 Presenton 异步制作接口。");
      return true;
    },
    async generate(body: unknown) {
      return taskValue(
        await call(
          "/api/v1/ppt/presentation/generate/async",
          "POST",
          body,
          45000,
        ),
      );
    },
    async status(id: string) {
      const value = taskValue(
        await call(`/api/v1/ppt/presentation/status/${identifier(id)}`),
      );
      if (value.id !== id) throw new Error("Presenton 返回了不同的任务 ID。");
      return value;
    },
    presentation(id: string) {
      return call(`/api/v1/ppt/presentation/${identifier(id)}`);
    },
    async export(id: string, format: "pptx" | "pdf") {
      const v = await call(
        `/api/v1/ppt/presentation/${identifier(id)}/export`,
        "POST",
        { export_as: format },
        120000,
      );
      if (
        !isRecord(v) ||
        typeof v.path !== "string" ||
        v.presentation_id !== id
      )
        throw new Error("Presenton 导出响应无效。");
      return v;
    },
    async artifact(path: string) {
      const url = artifactUrl(path, config.origin);
      let res: Response;
      try {
        res = await fetcher(url, {
          redirect: "error",
          signal: AbortSignal.timeout(120000),
          headers: config.key ? { authorization: `Bearer ${config.key}` } : {},
        });
      } catch {
        throw new Error("生成文件下载中断或重定向被拒绝。");
      }
      if (!res.ok) throw new Error(`生成文件暂不可用（HTTP ${res.status}）。`);
      const bytes = await boundedResponse(res, 50 * 1024 * 1024);
      const format = url.pathname.toLowerCase().endsWith(".pdf")
        ? "pdf"
        : "pptx";
      if (
        format === "pdf"
          ? new TextDecoder().decode(bytes.slice(0, 5)) !== "%PDF-"
          : !(
              bytes[0] === 80 &&
              bytes[1] === 75 &&
              bytes[2] === 3 &&
              bytes[3] === 4
            )
      )
        throw new Error("生成文件内容与格式不符。");
      return { bytes, format } as const;
    },
  };
}
export type Presenton = ReturnType<typeof createPresenton>;
