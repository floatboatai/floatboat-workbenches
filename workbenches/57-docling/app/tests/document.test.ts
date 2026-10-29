import assert from "node:assert/strict";
import { test } from "node:test";
import { items, parseDocument } from "../src/contracts/docling.ts";
import { assertMatches, corrected, moveSibling, restoreReviewDraft, validateReview } from "../src/contracts/review.ts";
import { html, markdown, tableCsv, tablesCsv } from "../src/contracts/exports.ts";
import { realDocling, reviewOf } from "./helpers.ts";
test("real Docling core output imports body hierarchy, furniture and table", () => {
  const doc = parseDocument(realDocling);
  assert.equal(items(doc).length, 6);
  assert.equal(doc.tables[0]!.data!.table_cells.length, 9);
  assert.equal(items(doc)[4]!.item.self_ref, "#/tables/0");
});
test("correction layer keeps orig, references and grid while applying text, cells, type and level", () => {
  const { review, doc } = reviewOf();
  review.corrections["#/texts/2"] = { text: "Reviewed paragraph", reviewed: true, note: "checked" };
  review.corrections["#/tables/0"] = { cells: { "4": "13" }, reviewed: true, note: "" };
  review.corrections["#/texts/3"] = { label: "section_header", level: 3, reviewed: false, note: "" };
  review.corrections["#/texts/4"] = { label: "list_item", reviewed: false, note: "" };
  validateReview(review);
  assertMatches(review, doc);
  const d = corrected(review, doc)!;
  assert.equal(d.texts[2]!.text, "Reviewed paragraph");
  assert.equal(d.texts[2]!.orig, realDocling.texts[2].orig);
  assert.equal(doc.texts[2]!.text, realDocling.texts[2].text);
  assert.equal(d.tables[0]!.data!.table_cells[4]!.text, "13");
  assert.equal((d.tables[0]!.data!.grid as { text: string }[][])[1]![1]!.text, "13");
  assert.equal(d.texts[3]!.level, 3);
  assert.equal(d.texts[4]!.enumerated, false);
  assert.deepEqual(parseDocument(d), d);
});
test("reading order moves siblings without orphaning children", () => {
  const { review, doc } = reviewOf();
  const moved = moveSibling(review, doc, "#/texts/3", -1);
  assert.deepEqual(
    items(corrected(moved, doc)!).map((x) => x.item.self_ref),
    ["#/texts/0", "#/texts/1", "#/texts/3", "#/tables/0", "#/texts/4", "#/texts/2"],
  );
  assert.deepEqual(corrected(moved, doc)!.texts[3]!.parent, realDocling.texts[3].parent);
});
test("exports: Markdown, standalone HTML with spans, CSV formula guard", () => {
  const { review, doc } = reviewOf();
  review.corrections["#/tables/0"] = { cells: { "4": "=2+2", "5": 'line,"quote"' }, reviewed: false, note: "" };
  const d = corrected(review, doc)!;
  const csv = tableCsv(d.tables[0]!);
  assert.ok(csv.includes('"\'=2+2"'));
  assert.ok(csv.includes('"line,""quote"""'));
  assert.ok(markdown(d).includes("| Alpha | =2+2 |"));
  // Furniture title is not part of the body projection.
  assert.equal(markdown(d).split("Quarterly Field Notes").length, 2);
  const page = html(d, "Field <notes>");
  assert.ok(page.startsWith("<!doctype html>"));
  assert.ok(page.includes("<title>Field &lt;notes&gt;</title>"));
  assert.ok(page.includes("<th>Batch</th>"));
  assert.ok(tablesCsv(d).startsWith('"Table 1"'));
});
test("invalid JSON shapes, dangling refs, cycles, repeated refs and bad table coordinates are rejected", () => {
  for (const change of [
    (d: typeof realDocling) => d.body.children.push({ $ref: "#/texts/999" }),
    (d: typeof realDocling) => d.texts[0].children.push({ $ref: "#/body" }),
    (d: typeof realDocling) => (d.texts[1].self_ref = "#/texts/0"),
    (d: typeof realDocling) => (d.tables[0].data.table_cells[0].row_span = 999),
  ]) {
    const d = structuredClone(realDocling);
    change(d);
    assert.throws(() => parseDocument(d));
  }
  assert.throws(() => parseDocument({ ...realDocling, version: "2.0.0" }));
});
test("corrections must match the referenced document; legacy 0.4 projects with embedded documents still load", () => {
  const { review, doc } = reviewOf();
  review.corrections["#/tables/0"] = { cells: { "900": "oops" }, reviewed: false, note: "" };
  assert.throws(() => assertMatches(review, doc));
  review.corrections = { "#/texts/999": { reviewed: false, note: "" } };
  assert.throws(() => assertMatches(review, doc));
  assert.throws(() => validateReview({ ...review, corrections: { "../x": { reviewed: false, note: "" } } }));
  const legacy = { format: "docling-review", version: 1, original: realDocling, corrections: { "#/texts/2": { text: "old edit", reviewed: true, note: "" } }, order: [], source: "0.4" };
  const restored = restoreReviewDraft(legacy);
  assert.equal(restored.version, 2);
  assert.equal(restored.document, null);
  assert.equal(corrected(restored, restored.original!)!.texts[2]!.text, "old edit");
  assert.throws(() => validateReview({ ...legacy, corrections: { "#/texts/999": { reviewed: false, note: "" } } }));
});
test("long documents beyond the old 600 KB ceiling are accepted", () => {
  const d = structuredClone(realDocling);
  for (let i = 0; i < 6000; i++) {
    const ref = `#/texts/${d.texts.length}`;
    d.texts.push({ self_ref: ref, parent: { $ref: "#/body" }, children: [], content_layer: "body", label: "text", prov: [], orig: "段落 " + i, text: "段落 " + i + "：" + "检测记录".repeat(20) });
    d.body.children.push({ $ref: ref });
  }
  const parsed = parseDocument(d);
  assert.ok(JSON.stringify(parsed).length > 1_000_000);
  assert.equal(items(parsed).length, 6006);
});
