// ABOUTME: “影片”菜单：新建、示例、最近的影片、导入导出工程与字幕、恢复稿与工程 JSON，承担文件生命周期。
import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { ChevronDown, Clapperboard } from "lucide-react";
import type { ProjectSummary } from "../contracts/project";

export type MenuAction = "blank" | "sample" | "import" | "export" | "srt" | "report" | "recovery" | "json" | "delete";
const GROUPS: { label: string; items: [MenuAction, string][] }[] = [
  { label: "新建", items: [["blank", "新建空白影片"], ["sample", "打开示例「海边的一天」"]] },
  { label: "工程", items: [["import", "导入工程…"], ["export", "导出完整工程（含素材）"], ["recovery", "导出恢复稿"], ["json", "工程 JSON…"]] },
  { label: "交付", items: [["srt", "导出字幕 SRT"], ["report", "导出剪辑单 Markdown"]] },
];

export function FileMenu({
  items,
  currentId,
  disabled,
  onAction,
  onOpen,
}: {
  items: ProjectSummary[];
  currentId?: string;
  disabled: boolean;
  onAction: (a: MenuAction) => void;
  onOpen: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const button = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const close = (focus = true) => {
    setOpen(false);
    if (focus) button.current?.focus();
  };
  useEffect(() => {
    if (!open) return;
    menu.current?.querySelector<HTMLElement>("[role=menuitem]")?.focus();
    const outside = (e: PointerEvent) => {
      if (!menu.current?.contains(e.target as Node) && !button.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", outside);
    return () => document.removeEventListener("pointerdown", outside);
  }, [open]);
  function keys(e: KeyboardEvent) {
    if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      close();
      return;
    }
    if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
    e.preventDefault();
    const all = [...(menu.current?.querySelectorAll<HTMLElement>("[role=menuitem]:not([disabled])") ?? [])];
    const i = all.indexOf(document.activeElement as HTMLElement);
    all[(i + (e.key === "ArrowDown" ? 1 : -1) + all.length) % all.length]?.focus();
  }
  const run = (a: MenuAction) => {
    close(false);
    onAction(a);
  };
  return (
    <div className="file-menu">
      <button ref={button} className="menu-button" aria-haspopup="menu" aria-expanded={open} disabled={disabled} onClick={() => setOpen(!open)}>
        <Clapperboard aria-hidden="true" size={16} />
        影片
        <ChevronDown aria-hidden="true" size={14} />
      </button>
      {open ? (
        <div className="menu" role="menu" aria-label="影片菜单" ref={menu} onKeyDown={keys}>
          {GROUPS.map((g) => (
            <div role="group" aria-label={g.label} key={g.label}>
              <p className="menu-label" aria-hidden="true">
                {g.label}
              </p>
              {g.items.map(([a, label]) => (
                <button key={a} role="menuitem" onClick={() => run(a)}>
                  {label}
                </button>
              ))}
            </div>
          ))}
          <div role="group" aria-label="最近的影片">
            <p className="menu-label" aria-hidden="true">
              最近的影片
            </p>
            {items.length === 0 ? <p className="menu-empty">还没有保存过的影片。</p> : null}
            {items.slice(0, 12).map((it) => (
              <button
                key={it.id}
                role="menuitem"
                aria-current={it.id === currentId ? "true" : undefined}
                onClick={() => {
                  close(false);
                  if (it.id !== currentId) onOpen(it.id);
                }}
              >
                <span>{it.title}</span>
                <small>{it.id.startsWith("local:") ? "本机未同步" : it.id.startsWith("draft:") ? "草稿" : new Date(it.updatedAt).toLocaleString()}</small>
              </button>
            ))}
          </div>
          <div role="group" aria-label="删除">
            <button role="menuitem" className="danger" disabled={!currentId} onClick={() => run("delete")}>
              删除当前影片…
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
