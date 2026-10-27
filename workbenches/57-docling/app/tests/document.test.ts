import { example } from "../src/contracts/example.ts";
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  fromDocument,
  parseDocument,
  validateReview,
  importReview,
  items,
  corrected,
  markdown,
  tableCsv,
  moveSibling,
} from "../src/contracts/document.ts";
const fixture = example;
test("real Docling core fixture imports body hierarchy and table", () => {
  const r = fromDocument(fixture);
  assert.equal(items(r.original!).length, 6);
  assert.equal(r.original!.tables[0]!.data!.table_cells.length, 9);
  assert.equal(items(r.original!)[4]!.item.self_ref, "#/tables/0");
});
test("correction layer preserves original text, references and table dimensions", () => {
  const r = fromDocument(fixture);
  r.corrections["#/texts/2"] = {
    text: "Reviewed paragraph",
    reviewed: true,
    note: "checked",
  };
  r.corrections["#/tables/0"] = {
    cells: { "4": "13" },
    reviewed: true,
    note: "",
  };
  const d = corrected(r)!;
  assert.equal(d.texts[2]!.text, "Reviewed paragraph");
  assert.equal(d.texts[2]!.orig, fixture.texts[2].orig);
  assert.equal(r.original!.texts[2]!.text, fixture.texts[2].text);
  assert.equal(d.tables[0]!.data!.table_cells[4]!.text, "13");
  assert.equal(
    (d.tables[0]!.data!.grid as { text: string }[][])[1]![1]!.text,
    "13",
  );
  assert.equal(d.tables[0]!.data!.num_rows, 3);
  assert.deepEqual(parseDocument(d), d);
});
test("reading order moves siblings without orphaning children", () => {
  const r = fromDocument(fixture);
  const moved = moveSibling(r, "#/texts/3", -1);
  assert.deepEqual(
    items(corrected(moved)!).map((x) => x.item.self_ref),
    [
      "#/texts/0",
      "#/texts/1",
      "#/texts/3",
      "#/tables/0",
      "#/texts/4",
      "#/texts/2",
    ],
  );
  assert.deepEqual(corrected(moved)!.texts[3]!.parent, fixture.texts[3].parent);
});
test("portable review round trip keeps corrections and notes", () => {
  const r = fromDocument(fixture);
  r.corrections["#/texts/2"] = {
    text: "",
    reviewed: false,
    note: "incomplete",
  };
  assert.deepEqual(importReview(JSON.stringify(r)), r);
  assert.equal(
    markdown(r).includes("This original demonstration report"),
    false,
  );
});
test("CSV quotes cells and prevents spreadsheet formula execution", () => {
  const r = fromDocument(fixture);
  r.corrections["#/tables/0"] = {
    cells: { "4": "=2+2", "5": 'line,"quote"' },
    reviewed: false,
    note: "",
  };
  const csv = tableCsv(corrected(r)!.tables[0]!);
  assert.ok(csv.includes('"\'=2+2"'));
  assert.ok(csv.includes('"line,""quote"""'));
  assert.ok(markdown(r).includes("| Alpha | =2+2 |"));
});
test("invalid JSON, dangling refs, cycles, repeated refs and bad table coordinates are rejected", () => {
  assert.throws(() => importReview("{"));
  for (const change of [
    (d: typeof fixture) => d.body.children.push({ $ref: "#/texts/999" }),
    (d: typeof fixture) => d.texts[0].children.push({ $ref: "#/body" }),
    (d: typeof fixture) => (d.texts[1].self_ref = "#/texts/0"),
    (d: typeof fixture) => (d.tables[0].data.table_cells[0].row_span = 999),
  ]) {
    const d = structuredClone(fixture);
    change(d);
    assert.throws(() => parseDocument(d));
  }
});
test("untrusted corrections cannot target unknown refs or cells", () => {
  const r = fromDocument(fixture);
  r.corrections["#/tables/0"] = {
    cells: { "900": "oops" },
    reviewed: false,
    note: "",
  };
  assert.throws(() => validateReview(r));
  r.corrections = { "#/texts/999": { reviewed: false, note: "" } };
  assert.throws(() => validateReview(r));
});
test("large documents and invalid version are rejected before rendering", () => {
  assert.throws(() => parseDocument({ ...fixture, version: "2.0.0" }));
  assert.throws(() => parseDocument({ ...fixture, extra: "a".repeat(600001) }));
});
