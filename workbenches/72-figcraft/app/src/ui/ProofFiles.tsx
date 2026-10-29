// ABOUTME: “校样文件”对话框：打开/导入/示例/最近校样/下载/删除，以及按需的工程 JSON 草稿。
import { useEffect, useRef, useState } from "react";
import { FileUp, FolderInput, Sparkles, X, Trash2, Download, FileJson, Layers } from "lucide-react";
import type { ProjectSummary } from "../contracts/project";

interface Props {
  open: boolean;
  busy: boolean;
  items: ProjectSummary[];
  currentId?: string;
  title: string;
  error: string;
  json: string;
  jsonOpen: boolean;
  onClose: () => void;
  onOpen: (id: string) => void;
  onDesign: () => void;
  onProject: () => void;
  onSample: () => void;
  onDownloadDesign: () => void;
  onDownloadProject: () => void;
  onDelete: () => void;
  onJsonToggle: () => void;
  onJson: (value: string) => void;
  onJsonApply: () => void;
}
const when = (iso: string) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? ""
    : new Intl.DateTimeFormat("zh-CN", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }).format(d);
};

export function ProofFiles(p: Props) {
  const dialog = useRef<HTMLDialogElement>(null),
    opener = useRef<HTMLElement | null>(null);
  const [query, setQuery] = useState("");
  useEffect(() => {
    const el = dialog.current;
    if (!el) return;
    if (p.open && !el.open) {
      opener.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      setQuery("");
      el.showModal();
    } else if (!p.open && el.open) {
      el.close();
      opener.current?.focus();
    }
  }, [p.open]);
  const items = p.items.filter((item) => item.title.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()));
  return (
    <dialog
      className="files-dialog"
      ref={dialog}
      aria-labelledby="files-title"
      onCancel={(e) => {
        e.preventDefault();
        if (!p.busy) p.onClose();
      }}
      onClose={() => {
        if (p.open) p.onClose();
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget && !p.busy) p.onClose();
      }}
    >
      <div className="files-body">
        <header>
          <div>
            <span className="eyebrow">文件与工作稿</span>
            <h2 id="files-title">校样文件</h2>
          </div>
          <button type="button" className="icon-button" aria-label="关闭校样文件" disabled={p.busy} onClick={p.onClose}>
            <X size={18} />
          </button>
        </header>
        {p.error ? (
          <p className="files-error" role="alert">
            {p.error}
          </p>
        ) : null}
        <fieldset disabled={p.busy}>
          <legend className="sr-only">新建与导入</legend>
          <div className="files-create">
            <button type="button" className="primary" onClick={p.onDesign}>
              <FileUp size={16} aria-hidden="true" />
              打开 .figcraft
            </button>
            <button type="button" onClick={p.onProject}>
              <FolderInput size={16} aria-hidden="true" />
              导入工程或恢复稿
            </button>
            <button type="button" onClick={p.onSample}>
              <Sparkles size={16} aria-hidden="true" />
              示例副本 · Calm Studio
            </button>
          </div>
          <p className="files-hint">导入总是另建校样，不覆盖当前稿。原生文件上限 1.35 MB（单次保存容量）。</p>
          <label className="files-search">
            <span className="sr-only">搜索校样</span>
            <input
              type="search"
              name="proof-search"
              autoComplete="off"
              placeholder="搜索校样名称…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </label>
          <div className="files-list" role="list" aria-label="最近校样">
            {items.length ? (
              items.map((item) => (
                <div role="listitem" key={item.id}>
                  <button
                    type="button"
                    className="files-item"
                    aria-current={p.currentId === item.id ? "true" : undefined}
                    onClick={() => p.onOpen(item.id)}
                  >
                    <Layers size={18} aria-hidden="true" />
                    <span>
                      <b>{item.title}</b>
                      <small>
                        {item.id.startsWith("local:") ? "本机工作稿" : item.id.startsWith("draft:") ? "待完善草稿" : "校样"} ·{" "}
                        {when(item.updatedAt)}
                      </small>
                    </span>
                    <span className="files-tag">{p.currentId === item.id ? "当前" : "打开"}</span>
                  </button>
                </div>
              ))
            ) : (
              <p className="files-empty">{query ? "没有匹配的校样。" : "修改或导入后，校样会自动保存在这里。"}</p>
            )}
          </div>
          <div className="files-downloads">
            <button type="button" onClick={p.onDownloadDesign}>
              <Download size={15} aria-hidden="true" />
              设计文件 .figcraft
            </button>
            <button type="button" onClick={p.onDownloadProject}>
              <Download size={15} aria-hidden="true" />
              完整工程（含未应用草稿）
            </button>
            <button type="button" aria-expanded={p.jsonOpen} onClick={p.onJsonToggle}>
              <FileJson size={15} aria-hidden="true" />
              工程 JSON 草稿
            </button>
          </div>
          {p.jsonOpen ? (
            <div className="files-json">
              <label htmlFor="project-json">工程 JSON（未完成的修改会作为草稿自动保存）</label>
              <textarea id="project-json" name="project-json" autoComplete="off" spellCheck={false} value={p.json} onChange={(e) => p.onJson(e.target.value)} />
              <button type="button" onClick={p.onJsonApply}>
                作为新校样导入
              </button>
            </div>
          ) : null}
          <footer>
            <span>当前：{p.title || "未命名校样"}</span>
            <button type="button" className="danger-text" disabled={!p.currentId} onClick={p.onDelete}>
              <Trash2 size={14} aria-hidden="true" />
              删除当前校样…
            </button>
          </footer>
        </fieldset>
      </div>
    </dialog>
  );
}
