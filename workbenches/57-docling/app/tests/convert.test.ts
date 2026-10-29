import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { boxes, items, pageSizes, type Document, type Item } from "../src/contracts/docling.ts";
import { convertLocal, alignSegments } from "../src/contracts/convert/index.ts";
import { convertHtml } from "../src/contracts/convert/html.ts";
import { convertMarkdown } from "../src/contracts/convert/markdown.ts";
import { readPdf } from "../src/contracts/convert/pdf-extract.ts";
import { layoutPdf, joinText } from "../src/contracts/convert/pdf-layout.ts";
import { cleanText } from "../src/contracts/convert/builder.ts";
import { parseXml } from "../src/contracts/convert/xml.ts";
import { markdown } from "../src/contracts/exports.ts";
import { EXAMPLES } from "../src/contracts/examples.ts";
import { fixtureUrl, resourceUrl } from "./helpers.ts";
const example = (f: string) => new Uint8Array(readFileSync(fixtureUrl("examples/" + f)));
const pdfjs = await import(pathToFileURL(resolve("node_modules/pdfjs-dist/legacy/build/pdf.mjs")).href);
async function pdfDoc(bytes: Uint8Array) {
  const pdf = await pdfjs.getDocument({ data: bytes.slice(), cMapUrl: fileURLToPath(resourceUrl("pdfjs-assets", "cmaps/")), cMapPacked: true, standardFontDataUrl: fileURLToPath(resourceUrl("pdfjs-assets", "standard_fonts/")), useWasm: false, verbosity: 0 }).promise;
  const { pages } = await readPdf(pdf, pdfjs.OPS);
  return layoutPdf(pages, "water-report.pdf", bytes);
}
const byLabel = (d: Document, label: string) => d.texts.filter((t) => t.label === label);
const grid = (t: Item) => {
  const out: string[][] = Array.from({ length: t.data!.num_rows }, () => Array(t.data!.num_cols).fill(""));
  for (const c of t.data!.table_cells) out[c.start_row_offset_idx]![c.start_col_offset_idx] = c.text;
  return out;
};
test("PDF fallback: 5-page report becomes headings, lists, captioned tables (merged across pages), a figure and furniture with page boxes", async () => {
  const { doc, warnings } = await pdfDoc(example("water-report.pdf"));
  assert.deepEqual(warnings, []);
  assert.equal(pageSizes(doc).size, 5);
  assert.equal(byLabel(doc, "title")[0]!.text, "城东水厂 2026 年第三季度出厂水水质报告");
  const headings = byLabel(doc, "section_header").map((h) => [h.text, h.level]);
  assert.deepEqual(headings.slice(0, 2), [["一、概述", 1], ["二、检测范围与方法", 1]]);
  assert.ok(headings.some(([t, l]) => t === "3.1 浊度波动分析" && l === 2));
  assert.equal(doc.tables.length, 4);
  const [t1, t2, t3, t4] = doc.tables as [Item, Item, Item, Item];
  // Table 1 continues on page 2: one table with two page boxes and the repeated header dropped.
  assert.deepEqual([...new Set(boxes(t1).map((b) => b.page))], [1, 2]);
  assert.equal(t1.data!.num_rows, 5);
  assert.deepEqual(grid(t1)[4], ["管网末梢抽检", "每周 1 次", "156", "155", "99.4%"]);
  assert.equal(t2.data!.num_cols, 7);
  assert.deepEqual(grid(t2)[3]!.slice(0, 3), ["pH", "无量纲", "6.5–8.5"]);
  // Row spans in the category column, including one continued onto the next page.
  const spans = t3.data!.table_cells.filter((c) => c.start_col_offset_idx === 0 && c.row_span > 1).map((c) => [c.text, c.row_span]);
  assert.deepEqual(spans, [["无机物", 4], ["感官与一般化学", 2], ["消毒副产物", 2]]);
  // Wrapped cell text joins into one cell.
  assert.equal(grid(t4)[2]![1], "上游降雨，原水浊度升至 146 NTU");
  const caption = doc.texts.find((t) => t.self_ref === (t1.captions as { $ref: string }[])[0]!.$ref)!;
  assert.equal(caption.text, "表 1 本季度检测频次与样品数量");
  assert.equal(doc.pictures.length, 1);
  assert.equal(doc.texts.find((t) => t.self_ref === (doc.pictures[0]!.captions as { $ref: string }[])[0]!.$ref)!.text, "图 1 第三季度日均供水量（按周）");
  const furniture = doc.texts.filter((t) => t.content_layer === "furniture");
  assert.equal(furniture.filter((t) => t.label === "page_footer").length, 5);
  assert.ok(byLabel(doc, "list_item").length >= 7);
  assert.equal(doc.groups.filter((g) => g.label === "list").length, 2);
  for (const node of [...doc.texts, ...doc.tables])
    for (const b of boxes(node)) {
      const size = pageSizes(doc).get(b.page)!;
      assert.ok(b.l >= 0 && b.r <= size.width && b.b >= 0 && b.t <= size.height && b.t > b.b, node.self_ref);
    }
  assert.ok(!markdown(doc).includes("第 1 页"));
});
test("PDF fallback reports a scan without a text layer instead of returning an empty success", () => {
  const { warnings } = layoutPdf([{ number: 1, width: 595, height: 842, runs: [], images: [{ l: 0, b: 0, r: 595, t: 842 }] }], "scan.pdf");
  assert.match(warnings[0]!, /OCR/);
});
test("Word fallback: styles, numbering, merged cells, captions and header/footer furniture", () => {
  const { doc, segments } = convertLocal("docx", example("pump-inspection.docx"), "pump-inspection.docx");
  assert.equal(doc.name, "二号泵房设备巡检作业指导书");
  assert.equal(byLabel(doc, "title").length, 1);
  const h = byLabel(doc, "section_header");
  assert.equal(h.filter((x) => x.level === 1).length, 6);
  assert.equal(h.filter((x) => x.level === 2).length, 2);
  // Content nests under its heading, as Docling's Word backend does.
  assert.equal((h[3]!.children as { $ref: string }[]).length > 0, true);
  const steps = byLabel(doc, "list_item").filter((x) => x.enumerated);
  assert.deepEqual(steps.map((x) => x.marker), ["1.", "2.", "3.", "4.", "5."]);
  const [t1, t2] = doc.tables as [Item, Item];
  const motor = t1.data!.table_cells.find((c) => c.text === "电机")!;
  assert.equal(motor.row_span, 3);
  const wide = t1.data!.table_cells.find((c) => c.text.startsWith("液位低于报警线"))!;
  assert.equal(wide.col_span, 2);
  assert.ok(t1.data!.table_cells.filter((c) => c.start_row_offset_idx === 0).every((c) => c.column_header));
  assert.equal(doc.texts.find((t) => t.self_ref === (t2.captions as { $ref: string }[])[0]!.$ref)!.text, "表 2　缺陷等级与处理时限");
  assert.deepEqual(doc.texts.filter((t) => t.content_layer === "furniture").map((t) => t.label), ["page_header", "page_footer"]);
  assert.equal(segments.filter((s) => s.ref).length, segments.length);
});
test("HTML fallback: h1 title, nested headings, row spans, figure caption; segments carry source lines", () => {
  const source = readFileSync(fixtureUrl("water-report.source.html"), "utf8");
  const { doc, segments } = convertHtml(source, "water-report.html");
  assert.equal(byLabel(doc, "title")[0]!.text, "城东水厂 2026 年第三季度出厂水水质报告");
  assert.equal(doc.tables.length, 4);
  assert.equal(doc.tables[2]!.data!.table_cells.find((c) => c.text === "无机物")!.row_span, 4);
  assert.equal(doc.pictures.length, 1);
  assert.ok(segments.every((s) => s.lines && s.lines[0] > 0));
  assert.equal(convertHtml("<p>a <b>b</b><br>c</p><script>x()</script>", "x.html").doc.texts[0]!.text, "a b\nc");
});
test("Markdown fallback: nested list, GFM table, code block and line ranges", () => {
  const { doc, segments } = convertMarkdown(readFileSync(fixtureUrl("examples/shift-handover.md"), "utf8"), "shift-handover.md");
  assert.equal(byLabel(doc, "title")[0]!.text, "泵站夜班交接记录");
  const nested = doc.groups.find((g) => (g.parent as { $ref: string }).$ref.startsWith("#/texts/"));
  assert.ok(nested, "nested list group under a list item");
  assert.equal(doc.tables[0]!.data!.num_rows, 5);
  assert.equal(byLabel(doc, "code").length, 1);
  assert.deepEqual(segments.find((s) => s.kind === "table")!.lines, [14, 19]);
  assert.ok(markdown(doc).includes("  - 机械密封有轻微渗漏"));
});
test("segments align to a document produced by another engine by text", () => {
  const local = convertLocal("md", example("shift-handover.md"), "shift-handover.md");
  const other = convertMarkdown("# 泵站夜班交接记录\n\n## 设备状态\n", "x.md").doc;
  const aligned = alignSegments(local.segments, other);
  assert.equal(aligned[0]!.ref, "#/texts/0");
  assert.equal(aligned.filter((s) => s.ref).length, 2);
});
test("Markdown list source ranges follow continuation lines, blank lines and nested siblings", () => {
  const source = "- Parent\n  continued\n\n  - Child one\n  - Child two\n- Sibling\n";
  const lists = convertMarkdown(source, "ranges.md").segments.filter((s) => s.kind === "list");
  assert.deepEqual(lists.map((s) => s.lines), [[1, 5], [4, 4], [5, 5], [6, 6]]);
  const crlf = convertMarkdown(source.replaceAll("\n", "\r\n"), "ranges.md").segments;
  assert.deepEqual(crlf, convertMarkdown(source, "ranges.md").segments);
});
test("text cleanup, line joining and XML entities", () => {
  assert.equal(cleanText("城东⽔⼚\u0001报告"), "城东水厂 报告");
  assert.equal(joinText("供水", "29.2 万"), "供水29.2 万");
  assert.equal(joinText("water treat-", "ment plant"), "water treatment plant");
  assert.equal(joinText("daily", "report"), "daily report");
  assert.equal(parseXml('<a x="1&amp;2"><b>&#x6c34;</b><![CDATA[<raw>]]></a>').children[0]!.children[0]!.text, "水");
});
test("bundled examples match their content hashes and the current converters", async () => {
  const sha = (b: Uint8Array | string) => createHash("sha256").update(b).digest("hex");
  for (const e of EXAMPLES) {
    const bytes = example(e.sourceFile);
    assert.equal(sha(bytes), e.document.source.id, e.key);
    const stored = readFileSync(fixtureUrl("examples/" + e.documentFile), "utf8");
    assert.equal(sha(stored), e.document.id, e.key);
    const fresh = e.document.source.format === "pdf" ? (await pdfDoc(bytes)).doc : convertLocal(e.document.source.format, bytes, e.sourceFile).doc;
    assert.equal(JSON.stringify({ ...fresh, name: "" }), JSON.stringify({ ...JSON.parse(stored), name: "" }), e.key + " is stale; run app/tools/build-examples.ts");
  }
  assert.equal(items(JSON.parse(readFileSync(fixtureUrl("examples/water-report.docling.json"), "utf8"))).length > 40, true);
});
