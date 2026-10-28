import { createHash } from "node:crypto";
import type { WorkbenchServer } from "../../sdk/runtime.mjs";
import { isRecord } from "../contracts/project.ts";
import { queryValue, envelopeValue } from "../contracts/research.ts";
const commit = "14c213405669414492bda0f8d52cc6531d062c45";
function endpoint() {
  const u = new URL(
    process.env.AGENT_REACH_SERVICE_URL ?? "http://127.0.0.1:8783",
  );
  if (
    u.username ||
    u.password ||
    u.search ||
    u.hash ||
    (u.protocol !== "https:" &&
      !(
        u.protocol === "http:" &&
        ["127.0.0.1", "localhost", "[::1]"].includes(u.hostname)
      ))
  )
    throw new Error("资料服务地址无效");
  return u;
}
async function service(path: string, body?: unknown) {
  const res = await fetch(new URL(path, endpoint()), {
    method: body ? "POST" : "GET",
    headers: { "content-type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(body ? 45000 : 5000),
    redirect: "error",
  });
  if (!res.body) throw new Error("采集服务无响应");
  let size = 0,
    text = "";
  const reader = res.body.getReader(),
    decoder = new TextDecoder();
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > 600000) {
      await reader.cancel();
      throw new Error("采集响应超限，请选择较小来源");
    }
    text += decoder.decode(value, { stream: true });
  }
  text += decoder.decode();
  const raw: unknown = JSON.parse(text);
  if (!res.ok)
    throw new Error(
      isRecord(raw) && typeof raw.error === "string"
        ? raw.error
        : "采集服务未完成请求",
    );
  return raw;
}
export function registerCollector(app: WorkbenchServer) {
  app.route("GET", "/api/collector/status", async () => {
    try {
      const r = await service("/health");
      const available =
        isRecord(r) &&
        r.ready === true &&
        r.engine === "Agent-Reach" &&
        r.commit === commit;
      return {
        available,
        message: available
          ? "公开渠道服务已连接"
          : "采集服务版本不匹配，请按项目说明启动",
      };
    } catch {
      return {
        available: false,
        message: "采集服务未连接；已有资料仍可编辑和导出",
      };
    }
  });
  app.route("POST", "/api/collect", async ({ body }) => {
    try {
      const input = queryValue(body);
      const actions: Record<string, string[]> = {
        github: ["read", "search"],
        web: ["read"],
        v2ex: ["hot", "read", "node"],
      };
      if (
        !actions[input.channel]?.includes(input.action) ||
        (!input.query.trim() && input.action !== "hot")
      )
        throw new Error("请选择已接入的公开渠道并填写查询或链接");
      const raw = await service("/collect", input),
        hash = createHash("sha256")
          .update(input.channel + "\n" + input.action + "\n" + input.query)
          .digest("hex");
      if (!isRecord(raw) || raw.commit !== commit || raw.inputHash !== hash)
        throw new Error("采集结果与查询不匹配");
      const envelope = envelopeValue(raw.envelope);
      if (
        envelope.channel !== input.channel ||
        envelope.action !== input.action
      )
        throw new Error("采集渠道或动作不匹配");
      return { envelope, input };
    } catch (e) {
      return Response.json(
        { error: { message: e instanceof Error ? e.message : "无法采集来源" } },
        { status: 400 },
      );
    }
  });
}
