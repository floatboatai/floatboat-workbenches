// ABOUTME: 采集与可选模型概括路由；只在用户发起时访问公网，模型调用经 Floatboat Host。

import type { WorkbenchServer } from "../../sdk/runtime.mjs";
import { WorkbenchHostError } from "../../sdk/host.mjs";
import { isRecord } from "../contracts/project.ts";
import { queryValue, envelopeValue } from "../contracts/research.ts";
import { CHANNELS } from "../contracts/channels.ts";
import { summaryRequestValue, summaryPrompt } from "../contracts/summary.ts";
import { collect, validateQuery, UPSTREAM_COMMIT } from "./reach/collect.ts";
import { proxyFor } from "./reach/net.ts";

const MAX_IN_FLIGHT = 3;
let inFlight = 0;
const fail = (message: string, status = 400) => Response.json({ error: { message } }, { status });

export function registerCollector(app: WorkbenchServer) {
  app.route("GET", "/api/collector/status", () => ({
    available: true,
    engine: "Agent-Reach 1.6.0 渠道移植",
    commit: UPSTREAM_COMMIT,
    proxy: proxyFor(new URL("https://example.com")) ? "environment" : "none",
    channels: CHANNELS.map((c) => ({ id: c.id, actions: c.actions.map((a) => a.id) })),
  }));
  app.route("POST", "/api/collect", async ({ body }) => {
    let input;
    try {
      input = queryValue(body);
      validateQuery(input);
    } catch (e) {
      return fail(e instanceof Error ? e.message : "请选择已接入的公开渠道并填写查询或链接");
    }
    if (inFlight >= MAX_IN_FLIGHT) return fail("已有多个采集正在进行，请等待完成后再试", 429);
    inFlight++;
    try {
      const envelope = envelopeValue(await collect(input));
      return { envelope, input };
    } catch (e) {
      return fail(e instanceof Error ? e.message : "采集结果无法保存");
    } finally {
      inFlight--;
    }
  });
  app.route("GET", "/api/host/status", async () => {
    try {
      const r = await app.host.capabilities.list({ domain: "llm" });
      const op = r.capabilities.find((c) => c.domain === "llm" && c.operation === "generateText");
      return op?.status === "available"
        ? { llm: "available", message: "Floatboat 模型已连接" }
        : { llm: "unavailable", message: "Floatboat 已连接，但本工作台的模型能力未获授权" };
    } catch (error) {
      return error instanceof WorkbenchHostError && error.code === "HOST_NOT_CONNECTED"
        ? { llm: "not-connected", message: "未连接 Floatboat。启动 Floatboat 桌面端后重新检查；其余功能不受影响。" }
        : { llm: "unavailable", message: "Floatboat 模型能力暂不可用" };
    }
  });
  app.route("POST", "/api/summarize", async ({ body }) => {
    let request;
    try {
      request = summaryRequestValue(body);
    } catch (e) {
      return fail(e instanceof Error ? e.message : "概括请求无效");
    }
    try {
      const result = await app.host.llm.generateText(
        {
          prompt: summaryPrompt(request),
          system:
            "你是严谨的研究助理。只依据用户提供的来源材料写中文概括，不补充材料以外的事实；每个要点后用［编号］标注所依据的来源；材料互相矛盾或不足时明确指出。",
          maxOutputTokens: 1600,
        },
        { timeoutMs: 120000 },
      );
      const text = result.text.trim();
      if (!text) return fail("模型没有返回内容，请重试", 502);
      return { text, model: result.model, requestId: result.requestId, finishReason: result.finishReason };
    } catch (error) {
      if (error instanceof WorkbenchHostError && error.code === "HOST_NOT_CONNECTED")
        return fail("未连接 Floatboat，无法调用模型。启动 Floatboat 桌面端后重试；资料与报告不受影响。", 503);
      const message = isRecord(error) && typeof error.message === "string" ? error.message : "模型调用失败";
      return fail("模型调用未完成：" + message.slice(0, 300), 502);
    }
  });
}
