import { test } from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { readFileSync } from "node:fs";
import { randomUUID, createHash } from "node:crypto";
import { Scene, Simulator, sceneObjs } from "../src/ui/vendor/ray-optics.js";
import {
  seed,
  sceneValue,
  validateOptics,
  restoreOptics,
  importOptics,
  makeObject,
} from "../src/contracts/optics.ts";
import { createAutosaveStore } from "../src/server/autosave.ts";
function native(source: string) {
  const s = new Scene();
  s.loadJSON(source, () => {});
  assert.equal(s.error, null);
  const sim = new Simulator(s, null, null, null, null, null, false, 10000);
  sim.updateSimulation();
  return { s, sim };
}
function database() {
  const db = new DatabaseSync(":memory:");
  for (const f of ["0002_projects.sql", "0003_autosave.sql"])
    db.exec(
      readFileSync(new URL("../migrations/" + f, import.meta.url), "utf8"),
    );
  return db;
}
test("native CPU lens scene produces detector readings and round-trippable geometry", () => {
  validateOptics(seed);
  const { s, sim } = native(seed.scene);
  assert.ok(sim.processedRayCount > 20);
  assert.ok(Math.abs(s.objs[2].power ?? 0) > 0);
  const exported = s.toJSON(),
    restored = new Scene();
  restored.loadJSON(exported, () => {});
  assert.equal(restored.objs.length, 6);
  assert.equal(restored.objs[1].serialize().focalLength, 210);
  assert.deepEqual(
    sceneValue(exported).objs,
    sceneValue(restored.toJSON()).objs,
  );
});
test("native reflection sends a ray back through a detector behind its source", () => {
  const { s, sim } = native(
    JSON.stringify({
      version: 5,
      objs: [
        { type: "SingleRay", p1: { x: 0, y: 0 }, p2: { x: 10, y: 0 } },
        { type: "Mirror", p1: { x: 40, y: -20 }, p2: { x: 40, y: 20 } },
        { type: "Detector", p1: { x: -20, y: -20 }, p2: { x: -20, y: 20 } },
      ],
    }),
  );
  assert.equal(sim.processedRayCount, 3);
  assert.equal(Math.abs(s.objs[2].power ?? 0), 1);
});
test("unsupported native inputs are rejected before loading instead of dropping fields", () => {
  const s = JSON.parse(seed.scene);
  for (const extra of [
    { version: 4 },
    { backgroundImage: "https://example.com/a.png" },
    { modules: { sample: {} } },
    { colorMode: "linear" },
    { mode: "observer" },
    { objs: [{ type: "CustomMirror", equation: "x" }] },
  ])
    assert.throws(() => sceneValue(JSON.stringify({ ...s, ...extra })));
  assert.throws(() =>
    sceneValue(
      JSON.stringify({ ...s, objs: [{ ...s.objs[0], custom: "keep me" }] }),
    ),
  );
});
test("native numeric and object boundaries reject broken or unbounded scenes", () => {
  const s = JSON.parse(seed.scene);
  for (const extra of [
    { gridSize: 0 },
    { gridSize: 0.001 },
    { scale: 100 },
    { rayModeDensity: 2 },
    { origin: { x: "0", y: 0 } },
    { theme: { ray: { dash: ["x"] } } },
    { maxRayDepth: "Infinity" },
    { objs: Array.from({ length: 101 }, () => s.objs[0]) },
    {
      objs: [
        {
          type: "IdealLens",
          p1: { x: 1, y: 1 },
          p2: { x: 1, y: 1 },
          focalLength: 0,
        },
      ],
    },
  ])
    assert.throws(() => sceneValue(JSON.stringify({ ...s, ...extra })));
});
test("all toolbar instruments create usable native scene objects", () => {
  for (const type of [
    "SingleRay",
    "Beam",
    "Mirror",
    "IdealLens",
    "CircleGlass",
    "PlaneGlass",
    "Blocker",
    "Detector",
    "Ruler",
    "TextLabel",
  ]) {
    const obj = makeObject(type, 3),
      source = JSON.stringify({ version: 5, objs: [obj] });
    sceneValue(source);
    const { s } = native(source);
    s.pushObj(new sceneObjs[type](s, obj));
    assert.equal(s.objs.length, 2);
    assert.equal(s.objs[1].serialize().type, type);
  }
});
test("recovery import keeps unfinished parameter and JSON editor inputs", () => {
  const extra = {
    raw: "{unfinished",
    parameters: {
      index: 1,
      base: "a",
      object: { type: "IdealLens" },
      values: { focalLength: "-", name: "" },
    },
    selected: 1,
  };
  const imported = importOptics({
    snapshot: { title: "实验稿", data: seed, extra },
  });
  assert.deepEqual(imported.extra, extra);
  assert.equal(imported.data.scene, seed.scene);
  assert.throws(() =>
    importOptics({
      format: "ray-optics-workbench",
      title: "x".repeat(121),
      data: seed,
    }),
  );
});
test("real SQLite saves full drafts, retries the same mutation and rejects stale writer", async () => {
  const db = database();
  try {
    const store = createAutosaveStore(db, validateOptics),
      documentId = randomUUID(),
      mutationId = randomUUID(),
      snapshot = {
        title: "光学工作稿",
        data: seed,
        extra: {
          raw: "{unfinished",
          parameters: { values: { focalLength: "-" } },
        },
      },
      input = {
        documentId,
        mutationId,
        draftRevision: 0,
        projectId: null,
        projectRevision: null,
        snapshot,
      };
    const receipt = await store.commit(input);
    assert.equal(receipt.phase, "saved");
    assert.deepEqual(store.get(documentId)?.snapshot.extra, snapshot.extra);
    assert.deepEqual(await store.commit(input), receipt);
    const changed = {
      ...input,
      mutationId: randomUUID(),
      draftRevision: receipt.draftRevision,
      projectId: receipt.project!.id,
      projectRevision: receipt.project!.revision,
      snapshot: { ...snapshot, data: { ...seed, notes: "复核后的笔记" } },
    };
    assert.equal((await store.commit(changed)).phase, "saved");
    await assert.rejects(
      store.commit({ ...changed, mutationId: randomUUID() }),
      /另一窗口/,
    );
    assert.equal(db.prepare("SELECT count(*) AS n FROM projects").get()?.n, 1);
  } finally {
    db.close();
  }
});
test("a confirmed UTF-8 over-budget working copy restores without replacing the formal project", async () => {
  const db = database();
  try {
    const store = createAutosaveStore(db, validateOptics),
      documentId = randomUUID();
    const first = await store.commit({
      documentId,
      mutationId: randomUUID(),
      draftRevision: 0,
      projectId: null,
      projectRevision: null,
      snapshot: { title: "容量试验", data: seed, extra: {} },
    });
    const large = {
      ...seed,
      original: "原".repeat(300000),
      originalName: "原始输入",
    };
    assert.throws(() => validateOptics(large));
    assert.deepEqual(restoreOptics(large), large);
    const receipt = await store.commit({
      documentId,
      mutationId: randomUUID(),
      draftRevision: first.draftRevision,
      projectId: first.project!.id,
      projectRevision: first.project!.revision,
      snapshot: { title: "容量试验", data: large, extra: { raw: "-" } },
    });
    assert.equal(receipt.phase, "draft");
    const record = store.get(documentId)!;
    assert.equal(
      importOptics({ snapshot: record.snapshot }).data.original,
      large.original,
    );
    assert.equal(
      JSON.parse(
        String(
          db
            .prepare("SELECT payload FROM projects WHERE id=?")
            .get(first.project!.id)?.payload,
        ),
      ).original,
      "",
    );
  } finally {
    db.close();
  }
});
test("vendored upstream source hashes and code attribution survive resource relocation", () => {
  const appRoot = new URL("../", import.meta.url),
    manifest = JSON.parse(
      readFileSync(new URL("manifest.json", appRoot), "utf8"),
    ),
    resource = manifest.resources.find(
      (r: { id: string }) => r.id === "notices",
    );
  const base = new URL(resource.path + "/", appRoot),
    provenance = JSON.parse(
      readFileSync(new URL("ray-optics-provenance.json", base), "utf8"),
    );
  assert.equal(provenance.commit, "daf76772c73a85e1a2568c4e2e71613bba1fab77");
  for (const f of provenance.files) {
    const rel = f.vendored.replace(/^notices\//, "");
    assert.equal(
      createHash("sha256")
        .update(readFileSync(new URL(rel, base)))
        .digest("hex"),
      f.vendoredSha256,
    );
  }
  assert.match(
    readFileSync(new URL("Ray-Optics-LICENSE.txt", base), "utf8"),
    /Apache License/,
  );
});

test("confirmed snapshots above 1.9MB import from larger recovery envelopes", async () => {
  const db = database();
  try {
    const store = createAutosaveStore(db, validateOptics);
    const snapshot = {
      title: "恢复边界",
      data: seed,
      extra: { raw: "r".repeat(1920000) },
    };
    const receipt = await store.commit({
      documentId: randomUUID(),
      mutationId: randomUUID(),
      draftRevision: 0,
      projectId: null,
      projectRevision: null,
      snapshot,
    });
    assert.equal(receipt.phase, "saved");
    const outer = { snapshot, current: receipt.project, pending: { snapshot } };
    assert.ok(Buffer.byteLength(JSON.stringify(outer)) > 1900000);
    assert.equal(importOptics(outer).extra.raw, snapshot.extra.raw);
  } finally {
    db.close();
  }
});
