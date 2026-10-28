import { getPageConnection } from "./connection";
import { request } from "./requests";
import { fileRef, type FileRef } from "../contracts/asset.ts";
import type { Inspection } from "../contracts/inspection.ts";
import { base64 } from "./preview";
import { isRecord } from "../contracts/project.ts";
export async function readBytes(ref: FileRef) {
  const p = await getPageConnection(),
    r = await p.fetch("/api/models/" + ref.id);
  if (!r.ok) throw Error("模型资源缺失，请补齐同一文件。");
  const bytes = new Uint8Array(await r.arrayBuffer());
  if (bytes.length !== ref.bytes || (await sha256(bytes)) !== ref.id)
    throw Error("模型内容与工程引用不匹配。");
  return bytes;
}
export const sha256 = async (b: Uint8Array) =>
  Array.from(
    new Uint8Array(await crypto.subtle.digest("SHA-256", b.slice().buffer)),
  )
    .map((x) => x.toString(16).padStart(2, "0"))
    .join("");
export async function upload(bytes: Uint8Array, name: string) {
  return response(
    await request("/api/models", {
      method: "POST",
      body: JSON.stringify({ name, base64: base64(bytes) }),
    }),
  );
}
export function response(v: unknown) {
  if (
    !isRecord(v) ||
    !isRecord(v.inspection) ||
    !Array.isArray(v.inspection.materials)
  )
    throw Error("模型检查响应无效。");
  return {
    ref: fileRef(v.ref),
    inspection: v.inspection as unknown as Inspection,
  };
}
