import { after, test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { createHash, randomUUID } from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import type { WorkbenchServer } from "../sdk/runtime.mjs";
import { createDocuments } from "../src/server/documents.ts";
import { createOutlines, serviceUrl, withIds } from "../src/server/outlines.ts";
import { extractDocument } from "../src/ui/extract.ts";
import { CHUNK, flatten, readerValue, seed } from "../src/contracts/reader.ts";
import { chapterFor, parseArchive, reviewMarkdown } from "../src/contracts/archive.ts";
import { chapterList } from "../src/server/questions.ts";

type Pdfjs = typeof import("pdfjs-dist");
const pdfjs: Pdfjs = await import(
  pathToFileURL(resolve("node_modules/pdfjs-dist/legacy/build/pdf.mjs")).href
);
const roots: string[] = [];
after(() => roots.forEach((r) => rmSync(r, { recursive: true, force: true })));
const sha = (b: Uint8Array) => createHash("sha256").update(b).digest("hex");

function server() {
  const root = mkdtempSync(join(tmpdir(), "pageindex-docs-"));
  roots.push(root);
  const db = new DatabaseSync(":memory:");
  for (const m of ["0002_projects", "0004_reader", "0005_outlines"])
    db.exec(readFileSync(`app/migrations/${m}.sql`, "utf8"));
  const work: Promise<unknown>[] = [];
  const app = {
    database: db,
    trackTask: (fn: () => Promise<unknown>) => {
      const p = fn();
      work.push(p);
      return p;
    },
    resources: {
      async path(id: string, child = "") {
        if (id === "samples") return resolve("app/samples", child);
        mkdirSync(join(root, id), { recursive: true });
        return join(root, id, child);
      },
    },
  } as unknown as WorkbenchServer;
  const docs = createDocuments(app);
  return { db, app, docs, outlines: createOutlines(app, docs.get, docs.read), work };
}
async function extraction(path: string) {
  const task = pdfjs.getDocument({
    data: new Uint8Array(readFileSync(path)),
    disableFontFace: true,
    verbosity: 0,
  });
  try {
    return await extractDocument(await task.promise);
  } finally {
    await task.destroy();
  }
}
async function upload(
  docs: ReturnType<typeof createDocuments>,
  pdf: Uint8Array,
  text: Uint8Array,
  textHash = sha(text),
) {
  const id = sha(pdf);
  for (let i = 0; i * CHUNK < pdf.length; i++)
    await docs.chunk("pdf", id, i, Buffer.from(pdf.subarray(i * CHUNK, (i + 1) * CHUNK)).toString("base64"));
  for (let i = 0; i * CHUNK < text.length; i++)
    await docs.chunk("text", id, i, Buffer.from(text.subarray(i * CHUNK, (i + 1) * CHUNK)).toString("base64"));
  return docs.finish(id, {
    bytes: pdf.length,
    name: "Report.pdf",
    textBytes: text.length,
    textSha256: textHash,
  });
}

test("browser-extracted text and bookmark tree are stored with the original, reused and verified", async () => {
  const x = server();
  try {
    const pdf = new Uint8Array(readFileSync("app/samples/library-report.pdf"));
    const text = new TextEncoder().encode(JSON.stringify(await extraction("app/samples/library-report.pdf")));
    await assert.rejects(upload(x.docs, pdf, text, "0".repeat(64)), /上传不完整/);
    const stored = await upload(x.docs, pdf, text);
    assert.equal(stored.source.pages, 11);
    assert.equal(stored.index.toc_source, "pdf-outline");
    assert.equal(stored.index.doc_name, "Report.pdf");
    assert.match(stored.pages[6].text, /closing checklist/i);
    assert.deepEqual(x.docs.get(stored.source.id), stored);
    // A second open of the same bytes returns the stored document without new parts.
    assert.deepEqual(
      await x.docs.finish(stored.source.id, { bytes: pdf.length, name: "x.pdf", textBytes: 2, textSha256: "" }),
      stored,
    );
    await x.docs.verify(stored.source);
    await assert.rejects(x.docs.verify({ ...stored.source, pages: 12 }), /缺失或不匹配/);
    await assert.rejects(
      x.docs.verify({ ...stored.source, id: "b".repeat(64) }),
      /缺失/,
    );
    assert.throws(() => x.docs.get("c".repeat(64)), /尚未入库/);
    // Sample route serves the bundled report bytes.
    assert.equal((await x.docs.sample("report")).bytes.length, pdf.length);
    await assert.rejects(x.docs.sample("../secret"), /没有这个示例/);
  } finally {
    x.db.close();
  }
});

test("upload rejects a PDF whose bytes do not match its declared hash, and bad chunks", async () => {
  const x = server();
  try {
    const pdf = new Uint8Array(readFileSync("app/samples/handbook.pdf"));
    const text = new TextEncoder().encode(JSON.stringify(await extraction("app/samples/handbook.pdf")));
    const forged = "d".repeat(64);
    await x.docs.chunk("pdf", forged, 0, Buffer.from(pdf).toString("base64"));
    await x.docs.chunk("text", forged, 0, Buffer.from(text).toString("base64"));
    await assert.rejects(
      x.docs.finish(forged, { bytes: pdf.length, name: "a.pdf", textBytes: text.length, textSha256: sha(text) }),
      /校验失败/,
    );
    await assert.rejects(x.docs.chunk("pdf", forged, 0, "!!"), /编码无效/);
    await assert.rejects(x.docs.chunk("pdf", forged, 999, "AAAA"), /超出允许范围/);
  } finally {
    x.db.close();
  }
});

test("optional PageIndex service: unreachable status is explicit, a failed build is recorded, imported trees validate", async () => {
  const x = server();
  const previous = process.env.PAGEINDEX_SERVICE_URL;
  process.env.PAGEINDEX_SERVICE_URL = "http://127.0.0.1:9";
  try {
    const health = await x.outlines.health();
    assert.equal(health.available, false);
    assert.equal(health.url, "http://127.0.0.1:9");
    assert.match(health.message, /未连接/);
    assert.doesNotMatch(health.message, /fetch failed/);
    const pdf = new Uint8Array(readFileSync("app/samples/handbook.pdf"));
    const text = new TextEncoder().encode(JSON.stringify(await extraction("app/samples/handbook.pdf")));
    const stored = await upload(x.docs, pdf, text);
    const job = x.outlines.startOutline(stored.source.id, "pageindex-flash");
    assert.equal(job.status, "running");
    await Promise.all(x.work);
    assert.equal(x.outlines.outlineJob(stored.source.id)?.status, "failed");
    assert.match(x.outlines.outlineJob(stored.source.id)?.error ?? "", /未连接/);
    assert.throws(() => x.outlines.startOutline(stored.source.id, "other"), /模式无效/);
    const tree = {
      source: "pageindex-classic",
      engine: "pageindex 0.2.10 classic",
      description: "A short operating handbook.",
      structure: withIds([
        { title: "Opening", start_index: 1, end_index: 2, text: "dropped", nodes: [{ title: "Lamps", start_index: 2, end_index: 2, prefix_summary: "Lamp checks." }] },
        { title: "Closing", start_index: 3, end_index: 3, summary: "Handover." },
      ]),
      at: new Date().toISOString(),
    };
    const updated = x.outlines.importOutline(stored.source.id, tree);
    const outline = updated.outlines?.[0];
    assert.equal(outline?.description, "A short operating handbook.");
    assert.deepEqual(flatten(outline!.structure).map((n) => n.node_id), ["0001", "0002", "0003"]);
    assert.equal(outline!.structure[0].nodes?.[0].summary, "Lamp checks.");
    assert.equal("text" in outline!.structure[0], false);
    assert.throws(
      () =>
        x.outlines.importOutline(stored.source.id, {
          ...tree,
          structure: [{ node_id: "x", title: "Bad", start_index: 2, end_index: 9 }],
        }),
    );
    assert.throws(() => serviceUrl("http://example.com:8784"), /本机HTTP或远程HTTPS/);
    assert.equal(serviceUrl("https://pageindex.example.org/"), "https://pageindex.example.org");
  } finally {
    if (previous === undefined) delete process.env.PAGEINDEX_SERVICE_URL;
    else process.env.PAGEINDEX_SERVICE_URL = previous;
    x.db.close();
  }
});

test("reading archives and recovery drafts import as new copies; legacy payloads gain defaults", () => {
  const legacy = { document: null, page: 1, question: "", notes: [], archivedAnswers: [] };
  assert.deepEqual(readerValue(legacy), seed);
  assert.throws(() => readerValue({ ...seed, outline: "elsewhere" }));
  assert.throws(() => readerValue({ ...seed, zoom: 20 }));
  const source = { id: "e".repeat(64), name: "r.pdf", bytes: 10, pages: 30 };
  const data = {
    ...seed,
    document: source,
    page: 25,
    outline: "pageindex-flash" as const,
    zoom: 125,
    notes: [{ id: randomUUID(), page: 25, quote: "Closing checklist", text: "Confirm alarm" }],
  };
  const run = {
    id: randomUUID(),
    projectId: randomUUID(),
    documentId: source.id,
    question: "Q",
    status: "completed",
    result: { id: randomUUID(), question: "Q", answer: "A", citations: [{ page: 25, quote: "x" }], at: "t", insufficient: false },
    error: "",
    at: "t",
  };
  const parsed = parseArchive({
    format: "floatboat-pageindex",
    version: 1,
    title: "Board review",
    data,
    draft: { inputJson: "{ unfinished", pendingQuestion: { id: "p" } },
    pdf: "JVBERi0=",
    outlines: [],
    runLedger: [run],
  });
  assert.equal(parsed.recovery, false);
  assert.deepEqual(parsed.data, data);
  assert.equal(parsed.extra.inputJson, "{ unfinished");
  assert.deepEqual(parsed.extra.importedPendingQuestion, { id: "p" });
  assert.equal("pendingQuestion" in parsed.extra, false);
  assert.equal((parsed.extra.importedRunLedger as { result: unknown }[])[0].result, null);
  assert.throws(() => parseArchive({ format: "floatboat-pageindex", version: 1, title: "x", data, draft: {} }), /没有原PDF/);
  const recovery = parseArchive({ snapshot: { title: "Draft", data, extra: { inputJson: "[" } } });
  assert.equal(recovery.recovery, true);
  assert.equal(recovery.pdf, null);
  assert.equal(recovery.extra.inputJson, "[");
  assert.throws(() => parseArchive({ format: "other" }), /不是PageIndex/);
  const md = reviewMarkdown("Board review", data, [run.result], [
    { node_id: "1", title: "5. Facilities", start_index: 20, end_index: 30, nodes: [{ node_id: "2", title: "5.3 Closing", start_index: 25, end_index: 25 }] },
  ]);
  assert.match(md, /### 第25页 · 5\.3 Closing\n\n> Closing checklist\n\nConfirm alarm/);
  assert.match(md, /- 第25页：“x”/);
});

test("a passage on a page shared by several sections is attributed to the heading printed before it", () => {
  const structure = [
    {
      node_id: "5",
      title: "5. Facilities",
      start_index: 7,
      end_index: 7,
      nodes: [
        { node_id: "51", title: "5.1 Building maintenance", start_index: 7, end_index: 7 },
        { node_id: "53", title: "5.3 Closing checklist", start_index: 7, end_index: 7 },
      ],
    },
  ];
  const text = "5. Facilities\n5.1 Building maintenance\nBoiler fixed.\n5.3 Closing checklist\nPublic computers must be\nlogged out by 19:45.";
  assert.equal(chapterFor(structure, 7, text, "Public computers must be logged out"), "5.3 Closing checklist");
  assert.equal(chapterFor(structure, 7, text, "Boiler fixed"), "5.1 Building maintenance");
  assert.equal(chapterFor(structure, 7), "5.1 Building maintenance");
  assert.equal(chapterFor(structure, 9), "");
});

test("question routing lists shallow chapters first within the prompt cap", () => {
  const structure = Array.from({ length: 5 }, (_, i) => ({
    node_id: `t${i}`,
    title: `Top ${i}`,
    start_index: 1,
    end_index: 1,
    nodes: Array.from({ length: 5 }, (_, j) => ({ node_id: `c${i}-${j}`, title: "c", start_index: 1, end_index: 1 })),
  }));
  const list = chapterList(structure, 8);
  assert.deepEqual(list.slice(0, 5).map((n) => n.node_id), ["t0", "t1", "t2", "t3", "t4"]);
  assert.equal(list.length, 8);
});
