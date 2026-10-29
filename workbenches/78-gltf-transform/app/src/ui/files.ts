import { getPageConnection } from "./connection";
import { request } from "./requests";
import {
  CHUNK_BYTES,
  fileRef,
  imageRef,
  type Compression,
  type FileRef,
  type ImageRef,
} from "../contracts/asset.ts";
import type { Inspection } from "../contracts/inspection.ts";
import { base64 } from "./preview";
import { isRecord } from "../contracts/project.ts";

export async function readBytes(ref: FileRef) {
  const p = await getPageConnection(),
    r = await p.fetch("/api/models/" + ref.id);
  if (!r.ok) throw Error(`资源 ${ref.name} 缺失，请补齐同一文件。`);
  const bytes = new Uint8Array(await r.arrayBuffer());
  if (bytes.length !== ref.bytes || (await sha256(bytes)) !== ref.id)
    throw Error("模型内容与工程引用不匹配。");
  return bytes;
}
export async function fetchBlob(path: string) {
  const p = await getPageConnection(),
    r = await p.fetch(path);
  if (!r.ok) throw Error("资源读取失败。");
  return r;
}
export const sha256 = async (b: Uint8Array) =>
  Array.from(
    new Uint8Array(await crypto.subtle.digest("SHA-256", b.slice().buffer)),
  )
    .map((x) => x.toString(16).padStart(2, "0"))
    .join("");

/** Anything that can be read in slices: a picked File or bytes from a project archive. */
export interface Sliceable {
  name: string;
  size: number;
  read(start: number, end: number): Promise<Uint8Array>;
}
export const fromFile = (f: File): Sliceable => ({
  name: f.webkitRelativePath || f.name,
  size: f.size,
  read: async (s, e) => new Uint8Array(await f.slice(s, e).arrayBuffer()),
});
export const fromBytes = (name: string, bytes: Uint8Array): Sliceable => ({
  name,
  size: bytes.length,
  read: async (s, e) => bytes.subarray(s, e),
});
export type Progress = (sent: number, total: number) => void;

/** Sends files in ordered ≤1 MiB chunks; each JSON body stays under the SDK's 2 MB request cap. */
export async function uploadFiles(
  files: Sliceable[],
  purpose: "import" | "resource",
  progress?: Progress,
) {
  const created = await request("/api/uploads", {
    method: "POST",
    body: JSON.stringify({
      purpose,
      files: files.map((f) => ({ name: f.name.slice(-255), bytes: f.size })),
    }),
  });
  if (!isRecord(created) || typeof created.id !== "string")
    throw Error("上传会话无效。");
  const id = created.id,
    total = files.reduce((s, f) => s + f.size, 0);
  let sent = 0;
  try {
    for (const [index, f] of files.entries())
      for (let offset = 0; offset < f.size; offset += CHUNK_BYTES) {
        const bytes = await f.read(offset, Math.min(f.size, offset + CHUNK_BYTES));
        await request(`/api/uploads/${id}/chunk`, {
          method: "POST",
          body: JSON.stringify({ index, offset, base64: base64(bytes) }),
        });
        sent += bytes.length;
        progress?.(sent, total);
      }
  } catch (e) {
    void request(`/api/uploads/${id}`, { method: "DELETE" }).catch(() => {});
    throw e;
  }
  return id;
}
export interface Loaded {
  ref: FileRef;
  inspection: Inspection;
  notes: string[];
}
export function response(v: unknown): Loaded {
  if (
    !isRecord(v) ||
    !isRecord(v.inspection) ||
    !Array.isArray(v.inspection.materials) ||
    !isRecord(v.inspection.report)
  )
    throw Error("模型检查响应无效。");
  return {
    ref: fileRef(v.ref),
    inspection: v.inspection as unknown as Inspection,
    notes: Array.isArray(v.notes)
      ? v.notes.filter((x): x is string => typeof x === "string")
      : [],
  };
}
export async function importModel(files: Sliceable[], progress?: Progress) {
  const id = await uploadFiles(files, "import", progress);
  return response(
    await request(`/api/uploads/${id}/import`, { method: "POST", body: "{}" }),
  );
}
export async function uploadResource(
  file: Sliceable,
  kind: "model",
  progress?: Progress,
): Promise<FileRef>;
export async function uploadResource(
  file: Sliceable,
  kind: "image",
  progress?: Progress,
): Promise<ImageRef>;
export async function uploadResource(
  file: Sliceable,
  kind: "model" | "image",
  progress?: Progress,
) {
  const id = await uploadFiles([file], "resource", progress),
    out = await request(`/api/uploads/${id}/resource`, {
      method: "POST",
      body: JSON.stringify({ kind, name: file.name.split("/").pop() }),
    });
  if (!isRecord(out)) throw Error("资源响应无效。");
  return kind === "image" ? imageRef(out.ref) : fileRef(out.ref);
}
export async function missingResources(ids: string[]) {
  if (!ids.length) return [];
  const out = await request("/api/resources/missing", {
    method: "POST",
    body: JSON.stringify({ ids }),
  });
  if (!isRecord(out) || !Array.isArray(out.missing)) throw Error("资源检查失败。");
  return out.missing.filter((x): x is string => typeof x === "string");
}
export async function exportModel(ref: FileRef, compression: Compression) {
  if (compression === "none") return readBytes(ref);
  const p = await getPageConnection(),
    r = await p.fetch("/api/export", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ref, compression }),
    });
  if (!r.ok) {
    const v: unknown = await r.json().catch(() => null);
    throw Error(
      isRecord(v) && isRecord(v.error) && typeof v.error.message === "string"
        ? v.error.message
        : "导出失败。",
    );
  }
  return new Uint8Array(await r.arrayBuffer());
}
