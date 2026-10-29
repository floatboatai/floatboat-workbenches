// ABOUTME: 用例 × 提示版本×provider 评测矩阵：列头带逐项发布判断，单元格显示通过/退步/复核；窄屏为单列列表。
import { memo, useMemo, useState, type KeyboardEvent } from "react";
import { Check, X, AlertTriangle, ArrowDownRight, ArrowUpRight, MessageSquare } from "lucide-react";
import type { RunCell, RunColumn, RunTest, RunView } from "../contracts/results";
import { diffCell, isBaselineColumn, pct, recommend, type Baseline, type CellDiff, type ColumnStats, type Gate } from "../contracts/compare";
import { releaseKey, reviewKey, type Release, type ReleaseDecision, type Review } from "../contracts/evaluation";
import { testTitle, type Suite } from "../contracts/config";

export type Filter = "all" | "fail" | "regressed" | "changed" | "unreviewed";
const verdictText = { ship: "建议发布", hold: "建议暂缓", block: "建议阻止", baseline: "对照基线" } as const;
const kindText: Record<string, string> = { replay: "回放", echo: "echo", script: "脚本", host: "模型" };
const fmt = (v: number | null, d = 0) => (v === null ? "—" : v.toLocaleString("zh-CN", { maximumFractionDigits: d }));
const PAGE = 240;

export interface MatrixProps {
  run: RunView | null;
  runId: string;
  suite: Suite | null;
  baseline: Baseline;
  baselineRun: RunView | null;
  stats: ColumnStats[];
  gate: Gate;
  reviews: Record<string, Review>;
  releases: Record<string, Release>;
  selected: string;
  filter: Filter;
  search: string;
  onSelect: (key: string) => void;
  onRelease: (colKey: string, decision: ReleaseDecision) => void;
}

export function visibleTests(run: RunView, filter: Filter, search: string, baseline: Baseline, other: RunView | null, reviews: Record<string, Review>, runId: string): RunTest[] {
  const q = search.trim().toLowerCase();
  return run.tests.filter((t) => {
    if (q && !`${t.description} ${JSON.stringify(t.vars)}`.toLowerCase().includes(q)) return false;
    if (filter === "all") return true;
    const cells = run.columns.map((c) => run.byKey.get(`${t.key}|${c.key}`)).filter((c): c is RunCell => Boolean(c));
    if (filter === "fail") return cells.some((c) => !c.pass);
    if (filter === "unreviewed") return cells.some((c) => !c.pass && (reviews[reviewKey(runId, c.key)]?.decision ?? "pending") === "pending");
    return cells.some((c) => {
      const d = diffCell(run, c, baseline, other);
      return filter === "regressed" ? d.state === "regressed" : d.outputChanged || d.state === "regressed" || d.state === "fixed";
    });
  });
}

export function Matrix(p: MatrixProps) {
  const [limit, setLimit] = useState(PAGE);
  const [mobileCol, setMobileCol] = useState("");
  const tests = useMemo(
    () => (p.run ? visibleTests(p.run, p.filter, p.search, p.baseline, p.baselineRun, p.reviews, p.runId) : []),
    [p.run, p.filter, p.search, p.baseline, p.baselineRun, p.reviews, p.runId],
  );
  if (!p.run) return <Skeleton suite={p.suite} />;
  const run = p.run;
  const column = run.columns.find((c) => c.key === mobileCol) ?? run.columns[0];
  const move = (e: KeyboardEvent<HTMLElement>) => {
    const target = e.target as HTMLElement;
    const r = Number(target.dataset.row),
      c = Number(target.dataset.col);
    if (!Number.isFinite(r) || !Number.isFinite(c)) return;
    const next = { ArrowRight: [r, c + 1], ArrowLeft: [r, c - 1], ArrowDown: [r + 1, c], ArrowUp: [r - 1, c] }[e.key];
    if (!next) return;
    const el = document.querySelector<HTMLButtonElement>(`.matrix [data-row="${next[0]}"][data-col="${next[1]}"]`);
    if (el) {
      e.preventDefault();
      el.focus();
      el.click();
    }
  };
  return (
    <>
      <div className="matrix-scroll" onKeyDown={move}>
        <table className="matrix" aria-label="评测矩阵：用例 × 提示版本与 provider">
          <thead>
            <tr>
              <th scope="col" className="case-head">
                用例 <small>{tests.length}/{run.tests.length}</small>
              </th>
              {run.columns.map((c, i) => (
                <ColumnHead key={c.key} column={c} stats={p.stats[i]} ctx={p} />
              ))}
            </tr>
          </thead>
          <tbody>
            {tests.slice(0, limit).map((t, r) => (
              <Row key={t.key} test={t} rowIndex={r} run={run} ctx={p} />
            ))}
          </tbody>
        </table>
        {!tests.length ? <p className="empty-filter" role="status">当前筛选没有用例。</p> : null}
        {tests.length > limit ? (
          <button className="more" onClick={() => setLimit((l) => l + PAGE)}>
            再显示 {Math.min(PAGE, tests.length - limit)} 个用例（共 {tests.length}）
          </button>
        ) : null}
      </div>
      <div className="mobile-matrix">
        <label className="field">
          <span>提示版本 · provider</span>
          <select value={column?.key ?? ""} onChange={(e) => setMobileCol(e.target.value)} name="mobile-column">
            {run.columns.map((c) => (
              <option key={c.key} value={c.key}>
                {c.prompt.slice(0, 40)} · {c.provider}
              </option>
            ))}
          </select>
        </label>
        {column ? <ColumnSummary column={column} stats={p.stats[run.columns.indexOf(column)]} ctx={p} /> : null}
        <ul className="mobile-list">
          {tests.slice(0, limit).map((t) => {
            const cell = column ? run.byKey.get(`${t.key}|${column.key}`) : undefined;
            return cell ? (
              <li key={t.key}>
                <CellButton cell={cell} test={t} diff={diffCell(run, cell, p.baseline, p.baselineRun)} review={p.reviews[reviewKey(p.runId, cell.key)]} selected={p.selected === cell.key} onSelect={p.onSelect} wide />
              </li>
            ) : null;
          })}
        </ul>
        {!tests.length ? <p className="empty-filter" role="status">当前筛选没有用例。</p> : null}
        {tests.length > limit ? (
          <button className="more" onClick={() => setLimit((l) => l + PAGE)}>
            再显示 {Math.min(PAGE, tests.length - limit)} 个用例（共 {tests.length}）
          </button>
        ) : null}
      </div>
    </>
  );
}

function ColumnSummary({ column, stats, ctx }: { column: RunColumn; stats: ColumnStats | undefined; ctx: MatrixProps }) {
  const { gate, baseline, run, releases, runId, onRelease } = ctx;
  if (!stats || !run) return null;
  const isBase = isBaselineColumn(run, column, baseline);
  const rec = recommend(stats, gate, isBase);
  const decision = releases[releaseKey(runId, column.key)]?.decision ?? "pending";
  return (
    <div className={`release v-${rec.verdict}`}>
      <div className="rate">
        <strong>{stats.pass}</strong>/{stats.total}
        <span>{pct(stats.passRate)}</span>
        {stats.error ? <em className="err-count">{stats.error} 错误</em> : null}
      </div>
      {stats.compared && !isBase ? (
        <div className="delta">
          {stats.regressions ? <span className="down"><ArrowDownRight size={13} aria-hidden="true" />退步 {stats.regressions}</span> : <span>无退步</span>}
          {stats.fixes ? <span className="up"><ArrowUpRight size={13} aria-hidden="true" />修复 {stats.fixes}</span> : null}
        </div>
      ) : (
        <div className="delta muted">{isBase ? "对照列" : "无可对照"}</div>
      )}
      <div className="verdict" title={rec.reasons.join("；")}>
        {verdictText[rec.verdict]}
      </div>
      {!isBase ? (
        <label className="decision">
          <span className="sr-only">{column.prompt} · {column.provider} 的发布判断</span>
          <select name={`release-${column.key}`} value={decision} onChange={(e) => onRelease(column.key, e.target.value as ReleaseDecision)} className={`d-${decision}`}>
            <option value="pending">判断：待定</option>
            <option value="ship">可发布</option>
            <option value="hold">暂缓</option>
            <option value="block">阻止</option>
          </select>
        </label>
      ) : null}
    </div>
  );
}

function ColumnHead(props: { column: RunColumn; stats: ColumnStats | undefined; ctx: MatrixProps }) {
  const { column } = props;
  const { suite, run, baseline } = props.ctx;
  const def = suite?.columns.find((c) => c.key === column.key);
  const base = run ? isBaselineColumn(run, column, baseline) : false;
  return (
    <th scope="col" className={base ? "col-head baseline-col" : "col-head"}>
      <div className="col-title">
        <strong title={column.prompt}>{column.prompt}</strong>
        <small>
          {def ? <span className={`kind k-${def.provider.kind}`}>{kindText[def.provider.kind]}</span> : null}
          {column.provider}
        </small>
      </div>
      <ColumnSummary {...props} />
    </th>
  );
}

const Row = memo(function Row({ test, run, rowIndex, ctx: p }: { test: RunTest; rowIndex: number; run: RunView; ctx: MatrixProps }) {
  const firstVar = Object.entries(test.vars).find(([k, v]) => typeof v === "string" && !k.startsWith("expected"))?.[1] as string | undefined;
  return (
    <tr>
      <th scope="row" className="case">
        <span className="case-no">{String(test.index + 1).padStart(2, "0")}</span>
        <span className="case-title">{testTitle(test, test.index)}</span>
        {firstVar && test.description ? <span className="case-var">{firstVar.slice(0, 90)}</span> : null}
      </th>
      {run.columns.map((col, c) => {
        const cell = run.byKey.get(`${test.key}|${col.key}`);
        return (
          <td key={col.key}>
            {cell ? (
              <CellButton
                cell={cell}
                test={test}
                diff={diffCell(run, cell, p.baseline, p.baselineRun)}
                review={p.reviews[reviewKey(p.runId, cell.key)]}
                selected={p.selected === cell.key}
                onSelect={p.onSelect}
                row={rowIndex}
                col={c}
              />
            ) : (
              <span className="na">未运行</span>
            )}
          </td>
        );
      })}
    </tr>
  );
});

function CellButton({ cell, test, diff, review, selected, onSelect, row, col, wide }: { cell: RunCell; test: RunTest; diff: CellDiff; review?: Review; selected: boolean; onSelect: (k: string) => void; row?: number; col?: number; wide?: boolean }) {
  const state = cell.pass ? "pass" : cell.error ? "error" : "fail";
  const label = cell.pass ? "通过" : cell.error ? "错误" : "失败";
  const failed = cell.components.filter((c) => !c.pass && !c.skipped).length;
  return (
    <button
      className={`cell ${state} ${diff.state === "regressed" ? "regressed" : diff.state === "fixed" ? "fixed" : ""} ${selected ? "selected" : ""}`}
      aria-pressed={selected}
      aria-label={`用例 ${test.index + 1} ${testTitle(test, test.index)}，${label}${diff.state === "regressed" ? "，相对基线退步" : diff.state === "fixed" ? "，相对基线修复" : ""}`}
      data-row={row}
      data-col={col}
      tabIndex={selected || (row === 0 && col === 0) ? 0 : -1}
      onClick={() => onSelect(cell.key)}
    >
      <span className="cell-top">
        <span className="state">
          {state === "pass" ? <Check size={14} aria-hidden="true" /> : state === "error" ? <AlertTriangle size={14} aria-hidden="true" /> : <X size={14} aria-hidden="true" />}
          {label}
        </span>
        {diff.state === "regressed" ? <span className="tag reg">退步</span> : diff.state === "fixed" ? <span className="tag fix">修复</span> : null}
        {review && review.decision !== "pending" ? (
          <span className={`tag rv-${review.decision}`}>{review.decision === "accept" ? "已接受" : "需修改"}</span>
        ) : review?.note ? (
          <MessageSquare size={12} aria-label="有复核意见" />
        ) : null}
      </span>
      <span className="cell-meta">
        {fmt(cell.score, 2)} 分{!cell.pass && failed ? ` · ${failed} 项未过` : ""} · {fmt(cell.latency)} ms
      </span>
      {wide || !cell.pass ? <span className="cell-out">{(cell.error || cell.output).slice(0, wide ? 140 : 70)}</span> : null}
    </button>
  );
}

function Skeleton({ suite }: { suite: Suite | null }) {
  if (!suite) return <div className="matrix-empty">配置有误时无法生成矩阵，请在右侧配置中修正。</div>;
  return (
    <div className="matrix-scroll">
      <table className="matrix skeleton" aria-label="尚未运行的评测矩阵">
        <thead>
          <tr>
            <th scope="col" className="case-head">用例 <small>{suite.tests.length}</small></th>
            {suite.columns.map((c) => (
              <th scope="col" key={c.key} className="col-head">
                <div className="col-title">
                  <strong>{c.prompt.label}</strong>
                  <small>
                    <span className={`kind k-${c.provider.kind}`}>{kindText[c.provider.kind]}</span>
                    {c.provider.label}
                  </small>
                </div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {suite.tests.slice(0, PAGE).map((t, i) => (
            <tr key={t.key}>
              <th scope="row" className="case">
                <span className="case-no">{String(i + 1).padStart(2, "0")}</span>
                <span className="case-title">{testTitle(t, i)}</span>
              </th>
              {suite.columns.map((c) => (
                <td key={c.key}>
                  <span className="na">未运行</span>
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
