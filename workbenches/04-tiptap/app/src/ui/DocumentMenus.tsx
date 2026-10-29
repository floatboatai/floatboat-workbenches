// ABOUTME: 页头的「文稿」与「导出」菜单：新建、导入、最近文稿、删除，以及 Markdown/HTML/JSON/恢复草稿导出；Esc 与点击外部关闭并归还焦点。
import { useEffect, useRef, type ReactNode, type RefObject } from "react";
import { FileDown, FilePlus2, FileText, FileUp, RefreshCw, Save, Trash2 } from "lucide-react";
import type { ProjectSummary } from "../contracts/project";
import { tip } from "./keys";

function useDismiss(ref: RefObject<HTMLDetailsElement | null>) {
  useEffect(() => {
    const close = (focus: boolean) => {
      const element = ref.current;
      if (!element?.open) return;
      element.open = false;
      if (focus) element.querySelector("summary")?.focus();
    };
    const key = (event: KeyboardEvent) => {
      if (event.key === "Escape" && ref.current?.open) {
        event.preventDefault();
        close(true);
      }
    };
    const pointer = (event: PointerEvent) => {
      if (ref.current?.open && !ref.current.contains(event.target as Node)) close(false);
    };
    document.addEventListener("keydown", key);
    document.addEventListener("pointerdown", pointer);
    return () => {
      document.removeEventListener("keydown", key);
      document.removeEventListener("pointerdown", pointer);
    };
  }, [ref]);
  return () => {
    if (ref.current) ref.current.open = false;
  };
}

function Item({
  icon,
  children,
  onClick,
  disabled,
  current,
  hint,
}: {
  icon?: ReactNode;
  children: ReactNode;
  onClick: () => void;
  disabled?: boolean;
  current?: boolean;
  hint?: string;
}) {
  return (
    <button type="button" className="menu-item" onClick={onClick} disabled={disabled} aria-current={current ? "true" : undefined}>
      {icon}
      <span className="menu-label">{children}</span>
      {hint ? <span className="menu-hint">{hint}</span> : null}
    </button>
  );
}

const ICON = { size: 15, strokeWidth: 1.8, "aria-hidden": true } as const;
const timeFormat = new Intl.DateTimeFormat("zh-CN", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" });
function when(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : timeFormat.format(date);
}

export function DocumentMenu({
  items,
  currentId,
  busy,
  onBlank,
  onSample,
  onImport,
  onOpen,
  onDelete,
}: {
  items: ProjectSummary[];
  currentId?: string;
  busy: boolean;
  onBlank: () => void;
  onSample: () => void;
  onImport: () => void;
  onOpen: (id: string) => void;
  onDelete: () => void;
}) {
  const ref = useRef<HTMLDetailsElement>(null);
  const close = useDismiss(ref);
  const act = (action: () => void) => () => {
    close();
    action();
  };
  return (
    <details ref={ref} className="file-menu document-menu">
      <summary>文稿</summary>
      <div className="menu-body" role="group" aria-label="文稿">
        <Item icon={<FilePlus2 {...ICON} />} onClick={act(onBlank)} disabled={busy}>
          新建空白文稿
        </Item>
        <Item icon={<FileText {...ICON} />} onClick={act(onSample)} disabled={busy}>
          新建示例方案
        </Item>
        <Item icon={<FileUp {...ICON} />} onClick={act(onImport)} disabled={busy} hint=".md .json">
          导入为新文稿…
        </Item>
        <p className="menu-section">最近文稿</p>
        {items.length ? (
          <div className="menu-list">
            {items.map((item) => (
              <Item
                key={item.id}
                onClick={act(() => onOpen(item.id))}
                disabled={busy}
                current={item.id === currentId}
                hint={when(item.updatedAt)}
              >
                {item.title}
              </Item>
            ))}
          </div>
        ) : (
          <p className="menu-empty">还没有保存的文稿。开始输入后会自动保存到这里。</p>
        )}
        <Item icon={<Trash2 {...ICON} />} onClick={act(onDelete)} disabled={busy || !currentId}>
          删除当前文稿…
        </Item>
      </div>
    </details>
  );
}

export function ExportMenu({
  busy,
  conflict,
  onMarkdown,
  onHtml,
  onJson,
  onDraft,
  onSave,
  onServerVersion,
}: {
  busy: boolean;
  conflict: boolean;
  onMarkdown: () => void;
  onHtml: () => void;
  onJson: () => void;
  onDraft: () => void;
  onSave: () => void;
  onServerVersion: () => void;
}) {
  const ref = useRef<HTMLDetailsElement>(null);
  const close = useDismiss(ref);
  const act = (action: () => void) => () => {
    close();
    action();
  };
  return (
    <details ref={ref} className="file-menu export-menu">
      <summary>导出</summary>
      <div className="menu-body" role="group" aria-label="导出">
        <Item icon={<FileDown {...ICON} />} onClick={act(onMarkdown)} hint=".md">
          Markdown
        </Item>
        <Item icon={<FileDown {...ICON} />} onClick={act(onHtml)} hint=".html">
          HTML 网页
        </Item>
        <Item icon={<FileDown {...ICON} />} onClick={act(onJson)} hint=".json">
          完整备份（JSON）
        </Item>
        <p className="menu-section">保存与恢复</p>
        <button type="button" className="menu-item" onClick={act(onSave)} disabled={busy} {...tip("立即保存", "Mod-s")}>
          <Save {...ICON} />
          <span className="menu-label">{busy ? "保存中…" : "立即保存"}</span>
        </button>
        <Item icon={<FileDown {...ICON} />} onClick={act(onDraft)}>
          下载恢复草稿
        </Item>
        {conflict ? (
          <Item icon={<RefreshCw {...ICON} />} onClick={act(onServerVersion)}>
            打开服务器版本
          </Item>
        ) : null}
      </div>
    </details>
  );
}
