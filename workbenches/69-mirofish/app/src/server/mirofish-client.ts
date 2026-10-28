import { isRecord } from "../contracts/project.ts";
import { runValue, type CommandInput } from "../contracts/run.ts";
import { fromNative } from "../contracts/simulation.ts";
export function createMiroFishClient(
  base = process.env.MIROFISH_URL ?? "http://127.0.0.1:8789",
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
  async function read(path: string, body?: Record<string, unknown>) {
    const r = await fetch(new URL(path, base), {
      redirect: "error",
      method: body ? "POST" : "GET",
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(10000),
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
        if (size > 1500000) {
          await reader.cancel();
          throw new Error("结果过大，请按轮次从MiroFish分段导出。");
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
          message: available
            ? "MiroFish已连接，可读取已有模拟结果"
            : "未识别为可用MiroFish服务",
        };
      } catch {
        return {
          available: false,
          message: "未连接MiroFish；可导入已导出的模拟结果。",
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
      const v = await read("/api/simulation/" + id + "/run-status/detail");
      if (
        startedAt &&
        (!isRecord(v) || !isRecord(v.data) || v.data.started_at !== startedAt)
      )
        throw new Error("结果来自另一轮运行，请重新选择");
      const result = fromNative(
        JSON.stringify(v),
        "MiroFish服务 · " + id,
        "",
        "service",
      );
      if (result.simulationId !== id)
        throw new Error("返回结果与所选模拟不一致");
      return result;
    },
  };
}
