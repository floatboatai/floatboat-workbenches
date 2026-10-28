import { test } from "node:test";
import assert from "node:assert/strict";
import { unzipSync, strFromU8, zipSync, strToU8 } from "fflate";
import { DatabaseSync } from "node:sqlite";
import { readFileSync } from "node:fs";
import { seed, kitValue, restoreKit, css } from "../src/contracts/domain.ts";
import { buildNative, importAssets } from "../src/server/penpot.ts";
import { createStore } from "../src/server/store.ts";
test("official Penpot library writes native manifest, color/typography libraries and components", async () => {
  const bytes = await buildNative(seed, "Fieldnotes");
  const z = unzipSync(bytes),
    m = JSON.parse(strFromU8(z["manifest.json"]));
  assert.equal(m.type, "penpot/export-files");
  assert.equal(m.generatedBy, "penpot-library/1.2.0");
  assert.equal(Object.keys(z).filter((x) => x.includes("/colors/")).length, 5);
  assert.equal(
    Object.keys(z).filter((x) => x.includes("/typographies/")).length,
    2,
  );
  assert.equal(
    Object.keys(z).filter((x) => x.includes("/components/")).length,
    2,
  );
  const shape = Object.entries(z)
    .filter(([n]) => /\/pages\/[^/]+\/[^/]+\.json$/.test(n))
    .map(([, v]) => JSON.parse(strFromU8(v)));
  assert.equal(shape.filter((x) => x.mainInstance).length, 2);
  assert.ok(
    shape.some(
      (x) =>
        x.type === "text" &&
        JSON.stringify(x.content).includes("A little room"),
    ),
  );
});
test("native Penpot package imports exact supported color and font definitions", async () => {
  const bytes = await buildNative(seed, "Assets");
  const result = importAssets(Buffer.from(bytes).toString("base64"));
  assert.deepEqual(
    result.data.colors.map((c) => [c.name, c.value]),
    seed.colors.map((c) => [c.name, c.value]),
  );
  assert.deepEqual(
    result.data.fonts.map((f) => [f.name, f.family, f.size]),
    seed.fonts.map((f) => [f.name, f.family, f.size]),
  );
  assert.equal(result.data.samples.length, 0);
  assert.match(result.data.notes, /未导入画板/);
});
test("incomplete colors and numeric fields survive draft decode but cannot export", async () => {
  const draft = structuredClone(seed);
  draft.colors[0].value = "#";
  draft.samples[0].width = "-";
  assert.equal(restoreKit(draft).colors[0].value, "#");
  assert.equal(restoreKit(draft).samples[0].width, "-");
  assert.throws(() => kitValue(draft));
  await assert.rejects(buildNative(draft, "Invalid"));
});
test("references, duplicate identifiers, limits and injection into sizes are rejected", () => {
  const a = structuredClone(seed);
  a.samples[0].colorId = "missing";
  assert.throws(() => kitValue(a));
  const b = structuredClone(seed);
  b.colors.push(b.colors[0]);
  assert.throws(() => restoreKit(b));
  const c = structuredClone(seed);
  c.fonts[0].size = "calc(2px)";
  assert.throws(() => kitValue(c));
  assert.throws(() =>
    restoreKit({ ...seed, colors: Array(101).fill(seed.colors[0]) }),
  );
});
test("CSS export is from validated exact tokens and string quoting", () => {
  assert.match(css(seed), /--color-pine: #255c4a/);
  assert.match(css(seed), /--font-body-family: "Source Sans Pro"/);
  assert.throws(() =>
    css({ ...seed, colors: [{ id: "x", name: "x", value: "red;}" }] }),
  );
});
test("invalid archive and unsupported/empty native imports fail honestly", () => {
  assert.throws(() => importAssets(Buffer.from("not zip").toString("base64")));
  assert.throws(() =>
    importAssets(
      Buffer.from(
        zipSync({ "manifest.json": strToU8('{"type":"other","files":[]}') }),
      ).toString("base64"),
    ),
  );
});
test("SQLite revisions protect a saved kit while working values retain exact text", () => {
  const db = new DatabaseSync(":memory:");
  db.exec(
    readFileSync(
      new URL("../migrations/0002_projects.sql", import.meta.url),
      "utf8",
    ),
  );
  const s = createStore(db, kitValue);
  const p = s.create("品牌", seed);
  s.update(p.id, "品牌", { ...seed, notes: "交付确认" }, p.revision);
  assert.throws(() => s.update(p.id, "旧", seed, p.revision), /另一窗口/);
  assert.equal(s.get(p.id).data.notes, "交付确认");
  assert.deepEqual(s.get(p.id).data.colors, seed.colors);
  db.close();
});
