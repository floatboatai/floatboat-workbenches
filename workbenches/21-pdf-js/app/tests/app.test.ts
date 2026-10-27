import assert from "node:assert/strict";
import { test } from "node:test";
import { readFile, mkdtemp, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { randomUUID } from "node:crypto";
import {
  validateProject,
  seed,
  encodePortable,
  decodePortable,
  checkPdfBytes,
  findPages,
  CHUNK_BYTES,
  type PdfProject,
} from "../src/contracts/pdf.ts";
import { createPdfFiles, digest } from "../src/server/files.ts";
import { createAutosaveStore } from "../src/server/autosave.ts";
const pdf = new Uint8Array(
  await readFile(new URL("../public/sample.pdf", import.meta.url)),
);
const source = {
  id: digest(pdf),
  name: "sample.pdf",
  bytes: pdf.length,
  pages: 3,
};
const data: PdfProject = {
  ...seed,
  source,
  notes: { "1": "河岸观察\n下一步复核。", "3": "雨后再次查看。" },
};

test("portable project preserves original bytes, notes and navigation exactly", () => {
  const original = { ...data, page: 3, zoom: 1.5 };
  const decoded = decodePortable(encodePortable("河岸", original, pdf));
  assert.deepEqual(decoded.pdf, pdf);
  assert.deepEqual(decoded.data, original);
  assert.equal(decoded.title, "河岸");
});
test("portable envelope rejects oversized header, missing bytes and arbitrary JSON", () => {
  const encoded = encodePortable("河岸", data, pdf);
  assert.throws(() => decodePortable(encoded.subarray(0, 30)));
  const corrupt = encoded.slice();
  new DataView(corrupt.buffer).setUint32(11, 9999999);
  assert.throws(() => decodePortable(corrupt));
  assert.throws(() =>
    decodePortable(new TextEncoder().encode('{"url":"https://example.com"}')),
  );
});
test("project validation enforces page ownership, resource identity, note and navigation bounds", () => {
  assert.deepEqual(validateProject(data), data);
  for (const invalid of [
    { ...data, page: 4 },
    { ...data, zoom: 3 },
    { ...data, source: { ...source, id: "../../secret" } },
    { ...data, notes: { "4": "not a page" } },
    { ...data, notes: { "1": "x".repeat(12001) } },
    { ...data, source: { ...source, pages: 201 } },
    { ...data, source: { ...source, bytes: 13 * 1024 * 1024 } },
  ])
    assert.throws(() => validateProject(invalid));
  assert.throws(() =>
    validateProject({
      ...seed,
      notes: { "1": "cannot attach notes without PDF" },
    }),
  );
});
test("PDF header and file size are checked before engine loading", () => {
  checkPdfBytes(pdf);
  assert.throws(() =>
    checkPdfBytes(new TextEncoder().encode("<html>bad</html>")),
  );
  assert.throws(() => checkPdfBytes(new Uint8Array(13 * 1024 * 1024)));
});
test("search reports matching pages, occurrence counts, case-insensitive text and snippets", () => {
  assert.deepEqual(
    findPages(
      ["The RIVER and river.", "Shade on the edge.", "Riverbank"],
      "river",
    ).map((r) => [r.page, r.count]),
    [
      [1, 2],
      [3, 1],
    ],
  );
  assert.equal(findPages(["雨后的河岸"], "河岸")[0].excerpt, "雨后的河岸");
  assert.deepEqual(findPages(["anything"], "  "), []);
});
test("durable resource upload reconstructs chunks and verifies SHA-256 before committing", async () => {
  const dir = await mkdtemp(join(tmpdir(), "pdf-review-"));
  try {
    const files = createPdfFiles(async (relative) => join(dir, relative));
    for (let offset = 0; offset < pdf.length; offset += CHUNK_BYTES)
      await files.chunk(
        source.id,
        offset / CHUNK_BYTES,
        Buffer.from(pdf.subarray(offset, offset + CHUNK_BYTES)).toString(
          "base64",
        ),
      );
    await files.finish(source);
    await files.verify(source);
    assert.deepEqual(await files.read(source.id), pdf);
    const originalStat = await stat(join(dir, `${source.id}.pdf`));
    await files.chunk(source.id, 0, Buffer.from(pdf).toString("base64"));
    await files.finish(source);
    assert.equal(
      (await stat(join(dir, `${source.id}.pdf`))).mtimeMs,
      originalStat.mtimeMs,
    );

    await assert.rejects(() => files.chunk("../../outside", 0, "YWJj"));
    await assert.rejects(() => files.chunk(source.id, 48, "YWJj"));
    await assert.rejects(() => files.chunk(source.id, 0, "a!"));
    await assert.rejects(() =>
      files.verify({ ...source, bytes: source.bytes + 1 }),
    );
    const wrong = { ...source, id: "a".repeat(64) };
    await files.chunk(wrong.id, 0, Buffer.from(pdf).toString("base64"));
    await assert.rejects(() => files.finish(wrong), /校验失败/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
test("autosave is idempotent, preserves invalid drafts and refuses stale project revisions", async () => {
  const db = new DatabaseSync(":memory:");
  try {
    for (const name of [
      "0001_initial.sql",
      "0002_projects.sql",
      "0003_autosave.sql",
    ])
      db.exec(
        await readFile(
          new URL(`../migrations/${name}`, import.meta.url),
          "utf8",
        ),
      );
    const autosave = createAutosaveStore(db, validateProject);
    const documentId = randomUUID();
    const request = {
      documentId,
      mutationId: randomUUID(),
      draftRevision: 0,
      projectId: null,
      projectRevision: null,
      snapshot: {
        title: "河岸",
        data,
        extra: { query: "river", pageInput: "x" },
      },
    };
    const first = await autosave.commit(request);
    assert.equal(first.phase, "saved");
    assert.deepEqual(await autosave.commit(request), first);
    assert.equal(db.prepare("SELECT count(*) AS n FROM projects").get()?.n, 1);
    const invalid = await autosave.commit({
      ...request,
      mutationId: randomUUID(),
      draftRevision: 1,
      projectId: documentId,
      projectRevision: 1,
      snapshot: { ...request.snapshot, title: "" },
    });
    assert.equal(invalid.phase, "draft");
    assert.equal(autosave.get(documentId)?.snapshot.title, "");
    const changed = await autosave.commit({
      ...request,
      mutationId: randomUUID(),
      draftRevision: 2,
      projectId: documentId,
      projectRevision: 1,
      snapshot: {
        ...request.snapshot,
        data: { ...data, notes: { "1": "new note" } },
      },
    });
    assert.equal(changed.project?.revision, 2);
    const conflict = await autosave.commit({
      ...request,
      documentId: randomUUID(),
      mutationId: randomUUID(),
      projectId: documentId,
      projectRevision: 1,
    });
    assert.equal(conflict.phase, "conflict");
    assert.equal(
      JSON.parse(
        String(
          db.prepare("SELECT payload FROM projects WHERE id=?").get(documentId)
            ?.payload,
        ),
      ).notes["1"],
      "new note",
    );
  } finally {
    db.close();
  }
});
