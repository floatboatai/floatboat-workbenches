// ABOUTME: DeerFlow Gateway HTTP 适配：带幂等键的JSON请求，以及加入已有运行的SSE事件流。
import { authHeaders, configuration, connectionMessage } from "./deerflow.ts";
import { isRecord } from "../contracts/project.ts";

export class GatewayError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}
export function configuredOrigin() {
  const value = configuration();
  if (!value) throw new Error("请先设置DeerFlow服务地址并启动服务。");
  return value.origin;
}
function guard(origin: string) {
  if (origin !== configuredOrigin()) throw new Error("上游服务地址已改变，请恢复原服务后核对本次研究。");
}
async function send(url: URL, init: RequestInit) {
  try {
    return await fetch(url, init);
  } catch (e) {
    throw new Error(connectionMessage(e, url) + " 回执需要核对。");
  }
}
export async function gateway(path: string, method = "GET", body?: unknown, key?: string, origin = configuredOrigin()): Promise<unknown> {
  guard(origin);
  const response = await send(new URL(path, origin), {
    method,
    redirect: "error",
    signal: AbortSignal.timeout(20000),
    headers: {
      accept: "application/json",
      "content-type": "application/json",
      ...authHeaders(),
      ...(key ? { "Idempotency-Key": key } : {}),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const reader = response.body?.getReader();
  if (!reader) throw new Error("上游响应为空，回执需要核对。");
  let size = 0;
  const chunks: Uint8Array[] = [];
  while (true) {
    const x = await reader.read();
    if (x.done) break;
    size += x.value.length;
    if (size > 800000) {
      await reader.cancel();
      throw new Error("上游响应超过800KB，保留记录待核对。");
    }
    chunks.push(x.value);
  }
  let value: unknown;
  try {
    value = JSON.parse(Buffer.concat(chunks).toString());
  } catch {
    throw new GatewayError(response.ok ? 502 : response.status, `DeerFlow HTTP ${response.status}：没有返回有效JSON，回执需要核对。`);
  }
  if (!response.ok) {
    const detail = isRecord(value) && typeof value.detail === "string" ? value.detail.slice(0, 250) : "请检查服务权限、模型白名单和研究工具。";
    throw new GatewayError(response.status, `DeerFlow HTTP ${response.status}：${detail}`);
  }
  return value;
}

export type SseFrame = { event: string; data: string; id: string };
/** Minimal text/event-stream decoder (event, data, id; comments are heartbeats). */
export async function* parseSse(body: ReadableStream<Uint8Array>): AsyncGenerator<SseFrame> {
  const decoder = new TextDecoder();
  const reader = body.getReader();
  let buffer = "";
  let frame: SseFrame = { event: "", data: "", id: "" };
  let hasData = false;
  try {
    while (true) {
      const x = await reader.read();
      if (x.done) break;
      buffer += decoder.decode(x.value, { stream: true });
      let index: number;
      while ((index = buffer.search(/\r?\n/)) >= 0) {
        const line = buffer.slice(0, index);
        buffer = buffer.slice(index + (buffer[index] === "\r" ? 2 : 1));
        if (line === "") {
          if (hasData || frame.event) yield { ...frame, event: frame.event || "message" };
          frame = { event: "", data: "", id: "" };
          hasData = false;
          continue;
        }
        if (line.startsWith(":")) continue;
        const colon = line.indexOf(":");
        const field = colon < 0 ? line : line.slice(0, colon);
        const value = colon < 0 ? "" : line.slice(colon + 1).replace(/^ /, "");
        if (field === "event") frame.event = value;
        else if (field === "data") {
          frame.data += (hasData ? "\n" : "") + value;
          hasData = true;
        } else if (field === "id") frame.id = value;
      }
    }
  } finally {
    reader.releaseLock();
  }
}
/** Observation-only join of an existing run (GET /api/threads/{t}/runs/{r}/stream), resuming after Last-Event-ID. */
export async function joinStream(threadId: string, runId: string, lastEventId: string, signal: AbortSignal, origin = configuredOrigin()) {
  guard(origin);
  const url = new URL(`/api/threads/${encodeURIComponent(threadId)}/runs/${encodeURIComponent(runId)}/stream`, origin);
  const response = await send(url, {
    redirect: "error",
    signal,
    headers: { accept: "text/event-stream", ...authHeaders(), ...(lastEventId ? { "Last-Event-ID": lastEventId } : {}) },
  });
  if (!response.ok || !response.body) {
    await response.body?.cancel();
    throw new GatewayError(response.status, `DeerFlow事件流 HTTP ${response.status}。`);
  }
  return parseSse(response.body);
}
