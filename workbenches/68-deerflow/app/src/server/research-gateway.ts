import { configuration } from "./deerflow.ts";
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
  if (!value) throw new Error("请先配置DeerFlow Gateway、模型与研究工具。");
  return value.origin;
}
export async function gateway(
  path: string,
  method = "GET",
  body?: unknown,
  key?: string,
  origin = configuredOrigin(),
): Promise<unknown> {
  if (origin !== configuredOrigin())
    throw new Error("上游服务地址已改变，请恢复原服务后核对本次研究。");
  const response = await fetch(new URL(path, origin), {
    method,
    redirect: "error",
    signal: AbortSignal.timeout(20000),
    headers: {
      accept: "application/json",
      "content-type": "application/json",
      ...(process.env.DEERFLOW_TOKEN
        ? { authorization: "Bearer " + process.env.DEERFLOW_TOKEN }
        : {}),
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
  const text = Buffer.concat(chunks).toString();
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    throw new Error("上游没有返回有效JSON，回执需要核对。");
  }
  if (!response.ok) {
    const detail =
      isRecord(value) && typeof value.detail === "string"
        ? value.detail.slice(0, 250)
        : "请检查服务权限、模型白名单和研究工具。";
    throw new GatewayError(
      response.status,
      `DeerFlow HTTP ${response.status}：${detail}`,
    );
  }
  return value;
}
