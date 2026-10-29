// ABOUTME: DeerFlow 服务配置（环境变量优先，其次页面保存的地址）、连通检查与只读会话读取。
import type { DatabaseSync } from "node:sqlite";
import { isRecord } from "../contracts/project.ts";
import { nativeValue, threadValue } from "../contracts/native.ts";

let saved: string | null = null;
export const DEFAULT_GATEWAY = "http://localhost:2026";
export const NATIVE_RESPONSE_MAX = 8 * 1048576;

export function validateServiceUrl(value: string) {
  let url: URL;
  try {
    url = new URL(value.trim());
  } catch {
    throw new Error("请输入完整的服务地址，例如 http://localhost:2026。");
  }
  if (url.username || url.password || !["http:", "https:"].includes(url.protocol))
    throw new Error("服务地址只能是不含登录信息的 http(s) 地址。");
  if (!["localhost", "127.0.0.1", "[::1]"].includes(url.hostname) && url.protocol !== "https:")
    throw new Error("远程DeerFlow服务需要HTTPS；本机地址可用HTTP。");
  return new URL(url.origin);
}
export function loadSettings(db: DatabaseSync) {
  const row = db.prepare("SELECT value FROM deerflow_settings WHERE key='url'").get();
  saved = row ? String(row.value) : null;
}
export function saveServiceUrl(db: DatabaseSync, value: string) {
  if (!value.trim()) {
    db.prepare("DELETE FROM deerflow_settings WHERE key='url'").run();
    saved = null;
    return null;
  }
  const url = validateServiceUrl(value);
  db.prepare("INSERT INTO deerflow_settings(key,value,updated_at) VALUES('url',?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated_at=excluded.updated_at").run(url.origin, new Date().toISOString());
  saved = url.origin;
  return url;
}
export function configSource(): "env" | "saved" | "none" {
  return process.env.DEERFLOW_URL ? "env" : saved ? "saved" : "none";
}
export function configuration() {
  const value = process.env.DEERFLOW_URL || saved;
  return value ? validateServiceUrl(value) : null;
}
export function authHeaders(): Record<string, string> {
  return process.env.DEERFLOW_TOKEN ? { authorization: "Bearer " + process.env.DEERFLOW_TOKEN } : {};
}
/** Explain a connection failure in terms of the user's next step. */
export function connectionMessage(e: unknown, base: URL) {
  const cause: Record<string, unknown> = isRecord(e) && e.cause instanceof Error ? (e.cause as unknown as Record<string, unknown>) : {};
  const inner = Array.isArray(cause.errors) && isRecord(cause.errors[0]) ? cause.errors[0] : {};
  const code = String(cause.code ?? inner.code ?? (isRecord(e) ? e.code : "") ?? "");
  if (cause.message === "bad port") return `端口 ${base.port} 属于受限端口，请换用 DeerFlow 的实际端口（默认 2026）。`;
  if (isRecord(e) && (e.name === "TimeoutError" || e.name === "AbortError")) return `连接 ${base.origin} 超时，请确认服务已启动。`;
  if (code === "ECONNREFUSED") return `${base.origin} 没有服务在监听（ECONNREFUSED）。请先启动DeerFlow，或检查端口。`;
  if (code === "ENOTFOUND") return `无法解析 ${base.hostname}（ENOTFOUND），请检查地址。`;
  if (code) return `无法连接 ${base.origin}（${code}）。`;
  const detail = typeof cause.message === "string" && cause.message ? cause.message : isRecord(e) && typeof e.message === "string" && e.message !== "fetch failed" ? e.message : "网络错误";
  return `无法连接 ${base.origin}：${detail.slice(0, 200)}。请确认服务已启动。`;
}
async function readCapped(response: Response, max: number) {
  const reader = response.body?.getReader();
  if (!reader) return "";
  let size = 0;
  const chunks: Uint8Array[] = [];
  while (true) {
    const x = await reader.read();
    if (x.done) break;
    size += x.value.length;
    if (size > max) {
      await reader.cancel();
      throw new Error(`上游响应超过${Math.round(max / 1048576)}MB。`);
    }
    chunks.push(x.value);
  }
  return Buffer.concat(chunks).toString();
}
/** Read-only reachability check: GET /api/models lists the deployment's model whitelist. */
export async function checkService(base = configuration()) {
  if (!base) return { configured: false, reachable: false, models: [] as string[], message: "尚未设置DeerFlow服务地址。" };
  let response: Response;
  try {
    response = await fetch(new URL("/api/models", base), { redirect: "error", signal: AbortSignal.timeout(8000), headers: { accept: "application/json", ...authHeaders() } });
  } catch (e) {
    return { configured: true, reachable: false, models: [], message: connectionMessage(e, base) };
  }
  if (response.status === 401 || response.status === 403)
    return { configured: true, reachable: false, models: [], message: `服务已响应但拒绝授权（HTTP ${response.status}）。请在工作台服务端设置 DEERFLOW_TOKEN。` };
  if (!response.ok) return { configured: true, reachable: false, models: [], message: `服务返回 HTTP ${response.status}，这可能不是DeerFlow Gateway。` };
  let value: unknown;
  try {
    value = JSON.parse(await readCapped(response, 1048576));
  } catch {
    return { configured: true, reachable: false, models: [], message: "服务没有返回DeerFlow模型列表，请确认地址指向DeerFlow。" };
  }
  const models = isRecord(value) && Array.isArray(value.models)
    ? value.models.flatMap((m) => (isRecord(m) && typeof m.name === "string" ? [m.name.slice(0, 150)] : [])).slice(0, 100)
    : [];
  return {
    configured: true,
    reachable: true,
    models,
    message: models.length ? `已连接，部署提供 ${models.length} 个模型。` : "已连接，但部署没有配置可用模型；请在DeerFlow的 config.yaml 中添加模型。",
  };
}
export async function fetchNative(threadId: string, base = configuration()) {
  threadValue(threadId);
  if (!base) throw new Error("未配置DeerFlow服务，可先导入原生会话文件。");
  let response: Response;
  try {
    response = await fetch(new URL("/api/threads/" + encodeURIComponent(threadId) + "/state", base), {
      redirect: "error",
      signal: AbortSignal.timeout(20000),
      headers: { accept: "application/json", ...authHeaders() },
    });
  } catch (e) {
    throw new Error(connectionMessage(e, base));
  }
  if (!response.ok) throw new Error(`DeerFlow读取失败（HTTP ${response.status}），请检查会话和服务授权。`);
  const text = await readCapped(response, NATIVE_RESPONSE_MAX);
  if (!text) throw new Error("会话响应为空。");
  nativeValue(text);
  return text;
}
