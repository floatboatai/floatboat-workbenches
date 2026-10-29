// ABOUTME: 图形文件菜单、模板库、Markdown 多图选择与导出面板。
import {
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from "react";
import type { ProjectSummary } from "../contracts/project";
import { templates, type DiagramTemplate } from "../contracts/templates";
import { renderDiagram } from "./engine";
import type { ImportCandidate } from "./files";

export function Modal({
  open,
  onClose,
  title,
  eyebrow,
  className = "",
  fallbackFocus,
  children,
}: {
  fallbackFocus?: RefObject<HTMLElement | null>;
  open: boolean;
  onClose: () => void;
  title: string;
  eyebrow?: string;
  className?: string;
  children: ReactNode;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const id = useId();
  const opener = useRef<HTMLElement | null>(null);
  useEffect(() => {
    const element = dialog.current;
    if (!element) return;
    if (open && !element.open) {
      if (
        document.activeElement instanceof HTMLElement &&
        document.activeElement !== document.body &&
        !element.contains(document.activeElement)
      )
        opener.current = document.activeElement;
      element.showModal();
    } else if (!open && element.open) {
      element.close();
      // 关闭后把焦点还给打开它的按钮（若该按钮仍在页面上）。
      const target = opener.current;
      opener.current = null;
      requestAnimationFrame(() =>
        (target?.isConnected ? target : fallbackFocus?.current)?.focus(),
      );
    }
  }, [open, fallbackFocus]);
  return (
    <dialog
      ref={dialog}
      className={"sheet " + className}
      aria-labelledby={id}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => {
        if (event.target === dialog.current) onClose();
      }}
    >
      {open ? (
        <div className="sheet-body">
          <header className="sheet-head">
            <div>
              {eyebrow ? <span className="eyebrow">{eyebrow}</span> : null}
              <h2 id={id}>{title}</h2>
            </div>
            <button
              type="button"
              className="icon-button"
              aria-label={"关闭" + title}
              onClick={onClose}
            >
              ×
            </button>
          </header>
          {children}
        </div>
      ) : null}
    </dialog>
  );
}

const dateFormat = new Intl.DateTimeFormat("zh-CN", {
  month: "numeric",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});
const when = (value: string) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : dateFormat.format(date);
};

export function FileMenu({
  items,
  currentId,
  title,
  locked,
  onNew,
  onTemplates,
  onImport,
  onOpen,
  onDownloadSource,
  onRecoveryDownload,
  onRecoveryImport,
  onRefresh,
  onRemove,
}: {
  items: ProjectSummary[];
  currentId?: string;
  title: string;
  locked: boolean;
  onNew: () => void;
  onTemplates: () => void;
  onImport: () => void;
  onOpen: (id: string) => void;
  onDownloadSource: () => void;
  onRecoveryDownload: () => void;
  onRecoveryImport: () => void;
  onRefresh: () => void;
  onRemove: () => void;
}) {
  return (
    <div className="file-menu">
      <section aria-labelledby="file-new">
        <h3 id="file-new">新建</h3>
        <div className="file-actions">
          <button
            type="button"
            className="primary"
            disabled={locked}
            onClick={onNew}
          >
            空白图形
          </button>
          <button type="button" disabled={locked} onClick={onTemplates}>
            从模板新建…
          </button>
          <button type="button" disabled={locked} onClick={onImport}>
            导入 .mmd / .md…
          </button>
        </div>
        <p className="hint">
          Markdown 文件会提取其中的 mermaid
          代码块；导入总是另建新图形，不覆盖当前文件。
        </p>
      </section>
      <section aria-labelledby="file-recent">
        <div className="section-row">
          <h3 id="file-recent">最近图形</h3>
          <button type="button" className="link-button" onClick={onRefresh}>
            刷新
          </button>
        </div>
        {items.length ? (
          <ul className="recent-list">
            {items.map((item) => {
              const local = item.id.startsWith("local:"),
                draft = item.id.startsWith("draft:");
              return (
                <li key={item.id}>
                  <button
                    type="button"
                    disabled={locked}
                    aria-current={item.id === currentId ? "true" : undefined}
                    onClick={() => onOpen(item.id)}
                  >
                    <span className="recent-title">
                      {local
                        ? item.title.replace(/^本机草稿 · /, "")
                        : item.title}
                    </span>
                    <span className="recent-meta">
                      {local ? "本机草稿 · " : draft ? "待完善草稿 · " : ""}
                      {when(item.updatedAt)}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="hint">
            还没有保存过的图形。编辑当前图形后会自动保存到这里。
          </p>
        )}
      </section>
      <section aria-labelledby="file-current">
        <h3 id="file-current">当前图形 · {title || "未命名"}</h3>
        <div className="file-actions">
          <button type="button" onClick={onDownloadSource}>
            下载源码 .mmd
          </button>
          <button type="button" onClick={onRecoveryDownload}>
            下载恢复稿
          </button>
          <button type="button" disabled={locked} onClick={onRecoveryImport}>
            导入恢复稿…
          </button>
          <button
            type="button"
            className="danger"
            disabled={locked || !currentId || currentId.startsWith("local:")}
            onClick={onRemove}
          >
            删除图形
          </button>
        </div>
      </section>
    </div>
  );
}

const thumbnails = new Map<string, string>();
function Thumbnail({ template }: { template: DiagramTemplate }) {
  const [src, setSrc] = useState(() => thumbnails.get(template.id) ?? "");
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    if (thumbnails.has(template.id)) return;
    let live = true;
    void renderDiagram(template.source, {
      theme: "neutral",
      look: "classic",
    }).then((result) => {
      if (!result.ok) {
        if (live) setFailed(true);
        return;
      }
      const url =
        "data:image/svg+xml;charset=utf-8," + encodeURIComponent(result.svg);
      thumbnails.set(template.id, url);
      if (live) setSrc(url);
    });
    return () => {
      live = false;
    };
  }, [template]);
  return (
    <div className="thumb" aria-hidden="true">
      {src ? (
        <img src={src} alt="" width={240} height={150} loading="lazy" />
      ) : (
        <span>{failed ? "无法预览" : "正在绘制…"}</span>
      )}
    </div>
  );
}

export function TemplateGallery({
  onPick,
  locked,
}: {
  onPick: (template: DiagramTemplate) => void;
  locked: boolean;
}) {
  return (
    <ul className="template-grid">
      {templates.map((template) => (
        <li key={template.id}>
          <button
            type="button"
            className="template-card"
            disabled={locked}
            onClick={() => onPick(template)}
          >
            <Thumbnail template={template} />
            <span className="template-kind">{template.kind}</span>
            <strong>{template.title}</strong>
            <span className="template-desc">{template.description}</span>
          </button>
        </li>
      ))}
    </ul>
  );
}

export function BlockChooser({
  candidates,
  onPick,
}: {
  candidates: ImportCandidate[];
  onPick: (candidate: ImportCandidate) => void;
}) {
  return (
    <div className="block-chooser">
      <p className="hint">
        文件中有 {candidates.length} 个 mermaid
        代码块。选择一个作为新图形导入，可以多次导入。
      </p>
      <ul>
        {candidates.map((candidate, index) => (
          <li key={index}>
            <button type="button" onClick={() => onPick(candidate)}>
              <strong>{candidate.title}</strong>
              <span>
                {candidate.line ? `第 ${candidate.line} 行 · ` : ""}
                {candidate.source.split("\n")[0].slice(0, 60)}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

export type Scale = 1 | 2 | 4;
export function ExportPanel({
  ready,
  reason,
  scale,
  transparent,
  onScale,
  onTransparent,
  onPng,
  onCopyPng,
  onSvg,
  onCopySvg,
  onSource,
  onCopyMarkdown,
  busy,
}: {
  ready: boolean;
  reason: string;
  scale: Scale;
  transparent: boolean;
  onScale: (scale: Scale) => void;
  onTransparent: (value: boolean) => void;
  onPng: () => void;
  onCopyPng: () => void;
  onSvg: () => void;
  onCopySvg: () => void;
  onSource: () => void;
  onCopyMarkdown: () => void;
  busy: boolean;
}) {
  return (
    <div className="export-panel">
      {!ready ? (
        <p className="export-blocked" role="status">
          {reason}
        </p>
      ) : null}
      <fieldset disabled={!ready || busy}>
        <legend>图片</legend>
        <div className="scale-row" role="radiogroup" aria-label="PNG 倍率">
          {([1, 2, 4] as const).map((value) => (
            <label key={value} className={scale === value ? "on" : ""}>
              <input
                type="radio"
                name="png-scale"
                checked={scale === value}
                onChange={() => onScale(value)}
              />
              {value}×
            </label>
          ))}
        </div>
        <label className="check">
          <input
            type="checkbox"
            checked={transparent}
            onChange={(event) => onTransparent(event.target.checked)}
          />
          透明背景
        </label>
        <div className="export-buttons">
          <button type="button" className="primary" onClick={onPng}>
            下载 PNG
          </button>
          <button type="button" onClick={onCopyPng}>
            复制 PNG
          </button>
          <button type="button" onClick={onSvg}>
            下载 SVG
          </button>
          <button type="button" onClick={onCopySvg}>
            复制 SVG 代码
          </button>
        </div>
      </fieldset>
      <fieldset>
        <legend>源码</legend>
        <div className="export-buttons">
          <button type="button" onClick={onSource}>
            下载 .mmd
          </button>
          <button type="button" onClick={onCopyMarkdown}>
            复制 Markdown 代码块
          </button>
        </div>
      </fieldset>
    </div>
  );
}
