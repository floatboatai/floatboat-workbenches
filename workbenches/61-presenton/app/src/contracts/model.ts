// ABOUTME: 演示文稿工作副本模型（资料简报 → 大纲 → 幻灯片）、上限、严格校验与草稿恢复；含 0.4 旧格式的确定性迁移。
import { boundedText, isRecord } from "./project.ts";

export const LAYOUTS = [
  "cover",
  "agenda",
  "section",
  "bullets",
  "comparison",
  "image-text",
  "chart",
  "stats",
  "quote",
  "timeline",
  "closing",
] as const;
export type LayoutId = (typeof LAYOUTS)[number];
export const LAYOUT_LABELS: Record<LayoutId, string> = {
  cover: "封面",
  agenda: "目录",
  section: "章节页",
  bullets: "要点",
  comparison: "左右对比",
  "image-text": "图文",
  chart: "图表",
  stats: "关键数字",
  quote: "引语",
  timeline: "时间线",
  closing: "结尾",
};
export const THEMES = ["paper", "forest", "night", "clay", "mono"] as const;
export type ThemeId = (typeof THEMES)[number];
export const ARTS = ["canopy", "route", "blocks", "hills", "rings", "growth"] as const;
export type ArtId = (typeof ARTS)[number];
export const CHART_TYPES = ["bar", "line", "pie", "doughnut"] as const;
export type ChartType = (typeof CHART_TYPES)[number];
export const MEDIA_ID = /^[0-9a-f]{64}$/;

export type Chart = {
  type: ChartType;
  categories: string[];
  series: { name: string; values: string[] }[];
  unit: string;
};
export type Stat = { value: string; label: string };
export type ImageRef = { kind: "art"; art: ArtId; alt: string } | { kind: "media"; id: string; alt: string };
export type Slide = {
  id: string;
  layout: LayoutId;
  title: string;
  subtitle: string;
  bullets: string[];
  bullets2: string[];
  columnTitles: [string, string];
  stats: Stat[];
  chart: Chart | null;
  image: ImageRef | null;
  notes: string;
  outlineId: string;
  source: string;
};
export type OutlineItem = {
  id: string;
  layout: LayoutId;
  title: string;
  points: string[];
  points2: string[];
  columnTitles: [string, string];
  chart: Chart | null;
  notes: string;
  sourceRef: string;
};
export type Density = "concise" | "standard" | "detailed";
export type Brief = {
  source: string;
  audience: string;
  objective: string;
  language: "auto" | "zh" | "en";
  length: number;
  density: Density;
};
export type Settings = {
  language: string;
  template: string;
  tone: string;
  verbosity: string;
  format: "pptx" | "pdf";
  instructions: string;
  webSearch: boolean;
  titleSlide: boolean;
  contents: boolean;
};
export type Result = {
  kind: "imported" | "generated";
  presentationId: string;
  taskId: string;
  path: string;
  importedAt: string;
  raw: string;
};
export type Deck = {
  schemaVersion: 2;
  brief: Brief;
  outline: OutlineItem[];
  slides: Slide[];
  theme: ThemeId;
  settings: Settings;
  result: Result | null;
};

export const LIMITS = {
  source: 280_000,
  slides: 80,
  points: 14,
  point: 600,
  title: 300,
  notes: 8000,
  chartCategories: 24,
  chartSeries: 6,
  stats: 6,
  /** Formal model JSON bytes; equals the project store limit. */
  modelBytes: 900_000,
  /** Draft decoding limit, independent of the formal model. */
  draftBytes: 9_000_000,
};

export const defaultSettings: Settings = {
  language: "Chinese",
  template: "general",
  tone: "professional",
  verbosity: "standard",
  format: "pptx",
  instructions: "",
  webSearch: false,
  titleSlide: true,
  contents: false,
};
export const emptyBrief: Brief = {
  source: "",
  audience: "",
  objective: "",
  language: "auto",
  length: 0,
  density: "standard",
};
export const blank: Deck = {
  schemaVersion: 2,
  brief: emptyBrief,
  outline: [],
  slides: [],
  theme: "paper",
  settings: defaultSettings,
  result: null,
};

const str = (v: unknown, n: number) => boundedText(v, n);
const ID = /^[A-Za-z0-9_-]{1,100}$/;
export function identifier(v: unknown): string {
  const s = boundedText(v, 100);
  if (!ID.test(s)) throw new Error("标识格式无效。");
  return s;
}
const oneOf = <T extends string>(list: readonly T[], v: unknown, what: string): T => {
  if (typeof v !== "string" || !(list as readonly string[]).includes(v)) throw new Error(`${what}无效。`);
  return v as T;
};
function lines(v: unknown, max: number, what: string): string[] {
  if (!Array.isArray(v) || v.length > max) throw new Error(`${what}最多 ${max} 条。`);
  return v.map((x) => str(x, LIMITS.point));
}
function pair(v: unknown): [string, string] {
  if (!Array.isArray(v) || v.length !== 2) throw new Error("栏目标题格式无效。");
  return [str(v[0], 120), str(v[1], 120)];
}
export function chartValue(v: unknown): Chart | null {
  if (v === null || v === undefined) return null;
  if (!isRecord(v) || !Array.isArray(v.categories) || !Array.isArray(v.series)) throw new Error("图表格式无效。");
  const categories = v.categories.map((c) => str(c, 120));
  if (categories.length < 1 || categories.length > LIMITS.chartCategories)
    throw new Error(`图表需要 1–${LIMITS.chartCategories} 个分类。`);
  if (v.series.length < 1 || v.series.length > LIMITS.chartSeries) throw new Error(`图表需要 1–${LIMITS.chartSeries} 个系列。`);
  const series = v.series.map((s) => {
    if (!isRecord(s) || !Array.isArray(s.values) || s.values.length !== categories.length)
      throw new Error("图表系列需要与分类数量一致的数值。");
    return { name: str(s.name, 120), values: s.values.map((x) => (typeof x === "number" ? String(x) : str(x, 40))) };
  });
  return { type: oneOf(CHART_TYPES, v.type, "图表类型"), categories, series, unit: str(v.unit ?? "", 20) };
}
function imageValue(v: unknown): ImageRef | null {
  if (v === null || v === undefined) return null;
  if (!isRecord(v)) throw new Error("图片格式无效。");
  const alt = str(v.alt ?? "", 300);
  if (v.kind === "art") return { kind: "art", art: oneOf(ARTS, v.art, "插画"), alt };
  if (v.kind === "media" && typeof v.id === "string" && MEDIA_ID.test(v.id)) return { kind: "media", id: v.id, alt };
  throw new Error("图片引用无效。");
}
function statsValue(v: unknown): Stat[] {
  if (!Array.isArray(v) || v.length > LIMITS.stats) throw new Error(`关键数字最多 ${LIMITS.stats} 个。`);
  return v.map((s) => {
    if (!isRecord(s)) throw new Error("关键数字格式无效。");
    return { value: str(s.value, 40), label: str(s.label, 200) };
  });
}
function slideValue(v: unknown): Slide {
  if (!isRecord(v)) throw new Error("幻灯片格式无效。");
  return {
    id: identifier(v.id),
    layout: oneOf(LAYOUTS, v.layout, "版式"),
    title: str(v.title, LIMITS.title),
    subtitle: str(v.subtitle, LIMITS.title),
    bullets: lines(v.bullets, LIMITS.points, "要点"),
    bullets2: lines(v.bullets2, LIMITS.points, "右栏要点"),
    columnTitles: pair(v.columnTitles),
    stats: statsValue(v.stats),
    chart: chartValue(v.chart),
    image: imageValue(v.image),
    notes: str(v.notes, LIMITS.notes),
    outlineId: v.outlineId === "" ? "" : identifier(v.outlineId),
    source: str(v.source, 300),
  };
}
function outlineValue(v: unknown): OutlineItem {
  if (!isRecord(v)) throw new Error("大纲条目格式无效。");
  return {
    id: identifier(v.id),
    layout: oneOf(LAYOUTS, v.layout, "版式"),
    title: str(v.title, LIMITS.title),
    points: lines(v.points, LIMITS.points, "要点"),
    points2: lines(v.points2, LIMITS.points, "右栏要点"),
    columnTitles: pair(v.columnTitles),
    chart: chartValue(v.chart),
    notes: str(v.notes, LIMITS.notes),
    sourceRef: str(v.sourceRef, 300),
  };
}
function briefValue(v: unknown): Brief {
  if (!isRecord(v)) throw new Error("资料简报格式无效。");
  const length = v.length;
  if (typeof length !== "number" || !Number.isInteger(length) || length < 0 || length > LIMITS.slides)
    throw new Error(`目标页数需要 0–${LIMITS.slides}。`);
  return {
    source: str(v.source, LIMITS.source),
    audience: str(v.audience, 1000),
    objective: str(v.objective, 2000),
    language: oneOf(["auto", "zh", "en"] as const, v.language, "语言"),
    length,
    density: oneOf(["concise", "standard", "detailed"] as const, v.density, "内容密度"),
  };
}
export function settingsValue(s: unknown): Settings {
  if (
    !isRecord(s) ||
    !["default", "casual", "professional", "funny", "educational", "sales_pitch"].includes(String(s.tone)) ||
    !["concise", "standard", "text-heavy"].includes(String(s.verbosity)) ||
    !["pptx", "pdf"].includes(String(s.format)) ||
    typeof s.webSearch !== "boolean" ||
    typeof s.titleSlide !== "boolean" ||
    typeof s.contents !== "boolean"
  )
    throw new Error("Presenton 制作设置无效。");
  return {
    language: str(s.language, 80),
    template: str(s.template, 120),
    tone: String(s.tone),
    verbosity: String(s.verbosity),
    format: s.format === "pdf" ? "pdf" : "pptx",
    instructions: str(s.instructions, 6000),
    webSearch: s.webSearch,
    titleSlide: s.titleSlide,
    contents: s.contents,
  };
}
export function resultValue(r: unknown): Result | null {
  if (r === null || r === undefined) return null;
  if (!isRecord(r) || !["imported", "generated"].includes(String(r.kind))) throw new Error("结果格式无效。");
  return {
    kind: r.kind === "generated" ? "generated" : "imported",
    presentationId: str(r.presentationId, 100),
    taskId: str(r.taskId, 100),
    path: str(r.path, 2000),
    importedAt: str(r.importedAt, 60),
    raw: str(r.raw, 250000),
  };
}
const unique = (ids: string[], what: string) => {
  if (new Set(ids).size !== ids.length) throw new Error(`${what}标识重复。`);
};

/** Text lines of a 0.4 Markdown slide body, as plain bullet points. */
export function markdownPoints(markdown: string): string[] {
  return markdown
    .split("\n")
    .map((l) =>
      l
        .replace(/^\s*(?:[-*+•]|\d+[.)、])\s+/, "")
        .replace(/^#+\s*/, "")
        .replace(/\*\*|__/g, "")
        .trim(),
    )
    .filter(Boolean)
    .slice(0, LIMITS.points)
    .map((l) => l.slice(0, LIMITS.point));
}

/** Deterministically lifts a 0.4 (schemaVersion 1) deck into the brief/outline/slides model. */
function migrateV1(value: Record<string, unknown>): Deck {
  if (!Array.isArray(value.slides) || value.slides.length > LIMITS.slides) throw new Error("旧版项目页面格式不正确。");
  const settings = settingsValue(value.settings);
  const outline: OutlineItem[] = [];
  const slides: Slide[] = [];
  value.slides.forEach((raw, i) => {
    if (!isRecord(raw)) throw new Error("旧版幻灯片格式不正确。");
    const id = identifier(raw.id);
    const title = str(raw.title, LIMITS.title);
    const points = markdownPoints(str(raw.markdown, 12000));
    const notes = str(raw.notes, LIMITS.notes);
    const layout: LayoutId = i === 0 ? "cover" : "bullets";
    outline.push({ id, layout, title, points, points2: [], columnTitles: ["", ""], chart: null, notes, sourceRef: "" });
    slides.push({
      id: `s-${id}`.slice(0, 100),
      layout,
      title,
      subtitle: layout === "cover" ? points[0] ?? "" : "",
      bullets: layout === "cover" ? points.slice(1) : points,
      bullets2: [],
      columnTitles: ["", ""],
      stats: [],
      chart: null,
      image: layout === "cover" ? { kind: "art", art: "canopy", alt: "" } : null,
      notes,
      outlineId: id,
      source: "",
    });
  });
  return {
    schemaVersion: 2,
    brief: {
      source: str(value.source, LIMITS.source),
      audience: str(value.audience, 1000),
      objective: str(value.objective, 2000),
      language: settings.language === "English" ? "en" : "auto",
      length: 0,
      density: "standard",
    },
    outline,
    slides,
    theme: "paper",
    settings,
    result: resultValue(value.result),
  };
}

/** Structural decoding used for drafts: unfinished business values are allowed, structure and sizes are not. */
export function restoreDeck(value: unknown): Deck {
  if (!isRecord(value)) throw new Error("项目格式不正确。");
  let deck: Deck;
  if (value.schemaVersion === 1) deck = migrateV1(value);
  else if (value.schemaVersion === 2) {
    if (!Array.isArray(value.slides) || !Array.isArray(value.outline)) throw new Error("项目格式不正确。");
    if (value.slides.length > LIMITS.slides || value.outline.length > LIMITS.slides)
      throw new Error(`最多 ${LIMITS.slides} 页。`);
    deck = {
      schemaVersion: 2,
      brief: briefValue(value.brief),
      outline: value.outline.map(outlineValue),
      slides: value.slides.map(slideValue),
      theme: oneOf(THEMES, value.theme, "主题"),
      settings: settingsValue(value.settings),
      result: resultValue(value.result),
    };
  } else throw new Error("项目格式版本不受支持。");
  unique(deck.slides.map((s) => s.id), "幻灯片");
  unique(deck.outline.map((s) => s.id), "大纲条目");
  if (new TextEncoder().encode(JSON.stringify(deck)).length > LIMITS.draftBytes)
    throw new Error("工作副本超过 9 MB，请先导出并减少内容。");
  return deck;
}

export const isNumeric = (v: string) => v.trim() !== "" && Number.isFinite(Number(v.replace(/,/g, "").trim()));

/** Formal model: complete slides only. Incomplete values stay restorable drafts. */
export function validateDeck(value: unknown): Deck {
  const d = restoreDeck(value);
  if (new TextEncoder().encode(JSON.stringify(d)).length > LIMITS.modelBytes)
    throw new Error("文稿超过 900 KB；完整工作副本仍按草稿保留，请精简资料后继续。");
  const page = d.slides.findIndex((s) => !s.title.trim());
  if (page >= 0) throw new Error(`第 ${page + 1} 页还没有标题，已保存为草稿。`);
  for (const [i, s] of d.slides.entries())
    if (s.chart?.series.some((x) => x.values.some((v) => v.trim() !== "" && !isNumeric(v))))
      throw new Error(`第 ${i + 1} 页的图表含有非数字的值，已保存为草稿。`);
  return d;
}

export function mediaIds(deck: Deck): string[] {
  const ids = new Set<string>();
  for (const s of deck.slides) if (s.image?.kind === "media") ids.add(s.image.id);
  return [...ids];
}

export const newId = (prefix: string) => `${prefix}-${crypto.randomUUID().slice(0, 13)}`;
