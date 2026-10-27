import { isRecord, boundedText, titleValue } from "./project.ts";

export const LIMITS = {
  slides: 50,
  markdown: 4000,
  notes: 2000,
  source: 100000,
  bytes: 350000,
  file: 400000,
} as const;
export interface Slide {
  id: string;
  markdown: string;
  notes: string;
}
export interface Deck {
  version: 1;
  slides: Slide[];
  theme: "forest" | "paper" | "night";
  ratio: "wide" | "classic";
  transition: "none" | "fade" | "slide";
  fragments: boolean;
  numbers: boolean;
}
export const seed: Deck = {
  version: 1,
  theme: "forest",
  ratio: "wide",
  transition: "fade",
  fragments: false,
  numbers: true,
  slides: [
    {
      id: "opening",
      markdown:
        "# 把想法，\n# 讲给世界听。\n\n从一段文字，到一场有节奏的分享。\n\n**设计团队 · 周五分享**",
      notes:
        "先停顿两秒，和听众建立眼神交流。今天我们分享如何把一个想法讲清楚。",
    },
    {
      id: "story",
      markdown:
        "## 一次分享，三个问题\n\n- 为什么这个问题值得关注？\n- 我们看到了什么新的可能？\n- 听完之后，可以做什么？",
      notes: "用问题建立路线图。每个问题对应接下来的一段故事。",
    },
    {
      id: "focus",
      markdown:
        "## 一页，只说一件事\n\n> 留白，是让观点被听见的空间。\n\n删去多余的文字，\n把时间留给故事。",
      notes: "展示留白。让听众看完，再继续讲述。",
    },
    {
      id: "practice",
      markdown:
        "## 把节奏交给现场\n\n1. 先讲结论\n2. 给出一个具体例子\n3. 停下来，留一个问题\n\n**好的排练，从读出第一句话开始。**",
      notes: "可以开启「列表逐项出现」，逐条练习节奏。",
    },
    {
      id: "end",
      markdown:
        "# 现在，轮到你了。\n\n带着一个想法，开始下一次分享。\n\n**谢谢。**",
      notes: "留出提问时间。最后回到开场的问题。",
    },
  ],
};
function decodeDeck(value: unknown, draft = false): Deck {
  if (
    !isRecord(value) ||
    value.version !== 1 ||
    !Array.isArray(value.slides) ||
    value.slides.length < 1 ||
    value.slides.length > LIMITS.slides
  )
    throw new Error("演示需包含 1–50 页。");
  if (
    typeof value.theme !== "string" ||
    !["forest", "paper", "night"].includes(value.theme) ||
    typeof value.ratio !== "string" ||
    !["wide", "classic"].includes(value.ratio) ||
    typeof value.transition !== "string" ||
    !["none", "fade", "slide"].includes(value.transition) ||
    typeof value.fragments !== "boolean" ||
    typeof value.numbers !== "boolean"
  )
    throw new Error("演示显示设置无效。");
  const ids = new Set<string>();
  const slides = value.slides.map((row): Slide => {
    if (
      !isRecord(row) ||
      typeof row.id !== "string" ||
      !/^[a-zA-Z0-9_-]{1,80}$/.test(row.id) ||
      ids.has(row.id)
    )
      throw new Error("页面标识无效或重复。");
    ids.add(row.id);
    return {
      id: row.id,
      markdown: boundedText(row.markdown, LIMITS.markdown),
      notes: boundedText(row.notes, LIMITS.notes),
    };
  });
  const result: Deck = {
    version: 1,
    slides,
    theme: value.theme as Deck["theme"],
    ratio: value.ratio as Deck["ratio"],
    transition: value.transition as Deck["transition"],
    fragments: value.fragments,
    numbers: value.numbers,
  };
  if (
    !draft &&
    new TextEncoder().encode(JSON.stringify(result)).length > LIMITS.bytes
  )
    throw new Error("演示超过 350 KB，请减少内容。");
  return result;
}
export function validateDeck(value: unknown): Deck {
  return decodeDeck(value);
}
export function restoreDeck(value: unknown): Deck {
  return decodeDeck(value, true);
}
export function slideTitle(slide: Slide): string {
  return (
    slide.markdown
      .split("\n")
      .find((line) => line.trim())
      ?.replace(/^#+\s*/, "")
      .replace(/[*`]/g, "")
      .slice(0, 64) || "空白页"
  );
}
export function escapeHtml(text: string): string {
  return text.replace(
    /[&<>"']/g,
    (char) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        char
      ]!,
  );
}
function inline(text: string): string {
  // Only these literal delimiters produce markup. HTML, URLs and images remain text.
  return text
    .split(/(`[^`\n]+`)/g)
    .map((part) =>
      part.startsWith("`") && part.endsWith("`")
        ? "<code>" + escapeHtml(part.slice(1, -1)) + "</code>"
        : escapeHtml(part)
            .replace(/\*\*([^*\n]+)\*\*/g, "<strong>$1</strong>")
            .replace(/\*([^*\n]+)\*/g, "<em>$1</em>"),
    )
    .join("");
}
export function renderMarkdown(source: string, fragments = false): string {
  boundedText(source, LIMITS.markdown);
  const out: string[] = [];
  let list: "ul" | "ol" | null = null,
    fence = false,
    code: string[] = [];
  const close = () => {
    if (list) out.push(`</${list}>`);
    list = null;
  };
  for (const line of source.replace(/\r\n?/g, "\n").split("\n")) {
    if (/^\s*```/.test(line)) {
      close();
      if (fence) {
        out.push("<pre><code>" + escapeHtml(code.join("\n")) + "</code></pre>");
        code = [];
      }
      fence = !fence;
      continue;
    }
    if (fence) {
      code.push(line);
      continue;
    }
    const item = /^(?:[-*+]\s+|\d+\.\s+)(.*)$/.exec(line);
    if (item) {
      const kind = /^\d/.test(line) ? "ol" : "ul";
      if (list !== kind) {
        close();
        list = kind;
        out.push(`<${kind}>`);
      }
      out.push(
        `<li${fragments ? ' class="fragment"' : ""}>${inline(item[1])}</li>`,
      );
      continue;
    }
    close();
    if (!line.trim()) continue;
    const heading = /^(#{1,3})\s+(.*)$/.exec(line);
    out.push(
      heading
        ? `<h${heading[1].length}>${inline(heading[2])}</h${heading[1].length}>`
        : line.startsWith("> ")
          ? `<blockquote>${inline(line.slice(2))}</blockquote>`
          : `<p>${inline(line)}</p>`,
    );
  }
  close();
  if (fence)
    out.push("<pre><code>" + escapeHtml(code.join("\n")) + "</code></pre>");
  return out.join("\n") || '<p class="empty-slide">在右侧写下第一句话</p>';
}
export function deckSections(deck: Deck): string {
  return deck.slides
    .map(
      (slide) =>
        `<section data-slide-id="${slide.id}">${renderMarkdown(slide.markdown, deck.fragments)}<aside class="notes">${escapeHtml(slide.notes).replace(/\n/g, "<br>")}</aside></section>`,
    )
    .join("\n");
}
export function parseSource(source: string, settings: Deck = seed): Deck {
  boundedText(source, LIMITS.source);
  const slides: Slide[] = [];
  let body: string[] = [],
    notes: string[] = [],
    inNotes = false,
    fence = false;
  const push = () => {
    slides.push({
      id: crypto.randomUUID(),
      markdown: body.join("\n").trim(),
      notes: notes.join("\n").trim(),
    });
    body = [];
    notes = [];
    inNotes = false;
  };
  for (const line of source.replace(/\r\n?/g, "\n").split("\n")) {
    if (/^\s*```/.test(line)) fence = !fence;
    if (!fence && line.trim() === "---") {
      push();
      continue;
    }
    if (!fence && line.trim() === "Notes:" && !inNotes) {
      inNotes = true;
      continue;
    }
    (inNotes ? notes : body).push(line);
  }
  push();
  return validateDeck({ ...settings, slides });
}
export function toSource(deck: Deck): string {
  return deck.slides
    .map(
      (slide) =>
        slide.markdown + (slide.notes ? "\n\nNotes:\n" + slide.notes : ""),
    )
    .join("\n\n---\n\n");
}
export function portableSource(deck: Deck): string {
  const source = toSource(deck);
  const restored = parseSource(source, deck);
  if (
    restored.slides.length !== deck.slides.length ||
    restored.slides.some(
      (slide, index) =>
        slide.markdown !==
          deck.slides[index].markdown.replace(/\r\n?/g, "\n").trim() ||
        slide.notes !== deck.slides[index].notes.replace(/\r\n?/g, "\n").trim(),
    )
  )
    throw new Error(
      "正文中的分页标记或未闭合代码围栏影响整稿结构，请使用项目备份保留原文。",
    );
  return source;
}
export function exportProject(deck: Deck, title: string): string {
  return JSON.stringify(
    {
      format: "reveal-desk",
      version: 1,
      title: titleValue(title),
      data: validateDeck(deck),
    },
    null,
    2,
  );
}
export function importProject(raw: unknown): {
  title: string;
  data: Deck;
  extra: Record<string, unknown>;
} {
  if (!isRecord(raw)) throw new Error("项目文件格式无效。");
  if (raw.format === "reveal-desk" && raw.version === 1)
    return {
      title: titleValue(raw.title),
      data: validateDeck(raw.data),
      extra: {},
    };
  // Recovery exports are working copies, imported as a new document without replaying mutations.
  if (isRecord(raw.snapshot) && isRecord(raw.snapshot.extra)) {
    const extra: Record<string, unknown> = {};
    const source = raw.snapshot.extra.source;
    if (typeof source === "string")
      extra.source = boundedText(source, LIMITS.source);
    if (raw.snapshot.extra.sourceOpen === true) extra.sourceOpen = true;
    if (typeof raw.snapshot.extra.selected === "string")
      extra.selected = raw.snapshot.extra.selected.slice(0, 80);
    return {
      title: boundedText(raw.snapshot.title, 120),
      data: restoreDeck(raw.snapshot.data),
      extra,
    };
  }
  throw new Error("请选择 Reveal 排练桌导出的项目或恢复文件。");
}
export function moveSlide(deck: Deck, index: number, delta: number): Deck {
  const target = index + delta;
  if (
    index < 0 ||
    index >= deck.slides.length ||
    target < 0 ||
    target >= deck.slides.length
  )
    return deck;
  const slides = [...deck.slides];
  const [slide] = slides.splice(index, 1);
  slides.splice(target, 0, slide);
  return { ...deck, slides };
}
