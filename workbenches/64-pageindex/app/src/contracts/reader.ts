import { boundedText, isRecord } from "./project.ts";
/** Original PDF ceiling, sized for long reports and scanned appendices. */
export const MAX_PDF = 64 * 1024 * 1024;
export const MAX_PAGES = 1000;
export const MAX_PAGE_TEXT = 100_000;
export const MAX_TEXT = 6_000_000;
export const MAX_NODES = 3000;
export const MAX_NOTES = 200;
export const MAX_ANSWERS = 50;
/** Upload chunk; base64 stays below the 2 MB runtime request ceiling. */
export const CHUNK = 1024 * 1024;
export const MAX_EXTRACTION_BYTES = 24 * 1024 * 1024;
export const EXTRACTOR = "pdfjs-dist 6.4.299";
export type DocumentRef = {
  id: string;
  name: string;
  bytes: number;
  pages: number;
};
export type IndexNode = {
  node_id: string;
  title: string;
  start_index: number;
  end_index: number;
  nodes?: IndexNode[];
  summary?: string;
};
export const OUTLINE_SOURCES = ["pageindex-flash", "pageindex-classic"] as const;
export type OutlineSource = (typeof OUTLINE_SOURCES)[number];
/** Optional tree built by the external PageIndex service, stored beside the document. */
export type OutlineTree = {
  source: OutlineSource;
  engine: string;
  description: string;
  structure: IndexNode[];
  at: string;
};
export type DocumentIndex = {
  source: DocumentRef;
  engineVersion: string;
  index: {
    doc_name: string;
    doc_title: string;
    toc_source: string;
    has_abstract_or_references_section: boolean;
    structure: IndexNode[];
  };
  pages: { number: number; text: string }[];
  outlines?: OutlineTree[];
};
export type Citation = { page: number; quote: string };
export type Answer = {
  id: string;
  question: string;
  answer: string;
  citations: Citation[];
  at: string;
  insufficient: boolean;
};
export type Note = { id: string; page: number; quote: string; text: string };
export type OutlineChoice = "document" | OutlineSource;
export type ReaderData = {
  document: DocumentRef | null;
  page: number;
  question: string;
  notes: Note[];
  archivedAnswers: Answer[];
  /** Which chapter tree the reader and question routing use. */
  outline: OutlineChoice;
  /** 0 fits the page to the reading column; otherwise a percentage. */
  zoom: number;
};
export type QuestionRun = {
  id: string;
  projectId: string;
  documentId: string;
  question: string;
  status: "running" | "completed" | "failed" | "interrupted";
  result: Answer | null;
  error: string;
  at: string;
};
export const integer = (value: unknown, min: number, max: number): number => {
  if (
    typeof value !== "number" ||
    !Number.isInteger(value) ||
    value < min ||
    value > max
  )
    throw new Error("数字超出允许范围。");
  return value;
};
export function identifier(value: unknown): string {
  const id = boundedText(value, 64);
  if (!/^[a-f0-9]{64}$/.test(id)) throw new Error("PDF文件标识无效。");
  return id;
}
export function operationId(value: unknown): string {
  const id = boundedText(value, 36);
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      id,
    )
  )
    throw new Error("操作编号无效。");
  return id;
}
export function sourceValue(value: unknown): DocumentRef {
  if (!isRecord(value)) throw new Error("PDF文件信息无效。");
  return {
    id: identifier(value.id),
    name: boundedText(value.name, 180),
    bytes: integer(value.bytes, 1, MAX_PDF),
    pages: integer(value.pages, 1, MAX_PAGES),
  };
}
export function flatten(nodes: IndexNode[]): IndexNode[] {
  return nodes.flatMap((node) => [node, ...flatten(node.nodes ?? [])]);
}
/** Validates a PageIndex-shaped tree against the document page count. */
export function structureValue(raw: unknown, pageCount: number): IndexNode[] {
  const seen = new Set<string>();
  function nodes(value: unknown, depth: number): IndexNode[] {
    if (!Array.isArray(value) || depth > 12)
      throw new Error("章节结构过深或无效。");
    return value.map((item) => {
      if (!isRecord(item)) throw new Error("章节信息无效。");
      const node_id = boundedText(item.node_id, 80);
      if (!node_id || seen.has(node_id) || seen.size >= MAX_NODES)
        throw new Error(`章节编号重复或超过${MAX_NODES}项。`);
      seen.add(node_id);
      const start_index = integer(item.start_index, 1, pageCount),
        end_index = integer(item.end_index, start_index, pageCount);
      const summary =
        typeof item.summary === "string"
          ? item.summary
          : typeof item.prefix_summary === "string"
            ? item.prefix_summary
            : undefined;
      return {
        node_id,
        title: boundedText(item.title, 500),
        start_index,
        end_index,
        ...(item.nodes === undefined || item.nodes === null
          ? {}
          : { nodes: nodes(item.nodes, depth + 1) }),
        ...(summary === undefined
          ? {}
          : { summary: boundedText(summary, 4000) }),
      };
    });
  }
  const structure = nodes(raw, 0);
  if (!structure.length) throw new Error("章节索引为空。");
  return structure;
}
export function outlineValue(value: unknown, pageCount: number): OutlineTree {
  if (!isRecord(value)) throw new Error("章节树无效。");
  const source = value.source;
  if (!OUTLINE_SOURCES.includes(source as OutlineSource))
    throw new Error("章节树来源无效。");
  return {
    source: source as OutlineSource,
    engine: boundedText(value.engine, 80),
    description: boundedText(value.description ?? "", 4000),
    structure: structureValue(value.structure, pageCount),
    at: boundedText(value.at, 50),
  };
}
export function indexValue(value: unknown): DocumentIndex {
  if (!isRecord(value) || !isRecord(value.index) || !Array.isArray(value.pages))
    throw new Error("索引响应无效。");
  const source = sourceValue(value.source);
  if (value.pages.length !== source.pages)
    throw new Error("页数与索引不一致。");
  let length = 0;
  const pages = value.pages.map((item, i) => {
    if (!isRecord(item) || item.number !== i + 1)
      throw new Error("原文页序无效。");
    const text = boundedText(item.text, MAX_PAGE_TEXT);
    length += text.length;
    return { number: i + 1, text };
  });
  if (length > MAX_TEXT)
    throw new Error("文档原文超过600万字符，请拆分后打开。");
  const structure = structureValue(value.index.structure, source.pages);
  const outlines =
    value.outlines === undefined
      ? undefined
      : Array.isArray(value.outlines) && value.outlines.length <= 4
        ? value.outlines.map((o) => outlineValue(o, source.pages))
        : (() => {
            throw new Error("章节树列表无效。");
          })();
  return {
    source,
    engineVersion: boundedText(value.engineVersion, 40),
    pages,
    index: {
      doc_name: boundedText(value.index.doc_name ?? source.name, 500),
      doc_title: boundedText(value.index.doc_title ?? "", 500),
      toc_source: boundedText(value.index.toc_source ?? "imported", 40),
      has_abstract_or_references_section:
        value.index.has_abstract_or_references_section === true,
      structure,
    },
    ...(outlines ? { outlines } : {}),
  };
}
/** True when the PDF carries no extractable text (for example a scan). */
export function textless(doc: DocumentIndex): boolean {
  return !doc.pages.some((p) => p.text.trim());
}
/** The chapter tree selected by the reader, falling back to the document's own tree. */
export function activeStructure(
  doc: DocumentIndex,
  choice: OutlineChoice,
): { source: string; structure: IndexNode[]; description: string } {
  const tree =
    choice === "document"
      ? undefined
      : doc.outlines?.find((o) => o.source === choice);
  return tree
    ? {
        source: tree.source,
        structure: tree.structure,
        description: tree.description,
      }
    : {
        source: doc.index.toc_source,
        structure: doc.index.structure,
        description: "",
      };
}
export function answerValue(raw: unknown, pageCount = MAX_PAGES): Answer {
  if (
    !isRecord(raw) ||
    !Array.isArray(raw.citations) ||
    raw.citations.length > 6 ||
    typeof raw.insufficient !== "boolean"
  )
    throw new Error("回答格式无效。");
  const answer = boundedText(raw.answer, 4000);
  if (!answer.trim() || (!raw.insufficient && !raw.citations.length))
    throw new Error("回答缺少原页证据。");
  return {
    id: operationId(raw.id),
    question: boundedText(raw.question, 2000),
    answer,
    at: boundedText(raw.at, 50),
    insufficient: raw.insufficient,
    citations: raw.citations.map((c) => {
      if (!isRecord(c)) throw new Error("引用格式无效。");
      return {
        page: integer(c.page, 1, pageCount),
        quote: boundedText(c.quote, 500),
      };
    }),
  };
}
export function readerValue(value: unknown): ReaderData {
  if (
    !isRecord(value) ||
    !Array.isArray(value.notes) ||
    value.notes.length > MAX_NOTES ||
    !Array.isArray(value.archivedAnswers) ||
    value.archivedAnswers.length > MAX_ANSWERS
  )
    throw new Error(
      `阅读档案最多${MAX_NOTES}条摘录、${MAX_ANSWERS}条导入问答。`,
    );
  const document = value.document === null ? null : sourceValue(value.document),
    pages = document?.pages ?? MAX_PAGES,
    ids = new Set<string>();
  const outline = value.outline ?? "document";
  if (outline !== "document" && !OUTLINE_SOURCES.includes(outline as OutlineSource))
    throw new Error("章节树选择无效。");
  const zoom = value.zoom ?? 0;
  if (zoom !== 0) integer(zoom, 50, 300);
  return {
    document,
    page: integer(value.page, 1, pages),
    question: boundedText(value.question, 2000),
    notes: value.notes.map((n) => {
      if (!isRecord(n)) throw new Error("便笺格式无效。");
      const id = operationId(n.id);
      if (ids.has(id)) throw new Error("便笺编号重复。");
      ids.add(id);
      return {
        id,
        page: integer(n.page, 1, pages),
        quote: boundedText(n.quote, 1000),
        text: boundedText(n.text, 1000),
      };
    }),
    archivedAnswers: value.archivedAnswers.map((a) => answerValue(a, pages)),
    outline: outline as OutlineChoice,
    zoom: integer(zoom, 0, 300),
  };
}
export function runValue(raw: unknown): QuestionRun {
  if (
    !isRecord(raw) ||
    !["running", "completed", "failed", "interrupted"].includes(
      String(raw.status),
    )
  )
    throw new Error("问答任务响应无效。");
  return {
    id: operationId(raw.id),
    projectId: operationId(raw.projectId),
    documentId: identifier(raw.documentId),
    question: boundedText(raw.question, 2000),
    status: raw.status as QuestionRun["status"],
    result: raw.result === null ? null : answerValue(raw.result),
    error: boundedText(raw.error, 1000),
    at: boundedText(raw.at, 50),
  };
}
export const seed: ReaderData = {
  document: null,
  page: 1,
  question: "",
  notes: [],
  archivedAnswers: [],
  outline: "document",
  zoom: 0,
};
export function parseJson(text: string, reason: string): unknown {
  if (reason !== "STOP") throw new Error("模型未完整结束，任务记录已保留。");
  const value = text.trim(),
    // Models sometimes omit the closing fence; the JSON inside must still be complete.
    fenced = /^```(?:json)?[ \t]*\r?\n([\s\S]*?)(?:\r?\n```)?$/i.exec(value);
  try {
    return JSON.parse(fenced ? fenced[1] : value);
  } catch {
    throw new Error("模型没有返回完整JSON。");
  }
}
export function validateCitations(
  answer: Answer,
  document: DocumentIndex,
  allowed: number[],
): Answer {
  const compact = (text: string) => text.replace(/\s+/g, " ").trim();
  for (const c of answer.citations) {
    if (
      !allowed.includes(c.page) ||
      !compact(c.quote) ||
      !compact(document.pages[c.page - 1].text).includes(compact(c.quote))
    )
      throw new Error("模型引用与原页不匹配，回答未采纳。");
  }
  return answer;
}
