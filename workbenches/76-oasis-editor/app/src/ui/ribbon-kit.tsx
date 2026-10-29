import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { OasisCommandName, OasisEditorClient } from "oasis-editor";
import { firstPage, listRevisions, type PageSettings } from "../contracts/review";

export type CommandState = { enabled: boolean; active: boolean; value: unknown };
export type DocStyle = { id: string; name: string; type: string; qFormat?: boolean; semiHidden?: boolean; uiPriority?: number };
export type Run = (name: OasisCommandName, payload?: unknown) => void;
export type EditorSnapshot = {
  states: Partial<Record<OasisCommandName, CommandState>>;
  track: boolean;
  collapsed: boolean;
  canUndo: boolean;
  canRedo: boolean;
  styles: DocStyle[];
  revisions: number;
  comments: number;
  commentsKey: string;
  showMargins: boolean;
  showMarks: boolean;
  page: PageSettings | null;
  /** Story holding the caret: main, header, footer or footnote. */
  zone: string;
  footnoteId: string | null;
};
const WATCHED: OasisCommandName[] = [
  "bold", "italic", "underline", "strike", "superscript", "subscript",
  "alignLeft", "alignCenter", "alignRight", "alignJustify", "bulletList", "orderedList",
  "setStyleId", "setFontFamily", "setFontSize", "setLineHeight", "setColor", "setHighlight",
  "link", "unlink", "insertFootnote", "insertImageCaption", "tableContext", "tableMerge", "tableSplit",
  "tableToggleHeaderRow", "tableToggleBandedRows", "tableToggleFirstColumn", "setTableStyle",
  "tableDeleteRow", "tableDeleteColumn", "acceptRevisions", "rejectRevisions", "imageContext",
];
export const EMPTY_SNAPSHOT: EditorSnapshot = {
  states: {}, track: false, collapsed: true, canUndo: false, canRedo: false, styles: [], revisions: 0, comments: 0, commentsKey: "",
  showMargins: false, showMarks: false, page: null, zone: "main", footnoteId: null,
};
function read(client: OasisEditorClient): EditorSnapshot {
  const states: EditorSnapshot["states"] = {};
  for (const name of WATCHED) {
    try {
      const s = client.commands.state(name);
      states[name] = { enabled: s.isEnabled, active: s.isActive, value: s.value };
    } catch {
      states[name] = { enabled: false, active: false, value: null };
    }
  }
  const state = client.getState();
  const sel = state.selection;
  const raw = client.commands.state("documentStyles").value;
  const doc = state.document;
  return {
    states,
    track: !!(state as { trackChangesEnabled?: boolean }).trackChangesEnabled,
    collapsed: sel.anchor.paragraphId === sel.focus.paragraphId && sel.anchor.runId === sel.focus.runId && sel.anchor.offset === sel.focus.offset,
    canUndo: client.history.canUndo(),
    canRedo: client.history.canRedo(),
    styles: Array.isArray(raw) ? (raw as DocStyle[]) : [],
    revisions: new Set(listRevisions(doc).map((r) => r.id)).size,
    comments: doc.comments?.order.length ?? 0,
    commentsKey: (doc.comments?.order ?? []).map((id) => id + (doc.comments?.items[id]?.resolved ? "+" : "")).join(),
    showMargins: !!(state as { showMargins?: boolean }).showMargins,
    showMarks: !!(state as { showParagraphMarks?: boolean }).showParagraphMarks,
    page: firstPage(doc) ?? null,
    zone: state.activeZone ?? "main",
    footnoteId: state.activeFootnoteId ?? null,
  };
}
const same = (a: EditorSnapshot, b: EditorSnapshot) => JSON.stringify(a) === JSON.stringify(b);

/** Command states for the ribbon, refreshed once per frame after editor changes. */
export function useEditorSnapshot(client: OasisEditorClient | null) {
  const [snapshot, setSnapshot] = useState(EMPTY_SNAPSHOT);
  const frame = useRef(0);
  const refresh = useCallback(() => {
    if (!client || frame.current) return;
    frame.current = requestAnimationFrame(() => {
      frame.current = 0;
      try {
        const next = read(client);
        setSnapshot((prev) => (same(prev, next) ? prev : next));
      } catch {
        /* editor disposed between frames */
      }
    });
  }, [client]);
  useEffect(() => {
    if (!client) {
      setSnapshot(EMPTY_SNAPSHOT);
      return;
    }
    refresh();
    const offs = [client.on("change", refresh), client.on("selectionChange", refresh), client.on("uiChange", refresh)];
    return () => {
      offs.forEach((off) => off());
      cancelAnimationFrame(frame.current);
      frame.current = 0;
    };
  }, [client, refresh]);
  return [snapshot, refresh] as const;
}

/** Keep the editor's hidden textarea focused so the model selection survives clicks. */
const keepSelection = (event: React.MouseEvent) => event.preventDefault();

export function Tool({
  label,
  icon,
  onClick,
  active,
  disabled,
  wide,
  title,
  className,
}: {
  label: string;
  icon?: ReactNode;
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
  wide?: boolean;
  title?: string;
  className?: string;
}) {
  return (
    <button
      type="button"
      className={"tool" + (wide || !icon ? " tool-wide" : "") + (active ? " is-active" : "") + (className ? " " + className : "")}
      aria-label={wide || !icon ? undefined : label}
      aria-pressed={active === undefined ? undefined : active}
      title={title ?? label}
      disabled={disabled}
      onMouseDown={keepSelection}
      onClick={onClick}
    >
      {icon}
      {(wide || !icon) && <span>{label}</span>}
    </button>
  );
}
export function Group({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="ribbon-group" role="group" aria-label={label}>
      {children}
    </div>
  );
}

/** Small disclosure menu anchored under its trigger; Escape and outside clicks close it. */
export function Popover({
  label,
  trigger,
  disabled,
  active,
  wide,
  children,
}: {
  label: string;
  trigger: ReactNode;
  disabled?: boolean;
  active?: boolean;
  wide?: boolean;
  children: (close: () => void) => ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const [place, setPlace] = useState<{ left: number; top: number }>({ left: 0, top: 0 });
  const id = useId();
  const close = useCallback((refocus = true) => {
    setOpen(false);
    if (refocus) button.current?.focus();
  }, []);
  useEffect(() => {
    if (!open) return;
    const r = button.current!.getBoundingClientRect();
    const width = panel.current?.offsetWidth ?? 240;
    setPlace({ left: Math.max(8, Math.min(r.left, window.innerWidth - width - 8)), top: r.bottom + 4 });
    panel.current?.querySelector<HTMLElement>("button:not(:disabled),input,select")?.focus();
    const outside = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) close(false);
    };
    const key = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        close();
      }
    };
    document.addEventListener("pointerdown", outside, true);
    document.addEventListener("keydown", key, true);
    return () => {
      document.removeEventListener("pointerdown", outside, true);
      document.removeEventListener("keydown", key, true);
    };
  }, [open, close]);
  return (
    <div className="popover-anchor" ref={root}>
      <button
        ref={button}
        type="button"
        className={"tool tool-menu" + (wide ? " tool-wide" : "") + (active ? " is-active" : "")}
        aria-haspopup="true"
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        aria-label={wide ? undefined : label}
        title={label}
        disabled={disabled}
        onMouseDown={keepSelection}
        onClick={() => setOpen((v) => !v)}
      >
        {trigger}
        <span className="caret" aria-hidden="true">▾</span>
      </button>
      {open && (
        <div
          ref={panel}
          id={id}
          className="popover"
          role="group"
          aria-label={label}
          style={{ left: place.left, top: place.top }}
        >
          {children(() => close())}
        </div>
      )}
    </div>
  );
}

export function Swatches({
  colors,
  none,
  onPick,
}: {
  colors: { value: string; name: string }[];
  none: string;
  onPick: (value: string | null) => void;
}) {
  return (
    <div className="swatches">
      <button type="button" className="swatch-none" onMouseDown={keepSelection} onClick={() => onPick(null)}>
        {none}
      </button>
      <div className="swatch-grid">
        {colors.map((c) => (
          <button
            type="button"
            key={c.value}
            className="swatch"
            style={{ background: c.value }}
            aria-label={c.name}
            title={c.name}
            onMouseDown={keepSelection}
            onClick={() => onPick(c.value)}
          />
        ))}
      </div>
    </div>
  );
}
export const TEXT_COLORS = [
  { value: "#000000", name: "黑色" }, { value: "#404040", name: "深灰" }, { value: "#7f7f7f", name: "灰色" },
  { value: "#c00000", name: "深红" }, { value: "#ff0000", name: "红色" }, { value: "#ffc000", name: "橙色" },
  { value: "#ffff00", name: "黄色" }, { value: "#92d050", name: "浅绿" }, { value: "#00b050", name: "绿色" },
  { value: "#00b0f0", name: "浅蓝" }, { value: "#0070c0", name: "蓝色" }, { value: "#002060", name: "深蓝" },
  { value: "#7030a0", name: "紫色" }, { value: "#1f4e79", name: "墨蓝" }, { value: "#833c0b", name: "褐色" },
];
export const HIGHLIGHTS = [
  { value: "#ffff00", name: "黄色" }, { value: "#00ff00", name: "鲜绿" }, { value: "#00ffff", name: "青绿" },
  { value: "#ff00ff", name: "粉红" }, { value: "#c0c0c0", name: "浅灰" }, { value: "#ff0000", name: "红色" },
];
export const SHADES = [
  { value: "#f2f2f2", name: "浅灰" }, { value: "#d9e2f3", name: "浅蓝" }, { value: "#e2efda", name: "浅绿" },
  { value: "#fff2cc", name: "浅黄" }, { value: "#fbe4d5", name: "浅橙" }, { value: "#ededed", name: "银灰" },
  { value: "#4472c4", name: "蓝色" }, { value: "#70ad47", name: "绿色" }, { value: "#7f7f7f", name: "灰色" },
];
