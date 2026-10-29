// ABOUTME: 原PDF与提取原文的分块上传；已入库文档直接复用，不重复提取。
import type { PDFDocumentLoadingTask } from "pdfjs-dist";
import { getPageConnection } from "./connection.ts";
import { request } from "./requests.ts";
import { isRecord } from "../contracts/project.ts";
import { CHUNK, MAX_PDF, MAX_EXTRACTION_BYTES, indexValue, type DocumentIndex } from "../contracts/reader.ts";
import { extractDocument } from "./extract.ts";
import { openPdf, pdfError } from "./pdf.ts";
export async function blobRequest(path: string): Promise<Blob> {
  const page = await getPageConnection(),
    response = await page.fetch(path);
  if (!response.ok) {
    let message = "原文件暂时不可用，请重试。";
    try {
      const body: unknown = await response.json();
      const error = (body as { error?: { message?: unknown } } | null)?.error;
      if (typeof error?.message === "string") message = error.message;
    } catch {
      /* Non-JSON failures keep the generic message. */
    }
    throw Object.assign(new Error(message), { status: response.status });
  }
  return response.blob();
}
export function toBase64(bytes: Uint8Array) {
  let text = "";
  for (let i = 0; i < bytes.length; i += 8192)
    text += String.fromCharCode(...bytes.subarray(i, i + 8192));
  return btoa(text);
}
export function fromBase64(text: string) {
  if (text.length > Math.ceil(MAX_PDF / 3) * 4) throw new Error("PDF超过64MiB。");
  const raw = atob(text),
    bytes = Uint8Array.from(raw, (c) => c.charCodeAt(0));
  if (toBase64(bytes) !== text) throw new Error("PDF编码无效。");
  return bytes;
}
export async function sha256(bytes: Uint8Array) {
  return Array.from(
    new Uint8Array(await crypto.subtle.digest("SHA-256", new Uint8Array(bytes))),
  )
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
async function chunks(path: string, bytes: Uint8Array, progress: (part: number) => void) {
  const total = Math.ceil(bytes.length / CHUNK);
  for (let i = 0; i < total; i++) {
    progress((i + 1) / total);
    await request(`${path}/${i}`, {
      method: "POST",
      body: JSON.stringify({ data: toBase64(bytes.subarray(i * CHUNK, (i + 1) * CHUNK)) }),
    });
  }
}
export type Opened = { index: DocumentIndex; task: PDFDocumentLoadingTask | null };
/**
 * Reads a PDF in the browser with PDF.js, then stores the original and its page text. A PDF already
 * stored under the same SHA-256 is reused without re-reading.
 */
export async function uploadDocument(
  bytes: Uint8Array,
  name: string,
  progress: (text: string) => void,
): Promise<Opened> {
  if (!bytes.length || bytes.length > MAX_PDF)
    throw new Error("请选择64MiB以内的PDF。");
  progress("正在核对文件…");
  const hash = await sha256(bytes);
  const known = await request(`/api/documents/${hash}/stored`);
  if (isRecord(known) && known.stored === true && known.original === true)
    return { index: indexValue(await request(`/api/documents/${hash}`)), task: null };
  const task = openPdf(bytes);
  try {
    let pdf;
    try {
      pdf = await task.promise;
    } catch (e) {
      throw pdfError(e);
    }
    const extraction = await extractDocument(pdf, (done, total) =>
      progress(`正在读取原文 ${done} / ${total} 页…`),
    );
    const text = new TextEncoder().encode(JSON.stringify(extraction));
    if (text.length > MAX_EXTRACTION_BYTES)
      throw new Error("原文提取结果超过24MiB，请拆分后打开。");
    await chunks(`/api/documents/${hash}/chunks`, bytes, (f) =>
      progress(`正在保存原PDF ${Math.round(f * 100)}%…`),
    );
    await chunks(`/api/documents/${hash}/text`, text, () =>
      progress("正在保存原文与章节…"),
    );
    const index = indexValue(
      await request(`/api/documents/${hash}/finish`, {
        method: "POST",
        body: JSON.stringify({
          bytes: bytes.length,
          name,
          textBytes: text.length,
          textSha256: await sha256(text),
        }),
      }),
    );
    return { index, task };
  } catch (e) {
    await task.destroy();
    throw e;
  }
}
