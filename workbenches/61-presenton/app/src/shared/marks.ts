// ABOUTME: 图表与插画的绘制标记（英寸坐标）：舞台 SVG 与 Canvas（PDF、PPTX 插画位图）共用；PPTX 图表另走原生 addChart。
import type { ArtId, Chart } from "../contracts/model.ts";
import { mix, type Theme } from "./themes.ts";

export type Mark =
  | { k: "rect"; x: number; y: number; w: number; h: number; fill: string; opacity?: number; radius?: number }
  | { k: "circle"; cx: number; cy: number; r: number; fill: string; opacity?: number }
  | { k: "poly"; pts: [number, number][]; fill: string; opacity?: number }
  | { k: "path"; pts: [number, number][]; color: string; width: number; dash?: boolean; opacity?: number }
  | { k: "arc"; cx: number; cy: number; r: number; inner: number; start: number; end: number; fill: string }
  | { k: "label"; x: number; y: number; text: string; size: number; color: string; anchor: "start" | "middle" | "end"; bold?: boolean };

export const chartNumber = (v: string) => {
  const n = Number(v.replace(/,/g, "").trim());
  return v.trim() === "" || !Number.isFinite(n) ? 0 : n;
};
function niceStep(max: number) {
  const raw = max / 4;
  const pow = 10 ** Math.floor(Math.log10(raw || 1));
  const f = raw / pow;
  return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * pow;
}
const short = (s: string, n: number) => (s.length > n ? s.slice(0, n - 1) + "…" : s);
const fmt = (n: number) => (Math.abs(n) >= 1000 ? n.toLocaleString("en-US", { maximumFractionDigits: 0 }) : String(Math.round(n * 10) / 10));

/** Chart marks inside a w×h inch box. Values that are blank or invalid draw as 0, matching the PPTX data. */
export function chartMarks(chart: Chart, w: number, h: number, theme: Theme): Mark[] {
  const marks: Mark[] = [];
  const colors = theme.chart;
  const ink = theme.ink,
    muted = theme.muted,
    grid = mix(theme.line, theme.bg, 0.25);
  const unit = chart.unit === "%" ? "%" : "";
  if (chart.type === "pie" || chart.type === "doughnut") {
    const values = chart.series[0]?.values.map(chartNumber).map((v) => Math.max(0, v)) ?? [];
    const sum = values.reduce((a, b) => a + b, 0) || 1;
    const r = Math.min(h * 0.46, w * 0.26);
    const cx = r + 0.15,
      cy = h / 2;
    let angle = -Math.PI / 2;
    values.forEach((v, i) => {
      const end = angle + (v / sum) * Math.PI * 2;
      if (v > 0) marks.push({ k: "arc", cx, cy, r, inner: chart.type === "doughnut" ? r * 0.58 : 0, start: angle, end, fill: colors[i % colors.length] });
      angle = end;
    });
    if (chart.type === "doughnut") {
      marks.push({ k: "label", x: cx, y: cy - 0.02, text: fmt(sum), size: Math.min(30, r * 26), color: ink, anchor: "middle", bold: true });
      if (chart.unit) marks.push({ k: "label", x: cx, y: cy + Math.min(0.36, r * 0.3), text: chart.unit, size: 12, color: muted, anchor: "middle" });
    }
    const lx = cx + r + 0.5;
    const rowH = Math.min(0.55, (h - 0.2) / Math.max(1, values.length));
    const top = cy - (rowH * values.length) / 2 + rowH / 2;
    values.forEach((v, i) => {
      const y = top + i * rowH;
      marks.push(
        { k: "rect", x: lx, y: y - 0.09, w: 0.18, h: 0.18, fill: colors[i % colors.length], radius: 0.03 },
        { k: "label", x: lx + 0.32, y, text: short(chart.categories[i] ?? "", 18), size: 13, color: ink, anchor: "start" },
        { k: "label", x: w - 0.05, y, text: `${fmt(v)}${unit} · ${Math.round((v / sum) * 100)}%`, size: 13, color: muted, anchor: "end", bold: true },
      );
    });
    return marks;
  }
  const series = chart.series.map((s) => s.values.map(chartNumber));
  const maxV = Math.max(0, ...series.flat());
  const minV = Math.min(0, ...series.flat());
  const step = niceStep(Math.max(maxV - minV, 1e-9) || 1);
  const top = Math.ceil(maxV / step) * step || step;
  const bottom = Math.floor(minV / step) * step;
  const legend = chart.series.length > 1 || !!chart.series[0]?.name.trim();
  const plot = { x: 0.65, y: legend ? 0.5 : 0.25, w: w - 0.8, h: h - (legend ? 0.5 : 0.25) - 0.55 };
  const Y = (v: number) => plot.y + plot.h - ((v - bottom) / (top - bottom || 1)) * plot.h;
  for (let v = bottom; v <= top + step / 2; v += step) {
    marks.push({ k: "path", pts: [[plot.x, Y(v)], [plot.x + plot.w, Y(v)]], color: grid, width: 0.75 });
    marks.push({ k: "label", x: plot.x - 0.1, y: Y(v), text: fmt(v) + unit, size: 10, color: muted, anchor: "end" });
  }
  if (legend)
    chart.series.forEach((s, i) => {
      const x = plot.x + i * Math.min(2.2, plot.w / chart.series.length);
      marks.push(
        { k: "rect", x, y: 0.1, w: 0.16, h: 0.16, fill: colors[i % colors.length], radius: 0.03 },
        { k: "label", x: x + 0.26, y: 0.18, text: short(s.name || `系列 ${i + 1}`, 16), size: 11, color: ink, anchor: "start" },
      );
    });
  const n = chart.categories.length;
  const band = plot.w / Math.max(1, n);
  const labelChars = Math.max(4, Math.floor((band * 72) / 11) - 1);
  chart.categories.forEach((c, i) =>
    marks.push({ k: "label", x: plot.x + band * (i + 0.5), y: plot.y + plot.h + 0.25, text: short(c, labelChars), size: 11, color: muted, anchor: "middle" }),
  );
  if (chart.type === "bar") {
    const groupW = band * 0.7;
    const barW = groupW / Math.max(1, series.length);
    series.forEach((vals, si) =>
      vals.forEach((v, i) => {
        const x = plot.x + band * i + (band - groupW) / 2 + si * barW;
        const y0 = Y(Math.max(0, v)),
          y1 = Y(Math.min(0, v));
        marks.push({ k: "rect", x: x + barW * 0.06, y: y0, w: barW * 0.88, h: Math.max(0.005, y1 - y0), fill: colors[si % colors.length], radius: 0.02 });
        marks.push({ k: "label", x: x + barW / 2, y: y0 - 0.14, text: fmt(v) + unit, size: barW > 0.5 ? 11 : 9, color: ink, anchor: "middle", bold: true });
      }),
    );
  } else {
    series.forEach((vals, si) => {
      const pts = vals.map((v, i): [number, number] => [plot.x + band * (i + 0.5), Y(v)]);
      marks.push({ k: "path", pts, color: colors[si % colors.length], width: 2.5 });
      pts.forEach(([x, y], i) => {
        marks.push({ k: "circle", cx: x, cy: y, r: 0.07, fill: colors[si % colors.length] });
        marks.push({ k: "label", x, y: y - 0.2, text: fmt(vals[i]) + unit, size: 10, color: ink, anchor: "middle", bold: true });
      });
    });
  }
  marks.push({ k: "path", pts: [[plot.x, Y(0)], [plot.x + plot.w, Y(0)]], color: mix(theme.muted, theme.bg, 0.4), width: 1 });
  return marks;
}

/** Deterministic illustrations built from simple shapes, coloured by the theme. Box is w×h inches. */
export function artMarks(art: ArtId, w: number, h: number, theme: Theme): Mark[] {
  const A = theme.accent,
    B = theme.accent2,
    S = theme.surface,
    BG = mix(theme.surface, theme.bg, 0.4);
  const m: Mark[] = [{ k: "rect", x: 0, y: 0, w, h, fill: BG }];
  const rnd = (() => {
    let s = art.split("").reduce((a, c) => a * 31 + c.charCodeAt(0), 7) >>> 0;
    return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 2 ** 32);
  })();
  switch (art) {
    case "canopy": {
      m.push({ k: "rect", x: 0, y: h * 0.78, w, h: h * 0.22, fill: mix(S, A, 0.12) });
      m.push({ k: "path", pts: [[0, h * 0.86], [w, h * 0.8]], color: mix(BG, B, 0.5), width: 6, dash: true });
      for (let i = 0; i < 5; i++) {
        const x = w * (0.1 + i * 0.2) + (rnd() - 0.5) * 0.3;
        const r = h * (0.1 + rnd() * 0.06);
        const base = h * (0.78 - (i % 2) * 0.02);
        m.push({ k: "rect", x: x - 0.05, y: base - r * 1.6, w: 0.1, h: r * 1.6, fill: mix(theme.ink, BG, 0.45) });
        m.push({ k: "circle", cx: x, cy: base - r * 1.9, r: r * 1.25, fill: mix(A, BG, 0.15 + (i % 3) * 0.15), opacity: 0.95 });
        m.push({ k: "circle", cx: x - r * 0.6, cy: base - r * 1.45, r: r * 0.85, fill: mix(A, BG, 0.3), opacity: 0.9 });
      }
      m.push({ k: "circle", cx: w * 0.82, cy: h * 0.14, r: h * 0.06, fill: B, opacity: 0.85 });
      break;
    }
    case "route": {
      for (let i = 0; i < 6; i++) m.push({ k: "path", pts: [[0, h * (i / 6 + 0.08)], [w, h * (i / 6 + 0.02)]], color: mix(BG, theme.line, 0.6), width: 1 });
      for (let i = 0; i < 4; i++) m.push({ k: "path", pts: [[w * (i / 4 + 0.1), 0], [w * (i / 4 + 0.16), h]], color: mix(BG, theme.line, 0.6), width: 1 });
      const pts: [number, number][] = [[w * 0.12, h * 0.85], [w * 0.3, h * 0.66], [w * 0.28, h * 0.45], [w * 0.55, h * 0.38], [w * 0.62, h * 0.2], [w * 0.85, h * 0.15]];
      m.push({ k: "path", pts, color: mix(A, BG, 0.65), width: 14 });
      m.push({ k: "path", pts, color: A, width: 5 });
      pts.forEach(([x, y], i) => m.push({ k: "circle", cx: x, cy: y, r: i === 0 || i === pts.length - 1 ? 0.16 : 0.09, fill: i === pts.length - 1 ? B : A }));
      break;
    }
    case "blocks": {
      const cols = 5,
        bw = w / cols;
      for (let i = 0; i < cols; i++) {
        const bh = h * (0.3 + rnd() * 0.45);
        m.push({ k: "rect", x: i * bw + bw * 0.08, y: h - bh, w: bw * 0.84, h: bh, fill: mix(i % 2 ? A : theme.ink, BG, 0.25 + rnd() * 0.35) });
        for (let r = 0; r < Math.floor(bh / 0.45); r++)
          m.push({ k: "rect", x: i * bw + bw * 0.25, y: h - bh + 0.2 + r * 0.45, w: bw * 0.5, h: 0.16, fill: mix(B, BG, 0.35), opacity: 0.7 });
      }
      m.push({ k: "circle", cx: w * 0.75, cy: h * 0.16, r: h * 0.07, fill: B });
      break;
    }
    case "hills": {
      m.push({ k: "circle", cx: w * 0.7, cy: h * 0.3, r: h * 0.12, fill: B, opacity: 0.9 });
      [0.55, 0.68, 0.8].forEach((t, i) => {
        const pts: [number, number][] = [[0, h]];
        for (let k = 0; k <= 8; k++) pts.push([(w * k) / 8, h * t + Math.sin(k * 1.3 + i * 2) * h * 0.06]);
        pts.push([w, h]);
        m.push({ k: "poly", pts, fill: mix(A, BG, 0.6 - i * 0.22) });
      });
      break;
    }
    case "rings": {
      for (let i = 6; i > 0; i--) m.push({ k: "circle", cx: w * 0.55, cy: h * 0.5, r: (Math.min(w, h) * 0.08 * i) / 1.1, fill: mix(i % 2 ? A : B, BG, 0.15 + i * 0.1) });
      m.push({ k: "circle", cx: w * 0.2, cy: h * 0.18, r: 0.25, fill: B, opacity: 0.8 });
      break;
    }
    case "growth": {
      const n = 6,
        bw = (w * 0.8) / n;
      for (let i = 0; i < n; i++) {
        const bh = h * (0.18 + i * 0.11);
        m.push({ k: "rect", x: w * 0.1 + i * bw + bw * 0.12, y: h * 0.9 - bh, w: bw * 0.76, h: bh, fill: mix(A, BG, 0.55 - i * 0.08), radius: 0.04 });
      }
      m.push({ k: "path", pts: [[w * 0.1, h * 0.7], [w * 0.4, h * 0.5], [w * 0.6, h * 0.42], [w * 0.88, h * 0.16]], color: B, width: 4 });
      m.push({ k: "circle", cx: w * 0.88, cy: h * 0.16, r: 0.14, fill: B });
      break;
    }
  }
  return m;
}
