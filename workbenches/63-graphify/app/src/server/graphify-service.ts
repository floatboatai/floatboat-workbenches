// ABOUTME: 可选的 Graphify Python 服务（tree-sitter AST）；只连本机或 HTTPS，失败时给出启动方式。

import { isRecord } from "../contracts/project.ts";

export const START_COMMANDS = [
  "cd workbenches/63-graphify",
  "uv venv .local/python --python 3.12",
  "uv pip install --python .local/python/bin/python -r service/requirements.lock.txt",
  ".local/python/bin/python service/server.py --port 8781",
];
export type ServiceStatus = { available: boolean; engine: string; message: string; url: string; start: string[] };

export function serviceUrl(env = process.env) {
  const u = new URL(env.GRAPHIFY_SERVICE_URL ?? "http://127.0.0.1:8781");
  if (
    u.username || u.password || u.search || u.hash ||
    (u.protocol !== "https:" && !(u.protocol === "http:" && ["127.0.0.1", "localhost", "[::1]"].includes(u.hostname)))
  )
    throw new Error("GRAPHIFY_SERVICE_URL 只能是本机 http 或 https 地址");
  return u;
}

async function call(path: string, body: unknown, timeoutMs: number, fetcher: typeof fetch) {
  const response = await fetcher(new URL(path, serviceUrl()), {
    method: body ? "POST" : "GET",
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(timeoutMs),
    redirect: "error",
  });
  const text = await response.text();
  if (text.length > 24_000_000) throw new Error("Graphify 服务响应超过容量限制");
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new Error("Graphify 服务返回的不是 JSON");
  }
  if (!response.ok) throw new Error(isRecord(raw) && typeof raw.error === "string" ? raw.error : `Graphify 服务返回 ${response.status}`);
  return raw;
}

const reason = (e: unknown) => {
  const cause = isRecord(e) && isRecord(e.cause) ? e.cause : null;
  const code = cause && typeof cause.code === "string" ? cause.code : "";
  if (code === "ECONNREFUSED") return "服务未启动（本机端口无响应）";
  if (e instanceof Error && e.name === "TimeoutError") return "服务响应超时";
  if (e instanceof TypeError || (e instanceof Error && e.message === "fetch failed"))
    return "无法连接服务，请检查服务地址、端口及连接状态后重试";
  return e instanceof Error ? e.message : "无法连接";
};

export async function serviceStatus(fetcher: typeof fetch = fetch): Promise<ServiceStatus> {
  let url = "";
  try {
    url = serviceUrl().href;
    const raw = await call("/health", undefined, 3000, fetcher);
    if (!isRecord(raw) || raw.engine !== "graphifyy" || raw.ready !== true) throw new Error("该地址上的服务不是 Graphify 适配器");
    const multi = raw.multiFile === true;
    return {
      available: multi,
      engine: `graphifyy ${String(raw.version ?? "")}`.trim(),
      message: multi ? "已连接，可用 tree-sitter 抽取代码文件" : "已连接旧版适配器（仅单文件），请用本目录 service/server.py 重新启动",
      url,
      start: START_COMMANDS,
    };
  } catch (e) {
    return { available: false, engine: "Graphify Python 服务", message: `未连接：${reason(e)}。内置抽取不受影响。`, url, start: START_COMMANDS };
  }
}

export const SERVICE_LANGUAGES = new Set(["python", "javascript", "typescript", "go", "rust", "java", "c", "cpp", "csharp", "ruby", "php", "kotlin", "scala", "swift", "lua"]);

/** 把代码文件交给上游 Graphify；返回其原生 node-link 结果。 */
export async function extractWithService(files: { path: string; code: string }[], fetcher: typeof fetch = fetch) {
  let raw: unknown;
  try {
    raw = await call("/extract", { files }, 120_000, fetcher);
  } catch (e) {
    throw new Error(`Graphify 抽取未完成：${reason(e)}。可切换到内置抽取，或检查服务后重试。`);
  }
  if (!isRecord(raw) || !isRecord(raw.graph) || !Array.isArray(raw.graph.nodes) || !Array.isArray(raw.graph.links) || typeof raw.engine !== "string")
    throw new Error("Graphify 服务返回的图谱格式无效");
  return { nodes: raw.graph.nodes as Record<string, unknown>[], links: raw.graph.links as Record<string, unknown>[], engine: raw.engine };
}
