// ABOUTME: 校订后 DoclingDocument 的 Markdown、HTML 与 CSV 投影；排除页眉页脚等 furniture 层。
import { items, tableRows, type Document, type Item } from "./docling.ts";
import { isRecord } from "./project.ts";
const isFurniture = (n: Item) => n.content_layer === "furniture";
const kind = (n: Item) => n.self_ref.split("/")[1] ?? "";
function bodyRows(doc: Document) {
  // Furniture subtrees (page headers/footers) are skipped together with their descendants.
  const rows = items(doc),
    skipped = new Set<string>();
  return rows.filter(({ item }) => {
    const parent = isRecord(item.parent) ? String(item.parent.$ref) : "";
    if (isFurniture(item) || skipped.has(parent)) {
      skipped.add(item.self_ref);
      return false;
    }
    return true;
  });
}
/** Grid with merged cells repeated over their span, as Docling's own Markdown export does. */
export function spanGrid(node: Item): string[][] {
  const d = node.data;
  if (!d) return [];
  const rows = Array.from({ length: d.num_rows }, () => Array<string>(d.num_cols).fill(""));
  for (const c of d.table_cells)
    for (let r = c.start_row_offset_idx; r < c.start_row_offset_idx + c.row_span; r++)
      for (let k = c.start_col_offset_idx; k < c.start_col_offset_idx + c.col_span; k++)
        rows[r]![k] = c.text;
  return rows;
}
function markdownTable(node: Item): string {
  const rows = spanGrid(node);
  if (!rows.length || !rows[0]!.length) return "";
  const fmt = (row: string[]) =>
    "| " +
    row.map((x) => x.replaceAll("|", "\\|").replaceAll("\n", "<br>")).join(" | ") +
    " |";
  return [fmt(rows[0]!), fmt(rows[0]!.map(() => "---")), ...rows.slice(1).map(fmt)].join("\n");
}
function headingLevel(n: Item) {
  return Math.min(6, Math.max(2, (Number(n.level) || 1) + 1));
}
function listDepth(n: Item, byRef: Map<string, Item>): number {
  let depth = -1,
    cursor: Item | undefined = n,
    guard = 0;
  while (cursor && guard++ < 64) {
    if (kind(cursor) === "groups" && /list/.test(cursor.label)) depth++;
    cursor = isRecord(cursor.parent) ? byRef.get(String(cursor.parent.$ref)) : undefined;
  }
  return Math.max(0, depth);
}
export function markdown(doc: Document | null): string {
  if (!doc) return "";
  const out: string[] = [];
  const byRef = new Map(items(doc).map((r) => [r.item.self_ref, r.item]));
  for (const { item: n } of bodyRows(doc)) {
    if (n.data) {
      const t = markdownTable(n);
      if (t) out.push(t);
      continue;
    }
    if (kind(n) === "pictures") {
      out.push("<!-- image -->");
      continue;
    }
    if (kind(n) === "groups") continue;
    const text = n.text ?? "";
    if (!text.trim()) continue;
    if (n.label === "title") out.push("# " + text);
    else if (n.label === "section_header") out.push("#".repeat(headingLevel(n)) + " " + text);
    else if (n.label === "list_item") {
      const marker = n.enumerated === true && typeof n.marker === "string" && n.marker ? n.marker : "-";
      const indent = "  ".repeat(listDepth(n, byRef));
      // Consecutive items form one Markdown list.
      if (out.length && /^\s*(?:-|\d+[.)])\s/.test(out[out.length - 1]!.split("\n").pop() ?? ""))
        out[out.length - 1] += "\n" + indent + marker + " " + text;
      else out.push(indent + marker + " " + text);
    } else if (n.label === "code" || n.label === "formula")
      out.push("```\n" + text + "\n```");
    else out.push(text);
  }
  return out.join("\n\n") + "\n";
}
const esc = (s: string) =>
  s.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
function htmlTable(node: Item, caption: string): string {
  const d = node.data!;
  const rows: string[] = [];
  for (let r = 0; r < d.num_rows; r++) {
    const cells = d.table_cells
      .filter((c) => c.start_row_offset_idx === r)
      .sort((a, b) => a.start_col_offset_idx - b.start_col_offset_idx)
      .map((c) => {
        const tag = c.column_header || c.row_header ? "th" : "td";
        const span =
          (c.row_span > 1 ? ` rowspan="${c.row_span}"` : "") +
          (c.col_span > 1 ? ` colspan="${c.col_span}"` : "");
        return `<${tag}${span}>${esc(c.text).replaceAll("\n", "<br>")}</${tag}>`;
      });
    rows.push("<tr>" + cells.join("") + "</tr>");
  }
  return `<table>${caption ? `<caption>${esc(caption)}</caption>` : ""}<tbody>${rows.join("")}</tbody></table>`;
}
export function html(doc: Document | null, title = doc?.name ?? ""): string {
  if (!doc) return "";
  const byRef = new Map(items(doc).map((r) => [r.item.self_ref, r.item]));
  const captionRefs = new Set<string>();
  for (const n of [...doc.tables, ...doc.pictures])
    if (Array.isArray(n.captions))
      for (const c of n.captions) if (isRecord(c)) captionRefs.add(String(c.$ref));
  const captionOf = (n: Item) =>
    Array.isArray(n.captions)
      ? n.captions
          .map((c) => (isRecord(c) ? byRef.get(String(c.$ref))?.text ?? "" : ""))
          .filter(Boolean)
          .join(" ")
      : "";
  const body: string[] = [];
  let list: "ul" | "ol" | null = null;
  const close = () => {
    if (list) body.push(`</${list}>`);
    list = null;
  };
  for (const { item: n } of bodyRows(doc)) {
    if (kind(n) === "groups") continue;
    if (n.label === "list_item") {
      const want = n.enumerated === true ? "ol" : "ul";
      if (list !== want) {
        close();
        body.push(`<${want}>`);
        list = want;
      }
      body.push(`<li>${esc(n.text ?? "")}</li>`);
      continue;
    }
    close();
    if (n.data) body.push(htmlTable(n, captionOf(n)));
    else if (kind(n) === "pictures")
      body.push(`<figure><div class="placeholder">［图像］</div>${captionOf(n) ? `<figcaption>${esc(captionOf(n))}</figcaption>` : ""}</figure>`);
    else if (captionRefs.has(n.self_ref)) continue;
    else if (n.label === "title") body.push(`<h1>${esc(n.text ?? "")}</h1>`);
    else if (n.label === "section_header") {
      const h = headingLevel(n);
      body.push(`<h${h}>${esc(n.text ?? "")}</h${h}>`);
    } else if (n.label === "code" || n.label === "formula")
      body.push(`<pre><code>${esc(n.text ?? "")}</code></pre>`);
    else if (n.label === "footnote") body.push(`<p class="footnote">${esc(n.text ?? "")}</p>`);
    else if (n.text?.trim()) body.push(`<p>${esc(n.text)}</p>`);
  }
  close();
  return `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="generator" content="Floatboat Docling 工作台">
<title>${esc(title)}</title>
<style>body{max-width:46rem;margin:2rem auto;padding:0 1rem;font:16px/1.7 system-ui,sans-serif;color:#1c2430}table{border-collapse:collapse;margin:1rem 0;width:100%}th,td{border:1px solid #9aa6b2;padding:.3rem .5rem;text-align:left;vertical-align:top}th{background:#eef2f6}caption{text-align:left;font-weight:600;padding:.3rem 0}.footnote{font-size:.85em;color:#4d5866}.placeholder{border:1px dashed #9aa6b2;padding:1.5rem;text-align:center;color:#4d5866}</style>
</head>
<body>
${body.join("\n")}
</body>
</html>
`;
}
const csvCell = (s: string) =>
  '"' + (/^[=+@\-\t\r]/.test(s) ? "'" : "") + s.replaceAll('"', '""') + '"';
export function tableCsv(node: Item): string {
  return tableRows(node)
    .map((r) => r.map(csvCell).join(","))
    .join("\r\n");
}
/** Every body table in reading order, separated by a blank line and a caption row. */
export function tablesCsv(doc: Document | null): string {
  if (!doc) return "";
  const byRef = new Map(items(doc).map((r) => [r.item.self_ref, r.item]));
  return bodyRows(doc)
    .filter((r) => r.item.data)
    .map(({ item }, i) => {
      const caption = Array.isArray(item.captions)
        ? item.captions.map((c) => (isRecord(c) ? byRef.get(String(c.$ref))?.text ?? "" : "")).join(" ")
        : "";
      return csvCell(caption || `Table ${i + 1}`) + "\r\n" + tableCsv(item);
    })
    .join("\r\n\r\n");
}
