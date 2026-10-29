// ABOUTME: 「研究」文件菜单：新建、示例、最近研究、导入导出、恢复稿与项目 JSON 草稿。
import { X } from "lucide-react";
import { Dialog } from "./Dialog";
import type { Desk } from "./useDesk";

const dateFormat = new Intl.DateTimeFormat("zh-CN", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });

export function FileMenu({ d, open, onClose, onImport, onJson }: { d: Desk; open: boolean; onClose: () => void; onImport: () => void; onJson: () => void }) {
  const { p, mutable } = d;
  const run = (task: () => unknown) => () => {
    onClose();
    void task();
  };
  return (
    <Dialog open={open} onClose={onClose} labelledBy="file-menu-title" className="file-menu">
      <header className="dialog-head">
        <div>
          <span className="eyebrow">DEERFLOW · 研究台</span>
          <h2 id="file-menu-title">研究</h2>
        </div>
        <button className="icon" aria-label="关闭研究菜单" onClick={onClose}>
          <X size={16} aria-hidden="true" />
        </button>
      </header>
      <div className="file-grid">
        <nav className="file-commands" aria-label="研究文件操作">
          <button className="strong" disabled={!mutable} onClick={run(d.newResearch)}>
            新研究
          </button>
          <button disabled={!mutable} onClick={run(d.openSample)}>
            打开示例研究
            <small>已完成的 SQLite WAL 选型研究</small>
          </button>
          <button disabled={!mutable} onClick={run(onImport)}>
            导入 JSON…
            <small>完整项目、恢复稿或 DeerFlow 原生会话（≤8MB）</small>
          </button>
          <hr />
          <button onClick={run(d.exportMd)}>导出 Markdown 报告</button>
          <button onClick={run(d.exportHtml)}>导出 HTML 报告</button>
          <button onClick={run(p.exportDraft)}>
            导出完整项目
            <small>计划、来源、报告与未完成输入，可重新导入</small>
          </button>
          {p.data.native ? <button onClick={run(d.exportNative)}>导出 DeerFlow 原生快照</button> : null}
          <button onClick={run(onJson)}>编辑项目 JSON…</button>
          <hr />
          {p.current ? (
            <button className="danger" disabled={!mutable} onClick={run(p.remove)}>
              删除当前研究…
            </button>
          ) : null}
        </nav>
        <section className="recent" aria-labelledby="recent-title">
          <h3 id="recent-title">最近研究</h3>
          {p.items.length ? (
            <ul>
              {p.items.map((item) => (
                <li key={item.id}>
                  <button aria-current={item.id === p.current?.id ? "true" : undefined} disabled={!mutable} onClick={run(() => d.openProject(item.id))}>
                    <span>{item.title || "未命名研究"}</span>
                    <small>{Number.isFinite(Date.parse(item.updatedAt)) ? dateFormat.format(new Date(item.updatedAt)) : ""}</small>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="muted">编辑后研究会自动保存在这里。当前显示的是示例研究。</p>
          )}
        </section>
      </div>
    </Dialog>
  );
}

export function JsonDialog({ d, open, onClose }: { d: Desk; open: boolean; onClose: () => void }) {
  const { p } = d;
  const value =
    typeof p.draft.inputJson === "string" ? p.draft.inputJson : JSON.stringify({ snapshot: { title: p.title, data: p.data, extra: { ...p.draft, inputJson: undefined } } }, null, 2);
  return (
    <Dialog open={open} onClose={onClose} labelledBy="json-title" className="json-dialog">
      <header className="dialog-head">
        <div>
          <span className="eyebrow">PROJECT JSON</span>
          <h2 id="json-title">项目 JSON 草稿</h2>
        </div>
        <button className="icon" aria-label="关闭项目 JSON 草稿" onClick={onClose}>
          <X size={16} aria-hidden="true" />
        </button>
      </header>
      <label className="json-field">
        <span>可粘贴完整项目、恢复稿或 DeerFlow 原生会话；未应用的修改也会自动保存。</span>
        <textarea
          aria-label="项目 JSON 草稿"
          name="projectJson"
          spellCheck={false}
          autoComplete="off"
          value={value}
          onChange={(e) => p.setDraft((x) => ({ ...x, inputJson: e.target.value }))}
        />
      </label>
      <div className="dialog-actions">
        <button
          onClick={() =>
            p.setDraft((x) => {
              const n = { ...x };
              delete n.inputJson;
              return n;
            })
          }
        >
          还原为当前项目
        </button>
        <button
          className="primary"
          disabled={!d.mutable}
          onClick={() =>
            void d.importJson(value).then((ok) => {
              if (ok) onClose();
            })
          }
        >
          作为新研究导入
        </button>
      </div>
    </Dialog>
  );
}
