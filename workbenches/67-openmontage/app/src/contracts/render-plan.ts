// ABOUTME: 导出计划：每个画面片段占用的帧区间与素材时间戳、每个有声片段的增益包络。与浏览器 API 无关，便于测试。
import { clipEnd, duration, envelope, round, type Clip, type Timeline } from "./timeline.ts";

export type FrameSpan = { clip: Clip; first: number; last: number; timestamps: number[] };
export type GainPoint = { time: number; gain: number };
export type AudioPart = { clip: Clip; assetId: string; at: number; from: number; length: number; gains: GainPoint[] };

export const frameCount = (t: Timeline, fps = t.settings.fps) => Math.max(1, Math.ceil(duration(t) * fps - 1e-6));

/** 每个可见画面片段（视频）对应的输出帧区间及要解码的素材时间戳，按帧顺序递增。 */
export function frameSpans(t: Timeline, fps = t.settings.fps): FrameSpan[] {
  const hidden = new Set(t.tracks.filter((k) => k.muted).map((k) => k.id));
  const spans: FrameSpan[] = [];
  for (const c of t.clips) {
    if (!c.assetId || hidden.has(c.trackId)) continue;
    const asset = t.assets.find((a) => a.id === c.assetId);
    if (!asset || asset.kind !== "video") continue;
    const first = Math.ceil(c.start * fps - 1e-6), last = Math.ceil(clipEnd(c) * fps - 1e-6) - 1;
    if (last < first) continue;
    const timestamps: number[] = [];
    for (let i = first; i <= last; i++) timestamps.push(round(Math.min(c.in + c.duration - 1 / fps / 2, c.in + Math.max(0, i / fps - c.start))));
    spans.push({ clip: c, first, last, timestamps });
  }
  return spans;
}

/** 有声片段：素材范围、时间线位置与增益包络（片段音量 × 轨道音量 × 淡入淡出）。 */
export function audioParts(t: Timeline): AudioPart[] {
  const parts: AudioPart[] = [];
  for (const c of t.clips) {
    if (!c.assetId) continue;
    const track = t.tracks.find((k) => k.id === c.trackId);
    const asset = t.assets.find((a) => a.id === c.assetId);
    if (!track || track.muted || !asset || asset.kind === "image" || !asset.hasAudio) continue;
    const level = c.volume * track.volume;
    if (level <= 0) continue;
    const marks = new Set([c.start, clipEnd(c)]);
    if (c.fadeIn > 0) marks.add(round(c.start + c.fadeIn));
    if (c.fadeOut > 0) marks.add(round(clipEnd(c) - c.fadeOut));
    const gains = [...marks].sort((a, b) => a - b).map((time) => ({ time, gain: round(level * envelope(c, time)) }));
    parts.push({ clip: c, assetId: asset.id, at: c.start, from: c.in, length: c.duration, gains });
  }
  return parts;
}
