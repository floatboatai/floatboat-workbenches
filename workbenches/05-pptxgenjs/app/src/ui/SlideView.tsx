// ABOUTME: 幻灯片渲染（舞台、缩略图、放映共用）：以 96px/英寸的逻辑尺寸绘制母版装饰与元素，再整体缩放。
import { memo, useLayoutEffect, useRef, type CSSProperties, type ReactNode } from "react";
import { SLIDE_SIZES, type ImageElement, type ShapeElement, type Slide, type SlideElement, type TableElement, type TextElement, type Theme } from "../contracts/domain";
import { LAYOUTS, NUMBER_BOX, fontStack, resolveColor, slidePrompt } from "../contracts/layouts";
import { BULLET_INDENT_PT, LINE_HEIGHT, ROUND_RADIUS_IN, TABLE_MARGIN_IN, TEXT_MARGIN_PT, tableStyle } from "../shared/pptx-render";
import { ChartView } from "./ChartView";
import { useMedia } from "./media-client";
import { parseParagraphs, renderParagraphs } from "./richtext";

export const DPI = 96;
const PT = 4 / 3;
export function slidePixels(theme: Theme) {
  const size = SLIDE_SIZES[theme.aspect];
  return { w: size.w * DPI, h: size.h * DPI };
}
const hex = (ref: string, theme: Theme) => "#" + resolveColor(ref, theme);

export interface EditorBinding {
  id: string;
  onChange: (paragraphs: TextElement["paragraphs"]) => void;
  register: (node: HTMLDivElement | null) => void;
}

export const SlideView = memo(function SlideView({
  slide,
  theme,
  number,
  mode,
  editor,
}: {
  slide: Slide;
  theme: Theme;
  number: number;
  mode: "stage" | "thumb" | "show";
  editor?: EditorBinding | null;
}) {
  const layout = LAYOUTS[slide.layout];
  const size = slidePixels(theme);
  const X = (pct: number) => (pct / 100) * size.w;
  const Y = (pct: number) => (pct / 100) * size.h;
  return (
    <div
      className="slide-surface"
      style={{ width: size.w, height: size.h, background: hex(layout.background, theme), fontFamily: fontStack(theme.bodyFont) }}
      aria-hidden={mode === "thumb" ? true : undefined}
    >
      {layout.decor.map((d, i) =>
        d.kind === "rect" ? (
          <div key={i} className="decor" style={{ left: X(d.x), top: Y(d.y), width: X(d.w), height: Y(d.h), background: hex(d.fill ?? "accent", theme) }} />
        ) : (
          <div
            key={i}
            className="decor decor-text"
            style={{
              left: X(d.x),
              top: Y(d.y),
              width: X(d.w),
              height: Y(d.h),
              color: hex(d.color ?? "text", theme),
              fontSize: (d.size ?? 18) * PT,
              fontFamily: fontStack(d.font === "head" ? theme.headFont : theme.bodyFont),
            }}
          >
            {d.text}
          </div>
        ),
      )}
      {slide.elements.map((el) => (
        <ElementView key={el.id} el={el} slide={slide} theme={theme} size={size} mode={mode} editor={editor?.id === el.id ? editor : null} />
      ))}
      {layout.numberColor ? (
        <div
          className="slide-number"
          style={{
            left: X(NUMBER_BOX.x),
            top: Y(NUMBER_BOX.y),
            width: X(NUMBER_BOX.w),
            height: Y(NUMBER_BOX.h),
            color: hex(layout.numberColor, theme),
            fontSize: NUMBER_BOX.size * PT,
          }}
        >
          {number}
        </div>
      ) : null}
    </div>
  );
});

function ElementView({
  el,
  slide,
  theme,
  size,
  mode,
  editor,
}: {
  el: SlideElement;
  slide: Slide;
  theme: Theme;
  size: { w: number; h: number };
  mode: "stage" | "thumb" | "show";
  editor: EditorBinding | null;
}) {
  const box: CSSProperties = {
    left: (el.x / 100) * size.w,
    top: (el.y / 100) * size.h,
    width: (el.w / 100) * size.w,
    height: (el.h / 100) * size.h,
  };
  switch (el.type) {
    case "text":
      return <TextView el={el} theme={theme} box={box} prompt={mode === "stage" ? slidePrompt(slide.layout, el.slot) : ""} editor={editor} />;
    case "image":
      return <ImageView el={el} box={box} mode={mode} />;
    case "table":
      return <TableView el={el} theme={theme} box={box} />;
    case "chart":
      return (
        <div className="el el-chart" style={box}>
          <ChartView el={el} theme={theme} width={Number(box.width)} height={Number(box.height)} />
        </div>
      );
    default:
      return <ShapeView el={el} theme={theme} box={box} />;
  }
}

function textBoxStyle(el: TextElement, theme: Theme, box: CSSProperties): CSSProperties {
  return {
    ...box,
    padding: TEXT_MARGIN_PT * PT,
    justifyContent: el.valign === "top" ? "flex-start" : el.valign === "middle" ? "center" : "flex-end",
    background: el.fill ? hex(el.fill, theme) : undefined,
    color: hex(el.color, theme),
    fontFamily: fontStack(el.font === "head" ? theme.headFont : theme.bodyFont),
    fontSize: el.size * PT,
    fontWeight: el.bold ? 700 : 400,
    fontStyle: el.italic ? "italic" : undefined,
    textAlign: el.align,
    lineHeight: LINE_HEIGHT * el.lineSpacing,
    ["--para-after" as string]: `${el.spaceAfter * PT}px`,
    ["--bullet" as string]: `${BULLET_INDENT_PT * PT}px`,
  };
}

function TextView({ el, theme, box, prompt, editor }: { el: TextElement; theme: Theme; box: CSSProperties; prompt: string; editor: EditorBinding | null }) {
  const empty = el.paragraphs.every((p) => p.runs.every((r) => !r.text));
  return (
    <div className={"el el-text" + (empty && prompt ? " is-empty" : "")} style={textBoxStyle(el, theme, box)}>
      {editor ? (
        <RichEditor el={el} theme={theme} editor={editor} />
      ) : empty && prompt ? (
        <div className="text-prompt">{prompt}</div>
      ) : (
        <div className="text-body">
          {el.paragraphs.map((p, i) => (
            <div key={i} className="para" data-bullet={p.bullet ? "1" : undefined} data-level={p.level || undefined}>
              {p.runs.some((r) => r.text) ? p.runs.map((run, j) => <RunView key={j} run={run} theme={theme} />) : <br />}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
function RunView({ run, theme }: { run: TextElement["paragraphs"][number]["runs"][number]; theme: Theme }) {
  let node: ReactNode = run.text;
  if (run.bold) node = <b>{node}</b>;
  if (run.italic) node = <i>{node}</i>;
  if (run.underline) node = <u>{node}</u>;
  if (run.color) node = <span style={{ color: hex(run.color, theme) }}>{node}</span>;
  if (run.link) node = <span className="run-link">{node}</span>;
  return <>{node}</>;
}

/** contentEditable surface; initial content is written once, later edits flow out through onChange. */
const RichEditor = memo(
  function RichEditor({ el, theme, editor }: { el: TextElement; theme: Theme; editor: EditorBinding }) {
    const ref = useRef<HTMLDivElement>(null);
    const latest = useRef({ theme, editor });
    latest.current = { theme, editor };
    useLayoutEffect(() => {
      const node = ref.current;
      if (!node) return;
      renderParagraphs(node, el.paragraphs, theme);
      editor.register(node);
      node.focus();
      const selection = getSelection();
      if (selection) {
        selection.selectAllChildren(node);
        selection.collapseToEnd();
      }
      return () => latest.current.editor.register(null);
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    return (
      <div
        ref={ref}
        className="text-body rich-editor"
        contentEditable
        suppressContentEditableWarning
        role="textbox"
        aria-multiline="true"
        aria-label="编辑文字"
        spellCheck={false}
        onInput={(event) => latest.current.editor.onChange(parseParagraphs(event.currentTarget, latest.current.theme))}
        onPaste={(event) => {
          event.preventDefault();
          const text = event.clipboardData.getData("text/plain");
          document.execCommand("insertText", false, text);
        }}
      />
    );
  },
  (a, b) => a.el.id === b.el.id,
);

function ImageView({ el, box, mode }: { el: ImageElement; box: CSSProperties; mode: string }) {
  const { url, error, record } = useMedia(el.mediaId);
  if (!el.mediaId)
    return mode === "stage" ? (
      <div className="el el-image is-empty" style={box}>
        <span>双击插入图片</span>
      </div>
    ) : null;
  return (
    <div className="el el-image" style={box}>
      {url ? <img src={url} alt={el.alt} width={record?.width} height={record?.height} decoding="async" draggable={false} style={{ objectFit: el.fit }} /> : <span className="image-loading">{error ? "图片缺失" : ""}</span>}
    </div>
  );
}

function TableView({ el, theme, box }: { el: TableElement; theme: Theme; box: CSSProperties }) {
  const style = tableStyle(el, theme);
  const rowH = Number(box.height) / el.rows.length;
  return (
    <div className="el el-table" style={box}>
      <table style={{ fontSize: el.size * PT, fontFamily: fontStack(theme.bodyFont), borderColor: "#" + style.border }}>
        <tbody>
          {el.rows.map((row, ri) => (
            <tr key={ri} style={{ height: rowH }}>
              {row.map((cell, ci) => (
                <td
                  key={ci}
                  style={{
                    background: "#" + style.rowFill(ri),
                    color: "#" + (el.header && ri === 0 ? style.header.color : style.text),
                    fontWeight: el.header && ri === 0 ? 700 : 400,
                    padding: TABLE_MARGIN_IN * DPI,
                    borderColor: "#" + style.border,
                  }}
                >
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ShapeView({ el, theme, box }: { el: ShapeElement; theme: Theme; box: CSSProperties }) {
  const w = Number(box.width),
    h = Number(box.height);
  const fill = el.fill ? hex(el.fill, theme) : "none";
  const stroke = el.line && (el.lineWidth > 0 || el.shape === "line") ? hex(el.line, theme) : "none";
  const sw = (el.shape === "line" ? Math.max(el.lineWidth, 0.5) : el.lineWidth) * PT;
  let shape: ReactNode;
  switch (el.shape) {
    case "rect":
      shape = <rect x={0} y={0} width={w} height={h} />;
      break;
    case "roundRect": {
      const r = Math.min(ROUND_RADIUS_IN * DPI, w / 2, h / 2);
      shape = <rect x={0} y={0} width={w} height={h} rx={r} ry={r} />;
      break;
    }
    case "ellipse":
      shape = <ellipse cx={w / 2} cy={h / 2} rx={w / 2} ry={h / 2} />;
      break;
    case "triangle":
      shape = <polygon points={`${w / 2},0 ${w},${h} 0,${h}`} />;
      break;
    case "rightArrow": {
      const head = Math.min(w, h) * 0.5;
      shape = <polygon points={`0,${h * 0.25} ${w - head},${h * 0.25} ${w - head},0 ${w},${h / 2} ${w - head},${h} ${w - head},${h * 0.75} 0,${h * 0.75}`} />;
      break;
    }
    default:
      shape = <line x1={0} y1={0} x2={w} y2={h} />;
  }
  return (
    <div className="el el-shape" style={box}>
      <svg width={Math.max(w, 1)} height={Math.max(h, 1)} overflow="visible" fill={el.shape === "line" ? "none" : fill} stroke={stroke} strokeWidth={sw}>
        {shape}
      </svg>
      {el.text.trim() && el.shape !== "line" ? (
        <div
          className="shape-text"
          style={{ color: hex(el.textColor, theme), fontSize: el.size * PT, padding: TEXT_MARGIN_PT * PT, lineHeight: LINE_HEIGHT, fontFamily: fontStack(theme.bodyFont) }}
        >
          {el.text}
        </div>
      ) : null}
    </div>
  );
}

/** Renders a slide scaled to a given pixel width. */
export function ScaledSlide({ slide, theme, number, width, mode }: { slide: Slide; theme: Theme; number: number; width: number; mode: "thumb" | "show" }) {
  const size = slidePixels(theme);
  const scale = width / size.w;
  return (
    <div className="scaled-slide" style={{ width, height: size.h * scale }}>
      <div style={{ transform: `scale(${scale})`, transformOrigin: "0 0", width: size.w, height: size.h }}>
        <SlideView slide={slide} theme={theme} number={number} mode={mode} />
      </div>
    </div>
  );
}
