// ABOUTME: “文档”菜单：转换/打开、最近的校对、恢复与删除，集中校对文档的文件生命周期。
import { useEffect, useRef, useState, type RefObject } from "react";
import type { ProjectSummary } from "../contracts/project.ts";
const when = new Intl.DateTimeFormat("zh-CN", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" });
export function useMenu(open: boolean, close: () => void, trigger: RefObject<HTMLElement | null>, panel: RefObject<HTMLElement | null>) {
  useEffect(() => {
    if (!open) return;
    panel.current?.querySelector<HTMLElement>("button:not(:disabled)")?.focus();
    const key = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        close();
        trigger.current?.focus();
      }
    };
    const outside = (event: PointerEvent) => {
      if (panel.current && !panel.current.contains(event.target as Node) && !trigger.current?.contains(event.target as Node)) close();
    };
    window.addEventListener("keydown", key);
    window.addEventListener("pointerdown", outside);
    return () => {
      window.removeEventListener("keydown", key);
      window.removeEventListener("pointerdown", outside);
    };
  }, [open, close, trigger, panel]);
}
export function DocumentMenu({
  open,
  close,
  trigger,
  locked,
  items,
  currentId,
  conflict,
  onConvert,
  onOpen,
  onExportDraft,
  onRetrySave,
  onServerVersion,
  onDelete,
}: {
  open: boolean;
  close: () => void;
  trigger: RefObject<HTMLButtonElement | null>;
  locked: boolean;
  items: ProjectSummary[];
  currentId?: string;
  conflict: boolean;
  onConvert: () => void;
  onOpen: (id: string) => void;
  onExportDraft: () => void;
  onRetrySave: () => void;
  onServerVersion: () => void;
  onDelete: () => void;
}) {
  const panel = useRef<HTMLDivElement>(null),
    [confirming, setConfirming] = useState(false);
  useMenu(open, close, trigger, panel);
  useEffect(() => {
    if (!open) setConfirming(false);
  }, [open]);
  if (!open) return null;
  const act = (fn: () => void) => () => {
    close();
    trigger.current?.focus();
    fn();
  };
  return (
    <div ref={panel} className="menu doc-menu" role="dialog" aria-modal="false" aria-label="文档">
      <section>
        <button type="button" disabled={locked} onClick={act(onConvert)}>
          转换或导入文档…<small>PDF、Word、HTML、Markdown、DoclingDocument JSON、校对包</small>
        </button>
      </section>
      <section>
        <h2>最近的校对</h2>
        {items.length ? (
          <ul className="recent">
            {items.slice(0, 14).map((item) => (
              <li key={item.id}>
                <button
                  type="button"
                  disabled={locked || item.id === currentId}
                  aria-current={item.id === currentId ? "true" : undefined}
                  onClick={act(() => onOpen(item.id))}
                >
                  <span>{item.title}</span>
                  <small>
                    {item.id === currentId
                      ? "正在校对"
                      : item.id.startsWith("local:")
                        ? "本机未确认草稿"
                        : item.id.startsWith("draft:")
                          ? "服务器草稿"
                          : when.format(new Date(item.updatedAt))}
                  </small>
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="hint">尚无保存的校对。转换或打开示例后会自动保存。</p>
        )}
      </section>
      <section>
        <h2>恢复</h2>
        <button type="button" onClick={act(onExportDraft)}>
          导出恢复用工作副本<small>含未应用的输入；可再次导入为新文档</small>
        </button>
        <button type="button" onClick={act(onRetrySave)}>立即重试保存</button>
        {conflict ? (
          <button type="button" disabled={locked} onClick={act(onServerVersion)}>
            读取服务器版本<small>请先导出本窗口工作副本</small>
          </button>
        ) : null}
      </section>
      <section>
        {confirming ? (
          <div className="confirm" role="alert">
            <p>删除此校对的项目记录？原文件与结构文档仍保留，可重新转换。</p>
            <button type="button" className="danger" onClick={act(onDelete)}>确认删除</button>
            <button type="button" onClick={() => setConfirming(false)}>取消</button>
          </div>
        ) : (
          <button type="button" className="quiet" disabled={locked || !currentId} onClick={() => setConfirming(true)}>
            删除此校对…
          </button>
        )}
      </section>
    </div>
  );
}
export function ExportMenu({
  open,
  close,
  trigger,
  ready,
  hasTable,
  tableCount,
  onExport,
}: {
  open: boolean;
  close: () => void;
  trigger: RefObject<HTMLButtonElement | null>;
  ready: boolean;
  hasTable: boolean;
  tableCount: number;
  onExport: (kind: "json" | "md" | "html" | "csv" | "csv-all" | "package") => void;
}) {
  const panel = useRef<HTMLDivElement>(null);
  useMenu(open, close, trigger, panel);
  if (!open) return null;
  const act = (kind: Parameters<typeof onExport>[0]) => () => {
    close();
    trigger.current?.focus();
    onExport(kind);
  };
  return (
    <div ref={panel} className="menu export-menu" role="dialog" aria-modal="false" aria-label="导出">
      <button type="button" disabled={!ready} onClick={act("json")}>DoclingDocument JSON<small>含校订；可被 docling-core 读取</small></button>
      <button type="button" disabled={!ready} onClick={act("md")}>Markdown<small>正文、列表、表格，排除页眉页脚</small></button>
      <button type="button" disabled={!ready} onClick={act("html")}>HTML<small>独立网页，保留合并单元格</small></button>
      <button type="button" disabled={!ready || !hasTable} onClick={act("csv")}>当前表格 CSV<small>{hasTable ? "所选表格" : "先在结构中选择一张表"}</small></button>
      <button type="button" disabled={!ready || !tableCount} onClick={act("csv-all")}>全部表格 CSV<small>{tableCount} 张，按阅读顺序</small></button>
      <button type="button" disabled={!ready} onClick={act("package")}>校对包 .zip<small>原文件、原始结构与校订，可在另一台工作台导入</small></button>
    </div>
  );
}
