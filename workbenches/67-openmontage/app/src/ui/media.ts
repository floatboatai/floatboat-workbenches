// ABOUTME: 浏览器侧素材处理：读取时长与尺寸、确认本机可解码、分块上传到工作台素材库。
import { ALL_FORMATS, BlobSource, Input } from "mediabunny";
import {
  CHUNK_BYTES,
  MAX_ASSET_BYTES,
  assetValue,
  guessMime,
  kindOf,
  type Asset,
} from "../contracts/media";
import { isRecord } from "../contracts/project";
import { request } from "./requests";

export function base64(bytes: Uint8Array) {
  let text = "";
  for (let i = 0; i < bytes.length; i += 8192) text += String.fromCharCode(...bytes.subarray(i, i + 8192));
  return btoa(text);
}

/** 上传任意 Blob，返回服务器按内容计算的 SHA-256 标识与核对后的 MIME。 */
export async function uploadBlob(blob: Blob, mime: string, onProgress: (ratio: number) => void, signal?: AbortSignal) {
  if (blob.size > MAX_ASSET_BYTES) throw new Error("单个素材不能超过 2 GB。");
  if (blob.size < 12) throw new Error("文件太小，不是有效的媒体文件。");
  const id = [...crypto.getRandomValues(new Uint8Array(16))].map((b) => b.toString(16).padStart(2, "0")).join("");
  const count = Math.ceil(blob.size / CHUNK_BYTES);
  for (let i = 0; i < count; i++) {
    if (signal?.aborted) throw new Error("已取消上传。");
    const part = new Uint8Array(await blob.slice(i * CHUNK_BYTES, (i + 1) * CHUNK_BYTES).arrayBuffer());
    await request(`/api/uploads/${id}/chunks/${i}`, { method: "PUT", body: JSON.stringify({ base64: base64(part) }) });
    onProgress((i + 1) / count);
  }
  const v = await request(`/api/uploads/${id}/finish`, { method: "POST", body: JSON.stringify({ bytes: blob.size, mime }) });
  if (!isRecord(v) || typeof v.id !== "string" || typeof v.mime !== "string") throw new Error("上传回执无效。");
  return { id: v.id, mime: v.mime };
}

export type Probe = Pick<Asset, "kind" | "duration" | "width" | "height" | "hasAudio">;

/** 用 Mediabunny 读容器元数据并确认本机能解码；图片用 createImageBitmap 读尺寸。 */
export async function probe(file: Blob, mime: string): Promise<Probe> {
  const kind = kindOf(mime);
  if (kind === "image") {
    const bitmap = await createImageBitmap(file).catch(() => null);
    if (!bitmap) throw new Error("图片无法解码。");
    const out = { kind, duration: null, width: bitmap.width, height: bitmap.height, hasAudio: false } as const;
    bitmap.close();
    return out;
  }
  const input = new Input({ source: new BlobSource(file), formats: ALL_FORMATS });
  try {
    const [video, audio] = await Promise.all([
      input.getPrimaryVideoTrack().catch(() => null),
      input.getPrimaryAudioTrack().catch(() => null),
    ]);
    if (!video && !audio) throw new Error("文件中没有可用的画面或声音。");
    if (video && !(await video.canDecode())) throw new Error(`本机浏览器无法解码这个视频（${video.codec ?? "未知编码"}），请转成 H.264 或 VP9 后导入。`);
    const audible = audio ? await audio.canDecode() : false;
    if (!video && !audible) throw new Error(`本机浏览器无法解码这段声音（${audio?.codec ?? "未知编码"}）。`);
    const seconds = await input.computeDuration();
    if (!Number.isFinite(seconds) || seconds <= 0) throw new Error("无法读取媒体时长。");
    return {
      kind: video ? "video" : "audio",
      duration: Math.round(seconds * 1000) / 1000,
      width: video ? video.displayWidth : null,
      height: video ? video.displayHeight : null,
      hasAudio: audible,
    };
  } finally {
    input.dispose();
  }
}

/** 导入一个本地文件：识别、校验可解码、上传，返回素材库条目。 */
export async function importFile(file: File, onProgress: (ratio: number) => void, signal?: AbortSignal): Promise<Asset> {
  const declared = guessMime(file.name, file.type);
  if (!declared || !/^(video|audio|image)\//.test(declared)) throw new Error(`「${file.name}」不是视频、图片或音频文件。`);
  const info = await probe(file, declared);
  const stored = await uploadBlob(file, declared, onProgress, signal);
  return assetValue({ ...info, id: stored.id, name: file.name, mime: info.kind === "audio" ? audioMime(stored.mime) : stored.mime, bytes: file.size, sample: false });
}
/** 只有声音的视频容器（如 .m4a 被识别为 video/mp4）按音频登记。 */
export function audioMime(m: string) {
  if (m.startsWith("audio/")) return m;
  if (m === "video/webm" || m === "video/x-matroska") return "audio/webm";
  if (m === "video/ogg") return "audio/ogg";
  return "audio/mp4";
}

export const mediaBlob = async (id: string) => {
  const r = await fetch("/api/media/" + id);
  if (!r.ok) throw new Error("素材文件缺失，请重新导入。");
  return r.blob();
};
