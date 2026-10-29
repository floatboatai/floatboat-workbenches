import { useEffect, useRef, type ReactNode } from "react";
import type { ProjectSummary } from "../contracts/project";
import type { Source } from "../contracts/document";
export type Panel = "file" | "info" | "notes" | "pages" | "comments" | null;
const dateFormat = new Intl.DateTimeFormat("zh-CN", {
  month: "short",
  day: "numeric",
});
export function FileDialog({
  panel,
  close,
  items,
  currentId,
  locked,
  ready,
  title,
  source,
  onNew,
  onOpen,
  onImport,
  onExport,
  onInfo,
  onRecoveryDownload,
  onRecoveryImport,
  onRetry,
  onRemove,
  onOriginal,
  children,
}: {
  panel: Panel;
  close: () => void;
  items: ProjectSummary[];
  currentId?: string;
  locked: boolean;
  ready: boolean;
  title: string;
  source: Source | null;
  onNew: () => void;
  onOpen: (id: string) => void;
  onImport: () => void;
  onExport: () => void;
  onInfo: () => void;
  onRecoveryDownload: () => void;
  onRecoveryImport: () => void;
  onRetry: () => void;
  onRemove: () => void;
  onOriginal: () => void;
  children: ReactNode;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const open = panel === "file" || panel === "info";
  useEffect(() => {
    if (open && !dialog.current?.open) dialog.current?.showModal();
    else if (!open && dialog.current?.open) dialog.current?.close();
  }, [open]);
  return (
    <dialog
      ref={dialog}
      className={
        "file-dialog " + (panel === "info" ? "information-dialog" : "")
      }
      aria-labelledby="file-dialog-title"
      onKeyDown={(event) => {
        if (event.key !== "Tab") return;
        const controls = Array.from(
          event.currentTarget.querySelectorAll<HTMLElement>(
            'button:not(:disabled),a[href],input:not([type="hidden"]):not(:disabled),select:not(:disabled),textarea:not(:disabled)',
          ),
        ).filter((element) => element.getClientRects().length > 0);
        const first = controls[0],
          last = controls.at(-1);
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last?.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first?.focus();
        }
      }}
      onCancel={(e) => {
        e.preventDefault();
        close();
      }}
      onClick={(e) => {
        if (e.target === dialog.current) close();
      }}
    >
      <div className="dialog-content">
        <header className="dialog-heading">
          <div>
            <span className="eyebrow">OASIS</span>
            <h2 id="file-dialog-title">
              {panel === "info" ? "文档信息" : "文稿"}
            </h2>
          </div>
          <button aria-label="关闭文稿面板" onClick={close}>
            ×
          </button>
        </header>
        {panel === "info" ? (
          <div className="document-info">
            <p className="info-title">{title || "未命名文稿"}</p>
            <section>
              <h3>字体与校样</h3>
              <p>
                纸张与 PDF 使用 Workbench Sans SC，PDF 已嵌入字库。DOCX
                保留字体名称，外部排版依赖本机字体，分页可能有所不同。
              </p>
              <p>本地字库为常规与粗体；斜体标记会保留在 DOCX 中。</p>
              <div className="text-links">
                <a href="/api/fonts/WorkbenchSansSC-Regular.ttf" download>
                  下载常规字体
                </a>
                <a href="/api/fonts/WorkbenchSansSC-Bold.ttf" download>
                  下载粗体
                </a>
              </div>
            </section>
            <section>
              <h3>原始文件</h3>
              {source ? (
                <>
                  <p className="source-name">{source.name}</p>
                  <button
                    className="document-action"
                    disabled={locked}
                    onClick={onOriginal}
                  >
                    下载未修改原件 ↓
                  </button>
                  {source.warnings.map((warning, index) => (
                    <p key={index} className="source-warning">
                      {warning}
                    </p>
                  ))}
                </>
              ) : (
                <p>这份文稿直接创建，尚未关联 DOCX 原件。</p>
              )}
            </section>
            <section>
              <h3>完整工作稿</h3>
              <p>
                恢复文件包含正文、图片、原始部件、笔记和未完成输入。导入恢复文件会创建独立新稿。
              </p>
              <button className="document-action" onClick={onRecoveryDownload}>
                下载恢复稿
              </button>
            </section>
          </div>
        ) : (
          <div className="file-dialog-grid">
            <div className="file-commands">
              <button
                className="new-manuscript"
                disabled={locked}
                onClick={onNew}
              >
                <span>＋</span>新建文稿
              </button>
              <button disabled={locked} onClick={onImport}>
                打开 DOCX…
              </button>
              <button disabled={locked || !ready} onClick={onExport}>
                导出 DOCX
              </button>
              <hr />
              <button onClick={onInfo}>文档信息与原件</button>
              <button onClick={onRecoveryDownload}>下载恢复稿</button>
              <button disabled={locked} onClick={onRecoveryImport}>
                从恢复稿新建…
              </button>
              <button disabled={locked} onClick={onRetry}>
                重试保存
              </button>
              {currentId && (
                <button className="danger" disabled={locked} onClick={onRemove}>
                  删除当前文稿…
                </button>
              )}
            </div>
            <section className="recent-manuscripts">
              <h3>最近文稿</h3>
              {items.length ? (
                <ul>
                  {items.map((item) => (
                    <li key={item.id}>
                      <button
                        aria-current={
                          item.id === currentId ? "true" : undefined
                        }
                        disabled={locked}
                        onClick={() => onOpen(item.id)}
                      >
                        <span>{item.title || "未命名文稿"}</span>
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
                <p className="empty-documents">
                  编辑后，文稿会自动保存在这里。
                </p>
              )}
            </section>
          </div>
        )}
      </div>
      {children}
    </dialog>
  );
}
export function SideNote({
  open,
  close,
  notes,
  disabled,
  onChange,
}: {
  open: boolean;
  close: () => void;
  notes: string;
  disabled: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <aside
      hidden={!open}
      className="margin-note"
      role="dialog"
      aria-labelledby="notes-title"
    >
      <header>
        <h2 id="notes-title">校样笔记</h2>
        <button aria-label="关闭校样笔记" onClick={close}>
          ×
        </button>
      </header>
      <label className="sr-only" htmlFor="proof-notes">
        编辑笔记
      </label>
      <textarea
        id="proof-notes"
        name="proof-notes"
        autoComplete="off"
        disabled={disabled}
        value={notes}
        maxLength={20000}
        placeholder="记下待核对的人名、日期或段落…"
        onChange={(e) => onChange(e.target.value)}
      />
      <p>与文稿一起自动保存</p>
    </aside>
  );
}
export function PageIndex({
  open,
  pages,
  close,
  jump,
}: {
  open: boolean;
  pages: number;
  close: () => void;
  jump: (page: number) => void;
}) {
  return (
    <aside
      hidden={!open}
      className="page-index"
      role="dialog"
      aria-labelledby="page-index-title"
    >
      <header>
        <h2 id="page-index-title">页码</h2>
        <button aria-label="关闭页码索引" onClick={close}>
          ×
        </button>
      </header>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const value = Number(new FormData(e.currentTarget).get("page"));
          if (Number.isInteger(value) && value >= 1 && value <= pages)
            jump(value);
        }}
      >
        <label htmlFor="jump-page">跳转到</label>
        <input
          id="jump-page"
          name="page"
          type="number"
          min="1"
          max={pages}
          defaultValue="1"
          inputMode="numeric"
        />
        <span>/ {pages} 页</span>
        <button type="submit">前往</button>
      </form>
      <ol>
        {Array.from({ length: Math.min(pages, 30) }, (_, index) => (
          <li key={index}>
            <button onClick={() => jump(index + 1)}>第 {index + 1} 页</button>
          </li>
        ))}
      </ol>
    </aside>
  );
}

const ZOOMS = [25, 35, 50, 65, 80, 100, 125, 150];
export function ReadingBar({
  pages,
  images,
  pagesOpen,
  onPages,
  zoom,
  fit,
  onZoom,
}: {
  pages: number;
  images: number;
  pagesOpen: boolean;
  onPages: (trigger: HTMLElement) => void;
  zoom: number;
  /** Effective zoom when the page is shrunk to the window width. */
  fit: number | null;
  onZoom: (value: number | null) => void;
}) {
  return (
    <footer className="reading-bar">
      <button
        className="pages-trigger"
        aria-haspopup="dialog"
        aria-expanded={pagesOpen}
        onClick={(event) => onPages(event.currentTarget)}
      >
        {pages} 页 <span aria-hidden="true">⌃</span>
      </button>
      <span className="reading-label">{images > 0 ? `${images} 张图片` : ""}</span>
      <label>
        缩放{" "}
        <select
          aria-label="页面缩放"
          value={fit !== null ? "fit" : zoom}
          onChange={(event) =>
            onZoom(event.target.value === "fit" ? null : Number(event.target.value))
          }
        >
          {fit !== null && <option value="fit">适合宽度 {fit}%</option>}
          {ZOOMS.map((value) => (
            <option key={value} value={value}>
              {value}%
            </option>
          ))}
        </select>
      </label>
    </footer>
  );
}
