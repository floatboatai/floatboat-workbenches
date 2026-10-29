import assert from "node:assert/strict";
import { test } from "node:test";
import { DatabaseSync } from "node:sqlite";
import { readFileSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { validate, seed, blank, fromGenerated, analyzeModel } from "../src/contracts/model.ts";
import { createStore, StoreError } from "../src/server/store.ts";

test("业务输入校验", () => {
  assert.deepEqual(validate(seed), seed);
  assert.deepEqual(validate(blank), blank);
  assert.throws(() => validate(null));
  assert.throws(() => validate({}));
  assert.throws(() => validate({ format: "xml", source: "a: 1" }), /YAML 或 JSON/);
  assert.throws(() => validate({ format: "yaml", source: "openapi: 3.0.3\ninfo: [" }), /第 \d+ 行/);
});

test("示例规格是完整的多标签 API", () => {
  const analysis = analyzeModel(seed);
  assert.equal(analysis.diagnostics.filter((item) => item.severity === "error").length, 0);
  assert.equal(analysis.diagnostics.length, 0, JSON.stringify(analysis.diagnostics));
  assert.equal(analysis.operations.length, 12);
  assert.deepEqual(
    [...new Set(analysis.operations.map((operation) => operation.tags[0]))],
    ["馆藏", "读者", "借阅", "系统"],
  );
  assert.deepEqual(
    [...new Set(analysis.operations.map((operation) => operation.method))].sort(),
    ["delete", "get", "post", "put"],
  );
  assert.equal(analysis.schemas.length, 8);
  assert.deepEqual(
    analysis.security.map((item) => item.name),
    ["bearerAuth", "librarianKey"],
  );
  assert.ok(analysis.servers.some((server) => server.url.startsWith("https://")));
  const createBook = analysis.operations.find((item) => item.operationId === "createBook");
  assert.equal(seed.source.split("\n")[(createBook?.line ?? 1) - 1].trim(), "post:");
});

test("0.3.0 保存的 JSON 对象升级为 JSON 原文", () => {
  const legacy = {
    spec: {
      openapi: "3.0.3",
      info: { title: "旧版", version: "1.0.0" },
      servers: [{ url: "/" }],
      paths: { "/api/demo/health": { get: { responses: { "200": { description: "ok" } } } } },
    },
  };
  const upgraded = validate(legacy);
  assert.equal(upgraded.format, "json");
  assert.deepEqual(JSON.parse(upgraded.source), legacy.spec);
  assert.deepEqual(validate(upgraded), upgraded);
});

test("生成结果转换为可编辑的 YAML", () => {
  const model = fromGenerated({
    spec: { openapi: "3.0.3", info: { title: "会议室", version: "1.0.0" }, paths: {} },
  });
  assert.equal(model.format, "yaml");
  assert.match(model.source, /^openapi: 3\.0\.3/);
  assert.throws(() => fromGenerated({ text: "no" }));
});

test("真实 SQLite 持久化、冲突及删除", () => {
  const dir = mkdtempSync(join(tmpdir(), "studio-"));
  let db = new DatabaseSync(join(dir, "data.sqlite"));
  try {
    db.exec(readFileSync(new URL("../migrations/0002_projects.sql", import.meta.url), "utf8"));
    let store = createStore(db, validate);
    const saved = store.create("验收项目", seed);
    const updated = store.update(saved.id, "更新项目", blank, saved.revision);
    assert.equal(updated.revision, 2);
    assert.deepEqual(updated.data, blank);
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
    assert.equal(store.get(saved.id).data.source, blank.source);
    store.remove(saved.id, 2);
    assert.equal(store.list().length, 0);
  } finally {
    db.close();
    rmSync(dir, { recursive: true, force: true });
  }
});
