// ABOUTME: 时间线编辑操作（添加、移动、修剪、分割、交叉溶解、删除、吸附），纯函数便于测试与撤销。
import type { Asset } from "./media.ts";
import {
  accepts,
  clipEnd,
  round,
  MIN_CLIP,
  MAX_TIMELINE,
  PRESETS,
  type Clip,
  type TextPreset,
  type Timeline,
  type Track,
} from "./timeline.ts";

export const newId = (prefix: string) =>
  prefix + "-" + crypto.randomUUID().replace(/-/g, "").slice(0, 12);
const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));
const trackEnd = (t: Timeline, trackId: string) =>
  t.clips.filter((c) => c.trackId === trackId).reduce((n, c) => Math.max(n, clipEnd(c)), 0);

export function defaultTrackFor(t: Timeline, asset: Asset | null): Track | undefined {
  const fit = t.tracks.filter((k) => accepts(k.kind, asset));
  // 画面默认进最靠下（主画面）视频轨；音频进第一条音频轨；文字进第一条文字轨。
  return asset && asset.kind !== "audio" ? fit[fit.length - 1] : fit[0];
}

export function addAsset(t: Timeline, asset: Asset): Timeline {
  if (t.assets.some((a) => a.id === asset.id)) return t;
  return { ...t, assets: [...t.assets, asset] };
}

export function addMediaClip(t: Timeline, asset: Asset, at?: number, trackId?: string): { timeline: Timeline; clip: Clip | null } {
  const track = trackId ? t.tracks.find((k) => k.id === trackId) : defaultTrackFor(t, asset);
  if (!track || !accepts(track.kind, asset)) return { timeline: t, clip: null };
  const base = addAsset(t, asset);
  const length = asset.duration ?? 4;
  const clip: Clip = {
    id: newId("c"),
    trackId: track.id,
    assetId: asset.id,
    text: "",
    style: null,
    start: round(clamp(at ?? trackEnd(base, track.id), 0, MAX_TIMELINE)),
    in: 0,
    duration: round(Math.max(MIN_CLIP, length)),
    volume: 1,
    fadeIn: 0,
    fadeOut: 0,
    fit: "cover",
    motion: asset.kind === "image" ? "zoom-in" : "none",
    note: "",
  };
  return { timeline: { ...base, clips: [...base.clips, clip] }, clip };
}

export function addTextClip(t: Timeline, preset: TextPreset, at: number, text: string, trackId?: string, length = 3): { timeline: Timeline; clip: Clip | null } {
  const tracks = t.tracks.filter((k) => k.kind === "text");
  const track = (trackId && tracks.find((k) => k.id === trackId)) || (preset === "subtitle" ? tracks.find((k) => k.name.includes("字幕")) : undefined) || tracks[0];
  if (!track) return { timeline: t, clip: null };
  const clip: Clip = {
    id: newId("c"),
    trackId: track.id,
    assetId: null,
    text,
    style: { ...PRESETS[preset] },
    start: round(clamp(at, 0, MAX_TIMELINE)),
    in: 0,
    duration: round(Math.max(MIN_CLIP, length)),
    volume: 1,
    fadeIn: preset === "title" ? 0.5 : 0,
    fadeOut: preset === "title" ? 0.5 : 0,
    fit: "cover",
    motion: "none",
    note: "",
  };
  return { timeline: { ...t, clips: [...t.clips, clip] }, clip };
}

export function patchClip(t: Timeline, id: string, patch: Partial<Omit<Clip, "id">>): Timeline {
  return {
    ...t,
    clips: t.clips.map((c) => {
      if (c.id !== id) return c;
      const next = { ...c, ...patch };
      next.fadeIn = Math.min(next.fadeIn, next.duration);
      next.fadeOut = Math.min(next.fadeOut, next.duration);
      return next;
    }),
  };
}

const sourceLength = (t: Timeline, c: Clip) =>
  c.assetId ? t.assets.find((a) => a.id === c.assetId)?.duration ?? null : null;

/** 移动片段到新起点；可换到同类轨道。 */
export function moveClip(t: Timeline, id: string, start: number, trackId?: string): Timeline {
  const clip = t.clips.find((c) => c.id === id);
  if (!clip) return t;
  let target = clip.trackId;
  if (trackId && trackId !== clip.trackId) {
    const track = t.tracks.find((k) => k.id === trackId);
    const asset = clip.assetId ? t.assets.find((a) => a.id === clip.assetId) ?? null : null;
    if (track && accepts(track.kind, asset)) target = track.id;
  }
  return patchClip(t, id, { start: round(clamp(start, 0, MAX_TIMELINE)), trackId: target });
}

/** 拖动片段左/右边缘修剪。左缘同时移动入点，素材长度限制修剪范围。 */
export function trimClip(t: Timeline, id: string, edge: "start" | "end", time: number): Timeline {
  const c = t.clips.find((x) => x.id === id);
  if (!c) return t;
  const length = sourceLength(t, c), end = clipEnd(c);
  if (edge === "start") {
    const earliest = length === null ? 0 : Math.max(0, c.start - c.in);
    const start = clamp(time, earliest, end - MIN_CLIP);
    const delta = start - c.start;
    return patchClip(t, id, { start: round(start), in: round(length === null ? 0 : c.in + delta), duration: round(end - start) });
  }
  const latest = length === null ? MAX_TIMELINE : c.start + (length - c.in);
  const next = clamp(time, c.start + MIN_CLIP, latest);
  return patchClip(t, id, { duration: round(next - c.start) });
}

/** 在时间点分割片段：左段保留淡入，右段保留淡出与音量设置。 */
export function splitClip(t: Timeline, id: string, at: number): { timeline: Timeline; right: Clip | null } {
  const c = t.clips.find((x) => x.id === id);
  if (!c || at <= c.start + MIN_CLIP - 1e-6 || at >= clipEnd(c) - MIN_CLIP + 1e-6) return { timeline: t, right: null };
  const leftDuration = round(at - c.start);
  const timed = sourceLength(t, c) !== null;
  const left: Clip = { ...c, duration: leftDuration, fadeOut: 0, fadeIn: Math.min(c.fadeIn, leftDuration) };
  const right: Clip = {
    ...c,
    id: newId("c"),
    start: round(at),
    in: timed ? round(c.in + leftDuration) : 0,
    duration: round(c.duration - leftDuration),
    fadeIn: 0,
    fadeOut: Math.min(c.fadeOut, round(c.duration - leftDuration)),
  };
  const clips = t.clips.flatMap((x) => (x.id === id ? [left, right] : [x]));
  return { timeline: { ...t, clips }, right };
}

/** 选中轨道所有在时间点上的片段一起分割。 */
export function splitAt(t: Timeline, at: number, onlyId?: string) {
  let next = t;
  for (const c of t.clips) {
    if (onlyId && c.id !== onlyId) continue;
    next = splitClip(next, c.id, at).timeline;
  }
  return next;
}

export function removeClip(t: Timeline, id: string, ripple = false): Timeline {
  const c = t.clips.find((x) => x.id === id);
  if (!c) return t;
  const clips = t.clips
    .filter((x) => x.id !== id)
    .map((x) => (ripple && x.trackId === c.trackId && x.start >= clipEnd(c) - 1e-6 ? { ...x, start: round(x.start - c.duration) } : x));
  return { ...t, clips };
}

export function duplicateClip(t: Timeline, id: string): { timeline: Timeline; clip: Clip | null } {
  const c = t.clips.find((x) => x.id === id);
  if (!c) return { timeline: t, clip: null };
  const clip = { ...c, id: newId("c"), start: trackEnd(t, c.trackId) };
  return { timeline: { ...t, clips: [...t.clips, clip] }, clip };
}

/** 同轨上一段（结束点不晚于本段起点、最接近的那段）。 */
export function previousOnTrack(t: Timeline, c: Clip): Clip | undefined {
  return t.clips
    .filter((x) => x.trackId === c.trackId && x.id !== c.id && x.start < c.start - 1e-6)
    .sort((a, b) => clipEnd(b) - clipEnd(a))[0];
}

/**
 * 与同轨上一段交叉溶解：本段及其后片段整体前移，使两段重叠 seconds 秒，本段在重叠区淡入。
 * 声音同时交叉淡化。
 */
export function crossfade(t: Timeline, id: string, seconds: number): Timeline {
  const c = t.clips.find((x) => x.id === id);
  if (!c) return t;
  const prev = previousOnTrack(t, c);
  if (!prev) throw new Error("同一轨道上没有前一段，无法交叉溶解；可改用淡入。");
  const d = round(clamp(seconds, 0.1, Math.min(prev.duration, c.duration) - 0.01));
  const shift = round(c.start - (clipEnd(prev) - d));
  return {
    ...t,
    clips: t.clips.map((x) => {
      if (x.trackId !== c.trackId || x.start < c.start - 1e-6) return x;
      const moved = { ...x, start: round(Math.max(0, x.start - shift)) };
      return x.id === c.id ? { ...moved, fadeIn: d } : moved;
    }),
  };
}

/** 与上一段的重叠秒数（交叉溶解长度）。 */
export function overlapWithPrevious(t: Timeline, c: Clip) {
  const prev = previousOnTrack(t, c);
  return prev ? Math.max(0, round(clipEnd(prev) - c.start)) : 0;
}

export function snapPoints(t: Timeline, excludeId: string | null, playhead: number) {
  const points = new Set<number>([0, round(playhead)]);
  for (const c of t.clips) {
    if (c.id === excludeId) continue;
    points.add(c.start);
    points.add(clipEnd(c));
  }
  return [...points];
}
export function snap(value: number, points: number[], tolerance: number) {
  let best = value, distance = tolerance;
  for (const p of points) {
    const d = Math.abs(p - value);
    if (d < distance) { best = p; distance = d; }
  }
  return best;
}

export function addTrack(t: Timeline, kind: Track["kind"]): Timeline {
  const count = t.tracks.filter((k) => k.kind === kind).length + 1;
  const name = { video: "画面 ", audio: "音频 ", text: "文字 " }[kind] + count;
  const track: Track = { id: newId(kind[0]), kind, name, muted: false, volume: 1 };
  // 新轨插在同类轨道最上方，保持“文字 / 画面 / 音频”分区。
  const tracks = [...t.tracks];
  if (t.tracks.length >= 24) throw new Error("最多 24 条轨道。");
  if (kind === "audio") tracks.push(track);
  else {
    const first = tracks.findIndex((k) => k.kind === kind);
    const audio = tracks.findIndex((k) => k.kind === "audio");
    tracks.splice(first >= 0 ? first : kind === "text" ? 0 : audio >= 0 ? audio : tracks.length, 0, track);
  }
  return { ...t, tracks };
}
export function removeTrack(t: Timeline, id: string): Timeline {
  const track = t.tracks.find((k) => k.id === id);
  if (!track) return t;
  if (t.tracks.filter((k) => k.kind === track.kind).length <= 1) throw new Error("每类轨道至少保留一条。");
  return { ...t, tracks: t.tracks.filter((k) => k.id !== id), clips: t.clips.filter((c) => c.trackId !== id) };
}
export function patchTrack(t: Timeline, id: string, patch: Partial<Omit<Track, "id" | "kind">>): Timeline {
  return { ...t, tracks: t.tracks.map((k) => (k.id === id ? { ...k, ...patch } : k)) };
}
/** 从素材库移除素材，连同引用它的片段。 */
export function removeAsset(t: Timeline, id: string): Timeline {
  return { ...t, assets: t.assets.filter((a) => a.id !== id), clips: t.clips.filter((c) => c.assetId !== id) };
}
