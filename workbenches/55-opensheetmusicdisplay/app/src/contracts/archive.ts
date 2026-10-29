// ABOUTME: 压缩 MusicXML（.mxl）的目录检查与限额解压，以及原文件到可渲染 MusicXML 的统一入口。
import JSZip from "jszip";
import { decodeXml, inspectScore, MAX_XML_BYTES, safeXml, type ScoreIndex } from "./musicxml.ts";
import { isRecord } from "./project.ts";

/** 上传原文件上限：普通 MusicXML 或 MXL。 */
export const MAX_SOURCE_BYTES = 32 * 1024 * 1024;
const MAX_ENTRIES = 256;
const MAX_DECLARED_TOTAL = 512 * 1024 * 1024;

export type SourceKind = "xml" | "mxl";

export function sourceKind(fileName: string, bytes: Uint8Array): SourceKind {
  if (!/\.(?:xml|musicxml|mxl)$/i.test(fileName)) throw new Error("请选择 .musicxml、.xml 或 .mxl 文件。");
  const zip = bytes[0] === 0x50 && bytes[1] === 0x4b && bytes[2] === 0x03 && bytes[3] === 0x04;
  if (zip) return "mxl";
  if (/\.mxl$/i.test(fileName)) throw new Error("这个 .mxl 不是 ZIP 压缩包，可能已损坏。");
  return "xml";
}

function safePath(name: string) {
  return !!name && !name.startsWith("/") && !name.includes("\\") && !name.split("/").includes("..") && !/[\u0000-\u001f]/.test(name);
}

/** 解压前读取 ZIP 中央目录：拒绝分卷、ZIP64、加密、未知压缩方式、路径穿越与重复条目。 */
export function inspectZip(bytes: Uint8Array): string[] {
  if (bytes.length < 22) throw new Error("MXL 压缩包不完整。");
  if (bytes.length > MAX_SOURCE_BYTES) throw new Error(`原文件超过 ${MAX_SOURCE_BYTES / 1048576} MB。`);
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let end = -1;
  for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 65557); i--)
    if (view.getUint32(i, true) === 0x06054b50 && i + 22 + view.getUint16(i + 20, true) === bytes.length) {
      end = i;
      break;
    }
  if (end < 0 || view.getUint16(end + 4, true) || view.getUint16(end + 6, true)) throw new Error("MXL 的 ZIP 目录无效（不支持分卷）。");
  const count = view.getUint16(end + 10, true),
    size = view.getUint32(end + 12, true),
    offset = view.getUint32(end + 16, true);
  if (count === 0xffff || offset === 0xffffffff) throw new Error("MXL 使用了 ZIP64，请用制谱软件重新导出。");
  if (!count || count > MAX_ENTRIES || offset + size > end) throw new Error(`MXL 最多 ${MAX_ENTRIES} 个条目，目录需完整。`);
  let cursor = offset,
    total = 0;
  const names: string[] = [];
  for (let i = 0; i < count; i++) {
    if (cursor + 46 > end || view.getUint32(cursor, true) !== 0x02014b50) throw new Error("MXL 文件目录损坏。");
    const flags = view.getUint16(cursor + 8, true),
      method = view.getUint16(cursor + 10, true),
      expanded = view.getUint32(cursor + 24, true),
      nameSize = view.getUint16(cursor + 28, true),
      extra = view.getUint16(cursor + 30, true),
      comment = view.getUint16(cursor + 32, true);
    total += expanded;
    if (flags & 1) throw new Error("MXL 已加密，无法读取。");
    if (![0, 8].includes(method)) throw new Error("MXL 使用了不支持的压缩方式（仅支持存储与 Deflate）。");
    if (total > MAX_DECLARED_TOTAL) throw new Error("MXL 声明的解压总量过大。");
    const next = cursor + 46 + nameSize + extra + comment;
    if (next > end) throw new Error("MXL 文件目录越界。");
    const name = new TextDecoder("utf-8", { fatal: true }).decode(bytes.subarray(cursor + 46, cursor + 46 + nameSize));
    if (!safePath(name) || names.includes(name)) throw new Error("MXL 含不安全或重复的路径。");
    names.push(name);
    cursor = next;
  }
  if (cursor !== offset + size) throw new Error("MXL 目录长度不一致。");
  return names;
}

/** 以实际输出字节计数的流式解压，防止伪报长度。 */
async function boundedFile(zip: JSZip, name: string, limit: number): Promise<Uint8Array> {
  const entry = zip.file(name);
  if (!entry) throw new Error(`MXL 缺少 ${name}。`);
  const streaming = entry as JSZip.JSZipObject & {
    internalStream?: (type: "uint8array") => JSZip.JSZipStreamHelper<Uint8Array>;
  };
  if (typeof streaming.internalStream !== "function") throw new Error("MXL 流式解压接口不可用。");
  const stream = streaming.internalStream("uint8array");
  return new Promise((resolve, reject) => {
    const chunks: Uint8Array[] = [];
    let size = 0,
      failed = false;
    stream
      .on("data", (chunk) => {
        if (failed) return;
        size += chunk.length;
        if (size > limit) {
          failed = true;
          stream.pause();
          reject(new Error(`MXL 中的乐谱解压后超过 ${Math.round(limit / 1048576)} MB。`));
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

/** 选择 container.xml 中第一个 MusicXML rootfile；缺少容器时退回到唯一的根目录 .xml/.musicxml。 */
export async function extractMxl(bytes: Uint8Array): Promise<string> {
  const names = inspectZip(bytes);
  const zip = await JSZip.loadAsync(bytes, { createFolders: false });
  let target: string | undefined;
  if (names.includes("META-INF/container.xml")) {
    const { tree } = safeXml(decodeXml(await boundedFile(zip, "META-INF/container.xml", 64 * 1024)));
    const container = tree.container,
      files = isRecord(container) ? container.rootfiles : undefined,
      roots = isRecord(files) ? files.rootfile : undefined;
    const candidates = (Array.isArray(roots) ? roots : [roots]).filter(isRecord);
    const chosen =
      candidates.find((root) => typeof root["@_media-type"] !== "string" || /musicxml/i.test(String(root["@_media-type"]))) ?? candidates[0];
    target = chosen && typeof chosen["@_full-path"] === "string" ? chosen["@_full-path"] : undefined;
    if (!target || !safePath(target) || !names.includes(target)) throw new Error("MXL 容器没有指向包内的 MusicXML 文件。");
  } else {
    const scores = names.filter((name) => !name.includes("/") && /\.(?:xml|musicxml)$/i.test(name));
    if (scores.length !== 1) throw new Error("MXL 缺少 META-INF/container.xml，且无法确定乐谱文件。");
    target = scores[0];
  }
  return decodeXml(await boundedFile(zip, target, MAX_XML_BYTES));
}

/** 原文件 → 可渲染的 MusicXML 文本与索引。服务端与测试使用同一实现。 */
export async function readSource(bytes: Uint8Array, fileName: string): Promise<{ kind: SourceKind; xml: string; index: ScoreIndex }> {
  if (!bytes.length) throw new Error("文件为空。");
  if (bytes.length > MAX_SOURCE_BYTES) throw new Error(`原文件超过 ${MAX_SOURCE_BYTES / 1048576} MB。`);
  const kind = sourceKind(fileName, bytes);
  const xml = kind === "mxl" ? await extractMxl(bytes) : decodeXml(bytes);
  return { kind, xml, index: inspectScore(xml) };
}
