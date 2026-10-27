import { isRecord } from "./project.ts";
export type Template = "panel" | "perforated" | "frame";
export interface Drawing {
  template: Template;
  width: number;
  height: number;
  radius: number;
  diameter: number;
  inset: number;
  columns: number;
  rows: number;
  pitchX: number;
  pitchY: number;
  wall: number;
}
export const seed: Drawing = {
  template: "panel",
  width: 160,
  height: 100,
  radius: 6,
  diameter: 6,
  inset: 15,
  columns: 5,
  rows: 3,
  pitchX: 25,
  pitchY: 25,
  wall: 10,
};
export function validateDrawing(value: unknown): Drawing {
  if (
    !isRecord(value) ||
    !["panel", "perforated", "frame"].includes(String(value.template))
  )
    throw new Error("请选择面板、孔板或框形刀模。");
  const number = (name: string, min: number, max: number, integer = false) => {
    const n = value[name];
    if (
      typeof n !== "number" ||
      !Number.isFinite(n) ||
      n < min ||
      n > max ||
      (integer && !Number.isInteger(n))
    )
      throw new Error(
        `${name} 必须为 ${min}–${max}${integer ? " 的整数" : " mm"}。`,
      );
    return n;
  };
  const d: Drawing = {
    template: value.template as Template,
    width: number("width", 20, 1000),
    height: number("height", 20, 1000),
    radius: number("radius", 0, 250),
    diameter: number("diameter", 1, 100),
    inset: number("inset", 1, 400),
    columns: number("columns", 1, 12, true),
    rows: number("rows", 1, 12, true),
    pitchX: number("pitchX", 2, 400),
    pitchY: number("pitchY", 2, 400),
    wall: number("wall", 1, 400),
  };
  if (d.radius >= Math.min(d.width, d.height) / 2)
    throw new Error("圆角半径须小于短边的一半。");
  if (d.template === "frame") {
    if (d.wall * 2 >= Math.min(d.width, d.height) - 2)
      throw new Error("框宽过大，内部开口须至少保留 2 mm。");
  } else {
    const clearance = d.radius + d.diameter / 2 + 1;
    if (d.template === "panel") {
      if (d.inset < clearance)
        throw new Error("孔中心距边须至少为圆角半径 + 半孔径 + 1 mm。");
      if (
        d.width - 2 * d.inset < d.diameter + 1 ||
        d.height - 2 * d.inset < d.diameter + 1
      )
        throw new Error("安装孔相交或超出板材，请减小孔径或距边。");
    } else {
      if (
        (d.columns > 1 && d.pitchX < d.diameter + 1) ||
        (d.rows > 1 && d.pitchY < d.diameter + 1)
      )
        throw new Error("孔间须至少留 1 mm，请增大孔距。");
      if (
        (d.width - (d.columns - 1) * d.pitchX) / 2 < clearance ||
        (d.height - (d.rows - 1) * d.pitchY) / 2 < clearance
      )
        throw new Error("孔阵列超出安全边距，请减少行列或孔距。");
    }
  }
  return d;
}
export interface DrawingResult {
  svg: string;
  dxf: string;
  width: number;
  height: number;
  holes: number;
  cutLength: number;
}
export function decodeResult(value: unknown): DrawingResult {
  if (
    !isRecord(value) ||
    typeof value.svg !== "string" ||
    typeof value.dxf !== "string" ||
    !["width", "height", "holes", "cutLength"].every(
      (key) => typeof value[key] === "number" && Number.isFinite(value[key]),
    )
  )
    throw new Error("几何响应无效。");
  return {
    svg: value.svg,
    dxf: value.dxf,
    width: Number(value.width),
    height: Number(value.height),
    holes: Number(value.holes),
    cutLength: Number(value.cutLength),
  };
}
export function importProject(value: unknown) {
  if (
    !isRecord(value) ||
    value.schemaVersion !== 1 ||
    typeof value.title !== "string" ||
    !value.title.trim() ||
    value.title.trim().length > 120
  )
    throw new Error("项目 JSON 需要 schemaVersion:1、项目名称和 parameters。");
  return { title: value.title.trim(), data: validateDrawing(value.parameters) };
}

export function restoreDrawingDraft(value: unknown): Drawing {
  if (
    !isRecord(value) ||
    !["panel", "perforated", "frame"].includes(String(value.template))
  )
    throw new Error("图纸草稿格式无效。");
  const keys = [
    "width",
    "height",
    "radius",
    "diameter",
    "inset",
    "columns",
    "rows",
    "pitchX",
    "pitchY",
    "wall",
  ] as const;
  const draft = { ...seed, template: value.template as Template };
  for (const key of keys) {
    const n = value[key];
    if (typeof n !== "number" || !Number.isFinite(n) || Math.abs(n) > 1000000)
      throw new Error("草稿尺寸格式无效。");
    draft[key] = n;
  }
  return draft;
}
