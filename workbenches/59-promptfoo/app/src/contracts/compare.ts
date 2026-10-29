// ABOUTME: 运行对比：逐列统计、基线差异（同运行的另一提示版本或另一次运行）、发布门槛与输出文本差异。
import type { RunCell, RunColumn, RunView } from "./results.ts";

export type Baseline = { kind: "prompt"; prompt: string } | { kind: "run"; runId: string } | { kind: "none" };
export type DiffState = "regressed" | "fixed" | "same-pass" | "same-fail" | "new" | "baseline";
export interface CellDiff {
  state: DiffState;
  base: RunCell | null;
  scoreDelta: number | null;
  outputChanged: boolean;
}
export interface ColumnStats {
  column: RunColumn;
  total: number;
  pass: number;
  fail: number;
  error: number;
  skipped: number;
  passRate: number;
  avgScore: number | null;
  latencyP50: number | null;
  latencyP95: number | null;
  cost: number | null;
  tokens: number | null;
  regressions: number;
  fixes: number;
  compared: number;
  baseRate: number | null;
}
export interface Gate {
  minPassRate: number;
  maxRegressions: number;
  allowErrors: boolean;
}
export const defaultGate: Gate = { minPassRate: 0.9, maxRegressions: 0, allowErrors: false };
export type Recommendation = "ship" | "hold" | "block" | "baseline";

const quantile = (values: number[], q: number) => {
  if (!values.length) return null;
  const s = [...values].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.max(0, Math.ceil(q * s.length) - 1))];
};

/** 找出单元格对应的基线单元格。 */
export function baselineCell(run: RunView, cell: RunCell, baseline: Baseline, other: RunView | null): RunCell | null {
  if (baseline.kind === "run") return other?.byKey.get(cell.key) ?? null;
  if (baseline.kind === "prompt") {
    const col = run.columns.find((c) => c.index === cell.column);
    const baseCol = run.columns.find((c) => c.prompt === baseline.prompt && c.provider === col?.provider);
    if (!baseCol || baseCol.key === col?.key) return null;
    return run.byKey.get(`${cell.testKey}|${baseCol.key}`) ?? null;
  }
  return null;
}
export function isBaselineColumn(run: RunView, column: RunColumn, baseline: Baseline) {
  return baseline.kind === "prompt" && column.prompt === baseline.prompt && run.columns.some((c) => c.prompt === baseline.prompt);
}
export function diffCell(run: RunView, cell: RunCell, baseline: Baseline, other: RunView | null): CellDiff {
  const col = run.columns.find((c) => c.index === cell.column);
  if (col && isBaselineColumn(run, col, baseline))
    return { state: "baseline", base: null, scoreDelta: null, outputChanged: false };
  const base = baselineCell(run, cell, baseline, other);
  if (!base) return { state: "new", base: null, scoreDelta: null, outputChanged: false };
  const state: DiffState = cell.pass
    ? base.pass
      ? "same-pass"
      : "fixed"
    : base.pass
      ? "regressed"
      : "same-fail";
  return {
    state,
    base,
    scoreDelta: cell.score !== null && base.score !== null ? cell.score - base.score : null,
    outputChanged: cell.output !== base.output,
  };
}

export function columnStats(run: RunView, baseline: Baseline, other: RunView | null): ColumnStats[] {
  return run.columns.map((column) => {
    const cells = run.cells.filter((c) => c.column === column.index);
    let pass = 0,
      fail = 0,
      error = 0,
      skipped = 0,
      regressions = 0,
      fixes = 0,
      compared = 0,
      basePass = 0;
    const scores: number[] = [],
      latencies: number[] = [];
    let cost: number | null = null,
      tokens: number | null = null;
    for (const c of cells) {
      if (c.pass) pass++;
      else if (c.error) error++;
      else fail++;
      if (c.skipped) skipped++;
      if (c.score !== null) scores.push(c.score);
      if (c.latency !== null) latencies.push(c.latency);
      if (c.cost !== null) cost = (cost ?? 0) + c.cost;
      if (c.tokens !== null) tokens = (tokens ?? 0) + c.tokens;
      const d = diffCell(run, c, baseline, other);
      if (d.base) {
        compared++;
        if (d.base.pass) basePass++;
        if (d.state === "regressed") regressions++;
        if (d.state === "fixed") fixes++;
      }
    }
    return {
      column,
      total: cells.length,
      pass,
      fail,
      error,
      skipped,
      passRate: cells.length ? pass / cells.length : 0,
      avgScore: scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : null,
      latencyP50: quantile(latencies, 0.5),
      latencyP95: quantile(latencies, 0.95),
      cost,
      tokens,
      regressions,
      fixes,
      compared,
      baseRate: compared ? basePass / compared : null,
    };
  });
}

export function recommend(s: ColumnStats, gate: Gate, isBaseline: boolean): { verdict: Recommendation; reasons: string[] } {
  if (isBaseline) return { verdict: "baseline", reasons: ["作为对照基线"] };
  const reasons: string[] = [];
  let verdict: Recommendation = "ship";
  if (s.error && !gate.allowErrors) {
    verdict = "block";
    reasons.push(`${s.error} 个单元格执行错误`);
  }
  if (s.passRate < gate.minPassRate) {
    if (verdict !== "block") verdict = s.passRate < gate.minPassRate - 0.15 ? "block" : "hold";
    reasons.push(`通过率 ${pct(s.passRate)} 低于门槛 ${pct(gate.minPassRate)}`);
  }
  if (s.regressions > gate.maxRegressions) {
    if (verdict === "ship") verdict = "hold";
    reasons.push(`相对基线退步 ${s.regressions} 项（允许 ${gate.maxRegressions}）`);
  }
  if (s.skipped) {
    if (verdict === "ship") verdict = "hold";
    reasons.push(`${s.skipped} 个单元格含未执行的评分断言，需补齐评分后判断发布`);
  }
  if (verdict === "ship") reasons.unshift(`通过率 ${pct(s.passRate)}，退步 ${s.regressions} 项`);
  return { verdict, reasons };
}
export const pct = (v: number) => `${Math.round(v * 1000) / 10}%`;

/** 输出文本差异：中日韩逐字、其余按词，超长时退化为整段替换。 */
export type DiffPart = { kind: "same" | "add" | "del"; text: string };
export function textDiff(a: string, b: string): DiffPart[] {
  if (a === b) return [{ kind: "same", text: a }];
  const split = (s: string) => s.match(/[㐀-鿿豈-﫿　-〿＀-￯]|[A-Za-z0-9_]+|\s+|[^\sA-Za-z0-9_㐀-鿿]/g) ?? [];
  const x = split(a),
    y = split(b);
  if (x.length * y.length > 4_000_000)
    return [
      { kind: "del", text: a },
      { kind: "add", text: b },
    ];
  let start = 0;
  while (start < x.length && start < y.length && x[start] === y[start]) start++;
  let endX = x.length,
    endY = y.length;
  while (endX > start && endY > start && x[endX - 1] === y[endY - 1]) {
    endX--;
    endY--;
  }
  const xs = x.slice(start, endX),
    ys = y.slice(start, endY);
  const m = xs.length,
    n = ys.length;
  const dp = new Uint32Array((m + 1) * (n + 1));
  for (let i = m - 1; i >= 0; i--)
    for (let j = n - 1; j >= 0; j--)
      dp[i * (n + 1) + j] = xs[i] === ys[j] ? dp[(i + 1) * (n + 1) + j + 1] + 1 : Math.max(dp[(i + 1) * (n + 1) + j], dp[i * (n + 1) + j + 1]);
  const parts: DiffPart[] = [];
  const push = (kind: DiffPart["kind"], text: string) => {
    const last = parts[parts.length - 1];
    if (last && last.kind === kind) last.text += text;
    else parts.push({ kind, text });
  };
  if (start) push("same", x.slice(0, start).join(""));
  let i = 0,
    j = 0;
  while (i < m && j < n) {
    if (xs[i] === ys[j]) {
      push("same", xs[i]);
      i++;
      j++;
    } else if (dp[(i + 1) * (n + 1) + j] >= dp[i * (n + 1) + j + 1]) push("del", xs[i++]);
    else push("add", ys[j++]);
  }
  while (i < m) push("del", xs[i++]);
  while (j < n) push("add", ys[j++]);
  if (endX < x.length) push("same", x.slice(endX).join(""));
  return parts;
}
