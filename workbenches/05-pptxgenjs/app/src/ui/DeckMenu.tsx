// ABOUTME: 「文稿」菜单：新建、导入/导出项目 JSON、立即保存、恢复草稿、最近文稿与删除。
import type { RefObject } from "react";
import { FileJson, FilePlus2, FolderOpen, LifeBuoy, Presentation, Save, Trash2 } from "lucide-react";
import type { ProjectSummary } from "../contracts/project";

export interface DeckMenuActions {
  newBlank: () => void;
  newSample: () => void;
  importJson: () => void;
  exportJson: () => void;
  save: () => void;
  exportDraft: () => void;
  open: (id: string) => void;
  remove: () => void;
}

export function DeckMenu({
  menuRef,
  items,
  currentId,
  busy,
  actions,
  onClose,
}: {
  menuRef: RefObject<HTMLDivElement | null>;
  items: ProjectSummary[];
  currentId: string | undefined;
  busy: boolean;
  actions: DeckMenuActions;
  onClose: (restoreFocus: boolean) => void;
}) {
  return (
    <div
      className="deck-menu"
      ref={menuRef}
      role="dialog"
      aria-label="文稿菜单"
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.stopPropagation();
          onClose(true);
        }
      }}
    >
      <div className="menu-group">
        <button
          type="button"
          autoFocus
          onClick={() => {
            onClose(false);
            actions.newBlank();
          }}
        >
          <FilePlus2 size={14} aria-hidden="true" />
          新建空白文稿<small>沿用当前主题</small>
        </button>
        <button
          type="button"
          onClick={() => {
            onClose(false);
            actions.newSample();
          }}
        >
          <Presentation size={14} aria-hidden="true" />
          新建示例文稿<small>门店季度复盘</small>
        </button>
        <button
          type="button"
          onClick={() => {
            onClose(false);
            actions.importJson();
          }}
        >
          <FolderOpen size={14} aria-hidden="true" />
          导入项目 JSON…<small>含图片；导入为新文稿</small>
        </button>
        <button type="button" onClick={() => {
          onClose(false);
          actions.exportJson();
        }}>
          <FileJson size={14} aria-hidden="true" />
          导出项目 JSON<small>含图片数据，可再导入</small>
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => {
            onClose(false);
            actions.save();
          }}
        >
          <Save size={14} aria-hidden="true" />
          立即保存<small>⌘S</small>
        </button>
        <button
          type="button"
          onClick={() => {
            onClose(false);
            actions.exportDraft();
          }}
        >
          <LifeBuoy size={14} aria-hidden="true" />
          导出恢复草稿
        </button>
      </div>
      <div className="menu-group">
        <h2>最近文稿</h2>
        <ul className="recent-list">
          {items.length === 0 ? <li className="panel-note">还没有保存的文稿；编辑后会自动保存。</li> : null}
          {items.map((item) => (
            <li key={item.id}>
              <button
                type="button"
                aria-current={currentId === item.id}
                disabled={busy}
                onClick={() => {
                  onClose(false);
                  actions.open(item.id);
                }}
              >
                <span>{item.title}</span>
                <small>{new Date(item.updatedAt).toLocaleString("zh-CN", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" })}</small>
              </button>
            </li>
          ))}
        </ul>
      </div>
      <div className="menu-group">
        <button
          type="button"
          className="danger"
          disabled={!currentId || busy}
          onClick={() => {
            onClose(false);
            actions.remove();
          }}
        >
          <Trash2 size={14} aria-hidden="true" />
          删除此文稿…
        </button>
      </div>
    </div>
  );
}
