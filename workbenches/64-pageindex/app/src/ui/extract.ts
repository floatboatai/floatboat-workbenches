// ABOUTME: 用PDF.js读取每页原文、PDF书签或版面标题，生成本地章节树；不依赖外部服务。
import type { PDFDocumentProxy } from "pdfjs-dist";
import {
  buildTree,
  detectHeadings,
  linesFromRuns,
  pageRanges,
  pageText,
  type Line,
  type OutlineEntry,
  type TextRun,
} from "../contracts/outline.ts";
import {
  EXTRACTOR,
  MAX_PAGE_TEXT,
  MAX_PAGES,
  MAX_TEXT,
  type IndexNode,
} from "../contracts/reader.ts";

export type Extraction = {
  engineVersion: string;
  pages: { number: number; text: string }[];
  index: {
    doc_title: string;
    toc_source: "pdf-outline" | "heading-scan" | "page-ranges";
    has_abstract_or_references_section: boolean;
    structure: IndexNode[];
  };
};

type RawItem = { str?: unknown; transform?: unknown; hasEOL?: unknown };
export function runsOf(items: readonly unknown[]): TextRun[] {
  const runs: TextRun[] = [];
  for (const raw of items) {
    const item = raw as RawItem;
    if (typeof item.str !== "string" || !Array.isArray(item.transform)) continue;
    const t = item.transform as number[];
    runs.push({
      str: item.str,
      x: Number(t[4]) || 0,
      y: Number(t[5]) || 0,
      size: Math.hypot(Number(t[2]) || 0, Number(t[3]) || 0),
      eol: item.hasEOL === true,
    });
  }
  return runs;
}

type OutlineItem = { title: string; dest: string | unknown[] | null; items: OutlineItem[] };
async function outlineEntries(
  pdf: PDFDocumentProxy,
  heights: number[],
): Promise<OutlineEntry[]> {
  const root = (await pdf.getOutline()) as OutlineItem[] | null;
  if (!root?.length) return [];
  const entries: OutlineEntry[] = [];
  async function walk(items: OutlineItem[], level: number) {
    for (const item of items) {
      if (entries.length >= 3000) return;
      try {
        const dest =
          typeof item.dest === "string"
            ? await pdf.getDestination(item.dest)
            : item.dest;
        if (Array.isArray(dest) && dest.length) {
          const ref = dest[0] as unknown;
          const index =
            typeof ref === "number"
              ? ref
              : ref && typeof ref === "object"
                ? await pdf.getPageIndex(ref as Parameters<PDFDocumentProxy["getPageIndex"]>[0])
                : -1;
          if (index >= 0 && index < pdf.numPages) {
            const kind = (dest[1] as { name?: unknown } | null)?.name,
              top = kind === "XYZ" && typeof dest[3] === "number"
                ? dest[3] >= (heights[index] ?? 842) * 0.8
                : true;
            entries.push({ title: String(item.title ?? ""), page: index + 1, level, top });
          }
        }
      } catch {
        /* A broken bookmark is skipped; the rest of the outline stays usable. */
      }
      if (item.items?.length) await walk(item.items, level + 1);
    }
  }
  await walk(root, 0);
  return entries.filter((e) => e.title.trim());
}

/** Reads every page's text and builds the reader's own chapter tree. */
export async function extractDocument(
  pdf: PDFDocumentProxy,
  progress: (done: number, total: number) => void = () => {},
  signal?: { aborted: boolean },
): Promise<Extraction> {
  if (pdf.numPages > MAX_PAGES)
    throw new Error(`PDF有${pdf.numPages}页，超过${MAX_PAGES}页上限，请拆分后打开。`);
  const pages: Extraction["pages"] = [],
    lines: { page: number; lines: Line[] }[] = [],
    heights: number[] = [];
  let total = 0;
  for (let number = 1; number <= pdf.numPages; number++) {
    if (signal?.aborted) throw new Error("已取消读取。");
    const page = await pdf.getPage(number);
    try {
      heights.push(page.view[3] - page.view[1]);
      const runs = runsOf((await page.getTextContent()).items);
      const text = pageText(runs).slice(0, MAX_PAGE_TEXT);
      total += text.length;
      if (total > MAX_TEXT)
        throw new Error("文档原文超过600万字符，请拆分后打开。");
      pages.push({ number, text });
      lines.push({ page: number, lines: linesFromRuns(runs) });
    } finally {
      page.cleanup();
    }
    if (number % 4 === 0 || number === pdf.numPages) progress(number, pdf.numPages);
  }
  let toc_source: Extraction["index"]["toc_source"] = "pdf-outline";
  let structure = buildTree(await outlineEntries(pdf, heights), pdf.numPages);
  const scan = detectHeadings(lines);
  if (!structure.length) {
    toc_source = "heading-scan";
    structure = scan.entries.length >= 2 ? buildTree(scan.entries, pdf.numPages) : [];
  }
  if (!structure.length) {
    toc_source = "page-ranges";
    structure = pageRanges(pdf.numPages);
  }
  let title = "";
  try {
    const info = (await pdf.getMetadata()).info as { Title?: unknown } | undefined;
    title = typeof info?.Title === "string" ? info.Title.trim() : "";
  } catch {
    /* Metadata is optional. */
  }
  const flat = (nodes: IndexNode[]): IndexNode[] =>
    nodes.flatMap((n) => [n, ...flat(n.nodes ?? [])]);
  return {
    engineVersion: EXTRACTOR,
    pages,
    index: {
      doc_title: (title || scan.title).slice(0, 500),
      toc_source,
      has_abstract_or_references_section: structure.some((n) =>
        /^(abstract|references|bibliography|摘要|参考文献)/i.test(n.title.trim()),
      ),
      structure: flat(structure).length ? structure : pageRanges(pdf.numPages),
    },
  };
}
