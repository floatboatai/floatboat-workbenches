// ABOUTME: 页面侧文件存取：SHA-256、1 MiB 分块上传（可续传/幂等）、按内容哈希读取原文件与结构文档（带内存缓存）。
import { getPageConnection } from "./connection.ts";
import { request } from "./requests.ts";
import { isRecord } from "../contracts/project.ts";
import { parseDocument, type Document } from "../contracts/docling.ts";
export const CHUNK = 1024 * 1024;
export const MAX_SOURCE = 64 * 1024 * 1024;
export async function sha256(bytes: Uint8Array): Promise<string> {
  const hash = await crypto.subtle.digest("SHA-256", new Uint8Array(bytes));
  return Array.from(new Uint8Array(hash), (b) => b.toString(16).padStart(2, "0")).join("");
}
function toBase64(bytes: Uint8Array) {
  let text = "";
  for (let i = 0; i < bytes.length; i += 8192) text += String.fromCharCode(...bytes.subarray(i, i + 8192));
  return btoa(text);
}
/** Uploads content-addressed bytes; an already stored file or a partial upload resumes without resending. */
export async function upload(
  kind: "source" | "docling",
  bytes: Uint8Array,
  name: string,
  progress?: (fraction: number) => void,
): Promise<string> {
  const id = await sha256(bytes);
  const begun = await request("/api/blobs", {
    method: "POST",
    body: JSON.stringify({ id, kind, name, bytes: bytes.length }),
  });
  if (!isRecord(begun)) throw new Error("上传响应无效。");
  if (begun.stored !== true) {
    const total = Math.ceil(bytes.length / CHUNK);
    for (let i = Math.floor(Number(begun.received) / CHUNK); i < total; i++) {
      progress?.(i / total);
      await request(`/api/blobs/${id}/chunks/${i}`, {
        method: "POST",
        body: JSON.stringify({ data: toBase64(bytes.subarray(i * CHUNK, (i + 1) * CHUNK)) }),
      });
    }
    await request(`/api/blobs/${id}/complete`, { method: "POST", body: "{}" });
  }
  progress?.(1);
  return id;
}
async function fetchBytes(path: string): Promise<Uint8Array> {
  const page = await getPageConnection();
  const response = await page.fetch(path);
  if (!response.ok) {
    let message = "文件暂时不可用，请重试。";
    try {
      const body: unknown = await response.json();
      if (isRecord(body) && isRecord(body.error) && typeof body.error.message === "string") message = body.error.message;
    } catch {
      /* keep the generic message */
    }
    throw Object.assign(new Error(message), { status: response.status });
  }
  return new Uint8Array(await response.arrayBuffer());
}
const documents = new Map<string, Promise<Document>>();
const sources = new Map<string, Promise<Uint8Array>>();
export function loadDocument(id: string): Promise<Document> {
  let pending = documents.get(id);
  if (!pending) {
    pending = fetchBytes(`/api/blobs/${id}/document`).then((bytes) =>
      parseDocument(JSON.parse(new TextDecoder().decode(bytes)), bytes.length),
    );
    pending.catch(() => documents.delete(id));
    documents.set(id, pending);
  }
  return pending;
}
export function loadSource(id: string): Promise<Uint8Array> {
  let pending = sources.get(id);
  if (!pending) {
    pending = fetchBytes(`/api/blobs/${id}/source`);
    pending.catch(() => sources.delete(id));
    if (sources.size > 4) sources.delete(sources.keys().next().value!);
    sources.set(id, pending);
  }
  return pending;
}
/** Primes the cache after this page produced or uploaded the document itself. */
export function rememberDocument(id: string, doc: Document) {
  documents.set(id, Promise.resolve(doc));
}
export function rememberSource(id: string, bytes: Uint8Array) {
  sources.set(id, Promise.resolve(bytes));
}
