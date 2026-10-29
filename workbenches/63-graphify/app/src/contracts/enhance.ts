// ABOUTME: 可选的 Floatboat 模型增强：只发送社区成员名称与摘要，取回社区名称与一句话说明。

import { isRecord } from "./project.ts";
import { label, nodeKind, field, KIND_NAMES, type Graph } from "./graph.ts";
import type { CommunitySummary } from "./analysis.ts";

export type EnhanceCommunity = { id: number; members: { label: string; kind: string; file: string; summary: string }[] };
export type EnhanceRequest = { title: string; communities: EnhanceCommunity[] };
export type EnhanceResult = { id: number; label: string; summary: string };

export const ENHANCE_LIMITS = { communities: 40, members: 12, summary: 160 };

/** 浏览器端组装请求：每个社区最多 12 个代表成员，摘要截断；不包含原文。 */
export function buildEnhanceRequest(title: string, graph: Graph, communities: CommunitySummary[]): EnhanceRequest {
  const byId = new Map(graph.nodes.map((n) => [n.id, n]));
  return {
    title: title.slice(0, 120),
    communities: communities
      .filter((c) => c.size >= 2)
      .slice(0, ENHANCE_LIMITS.communities)
      .map((c) => ({
        id: c.id,
        members: c.top.slice(0, ENHANCE_LIMITS.members).map((id) => {
          const n = byId.get(id);
          return {
            label: label(n).slice(0, 120),
            kind: KIND_NAMES[nodeKind(n)] ?? nodeKind(n),
            file: field(n, "source_file").slice(0, 200),
            summary: field(n, "summary").slice(0, ENHANCE_LIMITS.summary),
          };
        }),
      })),
  };
}

const text = (v: unknown, max: number) => (typeof v === "string" ? v.slice(0, max) : "");
export function enhanceRequestValue(value: unknown): EnhanceRequest {
  if (!isRecord(value) || !Array.isArray(value.communities) || !value.communities.length || value.communities.length > ENHANCE_LIMITS.communities)
    throw new Error("请选择至少一个包含两个以上节点的社区。");
  return {
    title: text(value.title, 120),
    communities: value.communities.map((c) => {
      if (!isRecord(c) || !Number.isInteger(c.id) || !Array.isArray(c.members) || !c.members.length) throw new Error("社区请求格式无效。");
      return {
        id: Number(c.id),
        members: c.members.slice(0, ENHANCE_LIMITS.members).map((m) => {
          if (!isRecord(m)) throw new Error("社区成员格式无效。");
          return { label: text(m.label, 120), kind: text(m.kind, 20), file: text(m.file, 200), summary: text(m.summary, ENHANCE_LIMITS.summary) };
        }),
      };
    }),
  };
}

export const ENHANCE_SYSTEM =
  "你是代码与文档知识库的整理助手。根据每个社区的成员名称、类型、所在文件与摘要，为社区起一个 2–12 字的中文名称，并写一句不超过 50 字的说明。只依据给出的信息，不要编造成员之外的功能。";

export function enhancePrompt(req: EnhanceRequest) {
  return [
    `资料集：${req.title || "未命名"}`,
    "请为下列社区命名。返回 JSON：{\"communities\":[{\"id\":编号,\"label\":\"名称\",\"summary\":\"说明\"}]}，每个输入社区一项。",
    "",
    ...req.communities.map((c) =>
      [`社区 ${c.id}：`, ...c.members.map((m) => `- ${m.label}（${m.kind}${m.file ? `，${m.file}` : ""}）${m.summary ? `：${m.summary}` : ""}`)].join("\n"),
    ),
  ].join("\n");
}

export const ENHANCE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["communities"],
  properties: {
    communities: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["id", "label", "summary"],
        properties: { id: { type: "integer" }, label: { type: "string" }, summary: { type: "string" } },
      },
    },
  },
} as const;

/** 只接受请求中出现过的社区编号；名称与说明去空白并截断。 */
export function parseEnhanceResult(raw: unknown, req: EnhanceRequest): EnhanceResult[] {
  const asked = new Set(req.communities.map((c) => c.id));
  const list = isRecord(raw) && Array.isArray(raw.communities) ? raw.communities : null;
  if (!list) throw new Error("模型没有返回社区列表。");
  const out = new Map<number, EnhanceResult>();
  for (const item of list) {
    if (!isRecord(item) || !Number.isInteger(item.id) || !asked.has(Number(item.id))) continue;
    const name = text(item.label, 200).replace(/\s+/g, " ").trim().slice(0, 40);
    if (!name) continue;
    out.set(Number(item.id), { id: Number(item.id), label: name, summary: text(item.summary, 600).replace(/\s+/g, " ").trim().slice(0, 200) });
  }
  if (!out.size) throw new Error("模型返回的社区名称不可用，请重试。");
  return [...out.values()].sort((a, b) => a.id - b.id);
}
