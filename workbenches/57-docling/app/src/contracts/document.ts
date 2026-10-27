import { isRecord, boundedText } from "./project.ts";
export type JsonObject = Record<string, unknown>;
export interface Cell extends JsonObject {
  text: string;
  start_row_offset_idx: number;
  start_col_offset_idx: number;
  row_span: number;
  col_span: number;
}
export interface Item extends JsonObject {
  self_ref: string;
  label: string;
  children: { $ref: string }[];
  text?: string;
  data?: JsonObject & {
    num_rows: number;
    num_cols: number;
    table_cells: Cell[];
  };
}
export interface Document extends JsonObject {
  schema_name: "DoclingDocument";
  name: string;
  body: Item;
  furniture: Item;
  texts: Item[];
  tables: Item[];
  groups: Item[];
  pictures: Item[];
}
export interface Correction {
  text?: string;
  label?: string;
  cells?: Record<string, string>;
  reviewed: boolean;
  note: string;
}
export interface Review {
  format: "docling-review";
  version: 1;
  original: Document | null;
  corrections: Record<string, Correction>;
  order: string[];
  source: string;
}
export const empty: Review = {
  format: "docling-review",
  version: 1,
  original: null,
  corrections: {},
  order: [],
  source: "",
};
const refPattern =
  /^#\/(body|furniture|(?:texts|tables|groups|pictures|key_value_items|form_items)\/\d+)$/;
function children(value: unknown): { $ref: string }[] {
  if (!Array.isArray(value) || value.length > 4000)
    throw new Error("结构引用无效。");
  return value.map((x) => {
    if (!isRecord(x) || typeof x.$ref !== "string" || !refPattern.test(x.$ref))
      throw new Error("结构引用无效。");
    return { $ref: x.$ref };
  });
}
function item(value: unknown): Item {
  if (
    !isRecord(value) ||
    typeof value.self_ref !== "string" ||
    !refPattern.test(value.self_ref)
  )
    throw new Error("缺少有效 self_ref。");
  const result: Item = {
    ...value,
    self_ref: value.self_ref,
    label: boundedText(value.label, 100),
    children: children(value.children ?? []),
  };
  if (value.text !== undefined) result.text = boundedText(value.text, 100000);
  if (value.data !== undefined && value.label === "table") {
    const d = value.data;
    if (
      !isRecord(d) ||
      !Number.isInteger(d.num_rows) ||
      !Number.isInteger(d.num_cols) ||
      Number(d.num_rows) < 0 ||
      Number(d.num_cols) < 0 ||
      Number(d.num_rows) * Number(d.num_cols) > 10000 ||
      !Array.isArray(d.table_cells) ||
      d.table_cells.length > 10000
    )
      throw new Error("表格尺寸或单元格无效（最多 10000 格）。");
    const cells = d.table_cells.map((v) => {
      if (!isRecord(v)) throw new Error("表格单元格无效。");
      const nums = [
        "start_row_offset_idx",
        "start_col_offset_idx",
        "row_span",
        "col_span",
      ] as const;
      for (const k of nums)
        if (
          !Number.isInteger(v[k]) ||
          Number(v[k]) < (k.endsWith("span") ? 1 : 0)
        )
          throw new Error("表格坐标无效。");
      if (
        Number(v.start_row_offset_idx) + Number(v.row_span) >
          Number(d.num_rows) ||
        Number(v.start_col_offset_idx) + Number(v.col_span) > Number(d.num_cols)
      )
        throw new Error("表格坐标越界。");
      return {
        ...v,
        text: boundedText(v.text, 50000),
        start_row_offset_idx: Number(v.start_row_offset_idx),
        start_col_offset_idx: Number(v.start_col_offset_idx),
        row_span: Number(v.row_span),
        col_span: Number(v.col_span),
      };
    });
    result.data = {
      ...d,
      num_rows: Number(d.num_rows),
      num_cols: Number(d.num_cols),
      table_cells: cells,
    };
  }
  return result;
}
export function parseDocument(value: unknown): Document {
  if (
    !isRecord(value) ||
    value.schema_name !== "DoclingDocument" ||
    typeof value.version !== "string" ||
    !value.version.startsWith("1.")
  )
    throw new Error("请选择 DoclingDocument 1.x JSON。");
  if (new TextEncoder().encode(JSON.stringify(value)).length > 600000)
    throw new Error("文档超过 600 KB，请减少嵌入图片或拆分文档。");
  const list = (k: string) => {
    const a = value[k] ?? [];
    if (!Array.isArray(a) || a.length > 2000)
      throw new Error("结构项数量无效。");
    return a.map(item);
  };
  const doc: Document = {
    ...value,
    schema_name: "DoclingDocument",
    name: boundedText(value.name, 200),
    body: item(value.body),
    furniture: item(value.furniture),
    texts: list("texts"),
    tables: list("tables"),
    groups: list("groups"),
    pictures: list("pictures"),
  };
  const all = [
    doc.body,
    doc.furniture,
    ...doc.texts,
    ...doc.tables,
    ...doc.groups,
    ...doc.pictures,
    ...list("key_value_items"),
    ...list("form_items"),
  ];
  const refs = new Map<string, Item>();
  for (const x of all) {
    if (refs.has(x.self_ref)) throw new Error("文档存在重复引用。");
    refs.set(x.self_ref, x);
  }
  for (const node of all) {
    if (node.parent !== undefined) {
      if (
        !isRecord(node.parent) ||
        typeof node.parent.$ref !== "string" ||
        !refs.has(node.parent.$ref)
      )
        throw new Error("父级引用不存在。");
    }
    for (const key of ["captions", "references", "footnotes"]) {
      if (node[key] !== undefined) {
        for (const ref of children(node[key]))
          if (!refs.has(ref.$ref)) throw new Error("附属引用不存在。");
      }
    }
  }
  const visiting = new Set<string>(),
    done = new Set<string>();
  function visit(x: Item) {
    if (visiting.size > 64) throw new Error("文档层级超过 64 层。");
    if (visiting.has(x.self_ref)) throw new Error("文档结构存在循环。");
    if (done.has(x.self_ref)) return;
    visiting.add(x.self_ref);
    for (const child of x.children) {
      const next = refs.get(child.$ref);
      if (!next) throw new Error(`引用不存在：${child.$ref}`);
      visit(next);
    }
    visiting.delete(x.self_ref);
    done.add(x.self_ref);
  }
  all.forEach(visit);
  return doc;
}
export const MODEL_REVIEW_BYTES = 800000;
export const WORKING_REVIEW_BYTES = 1200000;
export const WORKING_COPY_BYTES = 1850000;
export function jsonBytes(value: unknown): number {
  return new TextEncoder().encode(JSON.stringify(value)).length;
}
function decodeReview(value: unknown, maxBytes: number): Review {
  if (jsonBytes(value) > maxBytes)
    throw new Error(
      maxBytes === MODEL_REVIEW_BYTES
        ? "校订超过正式项目的 800 KB 限额，已保留工作稿；请精简后再保存为项目。"
        : "工作稿不能超过 1.2 MB，请先导出或精简内容。本次修改未采用。",
    );
  if (
    !isRecord(value) ||
    value.format !== "docling-review" ||
    value.version !== 1 ||
    !isRecord(value.corrections) ||
    !Array.isArray(value.order)
  )
    throw new Error("校对项目格式无效。");
  const original =
      value.original === null ? null : parseDocument(value.original),
    validRefs = new Set(
      original ? items(original).map((x) => x.item.self_ref) : [],
    );
  const corrections: Record<string, Correction> = {};
  for (const [key, c] of Object.entries(value.corrections)) {
    if (!validRefs.has(key) || !isRecord(c) || typeof c.reviewed !== "boolean")
      throw new Error("校订项无效。");
    const next: Correction = {
      reviewed: c.reviewed,
      note: boundedText(c.note, 10000),
    };
    if (c.text !== undefined) next.text = boundedText(c.text, 100000);
    if (c.label !== undefined) next.label = boundedText(c.label, 100);
    if (c.cells !== undefined) {
      if (!isRecord(c.cells)) throw new Error("单元格校订无效。");
      next.cells = {};
      for (const [k, v] of Object.entries(c.cells)) {
        const table = original?.tables.find((t) => t.self_ref === key);
        if (!/^\d+$/.test(k) || !table?.data?.table_cells[Number(k)])
          throw new Error("校订单元格不存在。");
        next.cells[k] = boundedText(v, 50000);
      }
    }
    corrections[key] = next;
  }
  if (
    value.order.some((x) => typeof x !== "string" || !validRefs.has(x)) ||
    new Set(value.order).size !== value.order.length
  )
    throw new Error("阅读顺序无效。");
  const result: Review = {
    format: "docling-review",
    version: 1,
    original,
    corrections,
    order: value.order as string[],
    source: boundedText(value.source, 2000),
  };
  if (jsonBytes(result) > maxBytes) throw new Error("校订内容超出容量。");
  return result;
}
export function validateReview(value: unknown): Review {
  return decodeReview(value, MODEL_REVIEW_BYTES);
}
/** Same structural and per-field constraints as the model, with a bounded recovery allowance. */
export function restoreReviewDraft(value: unknown): Review {
  return decodeReview(value, WORKING_REVIEW_BYTES);
}
export function assertWorkingCopyCapacity(
  title: string,
  data: Review,
  extra: Record<string, unknown>,
): void {
  if (title.length > 120) throw new Error("项目名称不能超过 120 个字符。");
  if (jsonBytes({ title, data, extra }) > WORKING_COPY_BYTES)
    throw new Error(
      "工作副本不能超过 1.85 MB。本次输入未采用；请清空导入草稿或使用文件导入。",
    );
}
export function exportReview(review: Review): string {
  return JSON.stringify(restoreReviewDraft(review));
}
export function fromDocument(
  value: unknown,
  source = "导入 DoclingDocument",
): Review {
  return {
    ...empty,
    original: parseDocument(value),
    corrections: {},
    order: [],
    source,
  };
}
export function importReview(raw: string): Review {
  const v: unknown = JSON.parse(raw);
  return isRecord(v) && v.format === "docling-review"
    ? restoreReviewDraft(v)
    : fromDocument(v);
}
export function items(
  doc: Document,
  order: string[] = [],
): { item: Item; depth: number }[] {
  const all = [
      ...doc.texts,
      ...doc.tables,
      ...doc.groups,
      ...doc.pictures,
      ...(Array.isArray(doc.key_value_items)
        ? doc.key_value_items.map(item)
        : []),
      ...(Array.isArray(doc.form_items) ? doc.form_items.map(item) : []),
    ],
    byRef = new Map(all.map((x) => [x.self_ref, x])),
    rank = new Map(order.map((r, i) => [r, i])),
    seen = new Set<string>(),
    rows: { item: Item; depth: number }[] = [];
  function walk(parent: Item, depth: number) {
    const sorted = [...parent.children].sort(
      (a, b) => (rank.get(a.$ref) ?? 99999) - (rank.get(b.$ref) ?? 99999),
    );
    for (const ref of sorted) {
      const node = byRef.get(ref.$ref);
      if (!node || seen.has(node.self_ref)) continue;
      seen.add(node.self_ref);
      rows.push({ item: node, depth });
      walk(node, depth + 1);
    }
  }
  walk(doc.body, 0);
  walk(doc.furniture, 0);
  for (const node of all)
    if (!seen.has(node.self_ref)) {
      seen.add(node.self_ref);
      rows.push({ item: node, depth: 0 });
    }
  return rows;
}
export function corrected(review: Review): Document | null {
  if (!review.original) return null;
  const doc = structuredClone(review.original);
  const rank = new Map(review.order.map((r, i) => [r, i]));
  for (const node of [
    doc.body,
    doc.furniture,
    ...items(doc).map((x) => x.item),
  ]) {
    node.children.sort(
      (a, b) => (rank.get(a.$ref) ?? 99999) - (rank.get(b.$ref) ?? 99999),
    );
    const c = review.corrections[node.self_ref];
    if (!c) continue;
    if (c.text !== undefined) node.text = c.text;
    if (c.label !== undefined) node.label = c.label;
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
export function tableRows(node: Item): string[][] {
  const d = node.data;
  if (!d) return [];
  const rows = Array.from({ length: d.num_rows }, () =>
    Array<string>(d.num_cols).fill(""),
  );
  for (const c of d.table_cells)
    rows[c.start_row_offset_idx]![c.start_col_offset_idx] = c.text;
  return rows;
}
const csvCell = (s: string) =>
  '"' + (/^[=+@\-\t\r]/.test(s) ? "'" : "") + s.replaceAll('"', '""') + '"';
export function tableCsv(node: Item): string {
  return tableRows(node)
    .map((r) => r.map(csvCell).join(","))
    .join("\r\n");
}
export function markdown(review: Review): string {
  const doc = corrected(review);
  if (!doc) return "";
  return (
    items(doc)
      .filter(
        (x) =>
          x.item.content_layer !== "furniture" &&
          !["groups", "pictures"].includes(x.item.self_ref.split("/")[1] ?? ""),
      )
      .map(({ item: n }) => {
        if (n.data) {
          const rows = tableRows(n);
          if (!rows.length) return "";
          const fmt = (row: string[]) =>
            "| " +
            row
              .map((x) => x.replaceAll("|", "\\|").replaceAll("\n", "<br>"))
              .join(" | ") +
            " |";
          return [
            fmt(rows[0]!),
            fmt(rows[0]!.map(() => "---")),
            ...rows.slice(1).map(fmt),
          ].join("\n");
        }
        const text = n.text ?? "";
        return n.label === "title"
          ? "# " + text
          : n.label === "section_header"
            ? "#".repeat(Math.min(6, Math.max(1, (Number(n.level) || 1) + 1))) +
              " " +
              text
            : n.label === "list_item"
              ? "- " + text
              : text;
      })
      .filter(Boolean)
      .join("\n\n") + "\n"
  );
}
export function moveSibling(
  review: Review,
  ref: string,
  delta: number,
): Review {
  if (!review.original) return review;
  const rows = items(review.original, review.order);
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
    slots = order
      .map((r, n) => (siblings.includes(r) ? n : -1))
      .filter((n) => n >= 0);
  slots.forEach((slot, n) => {
    order[slot] = siblings[n]!;
  });
  return { ...review, order };
}
