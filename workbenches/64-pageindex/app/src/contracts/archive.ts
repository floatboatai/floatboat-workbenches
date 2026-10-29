// ABOUTME: 阅读档案与恢复稿的读写格式，以及审阅Markdown；纯函数，便于往返测试。
import { boundedText, isRecord } from "./project.ts";
import {
  outlineValue,
  readerValue,
  runValue,
  type Answer,
  type IndexNode,
  type OutlineTree,
  type QuestionRun,
  type ReaderData,
} from "./reader.ts";

export const ARCHIVE_FORMAT = "floatboat-pageindex";
export type Archive = {
  format: typeof ARCHIVE_FORMAT;
  version: 1;
  title: string;
  data: ReaderData;
  draft: Record<string, unknown>;
  pdf: string | null;
  outlines: OutlineTree[];
  runLedger: QuestionRun[];
};
export type ParsedArchive = {
  recovery: boolean;
  title: string;
  data: ReaderData;
  pdf: string | null;
  outlines: OutlineTree[];
  extra: Record<string, unknown>;
};

/** Accepts a portable reading archive or an autosave recovery snapshot; both import as a new copy. */
export function parseArchive(input: unknown): ParsedArchive {
  if (!isRecord(input)) throw new Error("不是PageIndex阅读档案或恢复草稿。");
  const recovery = isRecord(input.snapshot) && isRecord(input.snapshot.data);
  const raw: Record<string, unknown> = recovery
    ? {
        ...(input.snapshot as Record<string, unknown>),
        draft: (input.snapshot as Record<string, unknown>).extra,
      }
    : input;
  if (!recovery && (raw.format !== ARCHIVE_FORMAT || raw.version !== 1))
    throw new Error("不是PageIndex工作台阅读档案。");
  const data = readerValue(raw.data),
    title = boundedText(raw.title, 120);
  const outlines =
    data.document && Array.isArray(raw.outlines)
      ? raw.outlines.slice(0, 4).map((o) => outlineValue(o, data.document!.pages))
      : [];
  const extra = isRecord(raw.draft) ? { ...raw.draft } : {};
  if (Array.isArray(raw.runLedger) && raw.runLedger.length) {
    if (raw.runLedger.length > 60) throw new Error("导入任务记录超过容量。");
    // Historic runs are kept as a ledger only; their model calls are never replayed.
    extra.importedRunLedger = raw.runLedger
      .map(runValue)
      .map((r) => ({ ...r, result: null }));
  }
  if (extra.pendingQuestion) {
    extra.importedPendingQuestion = extra.pendingQuestion;
    delete extra.pendingQuestion;
  }
  if (!recovery && data.document && typeof raw.pdf !== "string")
    throw new Error("阅读档案没有原PDF。");
  return {
    recovery,
    title,
    data,
    pdf: !recovery && typeof raw.pdf === "string" ? raw.pdf : null,
    outlines,
    extra,
  };
}

/**
 * The chapter a passage belongs to. Several sections can share a page, so when the page text is known
 * the last section heading printed before the passage wins.
 */
export function chapterFor(
  structure: IndexNode[],
  page: number,
  text = "",
  quote = "",
): string {
  const squash = (s: string) => s.replace(/\s+/g, "").toLowerCase();
  const holding: { node: IndexNode; depth: number }[] = [];
  const walk = (nodes: IndexNode[], depth: number) => {
    for (const n of nodes)
      if (page >= n.start_index && page <= n.end_index) {
        holding.push({ node: n, depth });
        walk(n.nodes ?? [], depth + 1);
      }
  };
  walk(structure, 0);
  if (!holding.length) return "";
  const body = squash(text),
    at = quote ? body.indexOf(squash(quote)) : -1;
  if (at >= 0) {
    let best: { node: IndexNode; depth: number; pos: number } | null = null;
    for (const h of holding) {
      const pos = body.indexOf(squash(h.node.title));
      if (pos < 0 || pos > at) continue;
      if (!best || pos > best.pos || (pos === best.pos && h.depth > best.depth))
        best = { ...h, pos };
    }
    if (best) return best.node.title;
  }
  let first = holding[0];
  for (const h of holding) if (h.depth > first.depth) first = h;
  // Prefer the first (earliest) section at the deepest level reached on the first branch.
  return holding.find((h) => h.depth === first.depth)!.node.title;
}

export function reviewMarkdown(
  title: string,
  data: ReaderData,
  answers: Answer[],
  structure: IndexNode[],
  pageText: (page: number) => string = () => "",
): string {
  const chapterTitle = (page: number, quote: string) =>
    chapterFor(structure, page, pageText(page), quote);
  const notes = [...data.notes].sort((a, b) => a.page - b.page);
  return (
    [
      `# ${title}`,
      data.document ? `原文：${data.document.name}（${data.document.pages}页）` : "",
      notes.length ? "## 摘录与审阅意见" : "",
      ...notes.map((n) => {
        const chapter = chapterTitle(n.page, n.quote);
        return `### 第${n.page}页${chapter ? ` · ${chapter}` : ""}\n\n> ${n.quote.replace(/\n/g, "\n> ")}\n\n${n.text || "（未填写意见）"}`;
      }),
      answers.length ? "## 原页问答" : "",
      ...answers.map(
        (a) =>
          `### ${a.question}\n\n${a.answer}\n\n${a.citations.map((c) => `- 第${c.page}页：“${c.quote}”`).join("\n")}`,
      ),
    ]
      .filter(Boolean)
      .join("\n\n") + "\n"
  );
}

export function safeName(title: string) {
  return (title.trim() || "阅读档案").replace(/[\\/:*?"<>|\s]+/g, "-").slice(0, 80);
}
