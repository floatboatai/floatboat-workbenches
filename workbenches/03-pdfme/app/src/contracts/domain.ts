// ABOUTME: 纸张模板的数据模型、字段类型、校验、导入归一化与二进制槽位遍历，页面与服务端共用。
import type { Template } from "@pdfme/common";
import { isRecord, boundedText } from "./project.ts";
import {
  DATASET_MIMES,
  IMAGE_MIMES,
  PDF_MIMES,
  isAssetRef,
  isBlobValue,
  INLINE_LIMIT,
  MAX_PDF_PAGES,
} from "./assets.ts";

export const FONT_NAME = "NotoSansSC";

/** Every schema plugin exported by @pdfme/schemas 5.4.6, with the Chinese label shown in the UI. */
export const FIELD_TYPES = {
  text: "文本",
  multiVariableText: "变量文本",
  table: "表格",
  image: "图片",
  svg: "矢量图",
  qrcode: "二维码",
  code128: "Code 128 条码",
  ean13: "EAN-13 条码",
  ean8: "EAN-8 条码",
  code39: "Code 39 条码",
  itf14: "ITF-14 条码",
  upca: "UPC-A 条码",
  upce: "UPC-E 条码",
  nw7: "NW-7 条码",
  gs1datamatrix: "GS1 DataMatrix",
  pdf417: "PDF417",
  japanpost: "日本邮政条码",
  date: "日期",
  time: "时间",
  dateTime: "日期时间",
  select: "下拉选择",
  radioGroup: "单选",
  checkbox: "复选框",
  line: "直线",
  rectangle: "矩形",
  ellipse: "椭圆",
} as const;
export type FieldType = keyof typeof FIELD_TYPES;
export const isFieldType = (value: unknown): value is FieldType =>
  typeof value === "string" && Object.hasOwn(FIELD_TYPES, value);
export const BARCODE_TYPES = [
  "qrcode", "code128", "ean13", "ean8", "code39", "itf14", "upca", "upce", "nw7", "gs1datamatrix", "pdf417", "japanpost",
] as const;
export const SHAPE_TYPES = ["line", "rectangle", "ellipse"] as const;
export const fieldLabel = (type: string) => (isFieldType(type) ? FIELD_TYPES[type] : type);

export interface Dataset {
  /** Original CSV/JSON file as inline data URL or asset reference. */
  source: string;
  name: string;
  format: "csv" | "json";
  /** field name → column name ("" = keep the template's current value). */
  mapping: Record<string, string>;
  /** Column used to name files in the ZIP; "" numbers them. */
  fileColumn: string;
  selected: number;
}
export interface PdfProject {
  template: Template;
  values: Record<string, string>;
  dataset?: Dataset | null;
}

export const LIMITS = {
  pages: MAX_PDF_PAGES,
  fields: 500,
  name: 80,
  value: 100_000,
  fieldJson: 200_000,
  paperMin: 20,
  paperMax: 1200,
} as const;

type Field = Template["schemas"][number][number];
const finite = (v: unknown, min: number, max: number) =>
  typeof v === "number" && Number.isFinite(v) && v >= min && v <= max;
const RESERVED = (name: string) => name in Object.prototype || name === "__proto__";

export function isEditableField(field: { type: string; readOnly?: boolean }) {
  return !field.readOnly && !(SHAPE_TYPES as readonly string[]).includes(field.type);
}
/** Input object for pdfme: every editable field, falling back to the template's sample content. */
export function pdfInput(document: PdfProject): Record<string, string> {
  return Object.fromEntries(
    document.template.schemas
      .flat()
      .filter(isEditableField)
      .map((field) => [field.name, document.values[field.name] ?? field.content ?? ""]),
  );
}
export function editableFields(template: Template) {
  return template.schemas.flatMap((page, pageIndex) =>
    page.filter(isEditableField).map((field) => ({ field, pageIndex })),
  );
}

export function validatePdf(value: unknown): PdfProject {
  return parsePdf(value, false);
}
export function restorePdfDraft(value: unknown): PdfProject {
  return parsePdf(value, true);
}

/** Force the bundled CJK font on every text-like property (text, table cells, dates, select…). */
function coerceFonts(value: unknown, depth = 0): void {
  if (depth > 6 || !value || typeof value !== "object") return;
  if (Array.isArray(value)) {
    for (const item of value) coerceFonts(item, depth + 1);
    return;
  }
  const record = value as Record<string, unknown>;
  for (const [key, item] of Object.entries(record)) {
    if (key === "fontName") record[key] = FONT_NAME;
    else coerceFonts(item, depth + 1);
  }
}

function parseField(raw: unknown, draft: boolean, pageSize: { width: number; height: number } | null): Field {
  if (!isRecord(raw)) throw new Error("字段格式无效。");
  const label = typeof raw.name === "string" && raw.name ? `字段「${raw.name.slice(0, 40)}」` : "字段";
  if (typeof raw.name !== "string" || raw.name.length > LIMITS.name || (!draft && !raw.name.trim()))
    throw new Error(`${label}需要 1–${LIMITS.name} 个字符的名称。`);
  if (RESERVED(raw.name)) throw new Error(`${label}使用了保留名称。`);
  if (!isFieldType(raw.type)) throw new Error(`${label}的类型「${String(raw.type).slice(0, 30)}」不受支持。`);
  const maxX = (pageSize?.width ?? LIMITS.paperMax) + 50;
  const maxY = (pageSize?.height ?? LIMITS.paperMax) + 50;
  if (
    !isRecord(raw.position) ||
    !finite(raw.position.x, draft ? -LIMITS.paperMax : -50, draft ? LIMITS.paperMax * 2 : maxX) ||
    !finite(raw.position.y, draft ? -LIMITS.paperMax : -50, draft ? LIMITS.paperMax * 2 : maxY) ||
    !finite(raw.width, draft ? 0 : 0.01, LIMITS.paperMax * 2) ||
    !finite(raw.height, draft ? 0 : 0.01, LIMITS.paperMax * 2)
  )
    throw new Error(`${label}的位置或尺寸无效。`);
  if (JSON.stringify(raw).length > LIMITS.fieldJson + INLINE_LIMIT) throw new Error(`${label}内容过大。`);
  if (raw.content !== undefined) {
    boundedText(raw.content, LIMITS.value);
    if (raw.type === "image" && !isBlobValue(raw.content, IMAGE_MIMES))
      throw new Error(`${label}的图片需要 PNG/JPEG。`);
  }
  const field = structuredClone(raw) as unknown as Field;
  coerceFonts(field);
  return field;
}

function parseBase(raw: unknown, draft: boolean) {
  if (typeof raw === "string") {
    if (!isBlobValue(raw, PDF_MIMES) || raw === "") throw new Error("PDF 底图引用无效，请重新导入底图。");
    return { base: raw, size: null };
  }
  if (!isRecord(raw)) throw new Error("需要纸张尺寸或 PDF 底图。");
  const { paperMin, paperMax } = LIMITS;
  if (
    !finite(raw.width, paperMin, paperMax) ||
    !finite(raw.height, paperMin, paperMax) ||
    !Array.isArray(raw.padding) ||
    raw.padding.length !== 4 ||
    !raw.padding.every((n) => finite(n, 0, 200))
  )
    throw new Error(`纸张尺寸需要 ${paperMin}–${paperMax} mm，边距 0–200 mm。`);
  const base: Record<string, unknown> = { width: raw.width, height: raw.height, padding: [...raw.padding] };
  if (raw.staticSchema !== undefined) {
    if (!Array.isArray(raw.staticSchema) || raw.staticSchema.length > 50) throw new Error("页眉页脚元素最多 50 个。");
    base.staticSchema = raw.staticSchema.map((item) => parseField(item, draft, null));
  }
  return { base, size: { width: Number(raw.width), height: Number(raw.height) } };
}

function parseDataset(raw: unknown): Dataset | null {
  if (raw === undefined || raw === null) return null;
  if (!isRecord(raw)) throw new Error("数据表格式无效。");
  if (!isBlobValue(raw.source, DATASET_MIMES) || raw.source === "") throw new Error("数据表来源无效，请重新导入数据。");
  if (raw.format !== "csv" && raw.format !== "json") throw new Error("数据表只支持 CSV 或 JSON。");
  if (!isRecord(raw.mapping)) throw new Error("字段映射无效。");
  const mapping: Record<string, string> = {};
  for (const [key, column] of Object.entries(raw.mapping)) {
    if (RESERVED(key) || key.length > LIMITS.name) continue;
    mapping[key] = boundedText(column, 200);
  }
  const selected = Number.isInteger(raw.selected) && Number(raw.selected) >= 0 ? Number(raw.selected) : 0;
  return {
    source: String(raw.source),
    name: boundedText(raw.name ?? "数据表", 200) || "数据表",
    format: raw.format,
    mapping,
    fileColumn: typeof raw.fileColumn === "string" ? boundedText(raw.fileColumn, 200) : "",
    selected,
  };
}

function parsePdf(value: unknown, draft: boolean): PdfProject {
  if (!isRecord(value) || !isRecord(value.template) || !Array.isArray(value.template.schemas) || !isRecord(value.values))
    throw new Error("需要有效的模板和字段数据。");
  const { base, size } = parseBase(value.template.basePdf, draft);
  const pages = value.template.schemas;
  if (pages.length < 1 || pages.length > LIMITS.pages) throw new Error(`模板需要 1–${LIMITS.pages} 页。`);
  const names = new Set<string>();
  let count = 0;
  const schemas = pages.map((page) => {
    if (!Array.isArray(page)) throw new Error("页面字段格式无效。");
    return page.map((raw) => {
      if (++count > LIMITS.fields) throw new Error(`最多支持 ${LIMITS.fields} 个元素。`);
      const field = parseField(raw, draft, size);
      if (!draft && names.has(field.name)) throw new Error(`字段名称「${field.name}」重复，请改名。`);
      names.add(field.name);
      return field;
    });
  });
  const types = new Map(schemas.flat().map((field) => [field.name, field.type]));
  const values: Record<string, string> = {};
  for (const [key, item] of Object.entries(value.values)) {
    if (!names.has(key) || RESERVED(key)) continue;
    const text = boundedText(item, LIMITS.value);
    if (types.get(key) === "image" && !isBlobValue(text, IMAGE_MIMES)) throw new Error(`字段「${key}」的图片需要 PNG/JPEG。`);
    values[key] = text;
  }
  const template = { basePdf: base, schemas } as unknown as Template;
  const dataset = parseDataset(value.dataset);
  return dataset ? { template, values, dataset } : { template, values };
}

/** Accepts this app's export, the 0.3 project JSON, or a plain pdfme template (including the legacy keyed-object form). */
export function importDocument(raw: unknown, fallbackTitle: string): { title: string; data: unknown } {
  if (!isRecord(raw)) throw new Error("文件不是模板 JSON。");
  if (raw.kind === "floatboat-pdfme" && isRecord(raw.data))
    return { title: typeof raw.title === "string" && raw.title.trim() ? raw.title.trim().slice(0, 120) : fallbackTitle, data: raw.data };
  if (isRecord(raw.template) && isRecord(raw.values)) return { title: fallbackTitle, data: raw };
  if ("basePdf" in raw && Array.isArray(raw.schemas)) {
    const schemas = raw.schemas.map((page) =>
      Array.isArray(page)
        ? page
        : isRecord(page)
          ? Object.entries(page).map(([name, field]) => ({ ...(isRecord(field) ? field : {}), name }))
          : page,
    );
    const basePdf = raw.basePdf;
    return { title: fallbackTitle, data: { template: { basePdf, schemas }, values: {} } };
  }
  throw new Error("无法识别的模板文件：需要纸张工坊导出的 JSON 或 pdfme 模板（含 basePdf 与 schemas）。");
}

export type BlobKind = "pdf" | "image" | "dataset";
/** Visit every binary slot (PDF base, image contents/values, dataset source) and replace it. */
export async function mapBlobs(project: PdfProject, map: (value: string, kind: BlobKind) => Promise<string>): Promise<PdfProject> {
  const next = structuredClone(project);
  if (typeof next.template.basePdf === "string") next.template.basePdf = await map(next.template.basePdf, "pdf");
  const visit = async (field: { type: string; content?: string }) => {
    if (field.type === "image" && field.content) field.content = await map(field.content, "image");
  };
  const base = next.template.basePdf as { staticSchema?: Field[] };
  for (const field of base?.staticSchema ?? []) await visit(field);
  for (const page of next.template.schemas) for (const field of page) await visit(field);
  const types = new Map(next.template.schemas.flat().map((field) => [field.name, field.type]));
  for (const [key, item] of Object.entries(next.values))
    if (types.get(key) === "image" && item) next.values[key] = await map(item, "image");
  if (next.dataset?.source) next.dataset.source = await map(next.dataset.source, "dataset");
  return next;
}
export async function assetRefs(project: PdfProject): Promise<string[]> {
  const refs = new Set<string>();
  await mapBlobs(project, async (value) => {
    if (isAssetRef(value)) refs.add(value);
    return value;
  });
  return [...refs];
}

/** Rename a field everywhere it is referenced by name: template, filled values and the column mapping. */
export function renameField(project: PdfProject, from: string, to: string): PdfProject {
  const name = to.trim();
  if (!name || name.length > LIMITS.name) throw new Error(`字段名称需要 1–${LIMITS.name} 个字符。`);
  if (RESERVED(name)) throw new Error("字段名称为保留名称。");
  if (/[{}]/.test(name)) throw new Error("字段名称不能包含花括号。");
  const all = project.template.schemas.flat();
  if (name !== from && all.some((field) => field.name === name)) throw new Error(`已有名为「${name}」的字段。`);
  if (!all.some((field) => field.name === from)) throw new Error(`字段「${from}」已不存在。`);
  const next = structuredClone(project);
  for (const page of next.template.schemas) for (const field of page) if (field.name === from) field.name = name;
  if (Object.hasOwn(next.values, from)) {
    next.values[name] = next.values[from];
    delete next.values[from];
  }
  if (next.dataset && Object.hasOwn(next.dataset.mapping, from)) {
    next.dataset.mapping[name] = next.dataset.mapping[from];
    delete next.dataset.mapping[from];
  }
  return validatePdf(next);
}

/** Replace the paper with a PDF background; fields on pages beyond the PDF are reported, not silently dropped. */
export function withPdfBase(project: PdfProject, base: string, pageCount: number): { project: PdfProject; dropped: number } {
  if (pageCount < 1 || pageCount > LIMITS.pages) throw new Error(`PDF 有 ${pageCount} 页，模板最多 ${LIMITS.pages} 页。`);
  const next = structuredClone(project);
  const dropped = next.template.schemas.slice(pageCount).reduce((sum, page) => sum + page.length, 0);
  next.template.schemas = Array.from({ length: pageCount }, (_, index) => next.template.schemas[index] ?? []);
  next.template.basePdf = base;
  return { project: validatePdf(next), dropped };
}
export function withBlankBase(project: PdfProject, width: number, height: number): PdfProject {
  const next = structuredClone(project);
  next.template.basePdf = { width, height, padding: [10, 10, 10, 10] };
  return validatePdf(next);
}
export function paperLabel(template: Template): string {
  const base = template.basePdf;
  if (typeof base === "string") return "PDF 底图";
  if (base && typeof base === "object" && "width" in base) return `${base.width} × ${base.height} mm 空白纸`;
  return "PDF 底图";
}
