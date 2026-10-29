// ABOUTME: 浏览器端按需加载的渲染与转换：由校验过的 JSON 生成 HTML 片段/独立文档与 Markdown，供导出和生成稿预览使用。
import { generateHTML, type JSONContent } from "@tiptap/core";
import { documentExtensions } from "../contracts/schema";
import { validateWriting, type WritingProject } from "../contracts/domain";
import { htmlDocument } from "../contracts/files";
export { fromMarkdown, markdownForPrompt, toMarkdown } from "../contracts/markdown";

let extensions: ReturnType<typeof documentExtensions> | null = null;

export function renderFragment(content: JSONContent): string {
  return generateHTML(validateWriting({ content }).content, (extensions ??= documentExtensions()));
}

export function renderDocument(title: string, data: WritingProject): string {
  return htmlDocument(title, renderFragment(data.content));
}
