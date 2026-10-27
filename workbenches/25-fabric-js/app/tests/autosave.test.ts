import assert from "node:assert/strict";
import { test } from "node:test";
import { DatabaseSync } from "node:sqlite";
import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { createAutosaveStore } from "../src/server/autosave.ts";
import { createStore } from "../src/server/store.ts";
import { templates, validatePoster } from "../src/contracts/poster.ts";
function setup() {
  const db = new DatabaseSync(":memory:");
  for (const file of ["0002_projects.sql", "0003_autosave.sql"])
    db.exec(
      readFileSync(new URL("../migrations/" + file, import.meta.url), "utf8"),
    );
  return {
    db,
    autosave: createAutosaveStore(db, validatePoster),
    store: createStore(db, validatePoster),
  };
}
function request() {
  return {
    documentId: randomUUID(),
    mutationId: randomUUID(),
    draftRevision: 0,
    projectId: null as string | null,
    projectRevision: null as number | null,
    snapshot: {
      title: "海报",
      data: templates[0].create(),
      extra: {
        "object:headline": { x: "-", text: "尚未应用" },
        importSource: '{"',
      },
    },
  };
}
test("raw inspector and import drafts persist separately without corrupting the published model", async () => {
  const { db, autosave, store } = setup();
  try {
    const r = request(),
      saved = await autosave.commit(r);
    assert.equal(saved.phase, "saved");
    assert.deepEqual(autosave.get(r.documentId)?.snapshot, r.snapshot);
    assert.equal(
      store.get(r.documentId).data.objects[2].text,
      "把绿色\n带回生活",
    );
  } finally {
    db.close();
  }
});
test("a response lost after commit retries the same mutation without duplicate project or revision", async () => {
  const { db, autosave, store } = setup();
  try {
    const r = request(),
      first = await autosave.commit(r),
      second = await autosave.commit(r);
    assert.deepEqual(first, second);
    assert.equal(store.list().length, 1);
    assert.equal(store.get(r.documentId).revision, 1);
  } finally {
    db.close();
  }
});
test("concurrent project updates preserve the losing draft and keep the winning artwork", async () => {
  const { db, autosave, store } = setup();
  try {
    const r = request();
    await autosave.commit(r);
    const next = templates[1].create();
    store.update(r.documentId, "另一窗口", next, 1);
    r.mutationId = randomUUID();
    r.draftRevision = 1;
    r.projectId = r.documentId;
    r.projectRevision = 1;
    r.snapshot.data.objects[0].x = 999;
    const conflict = await autosave.commit(r);
    assert.equal(conflict.phase, "conflict");
    assert.equal(store.get(r.documentId).title, "另一窗口");
    assert.equal(autosave.get(r.documentId)?.snapshot.data.objects[0].x, 999);
  } finally {
    db.close();
  }
});
test("invalid title is retained as a draft and later corrected into one project", async () => {
  const { db, autosave, store } = setup();
  try {
    const r = request();
    r.snapshot.title = "";
    assert.equal((await autosave.commit(r)).phase, "draft");
    assert.equal(store.list().length, 0);
    r.snapshot.title = "恢复名称";
    r.mutationId = randomUUID();
    r.draftRevision = 1;
    assert.equal((await autosave.commit(r)).phase, "saved");
    assert.equal(store.list().length, 1);
  } finally {
    db.close();
  }
});
