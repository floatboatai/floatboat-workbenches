import {
  NodeIO,
  ColorUtils,
  ImageUtils,
  type Document,
  type ILogger,
  type Node,
  type Texture,
} from "@gltf-transform/core";
import { ALL_EXTENSIONS, type InstancedMesh } from "@gltf-transform/extensions";
import {
  getBounds,
  getGLPrimitiveCount,
  getSceneVertexCount,
  inspect as inspectReport,
  listTextureSlots,
  VertexCountMethod,
} from "@gltf-transform/functions";
import {
  MeshoptDecoder,
  MeshoptEncoder,
  MeshoptSimplifier,
} from "meshoptimizer";
import draco3d from "draco3dgltf";
import { createHash } from "node:crypto";
import { MAX_MODEL } from "../contracts/asset.ts";
import type { StageReport } from "../contracts/pipeline.ts";
import type { Inspection, NodeRow } from "../contracts/inspection.ts";
import { quatToEuler } from "../contracts/transform.ts";

export const ENGINE =
  "@gltf-transform/core + extensions + functions 4.5.1 · NodeIO";
export const hash = (bytes: Uint8Array) =>
  createHash("sha256").update(bytes).digest("hex");

/** Collects library warnings for one operation instead of printing them. */
export class Collector implements ILogger {
  warnings: string[] = [];
  debug() {}
  info() {}
  warn(text: string) {
    if (this.warnings.length < 40 && !this.warnings.includes(text))
      this.warnings.push(text);
  }
  error(text: string) {
    this.warn(text);
  }
}

let dependencies: Promise<Record<string, unknown>> | undefined;
let encoder: Promise<unknown> | undefined;
async function codecs() {
  return (dependencies ??= (async () => {
    await Promise.all([
      MeshoptDecoder.ready,
      MeshoptEncoder.ready,
      MeshoptSimplifier.ready,
    ]);
    return {
      "meshopt.decoder": MeshoptDecoder,
      "meshopt.encoder": MeshoptEncoder,
      "draco3d.decoder": await draco3d.createDecoderModule(),
    };
  })());
}
export async function simplifier() {
  await MeshoptSimplifier.ready;
  return MeshoptSimplifier;
}
export async function meshoptEncoder() {
  await MeshoptEncoder.ready;
  return MeshoptEncoder;
}
/** NodeIO with every Khronos/EXT extension the library implements, plus Draco and meshopt codecs. */
export async function createIO(logger: ILogger = new Collector(), withDracoEncoder = false) {
  const io = new NodeIO()
    .registerExtensions(ALL_EXTENSIONS)
    .registerDependencies(await codecs());
  if (withDracoEncoder)
    io.registerDependencies({
      "draco3d.encoder": await (encoder ??= draco3d.createEncoderModule()),
    });
  io.setLogger(logger);
  return io;
}

export const LIMITS = {
  nodes: 50000,
  meshes: 20000,
  materials: 4096,
  textures: 1024,
  animations: 1024,
  textureSide: 16384,
  texturePixels: 256 * 1024 * 1024,
  uploadVertices: 12_000_000,
};
/** Structural budgets that keep the local service responsive on real assets. */
export function budget(doc: Document) {
  const r = doc.getRoot();
  const over = (n: number, max: number, label: string) => {
    if (n > max) throw Error(`${label}数量 ${n} 超过上限 ${max}。`);
  };
  over(r.listNodes().length, LIMITS.nodes, "节点");
  over(r.listMeshes().length, LIMITS.meshes, "网格");
  over(r.listMaterials().length, LIMITS.materials, "材质");
  over(r.listTextures().length, LIMITS.textures, "贴图");
  over(r.listAnimations().length, LIMITS.animations, "动画");
  let pixels = 0;
  for (const t of r.listTextures()) {
    const image = t.getImage();
    if (!image) continue;
    const size = ImageUtils.getSize(image, t.getMimeType());
    if (!size) continue;
    if (size[0] > LIMITS.textureSide || size[1] > LIMITS.textureSide)
      throw Error(`贴图 ${t.getName() || ""} 超过 ${LIMITS.textureSide}px。`);
    pixels += size[0] * size[1];
  }
  if (pixels > LIMITS.texturePixels)
    throw Error("贴图总像素超过 256 MP，请先在上游缩小贴图。");
  for (const n of r.listNodes()) {
    const world = n.getWorldMatrix();
    if (world.some((x) => !Number.isFinite(x)))
      throw Error("节点变换含有非有限数值。");
  }
  for (const scene of r.listScenes())
    if (
      getSceneVertexCount(scene, VertexCountMethod.UPLOAD) >
      LIMITS.uploadVertices
    )
      throw Error("上传顶点超过 1200 万，请拆分模型后导入。");
}

export async function readDocument(bytes: Uint8Array, logger?: ILogger) {
  if (bytes.length > MAX_MODEL) throw Error("模型超过 128 MB。");
  const io = await createIO(logger);
  let doc: Document;
  try {
    doc = await io.readBinary(bytes);
  } catch (e) {
    throw Error(
      "模型无法解析：" + (e instanceof Error ? e.message : "未知错误"),
    );
  }
  budget(doc);
  return doc;
}
export async function writeDocument(doc: Document, logger?: ILogger) {
  const io = await createIO(logger);
  const bytes = await io.writeBinary(doc);
  if (bytes.length > MAX_MODEL) throw Error("结果超过 128 MB。");
  return bytes;
}

const text = (v: unknown, max = 400) =>
  typeof v === "string" ? v.slice(0, max) : "";
const json = (v: unknown) => {
  try {
    return JSON.stringify(v ?? {}, null, 2).slice(0, 60000);
  } catch {
    return "{}";
  }
};
function instanceCount(node: Node) {
  const ext = node.getExtension<InstancedMesh>("EXT_mesh_gpu_instancing");
  if (!ext) return 1;
  const attr = ext.listAttributes()[0];
  return attr ? attr.getCount() : 1;
}
const vram = (t: Texture) => {
  const image = t.getImage();
  if (!image) return 0;
  try {
    return ImageUtils.getVRAMByteLength(image, t.getMimeType()) ?? 0;
  } catch {
    return 0;
  }
};

/** Persistable before/after numbers for one model state. */
export function summarize(doc: Document, bytes: number): StageReport {
  const r = doc.getRoot(),
    scene = r.getDefaultScene() ?? r.listScenes()[0] ?? null;
  let drawCalls = 0,
    triangles = 0;
  const visited = new Set<Node>();
  const visit = (n: Node) => {
    if (visited.has(n)) return;
    visited.add(n);
    const mesh = n.getMesh();
    if (mesh) {
      const count = instanceCount(n);
      for (const p of mesh.listPrimitives()) {
        drawCalls++;
        if (p.getMode() >= 4) triangles += getGLPrimitiveCount(p) * count;
      }
    }
    n.listChildren().forEach(visit);
  };
  scene?.listChildren().forEach(visit);
  const used = new Set<object>();
  let vertexBytes = 0;
  for (const m of r.listMeshes())
    for (const p of m.listPrimitives())
      for (const a of [
        p.getIndices(),
        ...p.listAttributes(),
        ...p.listTargets().flatMap((t) => t.listAttributes()),
      ])
        if (a && !used.has(a)) {
          used.add(a);
          vertexBytes += a.getByteLength();
        }
  const textures = r.listTextures();
  return {
    bytes,
    nodes: r.listNodes().length,
    meshes: r.listMeshes().length,
    primitives: r
      .listMeshes()
      .reduce((s, m) => s + m.listPrimitives().length, 0),
    drawCalls,
    vertices: scene ? getSceneVertexCount(scene, VertexCountMethod.RENDER) : 0,
    uploadVertices: scene
      ? getSceneVertexCount(scene, VertexCountMethod.UPLOAD)
      : 0,
    triangles,
    materials: r.listMaterials().length,
    textures: textures.length,
    textureBytes: textures.reduce(
      (s, t) => s + (t.getImage()?.byteLength ?? 0),
      0,
    ),
    gpuBytes: Math.round(
      textures.reduce((s, t) => s + vram(t), 0) + vertexBytes,
    ),
    animations: r.listAnimations().length,
    keyframes: r
      .listAnimations()
      .reduce(
        (s, a) =>
          s +
          a
            .listSamplers()
            .reduce((k, x) => k + (x.getInput()?.getCount() ?? 0), 0),
        0,
      ),
    extensions: r
      .listExtensionsUsed()
      .map((e) => e.extensionName)
      .sort(),
  };
}

export function inspectDocument(
  doc: Document,
  bytes: number,
  warnings: string[] = [],
): Inspection {
  const r = doc.getRoot(),
    nodes = r.listNodes(),
    index = new Map(nodes.map((n, i) => [n, i])),
    parent = new Map<Node, Node>();
  for (const n of nodes) for (const c of n.listChildren()) parent.set(c, n);
  const animated = new Set<Node>();
  for (const a of r.listAnimations())
    for (const c of a.listChannels()) {
      const t = c.getTargetNode();
      if (t) animated.add(t);
    }
  const depth = (n: Node) => {
    let d = 0,
      p = parent.get(n);
    while (p && d < 64) {
      d++;
      p = parent.get(p);
    }
    return d;
  };
  const textures = r.listTextures(),
    materials = r.listMaterials();
  let report: ReturnType<typeof inspectReport> | null = null;
  try {
    report = inspectReport(doc);
  } catch (e) {
    warnings.push("统计报告不完整：" + (e instanceof Error ? e.message : ""));
  }
  const scene = r.getDefaultScene() ?? r.listScenes()[0];
  let bounds: Inspection["bounds"] = null;
  if (scene) {
    try {
      const b = getBounds(scene);
      if (b.min.every(Number.isFinite) && b.max.every(Number.isFinite))
        bounds = { min: [...b.min], max: [...b.max] };
    } catch {
      bounds = null;
    }
  }
  const nodeRows: NodeRow[] = nodes.map((n, i) => {
    const q = n.getRotation() as [number, number, number, number];
    return {
      index: i,
      name: text(n.getName(), 160),
      mesh: text(n.getMesh()?.getName(), 160) || (n.getMesh() ? "网格" : ""),
      parent: parent.has(n) ? (index.get(parent.get(n)!) ?? -1) : -1,
      depth: depth(n),
      children: n.listChildren().length,
      translation: [...n.getTranslation()] as [number, number, number],
      quaternion: [...q] as [number, number, number, number],
      rotation: quatToEuler(q),
      scale: [...n.getScale()] as [number, number, number],
      extras: json(n.getExtras()),
      animated: animated.has(n),
      skinned: Boolean(n.getSkin()),
      instances: instanceCount(n),
    };
  });
  if (textures.some((t) => t.getMimeType() === "image/ktx2"))
    warnings.push("KTX2 贴图保留在文件中，浏览器预览以灰色占位显示。");
  return {
    engine: ENGINE,
    bytes,
    report: summarize(doc, bytes),
    skins: r.listSkins().length,
    scenes: r
      .listScenes()
      .map((s, i) => text(s.getName(), 160) || `场景 ${i + 1}`),
    bounds,
    nodes: nodeRows,
    meshes: (report?.meshes.properties ?? [])
      .map((m, i) => ({
        name: text(m.name, 160) || `网格 ${i + 1}`,
        primitives: m.meshPrimitives,
        vertices: m.vertices,
        triangles: m.glPrimitives,
        instances: m.instances,
        bytes: m.size,
        attributes: m.attributes.slice(0, 16).map(String),
      }))
      .sort((a, b) => b.bytes - a.bytes)
      .slice(0, 200),
    materials: materials.map((m, i) => {
      const used = textures
        .map((t, k) => (t.listParents().includes(m) ? k : -1))
        .filter((k) => k >= 0);
      const base = m.getBaseColorTexture();
      return {
        index: i,
        name: text(m.getName(), 160),
        color:
          "#" +
          ColorUtils.factorToHex(m.getBaseColorFactor())
            .toString(16)
            .padStart(6, "0"),
        factor: [...m.getBaseColorFactor()],
        opacity: String(m.getBaseColorFactor()[3]),
        metallic: String(m.getMetallicFactor()),
        roughness: String(m.getRoughnessFactor()),
        alphaMode: m.getAlphaMode(),
        doubleSided: m.getDoubleSided(),
        extras: json(m.getExtras()),
        texture: base
          ? text(base.getName(), 160) || `贴图 ${textures.indexOf(base) + 1}`
          : "",
        textures: used,
        extensions: m.listExtensions().map((e) => e.extensionName),
      };
    }),
    textures: textures.map((t, i) => {
      const image = t.getImage(),
        size = image ? ImageUtils.getSize(image, t.getMimeType()) : null;
      return {
        index: i,
        name: text(t.getName(), 160) || text(t.getURI(), 160) || `贴图 ${i + 1}`,
        mime: t.getMimeType(),
        width: size?.[0] ?? 0,
        height: size?.[1] ?? 0,
        bytes: image?.byteLength ?? 0,
        gpuBytes: Math.round(vram(t)),
        slots: (() => {
          try {
            return listTextureSlots(t);
          } catch {
            return [];
          }
        })(),
        materials: t
          .listParents()
          .filter((p) => p.propertyType === "Material")
          .map((p) => text(p.getName(), 80)),
        hash: image ? hash(image) : "",
      };
    }),
    animations: r.listAnimations().map((a, i) => {
      const row = report?.animations.properties[i];
      const targets = [
        ...new Set(
          a
            .listChannels()
            .map((c) => {
              const t = c.getTargetNode();
              return t ? text(t.getName(), 60) || `节点 ${index.get(t)}` : "";
            })
            .filter(Boolean),
        ),
      ];
      return {
        name: text(a.getName(), 160) || `动画 ${i + 1}`,
        duration: row?.duration ?? 0,
        channels: a.listChannels().length,
        samplers: a.listSamplers().length,
        keyframes: row?.keyframes ?? 0,
        bytes: row?.size ?? 0,
        targets: targets.slice(0, 8),
      };
    }),
    extensions: r.listExtensionsUsed().map((e) => ({
      name: e.extensionName,
      required: e.isRequired(),
    })),
    warnings: warnings.slice(0, 40),
    rootExtras: json(r.getExtras()),
    generator: text(r.getAsset().generator, 200),
  };
}

const cache = new Map<string, Inspection>();
/** Inspections are pure functions of immutable content-addressed bytes. */
export async function inspectBytes(bytes: Uint8Array, id = hash(bytes)) {
  const hit = cache.get(id);
  if (hit) {
    cache.delete(id);
    cache.set(id, hit);
    return hit;
  }
  const logger = new Collector(),
    doc = await readDocument(bytes, logger),
    value = inspectDocument(doc, bytes.length, logger.warnings);
  cache.set(id, value);
  while (cache.size > 12) cache.delete(cache.keys().next().value!);
  return value;
}
