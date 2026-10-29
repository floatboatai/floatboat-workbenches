import { test } from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { readFileSync } from "node:fs";
import { designValue, viewValue } from "../src/contracts/design.ts";
import { createStore } from "../src/server/store.ts";
const seed = JSON.parse(
  readFileSync(new URL("../src/contracts/seed.json", import.meta.url), "utf8"),
);
test("native document and per-frame review notes roundtrip without losing file bytes", () => {
  const value = designValue({ ...seed, notes: { 50: "首页", 64: "探索" } });
  assert.equal(value.file, seed.file);
  assert.equal(value.notes["64"], "探索");
});
test("malformed documents, notes and capacities are rejected", () => {
  for (const value of [
    { ...seed, file: "bad!" },
    { ...seed, notes: { bad: "x" } },
    { ...seed, notes: { 50: 3 } },
    { ...seed, file: "A".repeat(1_800_004) },
  ])
    assert.throws(() => designValue(value));
});
test("renderer errors and invalid frame shapes cannot become success", () => {
  assert.throws(() => viewValue({ error: "engine unavailable" }));
  assert.throws(() =>
    viewValue({
      frames: [],
      layers: [],
      selectedId: 1,
      width: NaN,
      height: 1,
      image: "",
      name: "x",
      file: seed.file,
      engine: "x",
    }),
  );
});
test("SQLite keeps native file exact and optimistic revisions protect accepted review", () => {
  const db = new DatabaseSync(":memory:");
  db.exec(
    readFileSync(
      new URL("../migrations/0002_projects.sql", import.meta.url),
      "utf8",
    ),
  );
  const s = createStore(db, designValue),
    a = s.create("校样", seed);
  s.update(a.id, "校样", { ...seed, notes: { 50: "已确认" } }, a.revision);
  assert.throws(() => s.update(a.id, "旧窗口", seed, a.revision), /另一窗口/);
  assert.equal(s.get(a.id).data.file, seed.file);
  assert.equal(s.get(a.id).data.notes["50"], "已确认");
  db.close();
});
