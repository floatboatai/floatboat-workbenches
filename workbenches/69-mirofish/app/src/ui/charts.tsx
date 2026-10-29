// ABOUTME: 推演可视化：立场构成堆叠面积、平均立场与极化、群体走势、智能体立场热力条；纯 SVG，可直接嵌入导出报告。
import type { RoundMetric, SimResult } from "../contracts/engine";
import { stanceLabel } from "../contracts/scenario";

export const COLORS = { support: "#2b7a84", oppose: "#bf4f2e", neutral: "#cfc8b8", ink: "#20292c", grid: "#e4dfd3", muted: "#6c6a62" };
const TYPE_COLORS: Record<string, string> = { 政府机构: "#33557a", 企业: "#8a6d2f", 媒体: "#7a4f86", 社会组织: "#3f7f57", 学术机构: "#4f6d8a", 群体: "#b0602f", 个人: "#5b5b5b", 议题: "#20292c" };
export const typeColor = (t: string) => TYPE_COLORS[t] ?? "#777";
function mix(a: string, b: string, t: number) {
  const pa = [1, 3, 5].map((i) => parseInt(a.slice(i, i + 2), 16)),
    pb = [1, 3, 5].map((i) => parseInt(b.slice(i, i + 2), 16));
  return "#" + pa.map((v, i) => Math.round(v + (pb[i] - v) * t).toString(16).padStart(2, "0")).join("");
}
export function stanceColor(s: number) {
  const t = Math.min(1, Math.abs(s));
  return s >= 0 ? mix("#e9e4d8", COLORS.support, t) : mix("#e9e4d8", COLORS.oppose, t);
}

type Frame = { w: number; h: number; l: number; r: number; t: number; b: number };
const F: Frame = { w: 720, h: 220, l: 40, r: 12, t: 14, b: 26 };
const xOf = (f: Frame, i: number, n: number) => f.l + ((f.w - f.l - f.r) * i) / Math.max(1, n - 1);
const yOf = (f: Frame, v: number, lo: number, hi: number) => f.t + (f.h - f.t - f.b) * (1 - (v - lo) / (hi - lo));
function XAxis({ f, rounds }: { f: Frame; rounds: RoundMetric[] }) {
  const n = rounds.length,
    step = Math.max(1, Math.ceil(n / 9));
  return (
    <g fontSize="10" fill={COLORS.muted}>
      {rounds.map((r, i) =>
        (i % step === 0 && n - 1 - i >= step / 2) || i === n - 1 ? (
          <text key={r.round} x={xOf(f, i, n)} y={f.h - 8} textAnchor="middle">
            {r.round === 0 ? "初始" : "R" + r.round}
          </text>
        ) : null,
      )}
    </g>
  );
}
function EventMarks({ f, rounds, events }: { f: Frame; rounds: RoundMetric[]; events: SimResult["events"] }) {
  return (
    <g>
      {events.map((e, k) => {
        const i = rounds.findIndex((r) => r.round === e.round);
        if (i < 0) return null;
        const x = xOf(f, i, rounds.length);
        return (
          <g key={e.id + k}>
            <line x1={x} x2={x} y1={f.t} y2={f.h - f.b} stroke={COLORS.ink} strokeDasharray="3 3" strokeWidth="1" opacity="0.55" />
            <circle cx={x} cy={f.t + 2} r="7" fill={COLORS.ink} />
            <text x={x} y={f.t + 5.5} fontSize="9.5" fill="#fff" textAnchor="middle">
              {k + 1}
            </text>
            <title>{`事件 ${k + 1}：${e.title}（第 ${e.round} 轮）`}</title>
          </g>
        );
      })}
    </g>
  );
}
function Cursor({ f, rounds, round }: { f: Frame; rounds: RoundMetric[]; round?: number }) {
  const i = round === undefined ? -1 : rounds.findIndex((r) => r.round === round);
  if (i < 0) return null;
  const x = xOf(f, i, rounds.length);
  return <line x1={x} x2={x} y1={f.t} y2={f.h - f.b} stroke={COLORS.ink} strokeWidth="2" />;
}
function hit(f: Frame, n: number, onRound?: (i: number) => void) {
  if (!onRound) return undefined;
  return (e: React.MouseEvent<SVGRectElement>) => {
    const box = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - box.left) / box.width) * (f.w - f.l - f.r);
    onRound(Math.max(0, Math.min(n - 1, Math.round((x / (f.w - f.l - f.r)) * (n - 1)))));
  };
}

export function ShareChart({ result, round, onRound }: { result: SimResult; round?: number; onRound?: (round: number) => void }) {
  const rounds = result.rounds,
    n = rounds.length,
    f = { ...F, w: 1200, h: 240 };
  const band = (lo: (r: RoundMetric) => number, hi: (r: RoundMetric) => number) =>
    rounds.map((r, i) => `${xOf(f, i, n)},${yOf(f, hi(r), 0, 1)}`).join(" ") +
    " " +
    [...rounds].reverse().map((r, j) => `${xOf(f, n - 1 - j, n)},${yOf(f, lo(r), 0, 1)}`).join(" ");
  return (
    <svg viewBox={`0 0 ${f.w} ${f.h}`} className="chart" role="img" aria-label={`立场构成：结束时支持${Math.round(rounds[n - 1].support * 100)}%，中立${Math.round(rounds[n - 1].neutral * 100)}%，反对${Math.round(rounds[n - 1].oppose * 100)}%`}>
      {[0, 0.25, 0.5, 0.75, 1].map((v) => (
        <g key={v}>
          <line x1={f.l} x2={f.w - f.r} y1={yOf(f, v, 0, 1)} y2={yOf(f, v, 0, 1)} stroke={COLORS.grid} />
          <text x={f.l - 6} y={yOf(f, v, 0, 1) + 3} fontSize="10" fill={COLORS.muted} textAnchor="end">
            {v * 100}%
          </text>
        </g>
      ))}
      <polygon points={band(() => 0, (r) => r.oppose)} fill={COLORS.oppose} opacity="0.85" />
      <polygon points={band((r) => r.oppose, (r) => r.oppose + r.neutral)} fill={COLORS.neutral} opacity="0.9" />
      <polygon points={band((r) => r.oppose + r.neutral, () => 1)} fill={COLORS.support} opacity="0.85" />
      <EventMarks f={f} rounds={rounds} events={result.events} />
      <Cursor f={f} rounds={rounds} round={round} />
      <XAxis f={f} rounds={rounds} />
      {onRound ? <rect x={f.l} y={f.t} width={f.w - f.l - f.r} height={f.h - f.t - f.b} fill="transparent" style={{ cursor: "pointer" }} onClick={hit(f, n, (i) => onRound(rounds[i].round))} /> : null}
    </svg>
  );
}

export function MeanChart({ result, round }: { result: SimResult; round?: number }) {
  const rounds = result.rounds,
    n = rounds.length,
    f = { ...F, h: 180 };
  const line = (v: (r: RoundMetric) => number) => rounds.map((r, i) => `${xOf(f, i, n)},${yOf(f, v(r), -1, 1)}`).join(" ");
  const area =
    rounds.map((r, i) => `${xOf(f, i, n)},${yOf(f, Math.min(1, r.mean + r.sd), -1, 1)}`).join(" ") +
    " " +
    [...rounds].reverse().map((r, j) => `${xOf(f, n - 1 - j, n)},${yOf(f, Math.max(-1, r.mean - r.sd), -1, 1)}`).join(" ");
  const last = rounds[n - 1];
  return (
    <svg viewBox={`0 0 ${f.w} ${f.h}`} className="chart" role="img" aria-label={`平均立场由${rounds[0].mean}变为${last.mean}（${stanceLabel(last.mean)}），极化指数${last.polarization}`}>
      {[-1, -0.5, 0, 0.5, 1].map((v) => (
        <g key={v}>
          <line x1={f.l} x2={f.w - f.r} y1={yOf(f, v, -1, 1)} y2={yOf(f, v, -1, 1)} stroke={v === 0 ? "#bdb6a6" : COLORS.grid} />
          <text x={f.l - 6} y={yOf(f, v, -1, 1) + 3} fontSize="10" fill={COLORS.muted} textAnchor="end">
            {v > 0 ? "+" + v : v}
          </text>
        </g>
      ))}
      <polygon points={area} fill={COLORS.support} opacity="0.12" />
      <polyline points={line((r) => r.polarization * 2 - 1)} fill="none" stroke={COLORS.oppose} strokeWidth="1.5" strokeDasharray="4 3" />
      <polyline points={line((r) => r.mean)} fill="none" stroke={COLORS.ink} strokeWidth="2.2" />
      <EventMarks f={f} rounds={rounds} events={result.events} />
      <Cursor f={f} rounds={rounds} round={round} />
      <XAxis f={f} rounds={rounds} />
    </svg>
  );
}

export function GroupChart({ result }: { result: SimResult }) {
  const rounds = result.rounds,
    n = rounds.length,
    f = { ...F, h: 180, r: 86 };
  const types = Object.keys(rounds[0]?.byType ?? {});
  if (!types.length) return <p className="muted">导入结果没有实体类型，无法分组。</p>;
  // End labels are spread apart so close lines stay readable.
  const labelY = new Map<string, number>();
  let prev = -Infinity;
  for (const [t, y] of types.map((t) => [t, yOf(f, rounds[n - 1].byType[t] ?? 0, -1, 1) + 3] as const).sort((a, b) => a[1] - b[1])) {
    const at = Math.max(y, prev + 12);
    labelY.set(t, at);
    prev = at;
  }
  const overflow = prev - (f.h - 4);
  if (overflow > 0) for (const [t, y] of labelY) labelY.set(t, y - overflow);
  return (
    <svg viewBox={`0 0 ${f.w} ${f.h}`} className="chart" role="img" aria-label={"各类型平均立场：" + types.map((t) => `${t}${rounds[n - 1].byType[t]}`).join("，")}>
      {[-1, 0, 1].map((v) => (
        <line key={v} x1={f.l} x2={f.w - f.r} y1={yOf(f, v, -1, 1)} y2={yOf(f, v, -1, 1)} stroke={v === 0 ? "#bdb6a6" : COLORS.grid} />
      ))}
      {[-1, 0, 1].map((v) => (
        <text key={"t" + v} x={f.l - 6} y={yOf(f, v, -1, 1) + 3} fontSize="10" fill={COLORS.muted} textAnchor="end">
          {v > 0 ? "+1" : v}
        </text>
      ))}
      {types.map((t) => {
        const end = rounds[n - 1].byType[t] ?? 0;
        return (
          <g key={t}>
            <polyline points={rounds.map((r, i) => `${xOf(f, i, n)},${yOf(f, r.byType[t] ?? 0, -1, 1)}`).join(" ")} fill="none" stroke={typeColor(t)} strokeWidth="1.8" />
            <text x={f.w - f.r + 6} y={labelY.get(t)} fontSize="10.5" fill={typeColor(t)}>
              {t} {end > 0 ? "+" : ""}
              {end.toFixed(2)}
            </text>
          </g>
        );
      })}
      <XAxis f={f} rounds={rounds} />
    </svg>
  );
}

/** Agents × rounds stance strip, downsampled to at most 90 columns. */
export function Heatmap({ result, selected, onAgent, onRound }: { result: SimResult; selected?: number; onAgent?: (id: number) => void; onRound?: (round: number) => void }) {
  const order = result.agents.map((a, i) => ({ a, i })).sort((x, y) => x.a.type.localeCompare(y.a.type, "zh") || x.a.start - y.a.start);
  const total = result.rounds.length;
  const step = Math.max(1, Math.ceil(total / 90));
  const cols = Array.from({ length: Math.ceil(total / step) }, (_, k) => Math.min(total - 1, k * step));
  const label = 150,
    cw = Math.max(4, Math.floor(1000 / cols.length)),
    rh = 14;
  const w = label + cols.length * cw + 4,
    h = order.length * rh + 22;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="heatmap" role="img" aria-label={`${order.length}个智能体在${total - 1}轮中的立场变化热力图`}>
      {order.map(({ a, i }, row) => (
        <g key={a.id} className={selected === a.id ? "row selected" : "row"} onClick={onAgent ? () => onAgent(a.id) : undefined} style={onAgent ? { cursor: "pointer" } : undefined}>
          <text x={label - 6} y={row * rh + 11} fontSize="10" textAnchor="end" fill={selected === a.id ? COLORS.ink : COLORS.muted} fontWeight={selected === a.id ? 700 : 400}>
            {a.name.length > 14 ? a.name.slice(0, 13) + "…" : a.name}
          </text>
          {cols.map((c, k) => (
            <rect key={k} x={label + k * cw} y={row * rh + 1} width={cw - 0.5} height={rh - 2} fill={stanceColor(result.trajectories[i][c] ?? 0)}>
              <title>{`${a.name} · ${c === 0 ? "初始" : "第" + c + "轮"}：${(result.trajectories[i][c] ?? 0).toFixed(2)}`}</title>
            </rect>
          ))}
        </g>
      ))}
      {cols.map((c, k) =>
        k % Math.max(1, Math.ceil(cols.length / 8)) === 0 ? (
          <text key={c} x={label + k * cw} y={h - 6} fontSize="9.5" fill={COLORS.muted} onClick={onRound ? () => onRound(c) : undefined}>
            {c === 0 ? "初始" : "R" + c}
          </text>
        ) : null,
      )}
    </svg>
  );
}
