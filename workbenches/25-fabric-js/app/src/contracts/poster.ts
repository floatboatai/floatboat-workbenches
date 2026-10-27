import { isRecord } from "./project.ts";

export const MAX_OBJECTS = 160;
export const FONTS = ["Arial", "Georgia", "Courier New"] as const;
export type Font = (typeof FONTS)[number];
export interface PosterObject {
  id: string;
  type: "text" | "rect" | "ellipse";
  x: number;
  y: number;
  width: number;
  height: number;
  scaleX: number;
  scaleY: number;
  angle: number;
  opacity: number;
  fill: string;
  stroke: string;
  strokeWidth: number;
  text: string;
  fontSize: number;
  fontFamily: Font;
  fontWeight: "normal" | "bold";
  textAlign: "left" | "center" | "right";
  radius: number;
}
export interface Poster {
  schemaVersion: 1;
  width: number;
  height: number;
  background: string;
  objects: PosterObject[];
}
function number(
  value: unknown,
  min: number,
  max: number,
  label: string,
): number {
  if (
    typeof value !== "number" ||
    !Number.isFinite(value) ||
    value < min ||
    value > max
  )
    throw new Error(`${label}需要 ${min}–${max} 之间的数值。`);
  return value;
}
function enumValue<T extends string>(
  v: unknown,
  allowed: readonly T[],
  label: string,
): T {
  if (typeof v !== "string" || !allowed.includes(v as T))
    throw new Error(`${label}无效。`);
  return v as T;
}
export function color(value: unknown): string {
  if (typeof value !== "string" || !/^#[0-9a-fA-F]{6}$/.test(value))
    throw new Error("颜色需要六位十六进制值，例如 #254b39。");
  return value.toLowerCase();
}
function keys(value: Record<string, unknown>, allowed: string[]) {
  if (Object.keys(value).some((key) => !allowed.includes(key)))
    throw new Error("项目包含不支持的字段，请使用本工作台导出的项目。");
}
export function validateObject(value: unknown): PosterObject {
  if (!isRecord(value)) throw new Error("对象格式无效。");
  keys(value, [
    "id",
    "type",
    "x",
    "y",
    "width",
    "height",
    "scaleX",
    "scaleY",
    "angle",
    "opacity",
    "fill",
    "stroke",
    "strokeWidth",
    "text",
    "fontSize",
    "fontFamily",
    "fontWeight",
    "textAlign",
    "radius",
  ]);
  if (typeof value.id !== "string" || !/^[a-zA-Z0-9_-]{1,64}$/.test(value.id))
    throw new Error("对象标识无效。");
  if (
    typeof value.text !== "string" ||
    value.text.length > 8000 ||
    /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(value.text)
  )
    throw new Error("文字最多 8000 字，且不能包含控制字符。");
  const result: PosterObject = {
    id: value.id,
    type: enumValue(value.type, ["text", "rect", "ellipse"], "对象类型"),
    x: number(value.x, -16384, 16384, "X"),
    y: number(value.y, -16384, 16384, "Y"),
    width: number(value.width, 1, 8192, "宽度"),
    height: number(value.height, 1, 8192, "高度"),
    scaleX: number(value.scaleX, 0.01, 20, "水平缩放"),
    scaleY: number(value.scaleY, 0.01, 20, "垂直缩放"),
    angle: number(value.angle, -360, 360, "角度"),
    opacity: number(value.opacity, 0, 1, "不透明度"),
    fill: color(value.fill),
    stroke: color(value.stroke),
    strokeWidth: number(value.strokeWidth, 0, 80, "描边"),
    text: value.text,
    fontSize: number(value.fontSize, 8, 240, "字号"),
    fontFamily: enumValue(value.fontFamily, FONTS, "字体"),
    fontWeight: enumValue(value.fontWeight, ["normal", "bold"], "字重"),
    textAlign: enumValue(value.textAlign, ["left", "center", "right"], "对齐"),
    radius: number(value.radius, 0, 1000, "圆角"),
  };
  if (
    result.width * result.scaleX > 16384 ||
    result.height * result.scaleY > 16384
  )
    throw new Error("对象缩放后的尺寸不能超过 16384 像素。");
  if (result.type === "text") {
    const columns = Math.max(
      1,
      Math.floor(result.width / (result.fontSize * 1.4)),
    );
    const lines = result.text
      .split("\n")
      .reduce(
        (count, line) =>
          count + Math.max(1, Math.ceil([...line].length / columns)),
        0,
      );
    if (lines * result.fontSize * 1.4 > 8192)
      throw new Error("文字排版过高，请减少文字或增大文字框宽度。");
  }
  return result;
}
export function validatePoster(value: unknown): Poster {
  if (
    !isRecord(value) ||
    value.schemaVersion !== 1 ||
    !Array.isArray(value.objects) ||
    value.objects.length > MAX_OBJECTS
  )
    throw new Error("项目格式无效；最多支持 160 个对象。");
  keys(value, ["schemaVersion", "width", "height", "background", "objects"]);
  const width = number(value.width, 128, 4096, "画板宽度"),
    height = number(value.height, 128, 4096, "画板高度");
  if (
    !Number.isInteger(width) ||
    !Number.isInteger(height) ||
    width * height > 12_000_000
  )
    throw new Error("画板尺寸必须是整数，总面积最多 1200 万像素。");
  const objects = value.objects.map(validateObject);
  if (new Set(objects.map((object) => object.id)).size !== objects.length)
    throw new Error("项目含有重复对象标识。");
  const result: Poster = {
    schemaVersion: 1,
    width,
    height,
    background: color(value.background),
    objects,
  };
  if (new TextEncoder().encode(JSON.stringify(result)).length > 500_000)
    throw new Error("项目内容不能超过 500 KB。");
  return result;
}
export function object(
  type: PosterObject["type"],
  changes: Partial<PosterObject> = {},
): PosterObject {
  return {
    id: crypto.randomUUID(),
    type,
    x: 72,
    y: 72,
    width: 280,
    height: 160,
    scaleX: 1,
    scaleY: 1,
    angle: 0,
    opacity: 1,
    fill: "#244b39",
    stroke: "#244b39",
    strokeWidth: 0,
    text: type === "text" ? "双击编辑文字" : "",
    fontSize: 48,
    fontFamily: "Arial",
    fontWeight: "normal",
    textAlign: "left",
    radius: 0,
    ...changes,
  };
}
export const templates = [
  {
    id: "market",
    name: "周末植物市集",
    description: "800 × 1000 · 活动海报",
    create: (): Poster => ({
      schemaVersion: 1,
      width: 800,
      height: 1000,
      background: "#f1edcf",
      objects: [
        object("rect", { id: "header", x: 44, y: 44, width: 712, height: 3 }),
        object("text", {
          id: "issue",
          x: 46,
          y: 61,
          width: 600,
          text: "GREEN WEEKEND     /     2026",
          fontSize: 19,
          fontFamily: "Courier New",
        }),
        object("text", {
          id: "headline",
          x: 44,
          y: 126,
          width: 712,
          text: "把绿色\n带回生活",
          fontSize: 94,
          fontWeight: "bold",
        }),
        object("ellipse", {
          id: "leaf-one",
          x: 380,
          y: 440,
          width: 175,
          height: 320,
          angle: 36,
          fill: "#7e9a52",
        }),
        object("ellipse", {
          id: "leaf-two",
          x: 370,
          y: 462,
          width: 175,
          height: 320,
          angle: -36,
        }),
        object("rect", {
          id: "stem",
          x: 391,
          y: 550,
          width: 10,
          height: 263,
          radius: 5,
        }),
        object("text", {
          id: "side-note",
          x: 51,
          y: 485,
          width: 210,
          text: "植物交换\n手作花器\n阳台灵感",
          fontSize: 23,
        }),
        object("text", {
          id: "date",
          x: 48,
          y: 819,
          width: 650,
          text: "11.07 — 11.08",
          fontFamily: "Georgia",
          fontSize: 54,
        }),
        object("rect", { id: "rule", x: 48, y: 905, width: 704, height: 2 }),
        object("text", {
          id: "place",
          x: 48,
          y: 927,
          width: 700,
          text: "河畔社区花园     10:00–18:00     自由入场",
          fontSize: 19,
        }),
      ],
    }),
  },
  {
    id: "talk",
    name: "设计分享夜",
    description: "1200 × 675 · 横版活动",
    create: (): Poster => ({
      schemaVersion: 1,
      width: 1200,
      height: 675,
      background: "#252b31",
      objects: [
        object("ellipse", {
          id: "disc",
          x: 770,
          y: 100,
          width: 420,
          height: 420,
          fill: "#eb7960",
        }),
        object("ellipse", {
          id: "disc-inset",
          x: 855,
          y: 185,
          width: 250,
          height: 250,
          fill: "#252b31",
        }),
        object("text", {
          id: "eyebrow",
          x: 70,
          y: 68,
          width: 600,
          text: "OPEN STUDIO  /  028",
          fontSize: 23,
          fontFamily: "Courier New",
          fill: "#e7e6df",
        }),
        object("text", {
          id: "title",
          x: 66,
          y: 183,
          width: 740,
          text: "设计，\n从日常开始。",
          fontSize: 90,
          fontWeight: "bold",
          fill: "#e7e6df",
        }),
        object("rect", {
          id: "line",
          x: 70,
          y: 540,
          width: 1060,
          height: 2,
          fill: "#e7e6df",
        }),
        object("text", {
          id: "footer",
          x: 70,
          y: 573,
          width: 1020,
          text: "周五 19:30  /  城市设计图书馆  /  预约入场",
          fontSize: 26,
          fill: "#e7e6df",
        }),
      ],
    }),
  },
  {
    id: "blank",
    name: "空白方形",
    description: "1080 × 1080 · 从零排版",
    create: (): Poster => ({
      schemaVersion: 1,
      width: 1080,
      height: 1080,
      background: "#ffffff",
      objects: [],
    }),
  },
];
export function parseProject(raw: string): Poster {
  if (new TextEncoder().encode(raw).length > 550_000)
    throw new Error("项目文件不能超过 550 KB。");
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    throw new Error("JSON 尚未完整，请检查后重试。");
  }
  return validatePoster(value);
}
