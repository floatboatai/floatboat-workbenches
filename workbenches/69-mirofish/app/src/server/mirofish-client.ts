import { isRecord } from "../contracts/project.ts";
import { runValue, type CommandInput } from "../contracts/run.ts";
import { parseNative } from "../contracts/simulation.ts";
export const DEFAULT_MIROFISH_URL = "http://127.0.0.1:5001";
export function createMiroFishClient(
  base = process.env.MIROFISH_URL ?? DEFAULT_MIROFISH_URL,
  token = process.env.MIROFISH_TOKEN,
) {
  const url = new URL(base);
  if (
    url.protocol !== "https:" &&
    !(
      url.protocol === "http:" &&
      ["127.0.0.1", "localhost", "[::1]"].includes(url.hostname)
    )
  )
    throw new Error("MiroFish服务必须为本机HTTP或HTTPS。");
  async function read(path: string, body?: Record<string, unknown>, limit = 1_500_000, timeout = 10_000) {
    const r = await fetch(new URL(path, base), {
      redirect: "error",
      method: body ? "POST" : "GET",
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(timeout),
      headers: {
        ...(body ? { "content-type": "application/json" } : {}),
        ...(token ? { authorization: `Bearer ${token}` } : {}),
      },
    });
    if (!r.ok) throw new Error("MiroFish读取失败，请检查服务与访问设置。");
    const reader = r.body?.getReader();
    if (!reader) throw new Error("上游响应为空");
    let size = 0;
    const chunks: Uint8Array[] = [];
    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.byteLength;
        if (size > limit) {
          await reader.cancel();
          throw new Error(`上游响应超过容量上限（${(limit / 1048576).toFixed(1)}MB），请按轮次从MiroFish分段导出。`);
        }
        chunks.push(value);
      }
    } finally {
      reader.releaseLock();
    }
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const c of chunks) {
      bytes.set(c, offset);
      offset += c.byteLength;
    }
    return JSON.parse(new TextDecoder().decode(bytes)) as unknown;
  }
  return {
    async health() {
      try {
        const v = await read("/health"),
          available =
            isRecord(v) &&
            v.status === "ok" &&
            v.service === "MiroFish Backend";
        return {
          available,
          url: url.origin,
          message: available
            ? "MiroFish 后端已连接"
            : "该地址有服务，但不是 MiroFish Backend",
        };
      } catch {
        return {
          available: false,
          url: url.origin,
          message: "未连接 MiroFish 后端；本地推演照常可用",
        };
      }
    },
    async list() {
      const v = await read("/api/simulation/list");
      if (!isRecord(v) || v.success !== true || !Array.isArray(v.data))
        throw new Error("上游模拟列表格式无效");
      return v.data.slice(0, 100).map((item) => {
        if (
          !isRecord(item) ||
          typeof item.simulation_id !== "string" ||
          !/^[a-zA-Z0-9_-]{1,100}$/.test(item.simulation_id)
        )
          throw new Error("上游模拟编号无效");
        return {
          id: item.simulation_id,
          status: typeof item.status === "string" ? item.status : "",
          project: typeof item.project_id === "string" ? item.project_id : "",
        };
      });
    },
    async status(id: string) {
      if (!/^[a-zA-Z0-9_-]{1,100}$/.test(id)) throw new Error("模拟编号无效");
      const v = await read("/api/simulation/" + id + "/run-status");
      if (!isRecord(v) || v.success !== true)
        throw new Error("运行状态读取失败");
      return runValue(v.data, id);
    },
    async command(input: CommandInput) {
      const v = await read(
        "/api/simulation/" + input.action,
        input.action === "stop"
          ? { simulation_id: input.simulationId }
          : {
              simulation_id: input.simulationId,
              platform: input.platform,
              max_rounds: input.rounds,
              force: false,
              enable_graph_memory_update: false,
            },
      );
      if (!isRecord(v) || v.success !== true)
        throw new Error(
          isRecord(v) && v.pending === true
            ? "上游正在完成停止，请核对状态"
            : "上游未返回可确认的命令回执",
        );
      return runValue(v.data, input.simulationId);
    },
    async result(id: string, startedAt?: string) {
      if (!/^[a-zA-Z0-9_-]{1,100}$/.test(id)) throw new Error("模拟编号无效");
      const v = await read("/api/simulation/" + id + "/run-status/detail", undefined, 40 * 1024 * 1024, 60_000);
      if (
        startedAt &&
        (!isRecord(v) || !isRecord(v.data) || v.data.started_at !== startedAt)
      )
        throw new Error("结果来自另一轮运行，请重新选择");
      const parsed = parseNative(JSON.stringify(v));
      if (parsed.simulationId !== id)
        throw new Error("返回结果与所选模拟不一致");
      return { simulationId: id, actions: parsed.actions, ignoredEvents: parsed.ignoredEvents };
    },
  };
}
