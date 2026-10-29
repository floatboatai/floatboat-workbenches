// ABOUTME: DoclingDocument 1.x 导入边界：引用、循环、深度、表格坐标与页面几何的校验，以及结构遍历。
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
/** Parsed JSON ceiling; long reports from Docling Serve with provenance stay well below this. */
export const MAX_DOCUMENT_BYTES = 48 * 1024 * 1024;
export const MAX_ITEMS = 50000;
export const MAX_TABLE_CELLS = 100000;
export const MAX_DEPTH = 64;
const refPattern =
  /^#\/(body|furniture|(?:texts|tables|groups|pictures|key_value_items|form_items)\/\d+)$/;
export const isRef = (value: unknown): value is string =>
  typeof value === "string" && refPattern.test(value);
function children(value: unknown): { $ref: string }[] {
  if (!Array.isArray(value) || value.length > MAX_ITEMS)
    throw new Error("结构引用无效。");
  return value.map((x) => {
    if (!isRecord(x) || !isRef(x.$ref)) throw new Error("结构引用无效。");
    return { $ref: x.$ref };
  });
}
function tableData(d: unknown): Item["data"] {
  if (
    !isRecord(d) ||
    !Number.isInteger(d.num_rows) ||
    !Number.isInteger(d.num_cols) ||
    Number(d.num_rows) < 0 ||
    Number(d.num_cols) < 0 ||
    Number(d.num_rows) * Number(d.num_cols) > 4 * MAX_TABLE_CELLS ||
    !Array.isArray(d.table_cells) ||
    d.table_cells.length > MAX_TABLE_CELLS
  )
    throw new Error(`表格尺寸或单元格无效（每表最多 ${MAX_TABLE_CELLS} 格）。`);
  const rows = Number(d.num_rows),
    cols = Number(d.num_cols);
  const cells = d.table_cells.map((v) => {
    if (!isRecord(v)) throw new Error("表格单元格无效。");
    for (const k of [
      "start_row_offset_idx",
      "start_col_offset_idx",
      "row_span",
      "col_span",
    ] as const)
      if (!Number.isInteger(v[k]) || Number(v[k]) < (k.endsWith("span") ? 1 : 0))
        throw new Error("表格坐标无效。");
    if (
      Number(v.start_row_offset_idx) + Number(v.row_span) > rows ||
      Number(v.start_col_offset_idx) + Number(v.col_span) > cols
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
  return { ...d, num_rows: rows, num_cols: cols, table_cells: cells };
}
function item(value: unknown): Item {
  if (!isRecord(value) || !isRef(value.self_ref))
    throw new Error("缺少有效 self_ref。");
  const result: Item = {
    ...value,
    self_ref: value.self_ref,
    label: boundedText(value.label, 100),
    children: children(value.children ?? []),
  };
  if (value.text !== undefined) result.text = boundedText(value.text, 200000);
  if (value.data !== undefined && value.label === "table")
    result.data = tableData(value.data);
  return result;
}
export function jsonBytes(value: unknown): number {
  return new TextEncoder().encode(JSON.stringify(value)).length;
}
const extraLists = ["key_value_items", "form_items"] as const;
export function parseDocument(value: unknown, knownBytes?: number): Document {
  if (
    !isRecord(value) ||
    value.schema_name !== "DoclingDocument" ||
    typeof value.version !== "string" ||
    !value.version.startsWith("1.")
  )
    throw new Error("请选择 DoclingDocument 1.x JSON。");
  if ((knownBytes ?? jsonBytes(value)) > MAX_DOCUMENT_BYTES)
    throw new Error("文档超过 48 MB，请以 placeholder 方式导出图片或拆分文档。");
  const list = (k: string) => {
    const a = value[k] ?? [];
    if (!Array.isArray(a) || a.length > MAX_ITEMS)
      throw new Error("结构项数量无效。");
    return a.map(item);
  };
  const doc: Document = {
    ...value,
    schema_name: "DoclingDocument",
    name: boundedText(value.name, 500),
    body: item(value.body),
    furniture: item(value.furniture),
    texts: list("texts"),
    tables: list("tables"),
    groups: list("groups"),
    pictures: list("pictures"),
  };
  for (const k of extraLists) if (value[k] !== undefined) doc[k] = list(k);
  const all = allItems(doc, true);
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
      if (node[key] !== undefined)
        for (const ref of children(node[key]))
          if (!refs.has(ref.$ref)) throw new Error("附属引用不存在。");
    }
  }
  // Iterative depth-first check: deep, wide trees must not overflow the call stack.
  const done = new Set<string>();
  for (const start of all) {
    if (done.has(start.self_ref)) continue;
    const stack: { node: Item; next: number }[] = [{ node: start, next: 0 }],
      onPath = new Set([start.self_ref]);
    while (stack.length) {
      const top = stack[stack.length - 1]!;
      if (stack.length > MAX_DEPTH)
        throw new Error(`文档层级超过 ${MAX_DEPTH} 层。`);
      const child = top.node.children[top.next++];
      if (!child) {
        onPath.delete(top.node.self_ref);
        done.add(top.node.self_ref);
        stack.pop();
        continue;
      }
      const next = refs.get(child.$ref);
      if (!next) throw new Error(`引用不存在：${child.$ref}`);
      if (onPath.has(next.self_ref)) throw new Error("文档结构存在循环。");
      if (done.has(next.self_ref)) continue;
      onPath.add(next.self_ref);
      stack.push({ node: next, next: 0 });
    }
  }
  return doc;
}
export function allItems(doc: Document, roots = false): Item[] {
  return [
    ...(roots ? [doc.body, doc.furniture] : []),
    ...doc.texts,
    ...doc.tables,
    ...doc.groups,
    ...doc.pictures,
    ...extraLists.flatMap((k) =>
      Array.isArray(doc[k]) ? (doc[k] as Item[]) : [],
    ),
  ];
}
export interface Row {
  item: Item;
  depth: number;
}
/** Reading order: body tree, then furniture, then anything unattached. `order` re-ranks siblings. */
export function items(doc: Document, order: string[] = []): Row[] {
  const all = allItems(doc),
    byRef = new Map(all.map((x) => [x.self_ref, x])),
    rank = new Map(order.map((r, i) => [r, i])),
    seen = new Set<string>(),
    rows: Row[] = [];
  const sorted = (parent: Item) =>
    rank.size
      ? [...parent.children].sort(
          (a, b) => (rank.get(a.$ref) ?? 1e9) - (rank.get(b.$ref) ?? 1e9),
        )
      : parent.children;
  function walk(parent: Item, depth: number) {
    const stack: { list: { $ref: string }[]; i: number; depth: number }[] = [
      { list: sorted(parent), i: 0, depth },
    ];
    while (stack.length) {
      const top = stack[stack.length - 1]!;
      const ref = top.list[top.i++];
      if (!ref) {
        stack.pop();
        continue;
      }
      const node = byRef.get(ref.$ref);
      if (!node || seen.has(node.self_ref)) continue;
      seen.add(node.self_ref);
      rows.push({ item: node, depth: top.depth });
      if (node.children.length)
        stack.push({ list: sorted(node), i: 0, depth: top.depth + 1 });
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
export type Origin = "BOTTOMLEFT" | "TOPLEFT";
export interface Box {
  page: number;
  l: number;
  t: number;
  r: number;
  b: number;
  origin: Origin;
}
/** Page-anchored boxes for an item, from DoclingDocument provenance. */
export function boxes(node: Item): Box[] {
  if (!Array.isArray(node.prov)) return [];
  const out: Box[] = [];
  for (const p of node.prov) {
    if (!isRecord(p) || !Number.isInteger(p.page_no) || !isRecord(p.bbox)) continue;
    const { l, t, r, b, coord_origin } = p.bbox;
    if (![l, t, r, b].every((n) => typeof n === "number" && Number.isFinite(n))) continue;
    out.push({
      page: Number(p.page_no),
      l: Number(l),
      t: Number(t),
      r: Number(r),
      b: Number(b),
      origin: coord_origin === "TOPLEFT" ? "TOPLEFT" : "BOTTOMLEFT",
    });
  }
  return out;
}
export function pageSizes(doc: Document): Map<number, { width: number; height: number }> {
  const out = new Map<number, { width: number; height: number }>();
  if (!isRecord(doc.pages)) return out;
  for (const p of Object.values(doc.pages)) {
    if (!isRecord(p) || !Number.isInteger(p.page_no) || !isRecord(p.size)) continue;
    const { width, height } = p.size;
    if (typeof width === "number" && typeof height === "number" && width > 0 && height > 0)
      out.set(Number(p.page_no), { width, height });
  }
  return out;
}
