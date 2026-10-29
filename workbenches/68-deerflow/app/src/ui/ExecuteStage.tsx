// ABOUTME: 第二阶段：按已确认计划执行——本地逐步检索与记录发现，或交给 DeerFlow 服务；含原生会话档案。
import { useEffect, useState } from "react";
import { Play, Square, RotateCcw, Check, Plus, FileText } from "lucide-react";
import { kindLabels, nativeValue } from "../contracts/research";
import { urlLines } from "../contracts/plan";
import { request } from "./workspace";
import { isRecord } from "../contracts/project";
import { DeerFlowPanel } from "./DeerFlowPanel";
import type { Desk } from "./useDesk";

const statusLabels = { todo: "待执行", running: "检索中", done: "已完成", failed: "失败" } as const;

function RetrievalLine() {
  const [message, setMessage] = useState("检索在本机 Node 内运行。");
  useEffect(() => {
    let live = true;
    request("/api/retrieval/status")
      .then((v) => {
        if (live && isRecord(v) && typeof v.message === "string") setMessage(v.message + (v.proxy === "environment" ? " 已使用系统代理。" : ""));
      })
      .catch(() => live && setMessage("无法读取检索状态；执行时会逐步报告错误。"));
    return () => {
      live = false;
    };
  }, []);
  return <p className="muted run-note">{message}</p>;
}

function NativeArchive({ d }: { d: Desk }) {
  const native = d.p.data.native;
  if (!native) return null;
  let view;
  try {
    view = nativeValue(native).view;
  } catch {
    return null;
  }
  const visible = view.messages.filter((m) => !m.hidden);
  return (
    <details className="native-archive">
      <summary>
        <FileText size={14} aria-hidden="true" /> DeerFlow 会话档案 · {visible.length} 条可见消息 · {view.todos.length} 项任务 · {view.artifacts.length} 个产物
        {view.compacted ? " · 已压缩长内容" : ""}
      </summary>
      <div className="row">
        <button className="primary" disabled={!d.mutable} onClick={d.adoptNativeReport}>
          采用最新答复为报告
        </button>
        <button onClick={d.exportNative}>导出原生快照</button>
      </div>
      {view.todos.length ? (
        <ul className="native-todos">
          {view.todos.map((t, i) => (
            <li key={i} className={t.status}>
              {t.status === "completed" ? "✓" : "·"} {t.content}
            </li>
          ))}
        </ul>
      ) : null}
      {visible.map((m, i) => (
        <details key={m.id + i} className="native-message">
          <summary>
            <span>{["human", "user"].includes(m.role) ? "研究要求" : m.role === "tool" ? "工具返回" : ["ai", "assistant"].includes(m.role) ? "助手" : "其他"}</span>
            {m.name || m.text.slice(0, 80) || "结构化消息"}
          </summary>
          <pre>{m.text}</pre>
        </details>
      ))}
      {view.artifacts.length ? (
        <p className="muted">
          产物路径：{view.artifacts.join("、")}（原件请从 DeerFlow 导出）
        </p>
      ) : null}
    </details>
  );
}

export function ExecuteStage({ d }: { d: Desk }) {
  const { p, mutable } = d;
  const data = p.data,
    steps = data.plan.steps;
  const channel = p.draft.channel === "deerflow" ? "deerflow" : "local";
  const pending = steps.filter((s) => s.kind !== "analyze" && s.status !== "done").length;
  const done = steps.filter((s) => s.status === "done").length;
  return (
    <section className="execute-stage" aria-labelledby="execute-title">
      <div className="execute-head">
        <div>
          <h2 id="execute-title">执行研究</h2>
          <p className="muted">
            {done}/{steps.length} 步完成 · {data.sources.length} 项来源
          </p>
        </div>
        <div className="segmented" role="group" aria-label="执行方式">
          <button aria-pressed={channel === "local"} onClick={() => p.setDraft((x) => ({ ...x, channel: "local" }))}>
            本地检索
          </button>
          <button aria-pressed={channel === "deerflow"} onClick={() => p.setDraft((x) => ({ ...x, channel: "deerflow" }))}>
            DeerFlow 服务
          </button>
        </div>
      </div>
      {!data.plan.confirmed ? (
        <div className="gate" role="status">
          <p>计划尚未确认。确认后才能执行检索或提交到 DeerFlow，避免按未经审阅的计划消耗配额。</p>
          <button className="primary" onClick={() => d.setStage("plan")}>
            回到计划确认
          </button>
        </div>
      ) : null}

      {channel === "deerflow" ? (
        <DeerFlowPanel d={d} />
      ) : (
        <>
          <div className="run-bar">
            <RetrievalLine />
            {d.running ? (
              <button onClick={d.stop}>
                <Square size={14} aria-hidden="true" />
                停止
              </button>
            ) : (
              <button className="primary" disabled={!mutable || !data.plan.confirmed || !pending} onClick={() => void d.runAll()}>
                <Play size={14} aria-hidden="true" />
                {pending ? `执行 ${pending} 个检索步骤` : "检索步骤均已完成"}
              </button>
            )}
          </div>
          <ol className="run-steps">
            {steps.map((s, i) => {
              const own = data.sources.filter((x) => x.stepId === s.id).sort((a, b) => a.cite - b.cite);
              const detail = s.kind === "read" ? urlLines(s.urls).join("  ") : s.query;
              return (
                <li key={s.id} className={"run-step " + s.status} aria-busy={s.status === "running"}>
                  <header>
                    <span className="step-no">{String(i + 1).padStart(2, "0")}</span>
                    <div>
                      <strong>{s.title}</strong>
                      <small>
                        {kindLabels[s.kind]}
                        {detail ? " · " + detail : ""}
                      </small>
                    </div>
                    <span className={"chip " + s.status}>{statusLabels[s.status]}</span>
                  </header>
                  {s.error ? (
                    <p className="step-error" role="status">
                      {s.error}
                    </p>
                  ) : null}
                  {d.lastRuns[s.id] && !s.error ? <p className="muted">{d.lastRuns[s.id][0]}</p> : null}
                  {own.length ? (
                    <ul className="cite-row" aria-label="本步来源">
                      {own.map((x) => (
                        <li key={x.id}>
                          <button className={"cite-chip" + (x.checked ? " checked" : "")} onClick={() => d.jumpToCite(x.cite)} title={x.title}>
                            [{x.cite}] {x.title.slice(0, 42)}
                          </button>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                  <label className="findings">
                    <span>本步发现</span>
                    <textarea
                      name={"findings-" + i}
                      rows={s.findings ? 3 : 2}
                      maxLength={20000}
                      placeholder="记录这一步得出的事实、分歧与待核实点；写报告时会用到…"
                      value={s.findings}
                      disabled={!mutable}
                      onChange={(e) => d.patchStep(s.id, { findings: e.target.value })}
                    />
                  </label>
                  <div className="row">
                    {s.kind === "analyze" ? (
                      s.status === "done" ? (
                        <button disabled={!mutable} onClick={() => d.patchStep(s.id, { status: "todo" })}>
                          <RotateCcw size={13} aria-hidden="true" />
                          重新打开
                        </button>
                      ) : (
                        <button disabled={!mutable || !s.findings.trim() || !data.plan.confirmed} onClick={() => d.patchStep(s.id, { status: "done", ranAt: new Date().toISOString() })}>
                          <Check size={13} aria-hidden="true" />
                          标记完成
                        </button>
                      )
                    ) : (
                      <button disabled={!mutable || Boolean(d.running) || !data.plan.confirmed} onClick={() => void d.runSteps([s.id])}>
                        {s.status === "done" || s.status === "failed" ? <RotateCcw size={13} aria-hidden="true" /> : <Play size={13} aria-hidden="true" />}
                        {s.status === "done" ? "重新执行" : s.status === "failed" ? "重试本步" : "执行本步"}
                      </button>
                    )}
                    <button disabled={!mutable} onClick={() => d.addSource(s.id)}>
                      <Plus size={13} aria-hidden="true" />
                      手动添加来源
                    </button>
                    {s.kind === "analyze" && !s.findings.trim() && s.status !== "done" ? <small className="muted">写下发现后可标记完成</small> : null}
                  </div>
                </li>
              );
            })}
          </ol>
          <div className="row end">
            <button className="primary" onClick={() => d.setStage("report")}>
              进入撰写报告
            </button>
          </div>
        </>
      )}
      <NativeArchive d={d} />
    </section>
  );
}
