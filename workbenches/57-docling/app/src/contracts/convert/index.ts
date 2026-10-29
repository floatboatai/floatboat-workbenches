// ABOUTME: 本地后备解析入口：按格式选择 Word/HTML/Markdown 解析器（PDF 由页面侧 pdf.js 读取后交给版面分析）。
import { convertDocx } from "./docx.ts";
import { convertHtml } from "./html.ts";
import { convertMarkdown } from "./markdown.ts";
import type { Conversion } from "./segments.ts";
import type { SourceFormat } from "../review.ts";
export const ENGINES: Record<Exclude<SourceFormat, "json" | "other">, string> = {
  pdf: "本地解析 · pdf.js 6.4.299 版面分析",
  docx: "本地解析 · Word OOXML",
  html: "本地解析 · parse5 7.3.0",
  md: "本地解析 · marked 16.4.2",
};
export function formatOf(name: string): SourceFormat {
  const ext = /\.([A-Za-z0-9]+)$/.exec(name)?.[1]?.toLowerCase() ?? "";
  if (ext === "pdf") return "pdf";
  if (ext === "docx" || ext === "docm" || ext === "dotx") return "docx";
  if (ext === "html" || ext === "htm" || ext === "xhtml") return "html";
  if (ext === "md" || ext === "markdown" || ext === "mdown" || ext === "txt") return "md";
  if (ext === "json") return "json";
  return "other";
}
/** Decodes text sources: BOM-aware UTF-8, falling back to GB18030 for legacy Chinese files. */
export function decodeText(bytes: Uint8Array): string {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    return new TextDecoder("gb18030").decode(bytes);
  }
}
export function convertLocal(format: SourceFormat, bytes: Uint8Array, filename: string): Conversion {
  if (format === "docx") return convertDocx(bytes, filename);
  if (format === "html") return convertHtml(decodeText(bytes), filename, bytes);
  if (format === "md") return convertMarkdown(decodeText(bytes), filename, bytes);
  throw new Error("此格式需要 PDF 读取或 Docling Serve。");
}
export { alignSegments, type Conversion, type Segment } from "./segments.ts";
