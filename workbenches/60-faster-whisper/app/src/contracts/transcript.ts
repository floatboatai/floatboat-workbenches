// ABOUTME: 字幕稿模型：音频引用、带逐词时间与说话人的字幕行、保存/工作稿校验、时间码与音频容器识别。
import { boundedText, isRecord } from "./project.ts";
import {
  defaultOptions,
  languageValue,
  optionsValue,
  type TranscribeOptions,
} from "./options.ts";
export { languages, languageValue } from "./options.ts";

export const CHUNK_BYTES = 1024 * 1024;
export const MAX_AUDIO_BYTES = 200 * 1024 * 1024;
export const MAX_CUES = 4000;
export const MAX_WORDS_PER_CUE = 1500;
export const MAX_SPEAKERS = 40;
export const MAX_SECONDS = 21600;
/** The shared autosave server refuses project payloads above 900 KB. */
export const MODEL_BYTES = 880000;
export const WORKING_BYTES = 1250000;

export const AUDIO_MIMES = [
  "audio/wav",
  "audio/mpeg",
  "audio/aac",
  "audio/mp4",
  "audio/ogg",
  "audio/webm",
  "audio/flac",
  "audio/aiff",
] as const;

export interface AudioSource {
  id: string;
  name: string;
  bytes: number;
  mime: string;
}
/** One recognised word: seconds, text as produced by Whisper (may carry a leading space), probability or -1 when edited by hand. */
export interface Word {
  s: number;
  e: number;
  w: string;
  p: number;
}
export interface Cue {
  id: string;
  start: string;
  end: string;
  text: string;
  reviewed: boolean;
  speaker: string;
  words: Word[];
}
export interface Speaker {
  id: string;
  name: string;
}
export interface Transcript {
  source: AudioSource | null;
  cues: Cue[];
  language: string;
  notes: string;
  origin: string;
  speakers: Speaker[];
  options: TranscribeOptions;
}
export interface SegmentWord {
  start: number;
  end: number;
  word: string;
  probability: number;
}
export interface Segment {
  start: number;
  end: number;
  text: string;
  words?: SegmentWord[];
  speaker?: string;
}

export function sniffAudio(bytes: Uint8Array): (typeof AUDIO_MIMES)[number] {
  const head = String.fromCharCode(...bytes.subarray(0, 12));
  if (head.startsWith("RIFF") && head.slice(8) === "WAVE") return "audio/wav";
  if (head.startsWith("FORM") && /^AIF[FC]$/.test(head.slice(8)))
    return "audio/aiff";
  if (head.startsWith("fLaC")) return "audio/flac";
  if (head.startsWith("OggS")) return "audio/ogg";
  if (head.slice(4, 8) === "ftyp") return "audio/mp4";
  if (
    bytes[0] === 0x1a &&
    bytes[1] === 0x45 &&
    bytes[2] === 0xdf &&
    bytes[3] === 0xa3
  )
    return "audio/webm";
  if (head.startsWith("ID3")) return "audio/mpeg";
  if (bytes[0] === 0xff && (bytes[1] & 0xf6) === 0xf0) return "audio/aac";
  if (bytes[0] === 0xff && (bytes[1] & 0xe0) === 0xe0) return "audio/mpeg";
  throw new Error(
    "文件不是可识别的音频或视频容器（WAV、MP3、AAC、M4A/MP4/MOV、OGG/Opus、WebM/MKV、FLAC、AIFF）。",
  );
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
    !(AUDIO_MIMES as readonly string[]).includes(String(v.mime))
  )
    throw new Error("音频资源无效：最大 200 MB，需为常见音频或视频容器。");
  return {
    id: v.id,
    name: boundedText(v.name, 180),
    bytes: v.bytes,
    mime: String(v.mime),
  };
}

export function clock(seconds: number, separator = "."): string {
  const ms = Math.round(Math.max(0, seconds) * 1000),
    h = Math.floor(ms / 3600000),
    m = Math.floor(ms / 60000) % 60,
    s = Math.floor(ms / 1000) % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}${separator}${String(ms % 1000).padStart(3, "0")}`;
}
export function seconds(value: string): number {
  const match = /^(\d{1,2}):([0-5]\d):([0-5]\d)[.,](\d{3})$/.exec(value.trim());
  if (!match) throw new Error("时间格式应为 00:00:00.000。");
  const result =
    Number(match[1]) * 3600 +
    Number(match[2]) * 60 +
    Number(match[3]) +
    Number(match[4]) / 1000;
  if (result > MAX_SECONDS) throw new Error("时间不能超过 6 小时。");
  return result;
}
/** Seconds or NaN for an unfinished time field. */
export function trySeconds(value: string): number {
  try {
    return seconds(value);
  } catch {
    return Number.NaN;
  }
}
export const round3 = (n: number) => Math.round(n * 1000) / 1000;

const finite = (n: unknown): n is number =>
  typeof n === "number" && Number.isFinite(n);

function wordValue(raw: unknown): Word {
  if (
    !isRecord(raw) ||
    !finite(raw.s) ||
    !finite(raw.e) ||
    !finite(raw.p) ||
    raw.s < 0 ||
    raw.e < raw.s ||
    raw.e > MAX_SECONDS ||
    raw.p < -1 ||
    raw.p > 1
  )
    throw new Error("逐词时间戳无效。");
  return { s: raw.s, e: raw.e, w: boundedText(raw.w, 200), p: raw.p };
}

function decode(v: unknown, strict: boolean): Transcript {
  if (!isRecord(v) || !Array.isArray(v.cues) || v.cues.length > MAX_CUES)
    throw new Error(`最多支持 ${MAX_CUES} 行字幕。`);
  const rawSpeakers = v.speakers === undefined ? [] : v.speakers;
  if (!Array.isArray(rawSpeakers) || rawSpeakers.length > MAX_SPEAKERS)
    throw new Error(`最多 ${MAX_SPEAKERS} 位说话人。`);
  const speakerIds = new Set<string>();
  const speakers = rawSpeakers.map((s): Speaker => {
    if (
      !isRecord(s) ||
      typeof s.id !== "string" ||
      !/^[A-Za-z0-9_-]{1,40}$/.test(s.id) ||
      speakerIds.has(s.id)
    )
      throw new Error("说话人编号无效或重复。");
    speakerIds.add(s.id);
    const name = boundedText(s.name, 40);
    if (strict && !name.trim()) throw new Error("说话人需要名称。");
    return { id: s.id, name };
  });
  const ids = new Set<string>();
  const cues = v.cues.map((raw): Cue => {
    if (
      !isRecord(raw) ||
      typeof raw.id !== "string" ||
      !/^[A-Za-z0-9_-]{1,80}$/.test(raw.id) ||
      ids.has(raw.id) ||
      typeof raw.reviewed !== "boolean"
    )
      throw new Error("字幕行格式无效或编号重复。");
    ids.add(raw.id);
    const speaker = raw.speaker === undefined ? "" : boundedText(raw.speaker, 40);
    if (speaker && !speakerIds.has(speaker))
      throw new Error("字幕行引用了不存在的说话人。");
    const words = raw.words === undefined ? [] : raw.words;
    if (!Array.isArray(words) || words.length > MAX_WORDS_PER_CUE)
      throw new Error(`每行最多 ${MAX_WORDS_PER_CUE} 个逐词时间戳。`);
    const cue: Cue = {
      id: raw.id,
      start: boundedText(raw.start, 24),
      end: boundedText(raw.end, 24),
      text: boundedText(raw.text, strict ? 4000 : 8000),
      reviewed: raw.reviewed,
      speaker,
      words: words.map(wordValue),
    };
    if (strict && seconds(cue.end) <= seconds(cue.start))
      throw new Error("字幕出点必须晚于入点。");
    return cue;
  });
  const data: Transcript = {
    source: v.source === null || v.source === undefined ? null : audioSource(v.source),
    cues,
    language: languageValue(v.language),
    notes: boundedText(v.notes, 20000),
    origin: boundedText(v.origin, 240),
    speakers,
    options: optionsValue(v.options),
  };
  if (
    new TextEncoder().encode(JSON.stringify(data)).length >
    (strict ? MODEL_BYTES : WORKING_BYTES)
  )
    throw new Error(
      strict
        ? "字幕稿超过 880 KB，工作稿仍会保留；请拆分音频或去掉部分逐词时间戳。"
        : "工作稿超过 1.25 MB，请先导出并拆分内容。",
    );
  return data;
}
export const validateTranscript = (v: unknown) => decode(v, true);
export const restoreTranscript = (v: unknown) => decode(v, false);

export interface TranscriptDraft {
  selected: string;
  onlyPending: boolean;
  onlyLow: boolean;
  importText: string;
  find: string;
  replace: string;
  matchCase: boolean;
  regex: boolean;
  exportSpeakers: boolean;
  exportTimes: boolean;
}
export function transcriptDraft(v: unknown): TranscriptDraft {
  const r = isRecord(v) ? v : {};
  const str = (x: unknown, max: number) =>
    typeof x === "string" ? x.slice(0, max) : "";
  return {
    selected: str(r.selected, 80),
    onlyPending: r.onlyPending === true,
    onlyLow: r.onlyLow === true,
    importText: str(r.importText, 100000),
    find: str(r.find, 400),
    replace: str(r.replace, 400),
    matchCase: r.matchCase === true,
    regex: r.regex === true,
    exportSpeakers: r.exportSpeakers !== false,
    exportTimes: r.exportTimes === true,
  };
}
export const emptyTranscript: Transcript = {
  source: null,
  cues: [],
  language: "auto",
  notes: "",
  origin: "",
  speakers: [],
  options: { ...defaultOptions },
};
