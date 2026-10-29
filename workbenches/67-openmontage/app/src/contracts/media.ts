// ABOUTME: 素材库条目（视频、图片、音频）的类型、格式识别与校验，前后端共用。
import { isRecord, boundedText } from "./project.ts";

export const CHUNK_BYTES = 1024 * 1024;
export const MAX_ASSET_BYTES = 2 * 1024 * 1024 * 1024;
export const MAX_CHUNKS = Math.ceil(MAX_ASSET_BYTES / CHUNK_BYTES);

export type AssetKind = "video" | "image" | "audio";
export type Asset = {
  id: string;
  name: string;
  kind: AssetKind;
  mime: string;
  bytes: number;
  /** 秒；图片为 null。 */
  duration: number | null;
  width: number | null;
  height: number | null;
  hasAudio: boolean;
  /** 随工作台附带的示例素材，不进入工程包。 */
  sample: boolean;
};

export const MIME_BY_FAMILY = {
  mp4: ["video/mp4", "video/quicktime", "audio/mp4", "audio/x-m4a", "audio/aac"],
  matroska: ["video/webm", "video/x-matroska", "audio/webm"],
  wav: ["audio/wav", "audio/x-wav", "audio/wave"],
  mp3: ["audio/mpeg", "audio/mp3"],
  ogg: ["audio/ogg", "video/ogg", "audio/opus"],
  flac: ["audio/flac", "audio/x-flac"],
  adts: ["audio/aac", "audio/x-aac"],
  png: ["image/png"],
  jpeg: ["image/jpeg"],
  webp: ["image/webp"],
  gif: ["image/gif"],
} as const;
export type Family = keyof typeof MIME_BY_FAMILY;
const DEFAULT_MIME: Record<Family, string> = {
  mp4: "video/mp4",
  matroska: "video/webm",
  wav: "audio/wav",
  mp3: "audio/mpeg",
  ogg: "audio/ogg",
  flac: "audio/flac",
  adts: "audio/aac",
  png: "image/png",
  jpeg: "image/jpeg",
  webp: "image/webp",
  gif: "image/gif",
};
const ascii = (b: Uint8Array, from: number, to: number) =>
  String.fromCharCode(...b.subarray(from, to));

/** 按文件头识别容器族，不信任扩展名。 */
export function sniff(b: Uint8Array): Family | null {
  if (b.length < 12) return null;
  if (ascii(b, 4, 8) === "ftyp") return "mp4";
  if (b[0] === 0x1a && b[1] === 0x45 && b[2] === 0xdf && b[3] === 0xa3)
    return "matroska";
  if (ascii(b, 0, 4) === "RIFF" && ascii(b, 8, 12) === "WAVE") return "wav";
  if (ascii(b, 0, 4) === "RIFF" && ascii(b, 8, 12) === "WEBP") return "webp";
  if (ascii(b, 0, 3) === "ID3") return "mp3";
  if (ascii(b, 0, 4) === "OggS") return "ogg";
  if (ascii(b, 0, 4) === "fLaC") return "flac";
  if (b[0] === 0x89 && ascii(b, 1, 4) === "PNG") return "png";
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "jpeg";
  if (ascii(b, 0, 4) === "GIF8") return "gif";
  if (b[0] === 0xff && (b[1] & 0xf6) === 0xf0) return "adts";
  if (b[0] === 0xff && (b[1] & 0xe0) === 0xe0) return "mp3";
  return null;
}
export const UNSUPPORTED =
  "无法识别的媒体格式。支持 MP4/MOV/WebM/MKV 视频、PNG/JPEG/WebP/GIF 图片、MP3/M4A/AAC/WAV/OGG/FLAC 音频。";

/** 把浏览器给出的 MIME 与文件头核对，返回可存储的 MIME。 */
export function resolveMime(family: Family, declared: string): string {
  const allowed: readonly string[] = MIME_BY_FAMILY[family];
  return allowed.includes(declared) ? declared : DEFAULT_MIME[family];
}
export function kindOf(mime: string): AssetKind {
  if (mime.startsWith("image/")) return "image";
  if (mime.startsWith("audio/")) return "audio";
  return "video";
}
/** 浏览器常给空 MIME（如 .mkv/.m4a），按扩展名补上，最终仍以文件头为准。 */
export function guessMime(name: string, declared: string) {
  if (declared) return declared;
  const ext = name.toLowerCase().split(".").pop() ?? "";
  return (
    {
      mp4: "video/mp4",
      m4v: "video/mp4",
      mov: "video/quicktime",
      webm: "video/webm",
      mkv: "video/x-matroska",
      m4a: "audio/mp4",
      aac: "audio/aac",
      mp3: "audio/mpeg",
      wav: "audio/wav",
      ogg: "audio/ogg",
      oga: "audio/ogg",
      opus: "audio/ogg",
      flac: "audio/flac",
      png: "image/png",
      jpg: "image/jpeg",
      jpeg: "image/jpeg",
      webp: "image/webp",
      gif: "image/gif",
    }[ext] ?? ""
  );
}

const finite = (v: unknown, min: number, max: number, label: string) => {
  if (typeof v !== "number" || !Number.isFinite(v) || v < min || v > max)
    throw new Error(label + "无效。");
  return v;
};
export const contentId = (v: unknown) => {
  if (typeof v !== "string" || !/^[a-f0-9]{64}$/.test(v))
    throw new Error("素材标识无效。");
  return v;
};
export function assetValue(v: unknown): Asset {
  if (!isRecord(v)) throw new Error("素材格式无效。");
  const kind = v.kind;
  if (kind !== "video" && kind !== "image" && kind !== "audio")
    throw new Error("素材类型无效。");
  const mime = boundedText(v.mime, 80);
  if (
    !Object.values(MIME_BY_FAMILY).some((list) =>
      (list as readonly string[]).includes(mime),
    )
  )
    throw new Error("素材格式不受支持：" + mime);
  const timed = kind !== "image";
  const duration =
    v.duration === null && !timed
      ? null
      : finite(v.duration, 0.01, 6 * 3600, "素材时长");
  const size = (x: unknown) =>
    x === null ? null : Math.round(finite(x, 1, 16384, "素材尺寸"));
  return {
    id: contentId(v.id),
    name: boundedText(v.name, 240),
    kind,
    mime,
    bytes: Math.round(finite(v.bytes, 1, MAX_ASSET_BYTES, "素材大小")),
    duration,
    width: size(v.width ?? null),
    height: size(v.height ?? null),
    hasAudio: v.hasAudio === true,
    sample: v.sample === true,
  };
}
export const formatBytes = (n: number) =>
  n >= 1024 ** 3
    ? (n / 1024 ** 3).toFixed(2) + " GB"
    : n >= 1024 ** 2
      ? (n / 1024 ** 2).toFixed(1) + " MB"
      : Math.max(1, Math.round(n / 1024)) + " KB";
