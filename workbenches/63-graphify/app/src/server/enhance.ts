// ABOUTME: Floatboat 模型增强路由（可选）：状态检查与社区命名；不发送原文，只发送社区成员名称与摘要。

import type { WorkbenchServer } from "../../sdk/runtime.mjs";
import { isRecord } from "../contracts/project.ts";
import { ENHANCE_SCHEMA, ENHANCE_SYSTEM, enhancePrompt, enhanceRequestValue, parseEnhanceResult } from "../contracts/enhance.ts";

type HostLike = Pick<WorkbenchServer, "host" | "route">;
const fail = (message: string, status = 400) => Response.json({ error: { message } }, { status });
const notConnected = (e: unknown) => isRecord(e) && e.code === "HOST_NOT_CONNECTED";

export function registerEnhance(app: HostLike) {
  app.route("GET", "/api/host/status", async () => {
    try {
      const r = await app.host.capabilities.list({ domain: "llm" });
      const op = r.capabilities.find((c) => c.domain === "llm" && c.operation === "generateObject");
      return op?.status === "available"
        ? { llm: "available", message: "Floatboat 模型已连接" }
        : { llm: "unavailable", message: "Floatboat 已连接，但本工作台的模型能力未获授权" };
    } catch (e) {
      return notConnected(e)
        ? { llm: "not-connected", message: "未连接 Floatboat。启动 Floatboat 桌面端后点“重新检查”；抽取与社区检测不受影响。" }
        : { llm: "unavailable", message: "Floatboat 模型能力暂不可用" };
    }
  });
  app.route("POST", "/api/enhance", async ({ body }) => {
    let req;
    try {
      req = enhanceRequestValue(body);
    } catch (e) {
      return fail(e instanceof Error ? e.message : "请求无效");
    }
    try {
      const result = await app.host.llm.generateObject(
        { prompt: enhancePrompt(req), system: ENHANCE_SYSTEM, schema: ENHANCE_SCHEMA as unknown as Record<string, unknown>, maxOutputTokens: 2400 },
        { timeoutMs: 120000 },
      );
      return { communities: parseEnhanceResult(result.object, req), model: result.model, requestId: result.requestId };
    } catch (e) {
      if (notConnected(e)) return fail("未连接 Floatboat，无法调用模型。启动 Floatboat 桌面端后重试；社区仍使用自动名称。", 503);
      const message = e instanceof Error ? e.message : isRecord(e) && typeof e.message === "string" ? e.message : "模型调用失败";
      return fail("社区命名未完成：" + message.slice(0, 300), 502);
    }
  });
}
