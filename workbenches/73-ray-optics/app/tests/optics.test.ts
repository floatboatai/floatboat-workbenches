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
  qualityBudgets,
  MAX_OBJECTS,
} from "../src/contracts/optics.ts";
import { presetObject, shelfTypes } from "../src/contracts/catalog.ts";
import { examples } from "../src/contracts/examples.ts";
import { createAutosaveStore } from "../src/server/autosave.ts";
function native(source: string) {
  const s = new Scene();
  s.loadJSON(source, () => {});
  assert.equal(s.error, null);
  const sim = new Simulator(s, null, null, null, null, null, false, 100000);
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
test("unsupported or unsafe native inputs are rejected before loading instead of dropping fields", () => {
  const s = JSON.parse(seed.scene);
  for (const extra of [
    { version: 4 },
    { backgroundImage: "https://example.com/a.png" },
    { modules: { sample: {} } },
    { modules: [] },
    { colorMode: "neon" },
    { mode: "xray" },
    { observer: { c: { x: 0, y: 0 }, r: 0 } },
    { objs: [{ type: "Laser", p1: { x: 0, y: 0 }, p2: { x: 1, y: 1 } }] },
    { objs: [{ ...s.objs[0], custom: "keep me" }] },
    { objs: [{ type: "Mirror", p1: { x: 0, y: 0 } }] },
    { objs: [{ type: "Glass", path: [{ x: 0, y: 0 }, { x: 1, y: 1 }] }] },
    { objs: [{ type: "Glass", path: [{ x: 0, y: 0 }, { x: 1, y: 1 }, { x: 2, y: "a" }] }] },
    { objs: [{ type: "SphericalLens", p1: { x: 0, y: 0 } }] },
    { objs: [{ type: "PointSource", x: 1 }] },
    { objs: [{ type: "CustomGlass", p1: { x: 0, y: 0 }, p2: { x: 9, y: 0 }, eqn1: 3 }] },
    { objs: [{ type: "ModuleObj", points: [] }] },
  ])
    assert.throws(() => sceneValue(JSON.stringify({ ...s, ...extra })), JSON.stringify(extra));
});
test("native numeric and object boundaries reject broken or unbounded scenes", () => {
  const s = JSON.parse(seed.scene);
  for (const extra of [
    { gridSize: 0 },
    { scale: 100 },
    { rayModeDensity: 2000 },
    { origin: { x: "0", y: 0 } },
    { maxRayDepth: "Infinity" },
    { redWavelength: 400, violetWavelength: 500 },
    { objs: Array.from({ length: MAX_OBJECTS + 1 }, () => s.objs[0]) },
    { objs: [{ type: "IdealLens", p1: { x: 1, y: 1 }, p2: { x: 1, y: 9 }, focalLength: 0 }] },
    { objs: [{ type: "DiffractionGrating", p1: { x: 1, y: 1 }, p2: { x: 1, y: 9 }, lineDensity: -5 }] },
    { objs: [{ type: "Beam", p1: { x: 1, y: 1 }, p2: { x: 1, y: 9 }, brightness: 1e9 }] },
  ])
    assert.throws(() => sceneValue(JSON.stringify({ ...s, ...extra })), JSON.stringify(extra).slice(0, 80));
});
test("upstream 5.5.0 scene features validate: view modes, colours, modules, numeric strings and helper objects", () => {
  const scene = {
    version: 5,
    mode: "observer",
    observer: { c: { x: 300, y: 200 }, r: 12 },
    simulateColors: true,
    colorMode: "linear",
    redWavelength: 650,
    violetWavelength: 400,
    modules: { Pair: { numPoints: 2, params: ["n=1:0.1:2:1.5"], objs: [{ type: "Mirror", p1: { x: "`x_1`", y: "`y_1`" }, p2: { x: "`x_2`", y: "`y_2`" } }] } },
    objs: [
      { type: "SphericalLens", path: [{ x: 0, y: 0, arc: false }, { x: 10, y: 0, arc: false }, { x: 20, y: 50, arc: true }, { x: 10, y: 100, arc: false }, { x: 0, y: 100, arc: false }, { x: -10, y: 50, arc: true }], refIndex: 1.774, cauchyB: "0.01342" },
      { type: "AngleSource", p1: { x: 320, y: 400 }, p2: { x: 440, y: 520 }, brightness: 1, emisAngle: "15" },
      { type: "ModuleObj", module: "Pair", points: [{ x: 0, y: 0 }, { x: 10, y: 10 }], params: { n: 1.5 } },
      { type: "Handle", p1: { x: 1, y: 1 }, p2: { x: 1, y: 1 }, controlPoints: [{ dragContext: { part: 1 }, targetObjIndex: 0, newPoint: { x: 1, y: 2 } }], transformation: "rotation" },
      { type: "Drawing", strokes: [[1, 2, 3, 4]] },
      { type: "CropBox", p1: { x: 0, y: 0 }, p4: { x: 100, y: 80 } },
      { type: "CustomSurface", p1: { x: 0, y: 0 }, p2: { x: 50, y: 0 }, outRays: [{ eqnTheta: "\\theta_0", eqnP: "P_0" }] },
      { type: "Blocker", p1: { x: 5, y: 5 }, p2: { x: 5, y: 5 } },
    ],
  };
  assert.equal(sceneValue(JSON.stringify(scene)).objs.length, 8);
  const { s, sim } = native(JSON.stringify(scene));
  assert.equal(s.objs.length, 8);
  assert.ok(sim.processedRayCount > 0);
  sceneValue(s.toJSON());
});
test("every equipment-shelf preset is a valid upstream object that traces and round-trips", () => {
  assert.equal(shelfTypes.length, 27);
  for (const type of shelfTypes) {
    assert.ok(sceneObjs[type], type + " is vendored");
    const obj = presetObject(type, { x: 300, y: 300 }, 60, 1);
    const source = JSON.stringify({ version: 5, objs: [{ type: "PointSource", x: 120, y: 290 }, obj] });
    sceneValue(source);
    const { s, sim } = native(source);
    assert.equal(s.objs[1].serialize().type, type);
    assert.ok(sim.processedRayCount > 0, type);
    assert.deepEqual(sceneValue(s.toJSON()).objs.length, 2);
  }
  assert.throws(() => presetObject("Laser", { x: 0, y: 0 }, 10));
});
test("every gallery example validates, loads natively without errors and traces light", () => {
  assert.ok(examples.length >= 18);
  for (const e of examples) {
    const scene = sceneValue(e.scene);
    assert.ok(!scene.objs.some((o) => o.type === "CropBox"), e.id);
    const { s, sim } = native(e.scene);
    assert.equal(s.objs.filter((o) => o.error).length, 0, e.id);
    assert.ok(sim.processedRayCount > 0, e.id);
    if (e.origin === "upstream") {
      assert.ok(e.contributors.length && e.upstreamPath?.startsWith("data/galleryScenes/"), e.id);
      assert.doesNotMatch(e.scene, /\{\{\w+\}\}/, e.id + " placeholders resolved");
    }
  }
  const fibre = native(examples.find((e) => e.id === "optical-fibre")!.scene).s;
  const [exit, leak] = fibre.objs.filter((o) => o.serialize().type === "Detector");
  assert.ok(Number(exit.power) > 5 && Number(leak.power) === 0, "fibre guides light by total internal reflection");
});
test("quality and example fields round-trip and 0.7 working copies restore with defaults", () => {
  const legacy = { scene: seed.scene, notes: "旧笔记", original: "", originalName: "" };
  const restored = restoreOptics(legacy);
  assert.equal(restored.quality, "standard");
  assert.equal(restored.example, "");
  const fine = validateOptics({ ...seed, quality: "fine", example: "rainbows" });
  assert.equal(importOptics({ format: "ray-optics-workbench", title: "t", data: fine }).data.quality, "fine");
  assert.throws(() => restoreOptics({ ...seed, quality: "ultra" }));
  assert.ok(qualityBudgets.draft.rays < qualityBudgets.standard.rays && qualityBudgets.standard.rays < qualityBudgets.fine.rays);
  const upstream = importOptics(JSON.parse(examples.find((e) => e.id === "prisms")!.scene), "prisms.json");
  assert.equal(upstream.title, "反射棱镜");
  assert.equal(upstream.data.original, upstream.data.scene);
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
