import { test } from "node:test";
import assert from "node:assert/strict";
import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS, KHRMaterialsSheen } from "@gltf-transform/extensions";
import { draco, meshopt } from "@gltf-transform/functions";
import { MeshoptEncoder } from "meshoptimizer";
import draco3d from "draco3dgltf";
import { zipSync, strToU8 } from "fflate";
import { sampleAsset } from "../src/server/sample.ts";
import { importModel, type UploadedFile } from "../src/server/importer.ts";
import { inspectBytes, readDocument } from "../src/server/model.ts";
import { uploadSessions } from "../src/server/uploads.ts";
import { CHUNK_BYTES, MAX_IMPORT } from "../src/contracts/asset.ts";

const sample = await sampleAsset();
const io = async () =>
  new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({
    "draco3d.encoder": await draco3d.createEncoderModule(),
    "draco3d.decoder": await draco3d.createDecoderModule(),
    "meshopt.encoder": MeshoptEncoder,
  });
/** Writes the demo as .gltf + .bin + external images, the way Blender's "glTF Separate" does. */
async function separate() {
  const w = await io(),
    doc = await w.readBinary(sample);
  doc.getRoot().listBuffers()[0].setURI("scene.bin");
  const { json, resources } = await w.writeJSON(doc, { format: "glTF" as never, basename: "scene" });
  const files: UploadedFile[] = [
    { name: "scene.gltf", bytes: strToU8(JSON.stringify(json)) },
    ...Object.entries(resources).map(([name, bytes]) => ({ name, bytes })),
  ];
  return { json, files };
}

test("plain GLB with Khronos material extensions imports and keeps them", async () => {
  const w = await io(),
    doc = await w.readBinary(sample),
    sheen = doc.createExtension(KHRMaterialsSheen);
  doc.getRoot().listMaterials()[0].setExtension("KHR_materials_sheen", sheen.createSheen().setSheenRoughnessFactor(0.4));
  const bytes = await w.writeBinary(doc),
    out = await importModel([{ name: "Lamp.glb", bytes }]);
  assert.equal(out.name, "Lamp.glb");
  const i = await inspectBytes(out.bytes);
  assert.ok(i.extensions.some((e) => e.name === "KHR_materials_sheen"));
  assert.ok(i.materials[0].extensions.includes("KHR_materials_sheen"));
});

test("glTF + .bin + textures import from a multi-file pick and from a ZIP", async () => {
  const { json, files } = await separate();
  assert.ok((json.images ?? []).every((img) => typeof img.uri === "string"));
  assert.ok(files.length >= 4, "gltf, bin and two images");
  const picked = await importModel(files);
  const a = await inspectBytes(picked.bytes);
  assert.equal(a.textures.length, 2);
  assert.equal(a.animations.length, 2);
  assert.equal(picked.name, "scene.glb");
  // ZIP with a folder prefix, as exported by Sketchfab ("source/…", "textures/…").
  const zip = zipSync(Object.fromEntries(files.map((f) => ["turbine/" + f.name, f.bytes])));
  const zipped = await importModel([{ name: "turbine.zip", bytes: zip }]);
  assert.equal((await inspectBytes(zipped.bytes)).textures.length, 2);
  // A missing texture names the missing file instead of failing generically.
  const withoutImage = files.filter((f) => !/\.png$/.test(f.name));
  await assert.rejects(() => importModel(withoutImage), /缺少资源文件：.*\.png/);
});

test("Draco and Meshopt compressed GLBs are decoded on import", async () => {
  const w = await io();
  for (const [label, transform, ext] of [
    ["draco", draco(), "KHR_draco_mesh_compression"],
    ["meshopt", meshopt({ encoder: MeshoptEncoder }), "EXT_meshopt_compression"],
  ] as const) {
    await MeshoptEncoder.ready;
    const doc = await w.readBinary(sample);
    await doc.transform(transform);
    const packed = await w.writeBinary(doc);
    const packedJson = JSON.parse(new TextDecoder().decode(packed.subarray(20, 20 + new DataView(packed.buffer, packed.byteOffset).getUint32(12, true))));
    assert.ok(packedJson.extensionsUsed.includes(ext), label);
    const out = await importModel([{ name: label + ".glb", bytes: packed }]);
    const i = await inspectBytes(out.bytes);
    assert.ok(!i.extensions.some((e) => e.name === ext), label + " decoded");
    assert.ok(i.report.triangles > 10000, label);
    assert.match(out.notes.join(" "), label === "draco" ? /Draco/ : /Meshopt/);
  }
});

test("clear rejections: unsupported required extension, several models, oversize, not a model", async () => {
  const w = await io(),
    doc = await w.readBinary(sample),
    { json, resources } = await w.writeJSON(doc, { format: "glTF" as never, basename: "x" });
  json.extensionsUsed = [...(json.extensionsUsed ?? []), "VENDOR_magic"];
  json.extensionsRequired = ["VENDOR_magic"];
  const files = [
    { name: "x.gltf", bytes: strToU8(JSON.stringify(json)) },
    ...Object.entries(resources).map(([name, bytes]) => ({ name, bytes })),
  ];
  await assert.rejects(() => importModel(files), /不支持的扩展：VENDOR_magic/);
  json.extensionsRequired = [];
  const optional = await importModel([{ name: "x.gltf", bytes: strToU8(JSON.stringify(json)) }, ...files.slice(1)]);
  assert.match(optional.notes.join(" "), /VENDOR_magic/);
  await assert.rejects(
    () => importModel([{ name: "a.glb", bytes: sample }, { name: "b.glb", bytes: sample }]),
    /一次只能导入一个模型/,
  );
  await assert.rejects(() => importModel([{ name: "notes.txt", bytes: strToU8("hello") }]), /没有找到/);
  await assert.rejects(
    () => importModel([{ name: "big.glb", bytes: new Uint8Array(MAX_IMPORT + 1) }]),
    /64 MB/,
  );
  await assert.rejects(() => importModel([{ name: "broken.zip", bytes: new Uint8Array([0x50, 0x4b, 3, 4, 9, 9]) }]), /ZIP/);
  // A sheared matrix cannot become TRS without loss.
  const sheared = structuredClone(json);
  sheared.nodes![0] = { ...sheared.nodes![0], matrix: [1, 0.5, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1] };
  delete sheared.nodes![0].translation;
  delete sheared.nodes![0].rotation;
  delete sheared.nodes![0].scale;
  await assert.rejects(
    () => importModel([{ name: "s.gltf", bytes: strToU8(JSON.stringify(sheared)) }, ...files.slice(1)]),
    /剪切/,
  );
  await assert.rejects(() => readDocument(new Uint8Array(40)), /无法解析/);
});

test("chunked upload sessions enforce order, size, purpose and expiry", () => {
  let now = 0;
  const s = uploadSessions(() => now);
  assert.throws(() => s.create({ purpose: "import", files: [{ name: "a.glb", bytes: MAX_IMPORT + 1 }] }), /64 MB/);
  const { id, chunk } = s.create({ purpose: "import", files: [{ name: "a.glb", bytes: CHUNK_BYTES + 10 }] });
  assert.equal(chunk, CHUNK_BYTES);
  const first = Buffer.alloc(CHUNK_BYTES, 1).toString("base64");
  assert.ok(first.length + 60 < 2_000_000, "chunk JSON stays under the SDK body cap");
  assert.throws(() => s.chunk(id, { index: 0, offset: 5, base64: first }), /顺序/);
  assert.deepEqual(s.chunk(id, { index: 0, offset: 0, base64: first }), { received: CHUNK_BYTES, complete: false });
  assert.throws(() => s.take(id, "import"), /完整/);
  assert.throws(() => s.chunk(id, { index: 0, offset: CHUNK_BYTES, base64: Buffer.alloc(11).toString("base64") }), /超出/);
  assert.equal(s.chunk(id, { index: 0, offset: CHUNK_BYTES, base64: Buffer.alloc(10, 2).toString("base64") }).complete, true);
  assert.throws(() => s.take(id, "resource"), /用途/);
  const [file] = s.take(id, "import");
  assert.equal(file.bytes.length, CHUNK_BYTES + 10);
  assert.equal(file.bytes[CHUNK_BYTES + 3], 2);
  assert.throws(() => s.chunk(id, { index: 0, offset: 0, base64: "" }), /过期/);
  const stale = s.create({ purpose: "resource", files: [{ name: "t.png", bytes: 10 }] }).id;
  now += 16 * 60 * 1000;
  s.create({ purpose: "resource", files: [{ name: "u.png", bytes: 10 }] });
  assert.throws(() => s.take(stale, "resource"), /过期/);
});
