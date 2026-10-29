// ABOUTME: 本地检索的请求与结果契约，以及把检索结果合并进来源列表的规则。
import { boundedText, isRecord } from "./project.ts";
import { MAX_SOURCES, SOURCE_TEXT_MAX, nextCite, safeUrl, type Research, type Source, type Step } from "./research.ts";
import { urlLines } from "./plan.ts";

export type RetrieveRequest = { kind: "web-search" | "github" | "read"; query: string; urls: string[] };
export type RetrievedItem = { url: string; title: string; excerpt: string; text: string; via: string; published: string };
export type RetrieveFailure = { target: string; code: string; message: string };
export type RetrieveResult = { items: RetrievedItem[]; failures: RetrieveFailure[]; attempts: string[] };

export function retrieveRequestValue(v: unknown): RetrieveRequest {
  if (!isRecord(v) || !["web-search", "github", "read"].includes(String(v.kind))) throw new Error("请选择网页检索、GitHub 或精读步骤。");
  const urls = Array.isArray(v.urls) ? v.urls.map((u) => boundedText(u, 3000)) : [];
  const out = { kind: v.kind as RetrieveRequest["kind"], query: boundedText(v.query ?? "", 500).trim(), urls };
  if (out.kind === "read" && (!urls.length || urls.length > 10)) throw new Error("精读步骤需要1–10个网址。");
  if (out.kind !== "read" && !out.query) throw new Error("请填写检索词。");
  return out;
}
export function requestForStep(step: Step): RetrieveRequest {
  if (step.kind === "analyze") throw new Error("人工分析步骤不需要检索。");
  return { kind: step.kind, query: step.query, urls: urlLines(step.urls) };
}
export function retrieveResultValue(v: unknown): RetrieveResult {
  if (!isRecord(v) || !Array.isArray(v.items) || !Array.isArray(v.failures)) throw new Error("检索结果格式无效。");
  return {
    items: v.items.slice(0, 20).map((x) => {
      if (!isRecord(x)) throw new Error("检索条目无效。");
      return {
        url: boundedText(x.url, 3000),
        title: boundedText(x.title, 300),
        excerpt: boundedText(x.excerpt, 3000),
        text: boundedText(x.text, SOURCE_TEXT_MAX),
        via: boundedText(x.via, 60),
        published: boundedText(x.published ?? "", 60),
      };
    }),
    failures: v.failures.slice(0, 20).map((x) => {
      if (!isRecord(x)) throw new Error("检索失败记录无效。");
      return { target: boundedText(x.target, 3000), code: boundedText(x.code, 40), message: boundedText(x.message, 600) };
    }),
    attempts: Array.isArray(v.attempts) ? v.attempts.filter((x): x is string => typeof x === "string").slice(0, 40) : [],
  };
}
export const failureText = (f: RetrieveFailure) => `${f.target.slice(0, 80)}：${f.message}（${f.code}）`;

/**
 * Put a step's results into the source list. Existing sources keep their number,
 * note and check; sources from an earlier run of the same step that the user
 * never touched (unchecked, no note, not cited) are replaced.
 */
export function mergeStepResults(data: Research, step: Step, items: RetrievedItem[], cited: number[], at: string): Source[] {
  const keep = data.sources.filter(
    (s) => s.stepId !== step.id || s.checked || s.note.trim() || cited.includes(s.cite) || s.origin === "manual",
  );
  let cite = nextCite(data.sources);
  const out = [...keep];
  for (const item of items) {
    const url = safeUrl(item.url);
    if (!url) continue;
    const existing = out.findIndex((s) => s.url === url);
    if (existing >= 0) {
      const s = out[existing];
      out[existing] = { ...s, text: s.text || item.text, excerpt: s.excerpt || item.excerpt, title: s.title || item.title };
      continue;
    }
    if (out.length >= MAX_SOURCES) break;
    const previous = data.sources.find((s) => s.url === url);
    out.push({
      id: previous?.id ?? crypto.randomUUID(),
      cite: previous?.cite ?? cite++,
      url,
      title: item.title.trim() || new URL(url).hostname,
      excerpt: item.excerpt,
      text: item.text,
      note: "",
      checked: false,
      origin: step.kind === "github" ? "github" : "web",
      stepId: step.id,
      fetchedAt: at,
    });
  }
  return out;
}
