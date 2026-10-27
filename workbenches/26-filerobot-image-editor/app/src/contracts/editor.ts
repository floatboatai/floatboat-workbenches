import { isRecord, boundedText } from "./project.ts";
export const MAX_IMAGE_BYTES = 1_000_000;
export const MAX_PIXELS = 16_000_000;
export type Design = Record<string, unknown>;
export interface Source {
  id: string;
  name: string;
  mime: "image/png" | "image/jpeg";
  width: number;
  height: number;
  bytes: number;
}
export interface PhotoProject {
  version: 1;
  source: Source | null;
  design: Design;
  notes: string;
}
export const seed: PhotoProject = {
  version: 1,
  source: null,
  design: {},
  notes: "",
};
const keys = new Set([
  "finetunes",
  "finetunesProps",
  "filter",
  "adjustments",
  "annotationIds",
  "annotations",
  "resize",
  "shownImageDimensions",
]);
const annotations = new Set([
  "Text",
  "Rect",
  "Ellipse",
  "Polygon",
  "Pen",
  "Line",
  "Arrow",
]);
export function dimensions(width: unknown, height: unknown) {
  if (
    typeof width !== "number" ||
    typeof height !== "number" ||
    !Number.isFinite(width) ||
    !Number.isFinite(height) ||
    width < 1 ||
    height < 1 ||
    width > 8000 ||
    height > 8000 ||
    width * height > MAX_PIXELS
  )
    throw new Error("图片尺寸需在 1–8000 像素内，且不超过 1600 万像素。");
}
export function sourceValue(raw: unknown): Source {
  if (
    !isRecord(raw) ||
    typeof raw.id !== "string" ||
    !/^([a-f0-9]{64})$/.test(raw.id) ||
    typeof raw.mime !== "string" ||
    !["image/png", "image/jpeg"].includes(raw.mime) ||
    typeof raw.bytes !== "number" ||
    !Number.isInteger(raw.bytes) ||
    raw.bytes < 24 ||
    raw.bytes > MAX_IMAGE_BYTES
  )
    throw new Error("原图信息无效，请重新导入 PNG 或 JPEG。");
  dimensions(raw.width, raw.height);
  return {
    id: raw.id,
    name: boundedText(raw.name, 160),
    mime: raw.mime as Source["mime"],
    width: raw.width as number,
    height: raw.height as number,
    bytes: raw.bytes,
  };
}
function jsonValue(value: unknown, depth = 0): unknown {
  if (depth > 12) throw new Error("编辑状态层级过深。");
  if (value === null || typeof value === "boolean") return value;
  if (
    typeof value === "number" &&
    Number.isFinite(value) &&
    Math.abs(value) <= 1e7
  )
    return value;
  if (typeof value === "string" && value.length <= 20000) return value;
  if (Array.isArray(value) && value.length <= 20000)
    return value.map((v) => jsonValue(v, depth + 1));
  if (isRecord(value)) {
    const out: Design = {};
    for (const [key, v] of Object.entries(value)) {
      if (
        [
          "__proto__",
          "constructor",
          "prototype",
          "image",
          "imgSrc",
          "src",
          "href",
          "url",
        ].includes(key)
      )
        throw new Error("工程含有不支持的图片引用或属性。");
      out[key] = jsonValue(v, depth + 1);
    }
    return out;
  }
  throw new Error("编辑状态格式无效。");
}
export function designValue(raw: unknown, draft = false): Design {
  if (
    !isRecord(raw) ||
    new TextEncoder().encode(JSON.stringify(raw)).length > 400000
  )
    throw new Error("编辑状态超过 400 KB 或格式无效。");
  const design: Design = {};
  for (const [key, value] of Object.entries(raw)) {
    if (!keys.has(key)) throw new Error("工程包含不支持的编辑属性：" + key);
    design[key] = jsonValue(value);
  }
  if (design.annotations !== undefined) {
    if (
      !isRecord(design.annotations) ||
      Object.keys(design.annotations).length > 150
    )
      throw new Error("最多支持 150 个标注。");
    for (const a of Object.values(design.annotations)) {
      if (
        !isRecord(a) ||
        typeof a.name !== "string" ||
        !annotations.has(a.name) ||
        typeof a.id !== "string" ||
        typeof a.x !== "number" ||
        typeof a.y !== "number"
      )
        throw new Error("标注格式无效，仅支持文字和形状。");
    }
  }
  if (isRecord(design.annotations))
    for (const a of Object.values(design.annotations)) {
      if (!isRecord(a)) continue;
      for (const key of [
        "width",
        "height",
        "radius",
        "radiusX",
        "radiusY",
        "scaleX",
        "scaleY",
        "rotation",
        "fontSize",
        "strokeWidth",
        "shadowBlur",
        "opacity",
      ])
        if (
          a[key] !== undefined &&
          (typeof a[key] !== "number" || !Number.isFinite(a[key]))
        )
          throw new Error("标注数值无效。");
      for (const key of ["text", "tmpText"])
        if (a[key] !== undefined) {
          const t = a[key];
          if (
            typeof t !== "string" &&
            (!Array.isArray(t) ||
              t.length > 1000 ||
              t.some(
                (part) =>
                  !isRecord(part) ||
                  typeof part.textContent !== "string" ||
                  (part.style !== undefined && !isRecord(part.style)),
              ))
          )
            throw new Error("标注文字格式无效。");
        }
      if (
        a.points !== undefined &&
        (!Array.isArray(a.points) ||
          a.points.some((v) => typeof v !== "number"))
      )
        throw new Error("画笔坐标无效。");
    }
  if (
    design.finetunes !== undefined &&
    (!Array.isArray(design.finetunes) ||
      design.finetunes.some(
        (v) =>
          typeof v !== "string" ||
          !["Brighten", "Contrast", "HSV", "Blur", "Warmth"].includes(v),
      ))
  )
    throw new Error("不支持的调色参数。");
  if (
    design.filter !== undefined &&
    design.filter !== null &&
    (typeof design.filter !== "string" ||
      ![
        "Invert",
        "BlackAndWhite",
        "Sepia",
        "Solarize",
        "Clarendon",
        "Gingham",
        "Moon",
        "Lark",
        "Reyes",
        "Juno",
        "Slumber",
        "Crema",
        "Ludwig",
        "Aden",
        "Perpetua",
        "Amaro",
        "Mayfair",
        "Rise",
        "Hudson",
        "Valencia",
        "XPro2",
        "Sierra",
        "Willow",
        "LoFi",
        "Grayscale",
        "Hefe",
        "Nashville",
        "Stinson",
        "Vesper",
        "Earlybird",
        "Brannan",
        "Sutro",
        "Toaster",
        "Walden",
        "NinteenSeventySeven",
        "Kelvin",
        "Maven",
        "Ginza",
        "Skyline",
        "Dogpatch",
        "Brooklyn",
        "Helena",
        "Ashby",
        "Charmes",
      ].includes(design.filter))
  )
    throw new Error("滤镜名称无效。");
  for (const key of [
    "adjustments",
    "resize",
    "finetunesProps",
    "shownImageDimensions",
  ])
    if (design[key] !== undefined && !isRecord(design[key]))
      throw new Error("编辑参数必须是对象。");
  if (isRecord(design.resize)) {
    const { width, height } = design.resize;
    if (!draft && (width !== undefined || height !== undefined))
      dimensions(width, height);
    else if (draft)
      for (const v of [width, height])
        if (
          v !== undefined &&
          v !== "" &&
          (typeof v !== "number" || !Number.isFinite(v) || v < 0 || v > 80000)
        )
          throw new Error("尺寸草稿无效。");
  }
  if (
    isRecord(design.adjustments) &&
    (!isRecord(design.adjustments.crop) ||
      ["rotation"].some(
        (key) =>
          design.adjustments &&
          isRecord(design.adjustments) &&
          design.adjustments[key] !== undefined &&
          (typeof design.adjustments[key] !== "number" ||
            Math.abs(Number(design.adjustments[key])) > 360),
      ))
  )
    throw new Error("裁剪或旋转参数无效。");
  if (isRecord(design.adjustments) && isRecord(design.adjustments.crop)) {
    const crop = design.adjustments.crop;
    for (const key of ["width", "height", "x", "y"])
      if (
        crop[key] !== undefined &&
        crop[key] !== null &&
        (typeof crop[key] !== "number" || Math.abs(Number(crop[key])) > 80000)
      )
        throw new Error("裁剪参数无效。");
  }
  if (isRecord(design.finetunesProps))
    for (const [key, value] of Object.entries(design.finetunesProps)) {
      const limits: Record<string, number> = {
        brightness: 1,
        contrast: 100,
        hue: 360,
        saturation: 10,
        value: 2,
        blurRadius: 100,
        warmth: 200,
      };
      if (
        !(key in limits) ||
        typeof value !== "number" ||
        Math.abs(value) > limits[key]
      )
        throw new Error("调色数值超出范围。");
    }
  if (
    design.annotationIds !== undefined &&
    (!Array.isArray(design.annotationIds) ||
      design.annotationIds.some(
        (id) =>
          typeof id !== "string" ||
          !isRecord(design.annotations) ||
          !design.annotations[id],
      ))
  )
    throw new Error("标注顺序无效。");
  return design;
}
export function restoreProject(raw: unknown): PhotoProject {
  if (!isRecord(raw) || raw.version !== 1)
    throw new Error("这不是受支持的图片工程。");
  return {
    version: 1,
    source: raw.source === null ? null : sourceValue(raw.source),
    design: designValue(raw.design, true),
    notes: boundedText(raw.notes, 20000),
  };
}
export function validateProject(raw: unknown): PhotoProject {
  const p = restoreProject(raw);
  p.design = designValue(p.design);
  return p;
}
export function serializeDesign(
  raw: unknown,
  resolve?: (value: unknown, kind: string) => unknown,
): Design {
  if (!isRecord(raw)) throw new Error("编辑器状态无效。");
  const next: Design = {};
  for (const key of keys) if (raw[key] !== undefined) next[key] = raw[key];
  const name = (value: unknown, kind: string): unknown =>
    resolve
      ? resolve(value, kind)
      : typeof value === "function"
        ? Reflect.get(value, kind) || value.name
        : value;
  if (Array.isArray(raw.finetunes))
    next.finetunes = raw.finetunes.map((v) => name(v, "finetuneName"));
  if (raw.filter) next.filter = name(raw.filter, "filterName");
  return designValue(JSON.parse(JSON.stringify(next)), true);
}
export function portableValue(raw: unknown): {
  title: string;
  project: PhotoProject;
  original: string;
  draft: Record<string, unknown>;
} {
  if (
    !isRecord(raw) ||
    raw.format !== "filerobot-workbench" ||
    raw.version !== 1 ||
    typeof raw.original !== "string" ||
    raw.original.length > 1_333_336 ||
    !isRecord(raw.draft) ||
    JSON.stringify(raw.draft).length > 100000
  )
    throw new Error("请选择有效的便携图片工程。");
  return {
    title: boundedText(raw.title, 120),
    project: restoreProject(raw.project),
    original: raw.original,
    draft: editorDraftValue(raw.draft),
  };
}

export function editorDraftValue(raw: unknown): Record<string, unknown> {
  if (
    !isRecord(raw) ||
    new TextEncoder().encode(JSON.stringify(raw)).length > 100000
  )
    throw new Error("工具输入草稿无效或过大。");
  const out: Record<string, unknown> = {};
  if (raw.nativeAnnotation !== undefined && raw.nativeAnnotation !== null) {
    const a = raw.nativeAnnotation;
    if (!isRecord(a) || typeof a.id !== "string")
      throw new Error("文字草稿无效。");
    const d = designValue({ annotations: { [a.id]: a } }, true);
    out.nativeAnnotation = (d.annotations as Record<string, unknown>)[a.id];
  }
  if (raw.nativeInputs !== undefined) {
    if (
      !isRecord(raw.nativeInputs) ||
      Object.keys(raw.nativeInputs).length > 100
    )
      throw new Error("工具输入过多。");
    const fields: Record<string, string> = {};
    for (const [key, value] of Object.entries(raw.nativeInputs)) {
      if (
        key.length > 120 ||
        ["__proto__", "constructor", "prototype"].includes(key)
      )
        throw new Error("工具输入名称无效。");
      fields[key] = boundedText(value, 20000);
    }
    out.nativeInputs = fields;
  }
  if (raw.nativeInput !== undefined) {
    if (!isRecord(raw.nativeInput)) throw new Error("工具输入格式无效。");
    out.nativeInput = {
      name: boundedText(raw.nativeInput.name, 120),
      value: boundedText(raw.nativeInput.value, 20000),
    };
  }
  if (raw.editorTab !== undefined) {
    if (
      typeof raw.editorTab !== "string" ||
      !["Adjust", "Finetune", "Filters", "Annotate", "Resize"].includes(
        raw.editorTab,
      )
    )
      throw new Error("工具页无效。");
    out.editorTab = raw.editorTab;
  }
  return out;
}
