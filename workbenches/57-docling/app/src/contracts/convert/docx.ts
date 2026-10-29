// ABOUTME: Word (.docx) 本地后备解析：样式标题层级、编号/项目列表、合并单元格表格、题注、页眉页脚与图片占位。
import { unzipSync, strFromU8 } from "fflate";
import { DocBuilder, Outline, baseName, binaryHash, cleanText, type CellInput } from "./builder.ts";
import { parseXml, child, childrenNamed, find, type XmlNode } from "./xml.ts";
import type { Conversion, Segment } from "./segments.ts";
const MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const MAX_XML = 64 * 1024 * 1024;
interface Style {
  name: string;
  outline?: number;
  basedOn?: string;
  numId?: string;
}
type Role =
  | { kind: "title" }
  | { kind: "heading"; level: number }
  | { kind: "caption" }
  | { kind: "text" };
function readStyles(root: XmlNode | undefined): Map<string, Style> {
  const map = new Map<string, Style>();
  for (const s of childrenNamed(child(root, "w:styles"), "w:style")) {
    const id = s.attrs["w:styleId"];
    if (!id) continue;
    const pPr = child(s, "w:pPr");
    const outline = child(pPr, "w:outlineLvl")?.attrs["w:val"];
    map.set(id, {
      name: child(s, "w:name")?.attrs["w:val"] ?? id,
      outline: outline === undefined ? undefined : Number(outline),
      basedOn: child(s, "w:basedOn")?.attrs["w:val"],
      numId: child(child(pPr, "w:numPr"), "w:numId")?.attrs["w:val"],
    });
  }
  return map;
}
function styleRole(styles: Map<string, Style>, id: string | undefined, outline?: number): Role {
  let current = id,
    guard = 0,
    level = outline;
  while (current && guard++ < 20) {
    const s = styles.get(current);
    const name = (s?.name ?? current).toLowerCase().replace(/\s+/g, " ");
    if (/^(title|标题)$/.test(name)) return { kind: "title" };
    const h = /^(?:heading|标题)\s*(\d)$/.exec(name);
    if (h) return { kind: "heading", level: Number(h[1]) };
    if (/^(caption|题注)$/.test(name)) return { kind: "caption" };
    if (level === undefined && s?.outline !== undefined) level = s.outline;
    current = s?.basedOn;
  }
  if (level !== undefined && level >= 0 && level < 9) return { kind: "heading", level: level + 1 };
  return { kind: "text" };
}
interface Level {
  format: string;
  text: string;
  start: number;
}
function readNumbering(root: XmlNode | undefined) {
  const abstract = new Map<string, Map<number, Level>>(),
    nums = new Map<string, string>();
  const numbering = child(root, "w:numbering");
  for (const a of childrenNamed(numbering, "w:abstractNum")) {
    const levels = new Map<number, Level>();
    for (const l of childrenNamed(a, "w:lvl"))
      levels.set(Number(l.attrs["w:ilvl"] ?? 0), {
        format: child(l, "w:numFmt")?.attrs["w:val"] ?? "decimal",
        text: child(l, "w:lvlText")?.attrs["w:val"] ?? "%1.",
        start: Number(child(l, "w:start")?.attrs["w:val"] ?? 1),
      });
    abstract.set(a.attrs["w:abstractNumId"] ?? "", levels);
  }
  for (const n of childrenNamed(numbering, "w:num"))
    nums.set(n.attrs["w:numId"] ?? "", child(n, "w:abstractNumId")?.attrs["w:val"] ?? "");
  return (numId: string, ilvl: number): Level | undefined =>
    abstract.get(nums.get(numId) ?? "")?.get(ilvl);
}
const roman = (n: number) => {
  const map: [number, string][] = [[1000, "m"], [900, "cm"], [500, "d"], [400, "cd"], [100, "c"], [90, "xc"], [50, "l"], [40, "xl"], [10, "x"], [9, "ix"], [5, "v"], [4, "iv"], [1, "i"]];
  let out = "";
  for (const [v, s] of map) while (n >= v) { out += s; n -= v; }
  return out;
};
function formatNumber(format: string, n: number): string {
  if (format === "lowerLetter") return String.fromCharCode(96 + (((n - 1) % 26) + 1));
  if (format === "upperLetter") return String.fromCharCode(64 + (((n - 1) % 26) + 1));
  if (format === "lowerRoman") return roman(n);
  if (format === "upperRoman") return roman(n).toUpperCase();
  if (format === "chineseCounting" || format === "chineseCountingThousand" || format === "ideographTraditional")
    return "〇一二三四五六七八九十"[n] ?? String(n);
  return String(n);
}
/** Paragraph text from runs, hyperlinks, insertions and simple fields; deleted text is skipped. */
function paragraphText(p: XmlNode, pictures: { count: number }): string {
  let out = "";
  const stack = [...p.children].reverse();
  while (stack.length) {
    const n = stack.pop()!;
    switch (n.name) {
      case "w:t":
        out += n.text;
        break;
      case "w:tab":
      case "w:ptab":
        out += "\t";
        break;
      case "w:br":
      case "w:cr":
        out += "\n";
        break;
      case "w:noBreakHyphen":
        out += "-";
        break;
      case "w:del":
      case "w:instrText":
      case "w:pPr":
      case "w:rPr":
      case "w:delText":
        break;
      case "w:drawing":
      case "w:pict":
      case "w:object":
        pictures.count++;
        break;
      default:
        for (let k = n.children.length - 1; k >= 0; k--) stack.push(n.children[k]!);
    }
  }
  return out;
}
function cellText(tc: XmlNode): string {
  const parts: string[] = [];
  const stack = [...tc.children].reverse();
  while (stack.length) {
    const n = stack.pop()!;
    if (n.name === "w:p") parts.push(cleanText(paragraphText(n, { count: 0 })));
    else if (n.name !== "w:tcPr") for (let k = n.children.length - 1; k >= 0; k--) stack.push(n.children[k]!);
  }
  return parts.filter(Boolean).join("\n");
}
function readTable(tbl: XmlNode): { cells: CellInput[]; rows: string[][] } {
  const cells: CellInput[] = [];
  const open = new Map<number, CellInput>();
  const trs = childrenNamed(tbl, "w:tr");
  let anyHeader = false;
  trs.forEach((tr, r) => {
    const trPr = child(tr, "w:trPr");
    const header = !!child(trPr, "w:tblHeader");
    anyHeader ||= header;
    let col = Number(child(trPr, "w:gridBefore")?.attrs["w:val"] ?? 0);
    for (const tc of childrenNamed(tr, "w:tc")) {
      const pr = child(tc, "w:tcPr");
      const span = Math.max(1, Number(child(pr, "w:gridSpan")?.attrs["w:val"] ?? 1) || 1);
      const vm = child(pr, "w:vMerge");
      const text = cellText(tc);
      if (vm && vm.attrs["w:val"] !== "restart" && open.has(col)) {
        const above = open.get(col)!;
        above.rowSpan = r - above.row + 1;
      } else {
        const cell: CellInput = { text, row: r, col, colSpan: span, rowSpan: 1, header };
        cells.push(cell);
        if (vm) open.set(col, cell);
        else open.delete(col);
      }
      col += span;
    }
  });
  if (!anyHeader) for (const c of cells) if (c.row === 0) c.header = true;
  const numCols = Math.max(0, ...cells.map((c) => c.col + (c.colSpan ?? 1)));
  const rows = trs.map(() => Array<string>(numCols).fill(""));
  for (const c of cells) rows[c.row]![c.col] = c.text;
  return { cells, rows };
}
export function convertDocx(bytes: Uint8Array, filename: string): Conversion {
  let files: Record<string, Uint8Array>;
  try {
    files = unzipSync(bytes, {
      filter: (f) =>
        f.originalSize <= MAX_XML &&
        (/^word\/(document|styles|numbering)\.xml$/.test(f.name) ||
          /^word\/(header|footer)\d*\.xml$/.test(f.name) ||
          f.name === "word/_rels/document.xml.rels" ||
          f.name === "docProps/core.xml"),
    });
  } catch {
    throw new Error("Word 文件无法解压，可能已损坏或不是 .docx（旧版 .doc 请先另存为 .docx）。");
  }
  const xml = (name: string) => (files[name] ? parseXml(strFromU8(files[name]!)) : undefined);
  const document = xml("word/document.xml");
  const body = child(child(document, "w:document"), "w:body");
  if (!body) throw new Error("Word 文件缺少正文 word/document.xml。");
  const styles = readStyles(xml("word/styles.xml"));
  const level = readNumbering(xml("word/numbering.xml"));
  const title = cleanText(find(xml("docProps/core.xml"), "dc:title")?.text ?? "");
  const b = new DocBuilder(title || baseName(filename), {
    mimetype: MIME,
    filename,
    binary_hash: binaryHash(bytes),
  });
  const segments: Segment[] = [];
  const warnings: string[] = [];
  const outline = new Outline();
  const counters = new Map<string, number[]>();
  let list: { numId: string; stack: { ilvl: number; group: string; last: string }[] } | null = null;
  let pendingCaption: string | null = null,
    lastTable: string | null = null,
    lastWasTable = false;
  const pictures = { count: 0 };
  const handleParagraph = (p: XmlNode) => {
    const pPr = child(p, "w:pPr");
    const styleId = child(pPr, "w:pStyle")?.attrs["w:val"];
    const numPr = child(pPr, "w:numPr");
    const before = pictures.count;
    const text = cleanText(paragraphText(p, pictures));
    const pics = pictures.count - before;
    const outlineLvl = child(pPr, "w:outlineLvl")?.attrs["w:val"];
    const role = styleRole(styles, styleId, outlineLvl === undefined ? undefined : Number(outlineLvl));
    const numId = numPr ? child(numPr, "w:numId")?.attrs["w:val"] : styles.get(styleId ?? "")?.numId;
    const ilvl = Number(child(numPr, "w:ilvl")?.attrs["w:val"] ?? 0);
    const wasTable = lastWasTable;
    lastWasTable = false;
    for (let i = 0; i < pics; i++) {
      const ref = b.picture(outline.parent());
      segments.push({ kind: "picture", text: "［图像］", ref });
    }
    if (!text) return;
    if (role.kind === "heading" || role.kind === "title") list = null;
    if (role.kind === "title") {
      const ref = b.text(outline.open(0), "title", text);
      outline.push(0, ref);
      segments.push({ kind: "title", text, ref });
      return;
    }
    if (role.kind === "heading") {
      const ref = b.heading(outline.open(role.level), text, role.level);
      outline.push(role.level, ref);
      segments.push({ kind: "heading", text, ref });
      return;
    }
    if (numId && numId !== "0") {
      const def = level(numId, ilvl);
      const enumerated = !!def && def.format !== "bullet" && def.format !== "none";
      const counts = counters.get(numId) ?? [];
      counts[ilvl] = (counts[ilvl] ?? (def?.start ?? 1) - 1) + 1;
      counts.length = ilvl + 1;
      counters.set(numId, counts);
      const marker = enumerated
        ? (def?.text ?? "%1.").replace(/%(\d)/g, (_, d: string) =>
            formatNumber(level(numId, Number(d) - 1)?.format ?? "decimal", counts[Number(d) - 1] ?? 1),
          )
        : "";
      if (!list || list.numId !== numId) list = { numId, stack: [] };
      while (list.stack.length && list.stack[list.stack.length - 1]!.ilvl > ilvl) list.stack.pop();
      let top = list.stack[list.stack.length - 1];
      if (!top || top.ilvl < ilvl) {
        const parent = top ? top.last : outline.parent();
        const group = b.group(parent, "list", "list");
        top = { ilvl, group, last: "" };
        list.stack.push(top);
      }
      const ref = b.listItem(top.group, text, enumerated, marker);
      top.last = ref;
      segments.push({ kind: "list", text: (marker ? marker + " " : "• ") + text, ref });
      return;
    }
    list = null;
    if (role.kind === "caption" || /^(表|图|table|figure|fig\.)\s*\d+/i.test(text)) {
      const ref = b.text(outline.parent(), "caption", text);
      segments.push({ kind: "caption", text, ref });
      if (wasTable && lastTable) b.setCaptions(lastTable, [ref]);
      else pendingCaption = ref;
      return;
    }
    pendingCaption = null;
    const ref = b.text(outline.parent(), "text", text);
    segments.push({ kind: "text", text, ref });
  };
  const handleTable = (tbl: XmlNode) => {
    list = null;
    const { cells, rows } = readTable(tbl);
    if (!cells.length) return;
    const ref = b.table(outline.parent(), cells, [], pendingCaption ? [pendingCaption] : []);
    pendingCaption = null;
    lastTable = ref;
    lastWasTable = true;
    segments.push({ kind: "table", text: rows.map((r) => r.join(" ")).join(" "), rows, ref });
  };
  const walk = (node: XmlNode) => {
    for (const n of node.children) {
      if (n.name === "w:p") handleParagraph(n);
      else if (n.name === "w:tbl") handleTable(n);
      else if (n.name === "w:sdt") walk(child(n, "w:sdtContent") ?? n);
      else if (n.name === "w:customXml" || n.name === "w:ins") walk(n);
    }
  };
  walk(body);
  // Page headers/footers referenced by the sections become furniture.
  const rels = new Map(
    childrenNamed(child(xml("word/_rels/document.xml.rels"), "Relationships"), "Relationship").map((r) => [
      r.attrs.Id ?? "",
      r.attrs.Target ?? "",
    ]),
  );
  const seen = new Set<string>();
  const sections = [child(body, "w:sectPr"), ...childrenNamed(body, "w:p").map((p) => child(child(p, "w:pPr"), "w:sectPr"))];
  for (const sect of sections) {
    for (const refNode of sect?.children ?? []) {
      const kind = refNode.name === "w:headerReference" ? "page_header" : refNode.name === "w:footerReference" ? "page_footer" : "";
      const target = rels.get(refNode.attrs["r:id"] ?? "");
      if (!kind || !target || seen.has(target)) continue;
      seen.add(target);
      const part = xml("word/" + target.replace(/^\.?\//, ""));
      for (const p of childrenNamed(child(part, kind === "page_header" ? "w:hdr" : "w:ftr"), "w:p")) {
        const text = cleanText(paragraphText(p, { count: 0 }));
        if (!text) continue;
        const ref = b.text("#/furniture", kind, text);
        segments.push({ kind: "furniture", text, ref });
      }
    }
  }
  if (!b.texts.length && !b.tables.length) warnings.push("Word 文件中没有可识别的正文段落或表格。");
  return { doc: b.build(), segments, warnings };
}
