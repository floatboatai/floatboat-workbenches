import { isRecord } from "./project.ts";

/** Optimisation passes backed by @gltf-transform/functions 4.5.1 (texture resize is app code). */
export type PassKind =
  | "prune"
  | "dedup"
  | "weld"
  | "simplify"
  | "resample"
  | "quantize"
  | "flatten"
  | "join"
  | "instance"
  | "center"
  | "textureResize";

export type OptionValue = number | string | boolean;
export type PassOptions = Record<string, OptionValue>;
export interface PassStep {
  id: string;
  kind: PassKind;
  options: PassOptions;
}
export type OptionSpec =
  | {
      key: string;
      label: string;
      type: "number";
      min: number;
      max: number;
      step: number;
      value: number;
    }
  | {
      key: string;
      label: string;
      type: "select";
      values: { value: string; label: string }[];
      value: string;
    }
  | { key: string; label: string; type: "boolean"; value: boolean };

export interface PassSpec {
  kind: PassKind;
  label: string;
  verb: string;
  hint: string;
  options: OptionSpec[];
}

export const PASSES: PassSpec[] = [
  {
    kind: "prune",
    label: "剪除",
    verb: "prune",
    hint: "移除场景未引用的节点、网格、材质、贴图与属性",
    options: [],
  },
  {
    kind: "dedup",
    label: "去重",
    verb: "dedup",
    hint: "合并相同的访问器、网格、材质与贴图",
    options: [
      {
        key: "keepUniqueNames",
        label: "保留不同名称",
        type: "boolean",
        value: false,
      },
    ],
  },
  {
    kind: "weld",
    label: "焊接",
    verb: "weld",
    hint: "合并逐位相同的顶点并建立索引",
    options: [],
  },
  {
    kind: "simplify",
    label: "简化",
    verb: "simplify",
    hint: "meshoptimizer 减面；先焊接效果更好",
    options: [
      {
        key: "ratio",
        label: "保留比例",
        type: "number",
        min: 0,
        max: 1,
        step: 0.05,
        value: 0.5,
      },
      {
        key: "error",
        label: "误差上限",
        type: "number",
        min: 0.0001,
        max: 1,
        step: 0.0005,
        value: 0.001,
      },
      { key: "lockBorder", label: "锁定边界", type: "boolean", value: false },
    ],
  },
  {
    kind: "resample",
    label: "重采样",
    verb: "resample",
    hint: "删除可由相邻关键帧插值得到的动画帧",
    options: [
      {
        key: "tolerance",
        label: "容差",
        type: "number",
        min: 0.000001,
        max: 0.1,
        step: 0.0001,
        value: 0.0001,
      },
    ],
  },
  {
    kind: "quantize",
    label: "量化",
    verb: "quantize",
    hint: "KHR_mesh_quantization 压缩顶点属性位宽",
    options: [
      {
        key: "quantizePosition",
        label: "位置位数",
        type: "number",
        min: 8,
        max: 16,
        step: 1,
        value: 14,
      },
      {
        key: "quantizeNormal",
        label: "法线位数",
        type: "number",
        min: 8,
        max: 16,
        step: 1,
        value: 10,
      },
      {
        key: "quantizeTexcoord",
        label: "UV 位数",
        type: "number",
        min: 8,
        max: 16,
        step: 1,
        value: 12,
      },
    ],
  },
  {
    kind: "flatten",
    label: "展平",
    verb: "flatten",
    hint: "把网格节点移到场景根；骨架与动画节点保持层级",
    options: [],
  },
  {
    kind: "join",
    label: "合并网格",
    verb: "join",
    hint: "合并同材质、同属性的图元以减少绘制调用",
    options: [
      { key: "keepNamed", label: "保留命名节点", type: "boolean", value: false },
    ],
  },
  {
    kind: "instance",
    label: "实例化",
    verb: "instance",
    hint: "EXT_mesh_gpu_instancing 批量绘制共享网格",
    options: [
      {
        key: "min",
        label: "最少重复",
        type: "number",
        min: 2,
        max: 100,
        step: 1,
        value: 2,
      },
    ],
  },
  {
    kind: "center",
    label: "居中",
    verb: "center",
    hint: "把场景包围盒移到原点",
    options: [
      {
        key: "pivot",
        label: "基准",
        type: "select",
        values: [
          { value: "below", label: "底面落地" },
          { value: "center", label: "包围盒中心" },
          { value: "above", label: "顶面对齐" },
        ],
        value: "below",
      },
    ],
  },
  {
    kind: "textureResize",
    label: "缩小贴图",
    verb: "resize",
    hint: "PNG/JPEG 按最长边缩小；WebP/KTX2 保留",
    options: [
      {
        key: "maxSize",
        label: "最长边",
        type: "select",
        values: ["256", "512", "1024", "2048", "4096"].map((value) => ({
          value,
          label: value + " px",
        })),
        value: "1024",
      },
    ],
  },
];

export const PASS_BY_KIND = Object.fromEntries(
  PASSES.map((p) => [p.kind, p]),
) as Record<PassKind, PassSpec>;
export const MAX_PASSES = 32;

export function defaultOptions(kind: PassKind): PassOptions {
  return Object.fromEntries(
    PASS_BY_KIND[kind].options.map((o) => [o.key, o.value]),
  );
}

/** Strict pass validation; unknown keys reject, missing keys take defaults. */
export function passValue(v: unknown): PassStep {
  if (
    !isRecord(v) ||
    typeof v.id !== "string" ||
    !/^[A-Za-z0-9_-]{1,40}$/.test(v.id) ||
    typeof v.kind !== "string" ||
    !(v.kind in PASS_BY_KIND) ||
    !isRecord(v.options)
  )
    throw Error("优化步骤无效。");
  const spec = PASS_BY_KIND[v.kind as PassKind],
    options: PassOptions = {};
  for (const key of Object.keys(v.options))
    if (!spec.options.some((o) => o.key === key))
      throw Error(spec.label + "含有未知参数。");
  for (const o of spec.options) {
    const raw = v.options[o.key];
    if (raw === undefined) {
      options[o.key] = o.value;
      continue;
    }
    if (o.type === "number") {
      if (
        typeof raw !== "number" ||
        !Number.isFinite(raw) ||
        raw < o.min ||
        raw > o.max
      )
        throw Error(`${spec.label}的${o.label}需在 ${o.min}–${o.max}。`);
      options[o.key] = raw;
    } else if (o.type === "select") {
      if (!o.values.some((x) => x.value === raw))
        throw Error(`${spec.label}的${o.label}无效。`);
      options[o.key] = raw as string;
    } else {
      if (typeof raw !== "boolean") throw Error(`${spec.label}的${o.label}无效。`);
      options[o.key] = raw;
    }
  }
  return { id: v.id, kind: v.kind as PassKind, options };
}

export function passesValue(v: unknown): PassStep[] {
  if (!Array.isArray(v) || v.length > MAX_PASSES)
    throw Error(`优化流水线最多 ${MAX_PASSES} 步。`);
  const list = v.map(passValue);
  if (new Set(list.map((p) => p.id)).size !== list.length)
    throw Error("优化步骤标识重复。");
  return list;
}

export function describePass(p: PassStep) {
  const spec = PASS_BY_KIND[p.kind];
  const parts = spec.options
    .filter((o) => p.options[o.key] !== o.value || o.type !== "boolean")
    .map((o) => {
      const v = p.options[o.key];
      if (o.type === "boolean") return v ? o.label : "";
      if (o.type === "select")
        return o.values.find((x) => x.value === v)?.label ?? String(v);
      return `${o.label} ${v}`;
    })
    .filter(Boolean);
  return parts.join(" · ");
}

/** Summary numbers persisted for every pipeline stage. */
export interface StageReport {
  bytes: number;
  nodes: number;
  meshes: number;
  primitives: number;
  drawCalls: number;
  vertices: number;
  uploadVertices: number;
  triangles: number;
  materials: number;
  textures: number;
  textureBytes: number;
  gpuBytes: number;
  animations: number;
  keyframes: number;
  extensions: string[];
}
const REPORT_KEYS = [
  "bytes",
  "nodes",
  "meshes",
  "primitives",
  "drawCalls",
  "vertices",
  "uploadVertices",
  "triangles",
  "materials",
  "textures",
  "textureBytes",
  "gpuBytes",
  "animations",
  "keyframes",
] as const;
export function reportValue(v: unknown): StageReport {
  if (!isRecord(v) || !Array.isArray(v.extensions) || v.extensions.length > 80)
    throw Error("阶段报告无效。");
  const out = { extensions: [] as string[] } as unknown as StageReport;
  for (const k of REPORT_KEYS) {
    const n = v[k];
    if (typeof n !== "number" || !Number.isInteger(n) || n < 0 || n > 1e13)
      throw Error("阶段报告数值无效。");
    out[k] = n;
  }
  for (const e of v.extensions) {
    if (typeof e !== "string" || !/^[A-Za-z0-9_]{1,80}$/.test(e))
      throw Error("阶段报告扩展无效。");
    out.extensions.push(e);
  }
  return out;
}

export const REPORT_ROWS: {
  key: Exclude<keyof StageReport, "extensions">;
  label: string;
  unit: "bytes" | "count";
}[] = [
  { key: "bytes", label: "文件大小", unit: "bytes" },
  { key: "drawCalls", label: "绘制调用", unit: "count" },
  { key: "triangles", label: "三角面", unit: "count" },
  { key: "vertices", label: "渲染顶点", unit: "count" },
  { key: "uploadVertices", label: "上传顶点", unit: "count" },
  { key: "meshes", label: "网格", unit: "count" },
  { key: "materials", label: "材质", unit: "count" },
  { key: "textures", label: "贴图", unit: "count" },
  { key: "gpuBytes", label: "显存估算", unit: "bytes" },
  { key: "keyframes", label: "关键帧", unit: "count" },
  { key: "nodes", label: "节点", unit: "count" },
];

export function formatBytes(n: number) {
  if (n >= 1024 * 1024) return (n / 1024 / 1024).toFixed(2) + " MB";
  if (n >= 1024) return (n / 1024).toFixed(1) + " KB";
  return n + " B";
}
export function formatDelta(before: number, after: number) {
  if (!before) return after ? "+" : "±0";
  const pct = ((after - before) / before) * 100;
  if (Math.abs(pct) < 0.05) return "±0";
  return (pct > 0 ? "+" : "−") + Math.abs(pct).toFixed(Math.abs(pct) < 10 ? 1 : 0) + "%";
}
