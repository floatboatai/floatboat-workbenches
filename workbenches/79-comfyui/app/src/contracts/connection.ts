// ABOUTME: 连接地址与请求头的规范化与校验；只允许用户配置的 http(s) 服务。

export interface ConnectionInput {
  baseUrl: string;
  headerName: string;
  token: string;
}

export function normaliseBaseUrl(input: unknown): string {
  if (typeof input !== "string" || !input.trim()) throw new Error("请填写 ComfyUI 服务地址，例如 http://127.0.0.1:8188。");
  let raw = input.trim();
  if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(raw)) raw = "http://" + raw;
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error("服务地址格式无效。");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") throw new Error("只支持 http:// 或 https:// 地址。");
  if (url.username || url.password) throw new Error("地址中不要包含用户名密码；请在“请求头令牌”中填写凭据。");
  const path = url.pathname.replace(/\/+$/, "");
  return url.origin + path;
}

export function normaliseHeaderName(input: unknown): string {
  if (input === undefined || input === null || input === "") return "";
  if (typeof input !== "string" || !/^[A-Za-z0-9-]{1,64}$/.test(input.trim())) throw new Error("请求头名称只能包含字母、数字和连字符。");
  const name = input.trim();
  if (["host", "content-length", "connection", "transfer-encoding", "upgrade", "origin"].includes(name.toLowerCase()))
    throw new Error("不能覆盖该请求头。");
  return name;
}

export function normaliseToken(input: unknown): string {
  if (input === undefined || input === null) return "";
  if (typeof input !== "string" || input.length > 2000 || /[\r\n\0]/.test(input)) throw new Error("令牌无效。");
  return input.trim();
}

/** Friendly connection failure text with the command to start a local server. */
export function describeNetworkError(error: unknown, baseUrl: string): string {
  const code = typeof error === "object" && error !== null && "cause" in error ? String((error as { cause?: { code?: unknown } }).cause?.code ?? "") : "";
  const name = error instanceof Error ? error.name : "";
  if (name === "TimeoutError" || name === "AbortError") return `连接 ${baseUrl} 超时。请确认服务正在运行且地址可达。`;
  if (code === "ECONNREFUSED")
    return `无法连接 ${baseUrl}：没有服务在监听。启动 ComfyUI：python main.py --listen 127.0.0.1 --port 8188`;
  if (code === "ENOTFOUND" || code === "EAI_AGAIN") return `无法解析主机名（${baseUrl}），请检查地址。`;
  if (code.startsWith("CERT") || code.includes("SELF_SIGNED")) return `${baseUrl} 的 HTTPS 证书不受信任。`;
  return `无法连接 ${baseUrl}。请检查服务是否运行、地址与端口是否正确。`;
}
