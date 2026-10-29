// ABOUTME: SQLite 持久化：项目版本与冲突、旧格式项目读出时迁移、媒体库去重与校验。
import assert from "node:assert/strict";
import { test } from "node:test";
import { DatabaseSync } from "node:sqlite";
import { readFileSync, readdirSync } from "node:fs";
import { createStore, StoreError } from "../src/server/store.ts";
import { createMediaStore } from "../src/server/media.ts";
import { validateDeck } from "../src/contracts/domain.ts";
import { seed, SEED_MEDIA_ID } from "../src/contracts/seed.ts";
import { DEMO_MEDIA } from "../src/server/demo-media.ts";

function database() {
  const db = new DatabaseSync(":memory:");
  for (const file of readdirSync(new URL("../migrations/", import.meta.url)).sort()) db.exec(readFileSync(new URL("../migrations/" + file, import.meta.url), "utf8"));
  return db;
}

test("项目保存恢复，冲突和删除使用版本号", () => {
  const db = database();
  try {
    const store = createStore(db, validateDeck);
    const created = store.create("中文验收", seed);
    assert.deepEqual(store.get(created.id).data, validateDeck(seed));
    const updated = store.update(created.id, "新名称", seed, created.revision);
    assert.equal(updated.revision, 2);
    assert.throws(
      () => store.update(created.id, "旧窗口", seed, 1),
      (error: unknown) => error instanceof StoreError && error.status === 409,
    );
    store.remove(created.id, 2);
    assert.equal(store.list().length, 0);
    assert.throws(() => store.create("标题", {}));
    assert.throws(() => store.create("", seed));
  } finally {
    db.close();
  }
});

test("0.3.0 时期保存的项目在读取时迁移为新模型，原表结构不变", () => {
  const db = database();
  try {
    const legacy = { theme: "paper", slides: [{ id: "a", title: "旧标题", kicker: "K", body: "一\n二", notes: "备注" }] };
    db.prepare("INSERT INTO projects(id,title,payload,revision,updated_at) VALUES(?,?,?,?,?)").run("old", "旧文稿", JSON.stringify(legacy), 3, new Date().toISOString());
    const store = createStore(db, validateDeck);
    const project = store.get("old");
    assert.equal(project.data.version, 2);
    assert.equal(project.data.theme.preset, "paper");
    assert.equal(project.data.slides[0].notes, "备注");
    const saved = store.update("old", "旧文稿", project.data, 3);
    assert.equal(saved.revision, 4);
    assert.deepEqual(store.get("old").data, project.data);
  } finally {
    db.close();
  }
});

test("媒体库按内容哈希去重，识别真实格式并限制大小", () => {
  const db = database();
  try {
    const media = createMediaStore(db);
    const demo = media.seedDemo();
    assert.equal(demo.id, SEED_MEDIA_ID);
    assert.deepEqual([demo.width, demo.height, demo.mime], [DEMO_MEDIA.width, DEMO_MEDIA.height, "image/jpeg"]);
    assert.equal(media.seedDemo().id, demo.id);
    assert.equal((db.prepare("SELECT COUNT(*) AS n FROM media").get() as { n: number }).n, 1);
    assert.equal(media.read(demo.id).base64, DEMO_MEDIA.base64);
    assert.ok(media.has(demo.id));
    assert.equal(media.has("0".repeat(64)), false);
    assert.throws(() => media.put("x.txt", Buffer.from("hello").toString("base64")), (e: unknown) => e instanceof StoreError && e.status === 415);
    assert.throws(() => media.put("big.png", Buffer.alloc(1_500_000).toString("base64")), (e: unknown) => e instanceof StoreError && e.status === 413);
    assert.throws(() => media.put("bad", "not base64!"), (e: unknown) => e instanceof StoreError && e.status === 400);
    assert.throws(() => media.get("../etc"), (e: unknown) => e instanceof StoreError && e.status === 400);
  } finally {
    db.close();
  }
});
