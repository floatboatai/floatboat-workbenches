// ABOUTME: “工作流”文件菜单：命名、新建、模板、最近打开、导入、导出与删除。

import { ChevronDown, FilePlus2, FileDown, FileUp, ClipboardPaste, LayoutTemplate, Trash2 } from "lucide-react";
import type { ProjectSummary } from "../contracts/project";
import { TEMPLATES } from "../contracts/templates";
import { usePopover } from "./popover";

export interface MenuProps {
  title: string;
  setTitle: (title: string) => void;
  items: ProjectSummary[];
  currentId: string | null;
  canDelete: boolean;
  onOpen: (id: string) => void;
  onNew: () => void;
  onTemplate: (id: string) => void;
  onImportFile: () => void;
  onImportText: () => void;
  onExportUi: () => void;
  onExportApi: () => void;
  onDelete: () => void;
}

const label = (p: ProjectSummary) => (p.id.startsWith("local:") ? "本机草稿 · " : "") + p.title;

export function WorkflowMenu(props: MenuProps) {
  const pop = usePopover();
  const run = (fn: () => void) => () => {
    pop.setOpen(false);
    fn();
  };
  const recent = props.items.filter((p) => p.id !== props.currentId).slice(0, 8);
  return (
    <div className="menu-wrap">
      <button
        ref={pop.trigger}
        type="button"
        className="menu-trigger"
        aria-haspopup="menu"
        aria-expanded={pop.open}
        onClick={() => pop.setOpen((v) => !v)}
      >
        <span className="menu-title">{props.title || "未命名工作流"}</span>
        <ChevronDown size={14} aria-hidden="true" />
      </button>
      {pop.open && (
        <div ref={pop.panel} className="menu-panel" role="menu" aria-label="工作流">
          <label className="menu-name">
            <span>名称</span>
            <input value={props.title} maxLength={120} onChange={(e) => props.setTitle(e.target.value)} aria-label="工作流名称" />
          </label>
          <button type="button" role="menuitem" onClick={run(props.onNew)}>
            <FilePlus2 size={15} aria-hidden="true" />新建空白工作流
          </button>
          <div className="menu-group" role="group" aria-label="模板">
            <span className="menu-label"><LayoutTemplate size={13} aria-hidden="true" />从模板新建</span>
            {TEMPLATES.map((t) => (
              <button type="button" role="menuitem" key={t.id} className="menu-sub" onClick={run(() => props.onTemplate(t.id))} title={t.summary}>
                {t.title}
              </button>
            ))}
          </div>
          <div className="menu-sep" />
          <button type="button" role="menuitem" onClick={run(props.onImportFile)}>
            <FileUp size={15} aria-hidden="true" />导入文件…<small>JSON / PNG</small>
          </button>
          <button type="button" role="menuitem" onClick={run(props.onImportText)}>
            <ClipboardPaste size={15} aria-hidden="true" />粘贴 JSON 导入…
          </button>
          <button type="button" role="menuitem" onClick={run(props.onExportUi)}>
            <FileDown size={15} aria-hidden="true" />导出界面工作流 JSON
          </button>
          <button type="button" role="menuitem" onClick={run(props.onExportApi)}>
            <FileDown size={15} aria-hidden="true" />导出 API 提示词 JSON
          </button>
          {recent.length > 0 && (
            <div className="menu-group" role="group" aria-label="最近打开">
              <span className="menu-label">最近打开</span>
              {recent.map((p) => (
                <button type="button" role="menuitem" key={p.id} className="menu-sub" onClick={run(() => props.onOpen(p.id))}>
                  {label(p)}
                </button>
              ))}
            </div>
          )}
          <div className="menu-sep" />
          <button type="button" role="menuitem" className="danger" disabled={!props.canDelete} onClick={run(props.onDelete)}>
            <Trash2 size={15} aria-hidden="true" />删除此工作流
          </button>
        </div>
      )}
    </div>
  );
}
