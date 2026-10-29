// ABOUTME: 本机评测执行：提示渲染 → provider（回放/echo/脚本/Floatboat Host）→ 断言 → Promptfoo v3 结果。
import { randomUUID } from "node:crypto";
import type { Column, ProviderDef, Suite, TestCase } from "../contracts/config.ts";
import { renderPrompt } from "../contracts/config.ts";
import { shortHash } from "../contracts/hash.ts";
import { recordingKey, type RecordingEntry } from "../contracts/results.ts";
import { AssertionConfigError, TransformError, runAssertions, type GradingResult } from "./assertions.ts";
import { functionBody, type Sandbox } from "./sandbox.ts";

export interface ProviderResponse {
  output?: unknown;
  error?: string;
  latencyMs?: number;
  cost?: number;
  tokenUsage?: { total?: number; prompt?: number; completion?: number };
  finishReason?: string;
  metadata?: Record<string, unknown>;
}
export interface HostModel {
  generateText(
    input: { prompt: string; model?: string; system?: string; temperature?: number; maxOutputTokens?: number },
    options: { requestId: string; timeoutMs: number; signal?: AbortSignal },
  ): Promise<{ text: string; model: string; finishReason: string; usage?: { inputTokens: number; outputTokens: number; totalTokens: number } }>;
}
export interface EvaluateOptions {
  sandbox: Sandbox;
  recordings: Map<string, RecordingEntry & { runId: string }>;
  host: HostModel | null;
  allowHost: boolean;
  signal?: AbortSignal;
  onProgress?: (done: number, total: number) => void;
  now?: () => number;
  evalId?: string;
}

/** 聊天格式（JSON 消息数组）的提示拆成 system 与正文，供 Host 文本接口使用。 */
export function hostPrompt(rendered: string): { prompt: string; system?: string } {
  const t = rendered.trim();
  if (t.startsWith("[")) {
    try {
      const v: unknown = JSON.parse(t);
      if (Array.isArray(v) && v.length && v.every((m) => m && typeof m === "object" && typeof m.role === "string" && typeof m.content === "string")) {
        const msgs = v as { role: string; content: string }[];
        const system = msgs.filter((m) => m.role === "system").map((m) => m.content).join("\n\n");
        const rest = msgs.filter((m) => m.role !== "system");
        const prompt = rest.length === 1 ? rest[0].content : rest.map((m) => `${m.role}: ${m.content}`).join("\n\n");
        return system ? { prompt, system } : { prompt };
      }
    } catch {
      /* 普通文本 */
    }
  }
  return { prompt: rendered };
}

async function callProvider(provider: ProviderDef, prompt: string, test: TestCase, o: EvaluateOptions): Promise<ProviderResponse> {
  const now = o.now ?? Date.now;
  if (provider.kind === "echo") return { output: prompt, latencyMs: 0, cost: 0, tokenUsage: { total: 0, prompt: 0, completion: 0 } };
  if (provider.kind === "replay") {
    const hit = o.recordings.get(recordingKey(provider.replayOf, prompt));
    if (!hit)
      return {
        error: `没有录制输出：录制库中找不到 ${provider.replayOf} 对这段提示的回答（提示或变量改动后需要重新录制，或改用 Floatboat 模型/官方执行器）。`,
      };
    return {
      output: hit.output,
      ...(hit.latencyMs !== null ? { latencyMs: hit.latencyMs } : {}),
      ...(hit.cost !== null ? { cost: hit.cost } : {}),
      ...(hit.tokenUsage && typeof hit.tokenUsage === "object" ? { tokenUsage: hit.tokenUsage as ProviderResponse["tokenUsage"] } : {}),
      ...(hit.finishReason ? { finishReason: hit.finishReason } : {}),
      metadata: { replayedFrom: hit.runId, replayOf: provider.replayOf },
    };
  }
  if (provider.kind === "script") {
    const { code: _code, timeoutMs, ...config } = provider.config;
    const started = now();
    const r = await o.sandbox.run(
      /^\s*return\b/.test(String(provider.config.code)) ? String(provider.config.code) : functionBody(String(provider.config.code)),
      ["prompt", "context"],
      [prompt, { vars: test.vars, test: { description: test.description }, config }],
      typeof timeoutMs === "number" ? timeoutMs : 2000,
    );
    const elapsed = Math.max(0, Math.round(now() - started));
    if (!r.ok) return { error: `脚本 provider 出错：${r.error}`, latencyMs: elapsed };
    const v = r.value;
    if (v && typeof v === "object" && !Array.isArray(v) && "output" in v) {
      const x = v as Record<string, unknown>;
      if (typeof x.error === "string" && x.error) return { error: x.error, latencyMs: elapsed };
      return {
        output: x.output,
        latencyMs: typeof x.latencyMs === "number" ? x.latencyMs : elapsed,
        cost: typeof x.cost === "number" ? x.cost : 0,
        ...(x.tokenUsage && typeof x.tokenUsage === "object" ? { tokenUsage: x.tokenUsage as ProviderResponse["tokenUsage"] } : {}),
      };
    }
    return { output: v, latencyMs: elapsed, cost: 0 };
  }
  if (!o.host || !o.allowHost)
    return { error: "未运行 Floatboat 模型：本次运行没有确认模型调用，或 Floatboat 未连接。" };
  const started = now();
  try {
    const { prompt: text, system } = hostPrompt(prompt);
    const c = provider.config;
    const sys = system ?? (typeof c.system === "string" ? c.system : undefined);
    const r = await o.host.generateText(
      {
        prompt: text,
        model: provider.model,
        ...(sys ? { system: sys } : {}),
        ...(typeof c.temperature === "number" ? { temperature: c.temperature } : {}),
        ...(typeof c.maxOutputTokens === "number" ? { maxOutputTokens: c.maxOutputTokens } : typeof c.max_tokens === "number" ? { maxOutputTokens: c.max_tokens } : {}),
      },
      { requestId: randomUUID(), timeoutMs: typeof c.timeoutMs === "number" ? c.timeoutMs : 120_000, signal: o.signal },
    );
    const latencyMs = Math.max(0, Math.round(now() - started));
    if (r.finishReason && !/^(stop|end_turn|STOP|length|MAX_TOKENS|max_tokens)$/i.test(r.finishReason) && !r.text)
      return { error: `模型没有返回文本（${r.finishReason}）。`, latencyMs };
    return {
      output: r.text,
      latencyMs,
      finishReason: r.finishReason,
      ...(r.usage ? { tokenUsage: { total: r.usage.totalTokens, prompt: r.usage.inputTokens, completion: r.usage.outputTokens } } : {}),
      metadata: { model: r.model },
    };
  } catch (e) {
    const code = e && typeof e === "object" && "code" in e ? String((e as { code: unknown }).code) : "";
    return {
      error:
        code === "HOST_NOT_CONNECTED"
          ? "Floatboat 未连接：请启动并登录 Floatboat 后重新运行。"
          : `模型请求未完成${code ? `（${code}）` : ""}：${e instanceof Error ? e.message.slice(0, 300) : "未知错误"}`,
      latencyMs: Math.max(0, Math.round(now() - started)),
    };
  }
}

async function transformOutput(code: string, output: unknown, test: TestCase, label: string, sandbox: Sandbox) {
  const r = await sandbox.run(functionBody(code), ["output", "context"], [output, { vars: test.vars, prompt: { label } }], 1500);
  if (!r.ok) throw new Error(`Transform failed (options.transform): ${r.error}`);
  if (r.value === null || r.value === undefined) throw new Error("Transform function did not return a value（options.transform）");
  return r.value;
}

export interface EvalRow {
  id: string;
  testIdx: number;
  promptIdx: number;
  promptId: string;
  prompt: { raw: string; label: string; config: Record<string, never> };
  provider: { id: string; label: string };
  vars: Record<string, unknown>;
  testCase: Record<string, unknown>;
  response: Record<string, unknown> | null;
  success: boolean;
  score: number;
  latencyMs: number;
  cost: number;
  namedScores: Record<string, number>;
  gradingResult: GradingResult | null;
  failureReason: 0 | 1 | 2;
  error?: string;
  metadata: Record<string, unknown>;
}

async function evaluateCell(test: TestCase, ti: number, col: Column, ci: number, o: EvaluateOptions): Promise<EvalRow> {
  const base = {
    id: randomUUID(),
    testIdx: ti,
    promptIdx: ci,
    promptId: shortHash(col.prompt.raw),
    provider: { id: col.provider.id, label: col.provider.label },
    vars: test.vars,
    testCase: {
      ...(test.description ? { description: test.description } : {}),
      vars: test.vars,
      assert: test.assert,
      ...(test.threshold !== undefined ? { threshold: test.threshold } : {}),
      options: test.options,
      metadata: test.metadata,
    },
  };
  let rendered: string;
  try {
    rendered = renderPrompt(col.prompt.raw, test.vars);
  } catch (e) {
    const error = `提示渲染失败：${e instanceof Error ? e.message : String(e)}`;
    return { ...base, prompt: { raw: col.prompt.raw, label: col.prompt.label, config: {} }, response: null, success: false, score: 0, latencyMs: 0, cost: 0, namedScores: {}, gradingResult: null, failureReason: 2, error, metadata: {} };
  }
  const prompt = { raw: rendered, label: col.prompt.label, config: {} as Record<string, never> };
  const r = await callProvider(col.provider, rendered, test, o);
  const latencyMs = r.latencyMs ?? 0;
  const cost = r.cost ?? 0;
  const response: Record<string, unknown> = {
    ...(r.output !== undefined ? { output: r.output } : {}),
    ...(r.error ? { error: r.error } : {}),
    ...(r.tokenUsage ? { tokenUsage: r.tokenUsage } : {}),
    ...(r.cost !== undefined ? { cost: r.cost } : {}),
    ...(r.finishReason ? { finishReason: r.finishReason } : {}),
  };
  const metadata = r.metadata ?? {};
  if (r.error)
    return { ...base, prompt, response, success: false, score: 0, latencyMs, cost, namedScores: {}, gradingResult: null, failureReason: 2, error: r.error, metadata };
  let output = r.output;
  try {
    if (test.options.transform) {
      output = await transformOutput(test.options.transform, output, test, col.prompt.label, o.sandbox);
      response.output = output;
    }
    const grading = await runAssertions(test, output, {
      prompt: rendered,
      promptLabel: col.prompt.label,
      vars: test.vars,
      test,
      provider: col.provider,
      ...(r.latencyMs !== undefined ? { latencyMs: r.latencyMs } : {}),
      ...(r.cost !== undefined ? { cost: r.cost } : {}),
      ...(r.finishReason ? { finishReason: r.finishReason } : {}),
      sandbox: o.sandbox,
    });
    const skipped = grading.componentResults?.filter((c) => c.metadata?.skipped).length ?? 0;
    return {
      ...base,
      prompt,
      response,
      success: grading.pass,
      score: grading.score,
      latencyMs,
      cost,
      namedScores: grading.namedScores ?? {},
      gradingResult: grading,
      failureReason: grading.pass ? 0 : 1,
      ...(grading.pass ? {} : { error: grading.reason }),
      metadata: skipped ? { ...metadata, skippedAssertions: skipped } : metadata,
    };
  } catch (e) {
    const error =
      e instanceof AssertionConfigError
        ? `断言配置错误：${e.message}`
        : e instanceof TransformError
          ? e.message
          : `评分失败：${e instanceof Error ? e.message : String(e)}`;
    return { ...base, prompt, response, success: false, score: 0, latencyMs, cost, namedScores: {}, gradingResult: null, failureReason: 2, error, metadata };
  }
}

export async function evaluateSuite(suite: Suite, config: unknown, o: EvaluateOptions) {
  const jobs: { test: TestCase; ti: number; col: Column; ci: number }[] = [];
  suite.tests.forEach((test, ti) => suite.columns.forEach((col, ci) => jobs.push({ test, ti, col, ci })));
  const rows: EvalRow[] = new Array(jobs.length);
  let next = 0,
    done = 0;
  const hostLimit = { active: 0 };
  const worker = async () => {
    while (next < jobs.length) {
      if (o.signal?.aborted) throw new Error("评测已停止。");
      const i = next++;
      const j = jobs[i];
      const isHost = j.col.provider.kind === "host";
      while (isHost && hostLimit.active >= 2) await new Promise((r) => setTimeout(r, 25));
      if (isHost) hostLimit.active++;
      try {
        rows[i] = await evaluateCell(j.test, j.ti, j.col, j.ci, o);
      } finally {
        if (isHost) hostLimit.active--;
      }
      done++;
      o.onProgress?.(done, jobs.length);
    }
  };
  await Promise.all(Array.from({ length: Math.min(suite.maxConcurrency, jobs.length) }, worker));
  const prompts = suite.columns.map((col, ci) => {
    const mine = rows.filter((r) => r.promptIdx === ci);
    const named: Record<string, number> = {},
      namedCount: Record<string, number> = {};
    for (const r of mine)
      for (const [k, v] of Object.entries(r.namedScores)) {
        named[k] = (named[k] ?? 0) + v;
        namedCount[k] = (namedCount[k] ?? 0) + 1;
      }
    const tokens = (key: "total" | "prompt" | "completion") =>
      mine.reduce((s, r) => s + Number((r.response?.tokenUsage as Record<string, number> | undefined)?.[key] ?? 0), 0);
    return {
      raw: col.prompt.raw,
      label: col.prompt.label,
      id: shortHash(col.prompt.raw),
      provider: col.provider.label,
      metrics: {
        score: mine.reduce((s, r) => s + r.score, 0),
        testPassCount: mine.filter((r) => r.success).length,
        testFailCount: mine.filter((r) => !r.success && r.failureReason === 1).length,
        testErrorCount: mine.filter((r) => r.failureReason === 2).length,
        assertPassCount: mine.reduce((s, r) => s + (r.gradingResult?.componentResults?.filter((c) => c.pass).length ?? 0), 0),
        assertFailCount: mine.reduce((s, r) => s + (r.gradingResult?.componentResults?.filter((c) => !c.pass).length ?? 0), 0),
        totalLatencyMs: mine.reduce((s, r) => s + r.latencyMs, 0),
        tokenUsage: { total: tokens("total"), prompt: tokens("prompt"), completion: tokens("completion"), cached: 0, numRequests: mine.length },
        namedScores: Object.fromEntries(Object.entries(named).map(([k, v]) => [k, v / namedCount[k]])),
        namedScoresCount: namedCount,
        cost: mine.reduce((s, r) => s + r.cost, 0),
      },
    };
  });
  const timestamp = new Date(o.now ? o.now() : Date.now()).toISOString();
  return {
    evalId: o.evalId ?? `eval-${timestamp.replace(/[:.]/g, "-")}`,
    results: {
      version: 3,
      timestamp,
      prompts,
      results: rows,
      stats: {
        successes: rows.filter((r) => r.success).length,
        failures: rows.filter((r) => r.failureReason === 1).length,
        errors: rows.filter((r) => r.failureReason === 2).length,
        tokenUsage: {
          total: prompts.reduce((s, p) => s + p.metrics.tokenUsage.total, 0),
          prompt: prompts.reduce((s, p) => s + p.metrics.tokenUsage.prompt, 0),
          completion: prompts.reduce((s, p) => s + p.metrics.tokenUsage.completion, 0),
          cached: 0,
          numRequests: rows.length,
        },
      },
    },
    config,
    shareableUrl: null,
    metadata: { producer: "Floatboat Promptfoo 评测台", promptfooCompatibility: "0.125.1" },
  };
}
