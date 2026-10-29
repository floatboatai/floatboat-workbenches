// ABOUTME: 资料桌外壳：文件条、左目录（采集+收件区+来源）、中原文、右摘录夹；窄屏三段切换。

import { useState } from "react";
import { Menu, Download } from "lucide-react";
import { useResearchDesk, type View } from "./useResearchDesk.ts";
import { Notice } from "./workspace.tsx";
import { Collector, Inbox } from "./Collector.tsx";
import { SourceList } from "./SourceList.tsx";
import { Reader } from "./Reader.tsx";
import { Folder } from "./Folder.tsx";
import { FileMenu, JsonDialog } from "./FileMenu.tsx";

const VIEWS: Array<[View, string]> = [
  ["list", "目录"],
  ["read", "原文"],
  ["folder", "摘录夹"],
];

export function App() {
  const d = useResearchDesk(),
    { p, mutable } = d;
  const [menu, setMenu] = useState(false);
  if (p.loading)
    return (
      <main className="loading" role="status">
        正在恢复调研资料…
      </main>
    );
  const attention = ["offline", "conflict", "draft"].includes(p.autoState.phase);
  return (
    <div className="desk" data-view={d.view}>
      <a className="skip" href="#reader-title">
        跳到原文
      </a>
      <header className="filebar">
        <button className="menu-button" aria-haspopup="dialog" aria-expanded={menu} onClick={() => setMenu(true)}>
          <Menu size={16} aria-hidden="true" />
          调研
        </button>
        <label className="title-field">
          <span className="sr-only">调研名称</span>
          <input
            name="title"
            autoComplete="off"
            value={p.title}
            maxLength={120}
            disabled={!mutable}
            onChange={(e) => p.setTitle(e.target.value)}
          />
        </label>
        <span role="status" className={`save-state ${p.autoState.phase}`}>
          {p.autoState.message}
        </span>
        {attention ? (
          <span className="save-actions">
            <button onClick={() => void p.save()}>重试保存</button>
            <button onClick={p.exportDraft}>下载恢复稿</button>
            {p.current ? <button onClick={() => void p.open(p.current!.id)}>读取服务器版本</button> : null}
          </span>
        ) : null}
        <span className="spacer" />
        <button className="export" onClick={d.exportReport} disabled={!p.data.sources.length && !p.data.brief.trim()}>
          <Download size={15} aria-hidden="true" />
          导出报告
        </button>
      </header>
      <input
        ref={d.file}
        type="file"
        accept=".json,application/json"
        hidden
        aria-label="导入调研项目或 Agent-Reach 原生结果"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void d.importFile(f);
          e.target.value = "";
        }}
      />
      <nav className="view-switch" aria-label="切换视图">
        {VIEWS.map(([v, label]) => (
          <button key={v} aria-pressed={d.view === v} onClick={() => d.setView(v)}>
            {label}
            {v === "list" ? <span>{p.data.sources.length}</span> : null}
            {v === "folder" && d.selected ? <span>{d.selected.clips.length}</span> : null}
          </button>
        ))}
      </nav>
      <Notice error={p.error} notice={p.notice} />
      <fieldset className="workspace" disabled={!mutable} inert={!mutable}>
        <div className="pane pane-list">
          <Collector d={d} />
          <Inbox d={d} />
          <SourceList d={d} />
        </div>
        <main className="pane pane-read" id="research-main">
          <Reader d={d} />
        </main>
        <div className="pane pane-folder">
          <Folder d={d} />
        </div>
      </fieldset>
      <FileMenu d={d} open={menu} onClose={() => setMenu(false)} />
      <JsonDialog d={d} />
    </div>
  );
}
