import { after, test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import {
  buildTree,
  detectHeadings,
  pageRanges,
  quoteRuns,
  quoteSpans,
  rankEvidence,
  searchPages,
} from "../src/contracts/outline.ts";
import { extractDocument } from "../src/ui/extract.ts";
import { flatten, indexValue, structureValue } from "../src/contracts/reader.ts";
import { createHash } from "node:crypto";

type Pdfjs = typeof import("pdfjs-dist");
const pdfjs: Pdfjs = await import(
  pathToFileURL(resolve("node_modules/pdfjs-dist/legacy/build/pdf.mjs")).href
);
const tasks: { destroy(): Promise<void> }[] = [];
async function open(path: string) {
  const task = pdfjs.getDocument({
    data: new Uint8Array(readFileSync(path)),
    disableFontFace: true,
    standardFontDataUrl: resolve("app/pdfjs/standard_fonts") + "/",
    verbosity: 0,
  });
  tasks.push(task);
  return task.promise;
}
after(() => Promise.all(tasks.map((t) => t.destroy())));

test("bundled report: PDF.js reads every page and the PDF's own bookmark tree", async () => {
  const pdf = await open("app/samples/library-report.pdf");
  const result = await extractDocument(pdf);
  assert.equal(result.pages.length, 11);
  assert.equal(result.index.toc_source, "pdf-outline");
  const nodes = flatten(result.index.structure);
  const facilities = nodes.find((n) => n.title === "5. Facilities and Safety");
  assert.ok(facilities);
  assert.equal(facilities.nodes?.length, 3);
  const closing = facilities.nodes?.find((n) => n.title === "5.3 Closing checklist");
  assert.equal(closing?.start_index, 7);
  assert.match(result.pages[6].text, /Public computers must be logged out/);
  assert.match(result.index.doc_title, /Annual Service Report/);
  // The extracted text and tree validate exactly as the server will store them.
  const bytes = readFileSync("app/samples/library-report.pdf");
  const stored = indexValue({
    source: {
      id: createHash("sha256").update(bytes).digest("hex"),
      name: "report.pdf",
      bytes: bytes.length,
      pages: result.pages.length,
    },
    engineVersion: result.engineVersion,
    index: { ...result.index, doc_name: "report.pdf" },
    pages: result.pages,
  });
  assert.equal(flatten(stored.index.structure).length, nodes.length);
});

test("without bookmarks, larger and numbered heading lines become a nested tree", async () => {
  const pdf = await open("app/tests/fixtures/report-without-bookmarks.pdf");
  assert.equal(((await pdf.getOutline()) ?? []).length, 0);
  const result = await extractDocument(pdf);
  assert.equal(result.index.toc_source, "heading-scan");
  const nodes = flatten(result.index.structure);
  const titles = nodes.map((n) => n.title);
  assert.ok(titles.includes("3. Collections and Circulation"), titles.join(" | "));
  assert.ok(!titles.some((t) => /Riverside Community Library \|/.test(t)));
  const collections = result.index.structure.find((n) =>
    n.title.startsWith("3. Collections"),
  );
  assert.deepEqual(
    collections?.nodes?.map((n) => n.title),
    ["3.1 Print collection", "3.2 Digital lending", "3.3 Interlibrary loan"],
  );
  assert.equal(collections?.start_index, 5);
  assert.match(result.index.doc_title, /Annual Service Report/);
});

test("tree building nests by level, shares a page when the next heading is mid-page and stays valid", () => {
  const tree = buildTree(
    [
      { title: "Intro", page: 1, level: 0 },
      { title: "Scope", page: 2, level: 1, top: false },
      { title: "Method", page: 4, level: 0 },
      { title: "Deep", page: 4, level: 3, top: false },
      { title: "Results", page: 6, level: 0, top: false },
    ],
    9,
  );
  assert.deepEqual(
    tree.map((n) => [n.title, n.start_index, n.end_index]),
    [
      ["Intro", 1, 3],
      ["Method", 4, 6],
      ["Results", 6, 9],
    ],
  );
  assert.equal(tree[0].nodes?.[0].end_index, 3);
  assert.deepEqual(structureValue(tree, 9), tree);
  assert.equal(pageRanges(25).length, 3);
  assert.equal(pageRanges(25)[2].title, "第21–25页");
  assert.deepEqual(detectHeadings([]), { entries: [], title: "" });
});

test("quote location ignores whitespace and line breaks and anchors long paraphrased spans", () => {
  const runs = ["Before closing, count all", "", "lamps and check", " the power switches."];
  assert.deepEqual(quoteRuns(runs, "count all lamps and check"), [0, 2]);
  assert.deepEqual(quoteRuns(runs, "check the power"), [2, 3]);
  assert.deepEqual(quoteRuns(runs, "not on this page"), []);
  const long = "Before closing, count all lamps and check the power switches.";
  assert.deepEqual(quoteRuns(runs, long.replace("count", "count  ")), [0, 2, 3]);
  assert.deepEqual(quoteRuns(["“Quoted” – text"], '"Quoted" - text'), [0]);
  // Exact character ranges, so only the quoted words are marked inside a longer line.
  assert.deepEqual(
    quoteSpans(["Public computers must be logged out and shut down by 19:45."], "must be logged out"),
    [{ run: 0, from: 17, to: 35 }],
  );
  assert.deepEqual(quoteSpans(["count all", "", "lamps now"], "all lamps"), [
    { run: 0, from: 6, to: 9 },
    { run: 2, from: 0, to: 5 },
  ]);
});

test("search returns page hits with context; evidence ranking narrows long chapters to the best pages", () => {
  const pages = [
    { number: 1, text: "Opening hours and visits." },
    { number: 2, text: "The closing checklist covers doors and computers. Closing time 20:00." },
    { number: 3, text: "Budget and spending lines." },
    { number: 4, text: "闭馆检查包括门窗与电脑。" },
  ];
  const hits = searchPages(pages, "closing");
  assert.deepEqual(hits.map((h) => h.page), [2, 2]);
  assert.match(hits[0].snippet, /closing checklist/);
  assert.deepEqual(searchPages(pages, "x"), []);
  assert.deepEqual(
    rankEvidence("What does the closing checklist cover?", pages, { maxPages: 1, maxChars: 1000 }),
    [2],
  );
  assert.deepEqual(rankEvidence("闭馆检查", pages, { maxPages: 1, maxChars: 1000 }), [4]);
  assert.deepEqual(
    rankEvidence("closing", pages, { maxPages: 4, maxChars: 60 }),
    [1, 3],
  );
});
