// ABOUTME: 浏览器端文件读取：种子资料（TXT/MD/HTML/CSV/JSON/PDF，含 GB18030）、原生结果分片上传与下载。
import { request } from "./requests";
import { chunksOf } from "../contracts/chunks";
import { isRecord } from "../contracts/project";
import { LIMITS, type RunSummary } from "../contracts/scenario";

export const SEED_MAX_FILE = 60 * 1024 * 1024;
const TEXT_TYPES = /\.(txt|md|markdown|csv|tsv|json|jsonl|html?|xml|log)$/i;

/** UTF-8 first; fall back to GB18030 when the bytes are not valid UTF-8 (common for Chinese exports). */
export function decodeText(bytes: Uint8Array) {
  if (bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) return new TextDecoder("utf-8").decode(bytes.subarray(3));
  if (bytes[0] === 0xff && bytes[1] === 0xfe) return new TextDecoder("utf-16le").decode(bytes.subarray(2));
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    return new TextDecoder("gb18030").decode(bytes);
  }
}
export function htmlToText(html: string) {
  const doc = new DOMParser().parseFromString(html, "text/html");
  doc.querySelectorAll("script,style,noscript,template").forEach((n) => n.remove());
  doc.querySelectorAll("p,div,li,h1,h2,h3,h4,h5,h6,tr,br,section,article").forEach((n) => n.append("\n"));
  return (doc.body?.textContent ?? "").replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
}
async function pdfToText(bytes: Uint8Array, onProgress?: (page: number, total: number) => void) {
  const { getDocument, GlobalWorkerOptions } = await import("pdfjs-dist");
  const worker = await import("pdfjs-dist/build/pdf.worker.min.mjs?url");
  GlobalWorkerOptions.workerSrc = worker.default;
  const task = getDocument({ data: bytes.slice(), cMapUrl: "/api/pdfjs/cmaps/", cMapPacked: true, useWasm: false, enableXfa: false, verbosity: 0 });
  try {
    const pdf = await task.promise;
    const pages: string[] = [];
    let chars = 0;
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      let line = "";
      const lines: string[] = [];
      for (const item of content.items as Array<{ str?: string; hasEOL?: boolean }>) {
        line += item.str ?? "";
        if (item.hasEOL) {
          lines.push(line);
          line = "";
        }
      }
      if (line) lines.push(line);
      const text = lines.join("\n");
      chars += text.length + (i > 1 ? 2 : 0);
      if (chars > LIMITS.seedChars) throw new Error(`PDF 文字超过 ${LIMITS.seedChars.toLocaleString()} 字，请摘取与推演问题相关的章节后再导入；未导入截断内容。`);
      pages.push(text);
      onProgress?.(i, pdf.numPages);
    }
    return pages.join("\n\n");
  } catch (e) {
    const name = e instanceof Error ? e.name : "";
    if (name === "PasswordException") throw new Error("PDF 有打开密码，请先解除密码再导入。");
    if (name === "InvalidPDFException") throw new Error("PDF 文件损坏或格式无效。");
    throw e instanceof Error ? e : new Error("PDF 无法读取");
  } finally {
    await task.destroy();
  }
}
export async function readSeedFile(file: File, onProgress?: (page: number, total: number) => void) {
  if (file.size > SEED_MAX_FILE) throw new Error(`“${file.name}”超过60MB`);
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (/\.pdf$/i.test(file.name) || file.type === "application/pdf") {
    const text = await pdfToText(bytes, onProgress);
    if (!text.trim()) throw new Error(`“${file.name}”没有可提取的文字（可能是扫描件），请先做 OCR。`);
    return text;
  }
  if (!TEXT_TYPES.test(file.name) && file.type && !file.type.startsWith("text/"))
    throw new Error(`“${file.name}”不是可读取的文本或 PDF（支持 TXT、MD、HTML、CSV、JSON、PDF）。`);
  const text = decodeText(bytes);
  return /\.html?$/i.test(file.name) ? htmlToText(text) : text;
}

export type UploadResult = {
  resultId: string;
  fingerprint: string;
  summary: RunSummary;
  simulationId: string;
  ignoredEvents: number;
  sourceName: string;
};
export async function uploadNative(text: string, name: string, platform: string, onProgress?: (done: number, total: number) => void): Promise<UploadResult> {
  const parts = chunksOf(text);
  const id = crypto.randomUUID();
  const begun = await request("/api/uploads", { method: "POST", body: JSON.stringify({ id, name, platform, chunks: parts.length }) });
  const received = new Set(isRecord(begun) && Array.isArray(begun.received) ? (begun.received as number[]) : []);
  for (let i = 0; i < parts.length; i++) {
    if (!received.has(i)) {
      // One retry per chunk: a lost response is harmless because chunks are keyed by (upload, seq).
      try {
        await request(`/api/uploads/${id}/chunks/${i}`, { method: "POST", body: JSON.stringify({ text: parts[i] }) });
      } catch {
        await request(`/api/uploads/${id}/chunks/${i}`, { method: "POST", body: JSON.stringify({ text: parts[i] }) });
      }
    }
    onProgress?.(i + 1, parts.length);
  }
  const result = await request(`/api/uploads/${id}/commit`, { method: "POST", body: "{}" });
  if (!isRecord(result) || typeof result.resultId !== "string" || !isRecord(result.summary)) throw new Error("导入回执无效");
  return result as unknown as UploadResult;
}
