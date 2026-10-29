import { unpackSource, type SourceArchive } from "./source-package.ts";
import type { EditorDocument } from "oasis-editor";
import { isRecord } from "./project.ts";
export type Source = {
  hash: string;
  name: string;
  bytes: number;
  warnings: string[];
};
export type DocumentData = {
  schema: 1;
  document: EditorDocument | null;
  archive?: SourceArchive | null;
  notes: string;
  source: Source | null;
  zoom: number;
  /** Track-changes mode of this manuscript (added in 0.9.0; absent means off). */
  trackChanges?: boolean;
};
export const seed: DocumentData = {
  schema: 1,
  document: null,
  archive: null,
  notes: "",
  source: null,
  zoom: 80,
};
const bytes = (value: unknown) =>
  new TextEncoder().encode(JSON.stringify(value)).length;
export function restoreDocument(value: unknown): DocumentData {
  if (
    !isRecord(value) ||
    value.schema !== 1 ||
    typeof value.notes !== "string" ||
    value.notes.length > 20000 ||
    typeof value.zoom !== "number" ||
    !Number.isFinite(value.zoom) ||
    value.zoom < 25 ||
    value.zoom > 150 ||
    (value.trackChanges !== undefined && typeof value.trackChanges !== "boolean")
  )
    throw Error("工作稿字段无效。");
  if (bytes(value) > 2000000)
    throw Error("完整文档超过2MB恢复上限，请保留原稿。");
  if (value.archive !== undefined && value.archive !== null)
    unpackSource(value.archive);
  let nodes = 0;
  function visit(v: unknown, depth = 0): void {
    if (++nodes > 100000 || depth > 60) throw Error("文档结构超过上限。");
    if (v === null || typeof v === "boolean" || typeof v === "string") return;
    if (typeof v === "number") {
      if (!Number.isFinite(v)) throw Error("文档数值无效。");
      return;
    }
    if (Array.isArray(v)) {
      for (const a of v) visit(a, depth + 1);
      return;
    }
    if (!isRecord(v)) throw Error("文档不是可携带的JSON。");
    for (const [k, x] of Object.entries(v)) {
      if (["__proto__", "constructor", "prototype"].includes(k))
        throw Error("文档属性无效。");
      if (
        (k === "src" || k === "url") &&
        typeof x === "string" &&
        !/^(data:image\/(png|jpeg|gif|webp);base64,|asset:)/.test(x)
      )
        throw Error("文档含外部或临时图像，请在Word中嵌入PNG/JPEG图像后重试。");
      visit(x, depth + 1);
    }
  }
  if (value.document !== null) {
    if (
      !isRecord(value.document) ||
      typeof value.document.id !== "string" ||
      !Array.isArray(value.document.sections) ||
      !value.document.sections.length
    )
      throw Error("缺少原生文档结构。");
    for (const section of value.document.sections) {
      if (!isRecord(section) || !Array.isArray(section.blocks))
        throw Error("文档分页结构无效。");
    }
    visit(value.document);
  }
  if (value.source !== null) {
    const s = value.source;
    if (
      !isRecord(s) ||
      typeof s.hash !== "string" ||
      !/^[a-f0-9]{64}$/.test(s.hash) ||
      typeof s.name !== "string" ||
      s.name.length > 240 ||
      typeof s.bytes !== "number" ||
      s.bytes < 1 ||
      s.bytes > 1200000 ||
      !Array.isArray(s.warnings) ||
      !s.warnings.every((x) => typeof x === "string" && x.length < 2000)
    )
      throw Error("原件索引无效。");
  }
  return value as unknown as DocumentData;
}
export function validateDocument(value: unknown): DocumentData {
  const d = restoreDocument(value);
  if (!d.document) throw Error("正在准备文档。");
  if (bytes(d) > 850000)
    throw Error("正式稿超过850KB；完整恢复稿已保留，请导出DOCX或恢复稿。");
  return d;
}
/** An import is refused (not kept as a draft) when it cannot become a formal save. */
export function validateImport(value: unknown): DocumentData {
  const d = restoreDocument(value);
  if (bytes(d) > 850000)
    throw Error("导入后的文稿超过850KB正式保存上限（多为图片），本次未导入；请压缩文中图片后再试，原文件不受影响。");
  return validateDocument(d);
}
export function decodeRecovery(value: unknown) {
  if (
    !isRecord(value) ||
    !isRecord(value.snapshot) ||
    typeof value.snapshot.title !== "string" ||
    value.snapshot.title.length > 120 ||
    !isRecord(value.snapshot.extra)
  )
    throw Error("不是本工作台的恢复稿。");
  if (bytes(value.snapshot) > 1940000)
    throw Error("恢复快照超过1.94MB请求预算。");
  return {
    title: value.snapshot.title,
    data: restoreDocument(value.snapshot.data),
    extra: value.snapshot.extra,
    resources: isRecord(value.resources) ? value.resources : {},
  };
}
