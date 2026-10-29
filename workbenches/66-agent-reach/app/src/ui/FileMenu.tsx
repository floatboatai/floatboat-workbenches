// ABOUTME: 「调研」文件菜单：新建、示例、最近调研、导入导出、恢复稿、原生JSON与删除。

import { X } from "lucide-react";
import { Dialog } from "./Dialog.tsx";
import { RecoveryHistory } from "./RecoveryHistory.tsx";
import type { Desk } from "./useResearchDesk.ts";

const dateFormat = new Intl.DateTimeFormat("zh-CN", {
  month: "short",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

export function FileMenu({
  d,
  open,
  onClose,
}: {
  d: Desk;
  open: boolean;
  onClose: () => void;
}) {
  const { p, mutable } = d;
  const run = (task: () => unknown) => () => {
    onClose();
    void task();
  };
  return (
    <Dialog open={open} onClose={onClose} labelledBy="file-menu-title" className="file-menu">
      <header className="dialog-head">
        <div>
          <span className="eyebrow">AGENT-REACH</span>
          <h2 id="file-menu-title">调研</h2>
        </div>
        <button className="icon" aria-label="关闭调研菜单" onClick={onClose}>
          <X size={16} aria-hidden="true" />
        </button>
      </header>
      <div className="file-grid">
        <nav className="file-commands" aria-label="调研文件操作">
          <button className="strong" disabled={!mutable} onClick={run(d.newResearch)}>
            新调研
          </button>
          <button disabled={!mutable} onClick={run(d.openSample)}>
            打开示例调研
          </button>
          <button disabled={!mutable} onClick={run(() => d.file.current?.click())}>
            导入 JSON…
            <small>完整项目、恢复稿或 Agent-Reach 原生结果</small>
          </button>
          <hr />
          <button onClick={run(d.exportReport)}>导出 Markdown 报告</button>
          <button onClick={run(d.exportProject)}>
            导出完整项目
            <small>含原生结果、笔记与未完成输入</small>
          </button>
          <button onClick={run(() => d.setJsonOpen(true))}>编辑原生结果 JSON…</button>
          <hr />
          <button onClick={run(p.exportDraft)}>下载恢复稿</button>
          <button disabled={!mutable} onClick={run(() => p.save())}>
            立即保存
          </button>
          {p.current ? (
            <button className="danger" disabled={!mutable} onClick={run(p.remove)}>
              删除当前调研…
            </button>
          ) : null}
        </nav>
        <section className="recent" aria-labelledby="recent-title">
          <h3 id="recent-title">最近调研</h3>
          {p.items.length ? (
            <ul>
              {p.items.map((item) => (
                <li key={item.id}>
                  <button
                    aria-current={item.id === p.current?.id ? "true" : undefined}
                    disabled={!mutable}
                    onClick={run(() => p.open(item.id))}
                  >
                    <span>{item.title || "未命名调研"}</span>
                    <small>
                      {Number.isFinite(Date.parse(item.updatedAt))
                        ? dateFormat.format(new Date(item.updatedAt))
                        : ""}
                    </small>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="muted">编辑后，调研会自动保存在这里。当前显示的是示例调研。</p>
          )}
          <RecoveryHistory history={p.draft.importHistory} onExport={d.exportProject} />
        </section>
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
          <span className="eyebrow">SCHEMA_VERSION 1</span>
          <h2 id="json-title">原生结果工作稿</h2>
        </div>
        <button className="icon" aria-label="关闭原生结果工作稿" onClick={() => d.setJsonOpen(false)}>
          <X size={16} aria-hidden="true" />
        </button>
      </header>
      <label className="json-field">
        <span>Agent-Reach 结果信封（可粘贴其它渠道的原生结果）</span>
        <textarea
          id="result-json"
          name="resultJson"
          maxLength={500000}
          spellCheck={false}
          autoComplete="off"
          value={d.rawJson}
          onChange={(e) => p.setDraft((v) => ({ ...v, resultJson: e.target.value }))}
        />
      </label>
      <div className="dialog-actions">
        <span className="muted">未完成的编辑也会自动保存。</span>
        <button
          onClick={() =>
            p.setDraft((v) => {
              const n = { ...v };
              delete n.resultJson;
              return n;
            })
          }
        >
          还原为当前结果
        </button>
        <button className="primary" onClick={d.applyJson}>
          检查并放入收件区
        </button>
      </div>
    </Dialog>
  );
}
