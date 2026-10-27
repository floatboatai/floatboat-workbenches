import { example } from "../src/contracts/example.ts";
import assert from "node:assert/strict";
import { test } from "node:test";
import { DatabaseSync } from "node:sqlite";
import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { createAutosaveStore } from "../src/server/autosave.ts";
import { createStore } from "../src/server/store.ts";
import { fromDocument, validateReview } from "../src/contracts/document.ts";
const fixture = example;
function setup() {
  const db = new DatabaseSync(":memory:");
  for (const file of ["0002_projects.sql", "0003_autosave.sql"])
    db.exec(
      readFileSync(new URL("../migrations/" + file, import.meta.url), "utf8"),
    );
  return {
    db,
    store: createAutosaveStore(db, validateReview),
    projects: createStore(db, validateReview),
  };
}
test("autosave retains unapplied invalid JSON and lost-response retry creates one project", async () => {
  const { db, store, projects } = setup();
  try {
    const request = {
      documentId: randomUUID(),
      mutationId: randomUUID(),
      draftRevision: 0,
      projectId: null,
      projectRevision: null,
      snapshot: {
        title: "Review",
        data: fromDocument(fixture),
        extra: { raw: '{"unfinished' },
      },
    };
    const a = await store.commit(request),
      b = await store.commit(request);
    assert.deepEqual(a, b);
    assert.equal(projects.list().length, 1);
    assert.equal(
      store.get(request.documentId)!.snapshot.extra.raw,
      '{"unfinished',
    );
  } finally {
    db.close();
  }
});
test("optimistic conflict keeps server content and preserves conflicting working copy", async () => {
  const { db, store, projects } = setup();
  try {
    const base = projects.create("Source", fromDocument(fixture));
    projects.update(base.id, "Other window", base.data, base.revision);
    const id = randomUUID();
    const r = await store.commit({
      documentId: id,
      mutationId: randomUUID(),
      draftRevision: 0,
      projectId: base.id,
      projectRevision: base.revision,
      snapshot: { title: "Mine", data: base.data, extra: { raw: "draft" } },
    });
    assert.equal(r.phase, "conflict");
    assert.equal(projects.get(base.id).title, "Other window");
    assert.equal(store.get(id)!.snapshot.title, "Mine");
  } finally {
    db.close();
  }
});
test("incomplete title remains a draft then recovers without data loss", async () => {
  const { db, store } = setup();
  try {
    const id = randomUUID();
    const r = await store.commit({
      documentId: id,
      mutationId: randomUUID(),
      draftRevision: 0,
      projectId: null,
      projectRevision: null,
      snapshot: { title: "", data: fromDocument(fixture), extra: { raw: "[" } },
    });
    assert.equal(r.phase, "draft");
    assert.equal(store.get(id)!.snapshot.extra.raw, "[");
  } finally {
    db.close();
  }
});
