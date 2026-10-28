import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash, randomUUID } from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import * as T from "three";
import {
  GLTFLoader,
  type GLTF,
} from "three/examples/jsm/loaders/GLTFLoader.js";
import { inspectGlb } from "../src/contracts/glb.ts";
import {
  seed,
  validateModel,
  restoreModel,
  bindingKey,
  importModel,
} from "../src/contracts/model.ts";
import { createAutosaveStore } from "../src/server/autosave.ts";
import {
  bindModel,
  rigFor,
  clipsFor,
  normalizedModel,
  dispose,
} from "../src/ui/native.ts";
const manifest = JSON.parse(
  readFileSync(new URL("../manifest.json", import.meta.url), "utf8"),
);
const asset = (name: string) => {
  const path = manifest.resources.find(
    (r: { id: string }) => r.id === "engine-assets",
  ).path;
  return new Uint8Array(
    readFileSync(new URL("../" + path + "/" + name, import.meta.url)),
  );
};
const source = asset("mannequin.glb"),
  ref = {
    id: createHash("sha256").update(source).digest("hex"),
    name: "mannequin.glb",
    bytes: source.length,
    kind: "source" as const,
  };
function repack(json: Record<string, unknown>, binary: Uint8Array) {
  const raw = Buffer.from(JSON.stringify(json)),
    len = Math.ceil(raw.length / 4) * 4,
    binlen = Math.ceil(binary.length / 4) * 4,
    b = Buffer.alloc(28 + len + binlen);
  b.writeUInt32LE(0x46546c67, 0);
  b.writeUInt32LE(2, 4);
  b.writeUInt32LE(b.length, 8);
  b.writeUInt32LE(len, 12);
  b.writeUInt32LE(0x4e4f534a, 16);
  b.fill(32, 20, 20 + len);
  raw.copy(b, 20);
  b.writeUInt32LE(binlen, 20 + len);
  b.writeUInt32LE(0x004e4942, 24 + len);
  b.set(binary, 28 + len);
  return b;
}
async function load(bytes: Uint8Array) {
  const l = new GLTFLoader();
  l.register(() => ({
    name: "test-texture",
    loadTexture: async () => new T.Texture(),
  }));
  return l.parseAsync(bytes.slice().buffer, "");
}
function database() {
  const db = new DatabaseSync(":memory:");
  for (const name of ["0002_projects.sql", "0003_autosave.sql"])
    db.exec(
      readFileSync(new URL("../migrations/" + name, import.meta.url), "utf8"),
    );
  return db;
}
test("official static textured GLB satisfies the resource budget", () => {
  const info = inspectGlb(source);
  assert.equal(info.vertices, 7399);
  assert.equal(info.images, 1);
  assert.equal(info.skins, 0);
  assert.equal(info.animations, 0);
  assert.throws(() => inspectGlb(source, "bound"), /骨架/);
});
test("unsupported codecs, external URIs, cyclic nodes and amplified mesh instances are rejected", () => {
  const info = inspectGlb(source);
  assert.throws(
    () =>
      inspectGlb(
        repack(
          { ...info.json, extensionsUsed: ["KHR_draco_mesh_compression"] },
          info.binary,
        ),
      ),
    /压缩/,
  );
  assert.throws(
    () =>
      inspectGlb(
        repack(
          { ...info.json, images: [{ uri: "https://example.com/image.png" }] },
          info.binary,
        ),
      ),
    /嵌入/,
  );
  assert.throws(
    () =>
      inspectGlb(
        repack(
          { ...info.json, nodes: [{ children: [0], mesh: 0 }] },
          info.binary,
        ),
      ),
    /循环/,
  );
  assert.throws(
    () =>
      inspectGlb(
        repack(
          { ...info.json, nodes: [{ mesh: 0 }, { mesh: 0 }, { mesh: 0 }] },
          info.binary,
        ),
      ),
    /顶点/,
  );
});
test("NaN vertex data and invalid transforms fail before native geometry", () => {
  const info = inspectGlb(source);
  const json = info.json as {
    meshes: { primitives: { attributes: { POSITION: number } }[] }[];
    accessors: { bufferView: number; byteOffset?: number }[];
    bufferViews: { byteOffset?: number }[];
  };
  const a = json.accessors[json.meshes[0].primitives[0].attributes.POSITION],
    offset =
      (a.byteOffset ?? 0) + (json.bufferViews[a.bufferView].byteOffset ?? 0),
    bin = info.binary.slice();
  new DataView(bin.buffer).setFloat32(offset, NaN, true);
  assert.throws(() => inspectGlb(repack(info.json, bin)), /非有限/);
  assert.throws(
    () =>
      inspectGlb(
        repack(
          { ...info.json, nodes: [{ mesh: 0, translation: ["bad", 0, 0] }] },
          info.binary,
        ),
      ),
    /变换/,
  );
});
test("degenerate height fails explicitly without changing source geometry", () => {
  const scene = new T.Group(),
    geometry = new T.BufferGeometry();
  geometry.setAttribute(
    "position",
    new T.Float32BufferAttribute([0, 0, 0, 1, 0, 0, 0, 0, 1], 3),
  );
  scene.add(new T.Mesh(geometry, new T.MeshBasicMaterial()));
  assert.throws(() => normalizedModel({ scene } as unknown as GLTF), /高度/);
  assert.equal(geometry.attributes.position.getY(0), 0);
  dispose(scene);
});
test("native Mesh2Motion solver creates weighted skin and authored animation deforms vertices", async () => {
  const [model, rig, library] = await Promise.all([
    load(source),
    load(asset("human-rig.glb")),
    load(asset("human-animations.glb")),
  ]);
  const d = { ...structuredClone(seed), source: ref };
  const result = bindModel(model, rigFor(rig, d), d);
  assert.equal(result.vertices, 7399);
  assert.equal(result.bones, 66);
  assert.ok(result.influenced > 40);
  let skinned: T.SkinnedMesh | undefined;
  result.group.traverse((o) => {
    if (o instanceof T.SkinnedMesh) skinned = o;
  });
  assert.ok(skinned);
  const weights = skinned.geometry.attributes.skinWeight;
  for (let i = 0; i < weights.count; i++) {
    const sum =
      weights.getX(i) + weights.getY(i) + weights.getZ(i) + weights.getW(i);
    assert.ok(Math.abs(sum - 1) < 1e-5);
  }
  const clips = clipsFor(library, 1),
    clip = clips.find((c) => c.name === "Dance_Simple");
  assert.equal(clips.length, 87);
  assert.ok(clip);
  const mixer = new T.AnimationMixer(result.group);
  mixer.clipAction(clip).play();
  const sample = (time: number) => {
    mixer.setTime(time);
    result.group.updateMatrixWorld(true);
    return [0, 500, 1500, 2500, 5000].map((i) =>
      skinned!.applyBoneTransform(
        i,
        new T.Vector3().fromBufferAttribute(
          skinned!.geometry.attributes.position,
          i,
        ),
      ),
    );
  };
  const a = sample(0),
    b = sample(0.6);
  assert.ok(a.some((v, i) => v.distanceTo(b[i]) > 0.02));
  mixer.stopAllAction();
  dispose(result.group);
  dispose(model.scene);
  dispose(rig.scene);
  dispose(library.scene);
});
test("joint offsets invalidate a previously bound result deterministically", () => {
  const d = { ...structuredClone(seed), source: ref };
  const a = bindingKey(d);
  d.offsets.pelvis = { x: 0.01, y: 0, z: 0 };
  assert.notEqual(bindingKey(d), a);
  assert.equal(
    bindingKey({ ...d, offsets: { pelvis: { x: 0.01, y: 0, z: 0 } } }),
    bindingKey(d),
  );
  assert.throws(() => restoreModel({ ...d, scale: 0 }), /数值/);
});
test("real SQLite receipts preserve unfinished inputs, idempotent retry and stale writer conflict", async () => {
  const db = database();
  try {
    const store = createAutosaveStore(db, validateModel),
      id = randomUUID();
    const req = {
      documentId: id,
      mutationId: randomUUID(),
      draftRevision: 0,
      projectId: null,
      projectRevision: null,
      snapshot: {
        title: "角色动作",
        data: { ...structuredClone(seed), source: ref },
        extra: { "num:pelvis:x": "-" },
      },
    };
    const first = await store.commit(req);
    assert.equal(first.phase, "saved");
    assert.deepEqual(await store.commit(req), first);
    assert.equal(db.prepare("select count(*) n from projects").get()!.n, 1);
    const restored = importModel({ snapshot: store.get(id)!.snapshot });
    assert.equal(restored.extra["num:pelvis:x"], "-");
    assert.deepEqual(restored.data.offsets, {});
    const next = {
      ...req,
      mutationId: randomUUID(),
      draftRevision: 1,
      projectId: first.project!.id,
      projectRevision: first.project!.revision,
      snapshot: {
        ...req.snapshot,
        data: { ...req.snapshot.data, notes: "新的制作备注" },
      },
    };
    const second = await store.commit(next);
    assert.equal(second.phase, "saved");
    await assert.rejects(
      () =>
        store.commit({
          ...next,
          mutationId: randomUUID(),
          snapshot: { ...next.snapshot, title: "陈旧稿" },
        }),
      /另一窗口/,
    );
  } finally {
    db.close();
  }
});
test("missing originals keep a recoverable draft without creating a false model", async () => {
  const db = database();
  try {
    const store = createAutosaveStore(db, validateModel, undefined, {
      verify: async () => {
        throw Error("原件缺失");
      },
    });
    const id = randomUUID();
    const result = await store.commit({
      documentId: id,
      mutationId: randomUUID(),
      draftRevision: 0,
      projectId: null,
      projectRevision: null,
      snapshot: {
        title: "待重附模型",
        data: { ...seed, source: ref },
        extra: { "num:scale": "0." },
      },
    });
    assert.equal(result.phase, "draft");
    assert.equal(result.project, null);
    assert.equal(
      importModel({ snapshot: store.get(id)!.snapshot }).data.source!.id,
      ref.id,
    );
  } finally {
    db.close();
  }
});
test("actual large UTF-8 working copy is restored from a confirmed database receipt", async () => {
  const db = database();
  try {
    const store = createAutosaveStore(db, validateModel),
      id = randomUUID(),
      extra = { reviewDraft: "图".repeat(400000) };
    const req = {
      documentId: id,
      mutationId: randomUUID(),
      draftRevision: 0,
      projectId: null,
      projectRevision: null,
      snapshot: { title: "完整工作稿", data: seed, extra },
    };
    assert.ok(Buffer.byteLength(JSON.stringify(req)) > 1_200_000);
    assert.equal((await store.commit(req)).phase, "saved");
    assert.equal(
      importModel({ snapshot: store.get(id)!.snapshot }).extra.reviewDraft,
      extra.reviewDraft,
    );
  } finally {
    db.close();
  }
});
test("import rejects oversized titles and malformed references before replacement", () => {
  assert.throws(() =>
    importModel({ title: "字".repeat(121), data: seed, extra: {} }),
  );
  assert.throws(() =>
    restoreModel({ ...seed, source: { ...ref, id: "../secret" } }),
  );
  assert.throws(() => importModel({ title: "x", data: seed, extra: [] }));
});

test("vendored solver source, compiled modules and CC0 assets match pinned provenance", () => {
  const root = new URL("../", import.meta.url),
    notices = manifest.resources.find(
      (r: { id: string }) => r.id === "notices",
    ).path;
  const provenance = JSON.parse(
    readFileSync(new URL(notices + "/provenance.json", root), "utf8"),
  );
  assert.equal(provenance.commit, "eef2de986dab53283cb636f860d502d64b8073e7");
  const hash = (v: Buffer) => createHash("sha256").update(v).digest("hex");
  for (const file of provenance.files) {
    assert.equal(
      hash(readFileSync(new URL(notices + "/upstream-src/" + file.path, root))),
      file.sourceSha256,
    );
    assert.equal(
      hash(
        readFileSync(
          new URL("src/vendor/" + file.path.replace(/\.ts$/, ".js"), root),
        ),
      ),
      file.compiledSha256,
    );
  }
  for (const a of provenance.assets)
    assert.equal(hash(Buffer.from(asset(a.path.split("/").at(-1)!))), a.sha256);
  assert.equal(
    hash(readFileSync(new URL(provenance.libraryMetadata.path, root))),
    provenance.libraryMetadata.sha256,
  );
});
