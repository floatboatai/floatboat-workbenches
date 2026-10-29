// ABOUTME: 「图谱」文件菜单与导出菜单：新建、示例、最近、导入、各种格式导出、恢复稿、删除；JSON 工作稿与模型命名确认。

import { X } from "lucide-react";
import { Dialog } from "./Dialog.tsx";
import { RecoveryHistory } from "./RecoveryHistory.tsx";
import type { Desk } from "./useGraphDesk.ts";

const dateFormat = new Intl.DateTimeFormat("zh-CN", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });

export function FileMenu({ d, open, onClose }: { d: Desk; open: boolean; onClose: () => void }) {
  const { p, mutable } = d;
  const run = (task: () => unknown) => () => {
    onClose();
    void task();
  };
  return (
    <Dialog open={open} onClose={onClose} labelledBy="file-menu-title" className="file-menu">
      <header className="dialog-head">
        <div>
          <span className="eyebrow">GRAPHIFY</span>
          <h2 id="file-menu-title">图谱</h2>
        </div>
        <button className="icon" aria-label="关闭图谱菜单" onClick={onClose}>
          <X size={16} aria-hidden="true" />
        </button>
      </header>
      <div className="file-grid">
        <nav className="file-commands" aria-label="图谱文件操作">
          <button className="strong" disabled={!mutable} onClick={run(d.newMap)}>
            新建知识地图
            <small>从文件夹、多份文件或粘贴的文字开始</small>
          </button>
          <button disabled={!mutable} onClick={run(d.openSample)}>
            打开示例资料集
            <small>门店补货助手 · 17 份代码、文档与纪要</small>
          </button>
          <button disabled={!mutable} onClick={run(() => d.file.current?.click())}>
            导入 JSON…
            <small>Graphify graph.json、完整项目或恢复稿</small>
          </button>
          <hr />
          <button disabled={!d.graph} onClick={run(d.exportProject)}>
            导出完整项目
            <small>含原文、图谱、笔记与未完成输入</small>
          </button>
          <button disabled={!d.graph || d.graphJsonTooLarge} onClick={run(() => d.setJsonOpen(true))}>
            编辑 graph.json…
            {d.graphJsonTooLarge ? <small>图谱较大，请导出后编辑再导入</small> : null}
          </button>
          <hr />
          <button onClick={run(p.exportDraft)}>下载恢复稿</button>
          <button disabled={!mutable} onClick={run(() => p.save())}>
            立即保存
          </button>
          {p.current ? (
            <button className="danger" disabled={!mutable} onClick={run(p.remove)}>
              删除当前知识地图…
            </button>
          ) : null}
        </nav>
        <section className="recent" aria-labelledby="recent-title">
          <h3 id="recent-title">最近的知识地图</h3>
          {p.items.length ? (
            <ul>
              {p.items.map((item) => (
                <li key={item.id}>
                  <button aria-current={item.id === p.current?.id ? "true" : undefined} disabled={!mutable} onClick={run(() => p.open(item.id))}>
                    <span>{item.title || "未命名知识地图"}</span>
                    <small>{Number.isFinite(Date.parse(item.updatedAt)) ? dateFormat.format(new Date(item.updatedAt)) : ""}</small>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="muted">编辑或抽取后，知识地图会自动保存在这里。当前显示的是示例资料集。</p>
          )}
          <RecoveryHistory history={p.draft.importHistory} onExport={d.exportProject} />
        </section>
      </div>
    </Dialog>
  );
}

export function ExportMenu({ d, open, onClose }: { d: Desk; open: boolean; onClose: () => void }) {
  const go = (kind: "json" | "graphml" | "html" | "md") => () => {
    onClose();
    d.exportAs(kind);
  };
  return (
    <Dialog open={open} onClose={onClose} labelledBy="export-title" className="export-menu">
      <header className="dialog-head">
        <div>
          <span className="eyebrow">{d.shown.nodes.length} 个节点 · {d.shown.links.length} 条关系</span>
          <h2 id="export-title">导出图谱</h2>
        </div>
        <button className="icon" aria-label="关闭导出菜单" onClick={onClose}>
          <X size={16} aria-hidden="true" />
        </button>
      </header>
      <div className="export-list">
        <button className="strong" onClick={go("html")}>
          HTML 报告
          <small>当前布局的交互地图、社区、核心节点与意外关联；单个文件，离线可看</small>
        </button>
        <button onClick={go("json")}>
          graph.json
          <small>Graphify 原生 node-link，含社区编号与名称</small>
        </button>
        <button onClick={go("graphml")}>
          GraphML
          <small>Gephi、yEd、Cytoscape 可直接打开</small>
        </button>
        <button onClick={go("md")}>
          GRAPH_REPORT.md
          <small>Markdown 版报告，便于放进仓库或交给 Agent</small>
        </button>
      </div>
    </Dialog>
  );
}

export function JsonDialog({ d }: { d: Desk }) {
  const { p } = d;
  return (
    <Dialog open={d.jsonOpen} onClose={() => d.setJsonOpen(false)} labelledBy="json-title" className="json-dialog">
      <header className="dialog-head">
        <div>
          <span className="eyebrow">NODE-LINK</span>
          <h2 id="json-title">graph.json 工作稿</h2>
        </div>
        <button className="icon" aria-label="关闭 graph.json 工作稿" onClick={() => d.setJsonOpen(false)}>
          <X size={16} aria-hidden="true" />
        </button>
      </header>
      <label className="json-field">
        <span>可直接修改节点、关系与任意额外字段；未应用的编辑也会自动保存</span>
        <textarea
          id="graph-json"
          name="graphJson"
          spellCheck={false}
          autoComplete="off"
          value={d.rawJson}
          onChange={(e) => p.setDraft((v) => ({ ...v, graphJson: e.target.value }))}
        />
      </label>
      <div className="dialog-actions">
        <button
          onClick={() =>
            p.setDraft((v) => {
              const n = { ...v };
              delete n.graphJson;
              return n;
            })
          }
        >
          还原为当前图谱
        </button>
        <button
          className="primary"
          disabled={d.applyingJson || !d.mutable}
          onClick={async () => {
            if (await d.applyJson()) d.setJsonOpen(false);
          }}
        >
          {d.applyingJson ? "正在应用…" : "检查并应用"}
        </button>
      </div>
    </Dialog>
  );
}

export function HostDialog({ d, open, onClose }: { d: Desk; open: boolean; onClose: () => void }) {
  const eligible = d.communities.filter((c) => c.size >= 2).slice(0, 40);
  return (
    <Dialog open={open} onClose={onClose} labelledBy="host-title" className="host-dialog">
      <header className="dialog-head">
        <div>
          <span className="eyebrow">可选 · FLOATBOAT 模型</span>
          <h2 id="host-title">为社区命名</h2>
        </div>
        <button className="icon" aria-label="关闭社区命名" onClick={onClose}>
          <X size={16} aria-hidden="true" />
        </button>
      </header>
      <p>
        将发送 {eligible.length} 个社区中每个最多 12 个代表节点的<strong>名称、类型、所在文件和一句摘要</strong>，不发送原文全文。结果只替换自动名称，人工改过的名称保持不变。
      </p>
      <p className={`host-state ${d.host.llm}`} role="status">
        {d.host.message}
      </p>
      <div className="dialog-actions">
        <button onClick={() => void d.checkHost()}>重新检查</button>
        <button
          className="primary"
          disabled={d.host.llm !== "available" || d.naming || !eligible.length}
          onClick={async () => {
            if (await d.nameWithHost()) onClose();
          }}
        >
          {d.naming ? "正在命名…" : "发送并命名"}
        </button>
      </div>
    </Dialog>
  );
}
