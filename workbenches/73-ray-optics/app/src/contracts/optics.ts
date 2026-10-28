import { boundedText, isRecord } from "./project.ts";
import { sceneDefaults, objectDefaults } from "./native-schema.ts";
export interface OpticalObject {
  type: string;
  name?: string;
  p1?: { x: number; y: number };
  p2?: { x: number; y: number };
  [key: string]: unknown;
}
export interface OpticalScene {
  version: number;
  objs: OpticalObject[];
  [key: string]: unknown;
}
export interface Optics {
  scene: string;
  notes: string;
  original: string;
  originalName: string;
}
export const FORMAL_BYTES = 850000,
  WORKING_BYTES = 2000000,
  MAX_OBJECTS = 100;
export const objectNames: Record<string, string> = {
  SingleRay: "单束光",
  Beam: "平行光",
  Mirror: "平面镜",
  IdealLens: "理想透镜",
  CircleGlass: "圆形玻璃",
  PlaneGlass: "半平面玻璃",
  Blocker: "挡光板",
  Detector: "探测器",
  Ruler: "标尺",
  TextLabel: "文字标注",
};
const bytes = (value: unknown) =>
  new TextEncoder().encode(JSON.stringify(value)).length;
function boundedTree(value: unknown, depth = 0): void {
  if (depth > 14) throw Error("数据层级过深。");
  if (
    typeof value === "number" &&
    (!Number.isFinite(value) || Math.abs(value) > 1000000)
  )
    throw Error("数值需要有限且不超过 1000000。");
  if (typeof value === "string" && value.length > 10000)
    throw Error("单项文字超过 10000 字。");
  if (Array.isArray(value)) {
    if (value.length > 500) throw Error("数组超过 500 项。");
    value.forEach((v) => boundedTree(v, depth + 1));
  } else if (isRecord(value)) {
    if (
      Object.keys(value).some((k) =>
        ["__proto__", "constructor", "prototype"].includes(k),
      )
    )
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
    Number.isFinite(value.y) &&
    Object.keys(value).every((k) => k === "x" || k === "y")
  );
}
function checkShape(raw: unknown, defaults: unknown, path: string) {
  if (!isRecord(raw) || !isRecord(defaults)) throw Error(path + " 格式无效。");
  for (const [k, v] of Object.entries(raw)) {
    if (!Object.hasOwn(defaults, k))
      throw Error(path + " 含不支持的属性 " + k + "。");
    const d = defaults[k];
    if (d === null) continue;
    if (isRecord(d)) {
      checkShape(v, d, path + "." + k);
    } else if (Array.isArray(d)) {
      if (
        !Array.isArray(v) ||
        v.length > 20 ||
        v.some(
          (n) =>
            typeof n !== "number" || !Number.isFinite(n) || n < 0 || n > 100,
        )
      )
        throw Error(path + "." + k + " 需要最多20个非负有限数字。");
    } else if (typeof v !== typeof d)
      throw Error(path + "." + k + " 类型无效。");
  }
}
export function sceneValue(source: string): OpticalScene {
  boundedText(source, 550000);
  const raw: unknown = JSON.parse(source);
  if (
    !isRecord(raw) ||
    raw.version !== 5 ||
    !Array.isArray(raw.objs) ||
    raw.objs.length > MAX_OBJECTS
  )
    throw Error("需要 version 5 的光路场景，最多 100 个元件。");
  boundedTree(raw);
  for (const k of Object.keys(raw)) {
    if (k !== "version" && !Object.hasOwn(sceneDefaults, k))
      throw Error("场景属性 " + k + " 暂不支持；原始输入仍保留。");
  }
  if (
    raw.modules !== undefined &&
    (!isRecord(raw.modules) || Object.keys(raw.modules).length)
  )
    throw Error("模块场景暂不支持。");
  if (
    raw.mode !== undefined &&
    !["rays", "extended"].includes(String(raw.mode))
  )
    throw Error("目前支持 rays / extended 光路模式。");
  if (raw.colorMode !== undefined && raw.colorMode !== "default")
    throw Error("目前支持标准颜色模式。");
  if (raw.observer != null) throw Error("观察者模式暂不支持。");
  for (const [k, v] of Object.entries(raw)) {
    if (k !== "version" && k !== "objs" && k !== "modules" && k !== "theme")
      checkShape({ [k]: v }, sceneDefaults, "场景");
  }
  if (raw.theme !== undefined)
    checkShape(raw.theme, sceneDefaults.theme, "主题");
  for (const key of [
    "scale",
    "lengthScale",
    "gridSize",
    "width",
    "height",
    "rayModeDensity",
  ])
    if (
      raw[key] !== undefined &&
      (typeof raw[key] !== "number" || Number(raw[key]) <= 0)
    )
      throw Error(key + " 必须为正数。");
  if (Number(raw.gridSize ?? 20) < 5) throw Error("网格间距至少为 5。");
  if (
    raw.maxRayDepth !== undefined &&
    raw.maxRayDepth !== null &&
    (!Number.isInteger(raw.maxRayDepth) ||
      Number(raw.maxRayDepth) < 1 ||
      Number(raw.maxRayDepth) > 10000)
  )
    throw Error("最大交互深度范围为 1–10000。");
  if (
    raw.randomSeed !== undefined &&
    raw.randomSeed !== null &&
    (typeof raw.randomSeed !== "string" || raw.randomSeed.length > 200)
  )
    throw Error("随机种子无效。");
  if (Number(raw.rayModeDensity ?? 0.1) > 1) throw Error("光线密度最多 1。");
  if (Number(raw.scale ?? 1) < 0.05 || Number(raw.scale ?? 1) > 8)
    throw Error("视图比例范围为 0.05–8。");
  if (raw.origin !== undefined && !point(raw.origin))
    throw Error("视图原点无效。");
  for (const obj of raw.objs) {
    if (
      !isRecord(obj) ||
      typeof obj.type !== "string" ||
      !Object.hasOwn(objectNames, obj.type)
    )
      throw Error("场景含不支持的元件；原始输入仍保留。");
    const defaults = objectDefaults[obj.type as keyof typeof objectDefaults];
    const props = { ...obj };
    delete props.type;
    checkShape(props, defaults, obj.type);
    if (
      obj.locked !== undefined &&
      !["default", "locked", "unlocked"].includes(String(obj.locked))
    )
      throw Error("元件锁定状态无效。");
    if (obj.type === "TextLabel") {
      if (typeof obj.x !== "number" || typeof obj.y !== "number")
        throw Error("文字位置未完成。");
      if (
        obj.fontSize !== undefined &&
        (Number(obj.fontSize) < 6 || Number(obj.fontSize) > 120)
      )
        throw Error("文字大小范围为 6–120。");
      if (
        obj.fillStyle !== undefined &&
        obj.fillStyle !== null &&
        typeof obj.fillStyle !== "string"
      )
        throw Error("文字颜色无效。");
    } else {
      if (!point(obj.p1) || !point(obj.p2))
        throw Error("元件的两个端点需要完整坐标。");
      if (obj.p1.x === obj.p2.x && obj.p1.y === obj.p2.y)
        throw Error("元件两个端点不能重合。");
    }
    for (const k of ["refIndex", "binSize", "scaleInterval"])
      if (
        obj[k] !== undefined &&
        (typeof obj[k] !== "number" || Number(obj[k]) <= 0)
      )
        throw Error(k + " 必须为正数。");
    if (obj.focalLength !== undefined && Math.abs(Number(obj.focalLength)) < 1)
      throw Error("焦距绝对值不能小于 1。");
    if (
      obj.brightness !== undefined &&
      (Number(obj.brightness) < 0 || Number(obj.brightness) > 1)
    )
      throw Error("亮度范围为 0–1。");
    if (obj.irradMap === true) throw Error("探测器空间直方图暂未开放。");
  }
  return raw as unknown as OpticalScene;
}
export function restoreOptics(raw: unknown): Optics {
  if (!isRecord(raw)) throw Error("实验工作稿格式无效。");
  const result = {
    scene: boundedText(raw.scene, 550000),
    notes: boundedText(raw.notes, 40000),
    original: boundedText(raw.original ?? "", 550000),
    originalName: boundedText(raw.originalName ?? "", 200),
  };
  if (bytes(result) > WORKING_BYTES) throw Error("实验工作稿超过恢复容量。");
  return result;
}
export function validateOptics(raw: unknown): Optics {
  const v = restoreOptics(raw);
  sceneValue(v.scene);
  if (bytes(v) > FORMAL_BYTES)
    throw Error("实验超过正式保存容量，完整草稿仍保留。");
  return v;
}
export function importOptics(
  raw: unknown,
  name = "导入光路",
): { title: string; data: Optics; extra: Record<string, unknown> } {
  let title = name,
    data: Optics,
    extra: Record<string, unknown> = {};
  if (isRecord(raw) && isRecord(raw.snapshot)) {
    return importOptics(
      { format: "ray-optics-workbench", ...raw.snapshot },
      name,
    );
  }
  if (isRecord(raw) && raw.format === "ray-optics-workbench") {
    title = boundedText(raw.title, 120);
    data = restoreOptics(raw.data);
    if (raw.extra !== undefined && !isRecord(raw.extra))
      throw Error("工作稿附加输入无效。");
    extra = isRecord(raw.extra) ? raw.extra : {};
  } else {
    const source = JSON.stringify(raw, null, 2);
    sceneValue(source);
    data = {
      scene: source,
      notes: "",
      original: source,
      originalName: name.slice(0, 200),
    };
    title = name.slice(0, 120);
  }
  if (bytes({ title, data, extra }) > 1950000)
    throw Error("导入工作稿超过 1.95 MB。");
  return { title, data, extra };
}
export const seed: Optics = {
  scene: JSON.stringify(
    {
      version: 5,
      name: "凸透镜 · 平行光会聚",
      objs: [
        {
          type: "Beam",
          name: "准直光源",
          p1: { x: 150, y: 210 },
          p2: { x: 150, y: 390 },
          brightness: 0.7,
        },
        {
          type: "IdealLens",
          name: "凸透镜",
          p1: { x: 480, y: 170 },
          p2: { x: 480, y: 430 },
          focalLength: 210,
        },
        {
          type: "Detector",
          name: "焦后探测器",
          p1: { x: 800, y: 170 },
          p2: { x: 800, y: 430 },
        },
        {
          type: "Ruler",
          name: "光轴标尺",
          p1: { x: 150, y: 485 },
          p2: { x: 900, y: 485 },
          scaleInterval: 50,
        },
        { type: "TextLabel", x: 147, y: 150, text: "平行入射", fontSize: 18 },
        { type: "TextLabel", x: 663, y: 150, text: "焦点附近", fontSize: 18 },
      ],
      mode: "rays",
      width: 1100,
      height: 650,
      showGrid: true,
      gridSize: 25,
      rayModeDensity: 0.08,
      randomSeed: "optics-demo",
      maxRayDepth: 64,
    },
    null,
    2,
  ),
  notes:
    "调整凸透镜焦距，观察焦点位置与探测器读数。\n比较 210 与 280 的两组条件。",
  original: "",
  originalName: "",
};
export function makeObject(type: string, index: number): OpticalObject {
  if (!Object.hasOwn(objectNames, type)) throw Error("元件类型无效。");
  const x = 230 + (index % 5) * 90,
    y = 220 + (index % 3) * 70;
  if (type === "TextLabel")
    return { type, name: "实验标注", x, y, text: "新标注", fontSize: 18 };
  return {
    type,
    name: objectNames[type] + " " + (index + 1),
    p1: { x, y: y + (type === "Beam" ? -65 : 65) },
    p2: {
      x: x + (type === "Ruler" ? 170 : 0),
      y: y + (type === "Beam" ? 65 : -65),
    },
    ...(type === "IdealLens" ? { focalLength: 180 } : {}),
    ...(type === "Beam" ? { brightness: 0.5 } : {}),
    ...(type === "SingleRay" ? { p2: { x: x + 120, y: y + 65 } } : {}),
  };
}
