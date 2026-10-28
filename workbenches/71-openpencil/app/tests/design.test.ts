import assert from "node:assert/strict";
import { test } from "node:test";
import { DatabaseSync } from "node:sqlite";
import { readFileSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  seedFile,
  readGraph,
  viewFile,
  transform,
} from "../src/server/engine.ts";
import { designValue, propertyValue } from "../src/contracts/design.ts";
import { createStore } from "../src/server/store.ts";
const seed = await seedFile();
test("native OpenPencil FIG roundtrip retains artboard, typed text and SVG", async () => {
  const graph = await readGraph(seed);
  assert.equal(graph.getPages()[0].name, "产品组件");
  const view = await viewFile(seed);
  assert.equal(view.layers.length, 8);
  assert.match(view.svg, /Keep your curiosity/);
  assert.equal(view.width, 720);
  assert.ok([...graph.nodes.values()].some((n) => n.type === "TEXT"));
});
test("property edits persist through a real FIG encode and decode", async () => {
  const before = await viewFile(seed);
  const n = before.layers.find((n) => n.name === "主标题")!;
  const result = await transform(seed, {
    kind: "update",
    id: n.id,
    props: {
      ...n,
      x: "67",
      y: "180",
      width: "530",
      height: "65",
      text: "全新的设计标题",
      color: "#cc3355",
    },
  });
  const after = await viewFile(result.file);
  const changed = after.layers.find((n) => n.name === "主标题")!;
  assert.equal(changed.text, "全新的设计标题");
  assert.equal(changed.x, 67);
  assert.equal(changed.color, "#cc3355");
  assert.match(after.svg, /全新的设计标题/);
  assert.match((await viewFile(seed)).svg, /Keep your curiosity/);
});
test("duplicate and delete operate on upstream graph with independent source", async () => {
  const before = await viewFile(seed);
  const n = before.layers.find((n) => n.name === "点缀圆形")!;
  const copied = await transform(seed, { kind: "duplicate", id: n.id });
  const clone = copied.view.layers.find((x) => x.name.endsWith("副本"))!;
  assert.equal(clone.x, n.x + 24);
  const removed = await transform(copied.file, {
    kind: "delete",
    id: clone.id,
  });
  assert.equal(removed.view.layers.length, before.layers.length);
});
test("new frame and text are real editable native nodes", async () => {
  const result = await transform(seed, { kind: "add", type: "FRAME" });
  assert.equal(result.view.layers.filter((n) => n.type === "FRAME").length, 2);
  const text = await transform(result.file, { kind: "add", type: "TEXT" });
  assert.ok(text.view.layers.some((n) => n.text === "New idea"));
});
test("invalid properties and destructive root operations fail without output", async () => {
  assert.throws(() =>
    propertyValue({
      name: "x",
      x: "",
      y: "0",
      width: "1",
      height: "1",
      text: "",
      color: "#000000",
    }),
  );
  assert.throws(() =>
    propertyValue({
      name: "x",
      x: "0",
      y: "0",
      width: "-1",
      height: "1",
      text: "",
      color: "red",
    }),
  );
  const graph = await readGraph(seed);
  await assert.rejects(transform(seed, { kind: "delete", id: graph.rootId }));
  await assert.rejects(transform(seed, { kind: "add", type: "SCRIPT" }));
});
test("malformed or oversized native inputs are rejected", async () => {
  assert.throws(() => designValue({ file: "not base64", notes: "" }));
  assert.throws(() => designValue({ file: "A".repeat(800004), notes: "" }));
  await assert.rejects(readGraph(Buffer.from("bad fig").toString("base64")));
});
test("SQLite stores exact native file and rejects stale updates after reopen", () => {
  const dir = mkdtempSync(join(tmpdir(), "openpencil-"));
  const path = join(dir, "test.db");
  let db = new DatabaseSync(path);
  db.exec(
    readFileSync(
      new URL("../migrations/0002_projects.sql", import.meta.url),
      "utf8",
    ),
  );
  const store = createStore(db, designValue);
  const saved = store.create("设计", { file: seed, notes: "交付" });
  store.update(
    saved.id,
    "设计",
    { file: seed, notes: "下一版" },
    saved.revision,
  );
  assert.throws(
    () =>
      store.update(
        saved.id,
        "旧",
        { file: seed, notes: "覆盖" },
        saved.revision,
      ),
    /另一窗口/,
  );
  db.close();
  db = new DatabaseSync(path);
  assert.equal(createStore(db, designValue).get(saved.id).data.file, seed);
  assert.equal(createStore(db, designValue).get(saved.id).data.notes, "下一版");
  db.close();
  rmSync(dir, { recursive: true });
});
