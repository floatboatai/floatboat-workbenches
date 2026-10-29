// ABOUTME: 生成合法 DoclingDocument 1.10 结构（texts/tables/groups/pictures、prov、pages）的构建器，供本地后备解析共用。
import { parseDocument, type Document } from "../docling.ts";
export const DOCLING_SCHEMA_VERSION = "1.10.0";
export interface Prov {
  page_no: number;
  bbox: { l: number; t: number; r: number; b: number; coord_origin: "BOTTOMLEFT" | "TOPLEFT" };
  charspan: [number, number];
}
export interface CellInput {
  text: string;
  row: number;
  col: number;
  rowSpan?: number;
  colSpan?: number;
  header?: boolean;
  rowHeader?: boolean;
}
type Ref = { $ref: string };
type Node = Record<string, unknown> & { self_ref: string; children: Ref[] };
const round = (n: number) => Math.round(n * 100) / 100;
export function box(l: number, t: number, r: number, b: number): Prov["bbox"] {
  return { l: round(l), t: round(t), r: round(r), b: round(b), coord_origin: "BOTTOMLEFT" };
}
/** Clean extracted text: Kangxi radicals to unified ideographs, control glyphs to spaces, collapsed whitespace. */
export function cleanText(s: string): string {
  return s
    .replace(/[\u2e80-\u2fdf]/g, (c) => c.normalize("NFKC"))
    .replace(/[\u00ad\ufeff\u200b]/g, "")
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, " ")
    .replace(/[ \t\u00a0]+/g, " ")
    .replace(/ *\n */g, "\n")
    .trim();
}
/** Stable 48-bit hash, safely representable as a JSON integer. */
export function binaryHash(bytes: Uint8Array): number {
  let h1 = 0x811c9dc5,
    h2 = 0x01000193;
  for (let i = 0; i < bytes.length; i++) {
    h1 = Math.imul(h1 ^ bytes[i]!, 0x01000193) >>> 0;
    h2 = Math.imul(h2 ^ bytes[i]!, 0x5bd1e995) >>> 0;
  }
  return (h1 >>> 0) * 0x10000 + (h2 & 0xffff);
}
export class DocBuilder {
  readonly body: Node = { self_ref: "#/body", children: [], content_layer: "body", name: "_root_", label: "unspecified" };
  readonly furniture: Node = { self_ref: "#/furniture", children: [], content_layer: "furniture", name: "_root_", label: "unspecified" };
  readonly texts: Node[] = [];
  readonly tables: Node[] = [];
  readonly groups: Node[] = [];
  readonly pictures: Node[] = [];
  readonly pages: Record<string, { size: { width: number; height: number }; page_no: number }> = {};
  private nodes = new Map<string, Node>();
  readonly name: string;
  readonly origin: { mimetype: string; filename: string; binary_hash: number };
  constructor(name: string, origin: { mimetype: string; filename: string; binary_hash: number }) {
    this.name = name;
    this.origin = origin;
    this.nodes.set("#/body", this.body);
    this.nodes.set("#/furniture", this.furniture);
  }
  page(no: number, width: number, height: number) {
    this.pages[String(no)] = { size: { width: round(width), height: round(height) }, page_no: no };
  }
  private attach(list: Node[], kind: string, parent: string, node: Record<string, unknown>): string {
    const ref = `#/${kind}/${list.length}`,
      owner = this.nodes.get(parent) ?? this.body;
    const full: Node = { self_ref: ref, parent: { $ref: owner.self_ref }, children: [], ...node };
    list.push(full);
    this.nodes.set(ref, full);
    owner.children.push({ $ref: ref });
    return ref;
  }
  layerOf(parent: string): "body" | "furniture" {
    return this.nodes.get(parent)?.content_layer === "furniture" ? "furniture" : "body";
  }
  text(parent: string, label: string, text: string, extra: Record<string, unknown> = {}, prov: Prov[] = []): string {
    return this.attach(this.texts, "texts", parent, {
      content_layer: this.layerOf(parent),
      label,
      prov,
      orig: text,
      text,
      ...extra,
    });
  }
  heading(parent: string, text: string, level: number, prov: Prov[] = []) {
    return this.text(parent, "section_header", text, { level: Math.max(1, Math.min(100, level)) }, prov);
  }
  listItem(parent: string, text: string, enumerated: boolean, marker: string, prov: Prov[] = []) {
    return this.text(parent, "list_item", text, { enumerated, marker }, prov);
  }
  group(parent: string, label: string, name: string, layer?: "body" | "furniture"): string {
    return this.attach(this.groups, "groups", parent, {
      content_layer: layer ?? this.layerOf(parent),
      name,
      label,
    });
  }
  table(parent: string, cells: CellInput[], prov: Prov[] = [], captions: string[] = []): string {
    const numRows = Math.max(0, ...cells.map((c) => c.row + (c.rowSpan ?? 1)));
    const numCols = Math.max(0, ...cells.map((c) => c.col + (c.colSpan ?? 1)));
    return this.attach(this.tables, "tables", parent, {
      content_layer: this.layerOf(parent),
      label: "table",
      prov,
      captions: captions.map(($ref) => ({ $ref })),
      references: [],
      footnotes: [],
      annotations: [],
      data: {
        table_cells: cells.map((c) => ({
          row_span: c.rowSpan ?? 1,
          col_span: c.colSpan ?? 1,
          start_row_offset_idx: c.row,
          end_row_offset_idx: c.row + (c.rowSpan ?? 1),
          start_col_offset_idx: c.col,
          end_col_offset_idx: c.col + (c.colSpan ?? 1),
          text: c.text,
          column_header: c.header ?? false,
          row_header: c.rowHeader ?? false,
          row_section: false,
        })),
        num_rows: numRows,
        num_cols: numCols,
      },
    });
  }
  picture(parent: string, prov: Prov[] = [], captions: string[] = []): string {
    return this.attach(this.pictures, "pictures", parent, {
      content_layer: this.layerOf(parent),
      label: "picture",
      prov,
      captions: captions.map(($ref) => ({ $ref })),
      references: [],
      footnotes: [],
      annotations: [],
    });
  }
  setCaptions(ref: string, captions: string[]) {
    const node = this.nodes.get(ref);
    if (node) node.captions = captions.map(($ref) => ({ $ref }));
  }
  get(ref: string) {
    return this.nodes.get(ref);
  }
  /** Drop a group that ended up without children (keeps refs dense by building only at the end). */
  build(): Document {
    return parseDocument({
      schema_name: "DoclingDocument",
      version: DOCLING_SCHEMA_VERSION,
      name: this.name,
      origin: this.origin,
      furniture: this.furniture,
      body: this.body,
      groups: this.groups,
      texts: this.texts,
      pictures: this.pictures,
      tables: this.tables,
      key_value_items: [],
      form_items: [],
      pages: this.pages,
    });
  }
}
/** Heading-scoped parents, as Docling's HTML/Word backends nest content under the latest heading. */
export class Outline {
  private stack: { level: number; ref: string }[] = [];
  private root: string;
  constructor(root = "#/body") {
    this.root = root;
  }
  parent(): string {
    return this.stack[this.stack.length - 1]?.ref ?? this.root;
  }
  push(level: number, ref: string) {
    this.stack.push({ level, ref });
  }
  /** Parent for a new heading of `level` (title = 0). */
  open(level: number): string {
    while (this.stack.length && this.stack[this.stack.length - 1]!.level >= level) this.stack.pop();
    return this.parent();
  }
}
export function baseName(file: string): string {
  return file.replace(/^.*[\\/]/, "").replace(/\.[^.]+$/, "") || "document";
}
