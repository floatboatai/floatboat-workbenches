import assert from "node:assert/strict";
import { test } from "node:test";
import { DatabaseSync } from "node:sqlite";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { createAutosaveStore } from "../src/server/autosave.ts";
import { createStore } from "../src/server/store.ts";
import {
  validateReview,
  restoreReviewDraft,
  importReview,
  exportReview,
  jsonBytes,
  assertWorkingCopyCapacity,
  WORKING_REVIEW_BYTES,
  WORKING_COPY_BYTES,
} from "../src/contracts/document.ts";
import { sizedReview } from "./review-fixture.ts";

test("SQLite: over-model working draft survives database reopen and portable round trip", async () => {
  const directory = mkdtempSync(join(tmpdir(), "docling-draft-capacity-"));
  const file = join(directory, "data.sqlite");
  let db = new DatabaseSync(file);
  try {
    for (const migration of ["0002_projects.sql", "0003_autosave.sql"])
      db.exec(
        readFileSync(
          new URL("../migrations/" + migration, import.meta.url),
          "utf8",
        ),
      );
    const data = sizedReview(799000);
    validateReview(data);
    const projects = createStore(db, validateReview);
    const original = projects.create("Near limit", data);
    data.corrections["#/tables/0"] = {
      reviewed: false,
      note: "x".repeat(3000),
    };
    assert.ok(jsonBytes(data) > 800000);
    assert.throws(() => validateReview(data), /800 KB/);
    const id = randomUUID();
    const request = {
      documentId: id,
      mutationId: randomUUID(),
      draftRevision: 0,
      projectId: original.id,
      projectRevision: original.revision,
      snapshot: { title: "Near limit", data, extra: { raw: '{"unfinished":' } },
    };
    assert.ok(jsonBytes(request) < 1950000);
    const receipt = await createAutosaveStore(db, validateReview).commit(
      request,
    );
    assert.equal(receipt.phase, "draft");
    assert.deepEqual(projects.get(original.id).data, original.data);
    db.close();
    db = new DatabaseSync(file);
    const persisted = createAutosaveStore(db, validateReview).get(id)!;
    const restored = restoreReviewDraft(persisted.snapshot.data);
    assert.deepEqual(restored, data);
    assert.equal(persisted.snapshot.extra.raw, '{"unfinished":');
    assert.deepEqual(importReview(exportReview(restored)), data);
    restored.corrections["#/tables/0"]!.note = "";
    const complete = await createAutosaveStore(db, validateReview).commit({
      ...request,
      mutationId: randomUUID(),
      draftRevision: persisted.revision,
      snapshot: { ...request.snapshot, data: restored },
    });
    assert.equal(complete.phase, "saved");
    assert.equal(complete.project?.id, original.id);
  } finally {
    db.close();
    rmSync(directory, { recursive: true, force: true });
  }
});

test("working decoder keeps strict structure, source and field bounds with separate byte limit", () => {
  const atLimit = sizedReview(WORKING_REVIEW_BYTES, 61);
  assert.equal(jsonBytes(restoreReviewDraft(atLimit)), WORKING_REVIEW_BYTES);
  assert.equal(Buffer.byteLength(exportReview(atLimit)), WORKING_REVIEW_BYTES);
  assert.deepEqual(importReview(exportReview(atLimit)), atLimit);
  assert.throws(() => validateReview(atLimit), /800 KB/);
  const tooLarge = structuredClone(atLimit);
  tooLarge.source += "x";
  assert.throws(() => restoreReviewDraft(tooLarge), /1.2 MB/);
  const dangling = sizedReview(799000);
  dangling.order = ["#/texts/999"];
  assert.throws(() => restoreReviewDraft(dangling));
  const invalid = sizedReview(799000);
  invalid.corrections["#/tables/0"] = {
    reviewed: false,
    note: "x".repeat(10001),
  };
  assert.throws(() => restoreReviewDraft(invalid));
  const source = sizedReview(799000);
  source.original!.padding = "x".repeat(600001);
  assert.throws(() => restoreReviewDraft(source), /600 KB/);
});

test("combined work data and raw input remain below autosave transport budget", () => {
  const data = sizedReview(1199000, 61);
  const extra = { raw: "" };
  extra.raw = "x".repeat(
    WORKING_COPY_BYTES - jsonBytes({ title: "Review", data, extra }),
  );
  assertWorkingCopyCapacity("Review", data, extra);
  const envelope = {
    documentId: randomUUID(),
    mutationId: randomUUID(),
    draftRevision: 123,
    projectId: randomUUID(),
    projectRevision: 123,
    snapshot: { title: "Review", data, extra },
  };
  assert.ok(jsonBytes(envelope) < 1950000);
  assert.throws(
    () => assertWorkingCopyCapacity("Review", data, { raw: extra.raw + "x" }),
    /1.85 MB/,
  );
});
