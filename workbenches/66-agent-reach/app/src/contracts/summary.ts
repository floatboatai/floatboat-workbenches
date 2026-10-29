// ABOUTME: 可选模型概括：材料组装、请求校验、提示词与保存在工作稿里的概括草稿。

import { boundedText, isRecord } from "./project.ts";
import { sourceItem, type Collection } from "./research.ts";

export type SummarySource = {
  n: number;
  title: string;
  url: string;
  note: string;
  clips: string[];
  text: string;
};
export type SummaryRequest = { focus: string; sources: SummarySource[] };
export const SUMMARY_TEXT_CHARS = 6000;
/** Material for a Host-assisted summary: notes, clips and an opening of each source. */
export function summaryMaterial(
  data: Collection,
  ids: string[],
  focus: string,
): SummaryRequest {
  const sources = data.sources
    .filter((s) => ids.includes(s.id))
    .slice(0, 8)
    .map((s, i) => {
      const item = sourceItem(data, s);
      return {
        n: i + 1,
        title: (item.title ?? item.url ?? "未命名来源").slice(0, 300),
        url: (item.url ?? "").slice(0, 2000),
        note: s.note.slice(0, 2000),
        clips: s.clips.map((c) => c.text.slice(0, 1500)).slice(0, 12),
        text: (item.text ?? "").slice(0, SUMMARY_TEXT_CHARS),
      };
    });
  return { focus: focus.slice(0, 2000), sources };
}
export function summaryRequestValue(v: unknown): SummaryRequest {
  if (!isRecord(v) || !Array.isArray(v.sources))
    throw new Error("概括请求无效");
  if (!v.sources.length || v.sources.length > 8)
    throw new Error("请选择1–8条来源进行概括");
  const sources = v.sources.map((s, i) => {
    if (!isRecord(s) || !Array.isArray(s.clips) || s.clips.length > 12)
      throw new Error("来源材料格式无效");
    return {
      n: i + 1,
      title: boundedText(s.title, 300),
      url: boundedText(s.url, 2000),
      note: boundedText(s.note, 2000),
      clips: s.clips.map((c) => boundedText(c, 1500)),
      text: boundedText(s.text, SUMMARY_TEXT_CHARS),
    };
  });
  return { focus: boundedText(v.focus ?? "", 2000), sources };
}
export function summaryPrompt(r: SummaryRequest) {
  return (
    (r.focus.trim()
      ? `研究问题：${r.focus.trim()}\n\n`
      : "请概括以下来源的共同结论、分歧和待核实之处。\n\n") +
    r.sources
      .map(
        (s) =>
          `［${s.n}］${s.title}\n链接：${s.url || "无"}\n` +
          (s.note ? `研究者判断：${s.note}\n` : "") +
          (s.clips.length
            ? `研究者摘录：\n${s.clips.map((c) => "> " + c.replace(/\n/g, " ")).join("\n")}\n`
            : "") +
          `正文节选：\n${s.text}`,
      )
      .join("\n\n---\n\n") +
    "\n\n输出：3–6条要点，每条注明［编号］；最后单列“待核实”一节。"
  );
}

/** Persisted (in the working copy's extra) result of an optional model summary. */
export type SummaryDraft = {
  text: string;
  model: string;
  requestId: string;
  at: string;
  sourceIds: string[];
  focus: string;
};
export function summaryDraftValue(v: unknown): SummaryDraft | null {
  if (!isRecord(v)) return null;
  try {
    return {
      text: boundedText(v.text, 20000),
      model: boundedText(v.model, 200),
      requestId: boundedText(v.requestId, 200),
      at: boundedText(v.at, 40),
      sourceIds: Array.isArray(v.sourceIds)
        ? v.sourceIds.filter((x): x is string => typeof x === "string").slice(0, 8)
        : [],
      focus: typeof v.focus === "string" ? v.focus.slice(0, 2000) : "",
    };
  } catch {
    return null;
  }
}
