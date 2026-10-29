// ABOUTME: 模板菜单：新建（空白/示例）、打开已保存、导入 JSON 或 PDF、导出与恢复、删除；Escape 关闭并把焦点还给按钮。
import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { ChevronDown, FileText } from "lucide-react";
import type { ProjectSummary } from "../contracts/project";

const timeFormat = new Intl.DateTimeFormat("zh-CN", { dateStyle: "short", timeStyle: "short" });
function formatTime(value: string): string {
  const time = Date.parse(value);
  return Number.isFinite(time) ? timeFormat.format(time) : "本机草稿";
}

export type SampleKind = "quotation" | "label" | "certificate" | "a4" | "a5" | "label-blank";

export function TemplateMenu({
  items,
  currentId,
  disabled,
  conflict,
  canDelete,
  onSample,
  onOpen,
  onImportJson,
  onImportPdf,
  onExportJson,
  onExportDraft,
  onSave,
  onOpenServer,
  onDelete,
  onWarm,
}: {
  items: ProjectSummary[];
  currentId?: string;
  disabled: boolean;
  conflict: boolean;
  canDelete: boolean;
  onSample: (kind: SampleKind) => void;
  onOpen: (id: string) => void;
  onImportJson: () => void;
  onImportPdf: () => void;
  onExportJson: () => void;
  onExportDraft: () => void;
  onSave: () => void;
  onOpenServer: () => void;
  onDelete: () => void;
  onWarm: () => void;
}) {
  const [open, setOpen] = useState(false);
  const button = useRef<HTMLButtonElement>(null),
    panel = useRef<HTMLDivElement>(null);
  const id = useId();
  useEffect(() => {
    if (!open) return;
    const close = (event: PointerEvent) => {
      if (!panel.current?.contains(event.target as Node) && !button.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", close);
    panel.current?.querySelector<HTMLButtonElement>("[role=menuitem]:not(:disabled)")?.focus();
    return () => document.removeEventListener("pointerdown", close);
  }, [open]);
  const run = (action: () => void) => () => {
    setOpen(false);
    button.current?.focus();
    action();
  };
  const onKey = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape") {
      event.preventDefault();
      setOpen(false);
      button.current?.focus();
      return;
    }
    if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    const entries = [...(panel.current?.querySelectorAll<HTMLButtonElement>("[role=menuitem]:not(:disabled)") ?? [])];
    const at = entries.indexOf(document.activeElement as HTMLButtonElement);
    const next =
      event.key === "Home" ? 0 : event.key === "End" ? entries.length - 1 : event.key === "ArrowDown" ? (at + 1) % entries.length : (at - 1 + entries.length) % entries.length;
    entries[next]?.focus();
  };
  const item = (label: string, action: () => void, options: { hint?: string; danger?: boolean; disabled?: boolean; current?: boolean } = {}) => (
    <button
      type="button"
      role="menuitem"
      className={options.danger ? "danger" : undefined}
      disabled={options.disabled}
      aria-current={options.current ? "true" : undefined}
      onClick={run(action)}
    >
      <span>{label}</span>
      {options.hint ? <small>{options.hint}</small> : null}
    </button>
  );
  return (
    <div className="template-menu">
      <button
        ref={button}
        type="button"
        className="menu-button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((value) => !value)}
        onPointerEnter={onWarm}
        onFocus={onWarm}
      >
        <FileText size={16} aria-hidden="true" />
        <span>模板</span>
        <ChevronDown size={14} aria-hidden="true" />
      </button>
      {open ? (
        <div ref={panel} id={id} className="menu-panel" role="menu" aria-label="模板文件" onKeyDown={onKey}>
          <div className="menu-group" role="group" aria-label="新建">
            <p className="menu-label">新建</p>
            {item("报价单示例", () => onSample("quotation"), { hint: "标志 · 明细表 · 合计 · 收款码", disabled })}
            {item("发货标签示例", () => onSample("label"), { hint: "100×150 mm · 条码 · 7 行发货数据", disabled })}
            {item("结业证书示例", () => onSample("certificate"), { hint: "叠加导入的 PDF 底图 · 6 位学员", disabled })}
            {item("空白 A4", () => onSample("a4"), { hint: "210 × 297 mm", disabled })}
            {item("空白 A5", () => onSample("a5"), { hint: "148 × 210 mm", disabled })}
            {item("空白标签", () => onSample("label-blank"), { hint: "100 × 150 mm", disabled })}
          </div>
          <div className="menu-group" role="group" aria-label="导入">
            <p className="menu-label">导入为新模板</p>
            {item("以 PDF 为底图新建…", onImportPdf, { hint: "表单、合同或已有版式，最大 40 MB / 100 页", disabled })}
            {item("导入模板 JSON…", onImportJson, { hint: "本工作台导出或 pdfme 模板", disabled })}
          </div>
          <div className="menu-group" role="group" aria-label="当前模板">
            <p className="menu-label">当前模板</p>
            {item("立即保存", onSave, { disabled })}
            {item("导出模板 JSON", onExportJson, { hint: "含底图、图片与数据，可在别处导入", disabled })}
            {item("导出恢复草稿", onExportDraft)}
            {conflict ? item("打开服务器版本", onOpenServer, { disabled }) : null}
            {item("删除当前模板…", onDelete, { danger: true, disabled: disabled || !canDelete })}
          </div>
          <div className="menu-group saved" role="group" aria-label="已保存的模板">
            <p className="menu-label">已保存（{items.length}）</p>
            {items.length ? (
              items.map((entry) => (
                <button
                  key={entry.id}
                  type="button"
                  role="menuitem"
                  disabled={disabled}
                  aria-current={entry.id === currentId ? "true" : undefined}
                  onClick={run(() => onOpen(entry.id))}
                >
                  <span>{entry.title}</span>
                  <small>{formatTime(entry.updatedAt)}</small>
                </button>
              ))
            ) : (
              <p className="menu-empty">编辑后会自动保存到这里。</p>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
