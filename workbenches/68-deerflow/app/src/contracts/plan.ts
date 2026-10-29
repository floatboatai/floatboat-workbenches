// ABOUTME: 研究计划：本地模板、步骤编辑规则、模型计划的结构与校验、交给DeerFlow的研究简报。
import { isRecord } from "./project.ts";
import { STEP_KINDS, MAX_STEPS, kindLabels, type Research, type Step, type StepKind } from "./research.ts";

export function newStep(kind: StepKind = "analyze", title = "", query = "", urls = ""): Step {
  return {
    id: crypto.randomUUID(),
    title: title || kindLabels[kind],
    kind,
    query,
    urls,
    findings: "",
    status: "todo",
    error: "",
    ranAt: "",
  };
}
/** Latin keywords inside a (possibly Chinese) question make a better GitHub query. */
export function keywords(question: string) {
  const latin = question.match(/[A-Za-z][A-Za-z0-9.+#-]{1,}/g) ?? [];
  return [...new Set(latin)].slice(0, 6).join(" ") || question.trim().slice(0, 80);
}
/** Deterministic starting plan; works without any model. */
export function templatePlan(question: string, scope = ""): Step[] {
  const q = question.trim();
  const urls = (scope.match(/https?:\/\/[^\s)）。，、；！？」』"'<>]+/g) ?? [])
    .map((u) => u.replace(/[.,;:!?]+$/, ""))
    .slice(0, 10)
    .join("\n");
  return [
    newStep("analyze", "界定问题与判断标准"),
    newStep("web-search", "网页检索：现状与权威说明", q.slice(0, 300)),
    newStep("github", "开源项目与实践", keywords(q)),
    newStep("read", "精读核心来源", "", urls),
    newStep("analyze", "比较与结论"),
  ];
}
/** Any change to the step list or a step's definition requires a new confirmation. */
export function definitionChanged(a: Step, b: Step) {
  return a.title !== b.title || a.kind !== b.kind || a.query !== b.query || a.urls !== b.urls;
}
export function urlLines(urls: string) {
  return urls
    .split(/\s+/)
    .map((x) => x.trim())
    .filter(Boolean);
}
export function planProblems(steps: Step[]): string[] {
  const out: string[] = [];
  if (!steps.length) out.push("计划至少需要一步。");
  if (steps.length > MAX_STEPS) out.push(`计划最多${MAX_STEPS}步。`);
  steps.forEach((s, i) => {
    const n = `第${i + 1}步`;
    if (!s.title.trim()) out.push(`${n}缺少标题。`);
    if ((s.kind === "web-search" || s.kind === "github") && !s.query.trim()) out.push(`${n}需要检索词。`);
    if (s.kind === "read" && !urlLines(s.urls).length) out.push(`${n}需要至少一个网址。`);
    if (s.kind === "read" && urlLines(s.urls).length > 10) out.push(`${n}最多10个网址。`);
  });
  return out;
}

export const planSchema = {
  type: "object",
  additionalProperties: false,
  required: ["steps"],
  properties: {
    steps: {
      type: "array",
      minItems: 2,
      maxItems: 8,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["title", "kind", "query", "urls"],
        properties: {
          title: { type: "string", maxLength: 120 },
          kind: { type: "string", enum: [...STEP_KINDS] },
          query: { type: "string", maxLength: 300 },
          urls: { type: "array", maxItems: 10, items: { type: "string", maxLength: 500 } },
        },
      },
    },
  },
} as const;
export function planPrompt(question: string, scope: string) {
  return (
    `研究问题：${question.trim()}\n` +
    (scope.trim() ? `范围与要求：\n${scope.trim().slice(0, 6000)}\n` : "") +
    "\n请把它拆成 3–7 个可执行的研究步骤。kind 只能是：web-search（网页检索，填写 query）、github（检索开源项目，填写英文 query）、read（精读已知网址，填写 urls）、analyze（人工分析与比较，query 与 urls 留空）。" +
    "第一步界定判断标准，最后一步比较并形成结论。只填写你确定存在的官方网址；不确定就用检索步骤。"
  );
}
/** Validate a model-proposed plan; nothing from the model is trusted unchecked. */
export function planFromModel(value: unknown): Step[] {
  if (!isRecord(value) || !Array.isArray(value.steps) || value.steps.length < 1 || value.steps.length > 8)
    throw new Error("模型返回的计划格式无效。");
  return value.steps.map((raw) => {
    if (!isRecord(raw) || typeof raw.title !== "string" || !STEP_KINDS.includes(raw.kind as StepKind))
      throw new Error("模型返回的计划步骤无效。");
    const list = Array.isArray(raw.urls) ? raw.urls : typeof raw.urls === "string" ? raw.urls.split(/\s+/) : [];
    const urls = list.filter((u): u is string => typeof u === "string" && /^https?:\/\//.test(u)).slice(0, 10);
    return newStep(
      raw.kind as StepKind,
      raw.title.trim().slice(0, 120),
      typeof raw.query === "string" ? raw.query.slice(0, 300) : "",
      urls.join("\n"),
    );
  });
}

/** Brief submitted to DeerFlow: the question, scope and the confirmed plan as explicit instructions. */
export function deerflowBrief(data: Research) {
  const steps = data.plan.steps
    .map((s, i) => {
      const detail = s.kind === "read" ? s.urls.split(/\s+/).filter(Boolean).join("、") : s.query;
      return `${i + 1}. ${s.title}（${kindLabels[s.kind]}${detail ? "：" + detail : ""}）`;
    })
    .join("\n");
  return (
    `研究问题：${data.question.trim()}\n\n` +
    (data.scope.trim() ? `范围与要求：\n${data.scope.trim()}\n\n` : "") +
    (steps ? `已确认的研究计划：\n${steps}\n\n` : "") +
    "请按计划逐步研究，输出中文报告；每个结论用 [n] 标注来源，并在文末列出编号对应的来源标题与网址。"
  );
}
