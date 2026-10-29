import { test } from "node:test";
import assert from "node:assert/strict";
import { Document, NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import { sampleAsset } from "../src/server/sample.ts";
import { hash, inspectBytes, readDocument } from "../src/server/model.ts";
import { compressModel, runPipeline } from "../src/server/pipeline.ts";
import { seed, stageKey, validStages, type Edits, type FileRef } from "../src/contracts/asset.ts";
import { passValue, passesValue, type PassKind } from "../src/contracts/pipeline.ts";
import { PNG } from "pngjs";

function memoryStore() {
  const files = new Map<string, Uint8Array>();
  let saves = 0;
  return {
    files,
    get saves() {
      return saves;
    },
    read: async (id: string) => {
      const b = files.get(id);
      if (!b) throw Error("missing");
      return b;
    },
    exists: async (r: FileRef) => files.has(r.id),
    save: async (bytes: Uint8Array, name: string) => {
      saves++;
      const id = hash(bytes);
      files.set(id, bytes);
      return { id, name, bytes: bytes.length };
    },
  };
}
const sample = await sampleAsset();
const source: FileRef = { id: hash(sample), name: "turbine.glb", bytes: sample.length };
const step = (kind: PassKind, options = {}, id = kind) => passValue({ id, kind, options });
async function run(passes: ReturnType<typeof step>[], edits: Edits = seed.edits, cached = [] as Awaited<ReturnType<typeof runPipeline>>["stages"], store = memoryStore()) {
  store.files.set(source.id, sample);
  return { ...(await runPipeline({ source, edits, passes, cached, images: new Map() }, store)), store };
}

test("demo asset is a realistic multi-material, textured, animated model with redundancy", async () => {
  const i = await inspectBytes(sample);
  assert.ok(i.materials.length >= 7);
  assert.equal(i.textures.length, 2);
  assert.deepEqual(i.textures.map((t) => t.mime).sort(), ["image/jpeg", "image/png"]);
  assert.equal(i.textures.find((t) => t.mime === "image/jpeg")!.width, 1024);
  assert.deepEqual(i.animations.map((a) => a.name), ["Rotor spin", "Yaw sweep"]);
  assert.equal(i.animations[0].keyframes, 121);
  assert.ok(i.report.drawCalls > 20);
  assert.ok(i.report.triangles > 20000);
  assert.ok(i.nodes.some((n) => n.animated));
  assert.deepEqual(await sampleAsset(), sample, "generation is deterministic");
});

test("each optimisation pass changes the expected metric", async () => {
  const report = async (passes: ReturnType<typeof step>[]) => {
    const out = await run(passes);
    return out.stages[out.stages.length - 1].report;
  };
  const base = (await inspectBytes(sample)).report;
  const pruned = await report([step("prune")]);
  assert.equal(pruned.materials, base.materials - 1, "unused material removed");
  assert.equal(pruned.meshes, base.meshes - 1, "unused spare mesh removed");
  const deduped = await report([step("prune"), step("dedup")]);
  assert.ok(deduped.materials < pruned.materials && deduped.meshes < pruned.meshes);
  const welded = await report([step("weld")]);
  assert.ok(welded.uploadVertices < base.uploadVertices);
  const simplified = await report([step("simplify", { ratio: 0.25, error: 0.01 })]);
  assert.ok(simplified.triangles < base.triangles * 0.8, `${simplified.triangles} < ${base.triangles}`);
  const resampled = await report([step("resample")]);
  assert.ok(resampled.keyframes < base.keyframes / 4, `${resampled.keyframes}`);
  const quantized = await report([step("quantize")]);
  assert.ok(quantized.extensions.includes("KHR_mesh_quantization"));
  assert.ok(quantized.bytes < base.bytes);
  const joined = await report([step("prune"), step("dedup"), step("join")]);
  assert.ok(joined.drawCalls < base.drawCalls / 2, `${joined.drawCalls}`);
  const flattened = await report([step("flatten")]);
  assert.ok(flattened.nodes <= base.nodes);
  const resizedRun = await run([step("textureResize", { maxSize: "256" })]),
    resized = resizedRun.stages[1].report;
  assert.ok(resized.textureBytes < base.textureBytes / 3);
  const tex = (await inspectBytes(resizedRun.store.files.get(resizedRun.stages[1].ref.id)!)).textures;
  assert.ok(tex.every((t) => Math.max(t.width, t.height) <= 256));
  const centered = await run([step("center", { pivot: "center" })]);
  const doc = await readDocument(centered.store.files.get(centered.stages[1].ref.id)!);
  assert.ok(doc.getRoot().listScenes().length === 1);
});

test("instancing reports the glTF Transform animation limit and works on static scenes", async () => {
  const animated = await run([step("dedup"), step("instance", { min: 2 })]);
  assert.match(animated.stages[2].note, /动画/);
  // Static scene: 6 identical cubes become one EXT_mesh_gpu_instancing node.
  const d = new Document(),
    b = d.createBuffer(),
    mesh = d.createMesh("Cube").addPrimitive(
      d.createPrimitive().setAttribute(
        "POSITION",
        d.createAccessor().setType("VEC3").setBuffer(b).setArray(new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0])),
      ),
    ),
    scene = d.createScene();
  for (let i = 0; i < 6; i++) scene.addChild(d.createNode("c" + i).setMesh(mesh).setTranslation([i, 0, 0]));
  d.getRoot().setDefaultScene(scene);
  const bytes = await new NodeIO().writeBinary(d),
    store = memoryStore(),
    ref = await store.save(bytes, "cubes.glb");
  const out = await runPipeline(
    { source: ref, edits: seed.edits, passes: [step("instance", { min: 2 })], cached: [], images: new Map() },
    store,
  );
  assert.equal(out.stages[1].report.drawCalls, 1);
  assert.ok(out.stages[1].report.extensions.includes("EXT_mesh_gpu_instancing"));
  assert.match(out.stages[1].note, /GPU 实例/);
});

test("pipeline reuses the valid prefix; undo and removal only recompute what changed", async () => {
  const store = memoryStore();
  const passes = [step("prune", {}, "a"), step("dedup", {}, "b"), step("weld", {}, "c")];
  const first = await run(passes, seed.edits, [], store);
  assert.equal(first.stages.length, 4);
  assert.equal(first.computed, 4);
  assert.equal(first.stages[0].ref.id, source.id, "no edits: stage 0 is the original");
  // Appending one pass computes only that pass.
  const more = await run([...passes, step("quantize", {}, "d")], seed.edits, first.stages, store);
  assert.equal(more.computed, 1);
  // Undo is a prefix: every stage is still valid without the server.
  const doc = { source, edits: seed.edits, passes, stages: more.stages };
  assert.equal(validStages(doc), 4);
  // Removing the middle pass invalidates from that point only.
  const removed = [passes[0], passes[2]];
  assert.equal(validStages({ ...doc, passes: removed }), 2);
  const again = await run(removed, seed.edits, more.stages.slice(0, 2), store);
  assert.equal(again.computed, 1);
  assert.equal(again.stages[2].key, stageKey({ source, edits: seed.edits, passes: removed }, 2));
  // Changed options produce a different identity.
  assert.notEqual(
    stageKey({ source, edits: seed.edits, passes: [step("simplify", { ratio: 0.5 })] }, 1),
    stageKey({ source, edits: seed.edits, passes: [step("simplify", { ratio: 0.4 })] }, 1),
  );
});

test("edits (names, PBR, TRS, texture replacement) apply before passes and survive round trips", async () => {
  const png = new PNG({ width: 64, height: 32 });
  png.data.fill(200);
  const image = new Uint8Array(PNG.sync.write(png)),
    imageRef = { id: hash(image), name: "decal.png", bytes: image.length, mime: "image/png" as const, width: 64, height: 32 };
  const before = await inspectBytes(sample),
    tower = before.nodes.findIndex((n) => n.name === "Tower"),
    jpeg = before.textures.findIndex((t) => t.mime === "image/jpeg");
  const edits: Edits = {
    nodes: { [tower]: { name: "Tower (reviewed)", translation: ["0", "5.5", "0"], rotation: ["0", "90", "0"], scale: ["1", "1.1", "1"] } },
    materials: { "0": { roughness: "0.25", color: "#336699" } },
    rootExtras: '{"reviewer":"Studio"}',
    textures: { [jpeg]: imageRef },
  };
  const store = memoryStore();
  store.files.set(source.id, sample);
  const out = await runPipeline(
    { source, edits, passes: [step("prune")], cached: [], images: new Map([[imageRef.id, image]]) },
    store,
  );
  assert.notEqual(out.stages[0].ref.id, source.id);
  const edited = await inspectBytes(store.files.get(out.stages[0].ref.id)!);
  const node = edited.nodes[tower];
  assert.equal(node.name, "Tower (reviewed)");
  assert.deepEqual(node.translation.map((v) => +v.toFixed(4)), [0, 5.5, 0]);
  assert.deepEqual(node.rotation.map((v) => Math.round(v)), [0, 90, 0]);
  assert.ok(Math.abs(node.scale[1] - 1.1) < 1e-6);
  assert.equal(edited.materials[0].roughness, "0.25");
  assert.equal(edited.materials[0].color, "#336699");
  assert.equal(edited.textures[jpeg].mime, "image/png");
  assert.equal(edited.textures[jpeg].width, 64);
  assert.match(edited.rootExtras, /Studio/);
  assert.equal(edited.animations.length, 2, "animations preserved");
  // Pass output keeps the edit.
  const final = await inspectBytes(store.files.get(out.stages[1].ref.id)!);
  assert.ok(final.nodes.some((n) => n.name === "Tower (reviewed)"));
  await assert.rejects(
    () => runPipeline({ source, edits: { ...seed.edits, nodes: { "9999": { name: "x" } } }, passes: [], cached: [], images: new Map() }, store),
    /不存在/,
  );
  await assert.rejects(
    () => runPipeline({ source, edits, passes: [], cached: [], images: new Map() }, store),
    /缺失/,
  );
});

test("Khronos material extensions and texture transforms survive edits, passes and export", async () => {
  const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
  const doc = await io.readBinary(sample);
  const { KHRMaterialsClearcoat, KHRTextureTransform } = await import("@gltf-transform/extensions");
  const clearcoat = doc.createExtension(KHRMaterialsClearcoat);
  const transform = doc.createExtension(KHRTextureTransform);
  const m = doc.getRoot().listMaterials().find((x) => x.getBaseColorTexture())!;
  m.setExtension("KHR_materials_clearcoat", clearcoat.createClearcoat().setClearcoatFactor(0.7));
  m.getBaseColorTextureInfo()!.setExtension("KHR_texture_transform", transform.createTransform().setScale([4, 4]));
  const bytes = await io.writeBinary(doc),
    store = memoryStore(),
    ref = await store.save(bytes, "ext.glb");
  const out = await runPipeline(
    { source: ref, edits: { ...seed.edits, materials: { "0": { name: "Renamed" } } }, passes: [step("prune"), step("weld"), step("quantize")], cached: [], images: new Map() },
    store,
  );
  for (const s of out.stages) {
    assert.ok(s.report.extensions.includes("KHR_materials_clearcoat"));
    assert.ok(s.report.extensions.includes("KHR_texture_transform"));
  }
  const last = store.files.get(out.stages.at(-1)!.ref.id)!;
  for (const mode of ["meshopt", "draco"] as const) {
    const packed = await compressModel(last, mode),
      again = await readDocument(packed),
      names = again.getRoot().listExtensionsUsed().map((e) => e.extensionName);
    assert.ok(names.includes(mode === "meshopt" ? "EXT_meshopt_compression" : "KHR_draco_mesh_compression"));
    assert.ok(names.includes("KHR_materials_clearcoat"));
    assert.equal(again.getRoot().listAnimations().length, 2);
  }
});

test("pass validation rejects unknown kinds, options and out-of-range values", () => {
  assert.throws(() => passValue({ id: "x", kind: "explode", options: {} }), /无效/);
  assert.throws(() => passValue({ id: "x", kind: "simplify", options: { ratio: 2 } }), /0–1/);
  assert.throws(() => passValue({ id: "x", kind: "weld", options: { tolerance: 1 } }), /未知/);
  assert.throws(() => passValue({ id: "../x", kind: "weld", options: {} }), /无效/);
  assert.throws(() => passValue({ id: "x", kind: "textureResize", options: { maxSize: "333" } }), /无效/);
  assert.deepEqual(passValue({ id: "x", kind: "simplify", options: {} }).options, { ratio: 0.5, error: 0.001, lockBorder: false });
  assert.throws(() => passesValue([step("weld"), step("weld")]), /重复/);
  assert.throws(() => passesValue(Array.from({ length: 33 }, (_, i) => step("weld", {}, "w" + i))), /32/);
});
