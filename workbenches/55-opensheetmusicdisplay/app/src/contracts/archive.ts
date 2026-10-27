import JSZip from "jszip";
import { safeXml, inspectScore, MAX_XML_BYTES } from "./musicxml.ts";
import {
  bytesToBase64,
  originalBytes,
  type SourceFile,
  type ScoreProject,
  validateScore,
} from "./domain.ts";
import { isRecord } from "./project.ts";
function safePath(name: string) {
  return (
    !!name &&
    !name.startsWith("/") &&
    !name.includes("\\") &&
    !name.split("/").includes("..") &&
    !/[\u0000-\u001f]/.test(name)
  );
}
export function inspectZip(bytes: Uint8Array): void {
  if (bytes.length < 22 || bytes.length > 200000)
    throw new Error("MXL 压缩文件必须小于 200 KB。");
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let end = -1;
  for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 65557); i--)
    if (
      view.getUint32(i, true) === 0x06054b50 &&
      i + 22 + view.getUint16(i + 20, true) === bytes.length
    ) {
      end = i;
      break;
    }
  if (end < 0 || view.getUint16(end + 4, true) || view.getUint16(end + 6, true))
    throw new Error("MXL ZIP 目录无效，不支持分卷。");
  const count = view.getUint16(end + 10, true),
    size = view.getUint32(end + 12, true),
    offset = view.getUint32(end + 16, true);
  if (!count || count > 32 || offset + size > end)
    throw new Error("MXL 最多允许 32 个文件，不支持 ZIP64。");
  let cursor = offset,
    total = 0;
  const names = new Set<string>();
  for (let i = 0; i < count; i++) {
    if (cursor + 46 > end || view.getUint32(cursor, true) !== 0x02014b50)
      throw new Error("MXL 文件目录损坏。");
    const flags = view.getUint16(cursor + 8, true),
      method = view.getUint16(cursor + 10, true),
      expanded = view.getUint32(cursor + 24, true),
      nameSize = view.getUint16(cursor + 28, true),
      extra = view.getUint16(cursor + 30, true),
      comment = view.getUint16(cursor + 32, true);
    total += expanded;
    if (
      flags & 1 ||
      ![0, 8].includes(method) ||
      expanded > MAX_XML_BYTES ||
      total > 500000
    )
      throw new Error("MXL 含加密、未知压缩或解压后过大的内容。");
    const next = cursor + 46 + nameSize + extra + comment;
    if (next > end) throw new Error("MXL 文件目录越界。");
    const name = new TextDecoder("utf-8", { fatal: true }).decode(
      bytes.subarray(cursor + 46, cursor + 46 + nameSize),
    );
    if (!safePath(name) || names.has(name))
      throw new Error("MXL 路径不安全或重复。");
    names.add(name);
    cursor = next;
  }
  if (cursor !== offset + size) throw new Error("MXL 目录长度不一致。");
}
async function boundedFile(
  zip: JSZip,
  name: string,
  limit: number,
): Promise<Uint8Array> {
  const entry = zip.file(name);
  if (!entry) throw new Error("MXL 缺少指定的乐谱文件。");
  return new Promise((resolve, reject) => {
    const chunks: Uint8Array[] = [];
    let size = 0,
      failed = false;
    const streaming = entry as JSZip.JSZipObject & {
      internalStream: (
        type: "uint8array",
      ) => JSZip.JSZipStreamHelper<Uint8Array>;
    };
    if (typeof streaming.internalStream !== "function") {
      reject(new Error("MXL 流式解压接口不可用。"));
      return;
    }
    const stream = streaming.internalStream("uint8array");
    stream
      .on("data", (chunk) => {
        if (failed) return;
        size += chunk.length;
        if (size > limit) {
          failed = true;
          stream.pause();
          reject(new Error("MXL 解压内容超过限制。"));
          return;
        }
        chunks.push(chunk);
      })
      .on("error", reject)
      .on("end", () => {
        if (failed) return;
        const bytes = new Uint8Array(size);
        let offset = 0;
        for (const chunk of chunks) {
          bytes.set(chunk, offset);
          offset += chunk.length;
        }
        resolve(bytes);
      })
      .resume();
  });
}
export async function extractMxl(bytes: Uint8Array): Promise<string> {
  inspectZip(bytes);
  const zip = await JSZip.loadAsync(bytes, { createFolders: false });
  const containerBytes = await boundedFile(
    zip,
    "META-INF/container.xml",
    10000,
  );
  const tree = safeXml(
    new TextDecoder("utf-8", { fatal: true }).decode(containerBytes),
  );
  const container = tree.container,
    files = isRecord(container) ? container.rootfiles : undefined,
    root = isRecord(files) ? files.rootfile : undefined;
  const rootfile = Array.isArray(root) ? root[0] : root;
  const name = isRecord(rootfile) ? rootfile["@_full-path"] : undefined;
  if (typeof name !== "string" || !safePath(name))
    throw new Error("MXL 容器未指定安全的 MusicXML 文件。");
  const xml = new TextDecoder("utf-8", { fatal: true }).decode(
    await boundedFile(zip, name, MAX_XML_BYTES),
  );
  inspectScore(xml);
  return xml;
}
export async function importScore(
  bytes: Uint8Array,
  fileName: string,
): Promise<SourceFile> {
  const kind = fileName.toLowerCase().endsWith(".mxl") ? "mxl" : "xml";
  if (!/\.(?:xml|musicxml|mxl)$/i.test(fileName))
    throw new Error("请选择 .musicxml、.xml 或 .mxl 文件。");
  if (!bytes.length || bytes.length > 200000)
    throw new Error("原文件需要 1–200 KB。");
  const xml =
    kind === "mxl"
      ? await extractMxl(bytes)
      : new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  inspectScore(xml);
  return { fileName, kind, originalBase64: bytesToBase64(bytes), xml };
}
export async function verifySource(value: unknown): Promise<ScoreProject> {
  const data = validateScore(value);
  if (
    data.source.kind === "mxl" &&
    (await extractMxl(originalBytes(data.source))) !== data.source.xml
  )
    throw new Error("MXL 原文件与审阅内容不一致。");
  return data;
}
