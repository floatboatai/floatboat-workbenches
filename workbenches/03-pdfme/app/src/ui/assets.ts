// ABOUTME: 页面侧的二进制资源：分块上传、按引用取回并缓存，以及项目在“引用”和“可渲染数据”之间的转换。
import { getPageConnection } from "./connection";
import { request } from "./requests";
import { isRecord } from "../contracts/project";
import {
  ASSET_PREFIX,
  ASSET_TYPES,
  CHUNK,
  INLINE_LIMIT,
  assetId,
  dataUrlMime,
  formatBytes,
  isAssetMime,
  isAssetRef,
  type AssetMime,
} from "../contracts/assets";
import { mapBlobs, type PdfProject } from "../contracts/domain";

/** ref → data URL, and the reverse so unchanged data coming back from pdfme maps to its ref without re-upload. */
const byRef = new Map<string, Promise<string>>();
const byData = new Map<string, string>();

export function toBase64(bytes: Uint8Array): string {
  let text = "";
  for (let i = 0; i < bytes.length; i += 0x8000) text += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(text);
}
export function dataUrlBytes(value: string): Uint8Array {
  const raw = atob(value.slice(value.indexOf(",") + 1));
  const bytes = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
  return bytes;
}
export const bytesToDataUrl = (bytes: Uint8Array, mime: string) => `data:${mime};base64,${toBase64(bytes)}`;
export function dataUrlText(value: string): string {
  return new TextDecoder().decode(dataUrlBytes(value));
}

async function sha256(bytes: Uint8Array): Promise<string> {
  const hash = new Uint8Array(await crypto.subtle.digest("SHA-256", new Uint8Array(bytes)));
  return Array.from(hash, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

/** Store bytes on the server (deduplicated by SHA-256) and return the persisted reference. */
export async function uploadAsset(bytes: Uint8Array, mime: AssetMime, progress?: (fraction: number) => void): Promise<string> {
  if (!bytes.length) throw new Error("文件是空的。");
  if (bytes.length > ASSET_TYPES[mime]) throw new Error(`文件为 ${formatBytes(bytes.length)}，超过 ${formatBytes(ASSET_TYPES[mime])} 上限。`);
  const id = await sha256(bytes);
  const ref = ASSET_PREFIX + id;
  const status = await request(`/api/assets/${id}/status`);
  if (!(isRecord(status) && status.stored === true)) {
    const total = Math.ceil(bytes.length / CHUNK);
    for (let index = 0; index < total; index++) {
      progress?.(index / total);
      await request(`/api/assets/${id}/parts/${index}`, {
        method: "POST",
        body: JSON.stringify({ data: toBase64(bytes.subarray(index * CHUNK, (index + 1) * CHUNK)) }),
      });
    }
    await request(`/api/assets/${id}/finish`, { method: "POST", body: JSON.stringify({ mime, size: bytes.length }) });
  }
  progress?.(1);
  const data = bytesToDataUrl(bytes, mime);
  byRef.set(ref, Promise.resolve(data));
  byData.set(data, ref);
  return ref;
}

/** Small payloads stay inline in the project; anything larger becomes an asset reference. */
export async function storeBlob(bytes: Uint8Array, mime: AssetMime, progress?: (fraction: number) => void): Promise<string> {
  const data = bytesToDataUrl(bytes, mime);
  if (data.length <= INLINE_LIMIT) return data;
  return uploadAsset(bytes, mime, progress);
}

export function resolveBlob(value: string): Promise<string> {
  if (!isAssetRef(value)) return Promise.resolve(value);
  let pending = byRef.get(value);
  if (!pending) {
    pending = (async () => {
      const page = await getPageConnection();
      const response = await page.fetch(`/api/assets/${assetId(value)}`);
      if (!response.ok) {
        let message = "模板引用的文件暂时无法读取，请重新导入该文件。";
        try {
          const body: unknown = await response.json();
          if (isRecord(body) && isRecord(body.error) && typeof body.error.message === "string") message = body.error.message;
        } catch {
          /* Non-JSON failures keep the generic message. */
        }
        throw new Error(message);
      }
      const blob = await response.blob();
      const data = bytesToDataUrl(new Uint8Array(await blob.arrayBuffer()), blob.type || "application/octet-stream");
      byData.set(data, value);
      return data;
    })();
    byRef.set(value, pending);
    pending.catch(() => byRef.delete(value));
  }
  return pending;
}

/** Replace references with renderable data URLs for pdfme (cheap after the first fetch). */
export function hydrate(project: PdfProject): Promise<PdfProject> {
  return mapBlobs(project, resolveBlob);
}

/** Inverse of hydrate: known data maps back to its ref, new large data (e.g. a photo dropped into the Designer) is uploaded. */
export function dehydrate(project: PdfProject): Promise<PdfProject> {
  return mapBlobs(project, async (value) => {
    if (!value.startsWith("data:") || value.length <= INLINE_LIMIT) return value;
    const known = byData.get(value);
    if (known) return known;
    const mime = dataUrlMime(value);
    const normalized = mime === "image/jpg" ? "image/jpeg" : mime;
    if (!isAssetMime(normalized)) throw new Error("只支持 PNG/JPEG 图片、PDF 底图和 CSV/JSON 数据文件。");
    return uploadAsset(dataUrlBytes(value), normalized);
  });
}

export async function readFileBytes(file: File, limit: number, label: string): Promise<Uint8Array> {
  if (file.size > limit) throw new Error(`${label}为 ${formatBytes(file.size)}，超过 ${formatBytes(limit)} 上限。`);
  return new Uint8Array(await file.arrayBuffer());
}
