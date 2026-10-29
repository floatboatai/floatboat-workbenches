// ABOUTME: 可选的 Floatboat 模型协助：起草研究计划与带引用的报告草稿；结果只作为建议返回，由页面决定是否采用。
import type { WorkbenchServer } from "../../sdk/runtime.mjs";
import { WorkbenchHostError } from "../../sdk/host.mjs";
import { boundedText, isRecord } from "../contracts/project.ts";
import { planFromModel, planPrompt, planSchema } from "../contracts/plan.ts";
import { REPORT_SYSTEM, reportPrompt, reportRequestValue } from "../contracts/report.ts";
import { citationsIn } from "../contracts/research.ts";

type Host = Pick<WorkbenchServer["host"], "capabilities" | "llm">;
const fail = (message: string, status = 400) => Response.json({ error: { message } }, { status });
const offline = (e: unknown) => e instanceof WorkbenchHostError && e.code === "HOST_NOT_CONNECTED";
function hostFailure(e: unknown) {
  if (offline(e)) return fail("未连接 Floatboat，无法调用模型。启动 Floatboat 桌面端后点“重新检查”；本地模板与底稿不受影响。", 503);
  const message = isRecord(e) && typeof e.message === "string" ? e.message : "模型调用失败";
  return fail("模型调用未完成：" + message.slice(0, 300), 502);
}

export async function hostStatus(host: Host) {
  try {
    const r = await host.capabilities.list({ domain: "llm" });
    const ops = r.capabilities.filter((c) => c.domain === "llm" && c.status === "available").map((c) => c.operation);
    return ops.includes("generateText")
      ? { llm: "available", structured: ops.includes("generateObject"), message: "Floatboat 模型已连接，可起草计划与报告。" }
      : { llm: "unavailable", structured: false, message: "Floatboat 已连接，但本工作台的模型能力未获授权。" };
  } catch (e) {
    return offline(e)
      ? { llm: "not-connected", structured: false, message: "未连接 Floatboat。启动 Floatboat 桌面端后重新检查；模板计划与本地底稿照常可用。" }
      : { llm: "unavailable", structured: false, message: "Floatboat 模型能力暂不可用。" };
  }
}

export async function draftPlan(host: Host, body: unknown) {
  if (!isRecord(body)) throw new Error("计划请求无效");
  const question = boundedText(body.question, 2000).trim();
  const scope = boundedText(body.scope ?? "", 6000);
  if (!question) throw new Error("请先写下研究问题");
  const result = await host.llm.generateObject(
    { prompt: planPrompt(question, scope), system: "你是研究规划助理，只输出符合结构的计划。", schema: planSchema as unknown as Record<string, unknown>, maxOutputTokens: 1600 },
    { timeoutMs: 90000 },
  );
  return { steps: planFromModel(result.object), model: result.model, requestId: result.requestId };
}

export async function draftReport(host: Host, body: unknown) {
  const request = reportRequestValue(body);
  const result = await host.llm.generateText(
    { prompt: reportPrompt(request), system: REPORT_SYSTEM, maxOutputTokens: 4000 },
    { timeoutMs: 180000 },
  );
  const text = result.text.trim();
  if (!text) throw Object.assign(new Error("模型没有返回内容，请重试"), { status: 502 });
  const known = new Set(request.sources.map((s) => s.cite));
  return {
    text,
    model: result.model,
    requestId: result.requestId,
    finishReason: result.finishReason,
    unknownCitations: citationsIn(text).filter((n) => !known.has(n)),
  };
}

export function registerAssist(app: WorkbenchServer, host: Host = app.host) {
  app.route("GET", "/api/host/status", () => hostStatus(host));
  app.route("POST", "/api/assist/plan", async ({ body }) => {
    try {
      return await draftPlan(host, body);
    } catch (e) {
      return e instanceof WorkbenchHostError || (isRecord(e) && "code" in e) ? hostFailure(e) : fail(e instanceof Error ? e.message : "计划请求无效");
    }
  });
  app.route("POST", "/api/assist/report", async ({ body }) => {
    try {
      return await draftReport(host, body);
    } catch (e) {
      if (e instanceof WorkbenchHostError || (isRecord(e) && "code" in e)) return hostFailure(e);
      return fail(e instanceof Error ? e.message : "起草请求无效", isRecord(e) && e.status === 502 ? 502 : 400);
    }
  });
}
