// ABOUTME: 校订层：引用已存 DoclingDocument 与原文件，独立保存文本/类型/单元格校订、复核与同级顺序。
import { isRecord, boundedText } from "./project.ts";
import {
  allItems,
  isRef,
  items,
  jsonBytes,
  parseDocument,
  type Document,
} from "./docling.ts";
export const SOURCE_FORMATS = ["pdf", "docx", "html", "md", "json", "other"] as const;
export type SourceFormat = (typeof SOURCE_FORMATS)[number];
export interface SourceRef {
  /** SHA-256 of the original file bytes. */
  id: string;
  name: string;
  format: SourceFormat;
  bytes: number;
}
export interface DocumentRef {
  /** SHA-256 of the stored DoclingDocument JSON text. */
  id: string;
  name: string;
  bytes: number;
  pages: number;
  items: number;
  /** Human-readable conversion engine, e.g. "本地解析 · pdf.js 6.4.299" or "Docling Serve". */
  engine: string;
  source: SourceRef | null;
}
export interface Correction {
  text?: string;
  label?: string;
  /** Heading level for section_header (1 = top section under the title). */
  level?: number;
  cells?: Record<string, string>;
  reviewed: boolean;
  note: string;
}
export interface Review {
  format: "docling-review";
  version: 2;
  document: DocumentRef | null;
  /** Legacy 0.4 projects embedded the parsed document; it is moved to storage when opened. */
  original?: Document;
  corrections: Record<string, Correction>;
  order: string[];
  source: string;
}
export const empty: Review = {
  format: "docling-review",
  version: 2,
  document: null,
  corrections: {},
  order: [],
  source: "",
};
export const MODEL_REVIEW_BYTES = 800000;
export const WORKING_REVIEW_BYTES = 1200000;
export const WORKING_COPY_BYTES = 1850000;
export const LEGACY_DOCUMENT_BYTES = 600000;
export const sha = (value: unknown): value is string =>
  typeof value === "string" && /^[0-9a-f]{64}$/.test(value);
function count(value: unknown, max: number): number {
  if (!Number.isInteger(value) || Number(value) < 0 || Number(value) > max)
    throw new Error("文档摘要无效。");
  return Number(value);
}
export function sourceRef(value: unknown): SourceRef {
  if (
    !isRecord(value) ||
    !sha(value.id) ||
    !SOURCE_FORMATS.includes(value.format as SourceFormat)
  )
    throw new Error("原文件引用无效。");
  return {
    id: value.id,
    name: boundedText(value.name, 300),
    format: value.format as SourceFormat,
    bytes: count(value.bytes, 2 ** 40),
  };
}
export function documentRef(value: unknown): DocumentRef {
  if (!isRecord(value) || !sha(value.id)) throw new Error("文档引用无效。");
  return {
    id: value.id,
    name: boundedText(value.name, 500),
    bytes: count(value.bytes, 2 ** 40),
    pages: count(value.pages, 100000),
    items: count(value.items, 10 ** 6),
    engine: boundedText(value.engine, 200),
    source: value.source === null || value.source === undefined ? null : sourceRef(value.source),
  };
}
function decodeReview(value: unknown, maxBytes: number): Review {
  if (jsonBytes(value) > maxBytes)
    throw new Error(
      maxBytes === MODEL_REVIEW_BYTES
        ? "校订超过正式项目的 800 KB 限额，已保留工作稿；请精简备注后再保存为项目。"
        : "工作稿不能超过 1.2 MB，请先导出或精简内容。本次修改未采用。",
    );
  if (
    !isRecord(value) ||
    value.format !== "docling-review" ||
    (value.version !== 1 && value.version !== 2) ||
    !isRecord(value.corrections) ||
    !Array.isArray(value.order)
  )
    throw new Error("校对项目格式无效。");
  const original =
    value.original === null || value.original === undefined
      ? undefined
      : jsonBytes(value.original) > LEGACY_DOCUMENT_BYTES
        ? (() => {
            throw new Error("内嵌文档超过 600 KB，请改用文件导入。");
          })()
        : parseDocument(value.original);
  const document =
    value.document === null || value.document === undefined
      ? null
      : documentRef(value.document);
  const corrections: Record<string, Correction> = {};
  for (const [key, c] of Object.entries(value.corrections)) {
    if (!isRef(key) || !isRecord(c) || typeof c.reviewed !== "boolean")
      throw new Error("校订项无效。");
    const next: Correction = { reviewed: c.reviewed, note: boundedText(c.note, 10000) };
    if (c.text !== undefined) next.text = boundedText(c.text, 200000);
    if (c.label !== undefined) next.label = boundedText(c.label, 100);
    if (c.level !== undefined) {
      if (!Number.isInteger(c.level) || Number(c.level) < 1 || Number(c.level) > 6) throw new Error("标题级别需为 1–6。");
      next.level = Number(c.level);
    }
    if (c.cells !== undefined) {
      if (!isRecord(c.cells)) throw new Error("单元格校订无效。");
      next.cells = {};
      for (const [k, v] of Object.entries(c.cells)) {
        if (!/^\d{1,6}$/.test(k)) throw new Error("校订单元格不存在。");
        next.cells[k] = boundedText(v, 50000);
      }
    }
    corrections[key] = next;
  }
  if (
    value.order.some((x) => !isRef(x)) ||
    new Set(value.order).size !== value.order.length
  )
    throw new Error("阅读顺序无效。");
  const result: Review = {
    format: "docling-review",
    version: 2,
    document,
    corrections,
    order: value.order as string[],
    source: boundedText(value.source, 2000),
  };
  if (original) result.original = original;
  if (original) assertMatches(result, original);
  return result;
}
export function validateReview(value: unknown): Review {
  return decodeReview(value, MODEL_REVIEW_BYTES);
}
/** Same structural and per-field constraints as the model, with a bounded recovery allowance. */
export function restoreReviewDraft(value: unknown): Review {
  return decodeReview(value, WORKING_REVIEW_BYTES);
}
/** Corrections and order must point at items (and table cells) that exist in the referenced document. */
export function assertMatches(review: Review, doc: Document): void {
  const byRef = new Map(allItems(doc).map((x) => [x.self_ref, x]));
  for (const [key, c] of Object.entries(review.corrections)) {
    const node = byRef.get(key);
    if (!node) throw new Error("校订项在文档中不存在。");
    if (c.cells)
      for (const k of Object.keys(c.cells))
        if (!node.data?.table_cells[Number(k)])
          throw new Error("校订单元格不存在。");
  }
  if (review.order.some((r) => !byRef.has(r))) throw new Error("阅读顺序无效。");
}
export function assertWorkingCopyCapacity(
  title: string,
  data: Review,
  extra: Record<string, unknown>,
): void {
  if (title.length > 120) throw new Error("名称不能超过 120 个字符。");
  if (jsonBytes({ title, data, extra }) > WORKING_COPY_BYTES)
    throw new Error(
      "工作副本不能超过 1.85 MB。本次输入未采用；请清空导入草稿或使用文件导入。",
    );
}
export function corrected(review: Review, original: Document | null): Document | null {
  if (!original) return null;
  const doc = structuredClone(original);
  const rank = new Map(review.order.map((r, i) => [r, i]));
  for (const node of [doc.body, doc.furniture, ...allItems(doc)]) {
    if (rank.size)
      node.children.sort(
        (a, b) => (rank.get(a.$ref) ?? 1e9) - (rank.get(b.$ref) ?? 1e9),
      );
    const c = review.corrections[node.self_ref];
    if (!c) continue;
    if (c.text !== undefined) node.text = c.text;
    if (c.label !== undefined) node.label = c.label;
    if (c.level !== undefined && (c.label ?? node.label) === "section_header") node.level = c.level;
    if ((c.label ?? node.label) === "section_header" && node.level === undefined) node.level = 1;
    if (c.label !== undefined && c.label !== "section_header" && node.label !== "section_header") delete node.level;
    if (c.label === "list_item") {
      node.enumerated ??= false;
      node.marker ??= "";
    }
    if (c.cells && node.data) {
      node.data.table_cells = node.data.table_cells.map((cell, i) => ({
        ...cell,
        text: c.cells?.[String(i)] ?? cell.text,
      }));
      if (Array.isArray(node.data.grid))
        node.data.grid = node.data.grid.map((row) =>
          Array.isArray(row)
            ? row.map((v) => {
                if (!isRecord(v)) return v;
                const cell = node.data?.table_cells.find(
                  (x) =>
                    x.start_row_offset_idx === v.start_row_offset_idx &&
                    x.start_col_offset_idx === v.start_col_offset_idx,
                );
                return cell ? { ...v, text: cell.text } : v;
              })
            : row,
        );
    }
  }
  return doc;
}
export function moveSibling(
  review: Review,
  doc: Document,
  ref: string,
  delta: number,
): Review {
  const rows = items(doc, review.order);
  const selected = rows.find((x) => x.item.self_ref === ref)?.item;
  if (!selected) return review;
  const parent = isRecord(selected.parent) ? selected.parent.$ref : undefined;
  const siblings = rows
      .filter((x) => isRecord(x.item.parent) && x.item.parent.$ref === parent)
      .map((x) => x.item.self_ref),
    i = siblings.indexOf(ref),
    j = i + delta;
  if (j < 0 || j >= siblings.length) return review;
  const a = siblings[i]!;
  siblings[i] = siblings[j]!;
  siblings[j] = a;
  const order = rows.map((x) => x.item.self_ref),
    members = new Set(siblings),
    slots = order.map((r, n) => (members.has(r) ? n : -1)).filter((n) => n >= 0);
  slots.forEach((slot, n) => {
    order[slot] = siblings[n]!;
  });
  return { ...review, order };
}
export function summary(
  doc: Document,
  id: string,
  bytes: number,
  engine: string,
  source: SourceRef | null,
): DocumentRef {
  const pages = isRecord(doc.pages) ? Object.keys(doc.pages).length : 0;
  return {
    id,
    name: doc.name.slice(0, 500),
    bytes,
    pages,
    items: allItems(doc).length,
    engine: engine.slice(0, 200),
    source,
  };
}
