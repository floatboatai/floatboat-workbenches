// ABOUTME: 内置近似渲染：把 FigCraft 节点树画成 DOM（自动布局→flex）与 SVG（矢量、椭圆）。
import { memo, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode, type RefObject } from "react";
import { childrenOf, type FigDocument, type FigNode } from "../contracts/figdoc";
import { isRecord } from "../contracts/project";
import {
  BLEND,
  cornerRadii,
  cssBackground,
  ellipsePath,
  gradientOf,
  layerBlur,
  networkPath,
  nodeTransform,
  rgba,
  shadows,
  strokeLook,
  textLook,
  visiblePaints,
} from "../contracts/paint";

export interface Overrides {
  texts: Record<string, string>;
  fills: Record<string, string>;
}
const SHAPES = new Set(["vector", "ellipse", "polygon", "star", "line", "arrow"]);
const num = (v: unknown, d = 0) => (typeof v === "number" && Number.isFinite(v) ? v : d);
const JUSTIFY: Record<string, string> = { min: "flex-start", center: "center", max: "flex-end", spaceBetween: "space-between" };
const ALIGN: Record<string, string> = { min: "flex-start", center: "center", max: "flex-end", baseline: "baseline", stretch: "stretch" };

function solid(hex: string) {
  return [
    {
      type: "solid",
      color: { r: parseInt(hex.slice(1, 3), 16) / 255, g: parseInt(hex.slice(3, 5), 16) / 255, b: parseInt(hex.slice(5, 7), 16) / 255, a: 1 },
      visible: true,
      opacity: 1,
    },
  ];
}
export function layoutMode(node: FigNode): "row" | "column" | "grid" | null {
  const l = node.layout;
  if (!isRecord(l)) return null;
  return l.mode === "horizontal" ? "row" : l.mode === "vertical" ? "column" : l.mode === "grid" ? "grid" : null;
}
function sizing(node: FigNode, inFlow: boolean, axis: "h" | "v"): "fixed" | "fill" | "hug" {
  const cl = isRecord(node.child_layout) ? node.child_layout : {};
  const raw = axis === "h" ? cl.sizing_h : cl.sizing_v;
  if (node.type === "text") {
    const mode = node.auto_resize;
    if (axis === "v") return mode === "none" || mode === "truncate" ? (raw === "fill" && inFlow ? "fill" : "fixed") : "hug";
    if (raw === "fill" && inFlow) return "fill";
    return mode === "height" || mode === "none" || mode === "truncate" ? "fixed" : "hug";
  }
  if (raw === "fill") return inFlow ? "fill" : "fixed";
  if (raw === "hug" && layoutMode(node)) return "hug";
  return "fixed";
}

function boxStyle(node: FigNode, parentMode: ReturnType<typeof layoutMode>, root: boolean, fills: unknown): CSSProperties {
  const cl = isRecord(node.child_layout) ? node.child_layout : {};
  const inFlow = !root && parentMode !== null && cl.absolute !== true;
  const style: CSSProperties = { boxSizing: "border-box", position: root || inFlow ? "relative" : "absolute" };
  if (!root && !inFlow) {
    const t = nodeTransform(node);
    style.left = t.x;
    style.top = t.y;
    if (t.matrix) {
      style.transform = t.matrix;
      style.transformOrigin = "0 0";
    }
  }
  const main = parentMode === "row" ? "h" : parentMode === "column" ? "v" : null;
  for (const axis of ["h", "v"] as const) {
    const size = root ? "fixed" : sizing(node, inFlow, axis);
    const prop = axis === "h" ? "width" : "height";
    const value = axis === "h" ? node.width : node.height;
    if (size === "fixed") {
      style[prop] = value;
      style.flexShrink = 0;
    } else if (size === "fill") {
      if (main === axis) {
        style.flex = "1 1 0px";
        style[axis === "h" ? "minWidth" : "minHeight"] = 0;
      } else style.alignSelf = "stretch";
    } else style.flexShrink = 0;
  }
  for (const [key, prop] of [
    ["min_w", "minWidth"],
    ["max_w", "maxWidth"],
    ["min_h", "minHeight"],
    ["max_h", "maxHeight"],
  ] as const)
    if (typeof cl[key] === "number") style[prop] = cl[key] as number;
  const mode = layoutMode(node);
  if (mode && isRecord(node.layout)) {
    const l = node.layout;
    const pad = Array.isArray(l.padding) ? l.padding.map((v) => num(v)) : [0, 0, 0, 0];
    // “描边计入布局”：描边厚度并入内边距（与引擎排版一致）。
    const included = l.strokes_included === true ? strokeLook(node) : null;
    if (included) {
      const k = included.align === "center" ? 0.5 : included.align === "inside" ? 1 : 0;
      for (let i = 0; i < 4; i++) pad[i] = (pad[i] ?? 0) + k * (included.sides ? included.sides[i] : included.weight);
    }
    style.padding = `${pad[0]}px ${pad[1]}px ${pad[2]}px ${pad[3]}px`;
    if (mode === "grid") {
      style.display = "grid";
      style.gridTemplateColumns = `repeat(${Math.max(1, num(l.grid_columns, 2))}, minmax(0, auto))`;
      style.columnGap = num(l.gap);
      style.rowGap = num(l.cross_gap, num(l.gap));
    } else {
      style.display = "flex";
      style.flexDirection = mode;
      style.flexWrap = l.wrap === true ? "wrap" : "nowrap";
      style.justifyContent = JUSTIFY[String(l.main_align)] ?? "flex-start";
      style.alignItems = ALIGN[String(l.cross_align)] ?? "flex-start";
      if (l.wrap === true) {
        style[mode === "row" ? "columnGap" : "rowGap"] = num(l.gap);
        style[mode === "row" ? "rowGap" : "columnGap"] = num(l.cross_gap);
        style.alignContent = "flex-start";
      } else style.gap = num(l.gap);
    }
  }
  if (node.clip === true) style.overflow = "hidden";
  if (typeof node.opacity === "number" && node.opacity < 1) style.opacity = Math.max(0, node.opacity);
  if (typeof node.blend === "string" && BLEND[node.blend]) style.mixBlendMode = BLEND[node.blend] as CSSProperties["mixBlendMode"];
  const blur = layerBlur(node);
  if (blur) style.filter = `blur(${blur / 2}px)`;
  if (!SHAPES.has(node.type) && node.type !== "text") {
    const bg = cssBackground(fills, node.width, node.height);
    if (bg) style.background = bg;
    const r = cornerRadii(node);
    if (r.some(Boolean)) style.borderRadius = `${r[0]}px ${r[1]}px ${r[2]}px ${r[3]}px`;
    const shadowList: string[] = [];
    const stroke = strokeLook(node);
    if (stroke) {
      if (stroke.sides) {
        const [t, r, b, l] = stroke.sides;
        const inset = stroke.align !== "outside";
        const parts: [number, number, number][] = [
          [0, t, t],
          [-r, 0, r],
          [0, -b, b],
          [l, 0, l],
        ];
        for (const [x, y, w] of parts)
          if (w > 0) shadowList.push(`${inset ? "inset " : ""}${inset ? x : -x}px ${inset ? y : -y}px 0 0 ${stroke.color}`);
      } else if (stroke.dashed) {
        style.outline = `${stroke.weight}px dashed ${stroke.color}`;
        style.outlineOffset = stroke.align === "inside" ? -stroke.weight : stroke.align === "center" ? -stroke.weight / 2 : 0;
      } else if (stroke.align === "inside") shadowList.push(`inset 0 0 0 ${stroke.weight}px ${stroke.color}`);
      else if (stroke.align === "outside") shadowList.push(`0 0 0 ${stroke.weight}px ${stroke.color}`);
      else shadowList.push(`inset 0 0 0 ${stroke.weight / 2}px ${stroke.color}`, `0 0 0 ${stroke.weight / 2}px ${stroke.color}`);
    }
    for (const s of shadows(node)) shadowList.push(`${s.inset ? "inset " : ""}${s.x}px ${s.y}px ${s.blur}px ${s.spread}px ${s.color}`);
    if (shadowList.length) style.boxShadow = shadowList.join(",");
  }
  return style;
}

function ShapeSvg({ node, fills }: { node: FigNode; fills: unknown }) {
  const paints = visiblePaints(fills);
  const stroke = strokeLook(node);
  let fillPath = "",
    strokePath = "",
    rule: "nonzero" | "evenodd" = "nonzero";
  let ellipse = false;
  const w = node.width,
    h = node.height;
  if (node.type === "vector") {
    const p = networkPath(node);
    fillPath = p.fill || (paints.length ? p.stroke : "");
    strokePath = p.stroke;
    rule = p.rule;
  } else if (node.type === "ellipse") {
    const d = ellipsePath(node);
    if (d) fillPath = strokePath = d;
    else ellipse = true;
  } else if (node.type === "line" || node.type === "arrow") {
    strokePath = `M0 0L${w} 0`;
  } else {
    const count = Math.max(3, Math.round(num(node.count ?? node.point_count ?? node.points, node.type === "star" ? 5 : 3)));
    const inner = num(node.inner_radius ?? node.ratio, 0.382);
    const pts: string[] = [];
    const total = node.type === "star" ? count * 2 : count;
    for (let i = 0; i < total; i++) {
      const t = -Math.PI / 2 + (i * Math.PI * 2) / total;
      const r = node.type === "star" && i % 2 ? inner : 1;
      pts.push(`${w / 2 + (w / 2) * r * Math.cos(t)} ${h / 2 + (h / 2) * r * Math.sin(t)}`);
    }
    fillPath = strokePath = `M${pts.join("L")}Z`;
  }
  const defs: ReactNode[] = [];
  const shapes = paints.map((paint, i) => {
    let fill = "none",
      opacity = 1;
    if (paint.type === "solid") {
      fill = rgba(paint.color, num(paint.opacity, 1));
    } else {
      const g = gradientOf(paint);
      if (g && g.kind === "linear") {
        const id = `pg-${node.id}-${i}`;
        defs.push(
          <linearGradient key={id} id={id} x1={g.from[0]} y1={g.from[1]} x2={g.to[0]} y2={g.to[1]}>
            {g.stops.map((s, k) => (
              <stop key={k} offset={s.offset} stopColor={s.color} />
            ))}
          </linearGradient>,
        );
        fill = `url(#${id})`;
      } else if (g) {
        const id = `pg-${node.id}-${i}`;
        defs.push(
          <radialGradient key={id} id={id} cx={g.from[0]} cy={g.from[1]} r={0.5}>
            {g.stops.map((s, k) => (
              <stop key={k} offset={s.offset} stopColor={s.color} />
            ))}
          </radialGradient>,
        );
        fill = `url(#${id})`;
      } else {
        fill = "rgba(120,128,150,.35)";
        opacity = 0.8;
      }
    }
    return ellipse ? (
      <ellipse key={i} cx={w / 2} cy={h / 2} rx={w / 2} ry={h / 2} fill={fill} opacity={opacity} />
    ) : fillPath ? (
      <path key={i} d={fillPath} fill={fill} fillRule={rule} opacity={opacity} />
    ) : null;
  });
  return (
    <svg width={Math.max(w, 0.01)} height={Math.max(h, 0.01)} overflow="visible" style={{ position: "absolute", inset: 0, overflow: "visible" }} aria-hidden="true">
      {defs.length ? <defs>{defs}</defs> : null}
      {shapes}
      {stroke ? (
        ellipse ? (
          <ellipse cx={w / 2} cy={h / 2} rx={w / 2} ry={h / 2} fill="none" stroke={stroke.color} strokeWidth={stroke.weight} strokeDasharray={stroke.dashed ? "4 3" : undefined} />
        ) : strokePath ? (
          <path
            d={strokePath}
            fill="none"
            stroke={stroke.color}
            strokeWidth={stroke.weight}
            strokeLinecap={stroke.cap as "round" | "butt" | "square"}
            strokeLinejoin={stroke.join as "round" | "miter" | "bevel"}
            strokeDasharray={stroke.dashed ? "4 3" : undefined}
          />
        ) : null
      ) : null}
    </svg>
  );
}

interface NodeProps {
  doc: FigDocument;
  node: FigNode;
  parentMode: ReturnType<typeof layoutMode>;
  root?: boolean;
  overrides: Overrides;
  depth: number;
}
function NodeView({ doc, node, parentMode, root = false, overrides, depth }: NodeProps): ReactNode {
  if (node.visible === false || node.type === "slice" || depth > 120) return null;
  const fillDraft = overrides.fills[node.id];
  const fills = fillDraft ? solid(fillDraft) : node.fills;
  const style = boxStyle(node, parentMode, root, fills);
  const draftText = overrides.texts[node.id];
  const classes = ["pn"];
  if (draftText !== undefined && draftText !== node.characters) classes.push("pn-draft");
  if (fillDraft) classes.push("pn-draft");
  if (node.type === "text") {
    const look = textLook({ ...node, fills });
    const text = draftText ?? (typeof node.characters === "string" ? node.characters : "");
    const fixedWidth = sizing(node, parentMode !== null && !root, "h") !== "hug";
    const textShadow = shadows(node)
      .filter((s) => !s.inset)
      .map((s) => `${s.x}px ${s.y}px ${s.blur}px ${s.color}`)
      .join(",");
    return (
      <div
        className={classes.join(" ")}
        data-node={node.id}
        data-type="text"
        style={{
          ...style,
          display: "flex",
          flexDirection: "column",
          justifyContent: look.verticalAlign,
          color: look.color,
          fontFamily: look.fontFamily,
          fontWeight: look.fontWeight,
          fontStyle: look.fontStyle,
          fontSize: look.fontSize,
          lineHeight: look.lineHeight,
          letterSpacing: look.letterSpacing,
          textTransform: look.textTransform,
          textDecoration: look.textDecoration,
          textAlign: look.textAlign,
          whiteSpace: fixedWidth ? "pre-wrap" : "pre",
          overflowWrap: fixedWidth ? "break-word" : undefined,
          minHeight: look.lineHeightPx,
          textShadow: textShadow || undefined,
        }}
      >
        <span className="pn-text">{text || "​"}</span>
      </div>
    );
  }
  const mode = layoutMode(node);
  const kids = childrenOf(doc, node);
  return (
    <div className={classes.join(" ")} data-node={node.id} data-type={node.type} style={style}>
      {SHAPES.has(node.type) ? <ShapeSvg node={node} fills={fills} /> : null}
      {kids.map((child) => (
        <NodeView key={child.id} doc={doc} node={child} parentMode={mode} overrides={overrides} depth={depth + 1} />
      ))}
    </div>
  );
}

/** 画板本体（不含缩放）；缩略图与舞台共用。 */
export const FrameRender = memo(function FrameRender({
  doc,
  frame,
  overrides,
}: {
  doc: FigDocument;
  frame: FigNode;
  overrides: Overrides;
}) {
  return <NodeView doc={doc} node={frame} parentMode={null} root overrides={overrides} depth={0} />;
});

const NO_OVERRIDES: Overrides = { texts: {}, fills: {} };
export const FrameThumb = memo(function FrameThumb({ doc, frame, width }: { doc: FigDocument; frame: FigNode; width: number }) {
  const scale = Math.min(width / Math.max(frame.width, 1), (width * 2.2) / Math.max(frame.height, 1));
  return (
    <span className="thumb" style={{ width: frame.width * scale, height: frame.height * scale }} aria-hidden="true">
      <span className="thumb-inner" style={{ transform: `scale(${scale})` }}>
        <FrameRender doc={doc} frame={frame} overrides={NO_OVERRIDES} />
      </span>
    </span>
  );
});

export function ProofStage({
  doc,
  frame,
  overrides,
  selected,
  zoom,
  onSelect,
  onOpenText,
  rootRef,
}: {
  doc: FigDocument;
  frame: FigNode;
  overrides: Overrides;
  selected: number | null;
  zoom: "fit" | number;
  onSelect: (id: number) => void;
  onOpenText: (id: number) => void;
  rootRef: RefObject<HTMLDivElement | null>;
}) {
  const viewport = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState({ w: 800, h: 600 });
  const [marker, setMarker] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  useLayoutEffect(() => {
    const el = viewport.current;
    if (!el) return;
    const update = () => setBox({ w: el.clientWidth, h: el.clientHeight });
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  const fit = Math.min((box.w - 48) / Math.max(frame.width, 1), (box.h - 48) / Math.max(frame.height, 1), 2);
  const scale = Math.max(0.05, zoom === "fit" ? fit : zoom);
  useLayoutEffect(() => {
    const root = rootRef.current;
    const el = selected === null ? null : root?.querySelector<HTMLElement>(`[data-node="${selected}"]`);
    if (!root || !el || el === root.firstElementChild) {
      setMarker(null);
      return;
    }
    const a = root.getBoundingClientRect(),
      b = el.getBoundingClientRect();
    setMarker({ x: (b.left - a.left) / scale, y: (b.top - a.top) / scale, w: b.width / scale, h: b.height / scale });
  }, [selected, scale, doc, frame, overrides, rootRef]);
  const pick = (target: EventTarget | null) => {
    const el = target instanceof Element ? target.closest<HTMLElement>("[data-node]") : null;
    return el ? Number(el.dataset.node) : null;
  };
  return (
    <div className="stage-viewport" ref={viewport}>
      <div className="stage-sizer" style={{ width: frame.width * scale, height: frame.height * scale }}>
        <div
          className="stage-frame"
          ref={rootRef}
          style={{ width: frame.width, height: frame.height, transform: `scale(${scale})` }}
          data-scale={scale}
          onClick={(e) => {
            const id = pick(e.target);
            if (id !== null) onSelect(id);
          }}
          onDoubleClick={(e) => {
            const id = pick(e.target);
            if (id !== null && doc.nodes[String(id)]?.type === "text") onOpenText(id);
          }}
        >
          <FrameRender doc={doc} frame={frame} overrides={overrides} />
          {marker ? (
            <span
              className="select-marker"
              style={{ left: marker.x, top: marker.y, width: marker.w, height: marker.h, borderWidth: 1.5 / scale }}
              aria-hidden="true"
            />
          ) : null}
        </div>
      </div>
    </div>
  );
}
