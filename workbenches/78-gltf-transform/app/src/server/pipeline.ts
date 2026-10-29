import { ColorUtils, type Document, type Transform } from "@gltf-transform/core";
import { EXTTextureWebP } from "@gltf-transform/extensions";
import {
  center,
  dedup,
  dequantize,
  draco,
  flatten,
  instance,
  join,
  meshopt,
  prune,
  quantize,
  resample,
  simplify,
  weld,
} from "@gltf-transform/functions";
import { createHash } from "node:crypto";
import {
  editsValue,
  jsonObject,
  nodeTransform,
  stageKey,
  type Compression,
  type Edits,
  type FileRef,
  type ImageRef,
  type Stage,
} from "../contracts/asset.ts";
import { PASS_BY_KIND, passesValue, type PassStep } from "../contracts/pipeline.ts";
import { eulerToQuat } from "../contracts/transform.ts";
import {
  Collector,
  createIO,
  meshoptEncoder,
  readDocument,
  simplifier,
  summarize,
  writeDocument,
} from "./model.ts";
import { resizeImage } from "./images.ts";

const accessorDigest = (doc: Document) => {
  const h = createHash("sha256");
  for (const a of doc.getRoot().listAccessors()) {
    const array = a.getArray();
    h.update(a.getType() + a.getComponentType() + a.getNormalized());
    if (array) h.update(new Uint8Array(array.buffer, array.byteOffset, array.byteLength));
  }
  return h.digest("hex");
};
/** Fields an edit stage may change; everything else must survive the NodeIO round trip. */
function editable(doc: Document) {
  const r = doc.getRoot();
  return JSON.stringify({
    root: r.getExtras(),
    nodes: r
      .listNodes()
      .map((n) => [
        n.getName(),
        n.getExtras(),
        n.getTranslation().map((v) => +v.toFixed(5)),
        n.getRotation().map((v) => +v.toFixed(5)),
        n.getScale().map((v) => +v.toFixed(5)),
      ]),
    materials: r
      .listMaterials()
      .map((m) => [
        m.getName(),
        m.getExtras(),
        m.getBaseColorFactor(),
        m.getMetallicFactor(),
        m.getRoughnessFactor(),
        m.getAlphaMode(),
        m.getDoubleSided(),
        m.listExtensions().map((e) => e.extensionName),
      ]),
    textures: r.listTextures().map((t) => {
      const image = t.getImage();
      return [
        t.getMimeType(),
        image ? createHash("sha256").update(image).digest("hex") : "",
      ];
    }),
    extensions: r
      .listExtensionsUsed()
      .map((e) => e.extensionName)
      .sort(),
    animations: r.listAnimations().length,
    skins: r.listSkins().length,
  });
}

export function hasEdits(edits: Edits) {
  return Boolean(
    Object.keys(edits.nodes).length ||
      Object.keys(edits.materials).length ||
      Object.keys(edits.textures).length ||
      edits.rootExtras !== null,
  );
}

/** Applies the recipe's names, PBR, TRS, extras and texture replacements in place. */
export function applyEdits(
  doc: Document,
  raw: Edits,
  images: Map<string, Uint8Array>,
) {
  const edits = editsValue(raw, true),
    r = doc.getRoot();
  for (const [k, e] of Object.entries(edits.nodes)) {
    const n = r.listNodes()[Number(k)];
    if (!n) throw Error("修订节点已不存在。");
    if (e.name !== undefined) n.setName(e.name);
    if (e.extras !== undefined) n.setExtras(jsonObject(e.extras));
    const t = nodeTransform(e);
    if (t.translation) n.setTranslation(t.translation);
    if (t.rotation) n.setRotation(eulerToQuat(t.rotation));
    if (t.scale) n.setScale(t.scale);
  }
  for (const [k, e] of Object.entries(edits.materials)) {
    const m = r.listMaterials()[Number(k)];
    if (!m) throw Error("修订材质已不存在。");
    if (e.name !== undefined) m.setName(e.name);
    const factor = m.getBaseColorFactor();
    if (e.color !== undefined) {
      const rgb = ColorUtils.hexToFactor(
        Number.parseInt(e.color.slice(1), 16),
        [0, 0, 0] as [number, number, number],
      );
      factor.splice(0, 3, ...rgb);
    }
    if (e.opacity !== undefined) factor[3] = Number(e.opacity);
    if (e.color !== undefined || e.opacity !== undefined)
      m.setBaseColorFactor(factor);
    if (e.metallic !== undefined) m.setMetallicFactor(Number(e.metallic));
    if (e.roughness !== undefined) m.setRoughnessFactor(Number(e.roughness));
    if (e.alphaMode !== undefined) m.setAlphaMode(e.alphaMode);
    if (e.doubleSided !== undefined) m.setDoubleSided(e.doubleSided);
    if (e.extras !== undefined) m.setExtras(jsonObject(e.extras));
  }
  for (const [k, ref] of Object.entries(edits.textures)) {
    const t = r.listTextures()[Number(k)];
    if (!t) throw Error("替换的贴图已不存在。");
    const bytes = images.get(ref.id);
    if (!bytes) throw Error(`替换贴图 ${ref.name} 缺失，请重新选择。`);
    t.setImage(bytes).setMimeType(ref.mime);
    if (ref.mime === "image/webp")
      doc.createExtension(EXTTextureWebP).setRequired(true);
  }
  if (edits.rootExtras !== null) r.setExtras(jsonObject(edits.rootExtras));
}

const resizeTextures =
  (maxSide: number, notes: string[]): Transform =>
  (doc) => {
    let resized = 0,
      kept = 0;
    for (const t of doc.getRoot().listTextures()) {
      const image = t.getImage();
      if (!image) continue;
      const out = resizeImage(image, t.getMimeType(), maxSide);
      if (out) {
        t.setImage(out.bytes);
        resized++;
      } else if (!["image/png", "image/jpeg"].includes(t.getMimeType())) kept++;
    }
    notes.push(
      resized
        ? `${resized} 张贴图缩小到 ${maxSide}px 以内`
        : `没有超过 ${maxSide}px 的 PNG/JPEG 贴图`,
    );
    if (kept) notes.push(`${kept} 张 WebP/KTX2/AVIF 贴图保持原样`);
  };

/** Runs one optimisation pass on a document in place; returns user-facing notes. */
export async function runPass(doc: Document, step: PassStep) {
  const o = step.options,
    notes: string[] = [];
  switch (step.kind) {
    case "prune":
      await doc.transform(prune());
      break;
    case "dedup":
      await doc.transform(dedup({ keepUniqueNames: Boolean(o.keepUniqueNames) }));
      break;
    case "weld":
      await doc.transform(weld());
      break;
    case "simplify": {
      const before = doc
        .getRoot()
        .listMeshes()
        .flatMap((m) => m.listPrimitives())
        .filter((p) => p.getMode() !== 4).length;
      await doc.transform(
        weld(),
        simplify({
          simplifier: await simplifier(),
          ratio: Number(o.ratio),
          error: Number(o.error),
          lockBorder: Boolean(o.lockBorder),
        }),
      );
      notes.push("已先焊接再简化");
      if (before) notes.push(`${before} 个非三角图元未简化`);
      break;
    }
    case "resample":
      await doc.transform(resample({ tolerance: Number(o.tolerance) }));
      break;
    case "quantize":
      await doc.transform(
        quantize({
          quantizePosition: Number(o.quantizePosition),
          quantizeNormal: Number(o.quantizeNormal),
          quantizeTexcoord: Number(o.quantizeTexcoord),
        }),
      );
      break;
    case "flatten":
      await doc.transform(flatten());
      break;
    case "join":
      await doc.transform(join({ keepNamed: Boolean(o.keepNamed) }));
      break;
    case "instance": {
      const r = doc.getRoot();
      if (r.listAnimations().length) {
        notes.push("含动画的模型暂不能实例化（glTF Transform 限制），模型未改变");
        break;
      }
      const batched = () =>
        r.listNodes().filter((n) => n.getExtension("EXT_mesh_gpu_instancing")).length;
      const before = batched();
      await doc.transform(instance({ min: Number(o.min) }));
      const after = batched() - before;
      notes.push(after ? `${after} 组共享网格改为 GPU 实例` : `没有重复 ≥ ${o.min} 次的共享网格；可先去重`);
      break;
    }
    case "center":
      await doc.transform(
        center({ pivot: String(o.pivot) as "center" | "above" | "below" }),
      );
      break;
    case "textureResize":
      await doc.transform(resizeTextures(Number(o.maxSize), notes));
      break;
  }
  return notes;
}

export interface Resources {
  read(id: string): Promise<Uint8Array>;
  exists(ref: FileRef): Promise<boolean>;
  save(bytes: Uint8Array, name: string): Promise<FileRef>;
}

const baseName = (name: string) =>
  name.replace(/\.(glb|gltf|zip)$/i, "").replace(/-(\d+-[a-z]+|edited)$/i, "") ||
  "model";

/**
 * Computes every pipeline stage, reusing the longest still-valid cached prefix.
 * stages[0] applies edits; stages[i] runs passes[i-1] on stages[i-1].
 */
export async function runPipeline(
  input: {
    source: FileRef;
    edits: Edits;
    passes: PassStep[];
    cached: Stage[];
    images: Map<string, Uint8Array>;
  },
  store: Resources,
) {
  const passes = passesValue(input.passes),
    edits = editsValue(input.edits, true),
    recipe = { source: input.source, edits, passes },
    keys = passes.map((_, i) => stageKey(recipe, i + 1));
  keys.unshift(stageKey(recipe, 0));
  const stages: Stage[] = [];
  for (const s of input.cached) {
    const i = stages.length;
    if (i > passes.length || s.key !== keys[i] || !(await store.exists(s.ref)))
      break;
    stages.push(s);
  }
  const reused = stages.length;
  if (reused === passes.length + 1) return { stages, computed: 0 };
  const name = baseName(input.source.name);
  let doc: Document;
  if (reused === 0) {
    const started = performance.now(),
      bytes = await store.read(input.source.id),
      logger = new Collector();
    doc = await readDocument(bytes, logger);
    if (!hasEdits(edits)) {
      stages.push({
        key: keys[0],
        ref: input.source,
        report: summarize(doc, bytes.length),
        ms: Math.round(performance.now() - started),
        note: "原件",
      });
    } else {
      applyEdits(doc, edits, input.images);
      const expected = editable(doc),
        geometry = accessorDigest(doc),
        output = await writeDocument(doc, logger),
        again = await readDocument(output);
      if (editable(again) !== expected || accessorDigest(again) !== geometry)
        throw Error("原生回读保全检查失败，未生成结果。");
      stages.push({
        key: keys[0],
        ref: await store.save(output, `${name}-edited.glb`),
        report: summarize(doc, output.length),
        ms: Math.round(performance.now() - started),
        note: "修订已应用",
      });
    }
  } else {
    doc = await readDocument(await store.read(stages[reused - 1].ref.id));
  }
  for (let i = stages.length; i <= passes.length; i++) {
    const step = passes[i - 1],
      started = performance.now(),
      logger = new Collector();
    let notes: string[];
    doc.setLogger(logger);
    try {
      notes = await runPass(doc, step);
    } catch (e) {
      throw Error(
        `${PASS_BY_KIND[step.kind].label}失败：${e instanceof Error ? e.message : "未知错误"}`,
      );
    }
    const output = await writeDocument(doc, logger);
    await readDocument(output);
    stages.push({
      key: keys[i],
      ref: await store.save(
        output,
        `${name}-${i}-${PASS_BY_KIND[step.kind].verb}.glb`,
      ),
      report: summarize(doc, output.length),
      ms: Math.round(performance.now() - started),
      note: [...notes, ...logger.warnings.slice(0, 2)].join("；").slice(0, 400),
    });
  }
  return { stages, computed: stages.length - reused };
}

/** Delivery encoding applied at export; the stored stage stays uncompressed for preview. */
export async function compressModel(bytes: Uint8Array, mode: Compression) {
  if (mode === "none") return bytes;
  const doc = await readDocument(bytes);
  if (mode === "meshopt")
    await doc.transform(
      meshopt({ encoder: await meshoptEncoder(), level: "medium" }),
    );
  else {
    if (
      doc
        .getRoot()
        .listExtensionsUsed()
        .some((e) => e.extensionName === "KHR_mesh_quantization")
    )
      await doc.transform(dequantize());
    await doc.transform(draco({ method: "edgebreaker" }));
  }
  const io = await createIO(new Collector(), mode === "draco"),
    output = await io.writeBinary(doc);
  await readDocument(output);
  return output;
}
export type { ImageRef };
