import { isRecord, boundedText } from "./project.ts";

export const MAX_IMAGE_BYTES = 1048576;
export interface Page {
  id: string;
  assetId: string;
  label: string;
}
export interface Review {
  id: string;
  pageId: string;
  text: string;
  status: "open" | "resolved";
}
export interface Viewport {
  x: number;
  y: number;
  zoom: number;
  rotation: number;
  flip: boolean;
}
export interface Collection {
  pages: Page[];
  left: string;
  right: string;
  reviews: Review[];
  draft: { text: string; pageId: string };
  views: { left: Viewport | null; right: Viewport | null };
}
export interface Asset {
  id: string;
  name: string;
  width: number;
  height: number;
  mime: string;
}
export const samples: Asset[] = [
  {
    id: "demo-a",
    name: "演示 · 田野手记 A",
    width: 800,
    height: 1100,
    mime: "image/svg+xml",
  },
  {
    id: "demo-b",
    name: "演示 · 田野手记 B",
    width: 800,
    height: 1100,
    mime: "image/svg+xml",
  },
];
export const seed: Collection = {
  pages: samples.map((x) => ({ id: x.id, assetId: x.id, label: x.name })),
  left: "demo-a",
  right: "demo-b",
  reviews: [],
  draft: { text: "", pageId: "" },
  views: { left: null, right: null },
};
const key = (value: unknown) => {
  if (typeof value !== "string" || !/^[a-zA-Z0-9-]{1,80}$/.test(value))
    throw new Error("记录标识无效。");
  return value;
};
export function assetId(value: unknown): string {
  if (
    typeof value !== "string" ||
    (!/^[a-f0-9]{64}$/.test(value) && !samples.some((x) => x.id === value))
  )
    throw new Error("图像标识无效。");
  return value;
}
export function viewport(value: unknown): Viewport | null {
  if (value === null) return null;
  if (!isRecord(value)) throw new Error("视图记录无效。");
  for (const field of ["x", "y", "zoom", "rotation"] as const)
    if (
      typeof value[field] !== "number" ||
      !Number.isFinite(value[field]) ||
      Math.abs(value[field]) > 1e9
    )
      throw new Error("视图参数无效。");
  if (
    typeof value.zoom !== "number" ||
    value.zoom <= 0 ||
    typeof value.flip !== "boolean"
  )
    throw new Error("视图缩放无效。");
  return {
    x: Number(value.x),
    y: Number(value.y),
    zoom: value.zoom,
    rotation: Number(value.rotation),
    flip: value.flip,
  };
}
export function validateCollection(value: unknown): Collection {
  if (
    !isRecord(value) ||
    !Array.isArray(value.pages) ||
    value.pages.length > 20 ||
    !Array.isArray(value.reviews) ||
    value.reviews.length > 100 ||
    !isRecord(value.views)
  )
    throw new Error("项目最多包含 20 页和 100 条复核记录。");
  const pages = value.pages.map((p): Page => {
    if (!isRecord(p)) throw new Error("资料页格式无效。");
    const label = boundedText(p.label, 120).trim();
    if (!label) throw new Error("请填写资料页名称。");
    return { id: key(p.id), assetId: assetId(p.assetId), label };
  });
  const ids = new Set(pages.map((p) => p.id));
  if (ids.size !== pages.length) throw new Error("资料页标识重复。");
  const side = (v: unknown) => {
    if (typeof v !== "string" || (v && !ids.has(v)) || (pages.length > 0 && !v))
      throw new Error("对照页不存在。");
    return v;
  };
  const reviews = value.reviews.map((r): Review => {
    if (
      !isRecord(r) ||
      typeof r.pageId !== "string" ||
      !ids.has(r.pageId) ||
      typeof r.status !== "string" ||
      !["open", "resolved"].includes(r.status)
    )
      throw new Error("复核记录引用无效。");
    const text = boundedText(r.text, 2000).trim();
    if (!text) throw new Error("复核意见不能为空。");
    return {
      id: key(r.id),
      pageId: String(r.pageId),
      text,
      status: r.status === "resolved" ? "resolved" : "open",
    };
  });
  if (new Set(reviews.map((r) => r.id)).size !== reviews.length)
    throw new Error("复核记录标识重复。");
  const draft = isRecord(value.draft)
    ? {
        text: boundedText(value.draft.text, 2000),
        pageId: boundedText(value.draft.pageId, 80),
      }
    : { text: "", pageId: "" };
  if (draft.pageId && !ids.has(draft.pageId))
    throw new Error("草稿关联页不存在。");
  return {
    pages,
    left: side(value.left),
    right: side(value.right),
    reviews,
    draft,
    views: {
      left: viewport(value.views.left),
      right: viewport(value.views.right),
    },
  };
}
export function isAsset(value: unknown): value is Asset {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    typeof value.name === "string" &&
    typeof value.width === "number" &&
    typeof value.height === "number" &&
    typeof value.mime === "string"
  );
}
export function reviewCsv(data: Collection): string {
  const cell = (text: string) => {
    const safe = /^[=+@\-\t\r]/.test(text) ? "'" + text : text;
    return '"' + safe.replaceAll('"', '""') + '"';
  };
  const rows = [
    ["资料页", "状态", "复核意见"],
    ...data.reviews.map((r) => [
      data.pages.find((p) => p.id === r.pageId)?.label ?? "",
      r.status === "resolved" ? "已复核" : "待复核",
      r.text,
    ]),
  ];
  return "\ufeff" + rows.map((r) => r.map(cell).join(",")).join("\r\n");
}

export function restoreCollectionDraft(value: unknown): Collection {
  if (!isRecord(value) || !Array.isArray(value.pages))
    throw new Error("资料草稿格式无效。");
  const labels: string[] = [];
  const pages = value.pages.map((page) => {
    if (
      !isRecord(page) ||
      typeof page.label !== "string" ||
      page.label.length > 120
    )
      throw new Error("资料页名称格式无效。");
    labels.push(page.label);
    return { ...page, label: page.label.trim() || "待命名" };
  });
  const draft = validateCollection({ ...value, pages });
  return {
    ...draft,
    pages: draft.pages.map((page, index) => ({
      ...page,
      label: labels[index],
    })),
  };
}
