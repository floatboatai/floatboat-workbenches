import { gzipSync, gunzipSync, strToU8, strFromU8 } from "fflate";
import type { EditorDocument } from "oasis-editor";
import { isRecord } from "./project.ts";
export type SourceArchive = {
  encoding: "gzip-base64";
  bytes: number;
  data: string;
};
function b64(bytes: Uint8Array) {
  let s = "";
  for (let i = 0; i < bytes.length; i += 32768)
    s += String.fromCharCode(...bytes.subarray(i, i + 32768));
  return btoa(s);
}
function crc32(data: Uint8Array) {
  let crc = -1;
  for (const b of data) {
    crc ^= b;
    for (let n = 0; n < 8; n++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
  }
  return (crc ^ -1) >>> 0;
}
let cachedWire = "",
  cached: SourceArchive | null = null;
export function packNative(document: EditorDocument) {
  const doc = JSON.parse(JSON.stringify(document)) as EditorDocument;
  if (!doc.sourcePackage) return { document: doc, archive: null };
  const wire = JSON.stringify(doc.sourcePackage);
  if (wire !== cachedWire || !cached) {
    const bytes = strToU8(wire);
    if (bytes.length > 8000000) throw Error("完整OOXML部件超过8MB。");
    cached = {
      encoding: "gzip-base64",
      bytes: bytes.length,
      data: b64(gzipSync(bytes, { level: 6, mtime: 0 })),
    };
    cachedWire = wire;
  }
  delete doc.sourcePackage;
  return { document: doc, archive: cached };
}
export function unpackSource(
  value: unknown,
): NonNullable<EditorDocument["sourcePackage"]> {
  if (
    !isRecord(value) ||
    value.encoding !== "gzip-base64" ||
    typeof value.bytes !== "number" ||
    !Number.isInteger(value.bytes) ||
    value.bytes < 2 ||
    value.bytes > 8000000 ||
    typeof value.data !== "string" ||
    value.data.length > 1800000 ||
    !/^[A-Za-z0-9+/]*={0,2}$/.test(value.data)
  )
    throw Error("OOXML恢复封装无效。");
  const zip = Uint8Array.from(atob(value.data), (c) => c.charCodeAt(0));
  if (zip.length < 18) throw Error("OOXML恢复封装不完整。");
  const view = new DataView(zip.buffer, zip.byteOffset, zip.byteLength);
  if (view.getUint32(zip.length - 4, true) !== value.bytes)
    throw Error("OOXML展开长度不符。");
  const bytes = gunzipSync(zip, { out: new Uint8Array(value.bytes) });
  if (crc32(bytes) !== view.getUint32(zip.length - 8, true))
    throw Error("OOXML恢复校验失败。");
  const source: unknown = JSON.parse(strFromU8(bytes));
  if (
    !isRecord(source) ||
    source.format !== "docx" ||
    typeof source.mainDocumentPart !== "string" ||
    !isRecord(source.parts)
  )
    throw Error("OOXML原始部件结构无效。");
  let count = 0;
  const inspect = (v: unknown, depth = 0): void => {
    if (++count > 30000 || depth > 24) throw Error("OOXML元数据层级超限。");
    if (Array.isArray(v)) {
      for (const x of v) inspect(x, depth + 1);
    } else if (isRecord(v)) {
      for (const [key, x] of Object.entries(v)) {
        if (["__proto__", "constructor", "prototype"].includes(key))
          throw Error("OOXML属性无效。");
        inspect(x, depth + 1);
      }
    }
  };
  inspect(source);
  const entries = Object.entries(source.parts);
  if (entries.length > 200) throw Error("OOXML部件过多。");
  for (const [path, p] of entries) {
    if (
      path.startsWith("/") ||
      path.split("/").includes("..") ||
      !isRecord(p) ||
      typeof p.data !== "string" ||
      !["utf8", "base64"].includes(String(p.encoding)) ||
      typeof p.originalHash !== "string"
    )
      throw Error("OOXML部件校验失败。");
  }
  return source as unknown as NonNullable<EditorDocument["sourcePackage"]>;
}
export function unpackNative(
  document: EditorDocument | null,
  archive?: SourceArchive | null,
): EditorDocument | null {
  if (!document) return null;
  return archive
    ? { ...document, sourcePackage: unpackSource(archive) }
    : document;
}
