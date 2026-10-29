// ABOUTME: AI 大纲的结构化格式：校验模型返回的 JSON，并转换成使用当前主题与母版版式的文稿。
import { isRecord } from "./project.ts";
import { paragraphsFromText, validateDeck, type Deck, type LayoutId, type Slide, type SlideElement, type Theme } from "./domain.ts";
import { LAYOUTS } from "./layouts.ts";

const OUTLINE_LAYOUTS = ["title", "section", "content", "two-column", "comparison", "quote"] as const;
type OutlineLayout = (typeof OUTLINE_LAYOUTS)[number];
export interface OutlineSlide {
  layout: OutlineLayout;
  title: string;
  subtitle: string;
  bullets: string[];
  right: string[];
  leftHeading: string;
  rightHeading: string;
  notes: string;
}
export interface Outline {
  title: string;
  slides: OutlineSlide[];
}
export interface OutlineSuggestion {
  title: string;
  deck: Deck;
}

export const OUTLINE_INSTRUCTIONS = [
  "你是演示文稿策划。根据用户要求生成中文演示大纲，只返回一个 JSON 对象，不要 Markdown 围栏或解释。",
  '格式：{"title":"文稿名称","slides":[{"layout":"title|section|content|two-column|comparison|quote","title":"标题","subtitle":"副标题或出处","bullets":["要点"],"right":["右栏要点"],"leftHeading":"左侧小标题","rightHeading":"右侧小标题","notes":"演讲备注"}]}。',
  "4 至 12 页；第一页用 title；章节分隔用 section；对比两种方案用 comparison 并填写 leftHeading/rightHeading/bullets/right；双栏用 two-column；一句话观点用 quote（title 写引用，subtitle 写出处）。",
  "title 不超过 40 字，每页 bullets 最多 6 条，每条不超过 40 字，notes 不超过 300 字。没有的字段可以省略。",
].join("");

const str = (value: unknown, max: number) => (typeof value === "string" ? value.trim().slice(0, max) : "");
const list = (value: unknown) =>
  Array.isArray(value)
    ? value
        .map((item) => str(item, 120))
        .filter(Boolean)
        .slice(0, 8)
    : [];

export function parseOutline(value: unknown): Outline {
  if (!isRecord(value) || !Array.isArray(value.slides)) throw new Error("模型返回的大纲缺少 slides。");
  const slides = value.slides.slice(0, 20).map((raw): OutlineSlide => {
    if (!isRecord(raw)) throw new Error("模型返回的页面格式无效。");
    const layout = OUTLINE_LAYOUTS.includes(raw.layout as OutlineLayout) ? (raw.layout as OutlineLayout) : "content";
    return {
      layout,
      title: str(raw.title, 120),
      subtitle: str(raw.subtitle, 200),
      bullets: list(raw.bullets),
      right: list(raw.right),
      leftHeading: str(raw.leftHeading, 60),
      rightHeading: str(raw.rightHeading, 60),
      notes: str(raw.notes, 2000),
    };
  });
  if (!slides.length || slides.every((s) => !s.title)) throw new Error("模型没有返回可用的页面。");
  return { title: str(value.title, 120) || slides[0].title || "AI 大纲", slides };
}

function fill(layout: LayoutId, slot: string, value: string | string[], index: number): SlideElement | null {
  const def = LAYOUTS[layout].slots.find((s) => s.name === slot);
  if (!def) return null;
  const base = def.make();
  if (base.type !== "text") return null;
  const bullet = Array.isArray(value);
  const paragraphs = bullet ? (value.length ? value : [""]).flatMap((line) => paragraphsFromText(line, true)) : paragraphsFromText(value);
  return { ...base, id: `${slot}-${index}`, slot: def.name, paragraphs } as SlideElement;
}

export function outlineToDeck(outline: Outline, theme: Theme): Deck {
  const slides = outline.slides.map((s, i): Slide => {
    const parts: (SlideElement | null)[] = [];
    switch (s.layout) {
      case "title":
        parts.push(fill("title", "title", s.title, i), fill("title", "subtitle", s.subtitle, i));
        break;
      case "section":
        parts.push(fill("section", "kicker", String(i).padStart(2, "0"), i), fill("section", "title", s.title, i), fill("section", "subtitle", s.subtitle, i));
        break;
      case "two-column":
        parts.push(fill(s.layout, "title", s.title, i), fill(s.layout, "body", s.bullets, i), fill(s.layout, "body2", s.right, i));
        break;
      case "comparison":
        parts.push(
          fill(s.layout, "title", s.title, i),
          fill(s.layout, "heading1", s.leftHeading || "方案 A", i),
          fill(s.layout, "body", s.bullets, i),
          fill(s.layout, "heading2", s.rightHeading || "方案 B", i),
          fill(s.layout, "body2", s.right, i),
        );
        break;
      case "quote":
        parts.push(fill("quote", "quote", s.title, i), fill("quote", "byline", s.subtitle ? `—— ${s.subtitle.replace(/^[—-]+\s*/, "")}` : "", i));
        break;
      default:
        parts.push(fill("content", "title", s.title, i), fill("content", "body", s.bullets, i));
    }
    return { id: `ai-${i + 1}`, layout: s.layout, elements: parts.filter((p): p is SlideElement => p !== null), notes: s.notes, hidden: false };
  });
  return validateDeck({ version: 2, theme, slides });
}
