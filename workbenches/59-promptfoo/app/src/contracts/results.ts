// ABOUTME: Promptfoo v3 结果 JSON（eval -o results.json 或 summary）的读取与矩阵视图。
import { shortHash, stableJson } from "./hash.ts";
import { columnKey } from "./config.ts";

export interface ComponentView {
  type: string;
  value: string;
  pass: boolean;
  score: number;
  reason: string;
  weight: number;
  metric: string;
  skipped: boolean;
}
export interface RunColumn {
  index: number;
  key: string;
  prompt: string;
  provider: string;
  providerId: string;
}
export interface RunTest {
  index: number;
  key: string;
  description: string;
  vars: Record<string, unknown>;
}
export interface RunCell {
  key: string;
  testKey: string;
  colKey: string;
  test: number;
  column: number;
  pass: boolean;
  error: string;
  score: number | null;
  latency: number | null;
  cost: number | null;
  tokens: number | null;
  output: string;
  rawOutput: unknown;
  prompt: string;
  reason: string;
  components: ComponentView[];
  skipped: number;
  replayedFrom: string;
  namedScores: Record<string, number>;
}
export interface RunView {
  evalId: string;
  description: string;
  timestamp: string;
  columns: RunColumn[];
  tests: RunTest[];
  cells: RunCell[];
  byKey: Map<string, RunCell>;
}
export interface RunStats {
  total: number;
  pass: number;
  fail: number;
  error: number;
  columns: number;
  tests: number;
}

export const MAX_RESULT_BYTES = 40 * 1024 * 1024;
export const MAX_RESULT_ROWS = 20000;
const isObj = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);
const n = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null);
export const displayOutput = (v: unknown) =>
  typeof v === "string" ? v : v === undefined || v === null ? "" : JSON.stringify(v, null, 2);
const clip = (s: string, max: number) => (s.length > max ? s.slice(0, max) + "…" : s);

/** 取出 summary：支持 CLI 导出外层 {evalId, results:{version:3,…}, config} 或直接 summary。 */
export function resultSummary(value: unknown): { summary: Record<string, unknown>; evalId: string; config: unknown } {
  const wrapped = isObj(value) && isObj(value.results) && Array.isArray(value.results.results);
  const summary = wrapped ? (value.results as Record<string, unknown>) : value;
  if (!isObj(summary) || !Array.isArray(summary.results))
    throw new Error("需要 Promptfoo 结果 JSON：`promptfoo eval -o results.json` 的输出，或含 version/results 的 summary。");
  if (summary.version !== undefined && summary.version !== 3 && summary.version !== 2)
    throw new Error(`暂不支持 Promptfoo 结果版本 ${String(summary.version)}（支持 v3，兼容 v2 的 results 列表）。`);
  if (!summary.results.length) throw new Error("结果文件里没有评测条目。");
  if (summary.results.length > MAX_RESULT_ROWS) throw new Error(`结果超过 ${MAX_RESULT_ROWS} 个条目，请分批导出。`);
  return {
    summary,
    evalId: wrapped && typeof (value as Record<string, unknown>).evalId === "string" ? String((value as Record<string, unknown>).evalId) : "",
    config: wrapped ? (value as Record<string, unknown>).config : undefined,
  };
}

function componentOf(c: unknown): ComponentView {
  const r = isObj(c) ? c : {};
  const a = isObj(r.assertion) ? r.assertion : {};
  const meta = isObj(r.metadata) ? r.metadata : {};
  return {
    type: typeof a.type === "string" ? a.type : "assertion",
    value: clip(a.value === undefined ? "" : displayOutput(a.value), 4000),
    pass: r.pass === true,
    score: n(r.score) ?? (r.pass === true ? 1 : 0),
    reason: clip(typeof r.reason === "string" ? r.reason : "", 4000),
    weight: n(a.weight) ?? 1,
    metric: typeof a.metric === "string" ? a.metric : "",
    skipped: meta.skipped === true,
  };
}

export function testKeyOf(description: string, vars: unknown, seen: Map<string, number>) {
  const base = shortHash(description + "\u0000" + stableJson(vars ?? {}));
  const count = seen.get(base) ?? 0;
  seen.set(base, count + 1);
  return count ? `${base}-${count}` : base;
}

export function parseRun(value: unknown): RunView {
  const { summary, evalId } = resultSummary(value);
  const promptMeta = Array.isArray(summary.prompts) ? summary.prompts : [];
  const columns = new Map<number, RunColumn>();
  const tests = new Map<number, RunTest>();
  const seenTests = new Map<string, number>();
  const cells: RunCell[] = [];
  const used = new Set<string>();
  for (const row of summary.results as unknown[]) {
    if (!isObj(row)) throw new Error("结果条目格式无效。");
    const test = Number(row.testIdx),
      column = Number(row.promptIdx);
    if (!Number.isSafeInteger(test) || !Number.isSafeInteger(column) || test < 0 || column < 0)
      throw new Error("结果条目缺少 testIdx/promptIdx。");
    const prompt = isObj(row.prompt) ? row.prompt : {};
    const provider = isObj(row.provider) ? row.provider : typeof row.provider === "string" ? { id: row.provider } : {};
    const meta = isObj(promptMeta[column]) ? (promptMeta[column] as Record<string, unknown>) : {};
    const promptLabel = String(prompt.label ?? meta.label ?? prompt.raw ?? `提示 ${column + 1}`).slice(0, 2000);
    const providerId = String(provider.id ?? meta.provider ?? "provider");
    const providerLabel = String(provider.label ?? meta.provider ?? providerId);
    let col = columns.get(column);
    if (!col) {
      col = { index: column, key: columnKey(promptLabel, providerLabel), prompt: promptLabel, provider: providerLabel, providerId };
      columns.set(column, col);
    }
    const testCase = isObj(row.testCase) ? row.testCase : {};
    const vars = isObj(row.vars) ? row.vars : isObj(testCase.vars) ? testCase.vars : {};
    let t = tests.get(test);
    if (!t) {
      const description = typeof testCase.description === "string" ? testCase.description : "";
      t = { index: test, key: testKeyOf(description, vars, seenTests), description, vars };
      tests.set(test, t);
    }
    const key = `${t.key}|${col.key}`;
    if (used.has(key)) throw new Error("结果中出现重复的用例与列组合。");
    used.add(key);
    const response = isObj(row.response) ? row.response : {};
    const grading = isObj(row.gradingResult) ? row.gradingResult : {};
    const components = Array.isArray(grading.componentResults) ? grading.componentResults.map(componentOf) : [];
    const metadata = isObj(row.metadata) ? row.metadata : {};
    const tokenUsage = isObj(response.tokenUsage) ? response.tokenUsage : {};
    // 上游在断言失败（failureReason=1）时也写入 error；只有执行错误（2）或缺少评分结果时才算“错误”
    const rawError =
      typeof row.error === "string" && row.error
        ? row.error
        : typeof response.error === "string" && response.error
          ? response.error
          : "";
    const error =
      row.failureReason === 2
        ? rawError || "执行错误"
        : row.failureReason === undefined && !isObj(row.gradingResult) && row.success !== true
          ? rawError
          : "";
    const success = row.success === true;
    cells.push({
      key,
      testKey: t.key,
      colKey: col.key,
      test,
      column,
      pass: success,
      error: clip(error, 8000),
      score: n(row.score),
      latency: n(row.latencyMs),
      cost: n(row.cost) ?? n(response.cost),
      tokens: n(tokenUsage.total),
      output: clip(displayOutput(response.output), 200_000),
      rawOutput: response.output,
      prompt: clip(typeof prompt.raw === "string" ? prompt.raw : displayOutput(prompt.raw), 200_000),
      reason: clip(typeof grading.reason === "string" ? grading.reason : error || (success ? "所有断言通过" : "未通过"), 8000),
      components,
      skipped: components.filter((c) => c.skipped).length,
      replayedFrom: typeof metadata.replayedFrom === "string" ? metadata.replayedFrom : "",
      namedScores: isObj(row.namedScores)
        ? Object.fromEntries(Object.entries(row.namedScores).filter(([, v]) => typeof v === "number")) as Record<string, number>
        : {},
    });
  }
  const sortedCols = [...columns.values()].sort((a, b) => a.index - b.index);
  const colKeys = new Set<string>();
  for (const c of sortedCols) {
    if (colKeys.has(c.key)) throw new Error(`结果中有两列同名：${c.prompt} · ${c.provider}。`);
    colKeys.add(c.key);
  }
  return {
    evalId,
    description: isObj(summary.config) && typeof summary.config.description === "string" ? summary.config.description : "",
    timestamp: typeof summary.timestamp === "string" ? summary.timestamp : "",
    columns: sortedCols,
    tests: [...tests.values()].sort((a, b) => a.index - b.index),
    cells,
    byKey: new Map(cells.map((c) => [c.key, c])),
  };
}

export function runStats(view: RunView): RunStats {
  let pass = 0,
    fail = 0,
    error = 0;
  for (const c of view.cells) {
    if (c.pass) pass++;
    else if (c.error) error++;
    else fail++;
  }
  return { total: view.cells.length, pass, fail, error, columns: view.columns.length, tests: view.tests.length };
}

/** 从运行结果抽取录制输出：provider id + 渲染后提示 → 输出、耗时、成本。 */
export interface RecordingEntry {
  output: unknown;
  latencyMs: number | null;
  cost: number | null;
  tokenUsage: unknown;
  finishReason: string;
}
export const recordingKey = (providerId: string, renderedPrompt: string) =>
  `${providerId}\u0000${shortHash(renderedPrompt)}:${renderedPrompt.length}`;
export function recordingsOf(value: unknown): Map<string, RecordingEntry> {
  const { summary } = resultSummary(value);
  const out = new Map<string, RecordingEntry>();
  for (const row of summary.results as unknown[]) {
    if (!isObj(row) || !isObj(row.response)) continue;
    const response = row.response;
    // 评分阶段的错误（例如 transform 报错）不影响录制输出；只有 provider 本身没有给出输出时跳过
    if (response.output === undefined || response.output === null || (typeof response.error === "string" && response.error)) continue;
    const prompt = isObj(row.prompt) ? row.prompt : {};
    const provider = isObj(row.provider) ? row.provider : typeof row.provider === "string" ? { id: row.provider } : {};
    if (typeof prompt.raw !== "string" || typeof provider.id !== "string") continue;
    const metadata = isObj(row.metadata) ? row.metadata : {};
    const origin = typeof metadata.replayOf === "string" ? metadata.replayOf : provider.id;
    const key = recordingKey(origin, prompt.raw);
    if (out.has(key)) continue;
    out.set(key, {
      output: response.output,
      latencyMs: n(row.latencyMs),
      cost: n(row.cost) ?? n(response.cost),
      tokenUsage: response.tokenUsage ?? null,
      finishReason: typeof response.finishReason === "string" ? response.finishReason : "",
    });
  }
  return out;
}
