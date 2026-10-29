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
/** Fast 53-bit string hash (cyrb53) plus length: identifies an image payload inside one snapshot. */
function payloadKey(text: string) {
  let h1 = 0xdeadbeef,
    h2 = 0x41c6ce57;
  for (let i = 0; i < text.length; i++) {
    const c = text.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 2654435761);
    h2 = Math.imul(h2 ^ c, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36) + "." + text.length.toString(36);
}
const MODEL_IMAGE = "wbimg:";
/** Base64 payloads of every data-URL image in the editable model, keyed by payloadKey. */
export function modelImagePayloads(document: unknown) {
  const found = new Map<string, string>();
  const visit = (v: unknown, depth: number): void => {
    if (depth > 80) return;
    if (Array.isArray(v)) for (const x of v) visit(x, depth + 1);
    else if (isRecord(v))
      for (const [key, x] of Object.entries(v)) {
        if (key === "sourcePackage") continue;
        if ((key === "src" || key === "url") && typeof x === "string" && x.startsWith("data:image/")) {
          const payload = x.slice(x.indexOf(",") + 1);
          if (payload.length > 1024) found.set(payloadKey(payload), payload);
        } else visit(x, depth + 1);
      }
  };
  visit(document, 0);
  return found;
}
/**
 * Imported pictures exist twice: as model data URLs and as OOXML media parts.
 * The archive keeps a reference instead of a second copy; unpack restores the
 * exact base64 from the same snapshot's model.
 */
function dedupeMedia(source: NonNullable<EditorDocument["sourcePackage"]>, model: EditorDocument) {
  const payloads = modelImagePayloads(model);
  if (!payloads.size) return source;
  const byPayload = new Map([...payloads].map(([key, payload]) => [payload, key]));
  const parts: typeof source.parts = {};
  for (const [path, part] of Object.entries(source.parts)) {
    const key = part.encoding === "base64" ? byPayload.get(part.data) : undefined;
    parts[path] = key ? { ...part, data: MODEL_IMAGE + key } : part;
  }
  return { ...source, parts };
}
const MODEL_SOURCE = "wbsrc:";
const BLOCK_SOURCES = "workbenchBlockSources";
/**
 * Imported blocks carry their verbatim OOXML (`ooxmlSource.xml` plus a
 * semantic signature) so untouched blocks export byte-identically. That text
 * duplicates word/document.xml and is usually larger than the visible model,
 * so it travels in the compressed archive and the model keeps `wbsrc:<n>`.
 */
function extractBlockSources(doc: EditorDocument) {
  const sources: unknown[] = [];
  const visit = (v: unknown, depth: number): void => {
    if (depth > 80) return;
    if (Array.isArray(v)) for (const x of v) visit(x, depth + 1);
    else if (isRecord(v))
      for (const [key, x] of Object.entries(v)) {
        if (key === "sourcePackage") continue;
        if (key === "ooxmlSource" && isRecord(x)) {
          v[key] = MODEL_SOURCE + sources.length;
          sources.push(x);
        } else visit(x, depth + 1);
      }
  };
  visit(doc, 0);
  return sources;
}
function restoreBlockSources(doc: EditorDocument, sources: unknown[]) {
  const visit = (v: unknown, depth: number): void => {
    if (depth > 80) return;
    if (Array.isArray(v)) for (const x of v) visit(x, depth + 1);
    else if (isRecord(v))
      for (const [key, x] of Object.entries(v)) {
        if (key === "sourcePackage") continue;
        if (key === "ooxmlSource" && typeof x === "string" && x.startsWith(MODEL_SOURCE)) {
          const found = sources[Number(x.slice(MODEL_SOURCE.length))];
          if (!isRecord(found))
            throw Error("OOXML段落原件缺失，不能静默改写原文档结构。");
          v[key] = found;
        } else visit(x, depth + 1);
      }
  };
  visit(doc, 0);
}
export function packNative(document: EditorDocument) {
  const doc = JSON.parse(JSON.stringify(document)) as EditorDocument;
  if (!doc.sourcePackage) return { document: doc, archive: null };
  const blockSources = extractBlockSources(doc);
  const media = dedupeMedia(doc.sourcePackage, doc);
  const wire = JSON.stringify(blockSources.length ? { ...media, [BLOCK_SOURCES]: blockSources } : media);
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
  return openArchive(value).source;
}
function openArchive(value: unknown) {
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
    if (++count > 120000 || depth > 24) throw Error("OOXML元数据层级超限。");
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
  const { [BLOCK_SOURCES]: blockSources, ...rest } = source;
  if (blockSources !== undefined && !Array.isArray(blockSources))
    throw Error("OOXML段落原件索引无效。");
  return {
    source: rest as unknown as NonNullable<EditorDocument["sourcePackage"]>,
    blockSources: (blockSources ?? []) as unknown[],
  };
}
export function unpackNative(
  document: EditorDocument | null,
  archive?: SourceArchive | null,
): EditorDocument | null {
  if (!document) return null;
  if (!archive) {
    if (JSON.stringify(document).includes('"ooxmlSource":"' + MODEL_SOURCE))
      throw Error("OOXML段落原件缺失，不能静默改写原文档结构。");
    return document;
  }
  const { source, blockSources } = openArchive(archive);
  if (blockSources.length) {
    document = JSON.parse(JSON.stringify(document)) as EditorDocument;
    restoreBlockSources(document, blockSources);
  }
  let payloads: Map<string, string> | undefined;
  const parts: typeof source.parts = {};
  for (const [path, part] of Object.entries(source.parts)) {
    if (part.encoding === "base64" && part.data.startsWith(MODEL_IMAGE)) {
      payloads ??= modelImagePayloads(document);
      const payload = payloads.get(part.data.slice(MODEL_IMAGE.length));
      if (payload === undefined)
        throw Error("OOXML图片部件缺少对应的文稿图片，不能静默丢图。");
      parts[path] = { ...part, data: payload };
    } else parts[path] = part;
  }
  return { ...document, sourcePackage: { ...source, parts } };
}
