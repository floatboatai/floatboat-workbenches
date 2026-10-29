// ABOUTME: 正文上方的格式工具条（撤销、段落样式、行内格式、列表、对齐、插入），以及表格/图片/代码块的上下文工具。
import { useEffect, useState, type ReactNode } from "react";
import type { Editor } from "@tiptap/core";
import {
  AlignCenter,
  AlignJustify,
  AlignLeft,
  AlignRight,
  BetweenHorizontalEnd,
  BetweenHorizontalStart,
  BetweenVerticalEnd,
  BetweenVerticalStart,
  Bold,
  Code,
  Highlighter,
  ImagePlus,
  Italic,
  Link2,
  List,
  ListChecks,
  ListOrdered,
  Minus,
  PanelTop,
  Quote,
  Redo2,
  SquareCode,
  Strikethrough,
  Table,
  TableCellsMerge,
  TableCellsSplit,
  Trash2,
  Underline,
  Undo2,
} from "lucide-react";
import { tip } from "./keys";
import type { Align, BlockStyle, ToolState } from "./editor-state";
import { CODE_LANGUAGES } from "../contracts/schema";

function Tool({
  label,
  keys,
  pressed,
  disabled,
  onClick,
  children,
  text,
}: {
  label: string;
  keys?: string;
  pressed?: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: ReactNode;
  text?: string;
}) {
  return (
    <button
      type="button"
      className={text ? "tool tool-text" : "tool"}
      aria-label={text ? undefined : label}
      aria-pressed={pressed}
      disabled={disabled}
      onMouseDown={(event) => event.preventDefault()}
      onClick={onClick}
      {...tip(label, keys)}
    >
      {children}
      {text ? <span>{text}</span> : null}
    </button>
  );
}

const ICON = { size: 16, strokeWidth: 1.8, "aria-hidden": true } as const;

const ALIGNS: { value: Align; label: string; keys: string; icon: ReactNode }[] = [
  { value: "left", label: "左对齐", keys: "Mod-Shift-l", icon: <AlignLeft {...ICON} /> },
  { value: "center", label: "居中", keys: "Mod-Shift-e", icon: <AlignCenter {...ICON} /> },
  { value: "right", label: "右对齐", keys: "Mod-Shift-r", icon: <AlignRight {...ICON} /> },
  { value: "justify", label: "两端对齐", keys: "Mod-Shift-j", icon: <AlignJustify {...ICON} /> },
];

export function Toolbar({
  editor,
  state,
  disabled,
  onLink,
  onPickImage,
}: {
  editor: Editor | null;
  state: ToolState | null;
  disabled: boolean;
  onLink: () => void;
  onPickImage: () => void;
}) {
  const off = disabled || !editor || !state;
  const run = (action: (chain: ReturnType<Editor["chain"]>) => ReturnType<Editor["chain"]>) => {
    if (editor) action(editor.chain().focus()).run();
  };
  const setBlock = (value: BlockStyle) => {
    if (!editor) return;
    const chain = editor.chain().focus();
    if (value === "paragraph") chain.setParagraph().run();
    else if (value !== "other") chain.setHeading({ level: Number(value.slice(1)) as 1 | 2 | 3 }).run();
  };
  return (
    <div className="format-bar" role="toolbar" aria-label="文字格式">
      <div className="tool-group" role="group" aria-label="历史">
        <Tool label="撤销" keys="Mod-z" disabled={off || !state?.canUndo} onClick={() => run((c) => c.undo())}>
          <Undo2 {...ICON} />
        </Tool>
        <Tool label="重做" keys="Mod-Shift-z" disabled={off || !state?.canRedo} onClick={() => run((c) => c.redo())}>
          <Redo2 {...ICON} />
        </Tool>
      </div>
      <label className="block-style" title="段落样式（⌥/Alt + Mod + 0–3）">
        <span className="sr-only">段落样式</span>
        <select
          name="blockStyle"
          value={state?.block ?? "paragraph"}
          disabled={off}
          onChange={(event) => setBlock(event.target.value as BlockStyle)}
        >
          <option value="paragraph">正文</option>
          <option value="h1">标题 1</option>
          <option value="h2">标题 2</option>
          <option value="h3">标题 3</option>
          {state?.block === "other" ? <option value="other">—</option> : null}
        </select>
      </label>
      <div className="tool-group" role="group" aria-label="文字样式">
        <Tool label="加粗" keys="Mod-b" pressed={state?.bold} disabled={off} onClick={() => run((c) => c.toggleBold())}>
          <Bold {...ICON} />
        </Tool>
        <Tool label="斜体" keys="Mod-i" pressed={state?.italic} disabled={off} onClick={() => run((c) => c.toggleItalic())}>
          <Italic {...ICON} />
        </Tool>
        <Tool label="下划线" keys="Mod-u" pressed={state?.underline} disabled={off} onClick={() => run((c) => c.toggleUnderline())}>
          <Underline {...ICON} />
        </Tool>
        <Tool label="删除线" keys="Mod-Shift-s" pressed={state?.strike} disabled={off} onClick={() => run((c) => c.toggleStrike())}>
          <Strikethrough {...ICON} />
        </Tool>
        <Tool label="高亮" keys="Mod-Shift-h" pressed={state?.highlight} disabled={off} onClick={() => run((c) => c.toggleHighlight())}>
          <Highlighter {...ICON} />
        </Tool>
        <Tool label="行内代码" keys="Mod-e" pressed={state?.code} disabled={off} onClick={() => run((c) => c.toggleCode())}>
          <Code {...ICON} />
        </Tool>
        <Tool label="链接" keys="Mod-k" pressed={state?.link} disabled={off} onClick={onLink}>
          <Link2 {...ICON} />
        </Tool>
      </div>
      <div className="tool-group" role="group" aria-label="段落">
        <Tool label="无序列表" keys="Mod-Shift-8" pressed={state?.bullet} disabled={off} onClick={() => run((c) => c.toggleBulletList())}>
          <List {...ICON} />
        </Tool>
        <Tool label="有序列表" keys="Mod-Shift-7" pressed={state?.ordered} disabled={off} onClick={() => run((c) => c.toggleOrderedList())}>
          <ListOrdered {...ICON} />
        </Tool>
        <Tool label="任务清单" keys="Mod-Shift-9" pressed={state?.task} disabled={off} onClick={() => run((c) => c.toggleTaskList())}>
          <ListChecks {...ICON} />
        </Tool>
        <Tool label="引用" keys="Mod-Shift-b" pressed={state?.quote} disabled={off} onClick={() => run((c) => c.toggleBlockquote())}>
          <Quote {...ICON} />
        </Tool>
        <Tool label="代码块" keys="Mod-Alt-c" pressed={state?.codeBlock} disabled={off} onClick={() => run((c) => c.toggleCodeBlock())}>
          <SquareCode {...ICON} />
        </Tool>
      </div>
      <div className="tool-group" role="group" aria-label="对齐">
        {ALIGNS.map((item) => (
          <Tool
            key={item.value}
            label={item.label}
            keys={item.keys}
            pressed={state?.align === item.value}
            disabled={off || state?.codeBlock}
            onClick={() => run((c) => (item.value === "left" ? c.unsetTextAlign() : c.setTextAlign(item.value)))}
          >
            {item.icon}
          </Tool>
        ))}
      </div>
      <div className="tool-group" role="group" aria-label="插入">
        <Tool label="插入表格" disabled={off || state?.table} onClick={() => run((c) => c.insertTable({ rows: 3, cols: 3, withHeaderRow: true }))}>
          <Table {...ICON} />
        </Tool>
        <Tool label="插入图片" disabled={off} onClick={onPickImage}>
          <ImagePlus {...ICON} />
        </Tool>
        <Tool label="分隔线" disabled={off} onClick={() => run((c) => c.setHorizontalRule())}>
          <Minus {...ICON} />
        </Tool>
      </div>
    </div>
  );
}

function ImageAlt({ editor, alt }: { editor: Editor; alt: string }) {
  const [value, setValue] = useState(alt);
  useEffect(() => setValue(alt), [alt]);
  const commit = () => {
    const next = value.trim().slice(0, 1000);
    if (next !== alt) editor.chain().updateAttributes("image", { alt: next || null }).run();
  };
  return (
    <label className="context-field">
      <span>替代文字</span>
      <input
        name="imageAlt"
        autoComplete="off"
        value={value}
        maxLength={1000}
        placeholder="描述图片内容，供读屏与导出使用…"
        onChange={(event) => setValue(event.target.value)}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            commit();
            editor.commands.focus();
          }
          if (event.key === "Escape") {
            setValue(alt);
            editor.commands.focus();
          }
        }}
      />
    </label>
  );
}

export function ContextBar({ editor, state, disabled }: { editor: Editor | null; state: ToolState | null; disabled: boolean }) {
  if (!editor || !state || disabled) return null;
  const run = (action: (chain: ReturnType<Editor["chain"]>) => ReturnType<Editor["chain"]>) =>
    action(editor.chain().focus()).run();
  if (state.image)
    return (
      <div className="context-bar" role="toolbar" aria-label="图片">
        <span className="context-title">图片</span>
        <ImageAlt editor={editor} alt={state.imageAlt} />
        {state.imageSized ? (
          <Tool label="恢复原始宽度" text="适应版心" onClick={() => run((c) => c.updateAttributes("image", { width: null, height: null }))}>
            <PanelTop {...ICON} />
          </Tool>
        ) : null}
        <Tool label="删除图片" text="删除" onClick={() => run((c) => c.deleteSelection())}>
          <Trash2 {...ICON} />
        </Tool>
      </div>
    );
  if (state.table)
    return (
      <div className="context-bar" role="toolbar" aria-label="表格">
        <span className="context-title">表格</span>
        <Tool label="在上方插入行" onClick={() => run((c) => c.addRowBefore())}>
          <BetweenHorizontalStart {...ICON} />
        </Tool>
        <Tool label="在下方插入行" onClick={() => run((c) => c.addRowAfter())}>
          <BetweenHorizontalEnd {...ICON} />
        </Tool>
        <Tool label="删除当前行" text="删除行" onClick={() => run((c) => c.deleteRow())}>
          <Trash2 {...ICON} />
        </Tool>
        <span className="format-divider" aria-hidden="true" />
        <Tool label="在左侧插入列" onClick={() => run((c) => c.addColumnBefore())}>
          <BetweenVerticalStart {...ICON} />
        </Tool>
        <Tool label="在右侧插入列" onClick={() => run((c) => c.addColumnAfter())}>
          <BetweenVerticalEnd {...ICON} />
        </Tool>
        <Tool label="删除当前列" text="删除列" onClick={() => run((c) => c.deleteColumn())}>
          <Trash2 {...ICON} />
        </Tool>
        <span className="format-divider" aria-hidden="true" />
        <Tool label="切换标题行" text="标题行" onClick={() => run((c) => c.toggleHeaderRow())}>
          <PanelTop {...ICON} />
        </Tool>
        <Tool label="合并单元格" disabled={!state.canMerge} onClick={() => run((c) => c.mergeCells())}>
          <TableCellsMerge {...ICON} />
        </Tool>
        <Tool label="拆分单元格" disabled={!state.canSplit} onClick={() => run((c) => c.splitCell())}>
          <TableCellsSplit {...ICON} />
        </Tool>
        <span className="format-divider" aria-hidden="true" />
        <Tool label="删除整个表格" text="删除表格" onClick={() => run((c) => c.deleteTable())}>
          <Trash2 {...ICON} />
        </Tool>
      </div>
    );
  if (state.codeBlock)
    return (
      <div className="context-bar" role="toolbar" aria-label="代码块">
        <span className="context-title">代码块</span>
        <label className="context-field">
          <span>语言</span>
          <select
            name="codeLanguage"
            value={CODE_LANGUAGES.includes(state.codeLanguage as (typeof CODE_LANGUAGES)[number]) ? state.codeLanguage : "__custom"}
            onChange={(event) => {
              const language = event.target.value;
              if (language !== "__custom")
                run((c) => c.updateAttributes("codeBlock", { language: language || null }));
            }}
          >
            {CODE_LANGUAGES.map((language) => (
              <option key={language} value={language}>
                {language || "纯文本"}
              </option>
            ))}
            {!CODE_LANGUAGES.includes(state.codeLanguage as (typeof CODE_LANGUAGES)[number]) ? (
              <option value="__custom">{state.codeLanguage}</option>
            ) : null}
          </select>
        </label>
        <span className="context-note">导出 Markdown 时写入 ``` 语言标记</span>
      </div>
    );
  return null;
}
