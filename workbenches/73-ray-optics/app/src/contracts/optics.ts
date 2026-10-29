import { boundedText, isRecord } from "./project.ts";
import { sceneDefaults, objectDefaults } from "./native-schema.ts";
import { objectNames, type OpticalObject } from "./catalog.ts";
export { objectNames, type OpticalObject } from "./catalog.ts";

export interface OpticalScene {
  version: number;
  objs: OpticalObject[];
  [key: string]: unknown;
}
export type Quality = "draft" | "standard" | "fine";
export interface Optics {
  scene: string;
  notes: string;
  original: string;
  originalName: string;
  /** Trace budget for live redraw (see qualityBudgets). */
  quality: Quality;
  /** Id of the example the experiment was opened from ("" if none). */
  example: string;
}
export const FORMAL_BYTES = 850000,
  WORKING_BYTES = 2000000,
  MAX_OBJECTS = 400,
  SCENE_CHARS = 550000;
export const qualityBudgets: Record<Quality, { label: string; rays: number }> = {
  draft: { label: "草图", rays: 20000 },
  standard: { label: "标准", rays: 100000 },
  fine: { label: "精细", rays: 500000 },
};
export const viewModes = {
  rays: "光线",
  extended: "延长线",
  images: "成像",
  observer: "观察者",
} as const;
export const colorModes = {
  default: "标准亮度",
  linear: "线性值",
  linearRGB: "线性 RGB",
  reinhard: "Reinhard 色调",
  colorizedIntensity: "强度伪彩",
} as const;

const bytes = (value: unknown) => new TextEncoder().encode(JSON.stringify(value)).length;
const has = (o: object, k: string) => Object.prototype.hasOwnProperty.call(o, k);

function boundedTree(value: unknown, depth = 0): void {
  if (depth > 16) throw Error("数据层级过深。");
  if (typeof value === "number" && (!Number.isFinite(value) || Math.abs(value) > 1e7))
    throw Error("数值需要有限且绝对值不超过 10000000。");
  if (typeof value === "string" && value.length > 20000) throw Error("单项文字超过 20000 字。");
  if (Array.isArray(value)) {
    if (value.length > 20000) throw Error("数组超过 20000 项。");
    value.forEach((v) => boundedTree(v, depth + 1));
  } else if (isRecord(value)) {
    if (Object.keys(value).some((k) => ["__proto__", "constructor", "prototype"].includes(k)))
      throw Error("对象含不支持的属性。");
    Object.values(value).forEach((v) => boundedTree(v, depth + 1));
  }
}
function point(value: unknown): value is { x: number; y: number } {
  return (
    isRecord(value) &&
    typeof value.x === "number" &&
    Number.isFinite(value.x) &&
    typeof value.y === "number" &&
    Number.isFinite(value.y)
  );
}
/** Upstream text fields store numbers as strings (e.g. "cauchyB": "0.01342"); accept both. */
function numeric(value: unknown): boolean {
  if (typeof value === "number") return Number.isFinite(value);
  return typeof value === "string" && value.trim() !== "" && value.length <= 40 && Number.isFinite(Number(value));
}
const POINT_KEYS = new Set(["p1", "p2", "p3", "p4"]);

function checkShape(raw: unknown, defaults: unknown, path: string) {
  if (!isRecord(raw) || !isRecord(defaults)) throw Error(path + " 格式无效。");
  for (const [k, v] of Object.entries(raw)) {
    if (!has(defaults, k)) throw Error(path + " 含不支持的属性 " + k + "。");
    const d = defaults[k];
    if (d === null || v === null) continue;
    if (isRecord(d)) checkShape(v, d, path + "." + k);
    else if (Array.isArray(d)) {
      if (!Array.isArray(v)) throw Error(path + "." + k + " 需要数组。");
    } else if (typeof d === "number") {
      if (!numeric(v)) throw Error(path + "." + k + " 需要数字。");
    } else if (typeof v !== typeof d) throw Error(path + "." + k + " 类型无效。");
  }
}

/** Structural validation of one top-level object against the generated upstream defaults. */
export function objectValue(obj: unknown, label = "元件"): OpticalObject {
  if (!isRecord(obj) || typeof obj.type !== "string" || !has(objectDefaults, obj.type))
    throw Error("场景含不支持的元件类型" + (isRecord(obj) && typeof obj.type === "string" ? " " + obj.type : "") + "；原始输入仍保留。");
  const type = obj.type;
  const defaults = objectDefaults[type as keyof typeof objectDefaults] as Record<string, unknown>;
  const name = label + "（" + (objectNames[type] ?? type) + "）";
  for (const [k, v] of Object.entries(obj)) {
    if (k === "type") continue;
    if (!has(defaults, k)) throw Error(name + "含不支持的属性 " + k + "。");
    const d = defaults[k];
    if (POINT_KEYS.has(k) || (k === "origin" && isRecord(d))) {
      if (!point(v)) throw Error(name + "的点 " + k + " 需要完整坐标。");
    } else if ((k === "x" || k === "y") && d === null) {
      if (!numeric(v)) throw Error(name + "的位置未完成。");
    } else if (k === "path") {
      if (!Array.isArray(v) || v.some((p) => !point(p) || ((p as { arc?: unknown }).arc !== undefined && typeof (p as { arc?: unknown }).arc !== "boolean")))
        throw Error(name + "的轮廓点无效。");
    } else if (d === null) {
      continue; // structured upstream data (params, strokes, styles, module points) bounded by boundedTree
    } else if (isRecord(d)) checkShape(v, d, name + "." + k);
    else if (Array.isArray(d)) {
      if (!Array.isArray(v)) throw Error(name + "." + k + " 需要数组。");
    } else if (typeof d === "number") {
      if (!numeric(v)) throw Error(name + "." + k + " 需要数字。");
    } else if (typeof v !== typeof d) throw Error(name + "." + k + " 类型无效。");
  }
  // Required geometry: every null-default control point (p1..p4, x/y) must be present.
  const required = Object.keys(defaults).filter(
    (k) => defaults[k] === null && (POINT_KEYS.has(k) || k === "x" || k === "y"),
  );
  if (type === "SphericalLens") {
    if (!Array.isArray(obj.path) && !(point(obj.p1) && point(obj.p2) && isRecord(obj.params)))
      throw Error(name + "需要轮廓 path，或端点与 params。");
  } else if (type !== "ModuleObj" && type !== "Handle") {
    for (const k of required) if (obj[k] === undefined) throw Error(name + "缺少控制点 " + k + "。");
  }
  if (["Glass", "GrinGlass"].includes(type) && (!Array.isArray(obj.path) || obj.path.length < 3) && obj.notDone !== true)
    throw Error(name + "至少需要 3 个轮廓点。");
  if (obj.locked !== undefined && !["default", "locked", "unlocked"].includes(String(obj.locked)))
    throw Error(name + "的锁定状态无效。");
  for (const k of ["refIndex", "binSize", "scaleInterval", "lineDensity", "stepSize"])
    if (obj[k] !== undefined && !(Number(obj[k]) > 0)) throw Error(name + "的 " + k + " 必须为正数。");
  if (obj.focalLength !== undefined && Math.abs(Number(obj.focalLength)) < 1e-6)
    throw Error(name + "的焦距不能为 0。");
  if (obj.brightness !== undefined && (Number(obj.brightness) < 0 || Number(obj.brightness) > 100))
    throw Error(name + "的亮度范围为 0–100。");
  if (obj.wavelength !== undefined && (Number(obj.wavelength) < 1 || Number(obj.wavelength) > 100000))
    throw Error(name + "的波长无效。");
  if (type === "ModuleObj" && typeof obj.module !== "string") throw Error(name + "需要模块名称。");
  return obj as OpticalObject;
}

export function sceneValue(source: string): OpticalScene {
  boundedText(source, SCENE_CHARS);
  let raw: unknown;
  try {
    raw = JSON.parse(source);
  } catch (e) {
    throw Error("场景 JSON 语法错误：" + (e instanceof Error ? e.message : String(e)));
  }
  if (!isRecord(raw) || raw.version !== 5 || !Array.isArray(raw.objs))
    throw Error("需要 version 5 的光路场景（旧版本请通过导入升级）。");
  if (raw.objs.length > MAX_OBJECTS) throw Error("场景最多 " + MAX_OBJECTS + " 个元件。");
  boundedTree(raw);
  if (raw.backgroundImage !== undefined)
    throw Error("背景图片场景暂不支持（需要上游画廊图片文件）；原始输入仍保留。");
  for (const k of Object.keys(raw))
    if (k !== "version" && !has(sceneDefaults, k)) throw Error("场景属性 " + k + " 暂不支持；原始输入仍保留。");
  if (raw.mode !== undefined && !has(viewModes, String(raw.mode))) throw Error("视图模式无效。");
  if (raw.colorMode !== undefined && !has(colorModes, String(raw.colorMode))) throw Error("颜色映射无效。");
  for (const [k, v] of Object.entries(raw)) {
    if (["version", "objs", "modules", "theme", "observer", "maxRayDepth", "randomSeed"].includes(k)) continue;
    checkShape({ [k]: v }, sceneDefaults, "场景");
  }
  if (raw.theme !== undefined) checkShape(raw.theme, sceneDefaults.theme, "主题");
  if (raw.modules !== undefined) {
    if (!isRecord(raw.modules)) throw Error("模块定义无效。");
    for (const [name, def] of Object.entries(raw.modules))
      if (!isRecord(def) || !Array.isArray(def.objs) || name.length > 200) throw Error("模块 " + name + " 定义无效。");
  }
  if (raw.observer !== undefined && raw.observer !== null) {
    const o = raw.observer;
    if (!isRecord(o) || !point(o.c) || !(Number(o.r) > 0)) throw Error("观察者需要圆心与正半径。");
  }
  for (const key of ["scale", "lengthScale", "gridSize", "width", "height", "rayModeDensity", "imageModeDensity"])
    if (raw[key] !== undefined && !(Number(raw[key]) > 0)) throw Error(key + " 必须为正数。");
  if (Number(raw.gridSize ?? 20) < 1) throw Error("网格间距至少为 1。");
  if (raw.maxRayDepth !== undefined && raw.maxRayDepth !== null) {
    const n = Number(raw.maxRayDepth);
    if (!Number.isInteger(n) || n < 1 || n > 100000) throw Error("最大交互深度范围为 1–100000。");
  }
  if (raw.randomSeed !== undefined && raw.randomSeed !== null && (typeof raw.randomSeed !== "string" || raw.randomSeed.length > 200))
    throw Error("随机种子无效。");
  if (Number(raw.rayModeDensity ?? 0.1) > 1000 || Number(raw.imageModeDensity ?? 1) > 1000) throw Error("光线密度最多 1000。");
  if (Number(raw.scale ?? 1) < 0.005 || Number(raw.scale ?? 1) > 50) throw Error("视图比例范围为 0.005–50。");
  if (raw.origin !== undefined && !point(raw.origin)) throw Error("视图原点无效。");
  const red = Number(raw.redWavelength ?? 620),
    violet = Number(raw.violetWavelength ?? 420);
  if (!(violet >= 100 && red <= 2000 && red > violet)) throw Error("波长范围无效。");
  raw.objs.forEach((obj, i) => objectValue(obj, "第 " + (i + 1) + " 个元件"));
  return raw as unknown as OpticalScene;
}

const QUALITIES: Quality[] = ["draft", "standard", "fine"];
export function restoreOptics(raw: unknown): Optics {
  if (!isRecord(raw)) throw Error("实验工作稿格式无效。");
  const quality = raw.quality ?? "standard";
  if (!QUALITIES.includes(quality as Quality)) throw Error("质量设置无效。");
  const result: Optics = {
    scene: boundedText(raw.scene, SCENE_CHARS),
    notes: boundedText(raw.notes, 40000),
    original: boundedText(raw.original ?? "", SCENE_CHARS),
    originalName: boundedText(raw.originalName ?? "", 200),
    quality: quality as Quality,
    example: boundedText(raw.example ?? "", 120),
  };
  if (bytes(result) > WORKING_BYTES) throw Error("实验工作稿超过恢复容量。");
  return result;
}
export function validateOptics(raw: unknown): Optics {
  const v = restoreOptics(raw);
  sceneValue(v.scene);
  if (bytes(v) > FORMAL_BYTES) throw Error("实验超过正式保存容量，完整草稿仍保留。");
  return v;
}
export function importOptics(
  raw: unknown,
  name = "导入光路",
): { title: string; data: Optics; extra: Record<string, unknown> } {
  let title = name,
    data: Optics,
    extra: Record<string, unknown> = {};
  if (isRecord(raw) && isRecord(raw.snapshot))
    return importOptics({ format: "ray-optics-workbench", ...raw.snapshot }, name);
  if (isRecord(raw) && raw.format === "ray-optics-workbench") {
    title = boundedText(raw.title, 120);
    data = restoreOptics(raw.data);
    if (raw.extra !== undefined && !isRecord(raw.extra)) throw Error("工作稿附加输入无效。");
    extra = isRecord(raw.extra) ? raw.extra : {};
  } else {
    const source = JSON.stringify(raw, null, 2);
    const scene = sceneValue(source);
    data = {
      scene: source,
      notes: "",
      original: source,
      originalName: name.slice(0, 200),
      quality: "standard",
      example: "",
    };
    title = (typeof scene.name === "string" && scene.name.trim() ? scene.name.trim() : name.replace(/\.json$/i, "")).slice(0, 120) || "导入光路";
  }
  if (bytes({ title, data, extra }) > 1950000) throw Error("导入工作稿超过 1.95 MB。");
  return { title, data, extra };
}

export const seedScene = {
  version: 5,
  name: "凸透镜 · 平行光会聚",
  objs: [
    { type: "Beam", name: "准直光源", p1: { x: 150, y: 210 }, p2: { x: 150, y: 390 }, brightness: 0.7 },
    { type: "IdealLens", name: "凸透镜", p1: { x: 480, y: 170 }, p2: { x: 480, y: 430 }, focalLength: 210 },
    { type: "Detector", name: "焦后探测器", p1: { x: 800, y: 170 }, p2: { x: 800, y: 430 } },
    { type: "Ruler", name: "光轴标尺", p1: { x: 150, y: 485 }, p2: { x: 900, y: 485 }, scaleInterval: 50 },
    { type: "TextLabel", x: 147, y: 150, text: "平行入射", fontSize: 18 },
    { type: "TextLabel", x: 663, y: 150, text: "焦点附近", fontSize: 18 },
  ],
  mode: "rays",
  width: 1100,
  height: 650,
  origin: { x: 20, y: 120 },
  scale: 1,
  showGrid: true,
  gridSize: 25,
  rayModeDensity: 0.08,
  randomSeed: "optics-demo",
  maxRayDepth: 64,
};
export const seed: Optics = {
  scene: JSON.stringify(seedScene, null, 2),
  notes: "拖动凸透镜或改变焦距，观察焦点位置与探测器读数。\n比较焦距 210 与 280 两组条件。",
  original: "",
  originalName: "",
  quality: "standard",
  example: "",
};
