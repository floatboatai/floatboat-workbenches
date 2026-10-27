import { restoreDraftData } from "../src/contracts/model.ts";
import assert from "node:assert/strict";
import { test } from "node:test";
import { DatabaseSync } from "node:sqlite";
import { readFileSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { validate, seed } from "../src/contracts/model.ts";
import { createStore, StoreError } from "../src/server/store.ts";
test("业务输入校验", () => {
  assert.deepEqual(validate(seed), seed);
  assert.throws(() => validate(null));
  assert.throws(() => validate({}));
});
test("真实 SQLite 持久化、冲突及删除", () => {
  const dir = mkdtempSync(join(tmpdir(), "studio-"));
  let db = new DatabaseSync(join(dir, "data.sqlite"));
  try {
    db.exec(
      readFileSync(
        new URL("../migrations/0002_projects.sql", import.meta.url),
        "utf8",
      ),
    );
    let store = createStore(db, validate);
    const saved = store.create("验收项目", seed);
    const updated = store.update(saved.id, "更新项目", seed, saved.revision);
    assert.equal(updated.revision, 2);
    assert.throws(
      () => store.update(saved.id, "覆盖", seed, 1),
      (e) => e instanceof StoreError && e.status === 409,
    );
    assert.throws(
      () => store.remove(saved.id, 1),
      (e) => e instanceof StoreError && e.status === 409,
    );
    db.close();
    db = new DatabaseSync(join(dir, "data.sqlite"));
    store = createStore(db, validate);
    assert.equal(store.get(saved.id).title, "更新项目");
    store.remove(saved.id, 2);
    assert.equal(store.list().length, 0);
  } finally {
    db.close();
    rmSync(dir, { recursive: true, force: true });
  }
});

test("无效或空源码草稿可恢复，正式模型仍保留输入约束", () => {
  for (const source of [
    "",
    "this is not Mermaid",
    'flowchart LR\nA@{img: \"https://example.com/a.png\"}',
  ])
    assert.equal(restoreDraftData({ source }).source, source);
  assert.throws(() => validate({ source: "" }));
  assert.throws(() =>
    validate({
      source: 'flowchart LR\nA@{img: \"https://example.com/a.png\"}',
    }),
  );
  assert.throws(() => restoreDraftData({ source: 123 }));
});
