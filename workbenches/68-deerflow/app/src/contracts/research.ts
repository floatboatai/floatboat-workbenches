// ABOUTME: 研究项目模型：问题、可编辑计划、带引用编号的来源、报告与交付状态；含旧版数据升级。
import { isRecord, boundedText } from "./project.ts";
import { nativeValue, nativeLinks, safeUrl, compactNative, NATIVE_STORED_MAX } from "./native.ts";
export { safeUrl, threadValue, nativeValue, lastReport } from "./native.ts";

export const STEP_KINDS = ["web-search", "github", "read", "analyze"] as const;
export type StepKind = (typeof STEP_KINDS)[number];
export const STEP_STATUSES = ["todo", "running", "done", "failed"] as const;
export type StepStatus = (typeof STEP_STATUSES)[number];
export const STAGES = ["draft", "reviewing", "ready"] as const;
export const MAX_STEPS = 12,
  MAX_SOURCES = 150,
  SOURCE_TEXT_MAX = 6000;

export type Step = {
  id: string;
  title: string;
  kind: StepKind;
  query: string;
  urls: string;
  findings: string;
  status: StepStatus;
  error: string;
  ranAt: string;
};
export type Source = {
  id: string;
  cite: number;
  url: string;
  title: string;
  excerpt: string;
  text: string;
  note: string;
  checked: boolean;
  origin: string;
  stepId: string;
  fetchedAt: string;
};
export type Plan = { steps: Step[]; confirmed: boolean; confirmedAt: string; origin: string };
export type Research = {
  version: 2;
  question: string;
  scope: string;
  plan: Plan;
  sources: Source[];
  report: string;
  stage: (typeof STAGES)[number];
  native: string;
  threadId: string;
};

export const kindLabels: Record<StepKind, string> = {
  "web-search": "网页检索",
  github: "GitHub 项目",
  read: "精读网页",
  analyze: "人工分析",
};
export const originLabels: Record<string, string> = {
  web: "网页",
  github: "GitHub",
  deerflow: "DeerFlow",
  manual: "手动添加",
};

const text = (v: unknown, max: number, fallback = "") => (v === undefined ? fallback : boundedText(v, max));
function stepValue(v: unknown): Step {
  if (!isRecord(v)) throw new Error("计划步骤无效。");
  const kind = STEP_KINDS.includes(v.kind as StepKind) ? (v.kind as StepKind) : null;
  const status = STEP_STATUSES.includes(v.status as StepStatus) ? (v.status as StepStatus) : null;
  if (!kind || !status) throw new Error("计划步骤类型或状态无效。");
  const step = {
    id: boundedText(v.id, 100),
    title: boundedText(v.title, 200),
    kind,
    query: text(v.query, 500),
    urls: text(v.urls, 20000),
    findings: text(v.findings, 20000),
    status,
    error: text(v.error, 600),
    ranAt: text(v.ranAt, 40),
  };
  if (!step.id) throw new Error("计划步骤缺少编号。");
  return step;
}
function sourceValue(v: unknown, working: boolean): Source {
  if (!isRecord(v) || typeof v.checked !== "boolean") throw new Error("来源记录无效。");
  const cite = v.cite;
  if (typeof cite !== "number" || !Number.isInteger(cite) || cite < 1 || cite > 9999) throw new Error("来源引用编号无效。");
  const out: Source = {
    id: boundedText(v.id, 100),
    cite,
    url: boundedText(v.url, 3000),
    title: boundedText(v.title, 300),
    excerpt: text(v.excerpt, 3000),
    text: text(v.text, SOURCE_TEXT_MAX),
    note: text(v.note, 5000),
    checked: v.checked,
    origin: text(v.origin, 40, "manual"),
    stepId: text(v.stepId, 100),
    fetchedAt: text(v.fetchedAt, 40),
  };
  if (!out.id || (!working && (!safeUrl(out.url) || !out.title.trim())))
    throw new Error("请补全来源名称和HTTP(S)地址。");
  return out;
}
/** Version-1 projects (brief + native session + report) become a confirmed plan with numbered sources. */
function upgrade(v: Record<string, unknown>): Record<string, unknown> {
  const native = typeof v.native === "string" ? v.native : "";
  const brief = typeof v.brief === "string" ? v.brief : "";
  let todos: { content: string; status: string }[] = [];
  try {
    if (native) todos = nativeValue(native).view.todos;
  } catch {
    todos = [];
  }
  const sources = Array.isArray(v.sources) ? v.sources : [];
  return {
    version: 2,
    question: brief.split("\n").find((l) => l.trim())?.trim().slice(0, 500) ?? "",
    scope: brief,
    plan: {
      steps: todos.slice(0, MAX_STEPS).map((t, i) => ({
        id: "legacy-" + (i + 1),
        title: t.content.slice(0, 200),
        kind: "analyze",
        query: "",
        urls: "",
        findings: "",
        status: t.status === "completed" ? "done" : "todo",
        error: "",
        ranAt: "",
      })),
      confirmed: todos.length > 0,
      confirmedAt: "",
      origin: "deerflow",
    },
    sources: sources.map((s, i) =>
      isRecord(s) ? { ...s, cite: i + 1, text: "", stepId: "", fetchedAt: "", origin: s.origin === "手动添加" ? "manual" : "deerflow" } : s,
    ),
    report: v.report,
    stage: v.stage,
    native,
    threadId: v.threadId ?? "",
  };
}
function decode(input: unknown, working: boolean): Research {
  if (!isRecord(input)) throw new Error("研究项目格式无效。");
  const value = input.version === 2 ? input : upgrade(input);
  if (!isRecord(value.plan) || !Array.isArray(value.plan.steps) || !Array.isArray(value.sources))
    throw new Error("研究项目格式无效。");
  if (value.plan.steps.length > MAX_STEPS) throw new Error(`计划最多${MAX_STEPS}步。`);
  if (value.sources.length > MAX_SOURCES) throw new Error(`来源最多${MAX_SOURCES}项，请移除不相关的来源。`);
  if (!STAGES.includes(value.stage as Research["stage"])) throw new Error("交付状态无效。");
  const native = text(value.native, NATIVE_STORED_MAX);
  if (native) nativeValue(native);
  const steps = value.plan.steps.map(stepValue);
  if (new Set(steps.map((s) => s.id)).size !== steps.length) throw new Error("计划步骤编号重复。");
  const sources = value.sources.map((s) => sourceValue(s, working));
  if (new Set(sources.map((s) => s.id)).size !== sources.length) throw new Error("来源编号重复。");
  if (new Set(sources.map((s) => s.cite)).size !== sources.length) throw new Error("来源引用编号重复。");
  if (typeof value.plan.confirmed !== "boolean") throw new Error("计划确认状态无效。");
  const result: Research = {
    version: 2,
    question: boundedText(value.question, 2000),
    scope: text(value.scope, 30000),
    plan: {
      steps,
      confirmed: value.plan.confirmed,
      confirmedAt: text(value.plan.confirmedAt, 40),
      origin: text(value.plan.origin, 40, "manual"),
    },
    sources,
    report: boundedText(value.report, 200000),
    stage: value.stage as Research["stage"],
    native,
    threadId: text(value.threadId, 100),
  };
  if (!working && new TextEncoder().encode(JSON.stringify(result)).length > 850000)
    throw new Error("研究项目超过850KB，请移除部分来源正文；草稿仍会保留。");
  if (!working && result.stage === "ready") assertDeliverable(result);
  return result;
}
export const researchValue = (v: unknown) => decode(v, false),
  restoreResearch = (v: unknown) => decode(v, true);

/** Citation numbers used in text: [3], [1, 4], [2，5]; links like [x](url) are ignored. */
export function citationsIn(report: string): number[] {
  const out = new Set<number>();
  for (const m of report.matchAll(/\[(\d{1,4}(?:\s*[,，]\s*\d{1,4})*)\](?!\()/g))
    for (const n of m[1].split(/[,，]/)) out.add(Number(n.trim()));
  return [...out].sort((a, b) => a - b);
}
export function reportProblems(data: Research) {
  const cited = citationsIn(data.report),
    byCite = new Map(data.sources.map((s) => [s.cite, s]));
  return {
    cited,
    dangling: cited.filter((n) => !byCite.has(n)),
    uncheckedCited: cited.filter((n) => byCite.has(n) && !byCite.get(n)!.checked),
    uncited: data.sources.filter((s) => !cited.includes(s.cite)).map((s) => s.cite),
  };
}
function assertDeliverable(data: Research) {
  if (!data.report.trim()) throw new Error("请先撰写报告正文。");
  const p = reportProblems(data);
  if (!p.cited.length) throw new Error("报告还没有引用任何来源，请用［编号］标注依据。");
  if (p.dangling.length) throw new Error(`报告引用了不存在的来源：${p.dangling.map((n) => `[${n}]`).join("、")}。`);
  if (p.uncheckedCited.length)
    throw new Error(`请先核验被引用的来源：${p.uncheckedCited.map((n) => `[${n}]`).join("、")}。`);
}
export function assertReady(data: Research) {
  researchValue({ ...data, stage: "reviewing" });
  assertDeliverable(data);
}
export const nextCite = (sources: Source[]) => sources.reduce((m, s) => Math.max(m, s.cite), 0) + 1;

/** New project working copy from a question. */
export function emptyResearch(question = ""): Research {
  return {
    version: 2,
    question,
    scope: "",
    plan: { steps: [], confirmed: false, confirmedAt: "", origin: "manual" },
    sources: [],
    report: "",
    stage: "draft",
    native: "",
    threadId: "",
  };
}

/** Merge links found in a DeerFlow session into the source list, keeping notes and numbers. */
export function mergeNativeSources(data: Research, native: string): Source[] {
  const links = nativeLinks(native);
  const sources = [...data.sources];
  let cite = nextCite(sources);
  for (const link of links) {
    if (sources.some((s) => s.url === link.url)) continue;
    if (sources.length >= MAX_SOURCES)
      throw new Error(`合并后来源超过${MAX_SOURCES}项，请先移除不相关的来源；原快照与报告均已保留。`);
    sources.push({
      id: crypto.randomUUID(),
      cite: cite++,
      url: link.url,
      title: link.title,
      excerpt: link.excerpt,
      text: "",
      note: "",
      checked: false,
      origin: "deerflow",
      stepId: "",
      fetchedAt: new Date().toISOString(),
    });
  }
  return sources;
}
export function fromNative(input: string, threadId = ""): Research {
  const native = compactNative(input);
  const { view } = nativeValue(native);
  const brief = view.messages.find((m) => ["human", "user"].includes(m.role) && !m.hidden)?.text ?? "";
  const base = upgrade({ native, brief, report: "", sources: [], stage: "draft", threadId });
  const data = decode(base, true);
  return { ...data, sources: mergeNativeSources(data, native) };
}
