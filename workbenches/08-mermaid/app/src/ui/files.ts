// ABOUTME: 导入 .mmd / .md 文件：读取文本、提取 Mermaid 代码块并推断图形名称。
import {
  extractMermaidBlocks,
  frontmatterTitle,
} from "../contracts/mermaid-source";
import { MAX_SOURCE } from "../contracts/model";

export const IMPORT_ACCEPT =
  ".mmd,.mermaid,.md,.markdown,.txt,text/markdown,text/plain";
const MAX_FILE = 4 * 1024 * 1024;

export interface ImportCandidate {
  title: string;
  source: string;
  line?: number;
}

const baseName = (name: string) =>
  name
    .replace(/\.[^.]+$/, "")
    .trim()
    .slice(0, 120) || "导入的图形";

/** 返回文件中的全部可导入图形；Markdown 可能有多个代码块。 */
export async function readDiagramFile(file: File): Promise<ImportCandidate[]> {
  if (file.size > MAX_FILE)
    throw new Error(`文件超过 ${MAX_FILE / 1024 / 1024} MiB，请拆分后再导入。`);
  const text = (await file.text()).replace(/^\uFEFF/, "");
  const name = baseName(file.name);
  const markdown = /\.(?:md|markdown)$/i.test(file.name);
  let candidates: ImportCandidate[];
  if (markdown) {
    const blocks = extractMermaidBlocks(text);
    if (!blocks.length)
      throw new Error("这个 Markdown 文件里没有 mermaid 代码块。");
    candidates = blocks.map((block, index) => ({
      source: block.source,
      line: block.line,
      title:
        frontmatterTitle(block.source) ||
        (block.title
          ? block.title.slice(0, 120)
          : blocks.length > 1
            ? `${name} · 图 ${index + 1}`
            : name),
    }));
  } else {
    const source = text.replace(/\r\n?/g, "\n").trim();
    if (!source) throw new Error("文件是空的。");
    candidates = [{ source, title: frontmatterTitle(source) || name }];
  }
  for (const candidate of candidates)
    if (candidate.source.length > MAX_SOURCE)
      throw new Error(
        `图形源码超过 ${MAX_SOURCE.toLocaleString("zh-CN")} 个字符，无法导入。`,
      );
  return candidates;
}
