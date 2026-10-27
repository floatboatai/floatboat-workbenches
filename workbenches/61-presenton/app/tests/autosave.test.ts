import assert from "node:assert/strict";
import { test } from "node:test";
import { DatabaseSync } from "node:sqlite";
import { readFileSync } from "node:fs";
import {
  example,
  blank,
  validateDeck,
  restoreDeck,
} from "../src/contracts/deck.ts";
import { createAutosaveStore } from "../src/server/autosave.ts";
import { createStore } from "../src/server/store.ts";
function database() {
  const db = new DatabaseSync(":memory:");
  for (const m of ["0002_projects.sql", "0003_autosave.sql"])
    db.exec(
      readFileSync(new URL("../migrations/" + m, import.meta.url), "utf8"),
    );
  return db;
}
test("autosave: unfinished slides and raw JSON restore without overwriting last valid model; lost receipt is idempotent", async () => {
  const db = database();
  try {
    const drafts = createAutosaveStore(db, validateDeck);
    const cmd = {
      documentId: crypto.randomUUID(),
      mutationId: crypto.randomUUID(),
      draftRevision: 0,
      projectId: null,
      projectRevision: null,
      snapshot: {
        title: "Draft",
        data: example,
        extra: { importText: "{broken" },
      },
    };
    const first = await drafts.commit(cmd);
    assert.equal(first.phase, "saved");
    assert.ok(first.project);
    assert.deepEqual(await drafts.commit(cmd), first);
    const pending = await drafts.commit({
      ...cmd,
      mutationId: crypto.randomUUID(),
      draftRevision: 1,
      projectId: first.project.id,
      projectRevision: first.project.revision,
      snapshot: { ...cmd.snapshot, data: blank },
    });
    assert.equal(pending.phase, "draft");
    const stored = drafts.get(cmd.documentId);
    assert.ok(stored);
    assert.deepEqual(restoreDeck(stored.snapshot.data), blank);
    assert.equal(stored.snapshot.extra.importText, "{broken");
    assert.deepEqual(
      createStore(db, validateDeck).get(first.project.id).data,
      example,
    );
    assert.equal(createStore(db, validateDeck).list().length, 1);
  } finally {
    db.close();
  }
});
test("autosave: independent import project and stale revision conflict preserve both content branches", async () => {
  const db = database();
  try {
    const store = createStore(db, validateDeck);
    const a = store.create("Original", example);
    const b = store.create("Imported", example);
    assert.notEqual(a.id, b.id);
    store.update(a.id, "Remote change", example, a.revision);
    assert.throws(
      () => store.update(a.id, "Stale change", example, a.revision),
      /另一窗口/,
    );
    assert.equal(store.get(a.id).title, "Remote change");
    assert.equal(store.get(b.id).title, "Imported");
  } finally {
    db.close();
  }
});

test("容量边界：700 KB 正式模型上限后仍能保存并恢复有界完整草稿", async () => {
  const db = database();
  try {
    const drafts = createAutosaveStore(db, validateDeck);
    const large = {
      ...structuredClone(example),
      slides: Array.from({ length: 35 }, (_, i) => ({
        ...example.slides[0],
        id: `large-${i}`,
        markdown: "中".repeat(8000),
      })),
    };
    const cmd = {
      documentId: crypto.randomUUID(),
      mutationId: crypto.randomUUID(),
      draftRevision: 0,
      projectId: null,
      projectRevision: null,
      snapshot: {
        title: "Large",
        data: large,
        extra: { importText: "{unfinished" },
      },
    };
    const receipt = await drafts.commit(cmd);
    assert.equal(receipt.phase, "draft");
    const raw = drafts.get(cmd.documentId);
    assert.ok(raw);
    assert.deepEqual(restoreDeck(raw.snapshot.data), large);
    assert.equal(raw.snapshot.extra.importText, "{unfinished");
  } finally {
    db.close();
  }
});
