// ABOUTME: Docling Serve 转换记录与官方转换选项（ConvertDocumentsOptions 子集）的校验和 multipart 字段。
import { isRecord } from "./project.ts";
export const states = [
  "preparing",
  "submitting",
  "uncertain",
  "pending",
  "running",
  "success",
  "failure",
  "paused",
] as const;
export type JobState = (typeof states)[number];
export interface Job {
  id: string;
  filename: string;
  inputHash: string;
  taskId: string | null;
  state: JobState;
  message: string;
  createdAt: string;
  updatedAt: string;
  sourceId: string | null;
  options: ServeOptions | null;
  resultId: string | null;
}
export function jobValue(v: unknown): Job {
  if (
    !isRecord(v) ||
    typeof v.id !== "string" ||
    typeof v.filename !== "string" ||
    typeof v.inputHash !== "string" ||
    !(v.taskId === null || typeof v.taskId === "string") ||
    !states.includes(v.state as JobState) ||
    typeof v.message !== "string" ||
    typeof v.createdAt !== "string" ||
    typeof v.updatedAt !== "string"
  )
    throw new Error("转换记录响应无效。");
  let options: ServeOptions | null = null;
  try {
    options = v.options == null ? null : serveOptions(typeof v.options === "string" ? JSON.parse(v.options) : v.options);
  } catch {
    options = null;
  }
  return {
    id: v.id,
    filename: v.filename,
    inputHash: v.inputHash,
    taskId: v.taskId,
    state: v.state as JobState,
    message: v.message,
    createdAt: v.createdAt,
    updatedAt: v.updatedAt,
    sourceId: typeof v.sourceId === "string" ? v.sourceId : null,
    options,
    resultId: typeof v.resultId === "string" ? v.resultId : null,
  };
}
export const OCR_PRESETS = ["auto", "easyocr", "tesseract", "rapidocr", "ocrmac"] as const;
export const PDF_BACKENDS = ["docling_parse", "pypdfium2"] as const;
export const TABLE_MODES = ["accurate", "fast"] as const;
export interface ServeOptions {
  do_ocr: boolean;
  force_ocr: boolean;
  ocr_preset: (typeof OCR_PRESETS)[number];
  ocr_lang: string[];
  pdf_backend: (typeof PDF_BACKENDS)[number];
  do_table_structure: boolean;
  table_mode: (typeof TABLE_MODES)[number];
  table_cell_matching: boolean;
  do_pdf_heading_hierarchy: boolean;
  page_from: number | null;
  page_to: number | null;
  do_code_enrichment: boolean;
  do_formula_enrichment: boolean;
  do_picture_classification: boolean;
  document_timeout: number | null;
}
export const defaultOptions: ServeOptions = {
  do_ocr: true,
  force_ocr: false,
  ocr_preset: "auto",
  ocr_lang: [],
  pdf_backend: "docling_parse",
  do_table_structure: true,
  table_mode: "accurate",
  table_cell_matching: true,
  do_pdf_heading_hierarchy: false,
  page_from: null,
  page_to: null,
  do_code_enrichment: false,
  do_formula_enrichment: false,
  do_picture_classification: false,
  document_timeout: null,
};
const pick = <T extends string>(value: unknown, list: readonly T[], fallback: T): T =>
  list.includes(value as T) ? (value as T) : fallback;
const bool = (value: unknown, fallback: boolean) => (typeof value === "boolean" ? value : fallback);
const page = (value: unknown) =>
  value === null || value === undefined || value === "" ? null : Number.isInteger(Number(value)) && Number(value) >= 1 && Number(value) <= 100000 ? Number(value) : NaN;
export function serveOptions(value: unknown): ServeOptions {
  const v = isRecord(value) ? value : {};
  const from = page(v.page_from),
    to = page(v.page_to);
  if (Number.isNaN(from) || Number.isNaN(to)) throw new Error("页码范围需为 1 以上的整数。");
  if (from !== null && to !== null && from > to) throw new Error("起始页不能大于结束页。");
  const langs = Array.isArray(v.ocr_lang) ? v.ocr_lang : typeof v.ocr_lang === "string" ? v.ocr_lang.split(/[,\s，]+/) : [];
  const ocr_lang = langs.map(String).map((x) => x.trim()).filter(Boolean);
  if (ocr_lang.length > 8 || ocr_lang.some((x) => !/^[A-Za-z]{2,8}(-[A-Za-z0-9]{1,8}){0,3}$/.test(x)))
    throw new Error("OCR 语言请填写 BCP-47 标签，例如 zh-Hans、en。");
  const timeout = v.document_timeout === null || v.document_timeout === undefined || v.document_timeout === "" ? null : Number(v.document_timeout);
  if (timeout !== null && (!Number.isFinite(timeout) || timeout < 1 || timeout > 86400))
    throw new Error("单文档超时需在 1–86400 秒之间。");
  return {
    do_ocr: bool(v.do_ocr, defaultOptions.do_ocr),
    force_ocr: bool(v.force_ocr, defaultOptions.force_ocr),
    ocr_preset: pick(v.ocr_preset, OCR_PRESETS, "auto"),
    ocr_lang,
    pdf_backend: pick(v.pdf_backend, PDF_BACKENDS, "docling_parse"),
    do_table_structure: bool(v.do_table_structure, true),
    table_mode: pick(v.table_mode, TABLE_MODES, "accurate"),
    table_cell_matching: bool(v.table_cell_matching, true),
    do_pdf_heading_hierarchy: bool(v.do_pdf_heading_hierarchy, false),
    page_from: from,
    page_to: to,
    do_code_enrichment: bool(v.do_code_enrichment, false),
    do_formula_enrichment: bool(v.do_formula_enrichment, false),
    do_picture_classification: bool(v.do_picture_classification, false),
    document_timeout: timeout,
  };
}
/** Multipart fields for POST /v1/convert/file/async (lists are repeated fields, as FastAPI form parsing expects). */
export function formFields(o: ServeOptions): [string, string][] {
  const fields: [string, string][] = [
    ["to_formats", "json"],
    ["image_export_mode", "placeholder"],
    ["include_images", "false"],
    ["target_type", "inbody"],
    ["do_ocr", String(o.do_ocr)],
    ["force_ocr", String(o.force_ocr)],
    ["ocr_preset", o.ocr_preset],
    ["pdf_backend", o.pdf_backend],
    ["do_table_structure", String(o.do_table_structure)],
    ["table_mode", o.table_mode],
    ["table_cell_matching", String(o.table_cell_matching)],
    ["do_pdf_heading_hierarchy", String(o.do_pdf_heading_hierarchy)],
    ["do_code_enrichment", String(o.do_code_enrichment)],
    ["do_formula_enrichment", String(o.do_formula_enrichment)],
    ["do_picture_classification", String(o.do_picture_classification)],
  ];
  for (const lang of o.ocr_lang) fields.push(["ocr_lang", lang]);
  if (o.page_from !== null || o.page_to !== null)
    fields.push(["page_range", String(o.page_from ?? 1)], ["page_range", String(o.page_to ?? 100000)]);
  if (o.document_timeout !== null) fields.push(["document_timeout", String(o.document_timeout)]);
  return fields;
}
/** Formats Docling Serve converts, by file extension. */
export const SERVE_FORMATS: Record<string, string> = {
  pdf: "pdf", docx: "docx", dotx: "docx", docm: "docx", pptx: "pptx", potx: "pptx", xlsx: "xlsx", xlsm: "xlsx",
  html: "html", htm: "html", xhtml: "html", md: "md", markdown: "md", csv: "csv", adoc: "asciidoc", asciidoc: "asciidoc",
  png: "image", jpg: "image", jpeg: "image", tif: "image", tiff: "image", bmp: "image", webp: "image",
  odt: "odt", ods: "ods", odp: "odp", rtf: "rtf", tex: "latex", vtt: "vtt",
};
export const extension = (name: string) => /\.([A-Za-z0-9]+)$/.exec(name)?.[1]?.toLowerCase() ?? "";
