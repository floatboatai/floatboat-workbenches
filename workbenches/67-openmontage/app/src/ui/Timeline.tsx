// ABOUTME: 多轨时间线：时间尺拖动定位、片段移动/换轨/修剪、吸附、播放头跟随、从素材库拖入。
import { memo, useEffect, useLayoutEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { Eye, EyeOff, Film, Image as ImageIcon, Music, Type, Volume2, VolumeX } from "lucide-react";
import { clipEnd, duration, timecode, type Clip, type Timeline, type Track } from "../contracts/timeline";
import { moveClip, snap, snapPoints, trimClip, overlapWithPrevious } from "../contracts/edit";
import type { Player } from "./engine/player";

export const ASSET_DRAG = "application/x-openmontage-asset";

type Drag = {
  id: string;
  mode: "move" | "start" | "end";
  x: number;
  y: number;
  base: Timeline;
  clip: Clip;
  moved: boolean;
  pointer: number;
};

function rulerStep(zoom: number) {
  for (const s of [0.5, 1, 2, 5, 10, 15, 30, 60, 120, 300]) if (s * zoom >= 64) return s;
  return 600;
}

const kindIcon = (k: Track["kind"]) => (k === "video" ? Film : k === "audio" ? Music : Type);

export const TimelineView = memo(function TimelineView({
  timeline,
  player,
  selected,
  selectedTrack,
  zoom,
  snapping,
  mutable,
  onSelect,
  onSelectTrack,
  onPreview,
  onCommit,
  onDropAsset,
  onToggleTrack,
  onZoom,
}: {
  timeline: Timeline;
  player: Player;
  selected: string | null;
  selectedTrack: string | null;
  zoom: number;
  snapping: boolean;
  mutable: boolean;
  onSelect: (id: string | null) => void;
  onSelectTrack: (id: string) => void;
  onPreview: (t: Timeline) => void;
  onCommit: (base: Timeline, next: Timeline) => void;
  onDropAsset: (assetId: string, trackId: string, time: number) => void;
  onToggleTrack: (id: string) => void;
  onZoom: (factor: number) => void;
}) {
  const scroller = useRef<HTMLDivElement>(null);
  const head = useRef<HTMLDivElement>(null);
  const drag = useRef<Drag | null>(null);
  const latest = useRef(timeline);
  latest.current = timeline;
  const zoomRef = useRef(onZoom);
  zoomRef.current = onZoom;
  /** 轨道名称列宽度随断点变化，从 DOM 读取。 */
  const header = () => scroller.current?.querySelector<HTMLElement>(".tl-head")?.offsetWidth ?? 0;
  const [guide, setGuide] = useState<number | null>(null);
  const total = duration(timeline);
  const width = Math.max(total + 8, 30) * zoom;
  const step = rulerStep(zoom);
  const assets = new Map(timeline.assets.map((a) => [a.id, a]));

  // 播放头直接改 transform，不触发整条时间线重渲染。
  useLayoutEffect(() => {
    const place = () => {
      const x = player.getTime() * zoom;
      if (head.current) head.current.style.transform = `translateX(${x}px)`;
      const box = scroller.current;
      if (box && player.isPlaying()) {
        const view = box.clientWidth - header();
        if (x < box.scrollLeft || x > box.scrollLeft + view - 40) box.scrollLeft = Math.max(0, x - view * 0.2);
      }
    };
    place();
    return player.subscribe(place);
  }, [player, zoom]);

  const timeAt = (clientX: number) => {
    const box = scroller.current!;
    const rect = box.getBoundingClientRect();
    return Math.max(0, (clientX - rect.left - header() + box.scrollLeft) / zoom);
  };
  const trackAt = (clientX: number, clientY: number) => {
    const el = document.elementFromPoint(clientX, clientY)?.closest<HTMLElement>("[data-track]");
    return el?.dataset.track;
  };

  function scrub(e: ReactPointerEvent<HTMLElement>) {
    if (e.button !== 0) return;
    const target = e.currentTarget;
    target.setPointerCapture(e.pointerId);
    player.seek(timeAt(e.clientX));
    const move = (ev: PointerEvent) => player.seek(timeAt(ev.clientX));
    const up = () => {
      target.removeEventListener("pointermove", move);
      target.removeEventListener("pointerup", up);
      target.removeEventListener("pointercancel", up);
    };
    target.addEventListener("pointermove", move);
    target.addEventListener("pointerup", up);
    target.addEventListener("pointercancel", up);
  }

  function beginClip(e: ReactPointerEvent<HTMLDivElement>, clip: Clip) {
    if (e.button !== 0) return;
    e.stopPropagation();
    onSelect(clip.id);
    if (!mutable) return;
    const handle = (e.target as HTMLElement).dataset.handle;
    drag.current = { id: clip.id, mode: handle === "start" ? "start" : handle === "end" ? "end" : "move", x: e.clientX, y: e.clientY, base: latest.current, clip, moved: false, pointer: e.pointerId };
    e.currentTarget.setPointerCapture(e.pointerId);
  }
  function moveDrag(e: ReactPointerEvent<HTMLDivElement>) {
    const d = drag.current;
    if (!d || d.pointer !== e.pointerId) return;
    if (!d.moved && Math.abs(e.clientX - d.x) < 3 && Math.abs(e.clientY - d.y) < 3) return;
    d.moved = true;
    const dx = (e.clientX - d.x) / zoom;
    const points = snapping ? snapPoints(d.base, d.id, player.getTime()) : [];
    const tolerance = 8 / zoom;
    let next: Timeline, line: number | null = null;
    if (d.mode === "move") {
      const raw = Math.max(0, d.clip.start + dx);
      const a = snap(raw, points, tolerance), b = snap(raw + d.clip.duration, points, tolerance) - d.clip.duration;
      const start = Math.abs(a - raw) <= Math.abs(b - raw) ? a : b;
      if (start !== raw) line = start === a ? a : start + d.clip.duration;
      next = moveClip(d.base, d.id, start, trackAt(e.clientX, e.clientY));
    } else {
      const edge = d.mode === "start" ? d.clip.start : clipEnd(d.clip);
      const raw = edge + dx, value = snap(raw, points, tolerance);
      if (value !== raw) line = value;
      next = trimClip(d.base, d.id, d.mode, value);
    }
    setGuide(line);
    onPreview(next);
  }
  function endDrag(e: ReactPointerEvent<HTMLDivElement>) {
    const d = drag.current;
    if (!d || d.pointer !== e.pointerId) return;
    drag.current = null;
    setGuide(null);
    if (d.moved && latest.current !== d.base) onCommit(d.base, latest.current);
  }

  useEffect(() => {
    const box = scroller.current;
    if (!box) return;
    const wheel = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      zoomRef.current(e.deltaY < 0 ? 1.15 : 1 / 1.15);
    };
    box.addEventListener("wheel", wheel, { passive: false });
    return () => box.removeEventListener("wheel", wheel);
  }, []);

  const ticks: number[] = [];
  for (let s = 0; s * zoom <= width; s += step) ticks.push(s);

  return (
    <div className="timeline" ref={scroller} style={{ ["--zoom" as string]: zoom }}>
      <div className="tl-inner" style={{ ["--lanes" as string]: width + "px" }}>
        <div className="tl-row tl-ruler-row">
          <div className="tl-head tl-corner">
            <span>{timecode(total, timeline.settings.fps)}</span>
          </div>
          <div className="tl-ruler" onPointerDown={scrub} title="点击或拖动定位播放头">
            {ticks.map((s) => (
              <span key={s} className="tick" style={{ left: s * zoom }}>
                {timecode(s, timeline.settings.fps).replace(/:\d\d$/, "")}
              </span>
            ))}
          </div>
        </div>
        {timeline.tracks.map((track) => {
          const Icon = kindIcon(track.kind);
          const Toggle = track.kind === "audio" ? (track.muted ? VolumeX : Volume2) : track.muted ? EyeOff : Eye;
          const clips = timeline.clips.filter((c) => c.trackId === track.id);
          return (
            <div key={track.id} className={"tl-row track-" + track.kind + (track.muted ? " muted" : "")}>
              <div className={"tl-head" + (selectedTrack === track.id ? " chosen" : "")}>
                <button className="track-name" onClick={() => onSelectTrack(track.id)} aria-label={`轨道 ${track.name} 设置`}>
                  <Icon aria-hidden="true" size={14} />
                  <span>{track.name}</span>
                </button>
                <button
                  className="icon"
                  aria-pressed={track.muted}
                  aria-label={(track.kind === "audio" ? (track.muted ? "取消静音 " : "静音 ") : track.muted ? "显示 " : "隐藏 ") + track.name}
                  disabled={!mutable}
                  onClick={() => onToggleTrack(track.id)}
                >
                  <Toggle aria-hidden="true" size={14} />
                </button>
              </div>
              <div
                className="tl-lane"
                data-track={track.id}
                onPointerDown={(e) => {
                  if (e.target === e.currentTarget) {
                    onSelect(null);
                    scrub(e);
                  }
                }}
                onDragOver={(e) => {
                  if (mutable && e.dataTransfer.types.includes(ASSET_DRAG)) {
                    e.preventDefault();
                    e.dataTransfer.dropEffect = "copy";
                  }
                }}
                onDrop={(e) => {
                  const id = e.dataTransfer.getData(ASSET_DRAG);
                  if (!id) return;
                  e.preventDefault();
                  onDropAsset(id, track.id, timeAt(e.clientX));
                }}
              >
                {clips.map((c) => {
                  const asset = c.assetId ? assets.get(c.assetId) : null;
                  const label = asset ? asset.name : c.text.split("\n")[0] || "（空文字）";
                  const Kind = asset?.kind === "image" ? ImageIcon : asset?.kind === "audio" ? Music : asset ? Film : Type;
                  const cross = overlapWithPrevious(timeline, c);
                  return (
                    <div
                      key={c.id}
                      role="button"
                      tabIndex={0}
                      aria-pressed={selected === c.id}
                      aria-label={`${label}，起点 ${timecode(c.start, timeline.settings.fps)}，时长 ${c.duration.toFixed(2)} 秒`}
                      className={"clip kind-" + (asset?.kind ?? "text") + (selected === c.id ? " selected" : "")}
                      style={{ left: c.start * zoom, width: Math.max(4, c.duration * zoom) }}
                      onPointerDown={(e) => beginClip(e, c)}
                      onPointerMove={moveDrag}
                      onPointerUp={endDrag}
                      onPointerCancel={endDrag}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          e.stopPropagation();
                          onSelect(c.id);
                        }
                      }}
                    >
                      {c.fadeIn > 0 ? <span className={"fade in" + (cross ? " cross" : "")} style={{ width: c.fadeIn * zoom }} aria-hidden="true" /> : null}
                      {c.fadeOut > 0 ? <span className="fade out" style={{ width: c.fadeOut * zoom }} aria-hidden="true" /> : null}
                      <span className="clip-label">
                        <Kind aria-hidden="true" size={12} />
                        <span>{label}</span>
                      </span>
                      {asset && asset.kind !== "image" && c.volume < 1 ? <span className="clip-volume">{Math.round(c.volume * 100)}%</span> : null}
                      <span className="handle" data-handle="start" aria-hidden="true" />
                      <span className="handle" data-handle="end" aria-hidden="true" />
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
        <div className="tl-overlay" aria-hidden="true">
          <div className="playhead" ref={head} />
          {guide !== null ? <div className="snap-guide" style={{ transform: `translateX(${guide * zoom}px)` }} /> : null}
        </div>
      </div>
    </div>
  );
});
