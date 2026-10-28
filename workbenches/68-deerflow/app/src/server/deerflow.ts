import { nativeValue, threadValue } from "../contracts/research.ts";
export function configuration() {
  const value = process.env.DEERFLOW_URL;
  if (!value) return null;
  const url = new URL(value);
  if (
    url.username ||
    url.password ||
    !["http:", "https:"].includes(url.protocol) ||
    (!["localhost", "127.0.0.1", "[::1]"].includes(url.hostname) &&
      url.protocol !== "https:")
  )
    throw new Error("远程DeerFlow服务需要HTTPS。");
  return url;
}
export async function fetchNative(threadId: string, base = configuration()) {
  threadValue(threadId);
  if (!base) throw new Error("未配置DeerFlow服务，可先导入原生会话文件。");
  const response = await fetch(
    new URL("/api/threads/" + encodeURIComponent(threadId) + "/state", base),
    {
      redirect: "error",
      signal: AbortSignal.timeout(20000),
      headers: {
        accept: "application/json",
        ...(process.env.DEERFLOW_TOKEN
          ? { authorization: "Bearer " + process.env.DEERFLOW_TOKEN }
          : {}),
      },
    },
  );
  if (!response.ok)
    throw new Error(
      `DeerFlow读取失败（HTTP ${response.status}），请检查会话和服务授权。`,
    );
  const reader = response.body?.getReader();
  if (!reader) throw new Error("会话响应为空。");
  let size = 0;
  const chunks: Uint8Array[] = [];
  while (true) {
    const x = await reader.read();
    if (x.done) break;
    size += x.value.length;
    if (size > 800000) {
      await reader.cancel();
      throw new Error("原生会话响应过大。");
    }
    chunks.push(x.value);
  }
  const text = Buffer.concat(chunks).toString();
  nativeValue(text);
  return text;
}
