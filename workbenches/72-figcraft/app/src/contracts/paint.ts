// ABOUTME: 把 FigCraft 节点的填充、矢量网络、文字样式换算成 CSS/SVG 值（纯函数，界面与测试共用）。
import { isRecord } from "./project.ts";
import type { FigNode, Paint } from "./figdoc.ts";

const num = (v: unknown, d = 0) => (typeof v === "number" && Number.isFinite(v) ? v : d);
const clamp = (v: number) => Math.max(0, Math.min(1, v));

export function rgba(color: unknown, opacity = 1): string {
  if (!isRecord(color)) return "rgba(0,0,0,0)";
  const c = (v: unknown) => Math.round(clamp(num(v)) * 255);
  const a = Math.round(clamp(num(color.a, 1) * opacity) * 1000) / 1000;
  return `rgba(${c(color.r)},${c(color.g)},${c(color.b)},${a})`;
}
export const visiblePaints = (paints: unknown): Paint[] =>
  Array.isArray(paints) ? paints.filter((p): p is Paint => isRecord(p) && typeof p.type === "string" && p.visible !== false) : [];

export interface GradientStop {
  offset: number;
  color: string;
}
export interface LinearGradient {
  kind: "linear" | "radial" | "angular" | "diamond";
  from: [number, number];
  to: [number, number];
  stops: GradientStop[];
}
export function gradientOf(paint: Paint): LinearGradient | null {
  if (paint.type !== "gradient" || !Array.isArray(paint.stops)) return null;
  const opacity = num(paint.opacity, 1);
  const pt = (v: unknown, d: [number, number]): [number, number] =>
    Array.isArray(v) && v.length >= 2 ? [num(v[0], d[0]), num(v[1], d[1])] : d;
  const kind = paint.kind === "radial" || paint.kind === "angular" || paint.kind === "diamond" ? paint.kind : "linear";
  return {
    kind,
    from: pt(paint.from, [0.5, 0]),
    to: pt(paint.to, [0.5, 1]),
    stops: paint.stops
      .filter(isRecord)
      .map((s) => ({ offset: clamp(num(s.position)), color: rgba(s.color, opacity) })),
  };
}
/** 物理尺寸下的 CSS 线性渐变角度（0deg 朝上，顺时针）。 */
export function cssAngle(g: LinearGradient, width: number, height: number): number {
  const dx = (g.to[0] - g.from[0]) * width,
    dy = (g.to[1] - g.from[1]) * height;
  return Math.round(((Math.atan2(dy, dx) * 180) / Math.PI + 90 + 360) % 360);
}
/** CSS background 列表：Figma 顺序为自底向上，CSS 为自顶向下。 */
export function cssBackground(paints: unknown, width: number, height: number): string | undefined {
  const layers = visiblePaints(paints)
    .map((p) => {
      if (p.type === "solid") {
        const c = rgba(p.color, num(p.opacity, 1));
        return `linear-gradient(${c},${c})`;
      }
      const g = gradientOf(p);
      if (g) {
        const stops = g.stops.map((s) => `${s.color} ${Math.round(s.offset * 1000) / 10}%`).join(",");
        if (g.kind === "radial" || g.kind === "diamond")
          return `radial-gradient(ellipse at ${g.from[0] * 100}% ${g.from[1] * 100}%,${stops})`;
        if (g.kind === "angular") return `conic-gradient(from 90deg at ${g.from[0] * 100}% ${g.from[1] * 100}%,${stops})`;
        return `linear-gradient(${cssAngle(g, width, height)}deg,${stops})`;
      }
      if (p.type === "image")
        return "repeating-linear-gradient(45deg,rgba(120,128,150,.35) 0 6px,rgba(120,128,150,.18) 6px 12px)";
      return "";
    })
    .filter(Boolean)
    .reverse();
  return layers.length ? layers.join(",") : undefined;
}
/** 文字、矢量取最上层可见纯色；渐变取首个色标作近似。 */
export function topColor(paints: unknown): string | undefined {
  const list = visiblePaints(paints);
  for (let i = list.length - 1; i >= 0; i--) {
    const p = list[i];
    if (p.type === "solid") return rgba(p.color, num(p.opacity, 1));
    const g = gradientOf(p);
    if (g?.stops.length) return g.stops[0].color;
  }
  return undefined;
}

type Vertex = { x: number; y: number };
type Segment = { a: number; b: number; ta: [number, number]; tb: [number, number] };
function readNetwork(node: FigNode) {
  const net = node.network;
  if (!isRecord(net) || !Array.isArray(net.vertices) || !Array.isArray(net.segments)) return null;
  const vertices: Vertex[] = net.vertices.map((v) => (isRecord(v) ? { x: num(v.x), y: num(v.y) } : { x: 0, y: 0 }));
  const tan = (v: unknown): [number, number] => (Array.isArray(v) ? [num(v[0]), num(v[1])] : [0, 0]);
  const segments: Segment[] = net.segments
    .filter(isRecord)
    .map((s) => ({ a: num(s.a), b: num(s.b), ta: tan(s.ta), tb: tan(s.tb) }))
    .filter((s) => vertices[s.a] && vertices[s.b]);
  const regions = Array.isArray(net.regions) ? net.regions.filter(isRecord) : [];
  return { vertices, segments, regions };
}
const f = (v: number) => String(Math.round(v * 1000) / 1000);
function curve(from: Vertex, to: Vertex, t1: [number, number], t2: [number, number]): string {
  if (!t1[0] && !t1[1] && !t2[0] && !t2[1]) return `L${f(to.x)} ${f(to.y)}`;
  return `C${f(from.x + t1[0])} ${f(from.y + t1[1])} ${f(to.x + t2[0])} ${f(to.y + t2[1])} ${f(to.x)} ${f(to.y)}`;
}
/** 矢量网络 → SVG path：有 regions 时按环生成可填充的闭合路径，否则按线段串接。 */
export function networkPath(node: FigNode): { fill: string; stroke: string; rule: "nonzero" | "evenodd" } {
  const net = readNetwork(node);
  if (!net) return { fill: "", stroke: "", rule: "nonzero" };
  const { vertices, segments, regions } = net;
  const chain = (indices: number[]): string => {
    let d = "",
      start = -1,
      cur = -1;
    indices.forEach((si, k) => {
      const s = segments[si];
      if (!s) return;
      let forward = true;
      if (cur === -1) {
        const next = segments[indices[k + 1]];
        forward = !next || next.a === s.b || next.b === s.b;
        start = forward ? s.a : s.b;
        d += `M${f(vertices[start].x)} ${f(vertices[start].y)}`;
        cur = start;
      } else forward = s.a === cur;
      if (!forward && s.b !== cur) {
        d += `M${f(vertices[s.a].x)} ${f(vertices[s.a].y)}`;
        forward = true;
      }
      const from = vertices[forward ? s.a : s.b],
        to = vertices[forward ? s.b : s.a];
      d += forward ? curve(from, to, s.ta, s.tb) : curve(from, to, s.tb, s.ta);
      cur = forward ? s.b : s.a;
    });
    return cur === start && d ? d + "Z" : d;
  };
  let rule: "nonzero" | "evenodd" = "nonzero";
  const fill = regions
    .map((r) => {
      if (r.winding === "evenOdd" || r.winding === "evenodd") rule = "evenodd";
      return Array.isArray(r.loops)
        ? r.loops.filter(Array.isArray).map((loop) => chain(loop.filter((x): x is number => typeof x === "number"))).join("")
        : "";
    })
    .join("");
  // 把首尾相接的线段串成描边子路径。
  let stroke = "",
    run: number[] = [];
  segments.forEach((s, i) => {
    const prev = segments[run[run.length - 1]];
    if (run.length && prev && (prev.b === s.a || prev.a === s.a || prev.b === s.b)) run.push(i);
    else {
      if (run.length) stroke += chain(run);
      run = [i];
    }
  });
  if (run.length) stroke += chain(run);
  // 描边覆盖全部线段（含不属于任何区域的开放线段，如放大镜手柄）。
  return { fill, stroke, rule };
}
/** 椭圆/圆弧/圆环（start、sweep、inner）。 */
export function ellipsePath(node: FigNode): string | null {
  const w = node.width,
    h = node.height,
    sweep = num(node.sweep, Math.PI * 2),
    start = num(node.start),
    inner = clamp(num(node.inner));
  if (Math.abs(sweep) >= Math.PI * 2 - 1e-6 && inner === 0) return null;
  const rx = w / 2,
    ry = h / 2,
    steps = Math.max(8, Math.ceil((Math.abs(sweep) / (Math.PI * 2)) * 72));
  const ring = (scale: number, reverse: boolean) => {
    const pts: string[] = [];
    for (let i = 0; i <= steps; i++) {
      const t = start + (sweep * (reverse ? steps - i : i)) / steps;
      pts.push(`${f(rx + rx * scale * Math.cos(t))} ${f(ry + ry * scale * Math.sin(t))}`);
    }
    return pts;
  };
  const outer = ring(1, false);
  if (inner > 0) return `M${outer.join("L")}L${ring(inner, true).join("L")}Z`;
  return `M${f(rx)} ${f(ry)}L${outer.join("L")}Z`;
}

const WEIGHTS: [RegExp, number][] = [
  [/thin|hairline/i, 100],
  [/extra\s*light|ultra\s*light/i, 200],
  [/light/i, 300],
  [/semi\s*bold|demi\s*bold/i, 600],
  [/extra\s*bold|ultra\s*bold/i, 800],
  [/bold/i, 700],
  [/black|heavy/i, 900],
  [/medium/i, 500],
];
export interface TextLook {
  fontFamily: string;
  fontWeight: number;
  fontStyle: "normal" | "italic";
  fontSize: number;
  lineHeight: string;
  lineHeightPx: number;
  letterSpacing: string;
  textTransform?: "uppercase" | "lowercase" | "capitalize";
  textDecoration?: string;
  textAlign: "left" | "center" | "right" | "justify";
  verticalAlign: "flex-start" | "center" | "flex-end";
  color: string;
}
export function textLook(node: FigNode): TextLook {
  const s = isRecord(node.style) ? node.style : {};
  const size = num(s.font_size, 14);
  const styleName = typeof s.font_style === "string" ? s.font_style : "Regular";
  const lh = isRecord(s.line_height) ? s.line_height : {};
  const lineHeightPx =
    lh.unit === "pixels" ? num(lh.value, size * 1.2) : lh.unit === "percent" ? (size * num(lh.value, 120)) / 100 : size * 1.2;
  const ls = isRecord(s.letter_spacing) ? s.letter_spacing : {};
  const spacing = ls.unit === "pixels" ? `${num(ls.value)}px` : `${num(ls.value) / 100}em`;
  const family = typeof s.font_family === "string" && s.font_family ? s.font_family.replace(/["\\]/g, "") : "Inter";
  const align = String(s.text_align_h ?? node.text_align_h ?? "left").toLowerCase();
  const valign = String(s.text_align_v ?? node.text_align_v ?? "top").toLowerCase();
  const textCase = String(s.case ?? "original").toLowerCase();
  const deco = String(s.decoration ?? "none").toLowerCase();
  return {
    fontFamily: `"${family}", Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", "Helvetica Neue", Arial, "PingFang SC", "Noto Sans CJK SC", sans-serif`,
    fontWeight: WEIGHTS.find(([re]) => re.test(styleName))?.[1] ?? 400,
    fontStyle: /italic|oblique/i.test(styleName) ? "italic" : "normal",
    fontSize: size,
    lineHeight: `${lineHeightPx}px`,
    lineHeightPx,
    letterSpacing: spacing,
    textTransform: textCase === "upper" ? "uppercase" : textCase === "lower" ? "lowercase" : textCase === "title" ? "capitalize" : undefined,
    textDecoration: deco === "underline" ? "underline" : deco === "strikethrough" ? "line-through" : undefined,
    textAlign: align.startsWith("center") ? "center" : align.startsWith("right") ? "right" : align.startsWith("justif") ? "justify" : "left",
    verticalAlign: valign.startsWith("center") ? "center" : valign.startsWith("bottom") ? "flex-end" : "flex-start",
    color: topColor(node.fills) ?? "rgba(0,0,0,1)",
  };
}
export function cornerRadii(node: FigNode): [number, number, number, number] {
  const c = node.corners;
  if (isRecord(c) && Array.isArray(c.radii) && c.radii.length === 4)
    return c.radii.map((v) => Math.max(0, num(v))) as [number, number, number, number];
  const r = Math.max(0, num(node.corner_radius ?? node.radius));
  return [r, r, r, r];
}
export interface StrokeLook {
  color: string;
  weight: number;
  align: "inside" | "outside" | "center";
  dashed: boolean;
  cap: string;
  join: string;
  /** 分边粗细 [上, 右, 下, 左]；null 表示四边相同。 */
  sides: [number, number, number, number] | null;
}
export function strokeLook(node: FigNode): StrokeLook | null {
  const color = topColor(node.strokes);
  const s = isRecord(node.stroke) ? node.stroke : {};
  const weight = num(s.weight, 1);
  if (!color || weight <= 0) return null;
  const shape = ["vector", "ellipse", "polygon", "star", "line", "arrow", "text"].includes(node.type);
  const align =
    s.align === "inside" || s.align === "outside" || s.align === "center" ? s.align : shape ? "center" : "inside";
  const cap = s.cap_start === "round" || s.cap_end === "round" ? "round" : s.cap_start === "square" ? "square" : "butt";
  const join = s.join === "round" ? "round" : s.join === "bevel" ? "bevel" : "miter";
  const sides =
    Array.isArray(s.sides) && s.sides.length === 4 ? (s.sides.map((v) => Math.max(0, num(v))) as [number, number, number, number]) : null;
  return { color, weight, align, dashed: Array.isArray(s.dashes) && s.dashes.length > 0, cap, join, sides };
}
export interface ShadowLook {
  inset: boolean;
  x: number;
  y: number;
  blur: number;
  spread: number;
  color: string;
}
export function shadows(node: FigNode): ShadowLook[] {
  return (Array.isArray(node.effects) ? node.effects : [])
    .filter(isRecord)
    .filter((e) => e.visible !== false && (e.type === "dropShadow" || e.type === "innerShadow"))
    .map((e) => {
      const o = Array.isArray(e.offset) ? e.offset : [0, 0];
      return {
        inset: e.type === "innerShadow",
        x: num(o[0]),
        y: num(o[1]),
        blur: num(e.radius),
        spread: num(e.spread),
        color: rgba(e.color),
      };
    });
}
export function layerBlur(node: FigNode): number {
  const e = (Array.isArray(node.effects) ? node.effects : []).filter(isRecord).find((x) => x.visible !== false && x.type === "layerBlur");
  return e ? num(e.radius) : 0;
}
export const BLEND: Record<string, string> = {
  multiply: "multiply",
  screen: "screen",
  overlay: "overlay",
  darken: "darken",
  lighten: "lighten",
  colorDodge: "color-dodge",
  colorBurn: "color-burn",
  hardLight: "hard-light",
  softLight: "soft-light",
  difference: "difference",
  exclusion: "exclusion",
  hue: "hue",
  saturation: "saturation",
  color: "color",
  luminosity: "luminosity",
};
export function nodeTransform(node: FigNode): { x: number; y: number; matrix: string | null } {
  const t = Array.isArray(node.transform) && node.transform.length === 6 ? node.transform.map((v) => num(v)) : [1, 0, 0, 1, 0, 0];
  const identity = t[0] === 1 && t[1] === 0 && t[2] === 0 && t[3] === 1;
  return { x: t[4], y: t[5], matrix: identity ? null : `matrix(${t[0]},${t[1]},${t[2]},${t[3]},0,0)` };
}
