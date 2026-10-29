// ABOUTME: 页面侧转换流程：原文件入库→本地解析（PDF 用 pdf.js 版面分析）→结构文档入库；导入 JSON/校对包与导出校对包。
import { strFromU8, strToU8, unzipSync, zipSync } from "fflate";
import { isRecord } from "../contracts/project.ts";
import { parseDocument, type Document } from "../contracts/docling.ts";
import {
  assertMatches,
  empty,
  restoreReviewDraft,
  summary,
  type DocumentRef,
  type Review,
  type SourceRef,
} from "../contracts/review.ts";
import { convertLocal, ENGINES, formatOf, type Conversion } from "../contracts/convert/index.ts";
import { readPdf } from "../contracts/convert/pdf-extract.ts";
import { layoutPdf } from "../contracts/convert/pdf-layout.ts";
import { MAX_SOURCE, rememberDocument, rememberSource, upload } from "./library.ts";
import { openPdf, pdfError, PDF_OPS } from "./pdf.ts";
export type Progress = (text: string) => void;
export const LOCAL_FORMATS = ".pdf,.docx,.docm,.dotx,.html,.htm,.xhtml,.md,.markdown,.txt";
export async function storeSource(file: File | { name: string; bytes: Uint8Array }, progress: Progress): Promise<{ ref: SourceRef; bytes: Uint8Array }> {
  const bytes = file instanceof Blob ? new Uint8Array(await file.arrayBuffer()) : file.bytes;
  if (!bytes.length) throw new Error("文件是空的。");
  if (bytes.length > MAX_SOURCE) throw new Error("原文件需在 64 MB 以内。");
  const id = await upload("source", bytes, file.name, (f) => progress(`正在保存原文件 ${Math.round(f * 100)}%…`));
  rememberSource(id, bytes);
  return { ref: { id, name: file.name.slice(0, 300), format: formatOf(file.name), bytes: bytes.length }, bytes };
}
export async function storeDocument(doc: Document, engine: string, source: SourceRef | null, progress: Progress): Promise<DocumentRef> {
  const json = new TextEncoder().encode(JSON.stringify(doc));
  const id = await upload("docling", json, doc.name + ".docling.json", (f) => progress(`正在保存结构文档 ${Math.round(f * 100)}%…`));
  rememberDocument(id, doc);
  return summary(doc, id, json.length, engine, source);
}
/** Runs the in-page fallback converter; no external process is involved. */
export async function convertLocally(source: SourceRef, bytes: Uint8Array, progress: Progress): Promise<Conversion> {
  if (source.format === "pdf") {
    progress("正在打开 PDF…");
    const task = openPdf(bytes);
    try {
      let pdf;
      try {
        pdf = await task.promise;
      } catch (e) {
        throw pdfError(e);
      }
      const { pages, rotated } = await readPdf(pdf as never, PDF_OPS, (done, total) => progress(`正在读取第 ${done}/${total} 页的文字与版面…`));
      const result = layoutPdf(pages, source.name, bytes);
      if (rotated) result.warnings.push(`${rotated} 页带旋转，竖排或旋转文字未纳入本地解析。`);
      return result;
    } finally {
      void task.destroy();
    }
  }
  if (source.format === "docx" || source.format === "html" || source.format === "md") {
    progress("正在解析结构…");
    // Yield once so the progress text paints before a synchronous parse.
    await new Promise((r) => setTimeout(r, 0));
    return convertLocal(source.format, bytes, source.name);
  }
  throw new Error("本地解析支持 PDF、Word（.docx）、HTML 与 Markdown。其他格式请使用 Docling Serve。");
}
export function reviewFor(doc: DocumentRef, label: string): Review {
  return { ...empty, document: doc, source: label };
}
export interface Imported {
  review: Review;
  title: string;
  extra?: Record<string, unknown>;
}
/** DoclingDocument JSON, a portable review (.review.json, with embedded original) or a recovery working copy. */
export async function importJson(text: string, name: string, progress: Progress): Promise<Imported> {
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    throw new Error("不是有效的 JSON。可在“粘贴 JSON”中修正后再导入。");
  }
  const snapshot = isRecord(value) && isRecord(value.snapshot) ? value.snapshot : null;
  if (snapshot) {
    const review = restoreReviewDraft(snapshot.data);
    return {
      review: await settleLegacy(review, progress),
      title: typeof snapshot.title === "string" && snapshot.title.trim() ? snapshot.title : "恢复的工作副本",
      extra: isRecord(snapshot.extra) ? snapshot.extra : {},
    };
  }
  if (isRecord(value) && value.format === "docling-review") {
    const review = restoreReviewDraft(value);
    return { review: await settleLegacy(review, progress), title: review.document?.name || review.original?.name || name };
  }
  const doc = parseDocument(value, text.length);
  const ref = await storeDocument(doc, "导入 DoclingDocument JSON", null, progress);
  return { review: reviewFor(ref, "导入 · " + name), title: doc.name || name };
}
/** Moves an embedded 0.4 document into storage so the project only references it. */
export async function settleLegacy(review: Review, progress: Progress): Promise<Review> {
  if (!review.original) return review;
  const { original, ...rest } = review;
  const ref = review.document?.id
    ? review.document
    : await storeDocument(original, "导入 DoclingDocument JSON", null, progress);
  return { ...rest, document: ref };
}
const PACKAGE_VERSION = 1;
export function exportPackage(review: Review, doc: Document, source: { name: string; bytes: Uint8Array } | null): Blob {
  const { original: _legacy, ...plain } = review;
  const files: Record<string, Uint8Array> = {
    "manifest.json": strToU8(JSON.stringify({ format: "floatboat-docling-review-package", version: PACKAGE_VERSION, created: new Date().toISOString() })),
    "review.json": strToU8(JSON.stringify(plain, null, 1)),
    "document.docling.json": strToU8(JSON.stringify(doc)),
  };
  if (source) files["source/" + source.name.replace(/[\\/:*?"<>|]/g, "_")] = source.bytes;
  const zipped = zipSync(files, { level: 6 });
  return new Blob([new Uint8Array(zipped)], { type: "application/zip" });
}
export async function importPackage(bytes: Uint8Array, progress: Progress): Promise<Imported> {
  let files: Record<string, Uint8Array>;
  try {
    files = unzipSync(bytes);
  } catch {
    throw new Error("校对包无法解压。");
  }
  const manifest = files["manifest.json"] ? JSON.parse(strFromU8(files["manifest.json"])) : null;
  if (!isRecord(manifest) || manifest.format !== "floatboat-docling-review-package" || !files["review.json"] || !files["document.docling.json"])
    throw new Error("这不是 Docling 工作台导出的校对包。");
  const review = restoreReviewDraft(JSON.parse(strFromU8(files["review.json"])));
  const doc = parseDocument(JSON.parse(strFromU8(files["document.docling.json"])));
  assertMatches(review, doc);
  const sourceName = Object.keys(files).find((k) => k.startsWith("source/") && files[k]!.length);
  const source = sourceName
    ? (await storeSource({ name: sourceName.slice(7), bytes: files[sourceName]! }, progress)).ref
    : null;
  const ref = await storeDocument(doc, review.document?.engine || "导入校对包", source, progress);
  return { review: { ...review, document: ref }, title: review.document?.name || doc.name };
}
export const ENGINE_LABELS = ENGINES;
