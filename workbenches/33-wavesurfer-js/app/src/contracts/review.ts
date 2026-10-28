import { boundedText, isRecord } from "./project.ts";
export const CHUNK_BYTES = 384 * 1024,
  MAX_AUDIO_BYTES = 32 * 1024 * 1024;
export interface AudioSource {
  id: string;
  name: string;
  bytes: number;
  mime: string;
}
export interface Clip {
  id: string;
  start: string;
  end: string;
  label: string;
  text: string;
  reviewed: boolean;
}
export interface Review {
  source: AudioSource | null;
  duration: number;
  clips: Clip[];
  notes: string;
}
export function audioSource(v: unknown): AudioSource {
  if (
    !isRecord(v) ||
    typeof v.id !== "string" ||
    !/^[a-f0-9]{64}$/.test(v.id) ||
    typeof v.bytes !== "number" ||
    !Number.isInteger(v.bytes) ||
    v.bytes < 12 ||
    v.bytes > MAX_AUDIO_BYTES ||
    ![
      "audio/wav",
      "audio/mpeg",
      "audio/mp4",
      "audio/ogg",
      "audio/webm",
      "audio/flac",
    ].includes(String(v.mime))
  )
    throw Error("音频资源无效，单个原件最大 32 MB。");
  return {
    id: v.id,
    name: boundedText(v.name, 180),
    bytes: v.bytes,
    mime: String(v.mime),
  };
}
export const seed: Review = { source: null, duration: 0, clips: [], notes: "" };
export function restoreReview(raw: unknown): Review {
  if (
    !isRecord(raw) ||
    !Array.isArray(raw.clips) ||
    raw.clips.length > 500 ||
    typeof raw.duration !== "number" ||
    !Number.isFinite(raw.duration) ||
    raw.duration < 0
  )
    throw Error("工程结构无效。");
  const ids = new Set<string>();
  const clips = raw.clips.map((c): Clip => {
    if (!isRecord(c) || typeof c.reviewed !== "boolean")
      throw Error("区间结构无效。");
    const id = boundedText(c.id, 100);
    if (!id || ids.has(id)) throw Error("区间标识重复。");
    ids.add(id);
    return {
      id,
      start: boundedText(c.start, 100),
      end: boundedText(c.end, 100),
      label: boundedText(c.label, 200),
      text: boundedText(c.text, 20000),
      reviewed: c.reviewed,
    };
  });
  if (JSON.stringify(raw).length > 850000) throw Error("工作稿超过 850 KB。");
  return {
    source: raw.source === null ? null : audioSource(raw.source),
    duration: raw.duration,
    clips,
    notes: boundedText(raw.notes, 50000),
  };
}
export function validRange(c: Clip, duration: number) {
  return (
    c.start.trim() !== "" &&
    c.end.trim() !== "" &&
    Number.isFinite(Number(c.start)) &&
    Number.isFinite(Number(c.end)) &&
    Number(c.start) >= 0 &&
    Number(c.end) > Number(c.start) &&
    Number(c.end) <= duration + 0.01
  );
}
export function validateReview(raw: unknown): Review {
  const v = restoreReview(raw);
  if (v.clips.some((c) => !validRange(c, v.duration)))
    throw Error("区间需要有效的起止秒数，且不能超过音频时长。");
  return v;
}
export function importReview(raw: unknown): {
  title: string;
  data: Review;
  extra: Record<string, unknown>;
  audioBase64?: string;
} {
  if (!isRecord(raw)) throw Error("工程格式无效。");
  const v = isRecord(raw.snapshot) ? raw.snapshot : raw;
  if (
    typeof v.title !== "string" ||
    v.title.length > 120 ||
    !isRecord(v.extra ?? {})
  )
    throw Error("工作稿格式无效。");
  return {
    title: v.title,
    data: restoreReview(v.data),
    extra: isRecord(v.extra) ? v.extra : {},
    ...(typeof raw.audioBase64 === "string"
      ? { audioBase64: raw.audioBase64 }
      : {}),
  };
}
export function clipsCSV(v: Review) {
  const q = (raw: string) => {
    const s = /^[\s]*[=+@-]/.test(raw) ? "\'" + raw : raw;
    return '"' + s.replaceAll('"', '""') + '"';
  };
  return (
    "\uFEFF" +
    [
      ["label", "start_seconds", "end_seconds", "excerpt", "reviewed"],
      ...v.clips.map((c) => [
        c.label,
        c.start,
        c.end,
        c.text,
        String(c.reviewed),
      ]),
    ]
      .map((r) => r.map(q).join(","))
      .join("\r\n")
  );
}
