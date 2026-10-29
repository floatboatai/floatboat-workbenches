// ABOUTME: SRT / WebVTT 字幕的解析与导出，导入后成为文字轨上的字幕片段。
import { clipEnd, round, type Clip, type Timeline } from "./timeline.ts";

export type Cue = { start: number; end: number; text: string };
const stamp = /(?:(\d+):)?(\d{1,2}):(\d{2})[.,](\d{1,3})/;
function seconds(v: string) {
  const m = stamp.exec(v.trim());
  if (!m) return NaN;
  return (Number(m[1] ?? 0) * 3600) + Number(m[2]) * 60 + Number(m[3]) + Number(m[4].padEnd(3, "0")) / 1000;
}

/** 同时接受 SRT 与 WebVTT；忽略序号、样式块与 VTT 提示设置。 */
export function parseSubtitles(source: string): Cue[] {
  if (source.length > 4 * 1024 * 1024) throw new Error("字幕文件超过 4 MB。");
  const text = source.replace(/^﻿/, "").replace(/\r\n?/g, "\n");
  const cues: Cue[] = [];
  for (const block of text.split(/\n{2,}/)) {
    const lines = block.split("\n").filter((l) => l.trim() !== "");
    const at = lines.findIndex((l) => l.includes("-->"));
    if (at < 0) continue;
    const [a, b] = lines[at].split("-->");
    const start = seconds(a), end = seconds(b.trim().split(/\s+/)[0] ?? "");
    const body = lines.slice(at + 1).join("\n").replace(/<[^>]+>/g, "").trim();
    if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start || !body) continue;
    cues.push({ start: round(start), end: round(end), text: body.slice(0, 2000) });
  }
  if (!cues.length) throw new Error("没有读到字幕条目。请确认是 SRT 或 WebVTT 文件。");
  if (cues.length > 3000) throw new Error("字幕条目超过 3000 条。");
  return cues.sort((x, y) => x.start - y.start);
}

const pad = (n: number, w = 2) => String(n).padStart(w, "0");
export function srtTime(t: number) {
  const ms = Math.round(t * 1000);
  return `${pad(Math.floor(ms / 3600000))}:${pad(Math.floor(ms / 60000) % 60)}:${pad(Math.floor(ms / 1000) % 60)},${pad(ms % 1000, 3)}`;
}
export function toSrt(clips: Clip[]) {
  return clips
    .filter((c) => c.assetId === null && c.text.trim())
    .sort((a, b) => a.start - b.start)
    .map((c, i) => `${i + 1}\n${srtTime(c.start)} --> ${srtTime(clipEnd(c))}\n${c.text.trim()}\n`)
    .join("\n");
}
/** 导出某条文字轨（默认取名含“字幕”的轨）为 SRT。 */
export function timelineSrt(t: Timeline, trackId?: string) {
  const track = t.tracks.find((k) => k.id === trackId) ?? t.tracks.find((k) => k.kind === "text" && k.name.includes("字幕")) ?? t.tracks.find((k) => k.kind === "text");
  return toSrt(t.clips.filter((c) => c.trackId === track?.id));
}
