import { boundedText, isRecord } from "./project.ts";
export const MAX_FILE = 1_400_000,
  MAX_PROJECT = 12 * 1024 * 1024,
  SNAPSHOT_BYTES = 1_950_000;
export interface FileRef {
  id: string;
  name: string;
  bytes: number;
}
export interface NodeEdit {
  name?: string;
  extras?: string;
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
}
export interface AssetDocument {
  source: FileRef | null;
  result: FileRef | null;
  appliedKey: string;
  edits: Edits;
  notes: string;
  tab: "nodes" | "materials" | "resources";
  selected: number;
  view: "source" | "result";
  camera: [number, number, number];
  target: [number, number, number];
  clip: string;
  time: number;
}
export const byteSize = (v: unknown) =>
  new TextEncoder().encode(JSON.stringify(v)).length;
export function number(v: unknown, min: number, max: number) {
  if (typeof v !== "number" || !Number.isFinite(v) || v < min || v > max)
    throw Error(`数值需在 ${min}–${max} 范围。`);
  return v;
}
export function fileRef(v: unknown): FileRef {
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
    bytes: number(v.bytes, 28, MAX_FILE),
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
export function editsValue(v: unknown, valid = false): Edits {
  if (
    !isRecord(v) ||
    !isRecord(v.nodes) ||
    !isRecord(v.materials) ||
    Object.keys(v.nodes).length > 256 ||
    Object.keys(v.materials).length > 128
  )
    throw Error("修订配方结构无效。");
  const nodes: Record<string, NodeEdit> = {},
    materials: Record<string, MaterialEdit> = {};
  for (const [k, x] of Object.entries(v.nodes)) {
    if (
      !/^(0|[1-9]\d{0,2})$/.test(k) ||
      !isRecord(x) ||
      Object.keys(x).some((k) => !["name", "extras"].includes(k))
    )
      throw Error("节点修订索引无效。");
    const n: NodeEdit = {};
    if (x.name !== undefined) n.name = boundedText(x.name, 160);
    if (x.extras !== undefined) {
      n.extras = boundedText(x.extras, 60000);
      if (valid) jsonObject(n.extras);
    }
    nodes[k] = n;
  }
  for (const [k, x] of Object.entries(v.materials)) {
    if (
      !/^(0|[1-9]\d{0,2})$/.test(k) ||
      !isRecord(x) ||
      Object.keys(x).some(
        (k) =>
          ![
            "name",
            "color",
            "opacity",
            "metallic",
            "roughness",
            "alphaMode",
            "doubleSided",
            "extras",
          ].includes(k),
      )
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
  const rootExtras =
    v.rootExtras === null ? null : boundedText(v.rootExtras, 60000);
  if (valid && rootExtras !== null) jsonObject(rootExtras);
  return { nodes, materials, rootExtras };
}
export function restoreAsset(v: unknown): AssetDocument {
  if (!isRecord(v) || byteSize(v) > 2_000_000)
    throw Error("工程结构无效或超过恢复容量。");
  const vec = (a: unknown): [number, number, number] => {
    if (!Array.isArray(a) || a.length !== 3) throw Error("视图坐标无效。");
    return [
      number(a[0], -1000000, 1000000),
      number(a[1], -1000000, 1000000),
      number(a[2], -1000000, 1000000),
    ];
  };
  if (
    !["nodes", "materials", "resources"].includes(String(v.tab)) ||
    !["source", "result"].includes(String(v.view))
  )
    throw Error("检查视图无效。");
  return {
    source: v.source === null ? null : fileRef(v.source),
    result: v.result === null ? null : fileRef(v.result),
    appliedKey: boundedText(v.appliedKey, 1000000),
    edits: editsValue(v.edits),
    notes: boundedText(v.notes, 40000),
    tab: v.tab as AssetDocument["tab"],
    selected: number(v.selected, 0, 1000),
    view: v.view as AssetDocument["view"],
    camera: vec(v.camera),
    target: vec(v.target),
    clip: boundedText(v.clip, 160),
    time: number(v.time, 0, 3600),
  };
}
export function validateAsset(v: unknown) {
  const d = restoreAsset(v);
  editsValue(d.edits, true);
  if (byteSize(d) > 850000) throw Error("正式工程超过850KB，工作稿仍保留。");
  return d;
}
export function recipeKey(d: Pick<AssetDocument, "source" | "edits">) {
  return JSON.stringify([d.source?.id ?? null, editsValue(d.edits)]);
}
export const seed: AssetDocument = {
  source: null,
  result: null,
  appliedKey: "",
  edits: { nodes: {}, materials: {}, rootExtras: null },
  notes: "",
  tab: "materials",
  selected: 0,
  view: "source",
  camera: [4, 3, 5],
  target: [0, 0.8, 0],
  clip: "",
  time: 0,
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
