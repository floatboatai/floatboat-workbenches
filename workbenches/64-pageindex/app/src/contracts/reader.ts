import { boundedText, isRecord } from "./project.ts";
export const MAX_PDF = 8 * 1024 * 1024;
export const CHUNK = 192 * 1024;
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
export type ReaderData = {
  document: DocumentRef | null;
  page: number;
  question: string;
  notes: { id: string; page: number; quote: string; text: string }[];
  archivedAnswers: Answer[];
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
    pages: integer(value.pages, 1, 40),
  };
}
export function flatten(nodes: IndexNode[]): IndexNode[] {
  return nodes.flatMap((node) => [node, ...flatten(node.nodes ?? [])]);
}
export function indexValue(value: unknown): DocumentIndex {
  if (!isRecord(value) || !isRecord(value.index) || !Array.isArray(value.pages))
    throw new Error("索引响应无效。");
  const source = sourceValue(value.source),
    seen = new Set<string>();
  function nodes(raw: unknown, depth = 0): IndexNode[] {
    if (!Array.isArray(raw) || depth > 12)
      throw new Error("章节结构过深或无效。");
    return raw.map((item) => {
      if (!isRecord(item)) throw new Error("章节信息无效。");
      const node_id = boundedText(item.node_id, 80);
      if (!node_id || seen.has(node_id) || seen.size >= 250)
        throw new Error("章节编号重复或超过250项。");
      seen.add(node_id);
      const start_index = integer(item.start_index, 1, source.pages),
        end_index = integer(item.end_index, start_index, source.pages);
      return {
        node_id,
        title: boundedText(item.title, 500),
        start_index,
        end_index,
        ...(item.nodes === undefined
          ? {}
          : { nodes: nodes(item.nodes, depth + 1) }),
        ...(item.summary === undefined
          ? {}
          : { summary: boundedText(item.summary, 4000) }),
      };
    });
  }
  if (value.pages.length !== source.pages)
    throw new Error("页数与索引不一致。");
  let length = 0;
  const pages = value.pages.map((item, i) => {
    if (!isRecord(item) || item.number !== i + 1)
      throw new Error("原文页序无效。");
    const text = boundedText(item.text, 100000);
    length += text.length;
    return { number: i + 1, text };
  });
  if (length > 300000 || !pages.some((p) => p.text.trim()))
    throw new Error("文档原文为空或超出容量。");
  const structure = nodes(value.index.structure);
  if (!structure.length) throw new Error("章节索引为空。");
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
  };
}
export function answerValue(raw: unknown, pageCount = 40): Answer {
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
    value.notes.length > 60 ||
    !Array.isArray(value.archivedAnswers) ||
    value.archivedAnswers.length > 15
  )
    throw new Error("项目超过60条便笺或15条导入问答。");
  const document = value.document === null ? null : sourceValue(value.document),
    ids = new Set<string>();
  return {
    document,
    page: integer(value.page, 1, document?.pages ?? 40),
    question: boundedText(value.question, 2000),
    notes: value.notes.map((n) => {
      if (!isRecord(n)) throw new Error("便笺格式无效。");
      const id = operationId(n.id);
      if (ids.has(id)) throw new Error("便笺编号重复。");
      ids.add(id);
      return {
        id,
        page: integer(n.page, 1, document?.pages ?? 40),
        quote: boundedText(n.quote, 1000),
        text: boundedText(n.text, 1000),
      };
    }),
    archivedAnswers: value.archivedAnswers.map((a) =>
      answerValue(a, document?.pages ?? 40),
    ),
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
};
export function parseJson(text: string, reason: string): unknown {
  if (reason !== "STOP") throw new Error("模型未完整结束，任务记录已保留。");
  const value = text.trim(),
    fenced = /^```(?:json)?[ \t]*\r?\n([\s\S]*?)\r?\n```$/i.exec(value);
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
