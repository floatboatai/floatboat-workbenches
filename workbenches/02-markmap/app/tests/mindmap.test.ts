import assert from "node:assert/strict";
import { test } from "node:test";
import { DatabaseSync } from "node:sqlite";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createStore, StoreError } from "../src/server/store.ts";
import { seed, validateMindmap } from "../src/contracts/mindmap.ts";
test("大纲边界拒绝无效和超量数据", () => {
  assert.deepEqual(validateMindmap(seed), seed);
  assert.throws(() => validateMindmap({ markdown: 42 }));
  assert.throws(() => validateMindmap({ markdown: "x".repeat(50001) }));
  assert.throws(() => validateMindmap({ markdown: "line\n".repeat(501) }));
});
test("存储重启恢复、并发冲突与删除", () => {
  const dir = mkdtempSync(join(tmpdir(), "mindmap-"));
  let db = new DatabaseSync(join(dir, "data.sqlite"));
  try {
    db.exec(
      "CREATE TABLE projects(id TEXT PRIMARY KEY,title TEXT NOT NULL,payload TEXT NOT NULL,revision INTEGER NOT NULL DEFAULT 1,updated_at TEXT NOT NULL)",
    );
    let store = createStore(db, validateMindmap);
    const first = store.create("研究计划", seed);
    const updated = store.update(
      first.id,
      "中文脑图",
      { markdown: "# 完成\n- 结论" },
      1,
    );
    assert.equal(updated.revision, 2);
    assert.throws(
      () => store.update(first.id, "冲突", seed, 1),
      (e) => e instanceof StoreError && e.status === 409,
    );
    assert.throws(
      () => store.remove(first.id, 1),
      (e) => e instanceof StoreError && e.status === 409,
    );
    db.close();
    db = new DatabaseSync(join(dir, "data.sqlite"));
    store = createStore(db, validateMindmap);
    assert.equal(store.get(first.id).data.markdown, "# 完成\n- 结论");
    store.remove(first.id, 2);
    assert.equal(store.list().length, 0);
  } finally {
    db.close();
    rmSync(dir, { recursive: true, force: true });
  }
});
