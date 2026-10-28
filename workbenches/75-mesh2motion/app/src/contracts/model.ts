import { humanJoints, humanClips } from "./human-library.ts";
import { isRecord, boundedText } from "./project.ts";
export const MAX_SOURCE = 1_000_000,
  MAX_RESOURCE = 1_400_000,
  MAX_PROJECT = 8_000_000;
export interface ModelRef {
  id: string;
  name: string;
  bytes: number;
  kind: "source" | "bound";
}
export interface Offset {
  x: number;
  y: number;
  z: number;
}
export interface ModelDocument {
  source: ModelRef | null;
  bound: ModelRef | null;
  bindingKey: string;
  offsets: Record<string, Offset>;
  scale: number;
  clip: string;
  speed: number;
  time: number;
  selectedJoint: string;
  showSkeleton: boolean;
  camera: [number, number, number];
  target: [number, number, number];
  notes: string;
}
function number(v: unknown, min: number, max: number) {
  if (typeof v !== "number" || !Number.isFinite(v) || v < min || v > max)
    throw Error(`数值需在 ${min}–${max} 之间。`);
  return v;
}
export function refValue(v: unknown): ModelRef {
  if (
    !isRecord(v) ||
    typeof v.id !== "string" ||
    !/^[a-f0-9]{64}$/.test(v.id) ||
    (v.kind !== "source" && v.kind !== "bound")
  )
    throw Error("模型资源引用无效。");
  return {
    id: v.id,
    name: boundedText(v.name, 160),
    bytes: number(v.bytes, 20, v.kind === "source" ? MAX_SOURCE : MAX_RESOURCE),
    kind: v.kind,
  };
}
export function bindingKey(
  d: Pick<ModelDocument, "source" | "offsets" | "scale">,
): string {
  return JSON.stringify([
    d.source?.id,
    d.scale,
    Object.entries(d.offsets).sort(([a], [b]) => a.localeCompare(b)),
  ]);
}
export function restoreModel(v: unknown): ModelDocument {
  if (
    !isRecord(v) ||
    !isRecord(v.offsets) ||
    Object.keys(v.offsets).length > 100
  )
    throw Error("角色工程格式无效。");
  const offsets: Record<string, Offset> = {};
  for (const [k, o] of Object.entries(v.offsets)) {
    if (
      !/^[a-zA-Z0-9_-]{1,80}$/.test(k) ||
      !isRecord(o) ||
      ["__proto__", "constructor", "prototype"].includes(k)
    )
      throw Error("关节数据无效。");
    offsets[k] = {
      x: number(o.x, -1, 1),
      y: number(o.y, -1, 1),
      z: number(o.z, -1, 1),
    };
  }
  const vector = (a: unknown): [number, number, number] => {
    if (!Array.isArray(a) || a.length !== 3) throw Error("视图坐标无效。");
    return [
      number(a[0], -100, 100),
      number(a[1], -100, 100),
      number(a[2], -100, 100),
    ];
  };
  const d: ModelDocument = {
    source: v.source === null ? null : refValue(v.source),
    bound: v.bound === null ? null : refValue(v.bound),
    bindingKey: boundedText(v.bindingKey, 30000),
    offsets,
    scale: number(v.scale, 0.5, 2),
    clip: boundedText(v.clip, 120),
    speed: number(v.speed, 0.25, 2),
    time: number(v.time, 0, 600),
    selectedJoint: boundedText(v.selectedJoint, 80),
    showSkeleton: v.showSkeleton === true,
    camera: vector(v.camera),
    target: vector(v.target),
    notes: boundedText(v.notes, 40000),
  };
  if (
    (d.source && d.source.kind !== "source") ||
    (d.bound && d.bound.kind !== "bound")
  )
    throw Error("原件与绑定结果类型不符。");
  if (new TextEncoder().encode(JSON.stringify(d)).length > 2_000_000)
    throw Error("工作稿超过恢复容量。");
  return d;
}
export function validateModel(v: unknown): ModelDocument {
  const d = restoreModel(v);
  if (
    !humanJoints.some((n) => n === d.selectedJoint) ||
    Object.keys(d.offsets).some((k) => !humanJoints.some((n) => n === k))
  )
    throw Error("工程包含当前人形骨架没有的关节，输入仍可作为草稿保留。");
  if (!humanClips.some((n) => n === d.clip))
    throw Error("动作不在当前人形动作库中。");
  if (new TextEncoder().encode(JSON.stringify(d)).length > 850000)
    throw Error("正式工程超过容量，请保留恢复稿并缩减。");
  return d;
}
export const seed: ModelDocument = {
  source: null,
  bound: null,
  bindingKey: "",
  offsets: {},
  scale: 1,
  clip: "Idle_A",
  speed: 1,
  time: 0,
  selectedJoint: "pelvis",
  showSkeleton: true,
  camera: [2.7, 1.9, 3.8],
  target: [0, 0.95, 0],
  notes: "",
};
export function importModel(v: unknown) {
  if (!isRecord(v)) throw Error("工程文件无效。");
  if (
    !isRecord(v.snapshot) &&
    (v.format !== "mesh2motion-workbench" || v.version !== 1)
  )
    throw Error("完整工程版本不支持，请使用本工作台导出的工程或恢复稿。");
  const body = isRecord(v.snapshot) ? v.snapshot : v;
  if (!isRecord(body) || !isRecord(body.extra ?? {}))
    throw Error("工作稿结构无效。");
  return {
    title: boundedText(body.title, 120),
    data: restoreModel(body.data),
    extra: (body.extra as Record<string, unknown>) ?? {},
    resources: Array.isArray(v.resources) ? v.resources : [],
  };
}
