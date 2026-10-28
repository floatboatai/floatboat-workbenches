import { createHash, randomUUID } from "node:crypto";
import { readFile, writeFile, rename, unlink, stat } from "node:fs/promises";
import {
  videoSource,
  CHUNK_BYTES,
  MAX_VIDEO_BYTES,
  type VideoSource,
} from "../contracts/montage.ts";
type Resolver = (relative: string, write?: boolean) => Promise<string>;
export const videoId = (id: string) => {
  if (!/^[a-f0-9]{64}$/.test(id)) throw new Error("文件标识无效。");
  return id;
};
export const digest = (bytes: Uint8Array) =>
  createHash("sha256").update(bytes).digest("hex");
export function detectMime(bytes: Uint8Array): string {
  if (Buffer.from(bytes).subarray(4, 8).toString("latin1") === "ftyp")
    return "video/mp4";
  throw new Error("请选择MP4视频文件。");
}
export function createVideoFiles(path: Resolver) {
  const read = async (id: string) => readFile(await path(`${videoId(id)}.mp4`));
  return {
    read,
    async chunk(id: string, index: number, raw: unknown) {
      videoId(id);
      if (
        !Number.isInteger(index) ||
        index < 0 ||
        index >= Math.ceil(MAX_VIDEO_BYTES / CHUNK_BYTES) ||
        typeof raw !== "string" ||
        raw.length > Math.ceil(CHUNK_BYTES / 3) * 4
      )
        throw new Error("视频分块无效。");
      const bytes = Buffer.from(raw, "base64");
      if (
        !bytes.length ||
        bytes.length > CHUNK_BYTES ||
        bytes.toString("base64") !== raw
      )
        throw new Error("视频分块编码无效。");
      await writeFile(await path(`${id}.${index}.part`, true), bytes);
      return { ok: true };
    },
    async finish(input: unknown) {
      const source = videoSource(input),
        parts: Buffer[] = [];
      for (let i = 0; i < Math.ceil(source.bytes / CHUNK_BYTES); i++) {
        const part = await readFile(await path(`${source.id}.${i}.part`));
        if (
          part.length !== Math.min(CHUNK_BYTES, source.bytes - i * CHUNK_BYTES)
        )
          throw new Error("视频尚未完整上传，请重试。");
        parts.push(part);
      }
      const bytes = Buffer.concat(parts);
      if (digest(bytes) !== source.id || detectMime(bytes) !== source.mime)
        throw new Error("视频内容校验失败。");
      const temp = await path(`${source.id}.${randomUUID()}.tmp`, true);
      try {
        await writeFile(temp, bytes, { flag: "wx" });
        await rename(temp, await path(`${source.id}.mp4`, true));
      } finally {
        await unlink(temp).catch(() => {});
      }
      await Promise.all(
        parts.map((_, i) =>
          path(`${source.id}.${i}.part`, true).then((p) =>
            unlink(p).catch(() => {}),
          ),
        ),
      );
      return source;
    },
    async verify(source: VideoSource | null) {
      if (!source) return;
      const info = await stat(await path(`${videoId(source.id)}.mp4`));
      if (info.size !== source.bytes)
        throw new Error("原视频缺失，请重新上传视频或导入含视频的项目。");
    },
  };
}
