// ABOUTME: 研究台外壳：研究菜单、标题、三阶段进度与保存状态；阶段工作区与来源证据栏并排。
import { useEffect, useRef, useState } from "react";
import { ArrowDownToLine, ChevronDown, Menu } from "lucide-react";
import { Notice } from "./workspace";
import { useDesk, type Stage } from "./useDesk";
import { FileMenu, JsonDialog } from "./FileMenu";
import { PlanStage } from "./PlanStage";
import { ExecuteStage } from "./ExecuteStage";
import { ReportStage } from "./ReportStage";
import { SourcesPanel } from "./SourcesPanel";
import { reportProblems } from "../contracts/research";

function ExportMenu({ onMd, onHtml }: { onMd: () => void; onHtml: () => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);
  return (
    <div
      className="export-menu"
      ref={ref}
      onKeyDown={(e) => {
        if (e.key === "Escape" && open) {
          setOpen(false);
          ref.current?.querySelector<HTMLButtonElement>("button")?.focus();
        }
      }}
    >
      <button className="primary" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen(!open)}>
        <ArrowDownToLine size={15} aria-hidden="true" />
        导出报告
        <ChevronDown size={13} aria-hidden="true" />
      </button>
      {open ? (
        <div role="menu" className="menu-popover">
          <button
            role="menuitem"
            autoFocus
            onClick={() => {
              setOpen(false);
              onMd();
            }}
          >
            Markdown（.md）<small>正文 + 参考来源列表</small>
          </button>
          <button
            role="menuitem"
            onClick={() => {
              setOpen(false);
              onHtml();
            }}
          >
            HTML（.html）<small>独立网页，引用可点击跳转</small>
          </button>
        </div>
      ) : null}
    </div>
  );
}

export function App() {
  const d = useDesk();
  const { p } = d;
  const data = p.data;
  const [menu, setMenu] = useState(false);
  const [json, setJson] = useState(false);
  const [pane, setPane] = useState<"work" | "sources">("work");
  const file = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (d.focusCite) setPane("sources");
  }, [d.focusCite]);
  const steps = data.plan.steps;
  const done = steps.filter((s) => s.status === "done").length;
  const problems = reportProblems(data);
  const stages: { id: Stage; label: string; status: string }[] = [
    { id: "plan", label: "问题与计划", status: data.plan.confirmed ? "已确认" : steps.length ? "待确认" : "未开始" },
    { id: "execute", label: "执行研究", status: steps.length ? `${done}/${steps.length} 步` : "—" },
    {
      id: "report",
      label: "撰写报告",
      status: data.stage === "ready" ? "可交付" : data.report.trim() ? (problems.dangling.length ? "引用待修正" : "复核中") : "未开始",
    },
  ];
  const savePhase = p.autoState.phase;
  return (
    <div className="desk">
      <a className="skip" href="#workspace">
        跳到工作区
      </a>
      <header className="topbar">
        <button className="file-button" aria-haspopup="dialog" onClick={() => setMenu(true)}>
          <Menu size={15} aria-hidden="true" />
          研究
        </button>
        <input className="doc-title" aria-label="研究名称" name="title" autoComplete="off" maxLength={120} value={p.title} disabled={!d.mutable} onChange={(e) => p.setTitle(e.target.value)} />
        <nav className="stages" aria-label="研究阶段">
          {stages.map((s, i) => (
            <button key={s.id} aria-current={d.stage === s.id ? "step" : undefined} onClick={() => d.setStage(s.id)}>
              <span className="n">{i + 1}</span>
              <span className="label">{s.label}</span>
              <small>{s.status}</small>
            </button>
          ))}
        </nav>
        <div className="save-area">
          <span className={"save-state " + savePhase} role="status">
            {p.autoState.message}
          </span>
          {["offline", "draft", "conflict"].includes(savePhase) ? (
            <span className="save-actions">
              <button className="link" disabled={!d.mutable} onClick={() => void p.save()}>
                重试保存
              </button>
              <button className="link" onClick={p.exportDraft}>
                导出恢复稿
              </button>
              {p.current && savePhase === "conflict" ? (
                <button className="link" disabled={!d.mutable} onClick={() => void d.openProject(p.current!.id)}>
                  打开服务器版本
                </button>
              ) : null}
            </span>
          ) : null}
        </div>
        <ExportMenu onMd={d.exportMd} onHtml={() => void d.exportHtml()} />
      </header>
      <Notice error={p.error} notice={p.notice} />
      <div className="pane-switch segmented" role="group" aria-label="窄屏视图">
        <button aria-pressed={pane === "work"} onClick={() => setPane("work")}>
          工作区
        </button>
        <button aria-pressed={pane === "sources"} onClick={() => setPane("sources")}>
          来源 {data.sources.length}
        </button>
      </div>
      <div className={"workspace pane-" + pane} id="workspace">
        <main className="stage-area">
          {d.stage === "plan" ? <PlanStage d={d} /> : d.stage === "execute" ? <ExecuteStage d={d} /> : <ReportStage d={d} />}
        </main>
        <SourcesPanel d={d} />
      </div>
      <FileMenu d={d} open={menu} onClose={() => setMenu(false)} onImport={() => file.current?.click()} onJson={() => setJson(true)} />
      <JsonDialog d={d} open={json} onClose={() => setJson(false)} />
      <input
        hidden
        ref={file}
        type="file"
        accept=".json,application/json"
        aria-label="导入研究文件"
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (f) void d.importFile(f);
        }}
      />
    </div>
  );
}
