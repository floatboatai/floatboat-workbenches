// ABOUTME: 素材文件存储：分块上传、流式哈希定名、按字节范围读取；示例素材从工作台自带目录读取。
import { createHash, randomUUID } from "node:crypto";
import { createReadStream, createWriteStream } from "node:fs";
import { open, rename, unlink, stat, readFile, writeFile } from "node:fs/promises";
import { Readable } from "node:stream";
import {
  CHUNK_BYTES,
  MAX_ASSET_BYTES,
  MAX_CHUNKS,
  MIME_BY_FAMILY,
  UNSUPPORTED,
  contentId,
  resolveMime,
  sniff,
  type Family,
} from "../contracts/media.ts";
import { sampleFile } from "../contracts/samples.ts";
type Resolver = (relative: string, write?: boolean) => Promise<string>;

const uploadId = (id: string) => {
  if (!/^[a-f0-9]{32}$/.test(id)) throw new Error("上传标识无效。");
  return id;
};
export const digest = (bytes: Uint8Array) => createHash("sha256").update(bytes).digest("hex");
const MIME: Record<Family, string> = {
  mp4: "video/mp4", matroska: "video/webm", wav: "audio/wav", mp3: "audio/mpeg", ogg: "audio/ogg",
  flac: "audio/flac", adts: "audio/aac", png: "image/png", jpeg: "image/jpeg", webp: "image/webp", gif: "image/gif",
};
async function head(path: string) {
  const handle = await open(path, "r");
  try {
    const b = new Uint8Array(16);
    await handle.read(b, 0, 16, 0);
    return b;
  } finally {
    await handle.close();
  }
}

export function createMediaFiles(media: Resolver, samples: Resolver) {
  async function locate(id: string): Promise<string> {
    contentId(id);
    const sample = sampleFile(id);
    if (sample) return samples(sample);
    for (const name of [`${id}.media`, `${id}.mp4`]) {
      const path = await media(name).catch(() => "");
      if (path && (await stat(path).then((s) => s.isFile(), () => false))) return path;
    }
    throw Object.assign(new Error("素材文件缺失，请重新导入该素材或导入含素材的工程。"), { status: 404 });
  }
  return {
    locate,
    async chunk(id: string, index: number, raw: unknown) {
      uploadId(id);
      if (!Number.isInteger(index) || index < 0 || index >= MAX_CHUNKS || typeof raw !== "string" || raw.length > Math.ceil(CHUNK_BYTES / 3) * 4)
        throw new Error("素材分块无效。");
      const bytes = Buffer.from(raw, "base64");
      if (!bytes.length || bytes.length > CHUNK_BYTES || bytes.toString("base64") !== raw) throw new Error("素材分块编码无效。");
      const temp = await media(`${id}.${index}.${randomUUID()}.tmp`, true);
      await writeFile(temp, bytes);
      await rename(temp, await media(`${id}.${index}.part`, true));
      return { ok: true };
    },
    /** 顺序合并分块并计算 SHA-256；以内容哈希命名，重复上传同一文件只保留一份。 */
    async finish(id: string, input: { bytes: unknown; mime: unknown }) {
      uploadId(id);
      const bytes = input.bytes;
      if (typeof bytes !== "number" || !Number.isInteger(bytes) || bytes < 12 || bytes > MAX_ASSET_BYTES)
        throw new Error("素材大小无效，单个素材最大 2 GB。");
      const count = Math.ceil(bytes / CHUNK_BYTES), parts: string[] = [];
      for (let i = 0; i < count; i++) {
        const part = await media(`${id}.${i}.part`);
        const size = await stat(part).then((s) => s.size, () => -1);
        if (size !== Math.min(CHUNK_BYTES, bytes - i * CHUNK_BYTES)) throw new Error("素材尚未完整上传，请重试。");
        parts.push(part);
      }
      const family = sniff(await head(parts[0]));
      if (!family) throw new Error(UNSUPPORTED);
      const mime = resolveMime(family, typeof input.mime === "string" ? input.mime : "");
      const temp = await media(`${id}.${randomUUID()}.tmp`, true), hash = createHash("sha256");
      try {
        const out = createWriteStream(temp, { flags: "wx" });
        for (const part of parts) {
          const data = await readFile(part);
          hash.update(data);
          if (!out.write(data)) await new Promise<void>((r) => out.once("drain", () => r()));
        }
        await new Promise<void>((resolve, reject) => { out.once("error", reject); out.end(() => resolve()); });
        const sha = hash.digest("hex");
        await rename(temp, await media(`${sha}.media`, true));
        await Promise.all(parts.map((p) => unlink(p).catch(() => {})));
        return { id: sha, bytes, mime, family };
      } finally {
        await unlink(temp).catch(() => {});
      }
    },
    async verify(asset: { id: string; bytes: number }) {
      // 缺失素材按“待补齐”的草稿处理，不能带 404 状态被自动保存误判为版本冲突。
      const info = await locate(asset.id).then((path) => stat(path)).catch(() => null);
      if (!info || info.size !== asset.bytes) throw new Error("素材文件缺失，请重新导入该素材或导入含素材的工程。");
    },
    async read(id: string) {
      return readFile(await locate(id));
    },
    /** 支持 Range 的读取，供 <video>/<audio> 拖动与浏览器导出按需读取大文件。 */
    async response(id: string, range: string | undefined, download?: string) {
      const path = await locate(id), size = (await stat(path)).size;
      const family = sniff(await head(path));
      const type = family ? MIME[family] : "application/octet-stream";
      const headers: Record<string, string> = {
        "content-type": type,
        "accept-ranges": "bytes",
        "cache-control": "private,max-age=31536000,immutable",
        "x-content-type-options": "nosniff",
      };
      if (download) headers["content-disposition"] = `attachment; filename*=UTF-8''${encodeURIComponent(download)}`;
      const m = range ? /^bytes=(\d*)-(\d*)$/.exec(range.trim()) : null;
      if (m && (m[1] || m[2])) {
        let start = m[1] ? Number(m[1]) : Math.max(0, size - Number(m[2]));
        let end = m[1] && m[2] ? Number(m[2]) : size - 1;
        end = Math.min(end, size - 1);
        if (start > end || start >= size)
          return new Response(null, { status: 416, headers: { "content-range": `bytes */${size}` } });
        headers["content-range"] = `bytes ${start}-${end}/${size}`;
        headers["content-length"] = String(end - start + 1);
        return new Response(Readable.toWeb(createReadStream(path, { start, end })) as ReadableStream, { status: 206, headers });
      }
      headers["content-length"] = String(size);
      return new Response(Readable.toWeb(createReadStream(path)) as ReadableStream, { status: 200, headers });
    },
  };
}
export const ALLOWED_MIME = Object.values(MIME_BY_FAMILY).flat();
