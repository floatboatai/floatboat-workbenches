// ABOUTME: 第三阶段：报告纸面——Markdown 编辑与分栏预览、插入引用、引用检查、本地底稿与模型草稿、交付。
import { useRef, useState } from "react";
import { Bold, Check, Heading2, List, Quote, Sparkles, FileStack } from "lucide-react";
import { reportProblems } from "../contracts/research";
import { ReportMarkdown } from "./ReportMarkdown";
import { HostLine } from "./PlanStage";
import type { Desk } from "./useDesk";

type Mode = "split" | "edit" | "preview";

export function ReportStage({ d }: { d: Desk }) {
  const { p, mutable } = d;
  const data = p.data;
  const editor = useRef<HTMLTextAreaElement>(null);
  const stored = p.draft.reportMode;
  const mode: Mode = stored === "edit" || stored === "preview" ? stored : "split";
  const [cite, setCite] = useState("");
  const problems = reportProblems(data);
  const sorted = [...data.sources].sort((a, b) => a.cite - b.cite);

  /** Wrap or insert at the editor selection, then restore the caret after React re-renders. */
  function edit(before: string, after = "", line = false) {
    const el = editor.current;
    if (!el || !mutable) return;
    const { selectionStart: s, selectionEnd: e, value } = el;
    const start = line ? value.lastIndexOf("\n", s - 1) + 1 : s;
    const selected = value.slice(start, e);
    const next = value.slice(0, start) + before + selected + after + value.slice(e);
    d.change((x) => ({ ...x, report: next }));
    requestAnimationFrame(() => {
      el.focus();
      const caret = start + before.length + selected.length + after.length;
      el.setSelectionRange(caret, caret);
    });
  }
  function insertCite(n: number) {
    if (mode === "preview") p.setDraft((x) => ({ ...x, reportMode: "split" }));
    requestAnimationFrame(() => edit(`[${n}]`));
  }
  return (
    <section className="report-stage" aria-labelledby="report-title">
      <div className="report-head">
        <div>
          <h2 id="report-title">报告</h2>
          <span className={"stage-badge " + data.stage}>{data.stage === "ready" ? "可交付" : data.stage === "reviewing" ? "复核中" : "撰写中"}</span>
        </div>
        <div className="row">
          <button disabled={!mutable} onClick={d.compileDraft}>
            <FileStack size={14} aria-hidden="true" />
            汇编本地底稿
          </button>
          <button disabled={!mutable || d.host.llm !== "available" || d.hostBusy !== "" || !data.sources.length} onClick={() => void d.hostReport()}>
            <Sparkles size={14} aria-hidden="true" />
            {d.hostBusy === "report" ? "模型起草中…" : "用 Floatboat 模型起草"}
          </button>
          <button className="primary" disabled={!mutable || data.stage === "ready"} onClick={d.deliver}>
            <Check size={15} aria-hidden="true" />
            {data.stage === "ready" ? "已完成复核" : "完成复核"}
          </button>
        </div>
      </div>
      <HostLine d={d} />

      {d.reportDraft ? (
        <aside className="suggestion report-draft" aria-label="模型报告草稿">
          <header>
            <strong>模型草稿</strong>
            <small>
              {d.reportDraft.model} · 尚未采用 · 未经核对
            </small>
          </header>
          {d.reportDraft.unknown.length ? <p className="step-error">草稿引用了不存在的来源：{d.reportDraft.unknown.map((n) => `[${n}]`).join("、")}，采用后请改正。</p> : null}
          <div className="draft-preview">
            <ReportMarkdown text={d.reportDraft.text} sources={data.sources} onCite={d.jumpToCite} />
          </div>
          <div className="row">
            <button className="primary" disabled={!mutable} onClick={() => d.adoptReportDraft("replace")}>
              替换正文
            </button>
            <button disabled={!mutable} onClick={() => d.adoptReportDraft("append")}>
              追加到末尾
            </button>
            <button onClick={d.discardReportDraft}>放弃</button>
          </div>
        </aside>
      ) : null}

      <div className="editor-bar" role="toolbar" aria-label="报告编辑">
        <div className="segmented" role="group" aria-label="视图">
          {(["edit", "split", "preview"] as const).map((m) => (
            <button key={m} aria-pressed={mode === m} onClick={() => p.setDraft((x) => ({ ...x, reportMode: m }))}>
              {m === "edit" ? "编辑" : m === "split" ? "分栏" : "预览"}
            </button>
          ))}
        </div>
        {mode !== "preview" ? (
          <>
            <button className="icon" aria-label="二级标题" disabled={!mutable} onClick={() => edit("## ", "", true)}>
              <Heading2 size={15} aria-hidden="true" />
            </button>
            <button className="icon" aria-label="加粗" disabled={!mutable} onClick={() => edit("**", "**")}>
              <Bold size={15} aria-hidden="true" />
            </button>
            <button className="icon" aria-label="列表" disabled={!mutable} onClick={() => edit("- ", "", true)}>
              <List size={15} aria-hidden="true" />
            </button>
            <button className="icon" aria-label="引用块" disabled={!mutable} onClick={() => edit("> ", "", true)}>
              <Quote size={15} aria-hidden="true" />
            </button>
          </>
        ) : null}
        <label className="cite-insert">
          <span className="sr-only">插入引用</span>
          <select
            aria-label="插入引用"
            value={cite}
            disabled={!mutable || !sorted.length}
            onChange={(e) => {
              setCite("");
              if (e.target.value) insertCite(Number(e.target.value));
            }}
          >
            <option value="">插入引用…</option>
            {sorted.map((s) => (
              <option key={s.id} value={s.cite}>
                [{s.cite}] {s.title.slice(0, 40)}
              </option>
            ))}
          </select>
        </label>
        <span className="cite-check" role="status">
          {problems.cited.length} 个来源被引用
          {problems.dangling.length ? ` · 无对应来源 ${problems.dangling.map((n) => `[${n}]`).join("")}` : ""}
          {problems.uncheckedCited.length ? ` · 待核验 ${problems.uncheckedCited.map((n) => `[${n}]`).join("")}` : ""}
        </span>
      </div>

      <div className={"report-split " + mode}>
        {mode !== "preview" ? (
          <textarea
            ref={editor}
            className="report-editor"
            aria-label="报告正文（Markdown）"
            name="report"
            spellCheck={false}
            maxLength={200000}
            value={data.report}
            disabled={!mutable}
            placeholder="从结论写起，用 [编号] 标注依据；也可以先“汇编本地底稿”…"
            onChange={(e) => d.change((x) => ({ ...x, report: e.target.value }))}
          />
        ) : null}
        {mode !== "edit" ? (
          <article className="paper" aria-label="报告预览">
            {data.report.trim() ? <ReportMarkdown text={data.report} sources={data.sources} onCite={d.jumpToCite} /> : <p className="muted">报告还是空的。先汇编本地底稿，或直接开始写。</p>}
          </article>
        ) : null}
      </div>
    </section>
  );
}
