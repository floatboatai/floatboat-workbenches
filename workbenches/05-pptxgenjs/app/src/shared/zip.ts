// ABOUTME: 极简 ZIP 读写（deflate/stored），用于修正 PptxGenJS 输出的段落属性并在测试中打开验证 PPTX。
// Uses the platform CompressionStream/DecompressionStream ("deflate-raw"), available in browsers and Node 22.

export interface ZipEntry {
  name: string;
  data: Uint8Array;
}

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();
export function crc32(data: Uint8Array): number {
  let crc = 0xffffffff;
  for (let i = 0; i < data.length; i++) crc = CRC_TABLE[(crc ^ data[i]) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

async function pipe(data: Uint8Array, stream: CompressionStream | DecompressionStream): Promise<Uint8Array> {
  const output = new Blob([data as BlobPart]).stream().pipeThrough(stream);
  return new Uint8Array(await new Response(output).arrayBuffer());
}
const inflate = (data: Uint8Array) => pipe(data, new DecompressionStream("deflate-raw"));
const deflate = (data: Uint8Array) => pipe(data, new CompressionStream("deflate-raw"));

export async function readZip(input: Uint8Array): Promise<ZipEntry[]> {
  const view = new DataView(input.buffer, input.byteOffset, input.byteLength);
  let end = -1;
  for (let i = input.length - 22; i >= Math.max(0, input.length - 65557); i--)
    if (view.getUint32(i, true) === 0x06054b50) {
      end = i;
      break;
    }
  if (end < 0) throw new Error("不是有效的 ZIP 文件。");
  const count = view.getUint16(end + 10, true);
  let offset = view.getUint32(end + 16, true);
  const decoder = new TextDecoder();
  const entries: ZipEntry[] = [];
  for (let i = 0; i < count; i++) {
    if (view.getUint32(offset, true) !== 0x02014b50) throw new Error("ZIP 目录损坏。");
    const method = view.getUint16(offset + 10, true);
    const compressed = view.getUint32(offset + 20, true);
    const nameLength = view.getUint16(offset + 28, true);
    const extraLength = view.getUint16(offset + 30, true);
    const commentLength = view.getUint16(offset + 32, true);
    const local = view.getUint32(offset + 42, true);
    const name = decoder.decode(input.subarray(offset + 46, offset + 46 + nameLength));
    offset += 46 + nameLength + extraLength + commentLength;
    if (view.getUint32(local, true) !== 0x04034b50) throw new Error("ZIP 条目损坏。");
    const start = local + 30 + view.getUint16(local + 26, true) + view.getUint16(local + 28, true);
    const raw = input.subarray(start, start + compressed);
    if (name.endsWith("/")) continue;
    if (method === 0) entries.push({ name, data: raw.slice() });
    else if (method === 8) entries.push({ name, data: await inflate(raw) });
    else throw new Error(`不支持的压缩方式 ${method}。`);
  }
  return entries;
}

export async function writeZip(entries: ZipEntry[]): Promise<Uint8Array> {
  const encoder = new TextEncoder();
  const chunks: Uint8Array[] = [];
  const central: Uint8Array[] = [];
  let offset = 0;
  for (const entry of entries) {
    const name = encoder.encode(entry.name);
    const crc = crc32(entry.data);
    const packed = await deflate(entry.data);
    const useDeflate = packed.length < entry.data.length;
    const body = useDeflate ? packed : entry.data;
    const header = new Uint8Array(30 + name.length);
    const h = new DataView(header.buffer);
    h.setUint32(0, 0x04034b50, true);
    h.setUint16(4, 20, true);
    h.setUint16(6, 0x0800, true);
    h.setUint16(8, useDeflate ? 8 : 0, true);
    h.setUint16(10, 0, true);
    h.setUint16(12, 0x21, true);
    h.setUint32(14, crc, true);
    h.setUint32(18, body.length, true);
    h.setUint32(22, entry.data.length, true);
    h.setUint16(26, name.length, true);
    header.set(name, 30);
    const record = new Uint8Array(46 + name.length);
    const c = new DataView(record.buffer);
    c.setUint32(0, 0x02014b50, true);
    c.setUint16(4, 20, true);
    c.setUint16(6, 20, true);
    c.setUint16(8, 0x0800, true);
    c.setUint16(10, useDeflate ? 8 : 0, true);
    c.setUint16(14, 0x21, true);
    c.setUint32(16, crc, true);
    c.setUint32(20, body.length, true);
    c.setUint32(24, entry.data.length, true);
    c.setUint16(28, name.length, true);
    c.setUint32(42, offset, true);
    record.set(name, 46);
    chunks.push(header, body);
    central.push(record);
    offset += header.length + body.length;
  }
  const centralSize = central.reduce((n, r) => n + r.length, 0);
  const end = new Uint8Array(22);
  const e = new DataView(end.buffer);
  e.setUint32(0, 0x06054b50, true);
  e.setUint16(8, entries.length, true);
  e.setUint16(10, entries.length, true);
  e.setUint32(12, centralSize, true);
  e.setUint32(16, offset, true);
  const total = new Uint8Array(offset + centralSize + 22);
  let at = 0;
  for (const part of [...chunks, ...central, end]) {
    total.set(part, at);
    at += part.length;
  }
  return total;
}

const PARAGRAPH = /<a:p>([\s\S]*?)<\/a:p>/g;
const PPR = /<a:pPr\b[^>]*?(?:\/>|>[\s\S]*?<\/a:pPr>)/g;
/**
 * PptxGenJS 4.0.1 writes one <a:pPr> per text run, so a paragraph with several runs (bold word, link…)
 * contains several pPr elements. OOXML allows at most one, as the first child; keep only that one.
 */
export function fixParagraphProperties(xml: string): string {
  return xml.replace(PARAGRAPH, (whole, inner: string) => {
    const found = inner.match(PPR);
    if (!found || (found.length === 1 && inner.startsWith(found[0]))) return whole;
    return `<a:p>${found[0]}${inner.replace(PPR, "")}</a:p>`;
  });
}

export async function normalizePptx(input: Uint8Array): Promise<Uint8Array> {
  const entries = await readZip(input);
  const encoder = new TextEncoder(),
    decoder = new TextDecoder();
  let changed = false;
  for (const entry of entries) {
    if (!/^ppt\/(slides|slideLayouts|slideMasters)\/[^/]+\.xml$/.test(entry.name)) continue;
    const xml = decoder.decode(entry.data);
    const fixed = fixParagraphProperties(xml);
    if (fixed !== xml) {
      entry.data = encoder.encode(fixed);
      changed = true;
    }
  }
  return changed ? writeZip(entries) : input;
}
