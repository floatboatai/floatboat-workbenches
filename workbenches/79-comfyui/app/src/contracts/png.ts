// ABOUTME: PNG 文本块读写：读取 ComfyUI 嵌入的 workflow/prompt，并在下载的 PNG 中写入工作流。

const SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

export interface PngChunk {
  type: string;
  /** Data start offset within the file. */
  start: number;
  length: number;
}

export function isPng(bytes: Uint8Array): boolean {
  return bytes.length >= 8 && SIGNATURE.every((b, i) => bytes[i] === b);
}

let crcTable: Uint32Array | null = null;
export function crc32(bytes: Uint8Array, seed = 0): number {
  if (!crcTable) {
    crcTable = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      crcTable[n] = c >>> 0;
    }
  }
  let crc = ~seed >>> 0;
  for (let i = 0; i < bytes.length; i++) crc = crcTable[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8);
  return ~crc >>> 0;
}

const view = (bytes: Uint8Array) => new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);

export function pngChunks(bytes: Uint8Array): PngChunk[] {
  if (!isPng(bytes)) throw new Error("不是有效的 PNG 文件。");
  const dv = view(bytes),
    chunks: PngChunk[] = [];
  let offset = 8;
  while (offset + 12 <= bytes.length) {
    const length = dv.getUint32(offset);
    const type = String.fromCharCode(...bytes.subarray(offset + 4, offset + 8));
    if (offset + 12 + length > bytes.length) throw new Error("PNG 数据块被截断。");
    chunks.push({ type, start: offset + 8, length });
    offset += 12 + length;
    if (type === "IEND") break;
  }
  if (!chunks.length || chunks[0].type !== "IHDR") throw new Error("PNG 缺少文件头。");
  return chunks;
}

export function pngSize(bytes: Uint8Array): { width: number; height: number } {
  const [head] = pngChunks(bytes);
  const dv = view(bytes);
  return { width: dv.getUint32(head.start), height: dv.getUint32(head.start + 4) };
}

const latin1 = (b: Uint8Array) => {
  let out = "";
  for (let i = 0; i < b.length; i += 8192) out += String.fromCharCode(...b.subarray(i, i + 8192));
  return out;
};
const utf8 = (b: Uint8Array) => new TextDecoder("utf-8").decode(b);

async function inflate(data: Uint8Array): Promise<Uint8Array> {
  const stream = new Blob([data.slice()]).stream().pipeThrough(new DecompressionStream("deflate"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

/** Reads tEXt, zTXt and iTXt chunks. Later duplicates of a keyword are ignored. */
export async function readPngText(bytes: Uint8Array): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  for (const chunk of pngChunks(bytes)) {
    if (!["tEXt", "zTXt", "iTXt"].includes(chunk.type)) continue;
    const data = bytes.subarray(chunk.start, chunk.start + chunk.length);
    const zero = data.indexOf(0);
    if (zero < 1) continue;
    const key = latin1(data.subarray(0, zero));
    try {
      let text: string;
      if (chunk.type === "tEXt") text = latin1(data.subarray(zero + 1));
      else if (chunk.type === "zTXt") text = latin1(await inflate(data.subarray(zero + 2)));
      else {
        const compressed = data[zero + 1] === 1;
        let p = zero + 3;
        p = data.indexOf(0, p) + 1;
        p = data.indexOf(0, p) + 1;
        const body = data.subarray(p);
        text = utf8(compressed ? await inflate(body) : body);
      }
      if (!(key in out)) out[key] = text;
    } catch {
      /* ignore unreadable metadata chunk */
    }
  }
  return out;
}

/** ASCII-only JSON, matching what ComfyUI writes, so the text fits Latin-1 tEXt chunks. */
export function asciiJson(value: unknown): string {
  return JSON.stringify(value).replace(
    /[\u0080-￿]/g,
    (c) => "\\u" + c.charCodeAt(0).toString(16).padStart(4, "0"),
  );
}

function textChunk(key: string, text: string): Uint8Array {
  const body = new Uint8Array(key.length + 1 + text.length);
  for (let i = 0; i < key.length; i++) body[i] = key.charCodeAt(i) & 0xff;
  for (let i = 0; i < text.length; i++) body[key.length + 1 + i] = text.charCodeAt(i) & 0xff;
  const out = new Uint8Array(12 + body.length),
    dv = view(out);
  dv.setUint32(0, body.length);
  out.set([0x74, 0x45, 0x58, 0x74], 4);
  out.set(body, 8);
  const crcInput = out.subarray(4, 8 + body.length);
  dv.setUint32(8 + body.length, crc32(crcInput));
  return out;
}

/** Writes tEXt chunks (replacing the same keywords) directly after IHDR. */
export function embedPngText(png: Uint8Array, entries: Record<string, string>): Uint8Array {
  const chunks = pngChunks(png);
  const keys = new Set(Object.keys(entries));
  const parts: Uint8Array[] = [png.subarray(0, 8)];
  const added = Object.entries(entries).map(([k, v]) => textChunk(k, v));
  for (const chunk of chunks) {
    const whole = png.subarray(chunk.start - 8, chunk.start + chunk.length + 4);
    if (chunk.type === "tEXt") {
      const data = png.subarray(chunk.start, chunk.start + chunk.length);
      if (keys.has(latin1(data.subarray(0, Math.max(0, data.indexOf(0)))))) continue;
    }
    parts.push(whole);
    if (chunk.type === "IHDR") parts.push(...added);
  }
  let total = 0;
  for (const p of parts) total += p.length;
  const out = new Uint8Array(total);
  let at = 0;
  for (const p of parts) {
    out.set(p, at);
    at += p.length;
  }
  return out;
}

export interface PngWorkflowMeta {
  workflow?: unknown;
  prompt?: unknown;
}

/** Parses the `workflow` and `prompt` text entries of a ComfyUI PNG. */
export async function readComfyPng(bytes: Uint8Array): Promise<PngWorkflowMeta> {
  const text = await readPngText(bytes),
    out: PngWorkflowMeta = {};
  for (const key of ["workflow", "prompt"] as const) {
    if (typeof text[key] !== "string") continue;
    try {
      out[key] = JSON.parse(text[key]);
    } catch {
      /* damaged entry */
    }
  }
  return out;
}
