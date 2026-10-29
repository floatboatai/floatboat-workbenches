// ABOUTME: 用官方 @tiptap/markdown 在 Markdown 与文稿 JSON 之间转换；导入结果先清理成受支持的安全结构，再交给 validateWriting。
import type { JSONContent } from "@tiptap/core";
import { MarkdownManager } from "@tiptap/markdown";
import { documentExtensions } from "./schema.ts";
import {
  isDataImage,
  plainText,
  safeHref,
  validateWriting,
  type WritingProject,
} from "./domain.ts";

let manager: MarkdownManager | null = null;
function markdown(): MarkdownManager {
  return (manager ??= new MarkdownManager({
    extensions: documentExtensions(),
    indentation: { style: "space", size: 2 },
  }));
}

export interface MarkdownImport {
  title: string | null;
  data: WritingProject;
  notes: string[];
}

const BLOCK = new Set([
  "paragraph",
  "heading",
  "bulletList",
  "orderedList",
  "taskList",
  "blockquote",
  "codeBlock",
  "horizontalRule",
  "table",
  "image",
]);
const MARKS = new Set(["bold", "italic", "underline", "strike", "code", "highlight"]);
const LANGUAGE = /^[A-Za-z0-9_+#.-]{1,40}$/;

interface Tally {
  remoteImages: number;
  unsafeLinks: number;
  dropped: number;
  clampedHeadings: number;
}

function text(value: string, marks?: JSONContent["marks"]): JSONContent {
  return marks?.length ? { type: "text", text: value, marks } : { type: "text", text: value };
}

function imageFallback(node: JSONContent, tally: Tally): JSONContent {
  tally.remoteImages++;
  const src = typeof node.attrs?.src === "string" ? node.attrs.src : "";
  const alt = typeof node.attrs?.alt === "string" && node.attrs.alt.trim() ? node.attrs.alt.trim() : "图片";
  const href = safeHref(src);
  const label = `［图片：${alt}］`;
  return href
    ? text(label, [{ type: "link", attrs: { href } }])
    : text(label);
}

function cleanMarks(marks: JSONContent["marks"], tally: Tally): JSONContent["marks"] {
  const output: NonNullable<JSONContent["marks"]> = [];
  for (const mark of marks ?? []) {
    if (mark.type === "link") {
      const href = safeHref(mark.attrs?.href);
      if (href) output.push({ type: "link", attrs: { href } });
      else tally.unsafeLinks++;
    } else if (MARKS.has(mark.type)) output.push({ type: mark.type });
  }
  return output;
}

function inline(nodes: JSONContent[] | undefined, tally: Tally): JSONContent[] {
  const output: JSONContent[] = [];
  for (const node of nodes ?? []) {
    if (node.type === "text") {
      if (node.text) output.push(text(node.text, cleanMarks(node.marks, tally)));
    } else if (node.type === "hardBreak") output.push({ type: "hardBreak" });
    else if (node.type === "image") {
      if (isDataImage(node.attrs?.src)) {
        // 行内出现的内嵌图片无法放进段落，保留为替代文字，避免丢失信息。
        output.push(text(`［图片：${String(node.attrs?.alt || "内嵌图片")}］`));
      } else output.push(imageFallback(node, tally));
    } else {
      const flattened = plainText(node);
      if (flattened) output.push(text(flattened));
      else tally.dropped++;
    }
  }
  return output;
}

function paragraph(content: JSONContent[] = []): JSONContent {
  return content.length ? { type: "paragraph", content } : { type: "paragraph" };
}

function blocks(nodes: JSONContent[] | undefined, tally: Tally): JSONContent[] {
  const output: JSONContent[] = [];
  for (const node of nodes ?? []) output.push(...block(node, tally));
  return output;
}

function nonEmpty(nodes: JSONContent[]): JSONContent[] {
  return nodes.length ? nodes : [paragraph()];
}

function itemContent(node: JSONContent, tally: Tally): JSONContent[] {
  const content = blocks(node.content, tally);
  if (content[0]?.type !== "paragraph") content.unshift(paragraph());
  return content;
}

function block(node: JSONContent, tally: Tally): JSONContent[] {
  switch (node.type) {
    case "paragraph": {
      const align = node.attrs?.textAlign;
      const result = paragraph(inline(node.content, tally));
      if (typeof align === "string" && align !== "left") result.attrs = { textAlign: align };
      return [result];
    }
    case "heading": {
      const raw = typeof node.attrs?.level === "number" ? node.attrs.level : 1;
      const level = Math.min(Math.max(raw, 1), 3);
      if (level !== raw) tally.clampedHeadings++;
      const content = inline(node.content, tally);
      return [content.length ? { type: "heading", attrs: { level }, content } : { type: "heading", attrs: { level } }];
    }
    case "blockquote":
      return [{ type: "blockquote", content: nonEmpty(blocks(node.content, tally)) }];
    case "bulletList":
    case "orderedList": {
      const items = (node.content ?? [])
        .filter((child) => child.type === "listItem" || child.type === "taskItem")
        .map((child) => ({ type: "listItem", content: itemContent(child, tally) }));
      if (!items.length) return [];
      const start = node.attrs?.start;
      return [
        node.type === "orderedList" && typeof start === "number" && Number.isInteger(start) && start > 1 && start <= 100000
          ? { type: "orderedList", attrs: { start }, content: items }
          : { type: node.type, content: items },
      ];
    }
    case "taskList": {
      const items = (node.content ?? [])
        .filter((child) => child.type === "taskItem" || child.type === "listItem")
        .map((child) => ({
          type: "taskItem",
          attrs: { checked: child.attrs?.checked === true },
          content: itemContent(child, tally),
        }));
      return items.length ? [{ type: "taskList", content: items }] : [];
    }
    case "codeBlock": {
      const code = plainText(node);
      const first = typeof node.attrs?.language === "string" ? node.attrs.language.trim().split(/\s+/)[0] : "";
      const result: JSONContent = { type: "codeBlock" };
      if (first && LANGUAGE.test(first)) result.attrs = { language: first.toLowerCase() };
      if (code) result.content = [text(code)];
      return [result];
    }
    case "horizontalRule":
      return [{ type: "horizontalRule" }];
    case "image":
      if (isDataImage(node.attrs?.src)) {
        const attrs: Record<string, unknown> = { src: node.attrs?.src };
        if (typeof node.attrs?.alt === "string" && node.attrs.alt) attrs.alt = node.attrs.alt.slice(0, 1000);
        if (typeof node.attrs?.title === "string" && node.attrs.title) attrs.title = node.attrs.title.slice(0, 1000);
        return [{ type: "image", attrs }];
      }
      return [paragraph([imageFallback(node, tally)])];
    case "table": {
      const rows = (node.content ?? [])
        .filter((child) => child.type === "tableRow")
        .map((child) => ({
          type: "tableRow",
          content: (child.content ?? [])
            .filter((cell) => cell.type === "tableCell" || cell.type === "tableHeader")
            .map((cell) => ({
              type: cell.type,
              attrs: { colspan: 1, rowspan: 1, colwidth: null },
              content: nonEmpty(blocks(cell.content, tally)),
            })),
        }))
        .filter((row) => row.content.length);
      return rows.length ? [{ type: "table", content: rows }] : [];
    }
    default: {
      if (node.type && BLOCK.has(node.type)) return [];
      // 不支持的块（例如原始 HTML）退化为可见的纯文字，而不是静默丢弃。
      const flattened = plainText(node).trim();
      if (flattened) return [paragraph([text(flattened)])];
      tally.dropped++;
      return [];
    }
  }
}

function frontmatterTitle(source: string): { title: string | null; body: string } {
  const match = /^---\n([\s\S]*?)\n---\n?/.exec(source);
  if (!match) return { title: null, body: source };
  const line = /^title:\s*(.+)$/m.exec(match[1]);
  const title = line ? line[1].trim().replace(/^(["'])(.*)\1$/, "$2").trim() : null;
  return { title: title || null, body: source.slice(match[0].length) };
}

/** Markdown → 受支持的文稿。extractTitle 为真时，frontmatter title 或首个一级标题成为文稿标题。 */
export function fromMarkdown(
  source: string,
  options: { extractTitle?: boolean } = {},
): MarkdownImport {
  const normalized = source.replace(/^﻿/, "").replace(/\r\n?/g, "\n");
  const front = options.extractTitle ? frontmatterTitle(normalized) : { title: null, body: normalized };
  const parsed = markdown().parse(front.body);
  const tally: Tally = { remoteImages: 0, unsafeLinks: 0, dropped: 0, clampedHeadings: 0 };
  const content = blocks(parsed.content, tally);
  let title = front.title;
  if (options.extractTitle && !title && content[0]?.type === "heading" && content[0].attrs?.level === 1) {
    const heading = plainText(content[0]).trim();
    if (heading && heading.length <= 120) {
      title = heading;
      content.shift();
    }
  }
  const data = validateWriting({ content: { type: "doc", content: nonEmpty(content) } });
  const notes: string[] = [];
  if (tally.remoteImages)
    notes.push(`${tally.remoteImages} 张外部图片未下载，已改为链接文字`);
  if (tally.unsafeLinks) notes.push(`${tally.unsafeLinks} 个不安全链接已移除，文字保留`);
  if (tally.clampedHeadings) notes.push(`${tally.clampedHeadings} 个四级以下标题已并入三级标题`);
  if (tally.dropped) notes.push(`${tally.dropped} 个空的或不支持的元素已忽略`);
  return { title: title ? title.slice(0, 120) : null, data, notes };
}

const EMPHASIS = new Set(["bold", "italic", "strike", "highlight", "underline"]);
const PUNCT = /[\p{P}\p{S}]/u;
const SPACE = /\s/;

/**
 * CommonMark 的定界符规则下，「**不足：**与」这类以中文标点收尾、紧接文字的强调不会闭合。
 * 导出前把强调范围两端紧贴文字的标点移到强调之外，保证 Markdown 能原样读回（仅标点本身不再加粗）。
 */
function flankSafe(node: JSONContent): JSONContent {
  if (!node.content) return node;
  const children = node.content.map(flankSafe);
  const output: JSONContent[] = [];
  children.forEach((child, index) => {
    const marks = child.marks ?? [];
    if (child.type !== "text" || !child.text || !marks.some((mark) => EMPHASIS.has(mark.type))) {
      output.push(child);
      return;
    }
    const before = output.at(-1)?.text?.at(-1) ?? "";
    const after = children[index + 1]?.text?.[0] ?? "";
    let value = child.text, lead = "", tail = "";
    if (before && !SPACE.test(before) && !PUNCT.test(before))
      while (value && PUNCT.test(value[0])) { lead += value[0]; value = value.slice(1); }
    if (after && !SPACE.test(after) && !PUNCT.test(after))
      while (value && PUNCT.test(value.at(-1)!)) { tail = value.at(-1)! + tail; value = value.slice(0, -1); }
    const plainMarks = marks.filter((mark) => !EMPHASIS.has(mark.type));
    const piece = (text: string, kept: JSONContent["marks"]) =>
      kept?.length ? { type: "text", text, marks: kept } : { type: "text", text };
    if (lead) output.push(piece(lead, plainMarks));
    if (value) output.push(piece(value, marks));
    if (tail) output.push(piece(tail, plainMarks));
  });
  return { ...node, content: output };
}

/** 文稿 → Markdown（GFM 表格、任务清单、==高亮==、++下划线++；对齐方式无法用 Markdown 表达）。 */
export function toMarkdown(title: string, content: JSONContent): string {
  const body = markdown().serialize(flankSafe(content)).replace(/\n{3,}/g, "\n\n").trim();
  const heading = title.trim() ? `# ${title.trim().replace(/\n/g, " ")}\n\n` : "";
  return `${heading}${body}\n`;
}

/** 供写作助手参考的正文：图片换成替代文字，避免把图片数据发送给模型。 */
export function markdownForPrompt(content: JSONContent, limit = 30000): string {
  const strip = (node: JSONContent): JSONContent =>
    node.type === "image"
      ? paragraph([text(`［图片：${String(node.attrs?.alt || "无替代文字")}］`)])
      : node.content
        ? { ...node, content: node.content.map(strip) }
        : node;
  const source = markdown().serialize(strip(content)).trim();
  return source.length > limit ? `${source.slice(0, limit)}\n\n（正文较长，后文已省略）` : source;
}
