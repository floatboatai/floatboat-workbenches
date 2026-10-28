import { isRecord } from "./project.ts";
export type Source = {
  id: string;
  name: string;
  mime: "image/png" | "image/jpeg";
  width: number;
  height: number;
  bytes: number;
};
export type Item = {
  id: string;
  kind: "rect" | "text" | "arrow" | "image";
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  fill: string;
  stroke: string;
  strokeWidth: number;
  text: string;
  source: Source | null;
};
export type Board = {
  version: 1;
  width: number;
  height: number;
  background: string;
  items: Item[];
};
export const MAX_IMAGE_BYTES = 750000;
export function dimensions(width: number, height: number) {
  if (
    !Number.isInteger(width) ||
    !Number.isInteger(height) ||
    width < 1 ||
    height < 1 ||
    width > 6000 ||
    height > 6000 ||
    width * height > 16000000
  )
    throw new Error("图片尺寸需在 6000 × 6000 内，总像素不超过 1600 万。");
}
export function sourceValue(v: unknown): Source {
  if (
    !isRecord(v) ||
    typeof v.id !== "string" ||
    !/^[a-f0-9]{64}$/.test(v.id) ||
    typeof v.name !== "string" ||
    v.name.length > 200 ||
    (v.mime !== "image/png" && v.mime !== "image/jpeg") ||
    typeof v.width !== "number" ||
    typeof v.height !== "number" ||
    typeof v.bytes !== "number" ||
    v.bytes < 1 ||
    v.bytes > MAX_IMAGE_BYTES
  )
    throw new Error("图片引用无效。");
  dimensions(v.width, v.height);
  return v as Source;
}
const color = (v: unknown) =>
  typeof v === "string" && /^#[0-9a-fA-F]{6}$/.test(v);
export function restoreBoard(v: unknown): Board {
  if (
    !isRecord(v) ||
    v.version !== 1 ||
    typeof v.width !== "number" ||
    typeof v.height !== "number" ||
    typeof v.background !== "string" ||
    !Array.isArray(v.items) ||
    v.items.length > 200 ||
    JSON.stringify(v).length > 1800000
  )
    throw new Error("画板格式或工作稿容量无效。");
  const ids = new Set<string>();
  for (const i of v.items) {
    if (
      !isRecord(i) ||
      typeof i.id !== "string" ||
      i.id.length > 100 ||
      ids.has(i.id) ||
      typeof i.kind !== "string" ||
      !["rect", "text", "arrow", "image"].includes(i.kind) ||
      !["x", "y", "width", "height", "rotation", "strokeWidth"].every(
        (k) => typeof i[k] === "number" && Number.isFinite(i[k]),
      ) ||
      typeof i.fill !== "string" ||
      typeof i.stroke !== "string" ||
      typeof i.text !== "string" ||
      i.text.length > 100000
    )
      throw new Error("对象格式无效。");
    ids.add(i.id);
    if (i.source !== null) sourceValue(i.source);
  }
  return v as Board;
}
export function validateBoard(v: unknown): Board {
  const b = restoreBoard(v);
  if (
    b.width < 200 ||
    b.width > 2400 ||
    b.height < 200 ||
    b.height > 2400 ||
    !color(b.background) ||
    new TextEncoder().encode(JSON.stringify(b)).length > 850000
  )
    throw new Error("正式画板需为 200–2400 像素且小于 850 KB。");
  for (const i of b.items) {
    if (
      !color(i.fill) ||
      !color(i.stroke) ||
      i.width < 1 ||
      i.height < 1 ||
      i.width > 6000 ||
      i.height > 6000 ||
      Math.abs(i.x) > 10000 ||
      Math.abs(i.y) > 10000 ||
      Math.abs(i.rotation) > 3600 ||
      i.strokeWidth < 0 ||
      i.strokeWidth > 40 ||
      i.text.length > 4000 ||
      (i.kind === "image" && !i.source)
    )
      throw new Error("对象属性尚未有效；已保留工作稿。");
  }
  return b;
}
export function makeItem(kind: Item["kind"], n = 0): Item {
  return {
    id: crypto.randomUUID(),
    kind,
    x: 160 + n * 12,
    y: 160 + n * 12,
    width: kind === "text" ? 260 : 180,
    height: kind === "text" ? 44 : 110,
    rotation: 0,
    fill: kind === "text" ? "#243342" : "#fff1df",
    stroke: "#d94e3e",
    strokeWidth: kind === "text" ? 0 : 3,
    text: kind === "text" ? "添加标注" : "",
    source: null,
  };
}
export const seed: Board = {
  version: 1,
  width: 1000,
  height: 640,
  background: "#ffffff",
  items: [
    {
      id: "heading",
      kind: "text",
      x: 64,
      y: 48,
      width: 780,
      height: 48,
      rotation: 0,
      fill: "#243342",
      stroke: "#243342",
      strokeWidth: 0,
      text: "包装校样 · 春日茶礼",
      source: null,
    },
    {
      id: "package",
      kind: "rect",
      x: 280,
      y: 170,
      width: 390,
      height: 290,
      rotation: 0,
      fill: "#e4e9df",
      stroke: "#63735c",
      strokeWidth: 2,
      text: "",
      source: null,
    },
    {
      id: "label",
      kind: "rect",
      x: 360,
      y: 230,
      width: 230,
      height: 170,
      rotation: 0,
      fill: "#fff8e7",
      stroke: "#bd9a65",
      strokeWidth: 1,
      text: "",
      source: null,
    },
    {
      id: "tea",
      kind: "text",
      x: 393,
      y: 267,
      width: 190,
      height: 58,
      rotation: 0,
      fill: "#43553e",
      stroke: "#43553e",
      strokeWidth: 0,
      text: "春 山 茶",
      source: null,
    },
    {
      id: "weight",
      kind: "text",
      x: 409,
      y: 343,
      width: 170,
      height: 28,
      rotation: 0,
      fill: "#63735c",
      stroke: "#63735c",
      strokeWidth: 0,
      text: "明前绿茶 · 100 g",
      source: null,
    },
    {
      id: "arrow",
      kind: "arrow",
      x: 746,
      y: 220,
      width: -145,
      height: 50,
      rotation: 0,
      fill: "#d94e3e",
      stroke: "#d94e3e",
      strokeWidth: 3,
      text: "",
      source: null,
    },
    {
      id: "note",
      kind: "text",
      x: 735,
      y: 155,
      width: 220,
      height: 40,
      rotation: 0,
      fill: "#d94e3e",
      stroke: "#d94e3e",
      strokeWidth: 0,
      text: "01  标签居中对齐",
      source: null,
    },
    {
      id: "footer",
      kind: "text",
      x: 64,
      y: 552,
      width: 820,
      height: 32,
      rotation: 0,
      fill: "#63735c",
      stroke: "#63735c",
      strokeWidth: 0,
      text: "印前复核 / 包装系列 A / 2026.10",
      source: null,
    },
  ],
};
// Arrows use a positive local bounding box and rotation, matching Transformer dimensions.
seed.items[5] = {
  ...seed.items[5],
  x: 746,
  y: 220,
  width: 150,
  height: 1,
  rotation: 160,
};
export function parseImport(raw: unknown): {
  title: string;
  data: Board;
  extra: Record<string, unknown>;
  originals: unknown[];
} {
  if (!isRecord(raw)) throw new Error("请选择工程 JSON 或恢复稿。");
  const snapshot = isRecord(raw.snapshot) ? raw.snapshot : raw;
  if (
    typeof snapshot.title !== "string" ||
    snapshot.title.length > 120 ||
    !isRecord(snapshot.extra ?? {})
  )
    throw new Error("工程标题或工作稿无效。");
  const data = restoreBoard(snapshot.data);
  return {
    title: snapshot.title,
    data,
    extra: (snapshot.extra ?? {}) as Record<string, unknown>,
    originals: Array.isArray(raw.originals) ? raw.originals : [],
  };
}
