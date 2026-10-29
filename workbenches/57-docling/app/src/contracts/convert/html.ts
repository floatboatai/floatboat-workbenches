// ABOUTME: HTML 本地后备解析（parse5 规范解析）：标题层级、段落、嵌套列表、合并单元格表格、图片/图注、代码与页眉页脚。
import { parse } from "parse5";
import { DocBuilder, Outline, baseName, binaryHash, cleanText, type CellInput } from "./builder.ts";
import type { Conversion, Segment } from "./segments.ts";
interface P5Node {
  nodeName: string;
  tagName?: string;
  value?: string;
  attrs?: { name: string; value: string }[];
  childNodes?: P5Node[];
  content?: P5Node;
  sourceCodeLocation?: { startLine: number; endLine: number } | null;
}
const SKIP = new Set(["script", "style", "template", "noscript", "svg", "math", "head", "iframe", "object", "canvas", "button", "select", "input", "textarea", "form"]);
const BLOCK = new Set([
  "p", "h1", "h2", "h3", "h4", "h5", "h6", "ul", "ol", "table", "pre", "blockquote", "figure", "img", "hr",
  "div", "section", "article", "main", "aside", "header", "footer", "nav", "dl", "dt", "dd", "address",
  "li", "details", "summary", "figcaption", "caption", "body", "html", "center",
]);
const attr = (n: P5Node, name: string) => n.attrs?.find((a) => a.name === name)?.value;
const tag = (n: P5Node) => (n.tagName ?? "").toLowerCase();
function inlineText(n: P5Node, stopAtLists = false): string {
  let out = "";
  const stack = [n];
  while (stack.length) {
    const x = stack.pop()!;
    if (x.nodeName === "#text") out += (x.value ?? "").replace(/\s+/g, " ");
    else if (tag(x) === "br") out += "\n";
    else if (SKIP.has(tag(x)) || (stopAtLists && x !== n && (tag(x) === "ul" || tag(x) === "ol"))) continue;
    else {
      const kids = x.childNodes ?? [];
      for (let i = kids.length - 1; i >= 0; i--) stack.push(kids[i]!);
      if (x !== n && BLOCK.has(tag(x))) out += " ";
    }
  }
  return cleanText(out);
}
function lines(n: P5Node): [number, number] | undefined {
  const loc = n.sourceCodeLocation;
  return loc ? [loc.startLine, loc.endLine] : undefined;
}
function readTable(table: P5Node): { cells: CellInput[]; rows: string[][]; caption: string } {
  const rowsNodes: P5Node[] = [];
  let caption = "";
  const collect = (n: P5Node) => {
    for (const c of n.childNodes ?? []) {
      const t = tag(c);
      if (t === "tr") rowsNodes.push(c);
      else if (t === "thead" || t === "tbody" || t === "tfoot") collect(c);
      else if (t === "caption") caption = inlineText(c);
    }
  };
  collect(table);
  const occupied: boolean[][] = [];
  const cells: CellInput[] = [];
  rowsNodes.forEach((tr, r) => {
    occupied[r] ??= [];
    let col = 0;
    for (const td of tr.childNodes ?? []) {
      const t = tag(td);
      if (t !== "td" && t !== "th") continue;
      while (occupied[r]![col]) col++;
      const rowSpan = Math.max(1, Math.min(rowsNodes.length - r, Number(attr(td, "rowspan")) || 1));
      const colSpan = Math.max(1, Math.min(1000, Number(attr(td, "colspan")) || 1));
      for (let i = 0; i < rowSpan; i++)
        for (let k = 0; k < colSpan; k++) (occupied[r + i] ??= [])[col + k] = true;
      cells.push({ text: inlineText(td), row: r, col, rowSpan, colSpan, header: t === "th", rowHeader: t === "th" && attr(td, "scope") === "row" });
      col += colSpan;
    }
  });
  const numCols = Math.max(0, ...cells.map((c) => c.col + (c.colSpan ?? 1)));
  const rows = rowsNodes.map(() => Array<string>(numCols).fill(""));
  for (const c of cells) rows[c.row]![c.col] = c.text;
  for (const c of cells) if (c.rowHeader) c.header = false;
  return { cells, rows, caption };
}
export function convertHtml(source: string, filename: string, bytes?: Uint8Array): Conversion {
  const root = parse(source, { sourceCodeLocationInfo: true }) as unknown as P5Node;
  let title = "";
  const findTitle = (n: P5Node) => {
    for (const c of n.childNodes ?? []) {
      if (tag(c) === "title" && !title) title = inlineText(c);
      else if (tag(c) === "head" || tag(c) === "html") findTitle(c);
    }
  };
  findTitle(root);
  const b = new DocBuilder(title || baseName(filename), {
    mimetype: "text/html",
    filename,
    binary_hash: binaryHash(bytes ?? new TextEncoder().encode(source)),
  });
  const segments: Segment[] = [];
  const outline = new Outline();
  let sawTitle = false;
  const paragraph = (parent: string, text: string, label: string, at?: [number, number]) => {
    if (!text) return "";
    const ref = b.text(parent, label, text);
    segments.push({ kind: label === "caption" ? "caption" : label === "code" ? "code" : b.layerOf(parent) === "furniture" ? "furniture" : "text", text, ref, lines: at });
    return ref;
  };
  function list(node: P5Node, parent: string) {
    const ordered = tag(node) === "ol";
    const group = b.group(parent, "list", "list");
    let n = Number(attr(node, "start")) || 1;
    for (const li of node.childNodes ?? []) {
      if (tag(li) !== "li") continue;
      const text = inlineText(li, true);
      const marker = ordered ? `${n++}.` : "";
      const ref = b.listItem(group, text, ordered, marker);
      segments.push({ kind: "list", text: (marker || "•") + " " + text, ref, lines: lines(li) });
      const nested = (x: P5Node) => {
        for (const c of x.childNodes ?? []) {
          if (tag(c) === "ul" || tag(c) === "ol") list(c, ref);
          else if (c.childNodes && !SKIP.has(tag(c))) nested(c);
        }
      };
      nested(li);
    }
  }
  function walk(node: P5Node, layer: "body" | "furniture") {
    let inline: P5Node[] = [];
    const flush = () => {
      if (!inline.length) return;
      const text = cleanText(inline.map((x) => (x.nodeName === "#text" ? (x.value ?? "").replace(/\s+/g, " ") : inlineText(x))).join(""));
      const first = inline[0]!, last = inline[inline.length - 1]!;
      const at = first.sourceCodeLocation && last.sourceCodeLocation ? ([first.sourceCodeLocation.startLine, last.sourceCodeLocation.endLine] as [number, number]) : undefined;
      paragraph(layer === "furniture" ? "#/furniture" : outline.parent(), text, layer === "furniture" ? "page_header" : "text", at);
      inline = [];
    };
    const kids = node.content?.childNodes ?? node.childNodes ?? [];
    for (const c of kids) {
      const t = tag(c);
      if (c.nodeName === "#comment" || c.nodeName === "#documentType") continue;
      if (c.nodeName === "#text" || (!BLOCK.has(t) && !SKIP.has(t) && t !== "title")) {
        inline.push(c);
        continue;
      }
      flush();
      if (SKIP.has(t) || t === "title") continue;
      const parent = layer === "furniture" ? "#/furniture" : outline.parent();
      const at = lines(c);
      if (/^h[1-6]$/.test(t)) {
        const text = inlineText(c);
        if (!text) continue;
        if (layer === "furniture") paragraph("#/furniture", text, "page_header", at);
        else if (t === "h1" && !sawTitle) {
          sawTitle = true;
          const ref = b.text(outline.open(0), "title", text);
          outline.push(0, ref);
          segments.push({ kind: "title", text, ref, lines: at });
        } else {
          const level = Math.max(1, Number(t[1]) - 1);
          const ref = b.heading(outline.open(level), text, level);
          outline.push(level, ref);
          segments.push({ kind: "heading", text, ref, lines: at });
        }
      } else if (t === "p" || t === "dt" || t === "dd" || t === "address" || t === "summary")
        paragraph(parent, inlineText(c), layer === "furniture" ? "page_header" : "text", at);
      else if (t === "pre") paragraph(parent, (c.childNodes ?? []).map((x) => inlineRaw(x)).join("").replace(/^\n/, "").trimEnd(), "code", at);
      else if (t === "ul" || t === "ol") {
        list(c, parent);
      } else if (t === "table") {
        const { cells, rows, caption } = readTable(c);
        if (!cells.length) continue;
        const cap = caption ? b.text(parent, "caption", caption) : "";
        const ref = b.table(parent, cells, [], cap ? [cap] : []);
        if (cap) segments.push({ kind: "caption", text: caption, ref: cap, lines: at });
        segments.push({ kind: "table", text: rows.map((r) => r.join(" ")).join(" "), rows, ref, lines: at });
      } else if (t === "img") {
        const ref = b.picture(parent);
        segments.push({ kind: "picture", text: attr(c, "alt") || "［图像］", ref, lines: at });
      } else if (t === "figure") {
        const caps = (c.childNodes ?? []).filter((x) => tag(x) === "figcaption");
        const captionText = caps.map((x) => inlineText(x)).join(" ");
        const hasTable = (c.childNodes ?? []).some((x) => tag(x) === "table");
        if (hasTable) walk({ ...c, childNodes: (c.childNodes ?? []).filter((x) => tag(x) !== "figcaption") }, layer);
        const capRef = captionText ? b.text(parent, "caption", captionText) : "";
        if (!hasTable) {
          const ref = b.picture(parent, [], capRef ? [capRef] : []);
          segments.push({ kind: "picture", text: "［图像］", ref, lines: at });
        } else if (capRef) {
          const lastTable = b.tables[b.tables.length - 1];
          if (lastTable) b.setCaptions(lastTable.self_ref, [capRef]);
        }
        if (capRef) segments.push({ kind: "caption", text: captionText, ref: capRef, lines: at });
      } else if ((t === "header" || t === "footer" || t === "nav") && layer === "body" && tag(node) === "body") {
        walk(c, "furniture");
      } else if (t === "hr") continue;
      else walk(c, layer);
    }
    flush();
  }
  walk(root, "body");
  const warnings = b.texts.length || b.tables.length ? [] : ["HTML 中没有可识别的正文内容。"];
  return { doc: b.build(), segments, warnings };
}
function inlineRaw(n: P5Node): string {
  if (n.nodeName === "#text") return n.value ?? "";
  if (tag(n) === "br") return "\n";
  return (n.childNodes ?? []).map(inlineRaw).join("");
}
