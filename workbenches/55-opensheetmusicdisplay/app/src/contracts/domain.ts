// ABOUTME: 审校项目的数据模型与校验：原件引用、谱面索引、显示设置、批注锚点。
import { boundedText, isRecord } from "./project.ts";
import { MAX_MEASURES, MAX_PARTS, type MeasureInfo, type PartInfo, type ScoreIndex } from "./musicxml.ts";
import type { SourceKind } from "./archive.ts";

export interface SourceRef {
  /** 原文件 SHA-256（小写十六进制），同时是服务端原件库的键。 */
  id: string;
  fileName: string;
  kind: SourceKind;
  size: number;
}
export type Layout = "page" | "landscape" | "endless" | "line";
export const LAYOUTS: Record<Layout, string> = {
  page: "A4 竖版分页",
  landscape: "A4 横版分页",
  endless: "无限滚动",
  line: "单行横卷",
};
export type MeasureNumbers = "system" | "every" | "off";
export interface ViewSettings {
  hiddenParts: string[];
  layout: Layout;
  zoom: number;
  /** 半音，-12…12，使用 OSMD TransposeCalculator。 */
  transpose: number;
  measureNumbers: MeasureNumbers;
  credits: boolean;
  partNames: boolean;
  /** 回放速度百分比。 */
  tempo: number;
}
export const ANNOTATION_KINDS = {
  pitch: "音高",
  rhythm: "节奏",
  dynamics: "力度",
  articulation: "演奏法",
  layout: "排版",
  text: "文字",
  other: "其他",
} as const;
export type AnnotationKind = keyof typeof ANNOTATION_KINDS;
/** 小节内拍位：以全音符为单位的分数 [分子, 分母]；null 表示整小节。 */
export type Beat = [number, number] | null;
export interface Annotation {
  id: string;
  partId: string;
  measureIndex: number;
  beat: Beat;
  kind: AnnotationKind;
  text: string;
  resolved: boolean;
  createdAt: string;
}
export interface Focus {
  partId: string;
  measureIndex: number;
  beat: Beat;
}
export interface ScoreProject {
  source: SourceRef;
  index: ScoreIndex;
  view: ViewSettings;
  annotations: Annotation[];
  focus: Focus;
}
export const MAX_ANNOTATIONS = 1000;
export const MAX_NOTE_TEXT = 2000;
export const ZOOM_MIN = 0.3,
  ZOOM_MAX = 3;

export function defaultView(): ViewSettings {
  return { hiddenParts: [], layout: "page", zoom: 0.8, transpose: 0, measureNumbers: "system", credits: true, partNames: true, tempo: 100 };
}
export function newProject(source: SourceRef, index: ScoreIndex): ScoreProject {
  return { source, index, view: defaultView(), annotations: [], focus: { partId: index.parts[0].id, measureIndex: 0, beat: null } };
}

const str = (value: unknown, max: number, label: string): string => {
  if (typeof value !== "string" || value.length > max) throw new Error(`${label}无效。`);
  return value;
};
const int = (value: unknown, min: number, max: number, label: string): number => {
  if (typeof value !== "number" || !Number.isInteger(value) || value < min || value > max) throw new Error(`${label}无效。`);
  return value;
};

export function parseSource(value: unknown): SourceRef {
  if (!isRecord(value)) throw new Error("项目需要乐谱原文件。");
  if (typeof value.id !== "string" || !/^[0-9a-f]{64}$/.test(value.id)) throw new Error("原文件标识无效。");
  if (value.kind !== "xml" && value.kind !== "mxl") throw new Error("不支持的原文件类型。");
  const fileName = str(value.fileName, 200, "原文件名");
  if (!fileName.trim() || /[\\/\u0000-\u001f]/.test(fileName)) throw new Error("原文件名无效。");
  return { id: value.id, fileName, kind: value.kind, size: int(value.size, 1, 32 * 1024 * 1024, "原文件大小") };
}

export function parseIndex(value: unknown): ScoreIndex {
  if (!isRecord(value) || !Array.isArray(value.parts) || !Array.isArray(value.measures) || !Array.isArray(value.warnings))
    throw new Error("乐谱索引无效，请重新导入。");
  if (!value.parts.length || value.parts.length > MAX_PARTS) throw new Error("乐谱索引的声部数量无效。");
  if (!value.measures.length || value.measures.length > MAX_MEASURES) throw new Error("乐谱索引的小节数量无效。");
  const ids = new Set<string>();
  const parts: PartInfo[] = value.parts.map((part) => {
    if (!isRecord(part)) throw new Error("乐谱索引的声部无效。");
    const id = str(part.id, 80, "声部标识");
    if (ids.has(id)) throw new Error("声部标识重复。");
    ids.add(id);
    return {
      id,
      name: str(part.name, 200, "声部名称"),
      abbreviation: str(part.abbreviation, 200, "声部缩写"),
      staves: int(part.staves, 1, 8, "谱表数"),
      measures: int(part.measures, 1, MAX_MEASURES, "小节数"),
    };
  });
  const measures: MeasureInfo[] = value.measures.map((measure) => {
    if (!isRecord(measure)) throw new Error("乐谱索引的小节无效。");
    return { n: str(measure.n, 16, "小节号"), t: str(measure.t, 16, "拍号") };
  });
  if (parts.some((part) => part.measures > measures.length)) throw new Error("乐谱索引的小节数量不一致。");
  return {
    title: str(value.title, 200, "标题"),
    subtitle: str(value.subtitle, 200, "副标题"),
    composer: str(value.composer, 200, "作曲"),
    lyricist: str(value.lyricist, 200, "作词"),
    arranger: str(value.arranger, 200, "编曲"),
    rights: str(value.rights, 200, "版权"),
    parts,
    measures,
    notes: int(value.notes, 1, 10_000_000, "音符数"),
    warnings: value.warnings.slice(0, 20).map((item) => str(item, 200, "警告")),
  };
}

function parseView(value: unknown, index: ScoreIndex): ViewSettings {
  if (!isRecord(value) || !Array.isArray(value.hiddenParts)) throw new Error("显示设置无效。");
  const hidden = value.hiddenParts.map((id) => str(id, 80, "隐藏声部"));
  if (new Set(hidden).size !== hidden.length || hidden.some((id) => !index.parts.some((part) => part.id === id)))
    throw new Error("隐藏的声部不存在。");
  if (hidden.length >= index.parts.length) throw new Error("至少显示一个声部。");
  if (typeof value.layout !== "string" || !Object.hasOwn(LAYOUTS, value.layout)) throw new Error("版式无效。");
  if (typeof value.zoom !== "number" || !Number.isFinite(value.zoom) || value.zoom < ZOOM_MIN || value.zoom > ZOOM_MAX)
    throw new Error("缩放比例无效。");
  if (!["system", "every", "off"].includes(value.measureNumbers as string)) throw new Error("小节号设置无效。");
  if (typeof value.credits !== "boolean" || typeof value.partNames !== "boolean") throw new Error("标题或声部名设置无效。");
  return {
    hiddenParts: hidden,
    layout: value.layout as Layout,
    zoom: Math.round(value.zoom * 100) / 100,
    transpose: int(value.transpose, -12, 12, "移调"),
    measureNumbers: value.measureNumbers as MeasureNumbers,
    credits: value.credits,
    partNames: value.partNames,
    tempo: int(value.tempo, 25, 200, "回放速度"),
  };
}

function parseBeat(value: unknown): Beat {
  if (value === null) return null;
  if (!Array.isArray(value) || value.length !== 2) throw new Error("拍位无效。");
  const [n, d] = value;
  int(n, 0, 1_000_000, "拍位");
  int(d, 1, 1_000_000, "拍位");
  return [n as number, d as number];
}

function anchor(index: ScoreIndex, partId: unknown, measureIndex: unknown) {
  const part = index.parts.find((item) => item.id === partId);
  if (!part || typeof measureIndex !== "number" || !Number.isInteger(measureIndex) || measureIndex < 0 || measureIndex >= part.measures)
    throw new Error("批注的小节或声部不存在。");
  return { partId: part.id, measureIndex };
}

export function validateScore(value: unknown): ScoreProject {
  return parseScore(value, false);
}
/** 恢复工作副本时放宽：允许尚未填写的空白批注；结构、锚点与大小检查不变。 */
export function restoreScoreDraft(value: unknown): ScoreProject {
  return parseScore(value, true);
}
function parseScore(value: unknown, draft: boolean): ScoreProject {
  if (!isRecord(value)) throw new Error("项目内容无效。");
  const source = parseSource(value.source);
  const index = parseIndex(value.index);
  const view = parseView(value.view, index);
  if (!Array.isArray(value.annotations) || value.annotations.length > MAX_ANNOTATIONS)
    throw new Error(`最多保留 ${MAX_ANNOTATIONS} 条批注。`);
  const ids = new Set<string>();
  const annotations = value.annotations.map((item): Annotation => {
    if (!isRecord(item) || typeof item.id !== "string" || !/^[-\w]{1,80}$/.test(item.id) || ids.has(item.id) || typeof item.resolved !== "boolean")
      throw new Error("批注结构无效。");
    ids.add(item.id);
    if (typeof item.kind !== "string" || !Object.hasOwn(ANNOTATION_KINDS, item.kind)) throw new Error("批注类别无效。");
    const text = boundedText(item.text, MAX_NOTE_TEXT);
    if (!draft && !text.trim()) throw new Error("批注不能为空。");
    const createdAt = str(item.createdAt, 40, "批注时间");
    if (Number.isNaN(Date.parse(createdAt))) throw new Error("批注时间无效。");
    return {
      id: item.id,
      ...anchor(index, item.partId, item.measureIndex),
      beat: parseBeat(item.beat),
      kind: item.kind as AnnotationKind,
      text,
      resolved: item.resolved,
      createdAt,
    };
  });
  if (!isRecord(value.focus)) throw new Error("当前审阅位置无效。");
  const focus = { ...anchor(index, value.focus.partId, value.focus.measureIndex), beat: parseBeat(value.focus.beat) };
  return { source, index, view, annotations, focus };
}

/** 按乐谱顺序排列批注：小节 → 拍位 → 声部顺序 → 创建时间。 */
export function orderAnnotations(project: Pick<ScoreProject, "annotations" | "index">): Annotation[] {
  const partOrder = new Map(project.index.parts.map((part, i) => [part.id, i]));
  const at = (beat: Beat) => (beat ? beat[0] / beat[1] : -1);
  return [...project.annotations].sort(
    (a, b) =>
      a.measureIndex - b.measureIndex ||
      at(a.beat) - at(b.beat) ||
      (partOrder.get(a.partId) ?? 0) - (partOrder.get(b.partId) ?? 0) ||
      a.createdAt.localeCompare(b.createdAt),
  );
}

export function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(binary);
}
