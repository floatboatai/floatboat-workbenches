import { useEffect, useRef, useState } from "react";
import { FolderOpen, Plus, Upload, X, FileBox, Trash2 } from "lucide-react";
import type { ProjectSummary } from "../contracts/project";
interface Props {
  open: boolean;
  busy: boolean;
  items: ProjectSummary[];
  currentId?: string;
  currentTitle: string;
  onClose: () => void;
  onOpen: (id: string) => void;
  onNew: () => void;
  onModel: () => void;
  onProject: () => void;
  onDelete: () => void;
  onRecovery: () => void;
  onRepair: () => void;
  onNotes: () => void;
  onRetry: () => void;
  saveMessage: string;
  error: string;
}
export function AssetLibrary(p: Props) {
  const dialog = useRef<HTMLDialogElement>(null),
    opener = useRef<HTMLElement | null>(null);
  const [query, setQuery] = useState("");
  useEffect(() => {
    const el = dialog.current;
    if (!el) return;
    if (p.open && !el.open) {
      opener.current =
        document.activeElement instanceof HTMLElement
          ? document.activeElement
          : null;
      setQuery("");
      el.showModal();
    } else if (!p.open && el.open) {
      el.close();
      opener.current?.focus();
    }
  }, [p.open]);
  const items = p.items.filter((item) =>
    item.title.toLocaleLowerCase().includes(query.toLocaleLowerCase()),
  );
  return (
    <dialog
      className="asset-library"
      ref={dialog}
      aria-labelledby="library-title"
      tabIndex={-1}
      onKeyDown={(event) => {
        if (event.key !== "Tab") return;
        const targets = Array.from(
          event.currentTarget.querySelectorAll<HTMLElement>(
            'button,input,select,textarea,a[href],[tabindex="0"]',
          ),
        ).filter(
          (el) => !el.matches(":disabled") && el.getClientRects().length > 0,
        );
        if (!targets.length) {
          event.preventDefault();
          event.currentTarget.focus();
          return;
        }
        const first = targets[0],
          last = targets[targets.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }}
      onCancel={(e) => {
        e.preventDefault();
        if (!p.busy) p.onClose();
      }}
      onClose={() => {
        if (p.open) p.onClose();
      }}
    >
      <header>
        <div>
          <span className="eyebrow">文件与工作稿</span>
          <h2 id="library-title">资产库</h2>
        </div>
        <button
          className="icon-button"
          aria-label="关闭资产库"
          disabled={p.busy}
          onClick={p.onClose}
        >
          <X size={19} />
        </button>
      </header>
      {p.error ? (
        <p className="library-error" role="alert">
          {p.error}
        </p>
      ) : null}
      <fieldset disabled={p.busy}>
        <div className="library-create">
          <button className="primary" onClick={p.onModel}>
            <Upload size={16} />
            打开模型
          </button>
          <button onClick={p.onProject}>
            <FolderOpen size={16} />
            导入工程或恢复稿
          </button>
          <button onClick={p.onNew}>
            <Plus size={16} />
            另开资产
          </button>
        </div>
        <label className="library-search">
          <span className="sr-only">搜索资产</span>
          <input
            type="search"
            name="asset-search"
            autoComplete="off"
            placeholder="搜索资产名称…"
            aria-label="搜索资产"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
        <div className="library-list" aria-label="已保存资产">
          {items.length ? (
            items.map((item) => (
              <button
                key={item.id}
                className="library-item"
                aria-current={p.currentId === item.id ? "true" : undefined}
                onClick={() => p.onOpen(item.id)}
              >
                <FileBox size={22} />
                <span>
                  <b>{item.title}</b>
                  <small>
                    {item.id.startsWith("local:")
                      ? "本机工作稿"
                      : item.id.startsWith("draft:")
                        ? "待完善工作稿"
                        : "资产工程"}{" "}
                    ·{" "}
                    {new Intl.DateTimeFormat("zh-CN", {
                      month: "short",
                      day: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    }).format(new Date(item.updatedAt))}
                  </small>
                </span>
                <span className="library-current">
                  {p.currentId === item.id ? "当前" : "打开"}
                </span>
              </button>
            ))
          ) : (
            <p className="library-empty">
              {query ? "没有匹配的资产。" : "打开模型后，工作稿会保存在这里。"}
            </p>
          )}
        </div>
        <div className="library-support">
          <p>{p.saveMessage}</p>
          <div>
            <button onClick={p.onNotes}>检查备注</button>
            <button onClick={p.onRecovery}>下载当前恢复稿</button>
            <button onClick={p.onRepair}>补齐缺失资源</button>
            <button onClick={p.onRetry}>重试保存</button>
          </div>
        </div>
        <footer>
          <span className="library-current-title">
            当前：{p.currentTitle || "未命名资产"}
          </span>
          <button
            className="danger-text"
            onClick={p.onDelete}
            disabled={!p.currentId}
          >
            <Trash2 size={14} />
            删除当前资产
          </button>
        </footer>
      </fieldset>
    </dialog>
  );
}
