import assert from "node:assert/strict";
import { test } from "node:test";
import { DatabaseSync } from "node:sqlite";
import { readFileSync } from "node:fs";
import { createStore, StoreError } from "../src/server/store.ts";
import { validateWriting } from "../src/contracts/domain.ts";
import { seed } from "../src/contracts/sample.ts";
test("项目保存恢复，冲突和删除使用版本号", () => {
  const db = new DatabaseSync(":memory:");
  try {
    db.exec(
      readFileSync(
        new URL("../migrations/0002_projects.sql", import.meta.url),
        "utf8",
      ),
    );
    const store = createStore(db, validateWriting);
    const created = store.create("中文验收", seed);
    assert.deepEqual(store.get(created.id).data, validateWriting(seed));
    const updated = store.update(created.id, "新名称", seed, created.revision);
    assert.equal(updated.revision, 2);
    assert.equal(store.list().length, 1);
    assert.throws(
      () => store.update(created.id, "旧窗口", seed, 1),
      (error: unknown) => error instanceof StoreError && error.status === 409,
    );
    assert.throws(
      () => store.remove(created.id, 1),
      (error: unknown) => error instanceof StoreError && error.status === 409,
    );
    assert.equal(store.get(created.id).title, "新名称");
    store.remove(created.id, 2);
    assert.equal(store.list().length, 0);
    assert.throws(
      () => store.get(created.id),
      (error: unknown) => error instanceof StoreError && error.status === 404,
    );
  } finally {
    db.close();
  }
});
test("无效项目无法持久化", () => {
  const db = new DatabaseSync(":memory:");
  try {
    db.exec(
      readFileSync(
        new URL("../migrations/0002_projects.sql", import.meta.url),
        "utf8",
      ),
    );
    const store = createStore(db, validateWriting);
    assert.throws(() => store.create("标题", {}));
    assert.throws(() => store.create("", seed));
    assert.equal(store.list().length, 0);
  } finally {
    db.close();
  }
});
