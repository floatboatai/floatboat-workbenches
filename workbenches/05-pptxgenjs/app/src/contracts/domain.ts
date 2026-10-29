// ABOUTME: 演示文稿数据模型、严格校验、草稿恢复与 0.3.0 旧格式迁移；页面与服务端共用。
import { isRecord } from "./project.ts";

export type Aspect = "16:9" | "16:10" | "4:3";
export const SLIDE_SIZES: Record<Aspect, { w: number; h: number }> = {
  "16:9": { w: 40 / 3, h: 7.5 },
  "16:10": { w: 12, h: 7.5 },
  "4:3": { w: 10, h: 7.5 },
};
export const COLOR_ROLES = ["background", "surface", "text", "muted", "accent", "accent2"] as const;
export type ColorRole = (typeof COLOR_ROLES)[number];
/** Theme role name or a 6-digit hex colour without '#'. */
export type ColorRef = ColorRole | string;
export interface Theme {
  preset: string;
  aspect: Aspect;
  colors: Record<ColorRole, string>;
  headFont: string;
  bodyFont: string;
}
export const LAYOUT_IDS = [
  "title",
  "section",
  "content",
  "two-column",
  "comparison",
  "image-text",
  "quote",
  "chart",
  "table",
  "blank",
] as const;
export type LayoutId = (typeof LAYOUT_IDS)[number];
export const SLOT_NAMES = [
  "title",
  "subtitle",
  "kicker",
  "body",
  "body2",
  "heading1",
  "heading2",
  "media",
  "quote",
  "byline",
  "chart",
  "table",
] as const;
export type SlotName = (typeof SLOT_NAMES)[number];

export interface Run {
  text: string;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  color?: ColorRef;
  link?: string;
}
export interface Paragraph {
  runs: Run[];
  bullet?: boolean;
  level?: number;
}
interface Box {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  slot?: SlotName;
}
export interface TextElement extends Box {
  type: "text";
  paragraphs: Paragraph[];
  font: "head" | "body";
  size: number;
  color: ColorRef;
  align: "left" | "center" | "right";
  valign: "top" | "middle" | "bottom";
  bold: boolean;
  italic: boolean;
  fill: ColorRef | null;
  lineSpacing: number;
  spaceAfter: number;
}
export interface ImageElement extends Box {
  type: "image";
  mediaId: string;
  fit: "contain" | "cover";
  alt: string;
}
export interface TableElement extends Box {
  type: "table";
  rows: string[][];
  header: boolean;
  banded: boolean;
  size: number;
}
export const CHART_TYPES = ["bar", "line", "area", "pie", "doughnut"] as const;
export type ChartType = (typeof CHART_TYPES)[number];
export interface ChartSeries {
  name: string;
  values: string[];
}
export interface ChartElement extends Box {
  type: "chart";
  chart: ChartType;
  title: string;
  categories: string[];
  series: ChartSeries[];
  legend: boolean;
  labels: boolean;
}
export const SHAPE_KINDS = ["rect", "roundRect", "ellipse", "triangle", "rightArrow", "line"] as const;
export type ShapeKind = (typeof SHAPE_KINDS)[number];
export interface ShapeElement extends Box {
  type: "shape";
  shape: ShapeKind;
  fill: ColorRef | null;
  line: ColorRef | null;
  lineWidth: number;
  text: string;
  textColor: ColorRef;
  size: number;
}
export type SlideElement = TextElement | ImageElement | TableElement | ChartElement | ShapeElement;
export type ElementType = SlideElement["type"];
export interface Slide {
  id: string;
  layout: LayoutId;
  elements: SlideElement[];
  notes: string;
  hidden: boolean;
}
export interface Deck {
  version: 2;
  theme: Theme;
  slides: Slide[];
}

export const LIMITS = {
  slides: 80,
  elements: 40,
  paragraphs: 60,
  runs: 40,
  runText: 2000,
  elementText: 6000,
  tableRows: 20,
  tableCols: 10,
  cellText: 500,
  chartSeries: 8,
  chartCategories: 24,
  notes: 8000,
  font: 60,
};
export const MEDIA_ID = /^[0-9a-f]{64}$/;
const ID = /^[A-Za-z0-9_-]{1,80}$/;
const HEX = /^[0-9A-Fa-f]{6}$/;
const NUMBER = /^-?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][-+]?\d+)?$/;
export const isNumberCell = (value: string) => value.trim() === "" || NUMBER.test(value.trim());
export const isSafeLink = (value: string) => /^(https?:\/\/[^\s<>"]+|mailto:[^\s<>"]+)$/i.test(value.trim());

class DeckError extends Error {}
const fail = (message: string): never => {
  throw new DeckError(message);
};
function text(value: unknown, max: number, label: string): string {
  if (typeof value !== "string") return fail(`${label}需要文字。`);
  if (value.length > max) return fail(`${label}不能超过 ${max} 个字符。`);
  return value;
}
function num(value: unknown, min: number, max: number, label: string): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < min || value > max)
    return fail(`${label}需要 ${min}–${max} 之间的数字。`);
  return Math.round(value * 1000) / 1000;
}
function oneOf<T extends string>(value: unknown, options: readonly T[], label: string): T {
  if (typeof value !== "string" || !options.includes(value as T)) return fail(`${label}无效。`);
  return value as T;
}
function bool(value: unknown, fallback = false): boolean {
  return typeof value === "boolean" ? value : fallback;
}
function color(value: unknown, label: string, nullable: true): ColorRef | null;
function color(value: unknown, label: string, nullable?: false): ColorRef;
function color(value: unknown, label: string, nullable = false): ColorRef | null {
  if (value === null && nullable) return null;
  if (typeof value === "string" && ((COLOR_ROLES as readonly string[]).includes(value) || HEX.test(value)))
    return HEX.test(value) ? value.toUpperCase() : value;
  return fail(`${label}颜色无效。`);
}

function parseTheme(value: unknown, draft: boolean): Theme {
  if (!isRecord(value) || !isRecord(value.colors)) return fail("主题格式无效。");
  const colors = {} as Record<ColorRole, string>;
  for (const role of COLOR_ROLES) {
    const raw = value.colors[role];
    if (typeof raw !== "string" || !HEX.test(raw)) return fail(`主题颜色 ${role} 需要 6 位十六进制。`);
    colors[role] = raw.toUpperCase();
  }
  const font = (raw: unknown, label: string) => {
    const result = text(raw, LIMITS.font, label);
    if (!draft && !result.trim()) fail(`${label}不能为空。`);
    if (/[;"<>{}]/.test(result)) fail(`${label}包含不支持的字符。`);
    return draft ? result : result.trim();
  };
  return {
    preset: text(value.preset ?? "custom", 40, "主题预设"),
    aspect: oneOf(value.aspect, Object.keys(SLIDE_SIZES) as Aspect[], "画面比例"),
    colors,
    headFont: font(value.headFont, "标题字体"),
    bodyFont: font(value.bodyFont, "正文字体"),
  };
}

function parseRun(value: unknown, draft: boolean): Run {
  if (!isRecord(value)) return fail("文字片段格式无效。");
  const run: Run = { text: text(value.text, LIMITS.runText, "文字") };
  if (value.bold === true) run.bold = true;
  if (value.italic === true) run.italic = true;
  if (value.underline === true) run.underline = true;
  if (value.color !== undefined) run.color = color(value.color, "文字");
  if (value.link !== undefined && value.link !== "") {
    const link = text(value.link, 500, "链接");
    if (!draft && !isSafeLink(link)) fail(`链接“${link.slice(0, 40)}”需要以 http(s):// 或 mailto: 开头。`);
    run.link = draft ? link : link.trim();
  }
  return run;
}
function parseParagraph(value: unknown, draft: boolean): Paragraph {
  if (!isRecord(value) || !Array.isArray(value.runs) || value.runs.length > LIMITS.runs) return fail("段落格式无效。");
  const paragraph: Paragraph = { runs: value.runs.map((run) => parseRun(run, draft)) };
  if (value.bullet === true) paragraph.bullet = true;
  if (value.level !== undefined && value.level !== 0) paragraph.level = Math.round(num(value.level, 0, 2, "缩进级别"));
  return paragraph;
}

function parseElement(value: unknown, draft: boolean, where: string): SlideElement {
  if (!isRecord(value) || typeof value.id !== "string" || !ID.test(value.id)) return fail(`${where}元素标识无效。`);
  const base: Box = {
    id: value.id,
    x: num(value.x, -100, 200, `${where}位置 x`),
    y: num(value.y, -100, 200, `${where}位置 y`),
    w: num(value.w, 0, 300, `${where}宽度`),
    h: num(value.h, 0, 300, `${where}高度`),
  };
  if (value.slot !== undefined) base.slot = oneOf(value.slot, SLOT_NAMES, `${where}占位`);
  switch (value.type) {
    case "text": {
      if (!Array.isArray(value.paragraphs) || value.paragraphs.length < 1 || value.paragraphs.length > LIMITS.paragraphs)
        return fail(`${where}文本段落数量无效。`);
      const paragraphs = value.paragraphs.map((p) => parseParagraph(p, draft));
      const length = paragraphs.reduce((n, p) => n + p.runs.reduce((m, r) => m + r.text.length, 0), 0);
      if (length > LIMITS.elementText) fail(`${where}文本超过 ${LIMITS.elementText} 个字符。`);
      return {
        ...base,
        type: "text",
        paragraphs,
        font: oneOf(value.font, ["head", "body"] as const, `${where}字体角色`),
        size: num(value.size, 6, 160, `${where}字号`),
        color: color(value.color, `${where}文本`),
        align: oneOf(value.align, ["left", "center", "right"] as const, `${where}对齐`),
        valign: oneOf(value.valign, ["top", "middle", "bottom"] as const, `${where}垂直对齐`),
        bold: bool(value.bold),
        italic: bool(value.italic),
        fill: color(value.fill ?? null, `${where}文本框填充`, true),
        lineSpacing: num(value.lineSpacing ?? 1, 0.7, 3, `${where}行距`),
        spaceAfter: num(value.spaceAfter ?? 0, 0, 72, `${where}段后距`),
      };
    }
    case "image": {
      const mediaId = text(value.mediaId, 64, `${where}图片`);
      if (mediaId && !MEDIA_ID.test(mediaId)) fail(`${where}图片引用无效。`);
      return {
        ...base,
        type: "image",
        mediaId,
        fit: oneOf(value.fit, ["contain", "cover"] as const, `${where}图片适配`),
        alt: text(value.alt ?? "", 300, `${where}替换文字`),
      };
    }
    case "table": {
      const rows = value.rows;
      if (!Array.isArray(rows) || rows.length < 1 || rows.length > LIMITS.tableRows) return fail(`${where}表格需要 1–${LIMITS.tableRows} 行。`);
      const width = Array.isArray(rows[0]) ? rows[0].length : 0;
      if (width < 1 || width > LIMITS.tableCols) fail(`${where}表格需要 1–${LIMITS.tableCols} 列。`);
      const parsed = rows.map((row) => {
        if (!Array.isArray(row) || row.length !== width) return fail(`${where}表格每行列数需要一致。`);
        return row.map((cell) => text(cell, LIMITS.cellText, `${where}单元格`));
      });
      return {
        ...base,
        type: "table",
        rows: parsed,
        header: bool(value.header, true),
        banded: bool(value.banded, true),
        size: num(value.size, 6, 40, `${where}表格字号`),
      };
    }
    case "chart": {
      const categories = value.categories;
      if (!Array.isArray(categories) || categories.length < 1 || categories.length > LIMITS.chartCategories)
        return fail(`${where}图表需要 1–${LIMITS.chartCategories} 个分类。`);
      const series = value.series;
      if (!Array.isArray(series) || series.length < 1 || series.length > LIMITS.chartSeries)
        return fail(`${where}图表需要 1–${LIMITS.chartSeries} 个系列。`);
      const cats = categories.map((c) => text(c, 60, `${where}分类名`));
      const parsedSeries = series.map((s, i) => {
        if (!isRecord(s) || !Array.isArray(s.values) || s.values.length !== cats.length)
          return fail(`${where}第 ${i + 1} 个系列的数值数量需要与分类一致。`);
        const values = s.values.map((v) => text(v, 32, `${where}数值`));
        if (!draft) {
          const bad = values.findIndex((v) => !isNumberCell(v));
          if (bad >= 0) fail(`${where}图表数据“${values[bad]}”（${cats[bad] || "第 " + (bad + 1) + " 类"} / 系列 ${i + 1}）不是数字。`);
        }
        return { name: text(s.name, 60, `${where}系列名`), values };
      });
      return {
        ...base,
        type: "chart",
        chart: oneOf(value.chart, CHART_TYPES, `${where}图表类型`),
        title: text(value.title ?? "", 120, `${where}图表标题`),
        categories: cats,
        series: parsedSeries,
        legend: bool(value.legend, true),
        labels: bool(value.labels, false),
      };
    }
    case "shape":
      return {
        ...base,
        type: "shape",
        shape: oneOf(value.shape, SHAPE_KINDS, `${where}形状`),
        fill: color(value.fill ?? null, `${where}形状填充`, true),
        line: color(value.line ?? null, `${where}形状线条`, true),
        lineWidth: num(value.lineWidth ?? 0, 0, 20, `${where}线宽`),
        text: text(value.text ?? "", 1000, `${where}形状文字`),
        textColor: color(value.textColor ?? "text", `${where}形状文字`),
        size: num(value.size ?? 14, 6, 120, `${where}形状字号`),
      };
    default:
      return fail(`${where}元素类型无效。`);
  }
}

function parseSlide(value: unknown, index: number, draft: boolean): Slide {
  const where = `第 ${index + 1} 页`;
  if (!isRecord(value) || typeof value.id !== "string" || !ID.test(value.id)) return fail(`${where}标识无效。`);
  if (!Array.isArray(value.elements) || value.elements.length > LIMITS.elements)
    return fail(`${where}最多 ${LIMITS.elements} 个元素。`);
  const ids = new Set<string>();
  const elements = value.elements.map((el) => {
    const parsed = parseElement(el, draft, where);
    if (ids.has(parsed.id)) fail(`${where}元素标识重复。`);
    ids.add(parsed.id);
    return parsed;
  });
  return {
    id: value.id,
    layout: oneOf(value.layout, LAYOUT_IDS, `${where}版式`),
    elements,
    notes: text(value.notes ?? "", LIMITS.notes, `${where}演讲备注`),
    hidden: bool(value.hidden),
  };
}

function parseDeck(value: unknown, draft: boolean): Deck {
  if (isLegacyDeck(value)) return migrateLegacyDeck(value);
  if (!isRecord(value) || value.version !== 2 || !Array.isArray(value.slides))
    return fail("演示文稿格式无效。");
  if (value.slides.length < 1 || value.slides.length > LIMITS.slides) fail(`演示文稿需要 1–${LIMITS.slides} 页。`);
  const theme = parseTheme(value.theme, draft);
  const ids = new Set<string>();
  const slides = value.slides.map((slide, index) => {
    const parsed = parseSlide(slide, index, draft);
    if (ids.has(parsed.id)) fail("页面标识重复。");
    ids.add(parsed.id);
    return parsed;
  });
  return { version: 2, theme, slides };
}

export function validateDeck(value: unknown): Deck {
  return parseDeck(value, false);
}
/** Restores a persisted working copy: same structure and size limits, but unfinished business values are kept. */
export function restoreDeckDraft(value: unknown): Deck {
  return parseDeck(value, true);
}

export function mediaIds(deck: Deck): string[] {
  const ids = new Set<string>();
  for (const slide of deck.slides)
    for (const el of slide.elements) if (el.type === "image" && el.mediaId) ids.add(el.mediaId);
  return [...ids];
}
export function plainText(paragraphs: Paragraph[]): string {
  return paragraphs.map((p) => p.runs.map((r) => r.text).join("")).join("\n");
}
export function paragraphsFromText(value: string, bullet = false): Paragraph[] {
  const lines = value.split(/\r?\n/);
  return lines.map((line) => ({ runs: line ? [{ text: line }] : [], ...(bullet ? { bullet: true } : {}) }));
}

// ---------- 0.3.0 legacy format ----------
interface LegacySlide {
  id: string;
  title: string;
  kicker: string;
  body: string;
  notes: string;
}
interface LegacyDeck {
  slides: LegacySlide[];
  theme: "ember" | "ink" | "paper";
}
function isLegacyDeck(value: unknown): value is LegacyDeck {
  return (
    isRecord(value) &&
    value.version === undefined &&
    typeof value.theme === "string" &&
    Array.isArray(value.slides) &&
    value.slides.every((s) => isRecord(s) && typeof s.body === "string" && !("elements" in s))
  );
}
export const LEGACY_THEMES: Record<LegacyDeck["theme"], Theme> = {
  ember: {
    preset: "ember",
    aspect: "16:9",
    colors: { background: "20242B", surface: "2C313A", text: "F8F2E9", muted: "C8C2B9", accent: "F2AA6B", accent2: "7FB8C9" },
    headFont: "Microsoft YaHei",
    bodyFont: "Microsoft YaHei",
  },
  ink: {
    preset: "ink",
    aspect: "16:9",
    colors: { background: "E9EEF2", surface: "FFFFFF", text: "243A4C", muted: "60768A", accent: "3C7198", accent2: "D9822B" },
    headFont: "Microsoft YaHei",
    bodyFont: "Microsoft YaHei",
  },
  paper: {
    preset: "paper",
    aspect: "16:9",
    colors: { background: "F7F1E6", surface: "FFFDF8", text: "40362C", muted: "8B7865", accent: "A26B48", accent2: "5E7D63" },
    headFont: "Microsoft YaHei",
    bodyFont: "Microsoft YaHei",
  },
};
/** Deterministic conversion of a 0.3.0 deck (title/kicker/body/notes) into the "title + content" layout. */
export function migrateLegacyDeck(value: LegacyDeck): Deck {
  if (!(value.theme in LEGACY_THEMES)) fail("旧版主题无效。");
  if (value.slides.length < 1 || value.slides.length > LIMITS.slides) fail(`演示文稿需要 1–${LIMITS.slides} 页。`);
  const ids = new Set<string>();
  const slides = value.slides.map((raw, index): Slide => {
    if (!isRecord(raw) || typeof raw.id !== "string" || !ID.test(raw.id) || ids.has(raw.id))
      return fail("页面标识无效或重复。");
    ids.add(raw.id);
    const title = text(raw.title, 400, "标题"),
      kicker = text(raw.kicker ?? "", 400, "页眉"),
      body = text(raw.body ?? "", 4000, "要点"),
      notes = text(raw.notes ?? "", LIMITS.notes, "备注");
    const lines = body.split("\n").filter((line) => line.trim());
    const elements: SlideElement[] = [
      textBox("kicker", 6, 4, 88, 5, [{ runs: [{ text: kicker || `SLIDE ${index + 1}` }] }], { size: 11, color: "accent", bold: true }),
      textBox("title", 6, 8, 88, 15, [{ runs: [{ text: title }] }], { slot: "title", font: "head", size: 30, bold: true, valign: "bottom" }),
      textBox("body", 6, 30, 88, 60, (lines.length ? lines : [""]).map((line) => ({ runs: line ? [{ text: line }] : [], bullet: true })), {
        slot: "body",
        size: 20,
        color: "muted",
        spaceAfter: 10,
        lineSpacing: 1.1,
      }),
    ];
    return { id: raw.id, layout: "content", elements, notes, hidden: false };
  });
  return { version: 2, theme: structuredClone(LEGACY_THEMES[value.theme]), slides };
}

export function textBox(
  id: string,
  x: number,
  y: number,
  w: number,
  h: number,
  paragraphs: Paragraph[],
  options: Partial<Omit<TextElement, "id" | "type" | "x" | "y" | "w" | "h" | "paragraphs">> = {},
): TextElement {
  return {
    id,
    type: "text",
    x,
    y,
    w,
    h,
    paragraphs,
    font: "body",
    size: 18,
    color: "text",
    align: "left",
    valign: "top",
    bold: false,
    italic: false,
    fill: null,
    lineSpacing: 1,
    spaceAfter: 0,
    ...options,
  };
}

export function moveSlide(deck: Deck, index: number, target: number): Deck {
  if (index < 0 || index >= deck.slides.length || target < 0 || target >= deck.slides.length || index === target) return deck;
  const slides = [...deck.slides];
  const [item] = slides.splice(index, 1);
  slides.splice(target, 0, item);
  return { ...deck, slides };
}
