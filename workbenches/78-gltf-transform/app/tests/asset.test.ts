import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import { NodeIO, Document } from "@gltf-transform/core";
import {
  sampleAsset,
  processAsset,
  readDocument,
  invariant,
  preserved,
  hash,
} from "../src/server/native.ts";
import { inspectGlb } from "../src/contracts/glb.ts";
import {
  seed,
  validateAsset,
  restoreAsset,
  importAsset,
  recipeKey,
} from "../src/contracts/asset.ts";
import { createAutosaveStore } from "../src/server/autosave.ts";
const source = await sampleAsset(),
  ref = { id: hash(source), name: "sample.glb", bytes: source.length };
function pack(j: Record<string, unknown>, binary: Uint8Array) {
  const raw = Buffer.from(JSON.stringify(j)),
    len = Math.ceil(raw.length / 4) * 4,
    blen = Math.ceil(binary.length / 4) * 4,
    b = Buffer.alloc(28 + len + blen);
  b.writeUInt32LE(0x46546c67, 0);
  b.writeUInt32LE(2, 4);
  b.writeUInt32LE(b.length, 8);
  b.writeUInt32LE(len, 12);
  b.writeUInt32LE(0x4e4f534a, 16);
  b.fill(32, 20, 20 + len);
  raw.copy(b, 20);
  b.writeUInt32LE(blen, 20 + len);
  b.writeUInt32LE(0x004e4942, 24 + len);
  b.set(binary, 28 + len);
  return b;
}
function db() {
  const d = new DatabaseSync(":memory:");
  for (const n of ["0002_projects.sql", "0003_autosave.sql"])
    d.exec(
      readFileSync(new URL("../migrations/" + n, import.meta.url), "utf8"),
    );
  return d;
}
test("native NodeIO edits a textured four-mesh model and reparses independent result", async () => {
  const original = hash(source),
    before = await readDocument(source),
    out = await processAsset(source, {
      nodes: {
        "1": { name: "Delivered vessel", extras: '{"inspection":"approved"}' },
      },
      materials: { "0": { name: "Glaze B", roughness: "0.42" } },
      rootExtras: '{"reviewer":"Studio"}',
    }),
    again = await readDocument(out.bytes);
  assert.equal(hash(source), original);
  assert.notEqual(hash(out.bytes), original);
  assert.equal(out.inspection.meshes, 4);
  assert.equal(out.inspection.images.length, 1);
  assert.equal(out.inspection.nodes[1].name, "Delivered vessel");
  assert.equal(out.inspection.materials[0].roughness, "0.42");
  assert.deepEqual(
    before.getRoot().listMaterials()[0].getBaseColorFactor(),
    again.getRoot().listMaterials()[0].getBaseColorFactor(),
  );
  assert.equal(
    preserved(JSON.parse(invariant(before)), JSON.parse(invariant(again))),
    true,
  );
  assert.deepEqual(again.getRoot().listNodes()[1].getExtras(), {
    inspection: "approved",
  });
  assert.deepEqual(again.getRoot().getExtras(), { reviewer: "Studio" });
});
test("nonempty skin/animation joint references and arrays survive native material editing", async () => {
  const d = new Document(),
    b = d.createBuffer(),
    a = (
      type: "SCALAR" | "VEC3" | "VEC4" | "MAT4",
      data: Float32Array | Uint16Array,
    ) => d.createAccessor().setType(type).setArray(data).setBuffer(b),
    mat = d.createMaterial("Skin material"),
    mesh = d.createMesh("Triangle").addPrimitive(
      d
        .createPrimitive()
        .setAttribute(
          "POSITION",
          a("VEC3", new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0])),
        )
        .setAttribute("JOINTS_0", a("VEC4", new Uint16Array(12)))
        .setAttribute(
          "WEIGHTS_0",
          a("VEC4", new Float32Array([1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0])),
        )
        .setMaterial(mat),
    ),
    joint = d.createNode("Joint"),
    skin = d
      .createSkin("Skin")
      .addJoint(joint)
      .setSkeleton(joint)
      .setInverseBindMatrices(
        a(
          "MAT4",
          new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]),
        ),
      ),
    node = d.createNode("Skinned mesh").setMesh(mesh).setSkin(skin),
    scene = d.createScene("Scene").addChild(joint).addChild(node);
  d.getRoot().setDefaultScene(scene);
  const sampler = d
    .createAnimationSampler()
    .setInput(a("SCALAR", new Float32Array([0, 1])))
    .setOutput(a("VEC3", new Float32Array([0, 0, 0, 0, 0.5, 0])));
  d.createAnimation("Lift")
    .addSampler(sampler)
    .addChannel(
      d
        .createAnimationChannel()
        .setSampler(sampler)
        .setTargetNode(joint)
        .setTargetPath("translation"),
    );
  const io = new NodeIO(),
    input = await io.writeBinary(d),
    out = await processAsset(input, {
      nodes: { "0": { name: "Reviewed joint" } },
      materials: { "0": { metallic: "0.2" } },
      rootExtras: null,
    });
  assert.equal(out.inspection.skins, 1);
  assert.equal(out.inspection.animations[0].name, "Lift");
  const r = await readDocument(out.bytes);
  assert.equal(
    r.getRoot().listSkins()[0].listJoints()[0].getName(),
    "Reviewed joint",
  );
  assert.deepEqual(
    Array.from(
      r
        .getRoot()
        .listAnimations()[0]
        .listSamplers()[0]
        .getOutput()!
        .getArray()!,
    ),
    [0, 0, 0, 0, 0.5, 0],
  );
});
test("unsupported extensions, external resources, oversized instances and nonfinite geometry reject before parsing", () => {
  const i = inspectGlb(source);
  assert.throws(
    () =>
      inspectGlb(
        pack(
          { ...i.json, extensionsUsed: ["KHR_draco_mesh_compression"] },
          i.binary,
        ),
      ),
    /压缩/,
  );
  assert.throws(
    () =>
      inspectGlb(
        pack(
          { ...i.json, images: [{ uri: "https://example.com/x.png" }] },
          i.binary,
        ),
      ),
    /未支持|内嵌/,
  );
  assert.throws(
    () =>
      inspectGlb(
        pack({ ...i.json, nodes: [{ mesh: 0, children: [0] }] }, i.binary),
      ),
    /循环/,
  );
  const j = structuredClone(i.json) as {
    nodes: Record<string, unknown>[];
    scenes: { nodes: number[] }[];
    meshes: { primitives: { attributes: { POSITION: number } }[] }[];
    accessors: { bufferView: number; byteOffset?: number }[];
    bufferViews: { byteOffset?: number }[];
  };
  j.nodes = Array.from({ length: 200 }, () => ({ mesh: 2 }));
  j.scenes[0].nodes = j.nodes.map((_, n) => n);
  assert.throws(() => inspectGlb(pack(j, i.binary)), /顶点/);
  const a = j.accessors[j.meshes[0].primitives[0].attributes.POSITION],
    binary = i.binary.slice();
  new DataView(binary.buffer).setFloat32(
    (a.byteOffset ?? 0) + (j.bufferViews[a.bufferView].byteOffset ?? 0),
    NaN,
    true,
  );
  assert.throws(() => inspectGlb(pack(i.json, binary)), /非有限/);
  assert.throws(
    () =>
      inspectGlb(
        pack(
          {
            ...i.json,
            materials: [{ pbrMetallicRoughness: { roughnessFactor: -1 } }],
          },
          i.binary,
        ),
      ),
    /材质|PBR/,
  );
});
test("recipe raw numeric/JSON drafts restore while formal validation rejects them", () => {
  const d = {
    ...structuredClone(seed),
    source: ref,
    edits: {
      nodes: { "0": { name: "Draft" } },
      materials: { "0": { roughness: "0.", extras: '{"review":' } },
      rootExtras: null,
    },
  };
  assert.equal(restoreAsset(d).edits.materials["0"].roughness, "0.");
  assert.throws(() => validateAsset(d), /完整/);
  assert.equal(
    importAsset({
      snapshot: { title: "Draft", data: d, extra: {} },
      current: { data: d },
    }).data.edits.materials["0"].extras,
    '{"review":',
  );
  assert.notEqual(recipeKey(d), recipeKey({ ...d, edits: seed.edits }));
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
  await assert.rejects(
    () =>
      processAsset(source, {
        nodes: { "800": { name: "No node" } },
        materials: {},
        rootExtras: null,
      }),
    /不存在/,
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

test("collinear geometry and repeated high-resolution texture references are bounded", async () => {
  const d = new Document(),
    b = d.createBuffer(),
    p = d.createPrimitive().setAttribute(
      "POSITION",
      d
        .createAccessor()
        .setBuffer(b)
        .setType("VEC3")
        .setArray(new Float32Array([0, 0, 0, 1, 0, 0, 2, 0, 0])),
    ),
    scene = d
      .createScene()
      .addChild(d.createNode().setMesh(d.createMesh().addPrimitive(p)));
  d.getRoot().setDefaultScene(scene);
  const bytes = await new NodeIO().writeBinary(d);
  assert.throws(() => inspectGlb(bytes), /退化/);
  const i = inspectGlb(source),
    json = structuredClone(i.json) as {
      images: { bufferView: number }[];
      bufferViews: { byteOffset?: number }[];
      textures: Record<string, unknown>[];
    };
  const binary = i.binary.slice(),
    offset = json.bufferViews[json.images[0].bufferView].byteOffset ?? 0;
  new DataView(binary.buffer).setUint32(offset + 16, 2048);
  new DataView(binary.buffer).setUint32(offset + 20, 2048);
  json.textures = [{ source: 0 }, { source: 0 }, { source: 0 }];
  assert.throws(() => inspectGlb(pack(json, binary)), /重复贴图/);
});

test("malformed source names reject before React receives an object as a label",()=>{const i=inspectGlb(source),j=structuredClone(i.json) as {nodes:Record<string,unknown>[]};j.nodes[0].name={invalid:"label"};assert.throws(()=>inspectGlb(pack(j,i.binary)),/名称/);});
