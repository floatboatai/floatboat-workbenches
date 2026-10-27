import { isRecord, boundedText, titleValue } from "./project.ts";
export const MAX_PDF_BYTES = 12 * 1024 * 1024;
export const MAX_PAGES = 200;
export const CHUNK_BYTES = 256 * 1024;
export interface PdfSource {
  id: string;
  name: string;
  bytes: number;
  pages: number;
}
export interface PdfProject {
  source: PdfSource | null;
  page: number;
  zoom: number;
  notes: Record<string, string>;
}
export const seed: PdfProject = { source: null, page: 1, zoom: 0, notes: {} };
export function sourceValue(raw: unknown): PdfSource {
  if (
    !isRecord(raw) ||
    typeof raw.id !== "string" ||
    !/^[a-f0-9]{64}$/.test(raw.id) ||
    typeof raw.name !== "string" ||
    !raw.name.trim() ||
    raw.name.length > 180 ||
    typeof raw.bytes !== "number" ||
    !Number.isInteger(raw.bytes) ||
    raw.bytes < 8 ||
    raw.bytes > MAX_PDF_BYTES ||
    typeof raw.pages !== "number" ||
    !Number.isInteger(raw.pages) ||
    raw.pages < 1 ||
    raw.pages > MAX_PAGES
  )
    throw new Error("PDF 资源信息无效（最多 12 MB、200 页）。");
  return { id: raw.id, name: raw.name, bytes: raw.bytes, pages: raw.pages };
}
export function validateProject(raw: unknown): PdfProject {
  if (!isRecord(raw) || !isRecord(raw.notes))
    throw new Error("阅读项目格式无效。");
  const source = raw.source === null ? null : sourceValue(raw.source);
  if (
    typeof raw.page !== "number" ||
    !Number.isInteger(raw.page) ||
    raw.page < 1 ||
    raw.page > (source?.pages ?? 1) ||
    typeof raw.zoom !== "number" ||
    ![0, 0.5, 0.75, 1, 1.25, 1.5, 2].includes(raw.zoom)
  )
    throw new Error("页码或缩放比例无效。");
  const notes: Record<string, string> = {};
  let length = 0;
  for (const [page, note] of Object.entries(raw.notes)) {
    if (!/^[1-9][0-9]{0,2}$/.test(page) || Number(page) > (source?.pages ?? 0))
      throw new Error("笔记页码超出文档。");
    const text = boundedText(note, 12000);
    length += text.length;
    if (length > 120000) throw new Error("笔记总长度不能超过 120000 字。");
    notes[page] = text;
  }
  return { source, page: raw.page, zoom: raw.zoom, notes };
}
export function checkPdfBytes(bytes: Uint8Array): void {
  if (
    bytes.length < 8 ||
    bytes.length > MAX_PDF_BYTES ||
    new TextDecoder().decode(bytes.subarray(0, 5)) !== "%PDF-"
  )
    throw new Error("请选择有效 PDF，文件不能超过 12 MB。");
}
const MAGIC = new TextEncoder().encode("PDFREVIEW1\n");
export function encodePortable(
  title: string,
  data: PdfProject,
  pdf: Uint8Array,
): Uint8Array {
  const model = validateProject(data);
  checkPdfBytes(pdf);
  if (!model.source || pdf.length !== model.source.bytes)
    throw new Error("PDF 原文件大小不匹配。");
  const header = new TextEncoder().encode(
    JSON.stringify({
      format: "pdf-review",
      version: 1,
      title: titleValue(title),
      data: model,
    }),
  );
  const result = new Uint8Array(MAGIC.length + 4 + header.length + pdf.length);
  result.set(MAGIC);
  new DataView(result.buffer).setUint32(MAGIC.length, header.length);
  result.set(header, MAGIC.length + 4);
  result.set(pdf, MAGIC.length + 4 + header.length);
  return result;
}
export function decodePortable(bytes: Uint8Array): {
  title: string;
  data: PdfProject;
  pdf: Uint8Array;
} {
  if (
    bytes.length > MAX_PDF_BYTES + 600000 ||
    bytes.length < MAGIC.length + 4 ||
    !MAGIC.every((byte, i) => bytes[i] === byte)
  )
    throw new Error("请选择此工作台导出的 .pdfreview 项目。");
  const size = new DataView(
    bytes.buffer,
    bytes.byteOffset,
    bytes.byteLength,
  ).getUint32(MAGIC.length);
  if (size > 600000 || size < 2 || size > bytes.length - MAGIC.length - 4)
    throw new Error("便携项目头部损坏。");
  const raw: unknown = JSON.parse(
    new TextDecoder("utf-8", { fatal: true }).decode(
      bytes.subarray(MAGIC.length + 4, MAGIC.length + 4 + size),
    ),
  );
  if (
    !isRecord(raw) ||
    raw.format !== "pdf-review" ||
    raw.version !== 1 ||
    typeof raw.title !== "string" ||
    !raw.title.trim() ||
    raw.title.length > 120
  )
    throw new Error("便携项目格式无效。");
  const data = validateProject(raw.data),
    pdf = bytes.slice(MAGIC.length + 4 + size);
  checkPdfBytes(pdf);
  if (!data.source || data.source.bytes !== pdf.length)
    throw new Error("便携项目的 PDF 大小不匹配。");
  return { title: raw.title, data, pdf };
}
export function findPages(
  texts: string[],
  query: string,
): { page: number; excerpt: string; count: number }[] {
  const needle = query.trim().toLocaleLowerCase();
  if (!needle) return [];
  return texts.flatMap((text, index) => {
    const lower = text.toLocaleLowerCase();
    let start = lower.indexOf(needle);
    if (start < 0) return [];
    const first = start;
    let count = 0;
    while (start >= 0) {
      count++;
      start = lower.indexOf(needle, start + needle.length);
    }
    return [
      {
        page: index + 1,
        excerpt: text.slice(
          Math.max(0, first - 30),
          first + needle.length + 70,
        ),
        count,
      },
    ];
  });
}
