// ABOUTME: 单元格检查器：断言明细、当前输出与基线差异、实际提示与变量、人工复核。
import { useMemo, useState } from "react";
import { Check, X, Minus } from "lucide-react";
import type { RunCell, RunView } from "../contracts/results";
import { diffCell, textDiff, type Baseline } from "../contracts/compare";
import { testTitle } from "../contracts/config";
import type { Decision, Review } from "../contracts/evaluation";

const fmt = (v: number | null, d = 0, s = "") => (v === null ? "—" : `${v.toLocaleString("zh-CN", { maximumFractionDigits: d })}${s}`);

export function Inspector({
  run,
  cell,
  baseline,
  baselineRun,
  baselineLabel,
  review,
  onReview,
  onClose,
}: {
  run: RunView;
  cell: RunCell;
  baseline: Baseline;
  baselineRun: RunView | null;
  baselineLabel: string;
  review: Review;
  onReview: (r: Review) => void;
  onClose: () => void;
}) {
  const [mode, setMode] = useState<"diff" | "side" | "output">("diff");
  const test = run.tests.find((t) => t.index === cell.test)!;
  const column = run.columns.find((c) => c.index === cell.column)!;
  const d = diffCell(run, cell, baseline, baselineRun);
  const parts = useMemo(() => (d.base && mode === "diff" ? textDiff(d.base.output, cell.output) : null), [d.base, cell.output, mode]);
  const state = cell.pass ? "pass" : cell.error ? "error" : "fail";
  return (
    <section className="inspector" aria-label="单元格详情">
      <header className="insp-head">
        <div>
          <p className="eyebrow">
            CASE {String(test.index + 1).padStart(2, "0")} · {column.provider}
          </p>
          <h2>{testTitle(test, test.index)}</h2>
          <p className="insp-col">{column.prompt}</p>
        </div>
        <button className="ghost small close" onClick={onClose} aria-label="收起详情">
          <X size={16} aria-hidden="true" />
        </button>
      </header>
      <dl className={`insp-stats s-${state}`}>
        <div>
          <dt>结果</dt>
          <dd>{cell.pass ? "通过" : cell.error ? "错误" : "未通过"}</dd>
        </div>
        <div>
          <dt>分数</dt>
          <dd>{fmt(cell.score, 3)}</dd>
        </div>
        <div>
          <dt>耗时</dt>
          <dd>{fmt(cell.latency, 0, " ms")}</dd>
        </div>
        <div>
          <dt>成本</dt>
          <dd>{cell.cost === null ? "—" : `$${cell.cost.toFixed(5)}`}</dd>
        </div>
        <div>
          <dt>对比基线</dt>
          <dd className={`d-${d.state}`}>
            {{ regressed: "退步", fixed: "修复", "same-pass": "保持通过", "same-fail": "仍未通过", new: "无基线", baseline: "基线列" }[d.state]}
            {d.scoreDelta !== null && Math.abs(d.scoreDelta) > 1e-9 ? ` (${d.scoreDelta > 0 ? "+" : ""}${d.scoreDelta.toFixed(2)})` : ""}
          </dd>
        </div>
      </dl>
      {cell.replayedFrom ? <p className="muted small">回放录制输出（来源运行 {cell.replayedFrom.slice(0, 12)}…），耗时与成本为录制时的数值。</p> : null}
      {cell.error ? (
        <p className="cell-error" role="note">
          {cell.error}
        </p>
      ) : null}

      <h3>断言 {cell.components.length ? `${cell.components.filter((c) => c.pass && !c.skipped).length}/${cell.components.filter((c) => !c.skipped).length}` : ""}</h3>
      {cell.components.length ? (
        <ol className="asserts">
          {cell.components.map((c, i) => (
            <li key={i} className={c.skipped ? "skipped" : c.pass ? "ok" : "bad"}>
              <span className="a-icon" aria-hidden="true">
                {c.skipped ? <Minus size={14} /> : c.pass ? <Check size={14} /> : <X size={14} />}
              </span>
              <span className="a-body">
                <code>{c.type}</code>
                {c.metric ? <span className="metric">{c.metric}</span> : null}
                {c.weight !== 1 ? <span className="weight">×{c.weight}</span> : null}
                <span className="score">{c.score.toFixed(2)}</span>
                {c.value ? <span className="a-value">{c.value.slice(0, 160)}</span> : null}
                {!c.pass || c.skipped ? <span className="a-reason">{c.reason}</span> : null}
              </span>
            </li>
          ))}
        </ol>
      ) : (
        <p className="muted">{cell.error ? "执行出错，未运行断言。" : "此用例没有断言。"}</p>
      )}
      {cell.reason && !cell.error ? <p className="muted small">汇总：{cell.reason}</p> : null}

      <div className="out-head">
        <h3>输出</h3>
        {d.base ? (
          <div className="seg" role="group" aria-label="输出视图">
            {(["diff", "side", "output"] as const).map((m) => (
              <button key={m} className={mode === m ? "on" : ""} aria-pressed={mode === m} onClick={() => setMode(m)}>
                {{ diff: "差异", side: "并排", output: "仅当前" }[m]}
              </button>
            ))}
          </div>
        ) : null}
      </div>
      {d.base && mode === "side" ? (
        <div className="side">
          <figure>
            <figcaption>基线 · {baselineLabel}</figcaption>
            <pre>{d.base.output || d.base.error || "（无输出）"}</pre>
          </figure>
          <figure>
            <figcaption>当前</figcaption>
            <pre>{cell.output || "（无输出）"}</pre>
          </figure>
        </div>
      ) : parts ? (
        <pre className="diff" aria-label={`与基线 ${baselineLabel} 的差异`}>
          {parts.map((x, i) =>
            x.kind === "same" ? (
              <span key={i}>{x.text}</span>
            ) : x.kind === "add" ? (
              <ins key={i}>{x.text}</ins>
            ) : (
              <del key={i}>{x.text}</del>
            ),
          )}
        </pre>
      ) : (
        <pre className="output">{cell.output || "（无输出）"}</pre>
      )}

      <details>
        <summary>实际提示</summary>
        <pre>{cell.prompt}</pre>
      </details>
      <details>
        <summary>变量</summary>
        <pre>{JSON.stringify(test.vars, null, 2)}</pre>
      </details>

      <fieldset className="review">
        <legend>人工复核</legend>
        <div className="seg" role="radiogroup" aria-label="复核判断">
          {(
            [
              ["pending", "待复核"],
              ["accept", "接受此结果"],
              ["reject", "需要修改"],
            ] as [Decision, string][]
          ).map(([v, label]) => (
            <button key={v} role="radio" aria-checked={review.decision === v} className={review.decision === v ? `on r-${v}` : ""} onClick={() => onReview({ ...review, decision: v })}>
              {label}
            </button>
          ))}
        </div>
        <label className="field">
          <span>复核意见</span>
          <textarea
            name="review-note"
            value={review.note}
            maxLength={6000}
            rows={3}
            placeholder="记录原因或下一步修改…"
            onChange={(e) => onReview({ ...review, note: e.target.value })}
          />
        </label>
      </fieldset>
    </section>
  );
}
