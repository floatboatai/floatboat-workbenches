import { useRef, useState } from "react";
import {
  PanelsTopLeft,
  Monitor,
  Tablet,
  Smartphone,
  Undo2,
  Redo2,
  FileDown,
  Plus,
  Code2,
  X,
} from "lucide-react";
import { useWorkbenchState } from "./autosave-client";
import { Notice, ProjectPicker, RenderBoundary } from "./workspace";
import { download } from "./requests";
import {
  validatePage,
  exportHtml,
  renderCss,
  MAX_BYTES,
} from "../contracts/page";
import { seed } from "../contracts/templates";
import { isRecord } from "../contracts/project";
import { PageEditor, type EditorHandle } from "./PageEditor";
export function App() {
  const p = useWorkbenchState(seed, validatePage, "日常设计 · 工作室主页", {
    storageKey: "grapesjs-page-v1",
  });
  const engine = useRef<EditorHandle | null>(null),
    file = useRef<HTMLInputElement>(null),
    sourceButton = useRef<HTMLButtonElement>(null);
  const [sourceOpen, setSourceOpen] = useState(false),
    [mobilePanel, setMobilePanel] = useState("canvas"),
    [device, setDevice] = useState(
      window.innerWidth < 700 ? "mobile" : "desktop",
    );
  const source = typeof p.draft.source === "string" ? p.draft.source : "";
  const draftPending =
    p.draft.source !== undefined ||
    (isRecord(p.draft.nativeInputs) &&
      Object.keys(p.draft.nativeInputs).length > 0);
  function take() {
    return engine.current?.capture() ?? validatePage(p.data);
  }
  function exportFile(kind: "html" | "css" | "json") {
    try {
      const data = take();
      download(
        new Blob(
          [
            kind === "html"
              ? exportHtml(data, p.title)
              : kind === "css"
                ? renderCss(data)
                : JSON.stringify(data),
          ],
          {
            type:
              kind === "html"
                ? "text/html"
                : kind === "css"
                  ? "text/css"
                  : "application/json",
          },
        ),
        `page.${kind}`,
      );
      p.setNotice(`已导出 ${kind.toUpperCase()}。`);
    } catch (error) {
      p.report(error);
    }
  }
  function showSource() {
    if (p.draft.source === undefined) {
      const data = take(),
        pretty = JSON.stringify(data, null, 2);
      const source =
        new TextEncoder().encode(JSON.stringify(pretty)).length <= 800000
          ? pretty
          : JSON.stringify(data);
      p.setDraft((extra) => ({ ...extra, source }));
    }
    setSourceOpen(true);
  }
  function editSource(value: string) {
    if (new TextEncoder().encode(JSON.stringify(value)).length > 800000) {
      p.setError(
        "源码草稿超出容量，当前已保存的输入仍保留。请减少内容后重试。",
      );
      return;
    }
    p.setDraft((extra) => ({ ...extra, source: value }));
  }
  function closeSource() {
    setSourceOpen(false);
    sourceButton.current?.focus();
  }
  async function importText(text: string) {
    try {
      if (new TextEncoder().encode(text).length > MAX_BYTES)
        throw new Error("导入文件不能超过 700 KB。");
      const data = validatePage(JSON.parse(text));
      if (await p.replace(data, "导入的页面")) {
        closeSource();
        p.setNotice("已作为新页面导入。");
      }
    } catch (error) {
      p.report(
        error instanceof SyntaxError
          ? new Error("项目 JSON 尚未完整，请检查括号与字段格式。")
          : error,
      );
    }
  }
  function setDeviceTo(value: string) {
    setDevice(value);
    engine.current?.editor.setDevice(
      value === "mobile" ? "手机" : value === "tablet" ? "平板" : "桌面",
    );
  }
  const status =
    draftPending && p.autoState.phase === "saved"
      ? p.draft.source !== undefined
        ? "工作副本已保存 · 源码尚未应用"
        : "工作副本已保存 · 含属性输入"
      : p.autoState.message;
  return (
    <main className={`builder panel-${mobilePanel}`}>
      <a href="#canvas" className="skip-link">
        跳转到画布
      </a>
      <header className="filebar">
        <div className="brand">
          <PanelsTopLeft size={20} aria-hidden="true" />
          <h1>
            GrapesJS<span>页面构建</span>
          </h1>
        </div>
        <input
          className="project-title"
          aria-label="页面名称"
          maxLength={120}
          value={p.title}
          onChange={(event) => p.setTitle(event.target.value)}
        />
        <span className={`save-state phase-${p.autoState.phase}`} role="status">
          ● {status}
        </span>
        <div className="file-actions">
          <button onClick={() => void p.fresh()} disabled={p.busy}>
            <Plus size={14} aria-hidden="true" />
            新建
          </button>
          <button className="primary" onClick={() => exportFile("html")}>
            <FileDown size={14} aria-hidden="true" />
            导出网页
          </button>
        </div>
      </header>
      <nav className="toolbar" aria-label="页面工具">
        <ProjectPicker
          items={p.items}
          id={p.current?.id}
          disabled={p.busy}
          onOpen={(id) => void p.open(id)}
        />
        <div className="history">
          <button
            aria-label="撤销"
            onClick={() => engine.current?.editor.UndoManager.undo()}
          >
            <Undo2 size={16} />
          </button>
          <button
            aria-label="重做"
            onClick={() => engine.current?.editor.UndoManager.redo()}
          >
            <Redo2 size={16} />
          </button>
        </div>
        <div className="devices">
          {[
            { id: "desktop", label: "桌面", Icon: Monitor },
            { id: "tablet", label: "平板", Icon: Tablet },
            { id: "mobile", label: "手机", Icon: Smartphone },
          ].map(({ id, label, Icon }) => (
            <button
              key={id}
              aria-label={`${label}预览`}
              aria-pressed={device === id}
              onClick={() => setDeviceTo(id)}
            >
              <Icon size={16} />
              <span>{label}</span>
            </button>
          ))}
        </div>
        <div className="source-actions">
          <button ref={sourceButton} onClick={showSource}>
            <Code2 size={15} aria-hidden="true" />
            项目源码
          </button>
          <button onClick={() => exportFile("json")}>导出项目</button>
          <button onClick={() => file.current?.click()}>导入</button>
          <input
            ref={file}
            type="file"
            aria-label="导入页面项目"
            accept=".json,application/json"
            hidden
            onChange={(event) => {
              const picked = event.target.files?.[0];
              event.target.value = "";
              if (picked) {
                if (picked.size > MAX_BYTES) {
                  p.setError("导入文件不能超过 700 KB。");
                  return;
                }
                void picked.text().then(importText).catch(p.report);
              }
            }}
          />
        </div>
      </nav>
      <Notice error={p.error} notice={p.notice} />
      {(p.autoState.phase === "offline" ||
        p.autoState.phase === "conflict" ||
        p.autoState.phase === "draft") && (
        <div className="recovery">
          <button onClick={() => void p.save()}>重试保存</button>
          <button onClick={p.exportDraft}>导出恢复副本</button>
          {p.current && (
            <button onClick={() => void p.open(p.current!.id)}>
              打开服务器版本
            </button>
          )}
        </div>
      )}
      <nav className="mobile-tabs" aria-label="编辑视图">
        {[
          ["canvas", "画布"],
          ["blocks", "组件与图层"],
          ["styles", "样式"],
        ].map(([id, label]) => (
          <button
            key={id}
            aria-pressed={mobilePanel === id}
            onClick={() => setMobilePanel(id)}
          >
            {label}
          </button>
        ))}
      </nav>
      <div className="workspace">
        <RenderBoundary>
          {p.loading ? (
            <div className="loading" role="status">
              正在打开页面…
            </div>
          ) : (
            <PageEditor
              key={p.documentKey}
              initial={p.data}
              draft={p.draft}
              onChange={p.setData}
              onDraft={(key, value) =>
                p.setDraft((extra) => ({ ...extra, [key]: value }))
              }
              onReady={(handle) => {
                engine.current = handle;
                handle?.editor.setDevice(
                  device === "mobile"
                    ? "手机"
                    : device === "tablet"
                      ? "平板"
                      : "桌面",
                );
              }}
              onError={p.report}
            />
          )}
        </RenderBoundary>
      </div>
      <footer className="statusbar">
        <span>双击文字编辑 · 拖动组件排版</span>
        <span>
          单页网站<span className="status-separator">/</span>
          <button onClick={() => exportFile("css")}>导出 CSS</button>
          <button onClick={p.exportDraft}>恢复副本</button>
        </span>
      </footer>
      {sourceOpen && (
        <section
          className="source-sheet"
          role="dialog"
          aria-modal="true"
          aria-label="项目源码"
          onKeyDown={(event) => {
            if (event.key === "Escape") closeSource();
            if (event.key === "Tab") {
              const focusable = Array.from(
                event.currentTarget.querySelectorAll<HTMLElement>(
                  "button,textarea",
                ),
              );
              const first = focusable[0],
                last = focusable.at(-1);
              if (event.shiftKey && document.activeElement === first) {
                event.preventDefault();
                last?.focus();
              } else if (!event.shiftKey && document.activeElement === last) {
                event.preventDefault();
                first?.focus();
              }
            }
          }}
        >
          <div className="source-header">
            <h2>项目源码</h2>
            <button aria-label="关闭源码" onClick={closeSource}>
              <X size={18} />
            </button>
          </div>
          <p>此处输入会保留为草稿。导入后将创建一个新页面。</p>
          <label htmlFor="source-json">页面 JSON</label>
          <textarea
            id="source-json"
            autoFocus
            spellCheck={false}
            maxLength={700000}
            value={source}
            onChange={(event) => editSource(event.target.value)}
          />
          <div className="source-footer">
            <button
              onClick={() => {
                p.setDraft((extra) => {
                  const next = { ...extra };
                  delete next.source;
                  return next;
                });
                closeSource();
              }}
            >
              丢弃源码草稿
            </button>
            <button className="primary" onClick={() => void importText(source)}>
              作为新页面导入
            </button>
          </div>
          {p.error && (
            <p role="alert" className="error">
              {p.error}
            </p>
          )}
        </section>
      )}
    </main>
  );
}
