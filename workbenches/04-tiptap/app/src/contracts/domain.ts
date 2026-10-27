import type { JSONContent } from "@tiptap/core";
import { isRecord, boundedText } from "./project.ts";
export interface WritingProject {
  content: JSONContent;
}
const nodes = new Set([
  "doc",
  "paragraph",
  "text",
  "heading",
  "bulletList",
  "orderedList",
  "listItem",
  "blockquote",
  "codeBlock",
  "hardBreak",
  "horizontalRule",
]);
const marks = new Set([
  "bold",
  "italic",
  "underline",
  "strike",
  "code",
  "link",
]);
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
    if (
      !isRecord(input) ||
      typeof input.type !== "string" ||
      !nodes.has(input.type) ||
      depth > 20 ||
      ++count > 5000
    )
      throw new Error("文档结构过深或包含不支持的节点。");
    const output: JSONContent = { type: input.type };
    if (input.text !== undefined) {
      output.text = boundedText(input.text, 100000);
      total += output.text.length;
      if (total > 100000) throw new Error("正文不能超过 100000 个字符。");
    }
    if (input.content !== undefined) {
      if (!Array.isArray(input.content)) throw new Error("子节点格式无效。");
      output.content = input.content.map((child) => node(child, depth + 1));
    }
    if (input.type === "heading") {
      const level = isRecord(input.attrs) ? input.attrs.level : 1;
      if (typeof level !== "number" || ![1, 2, 3].includes(level))
        throw new Error("标题级别仅支持 1–3。");
      output.attrs = { level };
    }
    if (input.type === "orderedList" && isRecord(input.attrs)) {
      const start = input.attrs.start ?? 1;
      if (
        typeof start !== "number" ||
        !Number.isInteger(start) ||
        start < 1 ||
        start > 1000
      )
        throw new Error("列表起始编号无效。");
      output.attrs = { start };
    }
    if (
      input.type === "codeBlock" &&
      isRecord(input.attrs) &&
      typeof input.attrs.language === "string"
    )
      output.attrs = { language: boundedText(input.attrs.language, 40) };
    if (input.marks !== undefined) {
      if (!Array.isArray(input.marks)) throw new Error("文字格式无效。");
      output.marks = input.marks.map((mark) => {
        if (
          !isRecord(mark) ||
          typeof mark.type !== "string" ||
          !marks.has(mark.type)
        )
          throw new Error("不支持的文字格式。");
        if (mark.type === "link") {
          if (
            !isRecord(mark.attrs) ||
            typeof mark.attrs.href !== "string" ||
            !/^https?:\/\/|^mailto:|^#/.test(mark.attrs.href)
          )
            throw new Error("链接仅支持 http、https、mailto 或页面锚点。");
          return {
            type: "link",
            attrs: {
              href: boundedText(mark.attrs.href, 2000),
              target: "_blank",
              rel: "noopener noreferrer",
            },
          };
        }
        return { type: mark.type };
      });
    }
    const children = output.content ?? [];
    const blocks = [
      "paragraph",
      "heading",
      "bulletList",
      "orderedList",
      "blockquote",
      "codeBlock",
      "horizontalRule",
    ];
    if (input.type === "text") {
      if (!output.text || children.length)
        throw new Error("文字节点必须包含非空文字，不能包含子节点。");
    } else if (output.text !== undefined)
      throw new Error("只有文字节点能包含 text。");
    if (["hardBreak", "horizontalRule"].includes(input.type) && children.length)
      throw new Error("换行和分隔线不能包含子节点。");
    if (depth > 0 && input.type === "doc") throw new Error("不能嵌套文档。");
    if (
      ["doc", "blockquote"].includes(input.type) &&
      (!children.length ||
        children.some((child) => !blocks.includes(child.type ?? "")))
    )
      throw new Error("文档和引用必须包含段落或其他块内容。");
    if (
      ["paragraph", "heading"].includes(input.type) &&
      children.some(
        (child) => !["text", "hardBreak"].includes(child.type ?? ""),
      )
    )
      throw new Error("段落和标题只能包含行内文字。");
    if (
      input.type === "codeBlock" &&
      children.some((child) => child.type !== "text" || child.marks?.length)
    )
      throw new Error("代码块只能包含无格式的文字。");
    if (
      ["bulletList", "orderedList"].includes(input.type) &&
      (!children.length || children.some((child) => child.type !== "listItem"))
    )
      throw new Error("列表必须包含列表项。");
    if (
      input.type === "listItem" &&
      (children[0]?.type !== "paragraph" ||
        children.some((child) => !blocks.includes(child.type ?? "")))
    )
      throw new Error("列表项必须以段落开始。");
    if (output.marks?.length && !["text", "hardBreak"].includes(input.type))
      throw new Error("块内容不能直接设置文字格式。");
    return output;
  }
  return { content: node(value.content) };
}
export function plainText(content: JSONContent): string {
  if (content.text) return content.text;
  return (content.content ?? [])
    .map(plainText)
    .join(
      ["doc", "bulletList", "orderedList", "listItem", "blockquote"].includes(
        content.type ?? "",
      )
        ? "\n"
        : "",
    );
}
export const seed: WritingProject = {
  content: {
    type: "doc",
    content: [
      {
        type: "paragraph",
        content: [{ type: "text", text: "把散落的想法，写成清晰的方案。" }],
      },
      {
        type: "heading",
        attrs: { level: 2 },
        content: [{ type: "text", text: "我们要解决什么" }],
      },
      {
        type: "paragraph",
        content: [
          {
            type: "text",
            text: "从一个具体的问题开始，写下背景、目标与关键限制。",
          },
        ],
      },
      {
        type: "heading",
        attrs: { level: 2 },
        content: [{ type: "text", text: "下一步行动" }],
      },
      {
        type: "bulletList",
        content: [
          {
            type: "listItem",
            content: [
              {
                type: "paragraph",
                content: [{ type: "text", text: "确认目标读者与成功标准" }],
              },
            ],
          },
          {
            type: "listItem",
            content: [
              {
                type: "paragraph",
                content: [{ type: "text", text: "补充事实、例子与负责人" }],
              },
            ],
          },
        ],
      },
    ],
  },
};
