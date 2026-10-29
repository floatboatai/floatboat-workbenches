import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import { sampleAsset } from "../src/server/sample.ts";
import { hash } from "../src/server/model.ts";
import {
  seed,
  validateAsset,
  restoreAsset,
  importAsset,
  recipeKey,
  stageKey,
  validStages,
  documentRefs,
  digest,
} from "../src/contracts/asset.ts";
import { passValue } from "../src/contracts/pipeline.ts";
import { eulerToQuat, quatToEuler } from "../src/contracts/transform.ts";
import { createAutosaveStore } from "../src/server/autosave.ts";
import { resourceStore } from "../src/server/resources.ts";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
const source = await sampleAsset(),
  ref = { id: hash(source), name: "sample.glb", bytes: source.length };
function db() {
  const d = new DatabaseSync(":memory:");
  for (const n of ["0002_projects.sql", "0003_autosave.sql"])
    d.exec(readFileSync(new URL("../migrations/" + n, import.meta.url), "utf8"));
  return d;
}

test("0.8 documents restore with pipeline defaults and keep their recipe identity", () => {
  const legacy = {
    source: ref,
    result: ref,
    appliedKey: "",
    edits: { nodes: { "1": { name: "Vessel" } }, materials: {}, rootExtras: null },
    notes: "checked",
    tab: "materials",
    selected: 0,
    view: "result",
    camera: [4, 3, 5],
    target: [0, 0.8, 0],
    clip: "",
    time: 0,
  };
  const oldKey = JSON.stringify([ref.id, legacy.edits]);
  legacy.appliedKey = oldKey;
  const d = validateAsset(legacy);
  assert.deepEqual(d.passes, []);
  assert.deepEqual(d.stages, []);
  assert.equal(d.stage, -1);
  assert.equal(d.compression, "none");
  assert.deepEqual(d.edits.textures, {});
  assert.equal(recipeKey(d), oldKey, "0.8 applied results stay current");
});

test("raw TRS, numeric, JSON and pass-parameter drafts restore while formal validation rejects them", () => {
  const d = {
    ...structuredClone(seed),
    source: ref,
    edits: {
      nodes: { "0": { name: "Draft", translation: ["1.", "-", "0"] } },
      materials: { "0": { roughness: "0.", extras: '{"review":' } },
      rootExtras: null,
      textures: {},
    },
    passDrafts: { simplify: { ratio: "0." } },
  };
  const restored = restoreAsset(d);
  assert.deepEqual(restored.edits.nodes["0"].translation, ["1.", "-", "0"]);
  assert.equal(restored.passDrafts.simplify?.ratio, "0.");
  assert.throws(() => validateAsset(d), /完整/);
  assert.equal(
    importAsset({ snapshot: { title: "Draft", data: d, extra: {} } }).data.edits.materials["0"].extras,
    '{"review":',
  );
  assert.throws(() => restoreAsset({ ...d, passDrafts: { explode: {} } }), /草稿/);
  assert.throws(
    () => validateAsset({ ...d, edits: { ...d.edits, nodes: { "0": { scale: ["0", "1", "1"] } }, materials: {} } }),
    /缩放/,
  );
});

test("stage identity follows source, edits and pass options; documentRefs lists every resource", () => {
  const p1 = passValue({ id: "a", kind: "weld", options: {} }),
    p2 = passValue({ id: "b", kind: "simplify", options: { ratio: 0.3 } }),
    d = { ...structuredClone(seed), source: ref, passes: [p1, p2] };
  const k = [0, 1, 2].map((i) => stageKey(d, i));
  assert.equal(new Set(k).size, 3);
  assert.match(k[0], /^[a-f0-9]{28}$/);
  assert.equal(stageKey({ ...d, passes: [{ ...p1, id: "zzz" }, p2] }, 2), k[2], "ids are not identity");
  const stage = (key: string, id: string) => ({
    key,
    ref: { id, name: "s.glb", bytes: 100 },
    report: { bytes: 100, nodes: 1, meshes: 1, primitives: 1, drawCalls: 1, vertices: 3, uploadVertices: 3, triangles: 1, materials: 1, textures: 0, textureBytes: 0, gpuBytes: 36, animations: 0, keyframes: 0, extensions: [] },
    ms: 3,
    note: "",
  });
  const full = { ...d, stages: [stage(k[0], ref.id), stage(k[1], "b".repeat(64)), stage(k[2], "c".repeat(64))] };
  assert.equal(validStages(full), 3);
  assert.equal(validStages({ ...full, edits: { ...full.edits, rootExtras: "{}" } }), 0);
  const image = { id: "d".repeat(64), name: "t.png", bytes: 20, mime: "image/png" as const, width: 2, height: 2 };
  const withImage = validateAsset({ ...full, edits: { ...full.edits, textures: { "0": image } } });
  assert.deepEqual(
    documentRefs(withImage).map((r) => r.kind + ":" + r.ref.id[0]),
    ["model:" + ref.id[0], "model:b", "model:c", "image:d"],
  );
  assert.notEqual(digest("a"), digest("b"));
});

test("Euler/quaternion conversion round-trips for TRS editing", () => {
  for (const e of [[0, 90, 0], [30, -45, 10], [-120, 15, 170]] as [number, number, number][]) {
    const back = quatToEuler(eulerToQuat(e));
    const q1 = eulerToQuat(e), q2 = eulerToQuat(back);
    const dot = Math.abs(q1.reduce((s, v, i) => s + v * q2[i], 0));
    assert.ok(dot > 0.99999, `${e} → ${back}`);
  }
});

test("resource store keeps models and images content-addressed and verifies documents", async () => {
  const dir = await mkdtemp(join(tmpdir(), "gltf-res-")),
    store = resourceStore({ resources: { path: async (_: string, child = "") => join(dir, child), configured: () => true } } as never);
  const model = await store.saveModel(source, "turbine.glb");
  assert.equal(model.id, ref.id);
  await assert.rejects(() => store.saveModel(new Uint8Array(64), "x.glb"), /无法解析/);
  const png = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
    "base64",
  );
  const image = await store.saveImage(new Uint8Array(png), "dot.png");
  assert.equal(image.mime, "image/png");
  assert.equal(image.width, 1);
  await assert.rejects(() => store.saveImage(new Uint8Array(30), "x.png"), /PNG、JPEG 或 WebP/);
  assert.deepEqual(await store.missing([model.id, "e".repeat(64)]), ["e".repeat(64)]);
  await store.verifyDocument({ ...seed, source: model, edits: { ...seed.edits, textures: { "0": image } } });
  await assert.rejects(
    () => store.verifyDocument({ ...seed, source: { ...model, id: "f".repeat(64) } }),
    /缺失/,
  );
});

test("SQLite confirms valid references, preserves invalid drafts, retries identical mutations and rejects stale writers", async () => {
  const database = db();
  try {
    const store = createAutosaveStore(database, validateAsset),
      id = randomUUID(),
      req = {
        documentId: id,
        mutationId: randomUUID(),
        draftRevision: 0,
        projectId: null,
        projectRevision: null,
        snapshot: {
          title: "Asset",
          data: { ...structuredClone(seed), source: ref },
          extra: {},
        },
      };
    const first = await store.commit(req);
    assert.equal(first.phase, "saved");
    assert.deepEqual(await store.commit(req), first);
    const draft = {
      ...req,
      mutationId: randomUUID(),
      draftRevision: 1,
      projectId: first.project!.id,
      projectRevision: first.project!.revision,
      snapshot: {
        ...req.snapshot,
        data: {
          ...req.snapshot.data,
          edits: {
            nodes: {},
            materials: { "0": { metallic: "-" } },
            rootExtras: null,
          },
        },
      },
    };
    assert.equal((await store.commit(draft)).phase, "draft");
    assert.equal(
      importAsset({ snapshot: store.get(id)!.snapshot }).data.edits.materials[
        "0"
      ].metallic,
      "-",
    );
    await assert.rejects(
      () => store.commit({ ...draft, mutationId: randomUUID() }),
      /另一窗口/,
    );
  } finally {
    database.close();
  }
});
test("missing model resources stay in working drafts without claiming a formal saved project", async () => {
  const database = db();
  try {
    const store = createAutosaveStore(database, validateAsset, undefined, {
        verify: async () => {
          throw Error("模型资源缺失");
        },
      }),
      id = randomUUID(),
      receipt = await store.commit({
        documentId: id,
        mutationId: randomUUID(),
        draftRevision: 0,
        projectId: null,
        projectRevision: null,
        snapshot: {
          title: "Missing",
          data: { ...seed, source: ref },
          extra: {},
        },
      });
    assert.equal(receipt.phase, "draft");
    assert.equal(receipt.project, null);
    assert.equal(
      importAsset({ snapshot: store.get(id)!.snapshot }).data.source!.id,
      ref.id,
    );
  } finally {
    database.close();
  }
});
test("confirmed 1.2MB UTF8 snapshot restores inside multi-copy recovery envelope", async () => {
  const database = db();
  try {
    const store = createAutosaveStore(database, validateAsset),
      snapshot = {
        title: "Large working copy",
        data: seed,
        extra: { review: "图".repeat(400000) },
      },
      id = randomUUID();
    assert.equal(
      (
        await store.commit({
          documentId: id,
          mutationId: randomUUID(),
          draftRevision: 0,
          projectId: null,
          projectRevision: null,
          snapshot,
        })
      ).phase,
      "saved",
    );
    const exported = {
      snapshot: store.get(id)!.snapshot,
      current: { data: seed },
      pending: { snapshot },
    };
    assert.ok(Buffer.byteLength(JSON.stringify(exported)) > 2_000_000);
    assert.equal(importAsset(exported).extra.review, snapshot.extra.review);
    assert.throws(
      () =>
        importAsset({
          snapshot: { ...snapshot, extra: { review: "图".repeat(650000) } },
        }),
      /1.95MB/,
    );
  } finally {
    database.close();
  }
});
test("wrong source IDs and edit indices cannot escape resource scope", async () => {
  assert.throws(
    () => restoreAsset({ ...seed, source: { ...ref, id: "../secret" } }),
    /引用/,
  );
  assert.throws(
    () => importAsset({ title: "x".repeat(121), data: seed, extra: {} }),
    /120/,
  );
});

test("recipe identity is stable after autosave schema canonicalizes field order", () => {
  const a = {
    ...seed,
    source: ref,
    edits: {
      nodes: {},
      materials: { "0": { roughness: "0.42", name: "Satin" } },
      rootExtras: null,
    },
  };
  assert.equal(recipeKey(a), recipeKey(validateAsset(a)));
});

