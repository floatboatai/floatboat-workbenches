// ABOUTME: 富文本就地编辑的 DOM 与段落/文字片段互转；只识别加粗、斜体、下划线、颜色、链接与项目符号。
import { COLOR_ROLES, isSafeLink, type ColorRef, type Paragraph, type Run, type Theme } from "../contracts/domain";
import { resolveColor } from "../contracts/layouts";

export function renderParagraphs(root: HTMLElement, paragraphs: Paragraph[], theme: Theme) {
  root.replaceChildren(
    ...paragraphs.map((paragraph) => {
      const block = document.createElement("div");
      block.className = "para";
      if (paragraph.bullet) block.dataset.bullet = "1";
      if (paragraph.level) block.dataset.level = String(paragraph.level);
      const runs = paragraph.runs.filter((r) => r.text);
      if (!runs.length) block.append(document.createElement("br"));
      for (const run of runs) {
        let node: Node = document.createTextNode(run.text);
        const wrap = (tag: string, attrs: Record<string, string> = {}) => {
          const element = document.createElement(tag);
          for (const [key, value] of Object.entries(attrs)) element.setAttribute(key, value);
          element.append(node);
          node = element;
        };
        if (run.bold) wrap("b");
        if (run.italic) wrap("i");
        if (run.underline) wrap("u");
        if (run.color) wrap("font", { color: "#" + resolveColor(run.color, theme), "data-color": run.color });
        if (run.link) wrap("a", { href: run.link, "data-link": run.link });
        block.append(node);
      }
      return block;
    }),
  );
}

interface Style {
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  color?: ColorRef;
  link?: string;
}
function colorRef(raw: string, theme: Theme): ColorRef | undefined {
  const value = raw.trim();
  let hex = "";
  if (/^#?[0-9a-f]{6}$/i.test(value)) hex = value.replace("#", "").toUpperCase();
  else {
    const rgb = /^rgba?\((\d+),\s*(\d+),\s*(\d+)/i.exec(value);
    if (rgb) hex = rgb.slice(1, 4).map((n) => Number(n).toString(16).padStart(2, "0")).join("").toUpperCase();
  }
  if (!hex) return undefined;
  return COLOR_ROLES.find((role) => theme.colors[role] === hex) ?? hex;
}
function styleOf(element: HTMLElement, base: Style, theme: Theme): Style {
  const next = { ...base };
  const tag = element.tagName;
  if (tag === "B" || tag === "STRONG") next.bold = true;
  if (tag === "I" || tag === "EM") next.italic = true;
  if (tag === "U") next.underline = true;
  if (tag === "A") {
    const href = element.getAttribute("data-link") ?? element.getAttribute("href") ?? "";
    if (href) next.link = href;
  }
  if (tag === "FONT") {
    const role = element.getAttribute("data-color");
    const fromRole = role && ((COLOR_ROLES as readonly string[]).includes(role) || /^[0-9A-F]{6}$/i.test(role)) ? role : undefined;
    const attr = element.getAttribute("color");
    const resolved = attr ? colorRef(attr, theme) : undefined;
    next.color = fromRole && resolved && resolveColor(fromRole, theme) === resolved.toString().toUpperCase() ? fromRole : (resolved ?? fromRole);
  }
  const s = element.style;
  if (s.fontWeight) next.bold = s.fontWeight === "bold" || Number(s.fontWeight) >= 600;
  if (s.fontStyle) next.italic = s.fontStyle === "italic";
  const deco = s.textDecorationLine || s.textDecoration;
  if (deco) next.underline = deco.includes("underline");
  if (s.color) next.color = colorRef(s.color, theme) ?? next.color;
  return next;
}
const BLOCK = new Set(["DIV", "P", "LI", "UL", "OL", "H1", "H2", "H3", "H4", "H5", "H6", "BLOCKQUOTE"]);

export function parseParagraphs(root: HTMLElement, theme: Theme): Paragraph[] {
  const paragraphs: Paragraph[] = [];
  let current: Paragraph | null = null;
  const open = (source?: HTMLElement) => {
    current = { runs: [] };
    if (source?.dataset.bullet === "1") current.bullet = true;
    const level = Number(source?.dataset.level ?? 0);
    if (level > 0) current.level = Math.min(2, level);
    paragraphs.push(current);
    return current;
  };
  const push = (text: string, style: Style) => {
    if (!text) return;
    const paragraph: Paragraph = current ?? open();
    const run: Run = { text };
    if (style.bold) run.bold = true;
    if (style.italic) run.italic = true;
    if (style.underline) run.underline = true;
    if (style.color) run.color = style.color;
    if (style.link) run.link = style.link;
    const last = paragraph.runs[paragraph.runs.length - 1];
    if (last && JSON.stringify({ ...last, text: "" }) === JSON.stringify({ ...run, text: "" })) last.text += text;
    else paragraph.runs.push(run);
  };
  const walk = (node: Node, style: Style, block: HTMLElement | undefined) => {
    if (node.nodeType === Node.TEXT_NODE) {
      push((node.textContent ?? "").replace(/​/g, "").replace(/\n/g, " "), style);
      return;
    }
    if (!(node instanceof HTMLElement)) return;
    if (node.tagName === "BR") {
      if (!current) open(block);
      else if (node.nextSibling || node.parentElement !== block) open(block);
      return;
    }
    if (BLOCK.has(node.tagName)) {
      open(node);
      const inner = styleOf(node, style, theme);
      node.childNodes.forEach((child) => walk(child, inner, node));
      current = null;
      return;
    }
    const inner = styleOf(node, style, theme);
    node.childNodes.forEach((child) => walk(child, inner, block));
  };
  root.childNodes.forEach((child) => walk(child, {}, undefined));
  // Drop trailing empty paragraph created by a final <br> of a non-empty block.
  const result = paragraphs.length ? paragraphs : [{ runs: [] }];
  return result.slice(0, 60).map((p) => ({ ...p, runs: p.runs.slice(0, 40) }));
}

/** Blocks containing the current selection inside the editor root. */
export function selectedBlocks(root: HTMLElement): HTMLElement[] {
  const selection = getSelection();
  if (!selection || !selection.rangeCount) return [];
  const range = selection.getRangeAt(0);
  const blocks = [...root.querySelectorAll<HTMLElement>(":scope > div, :scope > p")];
  const hit = blocks.filter((block) => range.intersectsNode(block));
  if (hit.length) return hit;
  return [];
}
export function linkIsValid(value: string) {
  return isSafeLink(value);
}
