import { isRecord, boundedText } from "./project.ts";
export type Design = { file: string; notes: string };
export type Layer = {
  id: string;
  name: string;
  type: string;
  x: number;
  y: number;
  width: number;
  height: number;
  text: string;
  color: string;
  visible: boolean;
  depth: number;
  absoluteX: number;
  absoluteY: number;
};
export type View = {
  svg: string;
  layers: Layer[];
  pages: { id: string; name: string }[];
  pageId: string;
  width: number;
  height: number;
  offsetX: number;
  offsetY: number;
};
export function designValue(raw: unknown): Design {
  if (!isRecord(raw)) throw new Error("设计文件格式无效。");
  const file = boundedText(raw.file, 800000);
  if (file && (!/^[A-Za-z0-9+/]+={0,2}$/.test(file) || file.length % 4 !== 0))
    throw new Error("FIG编码无效。");
  return { file, notes: boundedText(raw.notes, 12000) };
}
export function viewValue(raw: unknown): View {
  if (
    !isRecord(raw) ||
    typeof raw.svg !== "string" ||
    !Array.isArray(raw.layers) ||
    !Array.isArray(raw.pages) ||
    typeof raw.pageId !== "string"
  )
    throw new Error("图层响应无效。");
  for (const key of ["width", "height", "offsetX", "offsetY"])
    if (typeof raw[key] !== "number" || !Number.isFinite(raw[key]))
      throw new Error("画板尺寸无效。");
  const layers = raw.layers.map((x) => {
    if (!isRecord(x)) throw new Error("图层无效。");
    for (const key of [
      "x",
      "y",
      "width",
      "height",
      "depth",
      "absoluteX",
      "absoluteY",
    ])
      if (typeof x[key] !== "number" || !Number.isFinite(x[key]))
        throw new Error("图层坐标无效。");
    return {
      id: boundedText(x.id, 150),
      name: boundedText(x.name, 1000),
      type: boundedText(x.type, 80),
      text: boundedText(x.text, 12000),
      color: boundedText(x.color, 20),
      visible: x.visible === true,
      x: Number(x.x),
      y: Number(x.y),
      width: Number(x.width),
      height: Number(x.height),
      depth: Number(x.depth),
      absoluteX: Number(x.absoluteX),
      absoluteY: Number(x.absoluteY),
    };
  });
  return {
    svg: boundedText(raw.svg, 2500000),
    layers,
    pages: raw.pages.map((x) => {
      if (!isRecord(x)) throw new Error("页面无效。");
      return { id: boundedText(x.id, 150), name: boundedText(x.name, 1000) };
    }),
    pageId: raw.pageId,
    width: Number(raw.width),
    height: Number(raw.height),
    offsetX: Number(raw.offsetX),
    offsetY: Number(raw.offsetY),
  };
}
export function numeric(value: unknown, min = -100000, max = 100000): number {
  if (typeof value !== "string" && typeof value !== "number")
    throw new Error("请输入有效数字。");
  if (String(value).trim() === "") throw new Error("请输入完整坐标和尺寸。");
  const n = Number(value);
  if (!Number.isFinite(n) || n < min || n > max)
    throw new Error(`数值应在${min}到${max}之间。`);
  return n;
}
export function propertyValue(value: unknown) {
  if (!isRecord(value)) throw new Error("属性格式无效。");
  const color = boundedText(value.color, 20);
  if (!/^#[0-9a-f]{6}$/i.test(color))
    throw new Error("填色应为六位十六进制颜色。");
  return {
    name: boundedText(value.name, 1000),
    x: numeric(value.x),
    y: numeric(value.y),
    width: numeric(value.width, 1, 10000),
    height: numeric(value.height, 1, 10000),
    text: boundedText(value.text, 12000),
    color,
    visible: value.visible !== false,
  };
}
