// ABOUTME: 多轨时间线工程（素材库、轨道、片段、成片记录）的类型与校验；兼容读取 0.5 版分镜制作单。
import { isRecord, boundedText } from "./project.ts";
import { assetValue, contentId, type Asset } from "./media.ts";

export type TrackKind = "video" | "audio" | "text";
export type Track = {
  id: string;
  kind: TrackKind;
  name: string;
  muted: boolean;
  /** 0–1，作用于该轨所有片段的声音。 */
  volume: number;
};
export type TextPreset = "title" | "lower" | "subtitle" | "caption";
export type TextStyle = {
  preset: TextPreset;
  /** 以 720 像素画面高度为基准的字号。 */
  size: number;
  color: string;
  box: boolean;
  align: "left" | "center" | "right";
  /** 文字块垂直中心，0 顶部 – 1 底部。 */
  y: number;
  bold: boolean;
};
export type Motion = "none" | "zoom-in" | "zoom-out" | "pan-left" | "pan-right";
export type Clip = {
  id: string;
  trackId: string;
  /** 媒体片段引用素材；文字片段为 null。 */
  assetId: string | null;
  text: string;
  style: TextStyle | null;
  /** 在时间线上的起点（秒）。 */
  start: number;
  /** 素材内的入点（秒）。 */
  in: number;
  duration: number;
  volume: number;
  fadeIn: number;
  fadeOut: number;
  fit: "cover" | "contain";
  motion: Motion;
  note: string;
};
export type OutputRecord = {
  id: string;
  name: string;
  mime: string;
  bytes: number;
  duration: number;
  width: number;
  height: number;
  createdAt: string;
  engine: "browser" | "openmontage";
};
export type Settings = {
  width: number;
  height: number;
  fps: number;
  background: string;
};
export type Timeline = {
  version: 2;
  brief: string;
  settings: Settings;
  assets: Asset[];
  tracks: Track[];
  clips: Clip[];
  outputs: OutputRecord[];
};

export const FPS_CHOICES = [24, 25, 30, 60] as const;
export const MIN_CLIP = 0.1;
export const MAX_TIMELINE = 4 * 3600;
export const round = (n: number) => Math.round(n * 1000) / 1000;
export const clipEnd = (c: Clip) => round(c.start + c.duration);
export const accepts = (track: TrackKind, asset: Asset | null) =>
  asset === null
    ? track === "text"
    : asset.kind === "audio"
      ? track === "audio"
      : track === "video";

export const PRESETS: Record<TextPreset, TextStyle> = {
  title: { preset: "title", size: 64, color: "#ffffff", box: false, align: "center", y: 0.46, bold: true },
  lower: { preset: "lower", size: 30, color: "#ffffff", box: true, align: "left", y: 0.8, bold: true },
  subtitle: { preset: "subtitle", size: 32, color: "#ffffff", box: true, align: "center", y: 0.89, bold: false },
  caption: { preset: "caption", size: 24, color: "#f4e9c8", box: false, align: "right", y: 0.08, bold: false },
};

const id = (v: unknown, label: string) => {
  const s = boundedText(v, 80);
  if (!/^[A-Za-z0-9_-]+$/.test(s)) throw new Error(label + "编号无效。");
  return s;
};
const num = (v: unknown, min: number, max: number, label: string) => {
  if (typeof v !== "number" || !Number.isFinite(v) || v < min - 1e-9 || v > max + 1e-9)
    throw new Error(`${label}需在 ${min}–${max} 之间。`);
  return round(Math.min(max, Math.max(min, v)));
};
const color = (v: unknown) => {
  if (typeof v !== "string" || !/^#[0-9a-f]{6}$/i.test(v))
    throw new Error("颜色需为 #RRGGBB。");
  return v.toLowerCase();
};
function styleValue(v: unknown): TextStyle {
  if (!isRecord(v)) throw new Error("文字样式无效。");
  const preset = v.preset;
  if (preset !== "title" && preset !== "lower" && preset !== "subtitle" && preset !== "caption")
    throw new Error("文字样式无效。");
  const align = v.align;
  if (align !== "left" && align !== "center" && align !== "right")
    throw new Error("文字对齐无效。");
  return {
    preset,
    size: num(v.size, 10, 200, "字号"),
    color: color(v.color),
    box: v.box === true,
    align,
    y: num(v.y, 0, 1, "文字位置"),
    bold: v.bold === true,
  };
}
function settingsValue(v: unknown): Settings {
  if (!isRecord(v)) throw new Error("画面设置无效。");
  const width = num(v.width, 16, 3840, "画面宽度"),
    height = num(v.height, 16, 3840, "画面高度");
  if (width % 2 || height % 2) throw new Error("画面宽高需为偶数。");
  if (!FPS_CHOICES.includes(v.fps as (typeof FPS_CHOICES)[number]))
    throw new Error("帧率需为 24、25、30 或 60。");
  return { width, height, fps: v.fps as number, background: color(v.background) };
}
function outputValue(v: unknown): OutputRecord {
  if (!isRecord(v) || (v.engine !== "browser" && v.engine !== "openmontage"))
    throw new Error("成片记录无效。");
  if (typeof v.createdAt !== "string" || !Number.isFinite(Date.parse(v.createdAt)))
    throw new Error("成片时间无效。");
  return {
    id: contentId(v.id),
    name: boundedText(v.name, 240),
    mime: boundedText(v.mime, 80),
    bytes: num(v.bytes, 1, 8 * 1024 ** 3, "成片大小"),
    duration: num(v.duration, 0, MAX_TIMELINE, "成片时长"),
    width: num(v.width, 1, 8192, "成片宽度"),
    height: num(v.height, 1, 8192, "成片高度"),
    createdAt: v.createdAt,
    engine: v.engine,
  };
}

export function defaultTracks(): Track[] {
  return [
    { id: "t-title", kind: "text", name: "标题", muted: false, volume: 1 },
    { id: "t-sub", kind: "text", name: "字幕", muted: false, volume: 1 },
    { id: "v-over", kind: "video", name: "叠加画面", muted: false, volume: 1 },
    { id: "v-main", kind: "video", name: "主画面", muted: false, volume: 1 },
    { id: "a-music", kind: "audio", name: "配乐", muted: false, volume: 0.8 },
    { id: "a-amb", kind: "audio", name: "环境声", muted: false, volume: 1 },
  ];
}
export const DEFAULT_SETTINGS: Settings = { width: 1280, height: 720, fps: 30, background: "#000000" };
export function emptyTimeline(): Timeline {
  return { version: 2, brief: "", settings: { ...DEFAULT_SETTINGS }, assets: [], tracks: defaultTracks(), clips: [], outputs: [] };
}

/** 0.5 版“分镜制作单”：按镜头顺序排在主画面轨，入出点转为片段入点与时长。 */
function fromLegacy(raw: Record<string, unknown>): Timeline {
  const shots = Array.isArray(raw.shots) ? raw.shots : [];
  if (shots.length > 60) throw new Error("分镜格式无效。");
  const t = emptyTimeline(),
    assets = new Map<string, Asset>();
  t.brief = boundedText(raw.brief ?? "", 10000);
  let cursor = 0;
  for (const s of shots) {
    if (!isRecord(s)) throw new Error("镜头格式无效。");
    const start = Number(s.start), end = Number(s.end);
    const inPoint = Number.isFinite(start) && start >= 0 ? start : 0;
    const duration = Number.isFinite(end) && end > inPoint ? end - inPoint : 2;
    let assetId: string | null = null;
    if (isRecord(s.source)) {
      const src = s.source;
      assetId = contentId(src.id);
      const old = assets.get(assetId);
      assets.set(assetId, {
        id: assetId,
        name: boundedText(src.name ?? "原片.mp4", 240),
        kind: "video",
        mime: "video/mp4",
        bytes: num(src.bytes, 1, 2 * 1024 ** 3, "素材大小"),
        duration: round(Math.max(old?.duration ?? 0, inPoint + duration)),
        width: null,
        height: null,
        hasAudio: true,
        sample: false,
      });
    }
    // 尚未上传原片的镜头保留为同位置的说明字卡，不丢失镜头名称与脚本。
    t.clips.push({
      id: id(s.id, "镜头"),
      trackId: assetId ? "v-main" : "t-title",
      assetId,
      text: assetId ? "" : boundedText(s.title ?? "", 150),
      style: assetId ? null : { ...PRESETS.caption },
      start: round(cursor),
      in: round(inPoint),
      duration: round(duration),
      volume: 1,
      fadeIn: 0,
      fadeOut: 0,
      fit: "contain",
      motion: "none",
      note: [boundedText(s.title ?? "", 150), boundedText(s.script ?? "", 4000)].filter(Boolean).join(" · ").slice(0, 2000),
    });
    cursor += duration;
  }
  t.assets = [...assets.values()];
  return t;
}

export function timelineValue(raw: unknown): Timeline {
  if (!isRecord(raw)) throw new Error("工程格式无效。");
  if (raw.version === undefined && Array.isArray(raw.shots)) return timelineValue(fromLegacy(raw));
  if (raw.version !== 2) throw new Error("工程版本无效。");
  if (!Array.isArray(raw.assets) || raw.assets.length > 1000) throw new Error("素材库格式无效。");
  if (!Array.isArray(raw.tracks) || raw.tracks.length < 1 || raw.tracks.length > 24) throw new Error("轨道数需在 1–24 之间。");
  if (!Array.isArray(raw.clips) || raw.clips.length > 5000) throw new Error("片段数不能超过 5000。");
  const outputsRaw = raw.outputs ?? [];
  if (!Array.isArray(outputsRaw) || outputsRaw.length > 40) throw new Error("成片记录过多。");
  const assets = raw.assets.map(assetValue);
  const assetMap = new Map(assets.map((a) => [a.id, a]));
  if (assetMap.size !== assets.length) throw new Error("素材重复。");
  const tracks = raw.tracks.map((v): Track => {
    if (!isRecord(v)) throw new Error("轨道格式无效。");
    const kind = v.kind;
    if (kind !== "video" && kind !== "audio" && kind !== "text") throw new Error("轨道类型无效。");
    return {
      id: id(v.id, "轨道"),
      kind,
      name: boundedText(v.name, 40),
      muted: v.muted === true,
      volume: num(v.volume ?? 1, 0, 1, "轨道音量"),
    };
  });
  const trackMap = new Map(tracks.map((t) => [t.id, t]));
  if (trackMap.size !== tracks.length) throw new Error("轨道编号重复。");
  const clips = raw.clips.map((v): Clip => {
    if (!isRecord(v)) throw new Error("片段格式无效。");
    const track = trackMap.get(String(v.trackId));
    if (!track) throw new Error("片段所在轨道不存在。");
    const asset = v.assetId === null ? null : assetMap.get(contentId(v.assetId));
    if (asset === undefined) throw new Error("片段引用的素材不在素材库中。");
    if (!accepts(track.kind, asset)) throw new Error(`「${track.name}」轨不能放这种片段。`);
    const duration = num(v.duration, MIN_CLIP, MAX_TIMELINE, "片段时长");
    const inPoint = asset?.duration != null ? num(v.in ?? 0, 0, asset.duration, "入点") : 0;
    if (asset?.duration != null && inPoint + duration > asset.duration + 0.05)
      throw new Error(`片段超出素材「${asset.name}」的长度。`);
    const motion = v.motion ?? "none";
    if (!["none", "zoom-in", "zoom-out", "pan-left", "pan-right"].includes(String(motion)))
      throw new Error("画面运动无效。");
    const fit = v.fit ?? "cover";
    if (fit !== "cover" && fit !== "contain") throw new Error("画面适配无效。");
    return {
      id: id(v.id, "片段"),
      trackId: track.id,
      assetId: asset?.id ?? null,
      text: boundedText(v.text ?? "", 2000),
      style: asset ? null : styleValue(v.style),
      start: num(v.start, 0, MAX_TIMELINE, "起点"),
      in: inPoint,
      duration,
      volume: num(v.volume ?? 1, 0, 1, "片段音量"),
      fadeIn: num(v.fadeIn ?? 0, 0, duration, "淡入"),
      fadeOut: num(v.fadeOut ?? 0, 0, duration, "淡出"),
      fit,
      motion: motion as Motion,
      note: boundedText(v.note ?? "", 2000),
    };
  });
  if (new Set(clips.map((c) => c.id)).size !== clips.length) throw new Error("片段编号重复。");
  return {
    version: 2,
    brief: boundedText(raw.brief ?? "", 10000),
    settings: settingsValue(raw.settings),
    assets,
    tracks,
    clips,
    outputs: outputsRaw.map(outputValue),
  };
}

export const duration = (t: Timeline) =>
  t.clips.reduce((n, c) => Math.max(n, clipEnd(c)), 0);
export const assetOf = (t: Timeline, c: Clip) =>
  c.assetId ? t.assets.find((a) => a.id === c.assetId) ?? null : null;
/** 0→1 的不透明度/音量包络，覆盖淡入淡出与交叉溶解。 */
export function envelope(c: Clip, time: number) {
  const a = c.fadeIn > 0 ? (time - c.start) / c.fadeIn : 1,
    b = c.fadeOut > 0 ? (clipEnd(c) - time) / c.fadeOut : 1;
  return Math.max(0, Math.min(1, a, b));
}
export const active = (c: Clip, time: number) =>
  time >= c.start - 1e-6 && time < clipEnd(c) - 1e-6;
/** 画面层从下到上：轨道列表中靠下的视频轨在底层，文字轨永远在画面之上。 */
export function visualOrder(t: Timeline): Track[] {
  const video = t.tracks.filter((k) => k.kind === "video").reverse();
  const text = t.tracks.filter((k) => k.kind === "text").reverse();
  return [...video, ...text];
}
export function timecode(seconds: number, fps = 30) {
  const s = Math.max(0, seconds), whole = Math.floor(s + 1e-6);
  const f = Math.floor((s - whole) * fps + 1e-6);
  const h = Math.floor(whole / 3600), m = Math.floor((whole % 3600) / 60), sec = whole % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${h ? pad(h) + ":" : ""}${pad(m)}:${pad(sec)}:${pad(f)}`;
}
