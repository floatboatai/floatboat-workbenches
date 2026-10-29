// ABOUTME: 试调代理的请求/响应封装与上限，页面与服务端共用。
import { isRecord } from "./project.ts";

export const PROXY_LIMITS = {
  requestBytes: 1_000_000,
  responseBytes: 5_000_000,
  headerBytes: 32_000,
  headers: 100,
  urlLength: 8_000,
  timeoutMs: 30_000,
  concurrent: 4,
} as const;
export const PROXY_METHODS = [
  "GET",
  "POST",
  "PUT",
  "PATCH",
  "DELETE",
  "HEAD",
  "OPTIONS",
] as const;
export type ProxyMethod = (typeof PROXY_METHODS)[number];

export interface ProxyRequest {
  method: ProxyMethod;
  url: string;
  headers: [string, string][];
  /** base64 编码的原始请求体 */
  body: string | null;
  allowPrivate: boolean;
}
export interface ProxyResponse {
  status: number;
  statusText: string;
  headers: [string, string][];
  /** base64 编码的响应体（已按 content-encoding 解压） */
  body: string;
  truncated: boolean;
  durationMs: number;
  address: string;
}
export type ProxyErrorCode =
  | "INVALID"
  | "BLOCKED_PRIVATE"
  | "BLOCKED_SELF"
  | "DNS"
  | "CONNECT"
  | "TIMEOUT"
  | "TOO_LARGE"
  | "BUSY";

export class ProxyError extends Error {
  code: ProxyErrorCode;
  status: number;
  constructor(code: ProxyErrorCode, message: string, status = 400) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

const HEADER_NAME = /^[!#$%&'*+.^_`|~0-9A-Za-z-]+$/;
/** 由服务端重新计算或属于连接层的请求头，不从页面转发。 */
const DROPPED_REQUEST_HEADERS = new Set([
  "host",
  "connection",
  "content-length",
  "transfer-encoding",
  "keep-alive",
  "upgrade",
  "te",
  "trailer",
  "expect",
  "proxy-authorization",
  "proxy-connection",
  "accept-encoding",
]);

export function parseProxyRequest(value: unknown): ProxyRequest {
  if (!isRecord(value)) throw new ProxyError("INVALID", "试调请求格式无效。");
  const method = String(value.method ?? "").toUpperCase();
  if (!(PROXY_METHODS as readonly string[]).includes(method))
    throw new ProxyError("INVALID", `不支持 ${method || "空"} 方法。`);
  if (typeof value.url !== "string" || value.url.length > PROXY_LIMITS.urlLength)
    throw new ProxyError("INVALID", "请求地址无效或超过 8,000 个字符。");
  let target: URL;
  try {
    target = new URL(value.url);
  } catch {
    throw new ProxyError("INVALID", "请求地址不是完整的 URL。");
  }
  if (target.protocol !== "http:" && target.protocol !== "https:")
    throw new ProxyError("INVALID", "只能试调 http:// 或 https:// 地址。");
  if (target.username || target.password)
    throw new ProxyError(
      "INVALID",
      "地址中不要包含用户名或密码，请使用 Authorize 填写凭据。",
    );
  if (!Array.isArray(value.headers) || value.headers.length > PROXY_LIMITS.headers)
    throw new ProxyError("INVALID", "请求头格式无效或超过 100 个。");
  let headerBytes = 0;
  const headers: [string, string][] = [];
  for (const entry of value.headers) {
    if (
      !Array.isArray(entry) ||
      entry.length !== 2 ||
      typeof entry[0] !== "string" ||
      typeof entry[1] !== "string" ||
      !HEADER_NAME.test(entry[0]) ||
      /[\r\n\0]/.test(entry[1])
    )
      throw new ProxyError("INVALID", "请求头包含无效的名称或值。");
    headerBytes += entry[0].length + entry[1].length;
    if (DROPPED_REQUEST_HEADERS.has(entry[0].toLowerCase())) continue;
    headers.push([entry[0], entry[1]]);
  }
  if (headerBytes > PROXY_LIMITS.headerBytes)
    throw new ProxyError("INVALID", "请求头总长度超过 32 KB。");
  let body: string | null = null;
  if (value.body !== null && value.body !== undefined) {
    if (typeof value.body !== "string" || !/^[A-Za-z0-9+/]*={0,2}$/.test(value.body))
      throw new ProxyError("INVALID", "请求体编码无效。");
    if ((value.body.length * 3) / 4 > PROXY_LIMITS.requestBytes + 3)
      throw new ProxyError("TOO_LARGE", "请求体超过 1 MB，请缩小上传内容。", 413);
    if (method === "GET" || method === "HEAD")
      throw new ProxyError("INVALID", `${method} 请求不能携带请求体。`);
    body = value.body;
  }
  return {
    method: method as ProxyMethod,
    url: target.toString(),
    headers,
    body,
    allowPrivate: value.allowPrivate === true,
  };
}
