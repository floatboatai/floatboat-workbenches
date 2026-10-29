import assert from "node:assert/strict";
import { test } from "node:test";
import { DatabaseSync } from "node:sqlite";
import { readFileSync, readdirSync } from "node:fs";
import { createDatasetStore, decodeText, sniffFormat, uploadSessions, CHUNK_BYTES } from "../src/server/datasets.ts";
import { verifyModel } from "../src/server/schema.ts";
import { createAutosaveStore } from "../src/server/autosave.ts";
import { StoreError } from "../src/server/store.ts";
import { seed, validate } from "../src/contracts/model.ts";
import { encodeBundle, readImportedJson, BUNDLE_FORMAT } from "../src/contracts/bundle.ts";

function database() {
  const db = new DatabaseSync(":memory:");
  const dir = new URL("../migrations/", import.meta.url);
  for (const file of readdirSync(dir).sort()) db.exec(readFileSync(new URL(file, dir), "utf8"));
  return db;
}

test("数据集存储：示例预置、按内容去重、解析失败与读取", () => {
  const db = database();
  const store = createDatasetStore(db);
  store.installSamples();
  store.installSamples();
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM datasets").get()?.n, 3);
  assert.ok(store.has(seed.datasets[0].id));
  const a = store.save("门店.csv", "城市,销量\n上海,12\n北京,8\n");
  const b = store.save("副本.csv", "城市,销量\n上海,12\n北京,8\n");
  assert.equal(a.id, b.id);
  assert.match(a.id, /^[0-9a-f]{64}$/);
  assert.deepEqual(a.columns, [
    { name: "城市", type: "nominal" },
    { name: "销量", type: "quantitative" },
  ]);
  assert.equal(store.content(a.id).content, "城市,销量\n上海,12\n北京,8\n");
  assert.throws(() => store.save("x.json", "[1"), (e) => e instanceof StoreError && e.status === 422);
  assert.throws(() => store.content("0".repeat(64)), (e) => e instanceof StoreError && e.status === 404);
  assert.deepEqual(store.missing([a.id, "f".repeat(64)]), ["f".repeat(64)]);
});

test("文本解码与格式嗅探：UTF-8、GB18030（Excel 中文 CSV）", () => {
  const gbk = Uint8Array.from([0xb3, 0xc7, 0xca, 0xd0, 0x2c, 0x61, 0x0a]); // "城市,a\n"
  assert.equal(decodeText(gbk), "城市,a\n");
  assert.equal(decodeText(new TextEncoder().encode("温度")), "温度");
  assert.equal(sniffFormat("a.txt", "[{}]"), "json");
  assert.equal(sniffFormat("a.txt", "a\tb\n1\t2"), "tsv");
  assert.equal(sniffFormat("a.csv", "a\tb"), "csv");
  assert.equal(sniffFormat("data", "x,y\n1,2"), "csv");
  assert.throws(() => sniffFormat("photo.png", "\u0089PNG"), (e) => e instanceof StoreError && e.status === 415);
});

test("分块上传：顺序、长度与大小上限", () => {
  const sessions = uploadSessions();
  assert.throws(() => sessions.create({ file: "big.csv", bytes: 21 * 1024 * 1024 }), /20 MiB/);
  assert.throws(() => sessions.create({ file: "../x.csv", bytes: 3 }), /无效/);
  const bytes = Buffer.from("a,b\n1,2\n");
  const { id, chunk } = sessions.create({ file: "x.csv", bytes: bytes.length });
  assert.equal(chunk, CHUNK_BYTES);
  assert.throws(() => sessions.chunk(id, { offset: 4, base64: bytes.subarray(4).toString("base64") }), /顺序/);
  sessions.chunk(id, { offset: 0, base64: bytes.subarray(0, 4).toString("base64") });
  assert.throws(() => sessions.take(id), /尚未上传完整/);
  assert.deepEqual(sessions.chunk(id, { offset: 4, base64: bytes.subarray(4).toString("base64") }), { received: 8, complete: true });
  assert.equal(Buffer.from(sessions.take(id).bytes).toString(), "a,b\n1,2\n");
  assert.equal(sessions.size, 0);
});

test("正式保存前的完整校验与自动保存草稿", async () => {
  const db = database();
  const datasets = createDatasetStore(db);
  datasets.installSamples();
  assert.doesNotThrow(() => verifyModel(seed, datasets));
  const bad = { ...seed, spec: { ...seed.spec, layer: [{ mark: "lien" }] } };
  assert.throws(() => verifyModel(bad, datasets), /schema（\/layer\/0\/mark）/);
  const missing = { ...seed, datasets: [{ ...seed.datasets[0], id: "a".repeat(64) }] };
  assert.throws(() => verifyModel(missing, datasets), /缺少数据集 weather\.csv/);

  const drafts = createAutosaveStore(db, validate, undefined, { verify: async (model) => verifyModel(model, datasets) });
  const documentId = crypto.randomUUID();
  const first = await drafts.commit({
    documentId,
    mutationId: crypto.randomUUID(),
    draftRevision: 0,
    projectId: null,
    projectRevision: null,
    snapshot: { title: "草稿", data: bad, extra: { jsonText: "{…" } },
  });
  assert.equal(first.phase, "draft");
  assert.match(first.message, /schema/);
  const second = await drafts.commit({
    documentId,
    mutationId: crypto.randomUUID(),
    draftRevision: 1,
    projectId: null,
    projectRevision: null,
    snapshot: { title: "气温", data: seed, extra: {} },
  });
  assert.equal(second.phase, "saved");
  assert.equal(second.project?.data.datasets[0].name, "weather");
});

test("项目包导出/导入与规格文件识别", () => {
  const bundle = JSON.parse(
    encodeBundle("销售看板", { data: { name: "sales" }, mark: "bar" }, [
      {
        ref: { id: "b".repeat(64), name: "sales", file: "sales.csv", format: "csv", bytes: 8, rows: 1, columns: [] },
        content: "a,b\n1,2\n",
      },
    ]),
  );
  assert.equal(bundle.format, BUNDLE_FORMAT);
  const read = readImportedJson(bundle, "fallback");
  assert.equal(read.kind, "bundle");
  if (read.kind === "bundle") {
    assert.equal(read.title, "销售看板");
    assert.deepEqual(read.datasets, [{ name: "sales", file: "sales.csv", format: "csv", content: "a,b\n1,2\n" }]);
  }
  const spec = readImportedJson({ title: { text: "气温" }, mark: "line" }, "fallback");
  assert.deepEqual(spec, { kind: "spec", title: "气温", spec: { title: { text: "气温" }, mark: "line" } });
  assert.equal(readImportedJson({ spec: { layer: [] } }, "文件名").title, "文件名");
  assert.throws(() => readImportedJson({ $schema: "https://vega.github.io/schema/vega/v5.json", marks: [] }, "x"), /Vega 规格/);
  assert.throws(() => readImportedJson([{ a: 1 }], "x"), /数据数组/);
  assert.throws(() => readImportedJson({ ...bundle, datasets: [bundle.datasets[0], bundle.datasets[0]] }, "x"), /重复/);
});
