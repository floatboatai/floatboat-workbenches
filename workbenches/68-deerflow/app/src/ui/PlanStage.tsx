// ABOUTME: 第一阶段：研究问题、范围与可编辑计划；模板或模型起草，人工确认后才能执行。
import { ArrowDown, ArrowUp, Check, RefreshCw, Sparkles, Trash2, Wand2 } from "lucide-react";
import { STEP_KINDS, kindLabels, type StepKind } from "../contracts/research";
import { planProblems } from "../contracts/plan";
import type { Desk } from "./useDesk";

export function HostLine({ d }: { d: Desk }) {
  return (
    <p className={"host-line " + d.host.llm} role="status">
      <span>{d.host.message}</span>
      <button className="link" disabled={d.host.checking} onClick={() => void d.checkHost()}>
        <RefreshCw size={12} aria-hidden="true" />
        {d.host.checking ? "检查中…" : "重新检查"}
      </button>
    </p>
  );
}

export function PlanStage({ d }: { d: Desk }) {
  const { p, mutable } = d;
  const data = p.data,
    steps = data.plan.steps;
  const problems = [...(data.question.trim() ? [] : ["请先写下研究问题。"]), ...planProblems(steps)];
  const hostReady = d.host.llm === "available";
  return (
    <section className="plan-stage" aria-labelledby="plan-title">
      <div className="question-card">
        <label htmlFor="question">研究问题</label>
        <textarea
          id="question"
          name="question"
          rows={2}
          maxLength={2000}
          placeholder="例如：单机多进程服务使用 SQLite 时是否应开启 WAL？…"
          value={data.question}
          disabled={!mutable}
          onChange={(e) => d.change((x) => ({ ...x, question: e.target.value }))}
        />
        <label htmlFor="scope">范围、约束与交付要求</label>
        <textarea
          id="scope"
          name="scope"
          rows={3}
          maxLength={30000}
          placeholder="写下已知条件、不考虑的方向、希望的交付形式；已有网址会进入精读步骤…"
          value={data.scope}
          disabled={!mutable}
          onChange={(e) => d.change((x) => ({ ...x, scope: e.target.value }))}
        />
      </div>

      <div className="plan-head">
        <div>
          <h2 id="plan-title">研究计划</h2>
          <span className={"plan-badge " + (data.plan.confirmed ? "confirmed" : "draft")}>{data.plan.confirmed ? "已确认" : steps.length ? "待确认" : "尚未制定"}</span>
        </div>
        <div className="plan-tools">
          <button disabled={!mutable} onClick={d.applyTemplate}>
            <Wand2 size={14} aria-hidden="true" />
            按模板生成
          </button>
          <button disabled={!mutable || !hostReady || d.hostBusy !== "" || !data.question.trim()} onClick={() => void d.hostPlan()}>
            <Sparkles size={14} aria-hidden="true" />
            {d.hostBusy === "plan" ? "模型起草中…" : "用 Floatboat 模型起草"}
          </button>
        </div>
      </div>
      <HostLine d={d} />

      {d.planDraft ? (
        <aside className="suggestion" aria-label="模型计划建议">
          <header>
            <strong>模型建议的计划</strong>
            <small>
              {d.planDraft.model} · {d.planDraft.steps.length} 步 · 尚未采用
            </small>
          </header>
          <ol>
            {d.planDraft.steps.map((s, i) => (
              <li key={i}>
                <span className={"kind " + s.kind}>{kindLabels[s.kind]}</span> {s.title}
                {s.query ? <small>：{s.query}</small> : null}
              </li>
            ))}
          </ol>
          <div className="row">
            <button className="primary" disabled={!mutable} onClick={d.adoptPlanDraft}>
              采用此计划
            </button>
            <button onClick={d.discardPlanDraft}>放弃建议</button>
          </div>
        </aside>
      ) : null}

      {steps.length ? (
        <ol className="step-editor">
          {steps.map((s, i) => (
            <li key={s.id} className={"kind-" + s.kind}>
              <span className="step-no" aria-hidden="true">
                {String(i + 1).padStart(2, "0")}
              </span>
              <div className="step-fields">
                <div className="row">
                  <select
                    aria-label={`第${i + 1}步类型`}
                    value={s.kind}
                    disabled={!mutable}
                    onChange={(e) => d.updateStep(s.id, { kind: e.target.value as StepKind, status: "todo", error: "" })}
                  >
                    {STEP_KINDS.map((k) => (
                      <option key={k} value={k}>
                        {kindLabels[k]}
                      </option>
                    ))}
                  </select>
                  <input
                    aria-label={`第${i + 1}步标题`}
                    name={"stepTitle-" + i}
                    autoComplete="off"
                    value={s.title}
                    maxLength={200}
                    disabled={!mutable}
                    onChange={(e) => d.updateStep(s.id, { title: e.target.value })}
                  />
                </div>
                {s.kind === "web-search" || s.kind === "github" ? (
                  <input
                    aria-label={`第${i + 1}步检索词`}
                    name={"stepQuery-" + i}
                    autoComplete="off"
                    spellCheck={false}
                    placeholder={s.kind === "github" ? "英文关键词效果更好，例如 sqlite wal checkpoint…" : "检索词…"}
                    value={s.query}
                    maxLength={500}
                    disabled={!mutable}
                    onChange={(e) => d.updateStep(s.id, { query: e.target.value })}
                  />
                ) : null}
                {s.kind === "read" ? (
                  <textarea
                    aria-label={`第${i + 1}步网址`}
                    name={"stepUrls-" + i}
                    rows={Math.min(5, Math.max(2, s.urls.split("\n").length))}
                    spellCheck={false}
                    placeholder="每行一个网址；GitHub 仓库地址会读取 README…"
                    value={s.urls}
                    disabled={!mutable}
                    onChange={(e) => d.updateStep(s.id, { urls: e.target.value })}
                  />
                ) : null}
                {s.kind === "analyze" ? <p className="muted">人工步骤：执行阶段记录发现后标记完成。</p> : null}
              </div>
              <div className="step-actions">
                <button className="icon" aria-label={`上移第${i + 1}步`} disabled={!mutable || i === 0} onClick={() => d.moveStep(s.id, -1)}>
                  <ArrowUp size={14} aria-hidden="true" />
                </button>
                <button className="icon" aria-label={`下移第${i + 1}步`} disabled={!mutable || i === steps.length - 1} onClick={() => d.moveStep(s.id, 1)}>
                  <ArrowDown size={14} aria-hidden="true" />
                </button>
                <button
                  className="icon"
                  aria-label={`删除第${i + 1}步`}
                  disabled={!mutable}
                  onClick={() => {
                    if (!s.findings.trim() || confirm("这一步已有记录的发现，确定删除？")) d.removeStep(s.id);
                  }}
                >
                  <Trash2 size={14} aria-hidden="true" />
                </button>
              </div>
            </li>
          ))}
        </ol>
      ) : (
        <div className="empty-plan">
          <p>还没有计划。写下研究问题后，用模板生成一份五步计划，或请 Floatboat 模型起草；也可以逐步添加。</p>
        </div>
      )}

      <div className="add-step" role="group" aria-label="添加步骤">
        <span>添加步骤</span>
        {STEP_KINDS.map((k) => (
          <button key={k} disabled={!mutable || steps.length >= 12} onClick={() => d.addStep(k)}>
            + {kindLabels[k]}
          </button>
        ))}
      </div>

      <footer className="plan-confirm">
        {data.plan.confirmed ? (
          <p className="ok">
            <Check size={14} aria-hidden="true" /> 计划已于 {data.plan.confirmedAt ? new Date(data.plan.confirmedAt).toLocaleString("zh-CN") : "此前"} 确认。修改步骤定义后需要重新确认。
          </p>
        ) : problems.length ? (
          <ul className="problems">
            {problems.slice(0, 4).map((x) => (
              <li key={x}>{x}</li>
            ))}
          </ul>
        ) : (
          <p className="muted">检查每一步的检索词与网址，确认后进入执行。</p>
        )}
        {data.plan.confirmed ? (
          <button className="primary" onClick={() => d.setStage("execute")}>
            进入执行
          </button>
        ) : (
          <button className="primary" disabled={!mutable} onClick={d.confirmPlan}>
            <Check size={15} aria-hidden="true" />
            确认计划
          </button>
        )}
      </footer>
    </section>
  );
}
