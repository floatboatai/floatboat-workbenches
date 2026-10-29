// ABOUTME: 可选 Floatboat 模型通道：用 Host 生成智能体人设与深化报告；输入输出均先校验，失败给出可操作说明。
import { WorkbenchHostError } from "../../sdk/host.mjs";
import { isRecord } from "../contracts/project.ts";
import { ENTITY_TYPES, clamp } from "../contracts/scenario.ts";

export const MODEL = "gemini-3.8-flash";
type GenerateText = (
  input: { prompt: string; model?: string; system?: string; temperature?: number },
  options?: { requestId?: string; timeoutMs?: number },
) => Promise<{ text: string; finishReason?: string; model?: string }>;
export type Llm = { generateText: GenerateText };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function hostFailure(e: unknown, what: string): never {
  if (e instanceof WorkbenchHostError) {
    const code = /^[A-Z0-9_]{1,80}$/.test(e.code) ? e.code : "HOST_ERROR";
    throw new Error(
      code === "HOST_NOT_CONNECTED"
        ? `${what}需要 Floatboat 客户端：请启动并登录 Floatboat，然后点“重新检查”。规则生成不受影响。`
        : `模型请求未完成（${code}）。输入已保留，可改用规则生成或稍后重试。`,
    );
  }
  throw e;
}

export type PersonaEntity = { id: string; name: string; type: string; summary: string; stance: number };
export type PersonaRequest = {
  id: string;
  question: string;
  topic: string;
  excerpt: string;
  aspects: string[];
  entities: PersonaEntity[];
};
export function personaRequestValue(v: unknown): PersonaRequest {
  if (!isRecord(v) || typeof v.id !== "string" || !UUID.test(v.id)) throw new Error("请求编号无效");
  const str = (x: unknown, max: number) => (typeof x === "string" ? x.slice(0, max) : "");
  if (!Array.isArray(v.entities) || !v.entities.length || v.entities.length > 60) throw new Error("请提供 1–60 个实体");
  return {
    id: v.id,
    question: str(v.question, 500),
    topic: str(v.topic, 40),
    excerpt: str(v.excerpt, 6000),
    aspects: Array.isArray(v.aspects) ? v.aspects.slice(0, 16).map((a) => str(a, 30)) : [],
    entities: v.entities.map((e) => {
      if (!isRecord(e) || typeof e.id !== "string" || typeof e.name !== "string" || !ENTITY_TYPES.includes(e.type as never))
        throw new Error("实体格式无效");
      return { id: e.id.slice(0, 80), name: e.name.slice(0, 60), type: String(e.type), summary: str(e.summary, 300), stance: typeof e.stance === "number" ? clamp(e.stance) : 0 };
    }),
  };
}
export function personaPrompt(r: PersonaRequest) {
  return {
    model: MODEL,
    temperature: 0.4,
    system: "你是社会舆论推演的人设设计师。只输出 JSON，不输出解释。",
    prompt: [
      `推演问题：${r.question || r.topic}`,
      `议题要点：${r.aspects.join("、") || "未设置"}`,
      `资料摘录（可能不完整）：\n${r.excerpt}`,
      "为下列每个实体写一个社交平台人设。返回 JSON 数组，每项字段：entityId（照抄）、bio（≤80字）、persona（≤200字，说明身份、关切、说话方式与立场理由）、profession（≤12字）、stance（-1 反对到 1 支持的小数）、activity（0–1 活跃度）、topics（最多3个议题要点）。",
      JSON.stringify(r.entities.map((e) => ({ entityId: e.id, name: e.name, type: e.type, summary: e.summary, stance: e.stance }))),
    ].join("\n\n"),
  };
}
export type PersonaPatch = { entityId: string; bio: string; persona: string; profession: string; stance: number; activity: number; topics: string[] };
export function parsePersonas(text: string, request: PersonaRequest): PersonaPatch[] {
  const start = text.indexOf("["),
    end = text.lastIndexOf("]");
  if (start < 0 || end <= start) throw new Error("模型没有返回人设列表，请重试或改用规则生成。");
  let raw: unknown;
  try {
    raw = JSON.parse(text.slice(start, end + 1));
  } catch {
    throw new Error("模型返回的人设不是有效 JSON，请重试或改用规则生成。");
  }
  if (!Array.isArray(raw)) throw new Error("模型返回的人设格式无效。");
  const ids = new Set(request.entities.map((e) => e.id));
  const out: PersonaPatch[] = [];
  for (const item of raw) {
    if (!isRecord(item) || typeof item.entityId !== "string" || !ids.has(item.entityId)) continue;
    const s = (x: unknown, max: number) => (typeof x === "string" ? x.trim().slice(0, max) : "");
    const n = (x: unknown, lo: number, hi: number, d: number) => (typeof x === "number" && Number.isFinite(x) ? Math.min(hi, Math.max(lo, x)) : d);
    out.push({
      entityId: item.entityId,
      bio: s(item.bio, 300),
      persona: s(item.persona, 1200),
      profession: s(item.profession, 40),
      stance: Math.round(n(item.stance, -1, 1, 0) * 1000) / 1000,
      activity: Math.round(n(item.activity, 0.05, 1, 0.5) * 1000) / 1000,
      topics: Array.isArray(item.topics) ? item.topics.filter((t): t is string => typeof t === "string").slice(0, 3).map((t) => t.slice(0, 30)) : [],
    });
  }
  if (!out.length) throw new Error("模型返回的人设与实体不对应，请重试。");
  return out;
}
export async function generatePersonas(llm: Llm, body: unknown) {
  const request = personaRequestValue(body);
  try {
    const r = await llm.generateText(personaPrompt(request), { requestId: request.id, timeoutMs: 120000 });
    if (r.finishReason && r.finishReason !== "STOP") throw new Error("模型输出被截断，请减少实体数量后重试。");
    return { id: request.id, personas: parsePersonas(r.text, request), model: r.model || MODEL };
  } catch (e) {
    hostFailure(e, "模型人设");
  }
}

export type ReportRequest = { id: string; question: string; draft: string; metrics: string };
export function reportRequestValue(v: unknown): ReportRequest {
  if (!isRecord(v) || typeof v.id !== "string" || !UUID.test(v.id)) throw new Error("请求编号无效");
  if (typeof v.draft !== "string" || !v.draft.trim() || v.draft.length > 40000) throw new Error("请先生成规则报告（不超过4万字）。");
  return {
    id: v.id,
    question: typeof v.question === "string" ? v.question.slice(0, 500) : "",
    draft: v.draft,
    metrics: typeof v.metrics === "string" ? v.metrics.slice(0, 20000) : "",
  };
}
export function reportPrompt(r: ReportRequest) {
  return {
    model: MODEL,
    temperature: 0.3,
    system: "你是政策舆情分析师。基于给定推演数据写报告，不编造数据，保留所有数字与局限说明。输出 Markdown。",
    prompt: `推演问题：${r.question}\n\n逐轮指标（JSON）：\n${r.metrics}\n\n规则报告草稿：\n${r.draft}\n\n请在不改变数字的前提下深化分析：解释转折原因、各群体分化机制、对决策者的三条可操作建议，并保留“不确定性与局限”一节。`,
  };
}
export async function deepenReport(llm: Llm, body: unknown) {
  const request = reportRequestValue(body);
  try {
    const r = await llm.generateText(reportPrompt(request), { requestId: request.id, timeoutMs: 150000 });
    if ((r.finishReason && r.finishReason !== "STOP") || !r.text.trim()) throw new Error("模型报告没有完整结束，请重试。");
    return { id: request.id, markdown: r.text.trim().slice(0, 120000), model: r.model || MODEL };
  } catch (e) {
    hostFailure(e, "模型报告");
  }
}
