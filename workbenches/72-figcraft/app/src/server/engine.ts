// ABOUTME: 可选的 FigCraft CLI 原生引擎服务连接；不可用时给出明确状态，不影响内置校样。
export class EngineUnavailable extends Error {}

export function engineBase(): URL {
  const raw = process.env.FIGCRAFT_SERVICE_URL ?? "http://127.0.0.1:8796";
  let base: URL;
  try {
    base = new URL(raw);
  } catch {
    throw new EngineUnavailable("FIGCRAFT_SERVICE_URL 不是有效地址。");
  }
  if (
    base.username ||
    base.password ||
    (!["127.0.0.1", "localhost", "[::1]"].includes(base.hostname) &&
      base.protocol !== "https:")
  )
    throw new EngineUnavailable("远程 FigCraft 服务需要 HTTPS，且地址中不能包含凭据。");
  return base;
}
/** 只用于页面展示：主机与端口，不含路径或凭据。 */
export function engineLabel(): string {
  try {
    return engineBase().host;
  } catch {
    return "未配置";
  }
}

export async function callEngine(path: string, input?: unknown, timeout = 45000) {
  const base = engineBase();
  let response: Response;
  try {
    response = await fetch(new URL(path, base), {
      method: input ? "POST" : "GET",
      redirect: "error",
      signal: AbortSignal.timeout(timeout),
      headers: {
        "content-type": "application/json",
        ...(process.env.FIGCRAFT_SERVICE_TOKEN
          ? { authorization: "Bearer " + process.env.FIGCRAFT_SERVICE_TOKEN }
          : {}),
      },
      ...(input ? { body: JSON.stringify(input) } : {}),
    });
  } catch (error) {
    const timedOut = error instanceof Error && error.name === "TimeoutError";
    throw new EngineUnavailable(
      timedOut
        ? `FigCraft 原生引擎（${base.host}）响应超时。`
        : `FigCraft 原生引擎服务未运行（${base.host}）。`,
    );
  }
  const reader = response.body?.getReader();
  let size = 0;
  const chunks: Uint8Array[] = [];
  if (!reader) throw new EngineUnavailable("引擎响应为空。");
  while (true) {
    const item = await reader.read();
    if (item.done) break;
    size += item.value.length;
    if (size > 12_000_000) {
      await reader.cancel();
      throw new Error("引擎响应过大。");
    }
    chunks.push(item.value);
  }
  let value: unknown;
  try {
    value = JSON.parse(Buffer.concat(chunks).toString());
  } catch {
    throw new EngineUnavailable(`${base.host} 上的服务不是 FigCraft 引擎适配器。`);
  }
  if (response.status === 401) throw new EngineUnavailable("引擎服务认证失败，请核对 FIGCRAFT_SERVICE_TOKEN。");
  if (response.status === 503 || response.status === 404) {
    const message =
      value && typeof value === "object" && "error" in value ? String(value.error).slice(0, 250) : "";
    throw new EngineUnavailable(message || "引擎服务未就绪。");
  }
  if (!response.ok)
    throw new Error(
      value && typeof value === "object" && "error" in value
        ? String(value.error).slice(0, 250)
        : "FigCraft 服务无法完成请求。",
    );
  return value;
}

export interface EngineStatus {
  available: boolean;
  engine: string;
  service: string;
  message: string;
  checkedAt: string;
}
export async function engineStatus(): Promise<EngineStatus> {
  const checkedAt = new Date().toISOString(),
    service = engineLabel();
  try {
    const value = await callEngine("/health", undefined, 4000);
    const ok =
      value !== null && typeof value === "object" && "available" in value && value.available === true;
    const engine =
      value !== null && typeof value === "object" && "engine" in value && typeof value.engine === "string"
        ? value.engine.slice(0, 80)
        : "";
    return {
      available: ok,
      engine,
      service,
      message: ok ? "原生引擎已连接。" : "引擎服务在运行，但 CLI 版本不是 0.11.2。",
      checkedAt,
    };
  } catch (error) {
    return {
      available: false,
      engine: "",
      service,
      message: error instanceof Error ? error.message : "原生引擎不可用。",
      checkedAt,
    };
  }
}
