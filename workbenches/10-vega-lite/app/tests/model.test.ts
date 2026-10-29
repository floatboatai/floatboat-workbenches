import assert from "node:assert/strict";
import { test } from "node:test";
import { DatabaseSync } from "node:sqlite";
import { readFileSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { validate, seed, checkSpec, exampleModel, blankSpec } from "../src/contracts/model.ts";
import { createStore, StoreError } from "../src/server/store.ts";
import { findExternalRefs } from "../src/contracts/render-spec.ts";

test("业务输入校验：完整语法、旧版模型与边界", () => {
  assert.deepEqual(validate(seed), seed);
  assert.throws(() => validate(null));
  assert.throws(() => validate({}));
  // 0.3.0 保存的模型只有 spec 与内嵌数据，仍可读取。
  const legacy = validate({
    spec: { data: { values: [{ 渠道: "搜索", 线索: 42 }] }, mark: "bar", encoding: { x: { field: "渠道", type: "nominal" } } },
  });
  assert.deepEqual(legacy.datasets, []);
  // 组合视图不再需要顶层 mark。
  for (const key of ["layer", "hconcat", "vconcat", "concat"])
    assert.doesNotThrow(() => checkSpec({ data: { values: [] }, [key]: [{ mark: "point" }] }));
  assert.doesNotThrow(() => checkSpec({ data: { values: [] }, facet: { row: { field: "a" } }, spec: { mark: "arc" } }));
  assert.doesNotThrow(() => checkSpec({ repeat: ["a"], spec: { mark: "boxplot" } }));
  assert.throws(() => checkSpec({ data: { values: [] } }), /mark、layer/);
  assert.throws(() => checkSpec({ $schema: "https://vega.github.io/schema/vega/v6.json", marks: [] }), /Vega 规格/);
  assert.throws(() => checkSpec(JSON.parse('{"mark":"bar","__proto__":{"x":1}}')), /__proto__/);
  assert.throws(() => checkSpec({ mark: "bar", data: { values: [{ t: "x".repeat(710_000) }] } }), /700 KB/);
  assert.doesNotThrow(() => validate({ spec: blankSpec(), datasets: [] }));
  assert.throws(
    () => validate({ spec: blankSpec(), datasets: [seed.datasets[0], seed.datasets[0]] }),
    /重复/,
  );
});

test("外部 URL 不再被结构校验拒绝，而是在渲染前标记为被阻止的资源", () => {
  const spec = { ...seed.spec, data: { url: "https://example.com/a.csv" } };
  assert.doesNotThrow(() => validate({ spec, datasets: [] }));
  const refs = findExternalRefs(spec, []);
  assert.deepEqual(refs, [{ pointer: "/data/url", url: "https://example.com/a.csv", kind: "data" }]);
  // 已导入的同名文件不算外部资源。
  const ds = exampleModel("monthly-revenue-stack").datasets;
  assert.deepEqual(findExternalRefs({ mark: "bar", data: { url: "data/sales.csv" } }, ds), []);
  assert.equal(findExternalRefs({ mark: "image", encoding: { url: { value: "http://x/y.png" } } }, []).length, 1);
  assert.equal(findExternalRefs({ mark: "image", encoding: { url: { value: "data:image/png;base64,AAAA" } } }, []).length, 0);
});

test("真实 SQLite 持久化、冲突及删除", () => {
  const dir = mkdtempSync(join(tmpdir(), "studio-"));
  let db = new DatabaseSync(join(dir, "data.sqlite"));
  try {
    db.exec(readFileSync(new URL("../migrations/0002_projects.sql", import.meta.url), "utf8"));
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
    assert.deepEqual(store.get(saved.id).data.datasets, seed.datasets);
    store.remove(saved.id, 2);
    assert.equal(store.list().length, 0);
  } finally {
    db.close();
    rmSync(dir, { recursive: true, force: true });
  }
});
