// ABOUTME: 交互舞台：选择、拖动、八向缩放（吸附参考线）、双击就地编辑富文本与格式条。
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type MutableRefObject, type PointerEvent as ReactPointerEvent } from "react";
import { Bold, Italic, Underline, Link2, Unlink, List, IndentIncrease, IndentDecrease, Check } from "lucide-react";
import { COLOR_ROLES, type Paragraph, type Slide, type SlideElement, type Theme } from "../contracts/domain";
import { COLOR_LABELS, resolveColor } from "../contracts/layouts";
import { SlideView, slidePixels, type EditorBinding } from "./SlideView";
import { moveBox, resizeBox, clampBox, patchElement, type Box, type Guide, type Handle } from "./geometry";
import { linkIsValid, parseParagraphs, selectedBlocks } from "./richtext";

const HANDLES: Handle[] = ["nw", "n", "ne", "e", "se", "s", "sw", "w"];
const TYPE_LABEL: Record<SlideElement["type"], string> = { text: "文本", image: "图片", table: "表格", chart: "图表", shape: "形状" };

export function elementLabel(el: SlideElement): string {
  if (el.type === "text") {
    const text = el.paragraphs
      .map((p) => p.runs.map((r) => r.text).join(""))
      .join(" ")
      .trim();
    return `文本：${text.slice(0, 24) || "空"}`;
  }
  if (el.type === "chart") return `图表：${el.title || { bar: "柱形图", line: "折线图", area: "面积图", pie: "饼图", doughnut: "环形图" }[el.chart]}`;
  if (el.type === "image") return `图片：${el.alt || (el.mediaId ? "已插入" : "空图框")}`;
  return TYPE_LABEL[el.type];
}

interface Drag {
  id: string;
  mode: "move" | Handle;
  startX: number;
  startY: number;
  start: Box;
  others: Box[];
  moved: boolean;
  session: number;
}

export function Stage({
  slide,
  theme,
  number,
  selectedId,
  editingId,
  onSelect,
  onEdit,
  onSlide,
  onActivate,
}: {
  slide: Slide;
  theme: Theme;
  number: number;
  selectedId: string | null;
  editingId: string | null;
  onSelect: (id: string | null) => void;
  onEdit: (id: string | null) => void;
  onSlide: (update: (slide: Slide) => Slide, key?: string) => void;
  onActivate: (el: SlideElement) => void;
}) {
  const viewport = useRef<HTMLDivElement>(null);
  const frame = useRef<HTMLDivElement>(null);
  const [fit, setFit] = useState({ w: 960, h: 540 });
  const [guides, setGuides] = useState<Guide[]>([]);
  const drag = useRef<Drag | null>(null);
  const sessions = useRef(0);
  const editorNode = useRef<HTMLDivElement | null>(null);
  const size = slidePixels(theme);
  const ratio = size.h / size.w;

  useLayoutEffect(() => {
    const node = viewport.current;
    if (!node) return;
    const measure = () => {
      const pad = window.innerWidth < 720 ? 12 : 32;
      const availW = Math.max(160, node.clientWidth - pad * 2),
        availH = Math.max(120, node.clientHeight - pad * 2);
      const w = Math.min(availW, availH / ratio);
      setFit({ w: Math.floor(w), h: Math.floor(w * ratio) });
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, [ratio]);

  const scale = fit.w / size.w;
  const selected = slide.elements.find((el) => el.id === selectedId) ?? null;
  const editing = slide.elements.find((el) => el.id === editingId && el.type === "text") ?? null;

  const onSlideRef = useRef(onSlide);
  onSlideRef.current = onSlide;
  const editor = useMemo<EditorBinding | null>(
    () =>
      editing
        ? {
            id: editing.id,
            register: (node) => {
              editorNode.current = node;
            },
            onChange: (paragraphs: Paragraph[]) =>
              onSlideRef.current((s) => patchElement(s, editing.id, (el) => (el.type === "text" ? { ...el, paragraphs } : el)), `text:${editing.id}`),
          }
        : null,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [editing?.id],
  );

  function beginDrag(event: ReactPointerEvent, el: SlideElement, mode: Drag["mode"]) {
    if (event.button !== 0) return;
    event.stopPropagation();
    if (editingId && editingId !== el.id) onEdit(null);
    onSelect(el.id);
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
    drag.current = {
      id: el.id,
      mode,
      startX: event.clientX,
      startY: event.clientY,
      start: { x: el.x, y: el.y, w: el.w, h: el.h },
      others: slide.elements.filter((o) => o.id !== el.id),
      moved: false,
      session: ++sessions.current,
    };
  }
  function onPointerMove(event: ReactPointerEvent) {
    const d = drag.current;
    if (!d) return;
    const dxPx = event.clientX - d.startX,
      dyPx = event.clientY - d.startY;
    if (!d.moved && Math.hypot(dxPx, dyPx) < 3) return;
    d.moved = true;
    const dx = (dxPx / fit.w) * 100,
      dy = (dyPx / fit.h) * 100;
    const tx = (6 / fit.w) * 100,
      ty = (6 / fit.h) * 100;
    const snap = !event.altKey;
    const el = slide.elements.find((x) => x.id === d.id);
    const isLine = el?.type === "shape" && el.shape === "line";
    const result =
      d.mode === "move"
        ? moveBox(d.start, dx, dy, d.others, snap, tx, ty)
        : resizeBox(d.start, d.mode, dx, dy, d.others, {
            snap,
            keepRatio: event.shiftKey || el?.type === "image",
            minW: isLine ? 0 : 1,
            minH: isLine ? 0 : 1,
            tx,
            ty,
          });
    setGuides(result.guides);
    const box = clampBox(result.box);
    onSlideRef.current((s) => patchElement(s, d.id, (item) => ({ ...item, ...box })), `drag:${d.session}`);
  }
  function endDrag() {
    drag.current = null;
    setGuides([]);
  }

  return (
    <div
      className="stage-viewport"
      ref={viewport}
      onPointerDown={(event) => {
        if (event.target === event.currentTarget) {
          onEdit(null);
          onSelect(null);
        }
      }}
    >
      <div className="stage-frame" ref={frame} style={{ width: fit.w, height: fit.h }}>
        <div
          className="stage-canvas"
          style={{ width: size.w, height: size.h, transform: `scale(${scale})` }}
          onPointerDown={(event) => {
            if (!(event.target as HTMLElement).closest(".rich-editor")) {
              onEdit(null);
              onSelect(null);
            }
          }}
        >
          <SlideView slide={slide} theme={theme} number={number} mode="stage" editor={editor} />
        </div>
        <div
          className="stage-overlay"
          onPointerDown={(event) => {
            if (event.target === event.currentTarget) {
              onEdit(null);
              onSelect(null);
            }
          }}
          onPointerMove={onPointerMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
        >
          {slide.elements.map((el) =>
            el.id === editingId ? null : (
              <div
                key={el.id}
                className={"hit" + (el.id === selectedId ? " is-selected" : "") + (el.type === "shape" && el.shape === "line" ? " is-line" : "")}
                style={{ left: `${el.x}%`, top: `${el.y}%`, width: `${el.w}%`, height: `${el.h}%` }}
                tabIndex={0}
                role="button"
                aria-label={elementLabel(el)}
                aria-pressed={el.id === selectedId}
                data-element-id={el.id}
                onFocus={() => {
                  if (selectedId !== el.id) onSelect(el.id);
                }}
                onPointerDown={(event) => beginDrag(event, el, "move")}
                onPointerMove={onPointerMove}
                onPointerUp={endDrag}
                onDoubleClick={() => (el.type === "text" ? onEdit(el.id) : onActivate(el))}
              />
            ),
          )}
          {selected ? (
            <div
              className={"selection" + (editing ? " is-editing" : "")}
              style={{ left: `${selected.x}%`, top: `${selected.y}%`, width: `${selected.w}%`, height: `${selected.h}%` }}
            >
              {editing
                ? null
                : HANDLES.map((handle) => (
                    <span
                      key={handle}
                      className={`handle h-${handle}`}
                      onPointerDown={(event) => beginDrag(event, selected, handle)}
                      onPointerMove={onPointerMove}
                      onPointerUp={endDrag}
                      aria-hidden="true"
                    />
                  ))}
            </div>
          ) : null}
          {guides.map((g, i) => (
            <div key={i} className={`guide guide-${g.axis}`} style={g.axis === "x" ? { left: `${g.at}%` } : { top: `${g.at}%` }} />
          ))}
          {editing ? <FormatBar el={editing} theme={theme} editorNode={editorNode} onDone={() => onEdit(null)} onCommit={editor!.onChange} /> : null}
        </div>
      </div>
    </div>
  );
}

function FormatBar({
  el,
  theme,
  editorNode,
  onDone,
  onCommit,
}: {
  el: SlideElement;
  theme: Theme;
  editorNode: MutableRefObject<HTMLDivElement | null>;
  onDone: () => void;
  onCommit: (paragraphs: Paragraph[]) => void;
}) {
  const [linking, setLinking] = useState(false);
  const [link, setLink] = useState("https://");
  const saved = useRef<Range | null>(null);
  const below = el.y < 14;
  const sync = () => {
    const node = editorNode.current;
    if (node) onCommit(parseParagraphs(node, theme));
  };
  const run = (command: string, value?: string) => {
    document.execCommand("styleWithCSS", false, "false");
    document.execCommand(command, false, value);
    sync();
  };
  const keep = (event: { preventDefault: () => void }) => event.preventDefault();
  const toggleBullets = () => {
    const node = editorNode.current;
    if (!node) return;
    const blocks = selectedBlocks(node);
    const target = blocks.length ? blocks : [...node.querySelectorAll<HTMLElement>(":scope > div")];
    const on = !target.every((b) => b.dataset.bullet === "1");
    target.forEach((b) => (on ? (b.dataset.bullet = "1") : delete b.dataset.bullet));
    sync();
  };
  const indent = (delta: number) => {
    const node = editorNode.current;
    if (!node) return;
    for (const block of selectedBlocks(node)) {
      const level = Math.max(0, Math.min(2, Number(block.dataset.level ?? 0) + delta));
      if (level) block.dataset.level = String(level);
      else delete block.dataset.level;
    }
    sync();
  };
  useEffect(() => {
    const listener = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onDone();
      }
    };
    const node = editorNode.current;
    node?.addEventListener("keydown", listener);
    return () => node?.removeEventListener("keydown", listener);
  });
  return (
    <div
      className={"format-bar" + (below ? " is-below" : "")}
      style={{ left: `${Math.max(0, Math.min(el.x, 60))}%`, top: below ? `${el.y + el.h}%` : `${el.y}%` }}
      onPointerDown={(event) => event.stopPropagation()}
      role="toolbar"
      aria-label="文字格式"
    >
      {linking ? (
        <form
          className="link-form"
          onSubmit={(event) => {
            event.preventDefault();
            if (!linkIsValid(link)) return;
            const selection = getSelection();
            if (saved.current && selection) {
              editorNode.current?.focus();
              selection.removeAllRanges();
              selection.addRange(saved.current);
            }
            run("createLink", link.trim());
            setLinking(false);
          }}
        >
          <input
            aria-label="链接地址"
            name="link"
            autoComplete="off"
            value={link}
            autoFocus
            onChange={(event) => setLink(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Escape") {
                event.stopPropagation();
                setLinking(false);
                editorNode.current?.focus();
              }
            }}
            aria-invalid={!linkIsValid(link)}
          />
          <button type="submit" disabled={!linkIsValid(link)}>
            添加
          </button>
          <button type="button" onClick={() => setLinking(false)}>
            取消
          </button>
        </form>
      ) : (
        <>
          <button type="button" aria-label="加粗" title="加粗 ⌘B" onMouseDown={keep} onClick={() => run("bold")}>
            <Bold size={15} aria-hidden="true" />
          </button>
          <button type="button" aria-label="斜体" title="斜体 ⌘I" onMouseDown={keep} onClick={() => run("italic")}>
            <Italic size={15} aria-hidden="true" />
          </button>
          <button type="button" aria-label="下划线" title="下划线 ⌘U" onMouseDown={keep} onClick={() => run("underline")}>
            <Underline size={15} aria-hidden="true" />
          </button>
          <span className="format-sep" aria-hidden="true" />
          {COLOR_ROLES.filter((r) => r !== "background" && r !== "surface").map((role) => (
            <button
              key={role}
              type="button"
              className="swatch"
              aria-label={`文字颜色：${COLOR_LABELS[role]}`}
              title={COLOR_LABELS[role]}
              style={{ background: "#" + resolveColor(role, theme) }}
              onMouseDown={keep}
              onClick={() => {
                run("foreColor", "#" + resolveColor(role, theme));
                const node = editorNode.current;
                node?.querySelectorAll(`font[color="#${resolveColor(role, theme).toLowerCase()}"], font[color="#${resolveColor(role, theme)}"]`).forEach((f) => f.setAttribute("data-color", role));
                sync();
              }}
            />
          ))}
          <span className="format-sep" aria-hidden="true" />
          <button type="button" aria-label="项目符号" title="项目符号" onMouseDown={keep} onClick={toggleBullets}>
            <List size={15} aria-hidden="true" />
          </button>
          <button type="button" aria-label="减少缩进" title="减少缩进" onMouseDown={keep} onClick={() => indent(-1)}>
            <IndentDecrease size={15} aria-hidden="true" />
          </button>
          <button type="button" aria-label="增加缩进" title="增加缩进" onMouseDown={keep} onClick={() => indent(1)}>
            <IndentIncrease size={15} aria-hidden="true" />
          </button>
          <button
            type="button"
            aria-label="添加链接"
            title="为选中文字添加链接"
            onMouseDown={keep}
            onClick={() => {
              const selection = getSelection();
              saved.current = selection && selection.rangeCount ? selection.getRangeAt(0).cloneRange() : null;
              setLink("https://");
              setLinking(true);
            }}
          >
            <Link2 size={15} aria-hidden="true" />
          </button>
          <button type="button" aria-label="移除链接" title="移除链接" onMouseDown={keep} onClick={() => run("unlink")}>
            <Unlink size={15} aria-hidden="true" />
          </button>
          <span className="format-sep" aria-hidden="true" />
          <button type="button" className="format-done" onMouseDown={keep} onClick={onDone}>
            <Check size={15} aria-hidden="true" />
            完成
          </button>
        </>
      )}
    </div>
  );
}
