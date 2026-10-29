import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { createAutosaveStore } from "../src/server/autosave.ts";
import { createStore } from "../src/server/store.ts";
import { assertMatches, assertWorkingCopyCapacity, jsonBytesOf, restoreReviewDraft, validateReview, WORKING_COPY_BYTES, type Review } from "./persistence-helpers.ts";
import { database, reviewOf } from "./helpers.ts";
const { review: base, doc } = reviewOf();
// Server-side verification: corrections must exist in the referenced stored document.
const verify = async (data: Review) => {
  if (data.document) assertMatches(data, doc);
};
function setup(file?: string, migrate = true) {
  const db = database(file, migrate);
  return { db, store: createAutosaveStore(db, validateReview, undefined, { verify }), projects: createStore(db, validateReview) };
}
const request = (data: Review, extra: Record<string, unknown> = {}, title = "Review") => ({
  documentId: randomUUID(),
  mutationId: randomUUID(),
  draftRevision: 0,
  projectId: null,
  projectRevision: null,
  snapshot: { title, data, extra },
});
test("lost-response retry is idempotent and keeps unapplied JSON as part of the working copy", async () => {
  const { db, store, projects } = setup();
  try {
    const r = request(base, { raw: '{"unfinished', engine: "serve" });
    const a = await store.commit(r),
      b = await store.commit(r);
    assert.deepEqual(a, b);
    assert.equal(a.phase, "saved");
    assert.equal(projects.list().length, 1);
    assert.equal(store.get(r.documentId)!.snapshot.extra.raw, '{"unfinished');
  } finally {
    db.close();
  }
});
test("a correction pointing at a missing item is kept as a draft, never saved over the model", async () => {
  const { db, store, projects } = setup();
  try {
    const bad = { ...base, corrections: { "#/texts/999": { reviewed: false, note: "typed during delayed save" } } };
    const r = await store.commit(request(bad));
    assert.equal(r.phase, "draft");
    assert.equal(projects.list().length, 0);
    assert.match(r.message, /不存在/);
  } finally {
    db.close();
  }
});
test("optimistic conflict keeps server content and preserves the conflicting working copy", async () => {
  const { db, store, projects } = setup();
  try {
    const first = projects.create("Source", base);
    projects.update(first.id, "Other window", base, first.revision);
    const id = randomUUID();
    const r = await store.commit({ ...request(base, { raw: "draft" }, "Mine"), documentId: id, projectId: first.id, projectRevision: first.revision });
    assert.equal(r.phase, "conflict");
    assert.equal(projects.get(first.id).title, "Other window");
    assert.equal(store.get(id)!.snapshot.title, "Mine");
  } finally {
    db.close();
  }
});
test("drafts survive closing and reopening the database; an incomplete title stays a draft", async () => {
  const dir = mkdtempSync(join(tmpdir(), "docling-persist-"));
  const file = join(dir, "data.sqlite");
  try {
    let f = setup(file);
    const edited = { ...base, corrections: { "#/texts/2": { text: "校订后的段落", reviewed: true, note: "复核：与原页一致" } } };
    const r = request(edited, { raw: "[" }, "");
    assert.equal((await f.store.commit(r)).phase, "draft");
    f.db.close();
    f = setup(file, false);
    const back = f.store.get(r.documentId)!;
    assert.equal(back.snapshot.extra.raw, "[");
    assert.deepEqual(restoreReviewDraft(back.snapshot.data), edited);
    f.db.close();
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
test("legacy 0.4 project payloads with an embedded document still validate on read", async () => {
  const { db, projects } = setup();
  try {
    const legacy = { format: "docling-review", version: 1, original: structuredClone(doc), corrections: {}, order: [], source: "0.4" };
    const saved = projects.create("Old", legacy);
    assert.equal(projects.get(saved.id).data.original?.name, doc.name);
  } finally {
    db.close();
  }
});
test("working-copy budget leaves room under the 1.95 MB autosave envelope", () => {
  assert.throws(() => assertWorkingCopyCapacity("t", base, { raw: "x".repeat(WORKING_COPY_BYTES) }), /1.85 MB/);
  assert.doesNotThrow(() => assertWorkingCopyCapacity("t", base, { raw: "x".repeat(600000) }));
  assert.ok(jsonBytesOf(request(base, { raw: "x".repeat(1_800_000) })) < 1_950_000 + 1000);
  const big = { ...base, corrections: { "#/texts/2": { reviewed: false, note: "n".repeat(10000) } } };
  for (let i = 0; i < 90; i++) big.corrections[`#/texts/${i % 5}`] = { reviewed: false, note: "n".repeat(10000) };
  assert.doesNotThrow(() => validateReview(big));
});
