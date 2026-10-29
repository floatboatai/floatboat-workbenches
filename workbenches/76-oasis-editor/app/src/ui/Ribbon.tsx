import { useState, type ReactNode } from "react";
import {
  AlignCenter, AlignJustify, AlignLeft, AlignRight, Baseline, Bold, Highlighter, IndentDecrease, IndentIncrease,
  Italic, List, ListOrdered, Redo2, RemoveFormatting, Search, Strikethrough, Subscript, Superscript, Underline, Undo2,
} from "lucide-react";
import type { OasisEditorClient } from "oasis-editor";
import { Group, HIGHLIGHTS, Popover, Swatches, TEXT_COLORS, Tool, type EditorSnapshot, type Run } from "./ribbon-kit";
import { InsertTools, LayoutTools, TableTools } from "./RibbonTabs";
import { ReviewTools, selectInEditor } from "./ReviewTools";
import { bodyReturnPosition } from "../contracts/review";
const ZONE_NAMES: Record<string, string> = { footnote: "脚注", header: "页眉", footer: "页脚" };

export type RibbonTab = "home" | "insert" | "table" | "review" | "layout";
const STYLE_NAMES: Record<string, string> = {
  normal: "正文", heading1: "标题 1", heading2: "标题 2", heading3: "标题 3", heading4: "标题 4",
  Caption: "题注", Title: "标题", Subtitle: "副标题", Quote: "引用", ListParagraph: "列表段落",
};
const FONTS = [
  { value: "Workbench Sans SC", label: "Workbench Sans SC" }, { value: "SimSun", label: "宋体" },
  { value: "SimHei", label: "黑体" }, { value: "Microsoft YaHei", label: "微软雅黑" },
  { value: "FangSong", label: "仿宋" }, { value: "KaiTi", label: "楷体" }, { value: "DengXian", label: "等线" },
  { value: "Calibri", label: "Calibri" }, { value: "Times New Roman", label: "Times New Roman" },
  { value: "Arial", label: "Arial" },
];
const SIZES: [string, number][] = [
  ["初号", 42], ["小初", 36], ["一号", 26], ["小一", 24], ["二号", 22], ["小二", 18], ["三号", 16], ["小三", 15],
  ["四号", 14], ["小四", 12], ["五号", 10.5], ["小五", 9], ["8", 8], ["10", 10], ["11", 11], ["20", 20], ["28", 28], ["48", 48],
];
const LINE_HEIGHTS = ["1", "1.15", "1.5", "2", "2.5", "3"];
const fontName = (value: unknown) => String(value ?? "").split(",")[0].replace(/["']/g, "").trim();
/** Command state values carry pixel sizes; Word UI speaks in points. */
function sizeInPoints(value: unknown): number | null {
  const n = typeof value === "number" ? value : Number.parseFloat(String(value ?? ""));
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.round(n * 2) / 2;
}

export function Ribbon({
  client,
  snapshot,
  tab,
  setTab,
  disabled,
  run,
  author,
  setAuthor,
  onTrackChange,
  onComment,
  commentsOpen,
  toggleComments,
  onImage,
}: {
  client: OasisEditorClient | null;
  snapshot: EditorSnapshot;
  tab: RibbonTab;
  setTab: (tab: RibbonTab) => void;
  disabled: boolean;
  run: Run;
  author: string;
  setAuthor: (name: string) => void;
  onTrackChange: (enabled: boolean) => void;
  onComment: () => void;
  commentsOpen: boolean;
  toggleComments: (trigger: HTMLElement) => void;
  onImage: (file: File) => void;
}) {
  const inTable = !!snapshot.states.tableContext?.active;
  const shown: RibbonTab = tab === "table" && !inTable ? "home" : tab;
  const tabs: [RibbonTab, string][] = [
    ["home", "开始"], ["insert", "插入"], ...(inTable ? [["table", "表格"] as [RibbonTab, string]] : []),
    ["review", "审阅"], ["layout", "布局"],
  ];
  return (
    <nav className="ribbon" aria-label="编辑功能区">
      <div className="ribbon-tabs">
        <div role="tablist" aria-label="功能区选项卡">
          {tabs.map(([id, label]) => (
            <button
              key={id}
              id={"ribbon-tab-" + id}
              role="tab"
              type="button"
              className={id === "table" ? "contextual" : undefined}
              aria-selected={shown === id}
              aria-controls="ribbon-panel"
              tabIndex={shown === id ? 0 : -1}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => setTab(id)}
              onKeyDown={(event) => {
                if (event.key !== "ArrowRight" && event.key !== "ArrowLeft") return;
                const i = tabs.findIndex(([t]) => t === shown);
                const next = tabs[(i + (event.key === "ArrowRight" ? 1 : tabs.length - 1)) % tabs.length][0];
                setTab(next);
                requestAnimationFrame(() => document.getElementById("ribbon-tab-" + next)?.focus());
              }}
            >
              {label}
            </button>
          ))}
        </div>
        {snapshot.zone !== "main" && client && (
          <div className="zone-chip" role="status">
            正在编辑{ZONE_NAMES[snapshot.zone] ?? snapshot.zone}
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                const at = bodyReturnPosition(client.getDocument(), snapshot.footnoteId);
                if (at) selectInEditor(client, { anchor: at, focus: at });
              }}
            >
              返回正文
            </button>
          </div>
        )}
        <div className="ribbon-quick">
          <Tool label="撤销 (Ctrl+Z)" icon={<Undo2 size={16} />} disabled={disabled || !snapshot.canUndo} onClick={() => run("undo")} />
          <Tool label="重做 (Ctrl+Y)" icon={<Redo2 size={16} />} disabled={disabled || !snapshot.canRedo} onClick={() => run("redo")} />
          <Tool label="查找和替换 (Ctrl+F)" icon={<Search size={16} />} disabled={disabled} onClick={() => run("find")} />
        </div>
      </div>
      <div
        id="ribbon-panel"
        className="ribbon-panel"
        role="tabpanel"
        aria-labelledby={"ribbon-tab-" + shown}
        onFocusCapture={(event) => {
          if (event.target instanceof HTMLElement)
            event.target.scrollIntoView({ block: "nearest", inline: "nearest", behavior: "auto" });
        }}
      >
        {shown === "home" && <HomeTools snapshot={snapshot} disabled={disabled} run={run} />}
        {shown === "insert" && <InsertTools snapshot={snapshot} disabled={disabled} run={run} onImage={onImage} />}
        {shown === "table" && <TableTools snapshot={snapshot} disabled={disabled} run={run} />}
        {shown === "review" && (
          <ReviewTools
            client={client}
            snapshot={snapshot}
            disabled={disabled}
            run={run}
            author={author}
            setAuthor={setAuthor}
            onTrackChange={onTrackChange}
            onComment={onComment}
            commentsOpen={commentsOpen}
            toggleComments={toggleComments}
          />
        )}
        {shown === "layout" && <LayoutTools client={client} snapshot={snapshot} disabled={disabled} run={run} />}
      </div>
    </nav>
  );
}

function Select({
  label,
  value,
  disabled,
  onChange,
  className,
  children,
}: {
  label: string;
  value: string;
  disabled: boolean;
  onChange: (value: string) => void;
  className?: string;
  children: ReactNode;
}) {
  return (
    <select
      aria-label={label}
      title={label}
      className={"ribbon-select " + (className ?? "")}
      value={value}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value)}
    >
      {children}
    </select>
  );
}

function HomeTools({ snapshot, disabled, run }: { snapshot: EditorSnapshot; disabled: boolean; run: Run }) {
  const s = snapshot.states;
  const on = (name: keyof typeof s) => !!s[name]?.active;
  const styleId = String(s.setStyleId?.value ?? "normal");
  const paragraphStyles = snapshot.styles
    .filter((x) => x.type === "paragraph" && (x.qFormat || x.id === styleId) && (!x.semiHidden || x.id === styleId))
    .sort((a, b) => (a.uiPriority ?? 99) - (b.uiPriority ?? 99));
  if (!paragraphStyles.some((x) => x.id === styleId)) paragraphStyles.push({ id: styleId, name: styleId, type: "paragraph" });
  const font = fontName(s.setFontFamily?.value);
  const pt = sizeInPoints(s.setFontSize?.value);
  const sizeValue = pt === null ? "" : String(pt);
  const lineHeight = String(s.setLineHeight?.value ?? "");
  const [lastColor, setLastColor] = useState("#c00000");
  const [lastHighlight, setLastHighlight] = useState("#ffff00");
  return (
    <>
      <Group label="样式">
        <Select label="段落样式" className="style-select" value={styleId} disabled={disabled} onChange={(v) => run("setStyleId", v)}>
          {paragraphStyles.map((x) => (
            <option key={x.id} value={x.id}>
              {STYLE_NAMES[x.id] ?? x.name}
            </option>
          ))}
        </Select>
      </Group>
      <Group label="字符格式">
        <Select label="字体" className="font-select" value={font} disabled={disabled} onChange={(v) => run("setFontFamily", v)}>
          {!FONTS.some((f) => f.value === font) && <option value={font}>{font || "（混合）"}</option>}
          {FONTS.map((f) => (
            <option key={f.value} value={f.value}>
              {f.label}
            </option>
          ))}
        </Select>
        <Select label="字号（磅）" className="size-select" value={sizeValue} disabled={disabled} onChange={(v) => run("setFontSize", Number(v))}>
          {!SIZES.some(([, n]) => String(n) === sizeValue) && <option value={sizeValue}>{sizeValue || "—"}</option>}
          {SIZES.map(([name, n]) => (
            <option key={name} value={String(n)}>
              {name === String(n) ? n : `${name} ${n}`}
            </option>
          ))}
        </Select>
        <Tool label="加粗 (Ctrl+B)" icon={<Bold size={16} />} active={on("bold")} disabled={disabled} onClick={() => run("bold")} />
        <Tool label="倾斜 (Ctrl+I)" icon={<Italic size={16} />} active={on("italic")} disabled={disabled} onClick={() => run("italic")} />
        <Tool label="下划线 (Ctrl+U)" icon={<Underline size={16} />} active={on("underline")} disabled={disabled} onClick={() => run("underline")} />
        <Tool label="删除线" icon={<Strikethrough size={16} />} active={on("strike")} disabled={disabled} onClick={() => run("strike")} />
        <Tool label="上标" icon={<Superscript size={16} />} active={on("superscript")} disabled={disabled} onClick={() => run("superscript")} />
        <Tool label="下标" icon={<Subscript size={16} />} active={on("subscript")} disabled={disabled} onClick={() => run("subscript")} />
        <div className="split-tool">
          <Tool
            label="字体颜色"
            icon={<Baseline size={16} style={{ borderBottom: `3px solid ${lastColor}` }} />}
            disabled={disabled}
            onClick={() => run("setColor", lastColor)}
          />
          <Popover label="选择字体颜色" trigger={null} disabled={disabled}>
            {(close) => (
              <Swatches
                colors={TEXT_COLORS}
                none="自动（黑色）"
                onPick={(c) => {
                  if (c) setLastColor(c);
                  run("setColor", c);
                  close();
                }}
              />
            )}
          </Popover>
        </div>
        <div className="split-tool">
          <Tool
            label="突出显示"
            icon={<Highlighter size={16} style={{ borderBottom: `3px solid ${lastHighlight}` }} />}
            disabled={disabled}
            onClick={() => run("setHighlight", lastHighlight)}
          />
          <Popover label="选择突出显示颜色" trigger={null} disabled={disabled}>
            {(close) => (
              <Swatches
                colors={HIGHLIGHTS}
                none="无颜色"
                onPick={(c) => {
                  if (c) setLastHighlight(c);
                  run("setHighlight", c);
                  close();
                }}
              />
            )}
          </Popover>
        </div>
        <Tool label="清除格式" icon={<RemoveFormatting size={16} />} disabled={disabled} onClick={() => run("clearFormatting")} />
      </Group>
      <Group label="段落">
        <Tool label="左对齐" icon={<AlignLeft size={16} />} active={on("alignLeft")} disabled={disabled} onClick={() => run("alignLeft")} />
        <Tool label="居中" icon={<AlignCenter size={16} />} active={on("alignCenter")} disabled={disabled} onClick={() => run("alignCenter")} />
        <Tool label="右对齐" icon={<AlignRight size={16} />} active={on("alignRight")} disabled={disabled} onClick={() => run("alignRight")} />
        <Tool label="两端对齐" icon={<AlignJustify size={16} />} active={on("alignJustify")} disabled={disabled} onClick={() => run("alignJustify")} />
        <Tool label="项目符号" icon={<List size={16} />} active={on("bulletList")} disabled={disabled} onClick={() => run("bulletList")} />
        <Tool label="编号" icon={<ListOrdered size={16} />} active={on("orderedList")} disabled={disabled} onClick={() => run("orderedList")} />
        <Tool label="减少缩进" icon={<IndentDecrease size={16} />} disabled={disabled} onClick={() => run("outdent")} />
        <Tool label="增加缩进" icon={<IndentIncrease size={16} />} disabled={disabled} onClick={() => run("indent")} />
        <Select label="行距" className="line-select" value={LINE_HEIGHTS.includes(lineHeight) ? lineHeight : ""} disabled={disabled} onChange={(v) => run("setLineHeight", Number(v))}>
          {!LINE_HEIGHTS.includes(lineHeight) && <option value="">行距</option>}
          {LINE_HEIGHTS.map((v) => (
            <option key={v} value={v}>
              {v} 倍行距
            </option>
          ))}
        </Select>
      </Group>
    </>
  );
}
