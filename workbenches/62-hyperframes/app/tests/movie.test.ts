import { test } from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { readFileSync } from "node:fs";
import {
  movieValue,
  restoreMovie,
  seed,
  composition,
  spans,
  total,
  sceneSvg,
} from "../src/contracts/movie.ts";
import { createStore } from "../src/server/store.ts";
test("timeline derives starts from ordered scenes and validates a complete movie", () => {
  assert.equal(total(seed), 11);
  assert.deepEqual(
    spans(seed).map((x) => x.start),
    [0, 4, 8],
  );
  assert.equal(movieValue(seed).scenes.length, 3);
});
test("working copy preserves incomplete timings and color without making renderable input", () => {
  const v = structuredClone(seed);
  v.scenes[0].duration = "";
  v.accent = "#";
  assert.equal(restoreMovie(v).scenes[0].duration, "");
  assert.throws(() => movieValue(v));
});
test("capacity, duplicate identities, malformed scene and negative times are rejected", () => {
  for (const edit of [
    (v: typeof seed) => {
      v.scenes[0].duration = "-1";
    },
    (v: typeof seed) => {
      v.scenes[1].id = v.scenes[0].id;
    },
    (v: typeof seed) => {
      v.scenes = Array.from({ length: 13 }, (_, i) => ({
        ...v.scenes[0],
        id: "s" + i,
      }));
    },
  ]) {
    const v = structuredClone(seed);
    edit(v);
    assert.throws(() => movieValue(v));
  }
});
test("native composition has exact duration, clip timing and escaped authored text", () => {
  const v = structuredClone(seed);
  v.scenes[0].title = "<script>alert(1)</script>";
  const html = composition(v);
  assert.ok(html.includes('data-duration="11"'));
  assert.ok(html.includes('data-start="8"'));
  assert.ok(html.includes("&lt;script&gt;"));
  assert.ok(!html.includes("<script>alert"));
  assert.match(html, /\.animate\(/);
});
test("generated SVG has no unescaped markup or user-controlled color injection", () => {
  const v = structuredClone(seed);
  v.accent = 'red" onload="x';
  assert.ok(!sceneSvg(v, v.scenes[0]).includes("onload"));
});
test("real SQLite project revision conflicts and independent import identities preserve data", () => {
  const db = new DatabaseSync(":memory:");
  db.exec(
    readFileSync(
      new URL("../migrations/0002_projects.sql", import.meta.url),
      "utf8",
    ),
  );
  const s = createStore(db, movieValue),
    a = s.create("A", seed),
    b = s.create("B", seed);
  assert.notEqual(a.id, b.id);
  s.update(a.id, "changed", seed, 1);
  assert.throws(() => s.update(a.id, "stale", seed, 1));
  assert.equal(s.get(a.id).title, "changed");
  db.close();
});
