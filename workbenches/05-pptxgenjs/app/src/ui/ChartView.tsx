// ABOUTME: 舞台上的图表预览（SVG）：与导出的原生图表使用同一份数据、配色、图例位置与数据标签规则。
import { memo, type ReactNode } from "react";
import type { ChartElement, Theme } from "../contracts/domain";
import { chartPalette, fontStack, mix } from "../contracts/layouts";
import { chartData } from "../shared/pptx-render";

const PX = 4 / 3;
function niceStep(range: number, target = 5) {
  const raw = range / target;
  const power = 10 ** Math.floor(Math.log10(raw || 1));
  const n = raw / power;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * power;
}
function format(value: number) {
  return Number.isInteger(value) ? value.toLocaleString("zh-CN") : value.toLocaleString("zh-CN", { maximumFractionDigits: 2 });
}

export const ChartView = memo(function ChartView({ el, theme, width, height }: { el: ChartElement; theme: Theme; width: number; height: number }) {
  const c = theme.colors;
  const palette = chartPalette(theme).map((hex) => "#" + hex);
  const data = chartData(el);
  const round = el.chart === "pie" || el.chart === "doughnut";
  const body = fontStack(theme.bodyFont);
  const titleH = el.title.trim() ? 16 * PX * 1.9 : 0;
  const pad = 8;
  const legendItems = round ? data[0]?.labels ?? [] : data.map((s) => s.name);
  const legendH = el.legend && !round ? 12 * PX * 2 : 0;
  const legendW = el.legend && round ? Math.min(width * 0.38, 12 * PX * (Math.max(...legendItems.map((l) => l.length), 2) * 1.05 + 2.4)) : 0;
  const plot = { x: pad, y: pad + titleH, w: width - pad * 2 - legendW, h: height - pad * 2 - titleH - legendH };
  const text = (props: { x: number; y: number; size: number; fill: string; anchor?: "start" | "middle" | "end"; weight?: number; children: string}) => (
    <text
      x={props.x}
      y={props.y}
      fontSize={props.size * PX}
      fill={props.fill}
      textAnchor={props.anchor ?? "middle"}
      dominantBaseline="central"
      fontWeight={props.weight}
      fontFamily={body}
    >
      {props.children}
    </text>
  );

  let content: ReactNode = null;
  if (round) {
    const values = data[0]?.values.map((v) => Math.max(0, v)) ?? [];
    const total = values.reduce((a, b) => a + b, 0) || 1;
    const r = Math.max(4, Math.min(plot.w, plot.h) / 2 - 4);
    const cx = plot.x + plot.w / 2,
      cy = plot.y + plot.h / 2;
    const inner = el.chart === "doughnut" ? r * 0.58 : 0;
    let angle = -Math.PI / 2;
    content = values.map((value, i) => {
      const sweep = (value / total) * Math.PI * 2;
      const a0 = angle,
        a1 = angle + sweep;
      angle = a1;
      if (sweep <= 0) return null;
      const large = sweep > Math.PI ? 1 : 0;
      const p = (rad: number, a: number) => `${cx + rad * Math.cos(a)} ${cy + rad * Math.sin(a)}`;
      const path =
        sweep >= Math.PI * 2 - 1e-6
          ? inner
            ? `M ${p(r, 0)} A ${r} ${r} 0 1 1 ${p(r, Math.PI)} A ${r} ${r} 0 1 1 ${p(r, 0)} M ${p(inner, 0)} A ${inner} ${inner} 0 1 0 ${p(inner, Math.PI)} A ${inner} ${inner} 0 1 0 ${p(inner, 0)} Z`
            : `M ${p(r, 0)} A ${r} ${r} 0 1 1 ${p(r, Math.PI)} A ${r} ${r} 0 1 1 ${p(r, 0)} Z`
          : inner
            ? `M ${p(r, a0)} A ${r} ${r} 0 ${large} 1 ${p(r, a1)} L ${p(inner, a1)} A ${inner} ${inner} 0 ${large} 0 ${p(inner, a0)} Z`
            : `M ${cx} ${cy} L ${p(r, a0)} A ${r} ${r} 0 ${large} 1 ${p(r, a1)} Z`;
      const mid = (a0 + a1) / 2,
        lr = inner ? (r + inner) / 2 : r * 0.62;
      return (
        <g key={i}>
          <path d={path} fill={palette[i % palette.length]} stroke={"#" + c.background} strokeWidth={PX} fillRule="evenodd" />
          {el.labels && sweep > 0.25
            ? text({ x: cx + lr * Math.cos(mid), y: cy + lr * Math.sin(mid), size: 11, fill: "#" + c.background, children: `${Math.round((value / total) * 100)}%` })
            : null}
        </g>
      );
    });
  } else {
    const all = data.flatMap((s) => s.values);
    let max = Math.max(0, ...all),
      min = Math.min(0, ...all);
    if (max === min) max = min + 1;
    const step = niceStep(max - min);
    max = Math.ceil(max / step) * step;
    min = Math.floor(min / step) * step;
    const ticks: number[] = [];
    for (let v = min; v <= max + step / 2; v += step) ticks.push(Math.round(v * 1e6) / 1e6);
    const axisW = Math.max(...ticks.map((t) => format(t).length)) * 11 * PX * 0.62 + 10;
    const catH = 12 * PX * 1.8;
    const area = { x: plot.x + axisW, y: plot.y + 6, w: Math.max(10, plot.w - axisW), h: Math.max(10, plot.h - catH - 6) };
    const yOf = (v: number) => area.y + area.h - ((v - min) / (max - min)) * area.h;
    const cats = data[0]?.labels ?? [];
    const band = area.w / Math.max(1, cats.length);
    const grid = "#" + mix(c.muted, c.background, 0.7);
    const parts: ReactNode[] = ticks.map((t) => (
      <g key={"t" + t}>
        <line x1={area.x} x2={area.x + area.w} y1={yOf(t)} y2={yOf(t)} stroke={grid} strokeWidth={PX * 0.75} />
        {text({ x: area.x - 6, y: yOf(t), size: 11, fill: "#" + c.muted, anchor: "end", children: format(t) })}
      </g>
    ));
    parts.push(
      <line key="axis" x1={area.x} x2={area.x + area.w} y1={yOf(Math.max(min, 0))} y2={yOf(Math.max(min, 0))} stroke={"#" + mix(c.muted, c.background, 0.4)} strokeWidth={PX} />,
    );
    cats.forEach((cat, i) =>
      parts.push(<g key={"c" + i}>{text({ x: area.x + band * (i + 0.5), y: area.y + area.h + catH / 2 + 2, size: 12, fill: "#" + c.muted, children: cat })}</g>),
    );
    if (el.chart === "bar") {
      const group = band / (1 + 0.6);
      const barW = group / Math.max(1, data.length);
      data.forEach((s, si) =>
        s.values.forEach((v, i) => {
          const x = area.x + band * i + (band - group) / 2 + barW * si;
          const y0 = yOf(0),
            y1 = yOf(v);
          parts.push(
            <g key={`b${si}-${i}`}>
              <rect x={x} y={Math.min(y0, y1)} width={Math.max(0.5, barW)} height={Math.abs(y1 - y0)} fill={palette[si % palette.length]} />
              {el.labels ? text({ x: x + barW / 2, y: v >= 0 ? y1 - 9 : y1 + 9, size: 11, fill: "#" + c.text, children: format(v) }) : null}
            </g>,
          );
        }),
      );
    } else {
      data.forEach((s, si) => {
        const points = s.values.map((v, i) => [area.x + band * (i + 0.5), yOf(v)] as const);
        const color = palette[si % palette.length];
        const line = points.map(([x, y], i) => `${i ? "L" : "M"} ${x} ${y}`).join(" ");
        if (el.chart === "area" && points.length) {
          const base = yOf(Math.max(min, 0));
          parts.push(
            <path key={"a" + si} d={`${line} L ${points[points.length - 1][0]} ${base} L ${points[0][0]} ${base} Z`} fill={color} fillOpacity={0.7} />,
          );
        } else {
          parts.push(<path key={"l" + si} d={line} fill="none" stroke={color} strokeWidth={2.5 * PX} strokeLinejoin="round" />);
          points.forEach(([x, y], i) => parts.push(<circle key={`p${si}-${i}`} cx={x} cy={y} r={3.5 * PX} fill={color} />));
        }
        if (el.labels)
          points.forEach(([x, y], i) => parts.push(<g key={`v${si}-${i}`}>{text({ x, y: y - 12, size: 11, fill: "#" + c.text, children: format(s.values[i]) })}</g>));
      });
    }
    content = parts;
  }

  const legend = el.legend
    ? legendItems.map((label, i) => {
        const size = 12 * PX;
        if (round) {
          const y = plot.y + plot.h / 2 + (i - (legendItems.length - 1) / 2) * size * 1.6;
          const x = width - pad - legendW + size * 0.6;
          return (
            <g key={"lg" + i}>
              <rect x={x} y={y - size * 0.35} width={size * 0.7} height={size * 0.7} fill={palette[i % palette.length]} />
              {text({ x: x + size, y, size: 12, fill: "#" + c.muted, anchor: "start", children: label })}
            </g>
          );
        }
        const widths = legendItems.map((l) => (l.length * 1.05 + 2) * size);
        const total = widths.reduce((a, b) => a + b, 0);
        const x = width / 2 - total / 2 + widths.slice(0, i).reduce((a, b) => a + b, 0);
        const y = height - pad - legendH / 2;
        return (
          <g key={"lg" + i}>
            <rect x={x} y={y - size * 0.35} width={size * 0.7} height={size * 0.7} fill={palette[i % palette.length]} />
            {text({ x: x + size, y, size: 12, fill: "#" + c.muted, anchor: "start", children: label })}
          </g>
        );
      })
    : null;

  return (
    <svg className="chart-svg" width={width} height={height} viewBox={`0 0 ${width} ${height}`} role="img" aria-label={el.title || "图表"}>
      {titleH ? text({ x: width / 2, y: pad + titleH / 2, size: 16, fill: "#" + c.text, children: el.title, weight: 700 }) : null}
      {content}
      {legend}
    </svg>
  );
});
