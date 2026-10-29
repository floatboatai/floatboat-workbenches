// ABOUTME: 版式几何：把一页幻灯片排成英寸坐标的图元（矩形、文字、列表、图片、图表）；舞台、PDF 与 PPTX 三个渲染器共用，字号按同一估算自动收缩。
import type { Chart, ImageRef, Slide } from "../contracts/model.ts";
import { mix, type Theme } from "./themes.ts";

export const SLIDE_W = 13.333;
export const SLIDE_H = 7.5;
export type Field = "title" | "subtitle" | "bullets" | "bullets2" | "columnTitles" | "stats" | "chart" | "image";
export type Align = "left" | "center" | "right";
export type VAlign = "top" | "middle" | "bottom";
export type TextPrim = {
  k: "text";
  field?: Field;
  x: number;
  y: number;
  w: number;
  h: number;
  text: string;
  size: number;
  color: string;
  head: boolean;
  bold: boolean;
  italic?: boolean;
  align: Align;
  valign: VAlign;
  lh: number;
};
export type ListPrim = {
  k: "list";
  field: Field;
  x: number;
  y: number;
  w: number;
  h: number;
  items: string[];
  size: number;
  color: string;
  marker: "dot" | "number" | "dash";
  markerColor: string;
  lh: number;
  /** Space between items, in multiples of the font size. */
  gap: number;
};
export type Prim =
  | { k: "rect"; x: number; y: number; w: number; h: number; fill: string; radius?: number }
  | { k: "ellipse"; x: number; y: number; w: number; h: number; fill: string }
  | { k: "line"; x1: number; y1: number; x2: number; y2: number; color: string; width: number }
  | TextPrim
  | ListPrim
  | { k: "image"; field: "image"; x: number; y: number; w: number; h: number; image: ImageRef }
  | { k: "chart"; field: "chart"; x: number; y: number; w: number; h: number; chart: Chart };

/** Approximate advance width of a string in em, used identically by all renderers to pick font sizes. */
export function textUnits(text: string): number {
  let u = 0;
  for (const ch of text) {
    const c = ch.codePointAt(0) ?? 0;
    if (c >= 0x2e80 || (c >= 0x3000 && c <= 0x30ff) || (c >= 0xff00 && c <= 0xffef)) u += 1;
    else if (ch === " ") u += 0.28;
    else if (/[A-Z0-9#%@&]/.test(ch)) u += 0.62;
    else if (/[ijlft.,:;'|!]/.test(ch)) u += 0.3;
    else u += 0.52;
  }
  return u;
}
export const bulletIndent = (size: number) => (size * 1.25) / 72;
function linesFor(text: string, widthIn: number, size: number): number {
  const perLine = (widthIn * 72) / size;
  if (perLine <= 1) return 99;
  return text.split("\n").reduce((n, p) => n + Math.max(1, Math.ceil((textUnits(p) * 1.05) / perLine)), 0);
}
/** Largest font size (pt) between min and max whose wrapped height fits the box. */
export function fitSize(paras: string[], w: number, h: number, max: number, min: number, lh = 1.2, gap = 0, indent = false): number {
  for (let size = max; size > min; size -= 1) {
    const width = w - (indent ? bulletIndent(size) : 0);
    const lines = paras.reduce((n, p) => n + linesFor(p || " ", width, size), 0);
    const height = (lines * size * lh + Math.max(0, paras.length - 1) * gap * size) / 72;
    if (height <= h) return size;
  }
  return min;
}

const text = (
  t: Omit<TextPrim, "k" | "size" | "lh" | "bold" | "head" | "align" | "valign"> &
    Partial<Pick<TextPrim, "bold" | "head" | "align" | "valign" | "lh" | "italic">> & { max: number; min?: number },
): TextPrim => {
  const lh = t.lh ?? 1.2;
  return {
    k: "text",
    field: t.field,
    x: t.x,
    y: t.y,
    w: t.w,
    h: t.h,
    text: t.text,
    color: t.color,
    head: t.head ?? false,
    bold: t.bold ?? false,
    italic: t.italic,
    align: t.align ?? "left",
    valign: t.valign ?? "top",
    lh,
    size: fitSize([t.text], t.w, t.h, t.max, t.min ?? Math.min(t.max, 11), lh),
  };
};
const list = (l: Omit<ListPrim, "k" | "size" | "lh" | "gap"> & { max: number; min?: number; gap?: number }): ListPrim => {
  const gap = l.gap ?? 0.55;
  const items = l.items.filter((i) => i.trim());
  return { k: "list", field: l.field, x: l.x, y: l.y, w: l.w, h: l.h, items, color: l.color, marker: l.marker, markerColor: l.markerColor, lh: 1.25, gap, size: fitSize(items, l.w, l.h, l.max, l.min ?? 12, 1.25, gap, true) };
};

/** Largest size (≤ max) at which the text stays on one line in the given width. */
const oneLine = (t: string, w: number, max: number) => Math.max(16, Math.min(max, Math.floor((w * 72) / (Math.max(1, textUnits(t)) * 1.08))));

export type SlideContext = { index: number; total: number; deckTitle: string };

/** Lays out one slide. Coordinates are inches on a 13.333 × 7.5 canvas; colors are RGB hex without '#'. */
export function slidePrims(slide: Slide, theme: Theme, ctx: SlideContext): Prim[] {
  const T = theme;
  const out: Prim[] = [{ k: "rect", x: 0, y: 0, w: SLIDE_W, h: SLIDE_H, fill: T.bg }];
  const page = String(ctx.index + 1).padStart(2, "0");
  const chrome = (titleW = 11.7, x = 0.8) => {
    out.push(
      text({ x, y: 0.5, w: titleW, h: 0.3, text: `${page}${slide.source && slide.source !== slide.title ? "  ·  " + slide.source : ""}`, color: T.muted, max: 11, min: 9 }),
      text({ field: "title", x, y: 0.85, w: titleW, h: 1.15, text: slide.title, color: T.ink, head: true, bold: true, valign: "bottom", max: 32, min: 20, lh: 1.15 }),
      { k: "rect", x, y: 2.12, w: 0.62, h: 0.06, fill: T.accent },
    );
  };
  const footer = (x = 0.8, w = 11.7) => {
    out.push(
      { k: "line", x1: x, y1: 6.88, x2: x + w, y2: 6.88, color: T.line, width: 0.75 },
      text({ x, y: 6.98, w: w - 1.2, h: 0.28, text: ctx.deckTitle, color: T.muted, max: 9, min: 8 }),
      text({ x: x + w - 1.2, y: 6.98, w: 1.2, h: 0.28, text: `${ctx.index + 1} / ${ctx.total}`, color: T.muted, max: 9, min: 8, align: "right" }),
    );
  };
  const bullets = (field: Field, items: string[], x: number, y: number, w: number, h: number, max = 22, marker: ListPrim["marker"] = "dot") =>
    out.push(list({ field, x, y, w, h, items, color: T.ink, marker, markerColor: T.accent, max }));

  switch (slide.layout) {
    case "cover": {
      const hasImage = !!slide.image;
      const w = hasImage ? 6.3 : 11.7;
      if (hasImage) out.push({ k: "image", field: "image", x: 7.55, y: 0, w: SLIDE_W - 7.55, h: SLIDE_H, image: slide.image! });
      out.push(
        { k: "rect", x: 0.8, y: 1.25, w: 1.1, h: 0.08, fill: T.accent },
        text({ field: "title", x: 0.8, y: 1.55, w, h: 2.75, text: slide.title, color: T.ink, head: true, bold: true, valign: "bottom", max: 46, min: 26, lh: 1.12 }),
        text({ field: "subtitle", x: 0.8, y: 4.55, w, h: 1.25, text: slide.subtitle, color: T.muted, max: 19, min: 13, lh: 1.35 }),
        text({ field: "bullets", x: 0.8, y: 6.15, w, h: 0.75, text: slide.bullets.join("\n"), color: T.accent, max: 13, min: 10, lh: 1.3 }),
      );
      break;
    }
    case "section": {
      out[0] = { k: "rect", x: 0, y: 0, w: SLIDE_W, h: SLIDE_H, fill: T.accent };
      out.push(
        text({ field: "subtitle", x: 0.9, y: 1.6, w: 11.5, h: 1.3, text: slide.subtitle || page, color: mix(T.onAccent, T.accent, 0.35), head: true, bold: true, max: 60, min: 24, valign: "bottom" }),
        text({ field: "title", x: 0.9, y: 3.1, w: 11.5, h: 2.2, text: slide.title, color: T.onAccent, head: true, bold: true, max: 44, min: 24, lh: 1.15 }),
        text({ field: "bullets", x: 0.9, y: 5.5, w: 11.5, h: 1.2, text: slide.bullets.join("\n"), color: mix(T.onAccent, T.accent, 0.2), max: 16, min: 11 }),
      );
      break;
    }
    case "agenda": {
      chrome();
      const items = slide.bullets.filter((b) => b.trim()).slice(0, 10);
      const cols = items.length > 5 ? 2 : 1;
      const rows = Math.ceil(items.length / cols) || 1;
      const rowH = Math.min(0.85, 4.3 / rows);
      const colW = cols === 2 ? 5.65 : 11.7;
      items.forEach((it, i) => {
        const cx = 0.8 + Math.floor(i / rows) * 6.05,
          cy = 2.5 + (i % rows) * rowH;
        out.push(
          text({ field: "bullets", x: cx, y: cy, w: 0.8, h: rowH * 0.8, text: String(i + 1).padStart(2, "0"), color: T.accent, head: true, bold: true, max: 22, min: 14, valign: "middle" }),
          text({ field: "bullets", x: cx + 0.85, y: cy, w: colW - 0.85, h: rowH * 0.8, text: it, color: T.ink, max: 20, min: 12, valign: "middle" }),
          { k: "line", x1: cx, y1: cy + rowH * 0.9, x2: cx + colW, y2: cy + rowH * 0.9, color: T.line, width: 0.5 },
        );
      });
      footer();
      break;
    }
    case "comparison": {
      chrome();
      [0, 1].forEach((c) => {
        const x = 0.8 + c * 6.0;
        const items = c ? slide.bullets2 : slide.bullets;
        out.push(
          { k: "rect", x, y: 2.45, w: 5.7, h: 4.25, fill: c ? mix(T.surface, T.bg, 0.35) : T.surface, radius: 0.08 },
          { k: "rect", x, y: 2.45, w: 5.7, h: 0.06, fill: c ? T.accent2 : T.accent },
          text({ field: "columnTitles", x: x + 0.35, y: 2.7, w: 5.0, h: 0.55, text: slide.columnTitles[c], color: c ? T.accent2 : T.accent, bold: true, head: true, max: 20, min: 13, valign: "middle" }),
        );
        bullets(c ? "bullets2" : "bullets", items, x + 0.35, 3.4, 5.0, 3.1, 18);
      });
      footer();
      break;
    }
    case "image-text": {
      if (slide.image) out.push({ k: "image", field: "image", x: 0, y: 0, w: 5.35, h: SLIDE_H, image: slide.image });
      chrome(6.95, 5.95);
      bullets("bullets", slide.bullets, 5.95, 2.45, 6.6, 4.25, 20);
      footer(5.95, 6.6);
      break;
    }
    case "chart": {
      chrome();
      const side = slide.bullets.some((b) => b.trim());
      if (slide.subtitle.trim())
        out.push(text({ field: "subtitle", x: 0.8, y: 2.3, w: 11.7, h: 0.5, text: slide.subtitle, color: T.accent, bold: true, max: 17, min: 12, valign: "middle" }));
      const top = slide.subtitle.trim() ? 2.95 : 2.45;
      if (slide.chart) out.push({ k: "chart", field: "chart", x: 0.8, y: top, w: side ? 7.9 : 11.7, h: 6.7 - top, chart: slide.chart });
      if (side) {
        out.push({ k: "rect", x: 9.05, y: top, w: 3.45, h: 6.7 - top, fill: T.surface, radius: 0.08 });
        bullets("bullets", slide.bullets, 9.3, top + 0.25, 2.95, 6.7 - top - 0.5, 15, "dash");
      }
      footer();
      break;
    }
    case "stats": {
      chrome();
      const stats = slide.stats.slice(0, 6);
      const n = Math.max(1, stats.length);
      const perRow = n <= 4 ? n : 3;
      const rows = Math.ceil(n / perRow);
      const gap = 0.3;
      const cw = (11.7 - gap * (perRow - 1)) / perRow;
      const ch = (4.2 - gap * (rows - 1)) / rows;
      stats.forEach((s, i) => {
        const x = 0.8 + (i % perRow) * (cw + gap),
          y = 2.5 + Math.floor(i / perRow) * (ch + gap);
        out.push(
          { k: "rect", x, y, w: cw, h: ch, fill: T.surface, radius: 0.08 },
          { k: "rect", x, y, w: 0.06, h: ch, fill: i % 2 ? T.accent2 : T.accent },
          text({ field: "stats", x: x + 0.3, y: y + 0.25, w: cw - 0.5, h: ch * 0.42, text: s.value, color: i % 2 ? T.accent2 : T.accent, head: true, bold: true, max: oneLine(s.value, cw - 0.5, rows > 1 ? 40 : 48), min: 16, valign: "bottom", lh: 1.05 }),
          text({ field: "stats", x: x + 0.3, y: y + 0.45 + ch * 0.42, w: cw - 0.5, h: ch * 0.58 - 0.65, text: s.label, color: T.muted, max: 16, min: 11, lh: 1.3 }),
        );
      });
      footer();
      break;
    }
    case "quote": {
      out.push(
        { k: "rect", x: 0, y: 0, w: 0.28, h: SLIDE_H, fill: T.accent },
        text({ x: 1.2, y: 0.55, w: 2, h: 1.6, text: "“", color: T.accent, head: true, bold: true, max: 120, min: 60, lh: 1 }),
        text({ field: "title", x: 1.5, y: 1.9, w: 10.4, h: 3.3, text: slide.title, color: T.ink, head: true, max: 36, min: 18, lh: 1.4, valign: "middle" }),
        { k: "rect", x: 1.5, y: 5.55, w: 0.5, h: 0.04, fill: T.accent },
        text({ field: "subtitle", x: 2.15, y: 5.35, w: 9.7, h: 0.45, text: slide.subtitle, color: T.muted, max: 16, min: 11, valign: "middle" }),
      );
      footer(1.5, 10.4);
      break;
    }
    case "timeline": {
      chrome();
      const steps = slide.bullets.filter((b) => b.trim()).slice(0, 7);
      const n = Math.max(1, steps.length);
      const span = 11.3;
      const w = Math.min(2.6, span / n);
      out.push({ k: "line", x1: 1.0, y1: 4.0, x2: 12.33, y2: 4.0, color: T.line, width: 2 });
      steps.forEach((s, i) => {
        const cx = 1.0 + (span / n) * (i + 0.5);
        const m = s.match(/^(.{1,24}?)[：:]\s*(.+)$/);
        const label = m ? m[1] : `${i + 1}`;
        const rest = m ? m[2] : s;
        out.push(
          { k: "ellipse", x: cx - 0.14, y: 3.86, w: 0.28, h: 0.28, fill: i === n - 1 ? T.accent2 : T.accent },
          text({ field: "bullets", x: cx - w / 2 + 0.05, y: 2.55, w: w - 0.1, h: 1.15, text: label, color: T.accent, bold: true, head: true, max: 17, min: 11, align: "center", valign: "bottom" }),
          text({ field: "bullets", x: cx - w / 2 + 0.05, y: 4.35, w: w - 0.1, h: 2.3, text: rest, color: T.ink, max: 15, min: 10, align: "center", lh: 1.35 }),
        );
      });
      footer();
      break;
    }
    case "closing": {
      out[0] = { k: "rect", x: 0, y: 0, w: SLIDE_W, h: SLIDE_H, fill: T.surface };
      out.push(
        { k: "rect", x: 0, y: 0, w: 0.35, h: SLIDE_H, fill: T.accent },
        text({ x: 0.95, y: 0.6, w: 11, h: 0.35, text: page, color: T.muted, max: 11, min: 9 }),
        text({ field: "title", x: 0.95, y: 1.0, w: 11.5, h: 1.5, text: slide.title, color: T.ink, head: true, bold: true, max: 40, min: 22, valign: "bottom", lh: 1.15 }),
        { k: "rect", x: 0.95, y: 2.7, w: 0.62, h: 0.06, fill: T.accent },
      );
      bullets("bullets", slide.bullets, 0.95, 3.05, 11.4, 3.3, 22, "number");
      if (slide.subtitle.trim())
        out.push(text({ field: "subtitle", x: 0.95, y: 6.45, w: 11.4, h: 0.45, text: slide.subtitle, color: T.accent, max: 15, min: 10 }));
      break;
    }
    default: {
      chrome();
      bullets("bullets", slide.bullets, 0.8, 2.45, 11.7, 4.25, 22);
      footer();
    }
  }
  return out;
}

/** Every field that a layout shows, used by the inspector to present only relevant controls. */
export function layoutFields(layout: Slide["layout"]): Field[] {
  switch (layout) {
    case "cover":
      return ["title", "subtitle", "bullets", "image"];
    case "section":
      return ["title", "subtitle", "bullets"];
    case "agenda":
    case "bullets":
    case "timeline":
      return ["title", "bullets"];
    case "comparison":
      return ["title", "columnTitles", "bullets", "bullets2"];
    case "image-text":
      return ["title", "bullets", "image"];
    case "chart":
      return ["title", "subtitle", "chart", "bullets"];
    case "stats":
      return ["title", "stats"];
    case "quote":
      return ["title", "subtitle"];
    case "closing":
      return ["title", "bullets", "subtitle"];
  }
}
