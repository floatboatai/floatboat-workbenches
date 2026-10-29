// ABOUTME: 文稿 JSON 的唯一可信边界：节点语法、属性白名单、链接/图片安全与容量限制，以及字数、目录和示例文稿。
import type { JSONContent } from "@tiptap/core";
import { isRecord, boundedText } from "./project.ts";

export interface WritingProject {
  content: JSONContent;
}

/** 正文文字总量（不含图片数据）。 */
export const MAX_TEXT = 300_000;
export const MAX_NODES = 40_000;
export const MAX_DEPTH = 40;
/** 整份文稿 JSON（含内嵌图片）的 UTF-8 字节上限；低于自动保存请求上限，给标题与写作要求留出余量。 */
export const MAX_DOCUMENT_BYTES = 1_600_000;
/** 单张图片 data URL 的字符上限（压缩后的图片远小于此值）。 */
export const MAX_IMAGE_SRC = 1_200_000;
export const MAX_LINK = 2000;

const BLOCKS = new Set([
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
const INLINE = new Set(["text", "hardBreak"]);
const NODES = new Set([
  "doc",
  ...BLOCKS,
  ...INLINE,
  "listItem",
  "taskItem",
  "tableRow",
  "tableCell",
  "tableHeader",
]);
const MARKS = new Set([
  "bold",
  "italic",
  "underline",
  "strike",
  "code",
  "link",
  "highlight",
]);
const ALIGN = new Set(["left", "center", "right", "justify"]);
const DATA_IMAGE =
  /^data:image\/(?:png|jpeg|webp|gif);base64,[A-Za-z0-9+/]+={0,2}$/;
const LANGUAGE = /^[A-Za-z0-9_+#.-]{1,40}$/;

/** 只接受 http/https、mailto 与页内锚点；返回规范化后的地址或 null。 */
export function safeHref(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const href = value.trim();
  if (!href || href.length > MAX_LINK || /[\s<>"`]/.test(href)) return null;
  if (/^https?:\/\/[^/?#]+/i.test(href)) return href;
  if (/^mailto:[^@]+@[^@]+$/i.test(href)) return href;
  if (/^#[\w\-.:% -￿]*$/.test(href)) return href;
  return null;
}

/** 把用户在链接框里输入的文字补全为安全地址：example.com → https://example.com，a@b.com → mailto:。 */
export function normalizeLinkInput(value: string): string | null {
  const text = value.trim();
  if (!text) return null;
  if (/^[a-z][a-z0-9+.-]*:/i.test(text) || text.startsWith("#"))
    return safeHref(text);
  if (/^[^\s@/]+@[^\s@/]+\.[^\s@/]+$/.test(text)) return safeHref(`mailto:${text}`);
  if (/^(?:[\p{L}\p{N}-]+\.)+[\p{L}]{2,}(?::\d+)?(?:[/?#]\S*)?$/u.test(text))
    return safeHref(`https://${text}`);
  return null;
}

export function isDataImage(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length <= MAX_IMAGE_SRC &&
    DATA_IMAGE.test(value)
  );
}

function integer(value: unknown, min: number, max: number): number | null {
  return typeof value === "number" &&
    Number.isInteger(value) &&
    value >= min &&
    value <= max
    ? value
    : null;
}

function optionalText(value: unknown, max: number): string | null {
  if (value === undefined || value === null) return null;
  if (typeof value !== "string" || value.length > max)
    throw new Error(`属性文字不能超过 ${max} 个字符。`);
  return value;
}

function alignment(
  attrs: Record<string, unknown>,
  output: Record<string, unknown>,
) {
  const value = attrs.textAlign;
  if (value === undefined || value === null || value === "left") return;
  if (typeof value !== "string" || !ALIGN.has(value))
    throw new Error("对齐方式仅支持左、中、右和两端对齐。");
  output.textAlign = value;
}

export function documentBytes(content: JSONContent): number {
  return new TextEncoder().encode(JSON.stringify({ content })).length;
}

export function validateWriting(value: unknown): WritingProject {
  if (
    !isRecord(value) ||
    !isRecord(value.content) ||
    value.content.type !== "doc"
  )
    throw new Error("文档必须包含一个 doc 根节点。");
  let count = 0,
    total = 0;
  function node(input: unknown, depth = 0): JSONContent {
    if (!isRecord(input) || typeof input.type !== "string" || !NODES.has(input.type))
      throw new Error(
        `文档包含不支持的节点${isRecord(input) && typeof input.type === "string" ? `「${input.type.slice(0, 40)}」` : ""}。`,
      );
    if (depth > MAX_DEPTH) throw new Error(`文档嵌套不能超过 ${MAX_DEPTH} 层。`);
    if (++count > MAX_NODES) throw new Error(`文档节点不能超过 ${MAX_NODES} 个。`);
    const type = input.type;
    const output: JSONContent = { type };
    if (input.text !== undefined) {
      output.text = boundedText(input.text, MAX_TEXT);
      total += output.text.length;
      if (total > MAX_TEXT) throw new Error(`正文不能超过 ${MAX_TEXT} 个字符。`);
    }
    if (input.content !== undefined) {
      if (!Array.isArray(input.content)) throw new Error("子节点格式无效。");
      output.content = input.content.map((child) => node(child, depth + 1));
    }
    const attrs = isRecord(input.attrs) ? input.attrs : {};
    const outAttrs: Record<string, unknown> = {};
    switch (type) {
      case "heading": {
        const level = attrs.level ?? 1;
        if (integer(level, 1, 3) === null) throw new Error("标题级别仅支持 1–3。");
        outAttrs.level = level;
        alignment(attrs, outAttrs);
        break;
      }
      case "paragraph":
        alignment(attrs, outAttrs);
        break;
      case "orderedList":
        if (attrs.start !== undefined && attrs.start !== null) {
          const start = integer(attrs.start, 1, 100000);
          if (start === null) throw new Error("列表起始编号无效。");
          if (start !== 1) outAttrs.start = start;
        }
        break;
      case "codeBlock":
        if (typeof attrs.language === "string" && attrs.language) {
          if (!LANGUAGE.test(attrs.language))
            throw new Error("代码语言名称只能包含字母、数字和 + # . - _。");
          outAttrs.language = attrs.language;
        }
        break;
      case "taskItem":
        if (attrs.checked !== undefined && typeof attrs.checked !== "boolean")
          throw new Error("任务状态必须是勾选或未勾选。");
        outAttrs.checked = attrs.checked === true;
        break;
      case "image": {
        if (!isDataImage(attrs.src))
          throw new Error(
            "图片必须是文稿内嵌的 PNG、JPEG、WebP 或 GIF 数据，不能引用外部地址。",
          );
        outAttrs.src = attrs.src;
        const alt = optionalText(attrs.alt, 1000);
        if (alt) outAttrs.alt = alt;
        const title = optionalText(attrs.title, 1000);
        if (title) outAttrs.title = title;
        for (const key of ["width", "height"] as const) {
          if (attrs[key] === undefined || attrs[key] === null) continue;
          const size = integer(
            typeof attrs[key] === "string" ? Number(attrs[key]) : attrs[key],
            1,
            10000,
          );
          if (size === null) throw new Error("图片尺寸必须是 1–10000 的整数像素。");
          outAttrs[key] = size;
        }
        break;
      }
      case "tableCell":
      case "tableHeader": {
        const colspan = integer(attrs.colspan ?? 1, 1, 100);
        const rowspan = integer(attrs.rowspan ?? 1, 1, 1000);
        if (colspan === null || rowspan === null)
          throw new Error("单元格合并范围无效。");
        outAttrs.colspan = colspan;
        outAttrs.rowspan = rowspan;
        if (attrs.colwidth !== undefined && attrs.colwidth !== null) {
          if (
            !Array.isArray(attrs.colwidth) ||
            attrs.colwidth.length !== colspan ||
            attrs.colwidth.some((width) => integer(width, 1, 5000) === null)
          )
            throw new Error("表格列宽无效。");
          outAttrs.colwidth = [...attrs.colwidth];
        } else outAttrs.colwidth = null;
        break;
      }
    }
    if (Object.keys(outAttrs).length) output.attrs = outAttrs;
    if (input.marks !== undefined) {
      if (!Array.isArray(input.marks)) throw new Error("文字格式无效。");
      output.marks = input.marks.map((mark) => {
        if (!isRecord(mark) || typeof mark.type !== "string" || !MARKS.has(mark.type))
          throw new Error("不支持的文字格式。");
        if (mark.type === "link") {
          const href = isRecord(mark.attrs) ? safeHref(mark.attrs.href) : null;
          if (!href)
            throw new Error("链接仅支持 http、https、mailto 或页面锚点。");
          return {
            type: "link",
            attrs: { href, target: "_blank", rel: "noopener noreferrer" },
          };
        }
        return { type: mark.type };
      });
    }
    const children = output.content ?? [];
    const kinds = children.map((child) => child.type ?? "");
    const fail = (message: string) => {
      throw new Error(message);
    };
    if (type === "text") {
      if (!output.text || children.length)
        fail("文字节点必须包含非空文字，不能包含子节点。");
    } else if (output.text !== undefined) fail("只有文字节点能包含 text。");
    if (output.marks?.length && !INLINE.has(type))
      fail("块内容不能直接设置文字格式。");
    if (depth > 0 && type === "doc") fail("不能嵌套文档。");
    switch (type) {
      case "doc":
      case "blockquote":
      case "tableCell":
      case "tableHeader":
        if (!kinds.length || kinds.some((kind) => !BLOCKS.has(kind)))
          fail("文档、引用和单元格必须包含段落或其他块内容。");
        break;
      case "paragraph":
      case "heading":
        if (kinds.some((kind) => !INLINE.has(kind)))
          fail("段落和标题只能包含行内文字。");
        break;
      case "codeBlock":
        if (children.some((child) => child.type !== "text" || child.marks?.length))
          fail("代码块只能包含无格式的文字。");
        break;
      case "bulletList":
      case "orderedList":
        if (!kinds.length || kinds.some((kind) => kind !== "listItem"))
          fail("列表必须包含列表项。");
        break;
      case "taskList":
        if (!kinds.length || kinds.some((kind) => kind !== "taskItem"))
          fail("任务清单必须包含任务项。");
        break;
      case "listItem":
      case "taskItem":
        if (kinds[0] !== "paragraph" || kinds.some((kind) => !BLOCKS.has(kind)))
          fail("列表项必须以段落开始。");
        break;
      case "table":
        if (!kinds.length || kinds.some((kind) => kind !== "tableRow"))
          fail("表格必须由表格行组成。");
        break;
      case "tableRow":
        if (
          !kinds.length ||
          kinds.some((kind) => kind !== "tableCell" && kind !== "tableHeader")
        )
          fail("表格行必须包含单元格。");
        break;
      case "hardBreak":
      case "horizontalRule":
      case "image":
        if (children.length) fail("换行、分隔线和图片不能包含子节点。");
        break;
    }
    return output;
  }
  const content = node(value.content);
  if (documentBytes(content) > MAX_DOCUMENT_BYTES)
    throw new Error(
      `文稿（含图片）超过 ${(MAX_DOCUMENT_BYTES / 1_000_000).toFixed(1)} MB，请删除或替换部分图片。`,
    );
  return { content };
}

const BLOCK_JOIN = new Set([
  "doc",
  "bulletList",
  "orderedList",
  "taskList",
  "listItem",
  "taskItem",
  "blockquote",
  "table",
  "tableCell",
  "tableHeader",
]);

export function plainText(content: JSONContent): string {
  if (content.text) return content.text;
  if (content.type === "hardBreak") return "\n";
  const children = (content.content ?? []).map(plainText);
  if (content.type === "tableRow") return children.join("\t");
  return children.join(BLOCK_JOIN.has(content.type ?? "") ? "\n" : "");
}

const CJK = /[㐀-鿿豈-﫿぀-ヿ가-힯]/g;
const LATIN_WORD = /[A-Za-z0-9À-ɏ]+(?:['’.-][A-Za-z0-9À-ɏ]+)*/g;

export interface TextStats {
  /** 汉字/假名/谚文按字计，拉丁文字按词计。 */
  words: number;
  /** 不含空白的字符数。 */
  characters: number;
  /** 中文按每分钟 400 字估算阅读时间。 */
  minutes: number;
}

export function textStats(content: JSONContent): TextStats {
  const text = plainText(content);
  const cjk = text.match(CJK)?.length ?? 0;
  const latin = text.replace(CJK, " ").match(LATIN_WORD)?.length ?? 0;
  const words = cjk + latin;
  return {
    words,
    characters: text.replace(/\s/g, "").length,
    minutes: words ? Math.max(1, Math.round(words / 400)) : 0,
  };
}

export interface OutlineItem {
  /** 文档内全部标题的顺序号，与编辑器中 doc.descendants 的遍历顺序一致。 */
  index: number;
  level: number;
  text: string;
}

export function outline(content: JSONContent): OutlineItem[] {
  const items: OutlineItem[] = [];
  const walk = (node: JSONContent) => {
    if (node.type === "heading") {
      const level = typeof node.attrs?.level === "number" ? node.attrs.level : 1;
      items.push({ index: items.length, level, text: plainText(node).trim() });
      return;
    }
    node.content?.forEach(walk);
  };
  walk(content);
  return items;
}

export const blankDocument: WritingProject = {
  content: { type: "doc", content: [{ type: "paragraph" }] },
};
