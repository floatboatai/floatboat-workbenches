// ABOUTME: 版式母版（装饰、占位、默认元素）、主题预设与颜色解析；舞台预览与 PPTX 导出共用同一份定义。
import {
  COLOR_ROLES,
  textBox,
  type ColorRef,
  type ColorRole,
  type Deck,
  type LayoutId,
  type Slide,
  type SlideElement,
  type SlotName,
  type Theme,
} from "./domain.ts";

export const THEME_PRESETS: { id: string; label: string; theme: Omit<Theme, "aspect"> }[] = [
  {
    id: "harbor",
    label: "港湾 · 商务蓝",
    theme: {
      preset: "harbor",
      colors: { background: "FFFFFF", surface: "EEF2F7", text: "1B2A3A", muted: "5B6B7C", accent: "1F5FAD", accent2: "E2813A" },
      headFont: "Microsoft YaHei",
      bodyFont: "Microsoft YaHei",
    },
  },
  {
    id: "ember",
    label: "暖橙 · 深夜",
    theme: {
      preset: "ember",
      colors: { background: "20242B", surface: "2C313A", text: "F8F2E9", muted: "C8C2B9", accent: "F2AA6B", accent2: "7FB8C9" },
      headFont: "Microsoft YaHei",
      bodyFont: "Microsoft YaHei",
    },
  },
  {
    id: "forest",
    label: "森林 · 报告绿",
    theme: {
      preset: "forest",
      colors: { background: "F5F7F2", surface: "FFFFFF", text: "1F2D24", muted: "5E6E62", accent: "2F7D4F", accent2: "C8A24B" },
      headFont: "Microsoft YaHei",
      bodyFont: "Microsoft YaHei",
    },
  },
  {
    id: "night",
    label: "深空 · 发布会",
    theme: {
      preset: "night",
      colors: { background: "0F1724", surface: "1A2436", text: "EEF2F8", muted: "9AA8BC", accent: "4FB3FF", accent2: "FF8A5B" },
      headFont: "Microsoft YaHei",
      bodyFont: "Microsoft YaHei",
    },
  },
  {
    id: "paper",
    label: "米白 · 纸张",
    theme: {
      preset: "paper",
      colors: { background: "F7F1E6", surface: "FFFDF8", text: "40362C", muted: "8B7865", accent: "A26B48", accent2: "5E7D63" },
      headFont: "Georgia",
      bodyFont: "Microsoft YaHei",
    },
  },
  {
    id: "coral",
    label: "珊瑚 · 活动",
    theme: {
      preset: "coral",
      colors: { background: "FFF8F4", surface: "FFFFFF", text: "2B2320", muted: "7A6A63", accent: "E4572E", accent2: "2A9D8F" },
      headFont: "Microsoft YaHei",
      bodyFont: "Microsoft YaHei",
    },
  },
];
export const FONT_CHOICES = [
  "Microsoft YaHei",
  "PingFang SC",
  "Source Han Sans SC",
  "Noto Sans SC",
  "SimHei",
  "KaiTi",
  "Arial",
  "Helvetica",
  "Calibri",
  "Segoe UI",
  "Georgia",
  "Times New Roman",
];
export const COLOR_LABELS: Record<ColorRole, string> = {
  background: "背景",
  surface: "面板",
  text: "正文",
  muted: "次要",
  accent: "强调",
  accent2: "辅助",
};
export function resolveColor(ref: ColorRef, theme: Theme): string {
  return (COLOR_ROLES as readonly string[]).includes(ref) ? theme.colors[ref as ColorRole] : ref.toUpperCase();
}
export function fontStack(font: string): string {
  const safe = font.replace(/["\\]/g, "");
  return `"${safe}", "PingFang SC", "Microsoft YaHei", "Noto Sans CJK SC", "Source Han Sans SC", "Helvetica Neue", Arial, sans-serif`;
}
export function chartPalette(theme: Theme): string[] {
  const c = theme.colors;
  return [c.accent, c.accent2, c.muted, mix(c.accent, c.background, 0.45), mix(c.accent2, c.background, 0.45), c.text, mix(c.accent, c.text, 0.5), mix(c.accent2, c.text, 0.5)];
}
export function mix(a: string, b: string, t: number): string {
  const pa = [0, 2, 4].map((i) => parseInt(a.slice(i, i + 2), 16));
  const pb = [0, 2, 4].map((i) => parseInt(b.slice(i, i + 2), 16));
  return pa.map((v, i) => Math.round(v + (pb[i] - v) * t).toString(16).padStart(2, "0")).join("").toUpperCase();
}

export interface Decor {
  kind: "rect" | "text";
  x: number;
  y: number;
  w: number;
  h: number;
  fill?: ColorRole;
  text?: string;
  size?: number;
  color?: ColorRole;
  font?: "head" | "body";
}
export interface SlotDef {
  name: SlotName;
  /** OOXML placeholder type when the slot is a text placeholder on the slide master. */
  placeholder?: "title" | "body";
  prompt: string;
  make: () => Omit<SlideElement, "id" | "slot">;
}
export interface LayoutDef {
  id: LayoutId;
  label: string;
  hint: string;
  background: ColorRole;
  numberColor: ColorRole | null;
  decor: Decor[];
  slots: SlotDef[];
}
const empty = [{ runs: [] }];
const titleSlot = (y = 8, h = 15): SlotDef => ({
  name: "title",
  placeholder: "title",
  prompt: "单击添加标题",
  make: () => textBox("", 6, y, 88, h, empty, { font: "head", size: 30, bold: true, valign: "bottom" }),
});
const bodySlot = (name: SlotName, x: number, y: number, w: number, h: number, prompt = "单击添加要点"): SlotDef => ({
  name,
  placeholder: "body",
  prompt,
  make: () => textBox("", x, y, w, h, [{ runs: [], bullet: true }], { size: 20, color: "text", spaceAfter: 10, lineSpacing: 1.1 }),
});
const rule = (x: number, y: number): Decor => ({ kind: "rect", x, y, w: 6, h: 0.7, fill: "accent" });

export const LAYOUTS: Record<LayoutId, LayoutDef> = {
  title: {
    id: "title",
    label: "标题页",
    hint: "封面：主标题、副标题与说明",
    background: "background",
    numberColor: null,
    decor: [
      { kind: "rect", x: 74, y: 0, w: 26, h: 100, fill: "surface" },
      { kind: "rect", x: 74, y: 0, w: 1.2, h: 100, fill: "accent" },
      { kind: "rect", x: 6, y: 59, w: 9, h: 0.9, fill: "accent" },
    ],
    slots: [
      {
        name: "kicker",
        prompt: "添加栏目或日期",
        make: () => textBox("", 6, 22, 62, 6, empty, { size: 12, bold: true, color: "accent" }),
      },
      {
        name: "title",
        placeholder: "title",
        prompt: "单击添加演示标题",
        make: () => textBox("", 6, 29, 64, 28, empty, { font: "head", size: 40, bold: true, valign: "bottom", lineSpacing: 1.05 }),
      },
      {
        name: "subtitle",
        placeholder: "body",
        prompt: "单击添加副标题",
        make: () => textBox("", 6, 63, 62, 16, empty, { size: 18, color: "muted" }),
      },
    ],
  },
  section: {
    id: "section",
    label: "章节页",
    hint: "强调色整页，用于分隔章节",
    background: "accent",
    numberColor: "background",
    decor: [{ kind: "rect", x: 8, y: 58, w: 12, h: 0.9, fill: "background" }],
    slots: [
      {
        name: "kicker",
        prompt: "章节编号",
        make: () => textBox("", 8, 26, 40, 12, empty, { font: "head", size: 44, bold: true, color: "background" }),
      },
      {
        name: "title",
        placeholder: "title",
        prompt: "单击添加章节标题",
        make: () => textBox("", 8, 38, 84, 18, empty, { font: "head", size: 40, bold: true, color: "background", valign: "bottom" }),
      },
      {
        name: "subtitle",
        placeholder: "body",
        prompt: "单击添加章节说明",
        make: () => textBox("", 8, 62, 72, 12, empty, { size: 16, color: "background" }),
      },
    ],
  },
  content: {
    id: "content",
    label: "标题 + 内容",
    hint: "标题与要点列表",
    background: "background",
    numberColor: "muted",
    decor: [rule(6, 25)],
    slots: [titleSlot(), bodySlot("body", 6, 30, 88, 60)],
  },
  "two-column": {
    id: "two-column",
    label: "双栏",
    hint: "标题与左右两栏",
    background: "background",
    numberColor: "muted",
    decor: [rule(6, 25)],
    slots: [titleSlot(), bodySlot("body", 6, 30, 42, 60), bodySlot("body2", 52, 30, 42, 60)],
  },
  comparison: {
    id: "comparison",
    label: "对比",
    hint: "两组小标题与要点并列比较",
    background: "background",
    numberColor: "muted",
    decor: [rule(6, 25), { kind: "rect", x: 6, y: 30, w: 42, h: 62, fill: "surface" }, { kind: "rect", x: 52, y: 30, w: 42, h: 62, fill: "surface" }],
    slots: [
      titleSlot(),
      {
        name: "heading1",
        placeholder: "body",
        prompt: "左侧小标题",
        make: () => textBox("", 8, 33, 38, 9, empty, { font: "head", size: 20, bold: true, color: "accent" }),
      },
      bodySlot("body", 8, 43, 38, 46),
      {
        name: "heading2",
        placeholder: "body",
        prompt: "右侧小标题",
        make: () => textBox("", 54, 33, 38, 9, empty, { font: "head", size: 20, bold: true, color: "accent2" }),
      },
      bodySlot("body2", 54, 43, 38, 46),
    ],
  },
  "image-text": {
    id: "image-text",
    label: "图文",
    hint: "左侧整幅图片，右侧标题与说明",
    background: "background",
    numberColor: "muted",
    decor: [rule(52, 36)],
    slots: [
      {
        name: "media",
        prompt: "插入图片",
        make: () => ({ type: "image", x: 0, y: 0, w: 46, h: 100, mediaId: "", fit: "cover", alt: "" }),
      },
      {
        name: "title",
        placeholder: "title",
        prompt: "单击添加标题",
        make: () => textBox("", 52, 10, 42, 24, empty, { font: "head", size: 30, bold: true, valign: "bottom" }),
      },
      bodySlot("body", 52, 40, 42, 50, "单击添加说明"),
    ],
  },
  quote: {
    id: "quote",
    label: "引用",
    hint: "一句话观点与出处",
    background: "surface",
    numberColor: "muted",
    decor: [{ kind: "text", x: 7, y: 6, w: 20, h: 30, text: "“", size: 160, color: "accent", font: "head" }],
    slots: [
      {
        name: "quote",
        placeholder: "body",
        prompt: "单击添加引用",
        make: () => textBox("", 12, 28, 76, 36, empty, { font: "head", size: 32, bold: true, valign: "middle", lineSpacing: 1.15 }),
      },
      {
        name: "byline",
        prompt: "添加出处",
        make: () => textBox("", 12, 68, 76, 8, empty, { size: 16, color: "muted" }),
      },
    ],
  },
  chart: {
    id: "chart",
    label: "图表",
    hint: "标题与原生图表",
    background: "background",
    numberColor: "muted",
    decor: [rule(6, 25)],
    slots: [
      titleSlot(),
      {
        name: "chart",
        prompt: "图表",
        make: () => ({
          type: "chart",
          x: 6,
          y: 29,
          w: 88,
          h: 63,
          chart: "bar",
          title: "",
          categories: ["一季度", "二季度", "三季度", "四季度"],
          series: [{ name: "系列 1", values: ["12", "18", "15", "22"] }],
          legend: true,
          labels: true,
        }),
      },
    ],
  },
  table: {
    id: "table",
    label: "表格",
    hint: "标题与可编辑表格",
    background: "background",
    numberColor: "muted",
    decor: [rule(6, 25)],
    slots: [
      titleSlot(),
      {
        name: "table",
        prompt: "表格",
        make: () => ({
          type: "table",
          x: 6,
          y: 30,
          w: 88,
          h: 40,
          rows: [
            ["项目", "目标", "进度"],
            ["", "", ""],
            ["", "", ""],
          ],
          header: true,
          banded: true,
          size: 14,
        }),
      },
    ],
  },
  blank: {
    id: "blank",
    label: "空白",
    hint: "只保留背景与页码，自由放置",
    background: "background",
    numberColor: "muted",
    decor: [],
    slots: [],
  },
};

export const NUMBER_BOX = { x: 86, y: 92, w: 9, h: 5, size: 10 };

let counter = 0;
export function newId(prefix: string): string {
  counter = (counter + 1) % 1e6;
  const random =
    typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID().slice(0, 8) : Math.random().toString(36).slice(2, 10);
  return `${prefix}-${random}${counter.toString(36)}`;
}
export function slotElement(layout: LayoutId, slot: SlotName, id = newId(slot)): SlideElement {
  const def = LAYOUTS[layout].slots.find((s) => s.name === slot);
  if (!def) throw new Error(`版式 ${layout} 没有 ${slot} 占位。`);
  return { ...structuredClone(def.make()), id, slot } as SlideElement;
}
export function newSlide(layout: LayoutId): Slide {
  return {
    id: newId("slide"),
    layout,
    elements: LAYOUTS[layout].slots.map((slot) => slotElement(layout, slot.name)),
    notes: "",
    hidden: false,
  };
}
/** Switches a slide to another master: matching slots move to the new boxes, missing slots are created, leftovers become free elements. */
export function applyLayout(slide: Slide, layout: LayoutId): Slide {
  const def = LAYOUTS[layout];
  const used = new Set<SlotName>();
  const elements: SlideElement[] = slide.elements.map((el) => {
    const target = el.slot ? def.slots.find((s) => s.name === el.slot) : undefined;
    if (!el.slot) return el;
    if (!target) {
      const { slot: _slot, ...free } = el;
      return free as SlideElement;
    }
    const fresh = target.make();
    used.add(target.name);
    if (fresh.type !== el.type) {
      const { slot: _slot, ...free } = el;
      used.delete(target.name);
      return free as SlideElement;
    }
    return { ...el, x: fresh.x, y: fresh.y, w: fresh.w, h: fresh.h };
  });
  for (const slot of def.slots) if (!used.has(slot.name)) elements.push(slotElement(layout, slot.name));
  return { ...slide, layout, elements };
}
export function slotBox(layout: LayoutId, slot: SlotName | undefined) {
  if (!slot) return null;
  const def = LAYOUTS[layout].slots.find((s) => s.name === slot);
  return def ? def.make() : null;
}
/** True when a slot element still sits exactly on its master placeholder, so the export can bind it to that placeholder. */
export function onPlaceholder(layout: LayoutId, el: SlideElement): "title" | "body" | null {
  const def = el.slot ? LAYOUTS[layout].slots.find((s) => s.name === el.slot) : undefined;
  if (!def?.placeholder || el.type !== "text") return null;
  const box = def.make();
  const near = (a: number, b: number) => Math.abs(a - b) < 0.05;
  return near(box.x, el.x) && near(box.y, el.y) && near(box.w, el.w) && near(box.h, el.h) ? def.placeholder : null;
}
export function slidePrompt(layout: LayoutId, slot: SlotName | undefined): string {
  return (slot && LAYOUTS[layout].slots.find((s) => s.name === slot)?.prompt) || "双击输入文字";
}
export function defaultTheme(): Theme {
  return { ...structuredClone(THEME_PRESETS[0].theme), aspect: "16:9" };
}
export function usesMedia(deck: Deck, mediaId: string): boolean {
  return deck.slides.some((s) => s.elements.some((e) => e.type === "image" && e.mediaId === mediaId));
}
