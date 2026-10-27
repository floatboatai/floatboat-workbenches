import { isRecord, boundedText } from "./project.ts";
export type Decision = "pending" | "accept" | "reject";
export interface Review {
  decision: Decision;
  note: string;
}
export interface Report {
  id: string;
  name: string;
  raw: string;
}
export interface EvalProject {
  reports: Report[];
  activeId: string;
  baseline: number;
  reviews: Record<string, Review>;
  suite: string;
}
export interface Cell {
  key: string;
  test: number;
  column: number;
  prompt: string;
  provider: string;
  label: string;
  input: string;
  output: string;
  pass: boolean;
  score: number | null;
  latency: number | null;
  cost: number | null;
  reason: string;
  assertions: string;
}
export interface Evaluation {
  cells: Cell[];
  columns: { index: number; label: string; provider: string }[];
  tests: number[];
  timestamp: string;
}
export const sampleSuite = JSON.stringify(
  {
    description: "模板与断言检查（回显，不调用模型）",
    mode: "echo",
    prompts: [
      { label: "原始版本", raw: "{{input}}" },
      { label: "修订版本", raw: "Reviewed: {{input}}" },
    ],
    tests: [
      {
        vars: { input: "shipping date" },
        assert: [{ type: "contains", value: "Reviewed:" }],
      },
      {
        vars: { input: "item count" },
        assert: [{ type: "not-contains", value: "undefined" }],
      },
    ],
  },
  null,
  2,
);
export const emptyProject: EvalProject = {
  reports: [],
  activeId: "",
  baseline: 0,
  reviews: {},
  suite: sampleSuite,
};
const text = (value: unknown, limit = 10000) => boundedText(value, limit);
const display = (v: unknown) =>
  typeof v === "string" ? v : JSON.stringify(v ?? "", null, 2);
function number(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}
export function parseEvaluation(raw: string): Evaluation {
  if (new TextEncoder().encode(raw).length > 600000)
    throw new Error("单份评测结果不能超过 600 KB。请先筛选或分批导出。");
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    throw new Error("结果文件不是完整 JSON。");
  }
  const summary =
    isRecord(value) && isRecord(value.results) ? value.results : value;
  if (
    !isRecord(summary) ||
    summary.version !== 3 ||
    !Array.isArray(summary.results) ||
    !summary.results.length ||
    summary.results.length > 400
  )
    throw new Error(
      "需要 Promptfoo v3 summary（1–400 个结果），也支持外层 results 字段。",
    );
  const columns = new Map<
    number,
    { index: number; label: string; provider: string }
  >();
  const seen = new Set<string>();
  const cells = summary.results.map((row: unknown): Cell => {
    if (
      !isRecord(row) ||
      !Number.isSafeInteger(row.testIdx) ||
      !Number.isSafeInteger(row.promptIdx) ||
      Number(row.testIdx) < 0 ||
      Number(row.promptIdx) < 0 ||
      typeof row.success !== "boolean" ||
      !isRecord(row.prompt) ||
      !isRecord(row.provider)
    )
      throw new Error("评测条目缺少用例、版本或成功状态。");
    const test = Number(row.testIdx),
      column = Number(row.promptIdx),
      key = `${test}:${column}`;
    if (seen.has(key)) throw new Error("结果中出现重复的用例与版本组合。");
    seen.add(key);
    const label = text(row.prompt.label ?? `版本 ${column + 1}`, 300),
      provider = text(row.provider.id, 500);
    const previous = columns.get(column);
    if (
      previous &&
      (previous.label !== label || previous.provider !== provider)
    )
      throw new Error("同一版本列的名称或提供者不一致。");
    columns.set(column, { index: column, label, provider });
    const response = isRecord(row.response) ? row.response : {},
      grading = isRecord(row.gradingResult) ? row.gradingResult : {},
      testCase = isRecord(row.testCase) ? row.testCase : {};
    const output = text(display(response.output), 50000);
    const input = text(display(row.vars ?? testCase.vars ?? {}), 16000);
    return {
      key,
      test,
      column,
      label,
      provider,
      input,
      output,
      prompt: text(display(row.prompt.raw), 30000),
      pass: row.success,
      score: number(row.score),
      latency: number(row.latencyMs),
      cost: number(row.cost),
      reason: text(
        display(
          grading.reason ??
            row.error ??
            (row.success ? "所有断言通过" : "未通过"),
        ),
      ),
      assertions: text(
        display(grading.componentResults ?? testCase.assert ?? []),
        20000,
      ),
    };
  });
  return {
    cells,
    columns: [...columns.values()].sort((a, b) => a.index - b.index),
    tests: [...new Set(cells.map((c) => c.test))].sort((a, b) => a - b),
    timestamp: typeof summary.timestamp === "string" ? summary.timestamp : "",
  };
}
function decodeProject(v: unknown, maxBytes: number): EvalProject {
  if (
    !isRecord(v) ||
    !Array.isArray(v.reports) ||
    v.reports.length > 10 ||
    !isRecord(v.reviews)
  )
    throw new Error("项目结构无效。");
  const reports = v.reports.map((r: unknown): Report => {
    if (
      !isRecord(r) ||
      typeof r.id !== "string" ||
      !/^[A-Za-z0-9_-]{1,120}$/.test(r.id)
    )
      throw new Error("报告结构无效。");
    const raw = text(r.raw, 600000);
    parseEvaluation(raw);
    return { id: text(r.id, 120), name: text(r.name, 120), raw };
  });
  if (new Set(reports.map((r) => r.id)).size !== reports.length)
    throw new Error("报告 ID 重复。");
  const reviews: Record<string, Review> = {};
  for (const [key, value] of Object.entries(v.reviews)) {
    if (
      ["__proto__", "constructor", "prototype"].includes(key) ||
      key.length > 250 ||
      !isRecord(value) ||
      !["pending", "accept", "reject"].includes(String(value.decision))
    )
      throw new Error("复核记录无效。");
    reviews[key] = {
      decision: value.decision as Decision,
      note: text(value.note, 6000),
    };
  }
  if (Object.keys(reviews).length > 1000) throw new Error("复核记录超过容量。");
  const activeId = text(v.activeId, 120);
  if (activeId && !reports.some((r) => r.id === activeId))
    throw new Error("选中的报告不存在。");
  const baseline = Number(v.baseline);
  if (!Number.isSafeInteger(baseline) || baseline < 0)
    throw new Error("基线列无效。");
  const result = {
    reports,
    activeId,
    baseline,
    reviews,
    suite: text(v.suite, 60000),
  };
  if (new TextEncoder().encode(JSON.stringify(result)).length > maxBytes)
    throw new Error(
      maxBytes === 750000
        ? "项目超过750KB，请导出并将评测分成多个项目。当前输入将保留为草稿。"
        : "工作草稿已达到1.3MB容量，请先导出并拆分项目。",
    );
  return result;
}
export function validateProject(v: unknown): EvalProject {
  return decodeProject(v, 750000);
}
export function restoreProjectDraft(v: unknown): EvalProject {
  return decodeProject(v, 1300000);
}
const referenceSyntax =
  /^\s*(?:file|package|portkey|langfuse|helicone|javascript|typescript|python|exec|shell):/i;
function literal(value: unknown, max: number) {
  const out = text(value, max);
  if (/[{][{%#]/.test(out) || referenceSyntax.test(out))
    throw new Error("数据字段必须是字面文本，不能包含模板或外部引用。");
  return out;
}
const reservedVariables = new Set([
  "env",
  "context",
  "provider",
  "prompt",
  "test",
  "vars",
  "config",
  "constructor",
  "prototype",
  "__proto__",
]);
export function validateSuite(value: unknown) {
  if (
    !isRecord(value) ||
    !["echo", "model"].includes(String(value.mode)) ||
    !Array.isArray(value.prompts) ||
    value.prompts.length < 1 ||
    value.prompts.length > 4 ||
    !Array.isArray(value.tests) ||
    value.tests.length < 1 ||
    value.tests.length > 25
  )
    throw new Error(
      "测试套件需要 mode=echo/model、1–4 个 prompts 和 1–25 个 tests。",
    );
  const prompts = value.prompts.map((p: unknown) => {
    if (!isRecord(p)) throw new Error("提示版本格式无效。");
    const raw = text(p.raw, 8000);
    if (
      /{[%#]/.test(raw) ||
      referenceSyntax.test(raw) ||
      /{{/.test(raw.replace(/{{\s*[A-Za-z][A-Za-z0-9_]{0,40}\s*}}/g, "")) ||
      Array.from(raw.matchAll(/{{(.*?)}}/gs)).some(
        (m) => !/^\s*[A-Za-z][A-Za-z0-9_]{0,40}\s*$/.test(m[1]),
      )
    )
      throw new Error("提示只支持 {{变量名}} 替换。");
    return { label: literal(p.label, 100), raw };
  });
  if (new Set(prompts.map((p) => p.label)).size !== prompts.length)
    throw new Error("提示版本名称不能重复。");
  const tests = value.tests.map((t: unknown) => {
    if (
      !isRecord(t) ||
      !isRecord(t.vars) ||
      !Array.isArray(t.assert) ||
      t.assert.length < 1 ||
      t.assert.length > 10
    )
      throw new Error("每个用例需要 vars 和 1–10 个 assert。");
    const vars: Record<string, string> = {};
    for (const [key, v] of Object.entries(t.vars)) {
      if (
        !/^[A-Za-z][A-Za-z0-9_]{0,40}$/.test(key) ||
        reservedVariables.has(key)
      )
        throw new Error("变量名无效。");
      vars[key] = literal(v, 8000);
      if (vars[key].trim().startsWith("file://"))
        throw new Error("变量不能引用本地文件。");
    }
    if (Object.keys(vars).length > 12)
      throw new Error("每个用例最多12个变量。");
    return {
      vars,
      assert: t.assert.map((a: unknown) => {
        if (
          !isRecord(a) ||
          !["contains", "not-contains", "equals", "is-json"].includes(
            String(a.type),
          )
        )
          throw new Error(
            "断言仅支持 contains、not-contains、equals、is-json。",
          );
        return a.type === "is-json"
          ? { type: "is-json" }
          : { type: String(a.type), value: literal(a.value, 8000) };
      }),
    };
  });
  for (const prompt of prompts)
    for (const match of prompt.raw.matchAll(
      /{{\s*([A-Za-z][A-Za-z0-9_]{0,40})\s*}}/g,
    )) {
      if (
        reservedVariables.has(match[1]) ||
        tests.some((t) => !Object.hasOwn(t.vars, match[1]))
      )
        throw new Error(
          "每个提示变量都必须由所有用例显式提供，且不能使用保留名称。",
        );
    }
  const suite = {
    description: literal(value.description ?? "评测套件", 300),
    mode: String(value.mode),
    prompts,
    tests,
  };
  if (new TextEncoder().encode(JSON.stringify(suite)).length > 60000)
    throw new Error("测试套件不能超过60KB。");
  return suite;
}
export const reviewKey = (reportId: string, cell: Cell) =>
  `${reportId}:${cell.key}`;
export function reviewCsv(report: Report, reviews: Record<string, Review>) {
  const quote = (v: unknown) =>
    '"' +
    String(v ?? "")
      .replace(/^[\t\r\n ]*[=+@-]/, "'$&")
      .replaceAll('"', '""') +
    '"';
  const rows = [
    [
      "用例",
      "版本",
      "提供者",
      "结果",
      "分数",
      "耗时毫秒",
      "人工判断",
      "复核意见",
      "实际输出",
    ],
    ...parseEvaluation(report.raw).cells.map((c) => {
      const r = reviews[reviewKey(report.id, c)];
      return [
        c.test + 1,
        c.label,
        c.provider,
        c.pass ? "通过" : "失败",
        c.score ?? "",
        c.latency ?? "",
        r?.decision ?? "pending",
        r?.note ?? "",
        c.output,
      ];
    }),
  ];
  return "\ufeff" + rows.map((row) => row.map(quote).join(",")).join("\r\n");
}
