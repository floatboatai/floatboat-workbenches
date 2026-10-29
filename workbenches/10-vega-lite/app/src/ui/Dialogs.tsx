// ABOUTME: 图表文件菜单、示例库（实时缩略图）与通用对话框。
import { useEffect, useId, useRef, useState, type ReactNode, type RefObject } from "react";
import { compile, type TopLevelSpec } from "vega-lite";
import { parse, View } from "vega";
import { expressionInterpreter } from "vega-interpreter";
import { parseDataset } from "../contracts/datasets";
import { gallery, type GalleryExample } from "../contracts/gallery";
import type { ProjectSummary } from "../contracts/project";
import { prepareSpec } from "../contracts/render-spec";
import { sampleDataset } from "../contracts/samples";

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
      const target = opener.current;
      opener.current = null;
      requestAnimationFrame(() => (target?.isConnected ? target : fallbackFocus?.current)?.focus());
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
            <button type="button" className="icon-button" aria-label={"关闭" + title} onClick={onClose}>
              ×
            </button>
          </header>
          {children}
        </div>
      ) : null}
    </dialog>
  );
}

const dateFormat = new Intl.DateTimeFormat("zh-CN", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" });
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
  onGallery,
  onImport,
  onOpen,
  onExportBundle,
  onDownloadSpec,
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
  onGallery: () => void;
  onImport: () => void;
  onOpen: (id: string) => void;
  onExportBundle: () => void;
  onDownloadSpec: () => void;
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
          <button type="button" className="primary" disabled={locked} onClick={onNew}>
            空白图表
          </button>
          <button type="button" disabled={locked} onClick={onGallery}>
            从示例库新建…
          </button>
          <button type="button" disabled={locked} onClick={onImport}>
            导入规格或项目包…
          </button>
        </div>
        <p className="hint">
          可导入 Vega-Lite 规格（.vl.json / .json）或本工作台导出的项目包（含数据）。导入总是另建新图表；CSV/TSV
          数据请在下方数据窗导入到当前图表。
        </p>
      </section>
      <section aria-labelledby="file-recent">
        <div className="section-row">
          <h3 id="file-recent">最近图表</h3>
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
                    <span className="recent-title">{local ? item.title.replace(/^本机草稿 · /, "") : item.title}</span>
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
          <p className="hint">还没有保存过的图表。编辑当前图表后会自动保存到这里。</p>
        )}
      </section>
      <section aria-labelledby="file-current">
        <h3 id="file-current">当前图表 · {title || "未命名"}</h3>
        <div className="file-actions">
          <button type="button" onClick={onExportBundle}>
            导出项目包（含数据）
          </button>
          <button type="button" onClick={onDownloadSpec}>
            下载规格 .vl.json
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
            删除图表
          </button>
        </div>
      </section>
    </div>
  );
}

const thumbnails = new Map<string, string>();
let queue: Promise<void> = Promise.resolve();
function renderThumbnail(example: GalleryExample): Promise<string> {
  const hit = thumbnails.get(example.id);
  if (hit) return Promise.resolve(hit);
  const task = queue.then(async () => {
    const refs = example.datasets.map((name) => sampleDataset(name).ref);
    const rows = new Map(example.datasets.map((name) => [name, parseDataset(sampleDataset(name).text, "csv").rows]));
    const spec = prepareSpec(example.spec, refs, rows, { width: 360, height: 220 });
    delete spec.title;
    const compiled = compile(spec as unknown as TopLevelSpec).spec;
    const view = new View(parse(compiled, undefined, { ast: true }), { expr: expressionInterpreter, renderer: "none" });
    try {
      await view.runAsync();
      const svg = await view.toSVG();
      const url = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
      thumbnails.set(example.id, url);
      return url;
    } finally {
      view.finalize();
    }
  });
  queue = task.then(
    () => undefined,
    () => undefined,
  );
  return task;
}

function Thumbnail({ example }: { example: GalleryExample }) {
  const [src, setSrc] = useState(() => thumbnails.get(example.id) ?? "");
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    if (src) return;
    let live = true;
    renderThumbnail(example).then(
      (url) => live && setSrc(url),
      () => live && setFailed(true),
    );
    return () => {
      live = false;
    };
  }, [example, src]);
  return (
    <div className="thumb" aria-hidden="true">
      {src ? <img src={src} alt="" width={240} height={150} loading="lazy" decoding="async" /> : <span>{failed ? "无法预览" : "正在绘制…"}</span>}
    </div>
  );
}

export function GalleryGrid({ onPick, locked }: { onPick: (example: GalleryExample) => void; locked: boolean }) {
  return (
    <ul className="gallery-grid">
      {gallery.map((example) => (
        <li key={example.id}>
          <button type="button" disabled={locked} onClick={() => onPick(example)}>
            <Thumbnail example={example} />
            <span className="gallery-title">{example.title}</span>
            <span className="gallery-summary">{example.summary}</span>
            <span className="gallery-tags">
              {example.tags.map((tag) => (
                <span key={tag} translate="no">
                  {tag}
                </span>
              ))}
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}
