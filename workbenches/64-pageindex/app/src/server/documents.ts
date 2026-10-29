// ABOUTME: 原PDF分块上传、浏览器提取原文的校验入库、原件校验与示例；附带已存PageIndex章节树。
import { createHash, randomUUID } from "node:crypto";
import { readFile, writeFile, rename, unlink, stat } from "node:fs/promises";
import type { WorkbenchServer } from "../../sdk/runtime.mjs";
import { isRecord, boundedText } from "../contracts/project.ts";
import { StoreError } from "./store.ts";
import {
  identifier,
  integer,
  indexValue,
  CHUNK,
  MAX_PDF,
  MAX_EXTRACTION_BYTES,
  type DocumentIndex,
  type DocumentRef,
  type OutlineTree,
} from "../contracts/reader.ts";
export const digest = (value: Uint8Array) =>
  createHash("sha256").update(value).digest("hex");
export const SAMPLES: Record<string, { file: string; name: string }> = {
  report: {
    file: "library-report.pdf",
    name: "Riverside Library 2025 Annual Report.pdf",
  },
  handbook: { file: "handbook.pdf", name: "Harbor Workshop Handbook.pdf" },
};
export function createDocuments(app: WorkbenchServer) {
  const db = app.database,
    path = (name: string, write = false) =>
      app.resources.path("documents", name, write ? "write" : undefined);
  const pending = new Map<string, Promise<DocumentIndex>>(),
    verified = new Map<string, string>();
  function outlines(id: string): OutlineTree[] {
    return db
      .prepare(
        "SELECT payload FROM reader_outlines WHERE document_id=? ORDER BY source",
      )
      .all(id)
      .map((row) => JSON.parse(String(row.payload)) as OutlineTree);
  }
  function get(id: string): DocumentIndex {
    const row = db
      .prepare("SELECT payload FROM reader_documents WHERE id=?")
      .get(identifier(id));
    if (!row) throw new StoreError(404, "文档尚未入库，请重新打开原PDF。");
    const value = indexValue(JSON.parse(String(row.payload)));
    const trees = outlines(id);
    return trees.length
      ? indexValue({ ...value, outlines: trees })
      : value;
  }
  const exists = (id: string) =>
    !!db.prepare("SELECT id FROM reader_documents WHERE id=?").get(id);
  const read = async (id: string) => {
    const file = await path(`${identifier(id)}.pdf`);
    try {
      return await readFile(file);
    } catch {
      throw new StoreError(404, "原PDF不在当前工作台，请补齐原PDF。");
    }
  };
  async function assemble(prefix: string, bytes: number) {
    const parts: Buffer[] = [];
    for (let i = 0; i < Math.ceil(bytes / CHUNK); i++) {
      let part: Buffer;
      try {
        part = await readFile(await path(`${prefix}.${i}.part`));
      } catch {
        throw new Error("文件尚未完整上传，请重新打开。");
      }
      if (part.length !== Math.min(CHUNK, bytes - i * CHUNK))
        throw new Error("文件尚未完整上传，请重新打开。");
      parts.push(part);
    }
    return { bytes: Buffer.concat(parts), count: parts.length };
  }
  async function discard(prefix: string, count: number) {
    await Promise.all(
      Array.from({ length: count }, (_, i) =>
        path(`${prefix}.${i}.part`, true).then((p) => unlink(p).catch(() => {})),
      ),
    );
  }
  async function original(id: string) {
    try {
      await stat(await path(`${id}.pdf`));
      return true;
    } catch {
      return false;
    }
  }
  async function writeOriginal(id: string, pdf: Uint8Array) {
    const temp = await path(`${id}.${randomUUID()}.tmp`, true);
    try {
      await writeFile(temp, pdf, { flag: "wx" });
      await rename(temp, await path(`${id}.pdf`, true));
    } finally {
      await unlink(temp).catch(() => {});
    }
  }
  async function store(id: string, name: string, pdf: Uint8Array, raw: unknown) {
    if (
      digest(pdf) !== id ||
      !Buffer.from(pdf).subarray(0, 1024).includes(Buffer.from("%PDF-"))
    )
      throw new Error("PDF内容校验失败。");
    if (!isRecord(raw) || !isRecord(raw.index) || !Array.isArray(raw.pages))
      throw new Error("原文提取结果无效。");
    const value = indexValue({
      source: { id, name, bytes: pdf.length, pages: raw.pages.length },
      engineVersion: raw.engineVersion,
      index: { ...raw.index, doc_name: name },
      pages: raw.pages,
    });
    await writeOriginal(id, pdf);
    db.prepare(
      "INSERT OR IGNORE INTO reader_documents(id,payload,created_at) VALUES(?,?,?)",
    ).run(id, JSON.stringify(value), new Date().toISOString());
    return get(id);
  }
  async function verify(ref: DocumentRef | null) {
    if (!ref) return;
    const row = db
      .prepare("SELECT payload FROM reader_documents WHERE id=?")
      .get(identifier(ref.id));
    // A plain error keeps the working copy as a draft (not a version conflict) until the PDF is restored.
    if (!row) throw new Error("项目原文件缺失，请补齐原PDF或导入完整阅读档案。");
    const stored = indexValue(JSON.parse(String(row.payload)));
    if (stored.source.bytes !== ref.bytes || stored.source.pages !== ref.pages)
      throw new Error("项目原文件缺失或不匹配，请导入完整项目。");
    const file = await path(`${ref.id}.pdf`);
    let mark: string;
    try {
      const info = await stat(file);
      mark = `${info.size}:${info.mtimeMs}`;
    } catch {
      throw new Error("项目原文件缺失或不匹配，请导入完整项目。");
    }
    if (verified.get(ref.id) === mark) return;
    if (digest(await readFile(file)) !== ref.id)
      throw new Error("项目原文件缺失或不匹配，请导入完整项目。");
    verified.set(ref.id, mark);
  }
  return {
    get,
    read,
    verify,
    /** Whether this PDF and its original file are already in the workbench (no 404 probing). */
    async stored(id: string) {
      if (!exists(identifier(id))) return { stored: false, original: false };
      return { stored: true, original: await original(id) };
    },
    async chunk(kind: "pdf" | "text", id: string, index: number, raw: unknown) {
      identifier(id);
      integer(
        index,
        0,
        Math.ceil((kind === "pdf" ? MAX_PDF : MAX_EXTRACTION_BYTES) / CHUNK) - 1,
      );
      if (typeof raw !== "string" || raw.length > Math.ceil(CHUNK / 3) * 4)
        throw new Error("分块超过容量。");
      const bytes = Buffer.from(raw, "base64");
      if (!bytes.length || bytes.length > CHUNK || bytes.toString("base64") !== raw)
        throw new Error("分块编码无效。");
      if (!exists(id) || (kind === "pdf" && !(await original(id))))
        await writeFile(
          await path(`${id}${kind === "text" ? ".text" : ""}.${index}.part`, true),
          bytes,
        );
      return { ok: true };
    },
    async finish(id: string, input: unknown) {
      identifier(id);
      if (!isRecord(input)) throw new Error("文件信息无效。");
      const bytes = integer(input.bytes, 1, MAX_PDF),
        textBytes = integer(input.textBytes, 2, MAX_EXTRACTION_BYTES),
        textHash = boundedText(input.textSha256, 64),
        name = boundedText(input.name, 180).trim() || "document.pdf";
      if (exists(id)) {
        const known = get(id);
        if (known.source.bytes !== bytes) throw new Error("已存文档与上传信息不一致。");
        if (!(await original(id))) {
          // The text index survived but the original file did not: restore only the PDF.
          const pdf = await assemble(id, bytes);
          if (digest(pdf.bytes) !== id) throw new Error("PDF内容校验失败。");
          await writeOriginal(id, pdf.bytes);
          await discard(id, pdf.count);
        }
        await verify(known.source);
        return known;
      }
      if (pending.has(id)) return pending.get(id)!;
      const task = (async () => {
        const pdf = await assemble(id, bytes),
          text = await assemble(`${id}.text`, textBytes);
        if (digest(text.bytes) !== textHash)
          throw new Error("原文提取结果上传不完整，请重新打开。");
        let raw: unknown;
        try {
          raw = JSON.parse(new TextDecoder().decode(text.bytes));
        } catch {
          throw new Error("原文提取结果无效。");
        }
        const result = await store(id, name, pdf.bytes, raw);
        await discard(id, pdf.count);
        await discard(`${id}.text`, text.count);
        return result;
      })();
      pending.set(id, task);
      try {
        return await task;
      } finally {
        pending.delete(id);
      }
    },
    async sample(key: string) {
      const sample = SAMPLES[key];
      if (!sample) throw new Error("没有这个示例文档。");
      return {
        name: sample.name,
        bytes: await readFile(await app.resources.path("samples", sample.file)),
      };
    },
  };
}
