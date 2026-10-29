// ABOUTME: 舞台与缩略图的 HTML 渲染器：按共享几何把幻灯片图元画成绝对定位的文字、列表与 SVG 图表/插画，可点选字段。
import { memo, type CSSProperties } from "react";
import type { Slide, ThemeId } from "../contracts/model";
import { SLIDE_H, SLIDE_W, bulletIndent, slidePrims, type Field, type Prim } from "../shared/geometry";
import { artMarks, chartMarks, type Mark } from "../shared/marks";
import { THEME_DEFS, fontStack, type Theme } from "../shared/themes";
import { useMedia } from "./media-client";

const PPI = 96;
const px = (inch: number) => inch * PPI;
const ptPx = (pt: number) => (pt * PPI) / 72;
const c = (hex: string) => `#${hex}`;

function arcPath(m: Extract<Mark, { k: "arc" }>): string {
  const full = m.end - m.start >= Math.PI * 2 - 1e-6;
  const pt = (r: number, a: number) => `${m.cx + r * Math.cos(a)} ${m.cy + r * Math.sin(a)}`;
  if (full) {
    const mid = m.start + Math.PI;
    const outer = `M ${pt(m.r, m.start)} A ${m.r} ${m.r} 0 1 1 ${pt(m.r, mid)} A ${m.r} ${m.r} 0 1 1 ${pt(m.r, m.start)} Z`;
    return m.inner > 0 ? `${outer} M ${pt(m.inner, m.start)} A ${m.inner} ${m.inner} 0 1 0 ${pt(m.inner, mid)} A ${m.inner} ${m.inner} 0 1 0 ${pt(m.inner, m.start)} Z` : outer;
  }
  const large = m.end - m.start > Math.PI ? 1 : 0;
  if (m.inner <= 0) return `M ${m.cx} ${m.cy} L ${pt(m.r, m.start)} A ${m.r} ${m.r} 0 ${large} 1 ${pt(m.r, m.end)} Z`;
  return `M ${pt(m.r, m.start)} A ${m.r} ${m.r} 0 ${large} 1 ${pt(m.r, m.end)} L ${pt(m.inner, m.end)} A ${m.inner} ${m.inner} 0 ${large} 0 ${pt(m.inner, m.start)} Z`;
}
export function MarksSvg({ marks, w, h, font, label }: { marks: Mark[]; w: number; h: number; font: string; label?: string }) {
  return (
    <svg viewBox={`0 0 ${w} ${h}`} width="100%" height="100%" role={label ? "img" : undefined} aria-label={label} aria-hidden={label ? undefined : true} preserveAspectRatio="none">
      {marks.map((m, i) => {
        switch (m.k) {
          case "rect":
            return <rect key={i} x={m.x} y={m.y} width={m.w} height={m.h} rx={m.radius} fill={c(m.fill)} opacity={m.opacity} />;
          case "circle":
            return <circle key={i} cx={m.cx} cy={m.cy} r={m.r} fill={c(m.fill)} opacity={m.opacity} />;
          case "poly":
            return <polygon key={i} points={m.pts.map((p) => p.join(",")).join(" ")} fill={c(m.fill)} opacity={m.opacity} />;
          case "path":
            return (
              <polyline
                key={i}
                points={m.pts.map((p) => p.join(",")).join(" ")}
                fill="none"
                stroke={c(m.color)}
                strokeWidth={m.width / 72}
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeDasharray={m.dash ? `${(m.width / 72) * 2} ${(m.width / 72) * 2}` : undefined}
                opacity={m.opacity}
              />
            );
          case "arc":
            return <path key={i} d={arcPath(m)} fill={c(m.fill)} fillRule="evenodd" />;
          case "label":
            return (
              <text key={i} x={m.x} y={m.y} fontSize={m.size / 72} fill={c(m.color)} textAnchor={m.anchor} dominantBaseline="central" fontWeight={m.bold ? 700 : 400} fontFamily={font}>
                {m.text}
              </text>
            );
        }
      })}
    </svg>
  );
}

function MediaImage({ id, alt }: { id: string; alt: string }) {
  const { url, error } = useMedia(id);
  if (url) return <img src={url} alt={alt} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />;
  return <div className="slide-missing">{error ? "图片无法载入" : "正在载入图片…"}</div>;
}

const box = (x: number, y: number, w: number, h: number): CSSProperties => ({ position: "absolute", left: px(x), top: px(y), width: px(w), height: px(h) });

function PrimView({ p, theme, pick, active }: { p: Prim; theme: Theme; pick?: (f: Field) => void; active?: Field | null }) {
  const field = "field" in p ? p.field : undefined;
  const interactive = pick && field;
  const common = interactive
    ? {
        "data-field": field,
        className: `prim pickable${active === field ? " picked" : ""}`,
        onClick: (e: React.MouseEvent) => {
          e.stopPropagation();
          pick(field);
        },
      }
    : { className: "prim" };
  switch (p.k) {
    case "rect":
      return <div className="prim" style={{ ...box(p.x, p.y, p.w, p.h), background: c(p.fill), borderRadius: p.radius ? px(p.radius) : undefined }} />;
    case "ellipse":
      return <div className="prim" style={{ ...box(p.x, p.y, p.w, p.h), background: c(p.fill), borderRadius: "50%" }} />;
    case "line":
      return <div className="prim" style={{ position: "absolute", left: px(p.x1), top: px(p.y1) - ptPx(p.width) / 2, width: px(p.x2 - p.x1), height: Math.max(1, ptPx(p.width)), background: c(p.color) }} />;
    case "text":
      return (
        <div
          {...common}
          style={{
            ...box(p.x, p.y, p.w, p.h),
            display: "flex",
            flexDirection: "column",
            justifyContent: p.valign === "top" ? "flex-start" : p.valign === "middle" ? "center" : "flex-end",
            textAlign: p.align,
            color: c(p.color),
            fontFamily: fontStack(p.head && theme.serifHead),
            fontSize: ptPx(p.size),
            fontWeight: p.bold ? 700 : 400,
            fontStyle: p.italic ? "italic" : undefined,
            lineHeight: p.lh,
          }}
        >
          <span className="prim-text">{p.text}</span>
        </div>
      );
    case "list": {
      const size = ptPx(p.size);
      const indent = px(bulletIndent(p.size));
      return (
        <ul {...common} style={{ ...box(p.x, p.y, p.w, p.h), color: c(p.color), fontFamily: fontStack(false), fontSize: size, lineHeight: p.lh, listStyle: "none", margin: 0, padding: 0 }}>
          {p.items.map((item, i) => (
            <li key={i} style={{ position: "relative", paddingLeft: indent, marginBottom: i < p.items.length - 1 ? p.gap * size : 0 }}>
              <span aria-hidden="true" className="prim-marker" style={{ color: c(p.markerColor), width: indent, ...(p.marker === "dot" ? { fontSize: "0.55em", lineHeight: p.lh / 0.55 } : {}) }}>
                {p.marker === "number" ? `${i + 1}.` : p.marker === "dash" ? "–" : "●"}
              </span>
              <span className="prim-text">{item}</span>
            </li>
          ))}
        </ul>
      );
    }
    case "image":
      return (
        <div {...common} style={{ ...box(p.x, p.y, p.w, p.h), overflow: "hidden" }}>
          {p.image.kind === "art" ? <MarksSvg marks={artMarks(p.image.art, p.w, p.h, theme)} w={p.w} h={p.h} font={fontStack(false)} label={p.image.alt || undefined} /> : <MediaImage id={p.image.id} alt={p.image.alt} />}
        </div>
      );
    case "chart":
      return (
        <div {...common} style={box(p.x, p.y, p.w, p.h)}>
          <MarksSvg marks={chartMarks(p.chart, p.w, p.h, theme)} w={p.w} h={p.h} font={fontStack(false)} label={`图表：${p.chart.categories.join("、")}`} />
        </div>
      );
  }
}

/** Renders a slide at a CSS width; `pick` makes fields clickable for the inspector. */
export const SlideView = memo(function SlideView({
  slide,
  themeId,
  index,
  total,
  deckTitle,
  width,
  pick,
  active,
}: {
  slide: Slide;
  themeId: ThemeId;
  index: number;
  total: number;
  deckTitle: string;
  width: number;
  pick?: (f: Field) => void;
  active?: Field | null;
}) {
  const theme = THEME_DEFS[themeId];
  const prims = slidePrims(slide, theme, { index, total, deckTitle });
  const scale = width / px(SLIDE_W);
  return (
    <div className="slide-frame" style={{ width, height: (width * SLIDE_H) / SLIDE_W }}>
      <div className="slide-canvas" style={{ width: px(SLIDE_W), height: px(SLIDE_H), transform: `scale(${scale})` }}>
        {prims.map((p, i) => (
          <PrimView key={i} p={p} theme={theme} pick={pick} active={active} />
        ))}
      </div>
    </div>
  );
});
