// ABOUTME: 可缩放的波形时间轴：真实峰值、按说话人着色的字幕区间、可拖动/键盘微调的入出点、逐词轨与播放头。
import { memo, useCallback, useEffect, useLayoutEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import type { Word } from "../contracts/transcript";
import { lowConfidence } from "../contracts/edit";
import { clock } from "../contracts/transcript";
import type { Peaks } from "./usePlayer";

export interface Span {
  id: string;
  index: number;
  s: number;
  e: number;
  color: string;
  speaker: string;
  text: string;
  words: Word[];
}
export const ZOOMS = [0, 20, 50, 100, 200, 400];

type Drag = { id: string; edge: "start" | "end"; t: number; pointer: number } | null;

function rulerStep(pps: number) {
  const target = 90 / pps;
  return [0.1, 0.2, 0.5, 1, 2, 5, 10, 15, 30, 60, 120, 300, 600, 1800, 3600].find((s) => s >= target) ?? 3600;
}
const label = (t: number, step: number) => {
  const c = clock(t);
  return step < 1 ? c.slice(3, 10) : t >= 3600 ? c.slice(0, 8) : c.slice(3, 8);
};

export const Timeline = memo(function Timeline({
  peaks,
  span,
  time,
  playing,
  spans,
  selected,
  zoom,
  onSeek,
  onSelect,
  onEdge,
}: {
  peaks: Peaks | null;
  span: number;
  time: number;
  playing: boolean;
  spans: Span[];
  selected: string;
  zoom: number;
  onSeek: (t: number) => void;
  onSelect: (id: string, t: number) => void;
  onEdge: (id: string, edge: "start" | "end", t: number) => void;
}) {
  const scroller = useRef<HTMLDivElement>(null),
    canvas = useRef<HTMLCanvasElement>(null);
  const [view, setView] = useState({ left: 0, width: 800 });
  const [drag, setDrag] = useState<Drag>(null);
  const pps = zoom || Math.max(1, view.width / Math.max(0.5, span));
  const total = Math.max(view.width, span * pps);

  useLayoutEffect(() => {
    const el = scroller.current;
    if (!el) return;
    const sync = () => setView({ left: el.scrollLeft, width: el.clientWidth });
    sync();
    const observer = new ResizeObserver(sync);
    observer.observe(el);
    let frame = 0;
    const onScroll = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(sync);
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      observer.disconnect();
      el.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(frame);
    };
  }, []);

  // Keep the playhead in view while playing, and centre the selection when zoom changes.
  useEffect(() => {
    const el = scroller.current;
    if (!el || !playing || !zoom) return;
    const x = time * pps;
    if (x < el.scrollLeft + 24 || x > el.scrollLeft + el.clientWidth - 48) el.scrollLeft = Math.max(0, x - el.clientWidth * 0.2);
  }, [time, playing, pps, zoom]);
  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    const target = spans.find((s) => s.id === selected);
    const x = (target ? target.s : time) * pps;
    el.scrollLeft = Math.max(0, x - el.clientWidth * 0.3);
  }, [zoom]);
  useEffect(() => {
    const el = scroller.current,
      target = spans.find((s) => s.id === selected);
    if (!el || !target || !zoom || playing) return;
    if (target.s * pps < el.scrollLeft || target.e * pps > el.scrollLeft + el.clientWidth)
      el.scrollLeft = Math.max(0, target.s * pps - el.clientWidth * 0.3);
  }, [selected]);

  useEffect(() => {
    const c = canvas.current;
    if (!c) return;
    const ratio = window.devicePixelRatio || 1,
      w = view.width,
      h = c.clientHeight || 120;
    c.width = Math.round(w * ratio);
    c.height = Math.round(h * ratio);
    const g = c.getContext("2d");
    if (!g) return;
    g.setTransform(ratio, 0, 0, ratio, 0, 0);
    g.clearRect(0, 0, w, h);
    const style = getComputedStyle(c);
    const mid = h / 2;
    g.fillStyle = style.getPropertyValue("--wave-mid").trim() || "#2b3846";
    g.fillRect(0, mid, w, 1);
    if (!peaks) return;
    g.fillStyle = style.getPropertyValue("--wave").trim() || "#4fb8a8";
    const { values, rate } = peaks;
    for (let x = 0; x < w; x++) {
      const t0 = (view.left + x) / pps,
        t1 = (view.left + x + 1) / pps;
      if (t0 > peaks.duration) break;
      const a = Math.floor(t0 * rate),
        b = Math.max(a + 1, Math.ceil(t1 * rate));
      let v = 0;
      for (let i = a; i < b && i < values.length; i++) if (values[i] > v) v = values[i];
      const bar = Math.max(0.5, v * (mid - 4));
      g.fillRect(x, mid - bar, 1, bar * 2);
    }
  }, [peaks, view, pps]);

  const timeAt = useCallback(
    (clientX: number) => {
      const el = scroller.current!;
      const box = el.getBoundingClientRect();
      return Math.max(0, Math.min(span, (clientX - box.left + el.scrollLeft) / pps));
    },
    [pps, span],
  );
  const snap = (id: string, t: number, free: boolean) => {
    if (free) return t;
    const own = spans.find((s) => s.id === id),
      candidates: number[] = [];
    own?.words.forEach((w) => candidates.push(w.s, w.e));
    for (const s of spans) if (s.id !== id) candidates.push(s.s, s.e);
    let best = t,
      gap = 6 / pps;
    for (const c of candidates)
      if (Math.abs(c - t) < gap) {
        gap = Math.abs(c - t);
        best = c;
      }
    return best;
  };
  const bound = (id: string, edge: "start" | "end", t: number) => {
    const own = spans.find((s) => s.id === id);
    if (!own) return t;
    return edge === "start" ? Math.max(0, Math.min(own.e - 0.01, t)) : Math.min(Math.max(span, own.e), Math.max(own.s + 0.01, t));
  };
  const startDrag = (e: ReactPointerEvent, id: string, edge: "start" | "end") => {
    e.stopPropagation();
    e.preventDefault();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    const own = spans.find((s) => s.id === id)!;
    setDrag({ id, edge, t: edge === "start" ? own.s : own.e, pointer: e.pointerId });
  };
  const moveDrag = (e: ReactPointerEvent) => {
    if (!drag || e.pointerId !== drag.pointer) return;
    setDrag({ ...drag, t: bound(drag.id, drag.edge, snap(drag.id, timeAt(e.clientX), e.altKey)) });
  };
  const endDrag = (e: ReactPointerEvent) => {
    if (!drag || e.pointerId !== drag.pointer) return;
    onEdge(drag.id, drag.edge, Math.round(drag.t * 1000) / 1000);
    setDrag(null);
  };

  const from = view.left / pps - 1,
    to = (view.left + view.width) / pps + 1;
  const visible = spans.filter((s) => s.e >= from && s.s <= to);
  const showAllWords = pps >= 60;
  const step = rulerStep(pps);
  const ticks: number[] = [];
  for (let t = Math.max(0, Math.floor(from / step) * step); t <= Math.min(span, to); t += step) ticks.push(t);

  return (
    <div className="timeline">
      <div
        ref={scroller}
        className="timeline-scroll"
        onPointerDown={(e) => {
          if (e.button === 0 && (e.target as HTMLElement).closest(".lane-hit")) onSeek(timeAt(e.clientX));
        }}
      >
        <div className="timeline-inner" style={{ width: total }}>
          <canvas ref={canvas} className="wave-canvas" style={{ left: view.left, width: view.width }} aria-hidden="true" />
          <div className="lane-hit" aria-hidden="true" />
          {visible.map((s) => {
            const live = drag?.id === s.id ? drag : null,
              start = live?.edge === "start" ? live.t : s.s,
              end = live?.edge === "end" ? live.t : s.e;
            return (
              <div
                key={s.id}
                className={`region ${s.id === selected ? "selected" : ""}`}
                style={{ left: start * pps, width: Math.max(2, (end - start) * pps), ["--c" as string]: s.color }}
                onPointerDown={(e) => {
                  if (e.button !== 0) return;
                  e.stopPropagation();
                  onSelect(s.id, timeAt(e.clientX));
                }}
                onPointerMove={moveDrag}
                onPointerUp={endDrag}
                onPointerCancel={() => setDrag(null)}
              >
                <span className="region-label">
                  {String(s.index + 1).padStart(2, "0")} {s.speaker}
                </span>
                {(["start", "end"] as const).map((edge) => (
                  <span
                    key={edge}
                    role="slider"
                    tabIndex={0}
                    className={`handle ${edge}`}
                    aria-label={`波形：第 ${s.index + 1} 句${edge === "start" ? "入点" : "出点"}`}
                    aria-valuemin={0}
                    aria-valuemax={Math.round(span * 1000) / 1000}
                    aria-valuenow={Math.round((edge === "start" ? start : end) * 1000) / 1000}
                    aria-valuetext={clock(edge === "start" ? start : end)}
                    onPointerDown={(e) => startDrag(e, s.id, edge)}
                    onKeyDown={(e) => {
                      if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
                      e.preventDefault();
                      const delta = (e.key === "ArrowLeft" ? -1 : 1) * (e.shiftKey ? 0.01 : 0.05);
                      onEdge(s.id, edge, Math.round(bound(s.id, edge, (edge === "start" ? s.s : s.e) + delta) * 1000) / 1000);
                    }}
                  />
                ))}
              </div>
            );
          })}
          <div className="word-lane">
            {visible
              .filter((s) => showAllWords || s.id === selected)
              .flatMap((s) =>
                s.words.map((w, i) => (
                  <button
                    key={`${s.id}-${i}`}
                    type="button"
                    tabIndex={-1}
                    className={`word-tick ${lowConfidence(w) ? "low" : ""} ${w.p < 0 ? "edited" : ""} ${time >= w.s && time < w.e ? "now" : ""}`}
                    style={{ left: w.s * pps, width: Math.max(3, (w.e - w.s) * pps - 1) }}
                    title={`${w.w.trim()} · ${clock(w.s).slice(3)}–${clock(w.e).slice(3)}${w.p >= 0 ? ` · 置信 ${Math.round(w.p * 100)}%` : " · 人工修改"}`}
                    onPointerDown={(e) => {
                      e.stopPropagation();
                      onSelect(s.id, w.s);
                    }}
                  >
                    {pps * (w.e - w.s) > 11 ? w.w.trim() : ""}
                  </button>
                )),
              )}
          </div>
          <div className="ruler" aria-hidden="true">
            {ticks.map((t) => (
              <span key={t} style={{ left: t * pps }}>
                {label(t, step)}
              </span>
            ))}
          </div>
          {drag ? <div className="drag-time" style={{ left: drag.t * pps }}>{clock(drag.t).slice(3)}</div> : null}
          <div className="playhead" style={{ left: Math.min(total, time * pps) }} aria-hidden="true" />
        </div>
      </div>
    </div>
  );
});
