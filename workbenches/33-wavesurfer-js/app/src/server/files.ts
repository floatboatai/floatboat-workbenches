import { createHash, randomUUID } from "node:crypto";
import { readFile, writeFile, rename, unlink, stat } from "node:fs/promises";
import {
  audioSource,
  CHUNK_BYTES,
  MAX_AUDIO_BYTES,
  type AudioSource,
} from "../contracts/review.ts";
type Resolver = (relative: string, write?: boolean) => Promise<string>;
export const audioId = (id: string) => {
  if (!/^[a-f0-9]{64}$/.test(id)) throw new Error("文件标识无效。");
  return id;
};
export const digest = (bytes: Uint8Array) =>
  createHash("sha256").update(bytes).digest("hex");
export function detectMime(bytes: Uint8Array): string {
  const b = Buffer.from(bytes),
    start = b.subarray(0, 12).toString("latin1");
  if (start.startsWith("RIFF") && start.slice(8) === "WAVE") return "audio/wav";
  if (start.startsWith("fLaC")) return "audio/flac";
  if (start.startsWith("OggS")) return "audio/ogg";
  if (start.slice(4, 8) === "ftyp") return "audio/mp4";
  if (b[0] === 0x1a && b[1] === 0x45 && b[2] === 0xdf && b[3] === 0xa3)
    return "audio/webm";
  if (start.startsWith("ID3") || (b[0] === 0xff && (b[1] & 0xe0) === 0xe0))
    return "audio/mpeg";
  throw new Error("文件不是支持的音频容器。");
}
export function createAudioFiles(path: Resolver) {
  const read = async (id: string) =>
    readFile(await path(`${audioId(id)}.audio`));
  return {
    read,
    async chunk(id: string, index: number, raw: unknown) {
      audioId(id);
      if (
        !Number.isInteger(index) ||
        index < 0 ||
        index >= Math.ceil(MAX_AUDIO_BYTES / CHUNK_BYTES) ||
        typeof raw !== "string" ||
        raw.length > Math.ceil(CHUNK_BYTES / 3) * 4
      )
        throw new Error("音频分块无效。");
      const bytes = Buffer.from(raw, "base64");
      if (
        !bytes.length ||
        bytes.length > CHUNK_BYTES ||
        bytes.toString("base64") !== raw
      )
        throw new Error("音频分块编码无效。");
      await writeFile(await path(`${id}.${index}.part`, true), bytes);
      return { ok: true };
    },
    async finish(input: unknown) {
      const source = audioSource(input),
        parts: Buffer[] = [];
      for (let i = 0; i < Math.ceil(source.bytes / CHUNK_BYTES); i++) {
        const part = await readFile(await path(`${source.id}.${i}.part`));
        if (
          part.length !== Math.min(CHUNK_BYTES, source.bytes - i * CHUNK_BYTES)
        )
          throw new Error("音频尚未完整上传，请重试。");
        parts.push(part);
      }
      const bytes = Buffer.concat(parts);
      if (digest(bytes) !== source.id || detectMime(bytes) !== source.mime)
        throw new Error("音频内容校验失败。");
      const temp = await path(`${source.id}.${randomUUID()}.tmp`, true);
      try {
        await writeFile(temp, bytes, { flag: "wx" });
        await rename(temp, await path(`${source.id}.audio`, true));
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
    async verify(source: AudioSource | null) {
      if (!source) return;
      const info = await stat(await path(`${audioId(source.id)}.audio`));
      if (info.size !== source.bytes)
        throw new Error("原音频缺失，请重新上传音频或导入含音频的项目。");
    },
  };
}
