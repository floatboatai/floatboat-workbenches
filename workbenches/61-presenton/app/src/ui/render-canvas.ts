// ABOUTME: Canvas 渲染器：按共享几何把幻灯片画到位图（用于 PDF 页面与 PPTX 插画位图），中文逐字断行并避开行首标点。
import type { Slide, ThemeId } from "../contracts/model";
import { SLIDE_H, SLIDE_W, bulletIndent, slidePrims, type Prim, type SlideContext } from "../shared/geometry";
import { artMarks, chartMarks, type Mark } from "../shared/marks";
import { THEME_DEFS, fontStack, type Theme } from "../shared/themes";

const NO_LINE_START = /^[，。、；：！？）」』》】,.;:!?)\]%％]/;
/** Greedy wrap: CJK per character, Latin per word, with simple kinsoku for leading punctuation. */
export function wrapLines(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const out: string[] = [];
  for (const para of text.split("\n")) {
    const tokens = para.match(/[A-Za-z0-9@#&'’_\-.,%/:]+\s*|\s+|./gu) ?? [""];
    let line = "";
    for (const t of tokens) {
      const next = line + t;
      if (ctx.measureText(next.trimEnd()).width <= maxWidth || !line) {
        line = next;
        continue;
      }
      if (NO_LINE_START.test(t)) {
        line = next;
        continue;
      }
      out.push(line.trimEnd());
      line = t.trimStart();
    }
    out.push(line.trimEnd());
  }
  return out;
}
const hex = (c: string) => `#${c}`;

export function drawMarks(ctx: CanvasRenderingContext2D, marks: Mark[], ppi: number, font: string) {
  for (const m of marks) {
    ctx.save();
    if ("opacity" in m && m.opacity !== undefined) ctx.globalAlpha = m.opacity;
    switch (m.k) {
      case "rect":
        ctx.fillStyle = hex(m.fill);
        ctx.beginPath();
        if (m.radius) ctx.roundRect(m.x * ppi, m.y * ppi, m.w * ppi, m.h * ppi, m.radius * ppi);
        else ctx.rect(m.x * ppi, m.y * ppi, m.w * ppi, m.h * ppi);
        ctx.fill();
        break;
      case "circle":
        ctx.fillStyle = hex(m.fill);
        ctx.beginPath();
        ctx.arc(m.cx * ppi, m.cy * ppi, m.r * ppi, 0, Math.PI * 2);
        ctx.fill();
        break;
      case "poly":
        ctx.fillStyle = hex(m.fill);
        ctx.beginPath();
        m.pts.forEach(([x, y], i) => (i ? ctx.lineTo(x * ppi, y * ppi) : ctx.moveTo(x * ppi, y * ppi)));
        ctx.closePath();
        ctx.fill();
        break;
      case "path":
        ctx.strokeStyle = hex(m.color);
        ctx.lineWidth = (m.width / 72) * ppi;
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        if (m.dash) ctx.setLineDash([ctx.lineWidth * 2, ctx.lineWidth * 2]);
        ctx.beginPath();
        m.pts.forEach(([x, y], i) => (i ? ctx.lineTo(x * ppi, y * ppi) : ctx.moveTo(x * ppi, y * ppi)));
        ctx.stroke();
        break;
      case "arc":
        ctx.fillStyle = hex(m.fill);
        ctx.beginPath();
        ctx.arc(m.cx * ppi, m.cy * ppi, m.r * ppi, m.start, m.end);
        if (m.inner > 0) ctx.arc(m.cx * ppi, m.cy * ppi, m.inner * ppi, m.end, m.start, true);
        else ctx.lineTo(m.cx * ppi, m.cy * ppi);
        ctx.closePath();
        ctx.fill();
        break;
      case "label":
        ctx.fillStyle = hex(m.color);
        ctx.font = `${m.bold ? 700 : 400} ${(m.size / 72) * ppi}px ${font}`;
        ctx.textAlign = m.anchor === "start" ? "left" : m.anchor === "end" ? "right" : "center";
        ctx.textBaseline = "middle";
        ctx.fillText(m.text, m.x * ppi, m.y * ppi);
        break;
    }
    ctx.restore();
  }
}

function drawText(ctx: CanvasRenderingContext2D, ppi: number, x: number, y: number, w: number, h: number, lines: string[], size: number, lh: number, valign: string, align: string) {
  const sizePx = (size / 72) * ppi;
  const lineH = sizePx * lh;
  const total = lines.length * lineH;
  let top = y * ppi;
  if (valign === "middle") top += (h * ppi - total) / 2;
  if (valign === "bottom") top += h * ppi - total;
  ctx.textBaseline = "middle";
  ctx.textAlign = align === "center" ? "center" : align === "right" ? "right" : "left";
  const ax = align === "center" ? (x + w / 2) * ppi : align === "right" ? (x + w) * ppi : x * ppi;
  lines.forEach((l, i) => ctx.fillText(l, ax, top + lineH * i + lineH / 2));
}

export type CanvasImages = Map<string, CanvasImageSource>;

function drawPrim(ctx: CanvasRenderingContext2D, p: Prim, theme: Theme, ppi: number, images: CanvasImages) {
  switch (p.k) {
    case "rect":
      drawMarks(ctx, [{ k: "rect", x: p.x, y: p.y, w: p.w, h: p.h, fill: p.fill, radius: p.radius }], ppi, "");
      return;
    case "ellipse":
      ctx.fillStyle = hex(p.fill);
      ctx.beginPath();
      ctx.ellipse((p.x + p.w / 2) * ppi, (p.y + p.h / 2) * ppi, (p.w / 2) * ppi, (p.h / 2) * ppi, 0, 0, Math.PI * 2);
      ctx.fill();
      return;
    case "line":
      drawMarks(ctx, [{ k: "path", pts: [[p.x1, p.y1], [p.x2, p.y2]], color: p.color, width: p.width }], ppi, "");
      return;
    case "text": {
      if (!p.text.trim()) return;
      const sizePx = (p.size / 72) * ppi;
      ctx.font = `${p.italic ? "italic " : ""}${p.bold ? 700 : 400} ${sizePx}px ${fontStack(p.head && theme.serifHead)}`;
      ctx.fillStyle = hex(p.color);
      drawText(ctx, ppi, p.x, p.y, p.w, p.h, wrapLines(ctx, p.text, p.w * ppi), p.size, p.lh, p.valign, p.align);
      return;
    }
    case "list": {
      const sizePx = (p.size / 72) * ppi;
      const indent = bulletIndent(p.size);
      ctx.font = `400 ${sizePx}px ${fontStack(false)}`;
      let top = p.y;
      p.items.forEach((item, i) => {
        const lines = wrapLines(ctx, item, (p.w - indent) * ppi);
        ctx.fillStyle = hex(p.markerColor);
        ctx.textAlign = "left";
        ctx.textBaseline = "middle";
        const marker = p.marker === "number" ? `${i + 1}.` : p.marker === "dash" ? "–" : "●";
        ctx.save();
        if (p.marker === "dot") ctx.font = `400 ${sizePx * 0.55}px ${fontStack(false)}`;
        ctx.fillText(marker, p.x * ppi, top * ppi + (sizePx * p.lh) / 2);
        ctx.restore();
        ctx.fillStyle = hex(p.color);
        drawText(ctx, ppi, p.x + indent, top, p.w - indent, lines.length * (p.size / 72) * p.lh, lines, p.size, p.lh, "top", "left");
        top += (lines.length * p.size * p.lh + p.gap * p.size) / 72;
      });
      return;
    }
    case "image": {
      ctx.save();
      ctx.beginPath();
      ctx.rect(p.x * ppi, p.y * ppi, p.w * ppi, p.h * ppi);
      ctx.clip();
      ctx.translate(p.x * ppi, p.y * ppi);
      if (p.image.kind === "art") drawMarks(ctx, artMarks(p.image.art, p.w, p.h, theme), ppi, fontStack(false));
      else {
        const img = images.get(p.image.id);
        if (img && "width" in img) {
          const iw = Number((img as HTMLImageElement).naturalWidth || img.width),
            ih = Number((img as HTMLImageElement).naturalHeight || img.height);
          const scale = Math.max((p.w * ppi) / iw, (p.h * ppi) / ih);
          ctx.drawImage(img, (p.w * ppi - iw * scale) / 2, (p.h * ppi - ih * scale) / 2, iw * scale, ih * scale);
        }
      }
      ctx.restore();
      return;
    }
    case "chart":
      ctx.save();
      ctx.translate(p.x * ppi, p.y * ppi);
      drawMarks(ctx, chartMarks(p.chart, p.w, p.h, theme), ppi, fontStack(false));
      ctx.restore();
      return;
  }
}

export function drawSlide(ctx: CanvasRenderingContext2D, slide: Slide, themeId: ThemeId, info: SlideContext, widthPx: number, images: CanvasImages) {
  const theme = THEME_DEFS[themeId];
  const ppi = widthPx / SLIDE_W;
  for (const p of slidePrims(slide, theme, info)) drawPrim(ctx, p, theme, ppi, images);
}
export const slideHeightPx = (widthPx: number) => Math.round((widthPx * SLIDE_H) / SLIDE_W);
