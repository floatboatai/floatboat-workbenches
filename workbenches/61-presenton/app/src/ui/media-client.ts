// ABOUTME: 浏览器端图片处理：解码、按需缩放/转码到上限内、上传到本应用媒体库，并缓存为 data URL 供舞台与导出使用。
import { useEffect, useState } from "react";
import {
  MEDIA_INPUT_MAX_BYTES,
  MEDIA_MAX_BYTES,
  MEDIA_MAX_EDGE,
  sniffImage,
  type MediaInfo,
  type MediaRecord,
} from "../contracts/media";
import { request } from "./requests";

const records = new Map<string, Promise<MediaRecord>>();
const ready = new Map<string, MediaRecord>();

function isRecordValue(value: unknown): value is MediaRecord {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as MediaRecord).id === "string" &&
    typeof (value as MediaRecord).base64 === "string" &&
    typeof (value as MediaRecord).mime === "string" &&
    typeof (value as MediaRecord).width === "number" &&
    typeof (value as MediaRecord).height === "number"
  );
}
export function loadMedia(id: string): Promise<MediaRecord> {
  let pending = records.get(id);
  if (!pending) {
    pending = request("/api/media/" + id).then((value) => {
      if (!isRecordValue(value)) throw new Error("图片数据无效。");
      ready.set(id, value);
      return value;
    });
    pending.catch(() => records.delete(id));
    records.set(id, pending);
  }
  return pending;
}
export const mediaUrl = (record: Pick<MediaRecord, "mime" | "base64">) => `data:${record.mime};base64,${record.base64}`;

export function useMedia(id: string): { url: string | null; record: MediaRecord | null; error: boolean } {
  const [state, setState] = useState(() => {
    const known = id ? ready.get(id) : undefined;
    return { id, record: known ?? null, error: false };
  });
  useEffect(() => {
    if (!id) return;
    const known = ready.get(id);
    if (known) {
      setState({ id, record: known, error: false });
      return;
    }
    let live = true;
    loadMedia(id).then(
      (record) => live && setState({ id, record, error: false }),
      () => live && setState({ id, record: null, error: true }),
    );
    return () => {
      live = false;
    };
  }, [id]);
  const record = state.id === id ? state.record : (ready.get(id) ?? null);
  return { url: record ? mediaUrl(record) : null, record, error: state.id === id && state.error };
}

function toBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(binary);
}
export function fromBase64(value: string): Uint8Array {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}
function readAsDataUrl(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("无法读取图片文件。"));
    reader.readAsDataURL(file);
  });
}
function decode(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("浏览器无法解码这张图片，请换成 PNG、JPEG、GIF、WebP 或 SVG。"));
    image.src = src;
  });
}
function hasAlpha(context: CanvasRenderingContext2D, w: number, h: number): boolean {
  const step = Math.max(1, Math.floor(Math.sqrt((w * h) / 40000)));
  const data = context.getImageData(0, 0, w, h).data;
  for (let y = 0; y < h; y += step) for (let x = 0; x < w; x += step) if (data[(y * w + x) * 4 + 3] < 250) return true;
  return false;
}
async function encode(canvas: HTMLCanvasElement, type: string, quality?: number): Promise<Uint8Array> {
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, quality));
  if (!blob) throw new Error("图片转码失败。");
  return new Uint8Array(await blob.arrayBuffer());
}

/** Turns any browser-decodable image into PNG/JPEG/GIF bytes within MEDIA_MAX_BYTES and MEDIA_MAX_EDGE. */
export async function prepareImage(file: File): Promise<{ bytes: Uint8Array; note: string }> {
  if (file.size > MEDIA_INPUT_MAX_BYTES) throw new Error(`图片文件超过 ${MEDIA_INPUT_MAX_BYTES / 1024 / 1024} MB，请先压缩。`);
  const original = new Uint8Array(await file.arrayBuffer());
  const sniffed = sniffImage(original);
  if (sniffed && original.length <= MEDIA_MAX_BYTES && Math.max(sniffed.width, sniffed.height) <= MEDIA_MAX_EDGE)
    return { bytes: original, note: "" };
  const image = await decode(await readAsDataUrl(file));
  const naturalW = image.naturalWidth || 1600,
    naturalH = image.naturalHeight || 1200;
  for (const edge of [MEDIA_MAX_EDGE, 1800, 1400, 1000]) {
    const scale = Math.min(1, edge / Math.max(naturalW, naturalH));
    const w = Math.max(1, Math.round(naturalW * scale)),
      h = Math.max(1, Math.round(naturalH * scale));
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("浏览器无法处理图片。");
    context.drawImage(image, 0, 0, w, h);
    const alpha = hasAlpha(context, w, h);
    if (alpha) {
      const png = await encode(canvas, "image/png");
      if (png.length <= MEDIA_MAX_BYTES) return { bytes: png, note: `已缩放到 ${w}×${h}` };
      continue;
    }
    for (const quality of [0.88, 0.8, 0.7]) {
      const jpeg = await encode(canvas, "image/jpeg", quality);
      if (jpeg.length <= MEDIA_MAX_BYTES) return { bytes: jpeg, note: `已转为 JPEG ${w}×${h}` };
    }
  }
  throw new Error("图片过于复杂，压缩后仍然过大，请换一张图片。");
}

export async function uploadBytes(bytes: Uint8Array, name: string): Promise<MediaInfo> {
  const base64 = toBase64(bytes);
  const value = (await request("/api/media", { method: "POST", body: JSON.stringify({ name, data: base64 }) })) as MediaInfo;
  if (!value || typeof value.id !== "string") throw new Error("图片上传失败。");
  const record: MediaRecord = { ...value, base64 };
  ready.set(value.id, record);
  records.set(value.id, Promise.resolve(record));
  return value;
}
export async function uploadImage(file: File): Promise<MediaInfo & { note: string }> {
  const { bytes, note } = await prepareImage(file);
  return { ...(await uploadBytes(bytes, file.name)), note };
}
