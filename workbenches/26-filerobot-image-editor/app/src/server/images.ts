import { createHash, randomUUID } from "node:crypto";
import { readFile, writeFile, rename, unlink } from "node:fs/promises";
import type { WorkbenchServer } from "../../sdk/runtime.mjs";
import {
  dimensions,
  MAX_IMAGE_BYTES,
  sourceValue,
  type Source,
} from "../contracts/editor.ts";
import { isRecord } from "../contracts/project.ts";
export function inspectImage(bytes: Buffer): {
  width: number;
  height: number;
  mime: Source["mime"];
} {
  if (bytes.length < 24 || bytes.length > MAX_IMAGE_BYTES)
    throw new Error("原图需小于 1 MB，支持 PNG 和 JPEG。");
  let width = 0,
    height = 0,
    mime: Source["mime"];
  if (
    bytes
      .subarray(0, 8)
      .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) &&
    bytes.toString("ascii", 12, 16) === "IHDR"
  ) {
    width = bytes.readUInt32BE(16);
    height = bytes.readUInt32BE(20);
    mime = "image/png";
  } else if (bytes[0] === 255 && bytes[1] === 216) {
    mime = "image/jpeg";
    let i = 2;
    while (i + 8 < bytes.length) {
      if (bytes[i] !== 255) throw new Error("JPEG 文件损坏。");
      const marker = bytes[i + 1];
      i += 2;
      if (marker === 216 || marker === 1) continue;
      if (marker === 218 || marker === 217) break;
      const length = bytes.readUInt16BE(i);
      if (length < 2 || i + length > bytes.length)
        throw new Error("JPEG 文件损坏。");
      if (
        [
          192, 193, 194, 195, 197, 198, 199, 201, 202, 203, 205, 206, 207,
        ].includes(marker)
      ) {
        height = bytes.readUInt16BE(i + 3);
        width = bytes.readUInt16BE(i + 5);
        break;
      }
      i += length;
    }
  } else throw new Error("请使用 PNG 或 JPEG 原图，不支持 SVG 和远程链接。");
  dimensions(width, height);
  return { width, height, mime };
}
export function imageBytes(raw: unknown): Buffer {
  if (
    typeof raw !== "string" ||
    raw.length > 1_333_336 ||
    !/^[A-Za-z0-9+/]+={0,2}$/.test(raw)
  )
    throw new Error("图片编码无效。");
  const bytes = Buffer.from(raw, "base64");
  if (bytes.toString("base64") !== raw) throw new Error("图片编码无效。");
  inspectImage(bytes);
  return bytes;
}
export function imageStore(app: WorkbenchServer) {
  const read = async (id: string) => {
    if (!/^[a-f0-9]{64}$/.test(id)) throw new Error("图片编号无效。");
    return readFile(await app.resources.path("originals", id));
  };
  return {
    read,
    async put(raw: unknown) {
      if (
        !isRecord(raw) ||
        typeof raw.name !== "string" ||
        raw.name.length > 160
      )
        throw new Error("文件名无效。");
      const bytes = imageBytes(raw.base64),
        info = inspectImage(bytes),
        id = createHash("sha256").update(bytes).digest("hex");
      const path = await app.resources.path("originals", id, "write");
      let exists = false;
      try {
        const previous = await readFile(path);
        exists =
          previous.length === bytes.length &&
          createHash("sha256").update(previous).digest("hex") === id;
      } catch (error) {
        if (
          !(
            error instanceof Error &&
            "code" in error &&
            error.code === "ENOENT"
          )
        )
          throw error;
      }
      if (!exists) {
        const temp = await app.resources.path(
          "originals",
          id + "." + randomUUID() + ".tmp",
          "write",
        );
        try {
          await writeFile(temp, bytes, { flag: "wx" });
          await rename(temp, path);
        } finally {
          await unlink(temp).catch(() => {});
        }
      }
      return sourceValue({ id, name: raw.name, ...info, bytes: bytes.length });
    },
    async verify(source: Source | null) {
      if (!source) return;
      const bytes = await read(source.id),
        info = inspectImage(bytes);
      if (
        createHash("sha256").update(bytes).digest("hex") !== source.id ||
        source.bytes !== bytes.length ||
        info.width !== source.width ||
        info.height !== source.height ||
        info.mime !== source.mime
      )
        throw new Error("原图与工程不一致，请重新导入原图。");
    },
  };
}
