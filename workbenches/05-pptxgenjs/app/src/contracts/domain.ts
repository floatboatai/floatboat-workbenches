import { isRecord, boundedText } from "./project.ts";
export interface Slide {
  id: string;
  title: string;
  kicker: string;
  body: string;
  notes: string;
}
export interface Deck {
  slides: Slide[];
  theme: "ember" | "ink" | "paper";
}
export function validateDeck(value: unknown): Deck {
  return parseDeck(value, false);
}
export function restoreDeckDraft(value: unknown): Deck {
  return parseDeck(value, true);
}
function parseDeck(value: unknown, draft: boolean): Deck {
  if (
    !isRecord(value) ||
    !Array.isArray(value.slides) ||
    value.slides.length < 1 ||
    value.slides.length > 30 ||
    !["ember", "ink", "paper"].includes(String(value.theme))
  )
    throw new Error("演示文稿需要 1–30 页，并选择有效主题。");
  const ids = new Set<string>();
  const slides = value.slides.map((item, index) => {
    if (
      !isRecord(item) ||
      typeof item.id !== "string" ||
      !/^[a-zA-Z0-9_-]{1,80}$/.test(item.id) ||
      ids.has(item.id)
    )
      throw new Error("页面标识无效或重复。");
    ids.add(item.id);
    const rawTitle = boundedText(item.title, 80),
      title = draft ? rawTitle : rawTitle.trim(),
      kicker = boundedText(item.kicker, 60),
      body = boundedText(item.body, 1000),
      notes = boundedText(item.notes, 4000);
    if (!draft && !title) throw new Error(`第 ${index + 1} 页需要标题。`);
    const lines = body.split("\n").filter((line) => line.trim());
    if (
      !draft &&
      (lines.length > 7 ||
        lines.some(
          (line) =>
            [...line].reduce(
              (n, char) => n + (char.charCodeAt(0) > 255 ? 2 : 1),
              0,
            ) > 70,
        ))
    )
      throw new Error(
        `第 ${index + 1} 页要点过长：最多 7 行，每行约 35 个汉字或 70 个英文字母。`,
      );
    return { id: item.id, title, kicker, body, notes };
  });
  return { slides, theme: value.theme as Deck["theme"] };
}
export const seed: Deck = {
  theme: "ember",
  slides: [
    {
      id: "opening",
      title: "把计划，变成下一步。",
      kicker: "QUARTERLY PLAN / 01",
      body: "明确这次汇报要回答的核心问题\n聚焦少数重要目标\n让每个行动都有负责人",
      notes: "用一个具体的业务场景作为开场。",
    },
    {
      id: "focus",
      title: "这一次，我们聚焦什么",
      kicker: "OUR FOCUS / 02",
      body: "目标：描述可衡量的结果\n路径：解释关键选择与依据\n节奏：列出阶段性里程碑",
      notes: "",
    },
    {
      id: "next",
      title: "下一步，从今天开始",
      kicker: "NEXT STEPS / 03",
      body: "确认负责人和协作方式\n安排第一次检查节点\n记录风险与待验证的假设",
      notes: "",
    },
  ],
};
export function moveSlide(deck: Deck, index: number, direction: -1 | 1): Deck {
  const target = index + direction;
  if (
    index < 0 ||
    index >= deck.slides.length ||
    target < 0 ||
    target >= deck.slides.length
  )
    return deck;
  const slides = [...deck.slides];
  [slides[index], slides[target]] = [slides[target], slides[index]];
  return { ...deck, slides };
}
