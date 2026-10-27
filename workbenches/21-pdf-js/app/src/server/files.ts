import { createHash, randomUUID } from "node:crypto";
import { readFile, writeFile, unlink, stat, rename } from "node:fs/promises";
import {
  checkPdfBytes,
  CHUNK_BYTES,
  MAX_PDF_BYTES,
  type PdfSource,
} from "../contracts/pdf.ts";
export const pdfId = (id: string) => {
  if (!/^[a-f0-9]{64}$/.test(id)) throw new Error("文件标识无效。");
  return id;
};
export const digest = (bytes: Uint8Array) =>
  createHash("sha256").update(bytes).digest("hex");
type PathResolver = (relative: string, write?: boolean) => Promise<string>;
export function createPdfFiles(path: PathResolver) {
  const read = async (id: string) =>
    new Uint8Array(await readFile(await path(`${pdfId(id)}.pdf`)));
  return {
    read,
    async chunk(id: string, index: number, base64: unknown) {
      pdfId(id);
      if (
        !Number.isInteger(index) ||
        index < 0 ||
        index >= MAX_PDF_BYTES / CHUNK_BYTES ||
        typeof base64 !== "string" ||
        base64.length > Math.ceil(CHUNK_BYTES / 3) * 4 ||
        !/^[A-Za-z0-9+/]*={0,2}$/.test(base64)
      )
        throw new Error("文件分块无效。");
      const bytes = Buffer.from(base64, "base64");
      if (
        !bytes.length ||
        bytes.length > CHUNK_BYTES ||
        bytes.toString("base64") !== base64
      )
        throw new Error("文件分块编码无效。");
      await writeFile(await path(`${id}.${index}.part`, true), bytes);
      return { ok: true };
    },
    async finish(source: PdfSource) {
      const blocks = Math.ceil(source.bytes / CHUNK_BYTES),
        chunks: Uint8Array[] = [];
      for (let index = 0; index < blocks; index++) {
        const chunk = await readFile(
          await path(`${pdfId(source.id)}.${index}.part`),
        );
        if (
          chunk.length !==
          Math.min(CHUNK_BYTES, source.bytes - index * CHUNK_BYTES)
        )
          throw new Error("文件分块不完整，请重新导入。");
        chunks.push(chunk);
      }
      const bytes = Buffer.concat(chunks);
      checkPdfBytes(bytes);
      if (digest(bytes) !== source.id)
        throw new Error("文件校验失败，请重新导入。");
      let existing = false;
      try {
        const original = await read(source.id);
        existing =
          original.length === bytes.length && digest(original) === source.id;
      } catch {}
      if (!existing) {
        const temporary = await path(`${source.id}.${randomUUID()}.tmp`, true);
        try {
          await writeFile(temporary, bytes, { flag: "wx" });
          await rename(temporary, await path(`${source.id}.pdf`, true));
        } finally {
          await unlink(temporary).catch(() => {});
        }
      }
      await Promise.all(
        chunks.map((_, index) =>
          path(`${source.id}.${index}.part`, true).then((p) =>
            unlink(p).catch(() => {}),
          ),
        ),
      );
      return source;
    },
    async verify(source: PdfSource | null) {
      if (!source) return;
      const info = await stat(await path(`${pdfId(source.id)}.pdf`));
      if (info.size !== source.bytes)
        throw new Error("PDF 原文件缺失，请重新导入便携项目。");
    },
  };
}
