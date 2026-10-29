import { boundedText, isRecord } from "./project.ts";
import {
  passesValue,
  reportValue,
  PASS_BY_KIND,
  type PassKind,
  type PassStep,
  type StageReport,
} from "./pipeline.ts";

const MiB = 1024 * 1024;
/** Sum of files picked for one model import (GLB, glTF + resources, or ZIP). */
export const MAX_IMPORT = 64 * MiB;
/** Canonical GLB stored per source or pipeline stage (decoded geometry can exceed the upload). */
export const MAX_MODEL = 128 * MiB;
export const MAX_IMAGE = 32 * MiB;
/** Complete project ZIP (project.json plus every referenced model and image). */
export const MAX_PROJECT = 512 * MiB;
/** 0.8.x complete-project JSON with inline base64 resources. */
export const LEGACY_PROJECT = 12 * MiB;
export const SNAPSHOT_BYTES = 1_950_000;
/** Raw bytes per upload chunk; base64 + JSON envelope stays below the SDK's 2,000,000-byte body. */
export const CHUNK_BYTES = 1024 * 1024;

export interface FileRef {
  id: string;
  name: string;
  bytes: number;
}
export type ImageMime = "image/png" | "image/jpeg" | "image/webp";
export interface ImageRef extends FileRef {
  mime: ImageMime;
  width: number;
  height: number;
}
export type Vec3Text = [string, string, string];
export interface NodeEdit {
  name?: string;
  extras?: string;
  translation?: Vec3Text;
  /** Euler XYZ in degrees, converted to a quaternion when applied. */
  rotation?: Vec3Text;
  scale?: Vec3Text;
}
export interface MaterialEdit {
  name?: string;
  color?: string;
  opacity?: string;
  metallic?: string;
  roughness?: string;
  alphaMode?: "OPAQUE" | "MASK" | "BLEND";
  doubleSided?: boolean;
  extras?: string;
}
export interface Edits {
  nodes: Record<string, NodeEdit>;
  materials: Record<string, MaterialEdit>;
  rootExtras: string | null;
  textures: Record<string, ImageRef>;
}
export interface Stage {
  /** Digest of source id + edits + passes[0..n). */
  key: string;
  ref: FileRef;
  report: StageReport;
  ms: number;
  note: string;
}
export type Tab =
  | "optimize"
  | "materials"
  | "nodes"
  | "textures"
  | "animations"
  | "resources";
export const TABS: Tab[] = [
  "optimize",
  "materials",
  "nodes",
  "textures",
  "animations",
  "resources",
];
export type Compression = "none" | "meshopt" | "draco";
export type PassDraft = Record<string, string | boolean>;
export interface AssetDocument {
  source: FileRef | null;
  /** Final pipeline output (last stage), kept for 0.8 compatibility. */
  result: FileRef | null;
  appliedKey: string;
  edits: Edits;
  passes: PassStep[];
  /** stages[0] = edits applied; stages[i] = after passes[i-1]. */
  stages: Stage[];
  /** Unfinished per-pass parameter inputs (raw text while typing). */
  passDrafts: Partial<Record<PassKind, PassDraft>>;
  notes: string;
  tab: Tab;
  selected: number;
  view: "source" | "result";
  /** Stage previewed when view is result; -1 follows the final stage. */
  stage: number;
  camera: [number, number, number];
  target: [number, number, number];
  clip: string;
  time: number;
  compression: Compression;
}
export const byteSize = (v: unknown) =>
  new TextEncoder().encode(JSON.stringify(v)).length;
export function number(v: unknown, min: number, max: number) {
  if (typeof v !== "number" || !Number.isFinite(v) || v < min || v > max)
    throw Error(`数值需在 ${min}–${max} 范围。`);
  return v;
}
export function fileRef(v: unknown, max = MAX_MODEL): FileRef {
  if (
    !isRecord(v) ||
    typeof v.id !== "string" ||
    !/^[a-f0-9]{64}$/.test(v.id) ||
    !Number.isInteger(v.bytes)
  )
    throw Error("模型资源引用无效。");
  return {
    id: v.id,
    name: boundedText(v.name, 160),
    bytes: number(v.bytes, 12, max),
  };
}
export function imageRef(v: unknown): ImageRef {
  const ref = fileRef(v, MAX_IMAGE);
  if (
    !isRecord(v) ||
    !["image/png", "image/jpeg", "image/webp"].includes(String(v.mime))
  )
    throw Error("替换贴图格式无效。");
  return {
    ...ref,
    mime: v.mime as ImageMime,
    width: number(v.width, 1, 16384),
    height: number(v.height, 1, 16384),
  };
}
export function jsonObject(raw: string) {
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    throw Error("附加信息需要完整的JSON对象。");
  }
  if (!isRecord(value) || byteSize(value) > 60000)
    throw Error("附加信息须为60KB以内的JSON对象。");
  return value;
}
export function fraction(raw: string, label: string) {
  if (!/^(?:0(?:\.\d{1,6})?|1(?:\.0{1,6})?)$/.test(raw))
    throw Error(label + "需要0到1的完整数值。");
  return Number(raw);
}
const DECIMAL = /^-?(?:\d+(?:\.\d+)?|\.\d+)(?:e[-+]?\d+)?$/i;
export function decimal(raw: string, label: string, limit = 1e6) {
  if (!DECIMAL.test(raw.trim())) throw Error(label + "需要完整数值。");
  const n = Number(raw);
  if (!Number.isFinite(n) || Math.abs(n) > limit)
    throw Error(`${label}需在 ±${limit} 以内。`);
  return n;
}
const vecText = (x: unknown): Vec3Text => {
  if (!Array.isArray(x) || x.length !== 3) throw Error("节点变换输入无效。");
  return [boundedText(x[0], 32), boundedText(x[1], 32), boundedText(x[2], 32)];
};
const NODE_KEYS = ["name", "extras", "translation", "rotation", "scale"];
const MATERIAL_KEYS = [
  "name",
  "color",
  "opacity",
  "metallic",
  "roughness",
  "alphaMode",
  "doubleSided",
  "extras",
];
const INDEX = /^(0|[1-9]\d{0,5})$/;
export function nodeTransform(e: NodeEdit) {
  const axes = ["X", "Y", "Z"];
  const out: {
    translation?: [number, number, number];
    rotation?: [number, number, number];
    scale?: [number, number, number];
  } = {};
  if (e.translation)
    out.translation = e.translation.map((v, i) =>
      decimal(v, "平移 " + axes[i]),
    ) as [number, number, number];
  if (e.rotation)
    out.rotation = e.rotation.map((v, i) =>
      decimal(v, "旋转 " + axes[i], 36000),
    ) as [number, number, number];
  if (e.scale) {
    out.scale = e.scale.map((v, i) =>
      decimal(v, "缩放 " + axes[i], 1e5),
    ) as [number, number, number];
    if (out.scale.some((v) => Math.abs(v) < 1e-6))
      throw Error("缩放不能为 0。");
  }
  return out;
}
export function editsValue(v: unknown, valid = false): Edits {
  if (
    !isRecord(v) ||
    !isRecord(v.nodes) ||
    !isRecord(v.materials) ||
    Object.keys(v.nodes).length > 2000 ||
    Object.keys(v.materials).length > 1000 ||
    (v.textures !== undefined &&
      (!isRecord(v.textures) || Object.keys(v.textures).length > 256))
  )
    throw Error("修订配方结构无效。");
  const nodes: Record<string, NodeEdit> = {},
    materials: Record<string, MaterialEdit> = {},
    textures: Record<string, ImageRef> = {};
  for (const [k, x] of Object.entries(v.nodes)) {
    if (
      !INDEX.test(k) ||
      !isRecord(x) ||
      Object.keys(x).some((k) => !NODE_KEYS.includes(k))
    )
      throw Error("节点修订索引无效。");
    const n: NodeEdit = {};
    if (x.name !== undefined) n.name = boundedText(x.name, 160);
    if (x.extras !== undefined) {
      n.extras = boundedText(x.extras, 60000);
      if (valid) jsonObject(n.extras);
    }
    for (const f of ["translation", "rotation", "scale"] as const)
      if (x[f] !== undefined) n[f] = vecText(x[f]);
    if (valid) nodeTransform(n);
    nodes[k] = n;
  }
  for (const [k, x] of Object.entries(v.materials)) {
    if (
      !INDEX.test(k) ||
      !isRecord(x) ||
      Object.keys(x).some((k) => !MATERIAL_KEYS.includes(k))
    )
      throw Error("材质修订无效。");
    const m: MaterialEdit = {};
    for (const f of [
      "name",
      "color",
      "opacity",
      "metallic",
      "roughness",
      "extras",
    ] as const)
      if (x[f] !== undefined)
        m[f] = boundedText(
          x[f],
          f === "extras" ? 60000 : f === "name" ? 160 : 32,
        );
    if (x.alphaMode !== undefined) {
      if (!["OPAQUE", "MASK", "BLEND"].includes(String(x.alphaMode)))
        throw Error("透明模式无效。");
      m.alphaMode = x.alphaMode as MaterialEdit["alphaMode"];
    }
    if (x.doubleSided !== undefined) {
      if (typeof x.doubleSided !== "boolean") throw Error("双面设置无效。");
      m.doubleSided = x.doubleSided;
    }
    if (valid) {
      if (m.color !== undefined && !/^#[0-9a-f]{6}$/i.test(m.color))
        throw Error("颜色需要#RRGGBB格式。");
      if (m.opacity !== undefined) fraction(m.opacity, "不透明度");
      if (m.metallic !== undefined) fraction(m.metallic, "金属度");
      if (m.roughness !== undefined) fraction(m.roughness, "粗糙度");
      if (m.extras !== undefined) jsonObject(m.extras);
    }
    materials[k] = m;
  }
  for (const [k, x] of Object.entries(isRecord(v.textures) ? v.textures : {})) {
    if (!INDEX.test(k)) throw Error("贴图替换索引无效。");
    textures[k] = imageRef(x);
  }
  const rootExtras =
    v.rootExtras === null ? null : boundedText(v.rootExtras, 60000);
  if (valid && rootExtras !== null) jsonObject(rootExtras);
  return { nodes, materials, rootExtras, textures };
}
function stageValue(v: unknown): Stage {
  if (!isRecord(v)) throw Error("流水线阶段无效。");
  const key = boundedText(v.key, 64);
  if (!/^[a-f0-9]{8,64}$/.test(key)) throw Error("流水线阶段标识无效。");
  return {
    key,
    ref: fileRef(v.ref),
    report: reportValue(v.report),
    ms: number(v.ms, 0, 3_600_000),
    note: boundedText(v.note, 400),
  };
}
export function stagesValue(v: unknown) {
  if (!Array.isArray(v) || v.length > 40) throw Error("流水线阶段无效。");
  return v.map(stageValue);
}
function passDraftsValue(v: unknown) {
  const out: Partial<Record<PassKind, PassDraft>> = {};
  if (v === undefined) return out;
  if (!isRecord(v)) throw Error("优化参数草稿无效。");
  for (const [k, x] of Object.entries(v)) {
    if (!(k in PASS_BY_KIND) || !isRecord(x)) throw Error("优化参数草稿无效。");
    const spec = PASS_BY_KIND[k as PassKind],
      draft: PassDraft = {};
    for (const [key, value] of Object.entries(x)) {
      if (!spec.options.some((o) => o.key === key))
        throw Error("优化参数草稿无效。");
      if (typeof value === "boolean") draft[key] = value;
      else draft[key] = boundedText(value, 32);
    }
    out[k as PassKind] = draft;
  }
  return out;
}
export function restoreAsset(v: unknown): AssetDocument {
  if (!isRecord(v) || byteSize(v) > 2_000_000)
    throw Error("工程结构无效或超过恢复容量。");
  const vec = (a: unknown): [number, number, number] => {
    if (!Array.isArray(a) || a.length !== 3) throw Error("视图坐标无效。");
    return [
      number(a[0], -1e7, 1e7),
      number(a[1], -1e7, 1e7),
      number(a[2], -1e7, 1e7),
    ];
  };
  if (
    !TABS.includes(v.tab as Tab) ||
    !["source", "result"].includes(String(v.view))
  )
    throw Error("检查视图无效。");
  const compression = v.compression ?? "none";
  if (!["none", "meshopt", "draco"].includes(String(compression)))
    throw Error("导出压缩方式无效。");
  return {
    source: v.source === null ? null : fileRef(v.source),
    result: v.result === null ? null : fileRef(v.result),
    appliedKey: boundedText(v.appliedKey, 1_000_000),
    edits: editsValue(v.edits),
    passes: passesValue(v.passes ?? []),
    stages: v.stages === undefined ? [] : stagesValue(v.stages),
    passDrafts: passDraftsValue(v.passDrafts),
    notes: boundedText(v.notes, 40000),
    tab: v.tab as Tab,
    selected: number(v.selected, 0, 100000),
    view: v.view as AssetDocument["view"],
    stage: number(v.stage ?? -1, -1, 40),
    camera: vec(v.camera),
    target: vec(v.target),
    clip: boundedText(v.clip, 160),
    time: number(v.time, 0, 36000),
    compression: compression as Compression,
  };
}
export function validateAsset(v: unknown) {
  const d = restoreAsset(v);
  editsValue(d.edits, true);
  if (byteSize(d) > 850000) throw Error("正式工程超过850KB，工作稿仍保留。");
  return d;
}

/** Deterministic 112-bit string digest (cyrb53 × 2) used for stage identity. */
export function digest(text: string) {
  const run = (seed: number) => {
    let h1 = 0xdeadbeef ^ seed,
      h2 = 0x41c6ce57 ^ seed;
    for (let i = 0; i < text.length; i++) {
      const c = text.charCodeAt(i);
      h1 = Math.imul(h1 ^ c, 2654435761);
      h2 = Math.imul(h2 ^ c, 1597334677);
    }
    h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507);
    h1 ^= Math.imul(h2 ^ (h2 >>> 13), 3266489909);
    h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507);
    h2 ^= Math.imul(h1 ^ (h1 >>> 13), 3266489909);
    return (
      (h2 >>> 0).toString(16).padStart(8, "0") +
      (h1 >>> 0).toString(16).padStart(8, "0").slice(2)
    );
  };
  return run(1) + run(7);
}
function canonicalEdits(edits: Edits) {
  const e = editsValue(edits);
  if (Object.keys(e.textures).length) return e;
  const { nodes, materials, rootExtras } = e;
  return { nodes, materials, rootExtras };
}
/** Recipe text for the first `count` passes (0.8 keys stay valid when no passes exist). */
export function recipeText(
  d: Pick<AssetDocument, "source" | "edits" | "passes">,
  count = d.passes.length,
) {
  const base: unknown[] = [d.source?.id ?? null, canonicalEdits(d.edits)];
  if (count > 0)
    base.push(d.passes.slice(0, count).map((p) => [p.kind, p.options]));
  return JSON.stringify(base);
}
export function recipeKey(d: Pick<AssetDocument, "source" | "edits"> & {
  passes?: PassStep[];
}) {
  return recipeText({ ...d, passes: d.passes ?? [] });
}
export function stageKey(
  d: Pick<AssetDocument, "source" | "edits" | "passes">,
  count: number,
) {
  return digest(recipeText(d, count));
}
/** Number of leading stages whose identity still matches the current recipe. */
export function validStages(
  d: Pick<AssetDocument, "source" | "edits" | "passes" | "stages">,
) {
  let n = 0;
  while (
    n < d.stages.length &&
    n <= d.passes.length &&
    d.stages[n].key === stageKey(d, n)
  )
    n++;
  return n;
}
/** All refs a document depends on (for verification, export and repair). */
export function documentRefs(d: AssetDocument) {
  const refs: { ref: FileRef; kind: "model" | "image" }[] = [];
  const add = (ref: FileRef | null, kind: "model" | "image") => {
    if (ref && !refs.some((x) => x.ref.id === ref.id)) refs.push({ ref, kind });
  };
  add(d.source, "model");
  add(d.result, "model");
  for (const s of d.stages) add(s.ref, "model");
  for (const t of Object.values(d.edits.textures)) add(t, "image");
  return refs;
}
export const seed: AssetDocument = {
  source: null,
  result: null,
  appliedKey: "",
  edits: { nodes: {}, materials: {}, rootExtras: null, textures: {} },
  passes: [],
  stages: [],
  passDrafts: {},
  notes: "",
  tab: "optimize",
  selected: 0,
  view: "source",
  stage: -1,
  camera: [4, 3, 5],
  target: [0, 0.8, 0],
  clip: "",
  time: 0,
  compression: "none",
};
export function importAsset(v: unknown) {
  if (!isRecord(v)) throw Error("请选择资产工程或恢复稿。");
  const p = isRecord(v.snapshot) ? v.snapshot : v;
  if (!isRecord(p) || !isRecord(p.extra ?? {})) throw Error("恢复稿结构无效。");
  const title = boundedText(p.title, 120),
    data = restoreAsset(p.data),
    extra = (p.extra ?? {}) as Record<string, unknown>;
  if (byteSize({ title, data, extra }) > SNAPSHOT_BYTES)
    throw Error("工作稿超过1.95MB恢复预算。");
  return {
    title,
    data,
    extra,
    resources: Array.isArray(v.resources) ? v.resources : [],
  };
}
