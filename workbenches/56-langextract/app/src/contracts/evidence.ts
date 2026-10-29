import { isRecord, boundedText } from "./project.ts";
import { alignContext, alignExtraction, sliceCodepoints } from "./align.ts";
export type ReviewStatus = "pending" | "accepted" | "rejected" | "corrected";
export interface Extraction {
  extraction_class: string;
  extraction_text: string;
  char_interval: { start_pos: number | null; end_pos: number | null } | null;
  alignment_status: string | null;
  extraction_index: number | null;
  group_index: number | null;
  description: string | null;
  attributes: Record<string, string | string[]> | null;
}
export interface Span {
  start: number;
  end: number;
}
/** Human layer for one record. The upstream extraction above is never rewritten. */
export interface Review {
  status: ReviewStatus;
  correctedText: string;
  note: string;
  /** Reviewer's class when it differs from the upstream class; empty keeps the original. */
  correctedClass: string;
  /** Reviewer or Node re-alignment anchor; null keeps the upstream char_interval. */
  span: Span | null;
  /** Corrected attributes; null keeps the upstream attributes. */
  attributes: Record<string, string | string[]> | null;
  /** model: imported / Host / service output. manual: a reviewer's own annotation. */
  source: "model" | "manual";
}
export interface EvidenceDocument {
  id: string;
  text: string;
  originalText: string;
  extractions: Extraction[];
  reviews: Review[];
}
export interface Field {
  name: string;
  description: string;
  attributes: string[];
}
export interface Example {
  text: string;
  extractions: {
    extraction_class: string;
    extraction_text: string;
    attributes?: Record<string, string | string[]> | null;
  }[];
}
export type Origin = "example" | "import" | "manual" | "service" | "host";
export interface EvidenceProject {
  schemaVersion: 1;
  origin: Origin;
  documents: EvidenceDocument[];
  fields: Field[];
  prompt: string;
  examples: Example[];
  /** Floatboat Host model ID used by the built-in channel. */
  model: string;
}
export interface RunInput {
  documents: { id: string; text: string }[];
  fields: Field[];
  prompt: string;
  examples: Example[];
}
export type JobStatus =
  | "submitting"
  | "unknown"
  | "queued"
  | "running"
  | "succeeded"
  | "failed"
  | "interrupted"
  | "cancelled";
export interface Job {
  id: string;
  projectId: string;
  status: JobStatus;
  createdAt: string;
  updatedAt: string;
  message: string;
  input: RunInput;
  result: unknown[] | null;
}
export const LIMITS = {
  documents: 40,
  documentChars: 200_000,
  records: 2000,
  fields: 40,
  examples: 8,
};
export const DEFAULT_MODEL = "gemini-3.8-flash";
const ORIGINS: Origin[] = ["example", "import", "manual", "service", "host"];
const text = (v: unknown, max = 20000) => boundedText(v, max);
const nullableNumber = (v: unknown): number | null => {
  if (v === undefined || v === null) return null;
  if (typeof v !== "number" || !Number.isInteger(v) || v < 0)
    throw Error("区间或序号必须是非负整数。");
  return v;
};
export function attributes(
  v: unknown,
): Record<string, string | string[]> | null {
  if (v === undefined || v === null) return null;
  if (!isRecord(v) || Object.keys(v).length > 30) throw Error("属性格式无效。");
  const out: Record<string, string | string[]> = {};
  for (const [k, x] of Object.entries(v)) {
    if (
      !k ||
      k.length > 100 ||
      ["__proto__", "constructor", "prototype"].includes(k)
    )
      throw Error("属性名称无效。");
    out[k] = Array.isArray(x) ? x.map((i) => text(i, 2000)) : text(x, 2000);
    if (Array.isArray(x) && x.length > 30) throw Error("属性列表过长。");
  }
  return out;
}
export function extraction(v: unknown): Extraction {
  if (!isRecord(v)) throw Error("抽取记录格式无效。");
  let interval: Extraction["char_interval"] = null;
  if (v.char_interval !== undefined && v.char_interval !== null) {
    if (!isRecord(v.char_interval)) throw Error("字符区间格式无效。");
    const start_pos = nullableNumber(v.char_interval.start_pos),
      end_pos = nullableNumber(v.char_interval.end_pos);
    if (start_pos !== null && end_pos !== null && end_pos < start_pos)
      throw Error("字符区间终点早于起点。");
    interval = { start_pos, end_pos };
  }
  const cls = text(v.extraction_class, 120);
  if (!cls.trim()) throw Error("抽取类别不能为空。");
  return {
    extraction_class: cls,
    extraction_text: text(v.extraction_text, 10000),
    char_interval: interval,
    alignment_status:
      v.alignment_status == null ? null : text(v.alignment_status, 100),
    extraction_index: nullableNumber(v.extraction_index),
    group_index: nullableNumber(v.group_index),
    description: v.description == null ? null : text(v.description, 3000),
    attributes: attributes(v.attributes),
  };
}
export function fields(v: unknown): Field[] {
  if (!Array.isArray(v) || v.length > LIMITS.fields)
    throw Error(`类别定义最多${LIMITS.fields}项。`);
  return v.map((x) => {
    if (!isRecord(x)) throw Error("类别格式无效。");
    const attrs = x.attributes === undefined ? [] : x.attributes;
    if (!Array.isArray(attrs) || attrs.length > 12)
      throw Error("每个类别最多12个属性名。");
    return {
      name: text(x.name, 100),
      description: text(x.description, 1000),
      attributes: attrs.map((a) => text(a, 60)),
    };
  });
}
export function examples(v: unknown): Example[] {
  if (!Array.isArray(v) || v.length > LIMITS.examples)
    throw Error("示例需要数组，最多8项。");
  return v.map((x) => {
    if (
      !isRecord(x) ||
      !Array.isArray(x.extractions) ||
      x.extractions.length > 50
    )
      throw Error("示例需要 text 和 extractions。");
    return {
      text: text(x.text, 10000),
      extractions: x.extractions.map((i) => {
        const e = extraction(i);
        return {
          extraction_class: e.extraction_class,
          extraction_text: e.extraction_text,
          attributes: e.attributes,
        };
      }),
    };
  });
}
function span(v: unknown): Span | null {
  if (v === undefined || v === null) return null;
  if (!isRecord(v)) throw Error("复核区间无效。");
  const start = nullableNumber(v.start),
    end = nullableNumber(v.end);
  if (start === null || end === null || end <= start) throw Error("复核区间无效。");
  return { start, end };
}
export function blankReview(source: Review["source"] = "model"): Review {
  return {
    status: source === "manual" ? "accepted" : "pending",
    correctedText: "",
    note: "",
    correctedClass: "",
    span: null,
    attributes: null,
    source,
  };
}
function review(v: unknown): Review {
  if (
    !isRecord(v) ||
    !["pending", "accepted", "rejected", "corrected"].includes(String(v.status))
  )
    throw Error("复核状态无效。");
  return {
    status: v.status as ReviewStatus,
    correctedText: text(v.correctedText, 10000),
    note: text(v.note, 4000),
    correctedClass: v.correctedClass === undefined ? "" : text(v.correctedClass, 120),
    span: span(v.span),
    attributes: attributes(v.attributes),
    source: v.source === "manual" ? "manual" : "model",
  };
}
function decodeProject(v: unknown, limit: number): EvidenceProject {
  if (
    !isRecord(v) ||
    v.schemaVersion !== 1 ||
    !ORIGINS.includes(v.origin as Origin) ||
    !Array.isArray(v.documents) ||
    v.documents.length < 1 ||
    v.documents.length > LIMITS.documents
  )
    throw Error(`批次需要1–${LIMITS.documents}份资料。`);
  const docs = v.documents.map((x) => {
    if (
      !isRecord(x) ||
      !Array.isArray(x.extractions) ||
      x.extractions.length > LIMITS.records ||
      !Array.isArray(x.reviews) ||
      x.reviews.length !== x.extractions.length
    )
      throw Error("记录与复核数据不匹配。");
    return {
      id: text(x.id, 120),
      text: text(x.text, LIMITS.documentChars),
      originalText: text(x.originalText, LIMITS.documentChars),
      extractions: x.extractions.map(extraction),
      reviews: x.reviews.map(review),
    };
  });
  if (
    docs.some((x) => !x.id.trim()) ||
    new Set(docs.map((x) => x.id)).size !== docs.length
  )
    throw Error("资料标识必须唯一且不能为空。");
  const model = v.model === undefined ? DEFAULT_MODEL : text(v.model, 120).trim();
  if (!/^[A-Za-z0-9._:/@-]{1,120}$/.test(model)) throw Error("模型 ID 格式无效。");
  const out: EvidenceProject = {
    schemaVersion: 1,
    origin: v.origin as Origin,
    documents: docs,
    fields: fields(v.fields),
    prompt: text(v.prompt, 12000),
    examples: examples(v.examples),
    model,
  };
  if (jsonBytes(out) > limit)
    throw Error(
      limit === MODEL_BYTES
        ? "批次超过880KB，请拆成多个批次后保存为正式项目。"
        : "工作稿超过1.35MB恢复上限，请先导出并减少资料或修订。",
    );
  return out;
}
export const MODEL_BYTES = 880_000;
export const DRAFT_DATA_BYTES = 1_350_000;
export const DRAFT_EXTRA_BYTES = 450_000;
export const WORKING_COPY_BYTES = 1_850_000;
export const PORTABLE_FILE_BYTES = 8_000_000;
export const jsonBytes = (value: unknown): number =>
  new TextEncoder().encode(JSON.stringify(value)).length;
export function validateProject(v: unknown): EvidenceProject {
  return decodeProject(v, MODEL_BYTES);
}
export function restoreProjectDraft(v: unknown): EvidenceProject {
  return decodeProject(v, DRAFT_DATA_BYTES);
}
export interface PendingRun {
  id: string;
  channel: "host" | "service";
  input: RunInput;
  model: string;
}
export function pendingRunValue(value: unknown): PendingRun {
  if (
    !isRecord(value) ||
    typeof value.id !== "string" ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      value.id,
    )
  )
    throw Error("待提交任务草稿无效。");
  return {
    id: value.id,
    channel: value.channel === "host" ? "host" : "service",
    input: runInput(value.input),
    model: typeof value.model === "string" ? text(value.model, 120) : DEFAULT_MODEL,
  };
}
export interface EvidenceWorkingCopy {
  title: string;
  data: EvidenceProject;
  extra: Record<string, unknown>;
}
export function restoreWorkingCopy(v: unknown): EvidenceWorkingCopy {
  if (!isRecord(v) || !isRecord(v.extra)) throw Error("工作稿结构无效。");
  const extra: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(v.extra)) {
    if (key === "examplesEditor" || key === "importText") {
      if (typeof value !== "string") throw Error("编辑器草稿必须是文本。");
      extra[key] = value;
    } else if (key === "pendingRun") extra[key] = pendingRunValue(value);
    else throw Error("工作稿含不支持的附加字段。");
  }
  if (jsonBytes(extra) > DRAFT_EXTRA_BYTES)
    throw Error(
      "编辑器与待提交任务草稿合计超过450KB。请清理粘贴的导入文本或缩短示例后再编辑；大文件请从文件直接导入。",
    );
  const copy = {
    title: text(v.title, 120),
    data: restoreProjectDraft(v.data),
    extra,
  };
  if (jsonBytes(copy) > WORKING_COPY_BYTES)
    throw Error("工作稿超过可恢复容量，请先导出并减少内容。");
  return copy;
}
export function serializeWorkingCopy(v: unknown): string {
  return JSON.stringify({
    format: "langextract-working-copy",
    version: 1,
    snapshot: restoreWorkingCopy(v),
  });
}
export function parseWorkingImport(
  raw: string,
  fallbackTitle = "导入资料",
): EvidenceWorkingCopy {
  if (new TextEncoder().encode(raw).length > PORTABLE_FILE_BYTES)
    throw Error("导入文件超过8MB，请拆分后再导入。");
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {}
  if (isRecord(value) && value.format === "langextract-working-copy") {
    if (value.version !== 1) throw Error("工作稿文件版本不支持。");
    return restoreWorkingCopy(value.snapshot);
  }
  // Old generic recovery files contain receipts/IDs; only their validated snapshot is imported.
  // Import always creates a new workbench document, never replaying a saved mutation.
  if (
    isRecord(value) &&
    typeof value.documentId === "string" &&
    isRecord(value.snapshot)
  )
    return restoreWorkingCopy(value.snapshot);
  if (isRecord(value) && value.schemaVersion === 1)
    return restoreWorkingCopy({ title: fallbackTitle, data: value, extra: {} });
  return restoreWorkingCopy({
    title: fallbackTitle,
    data: parseImport(raw),
    extra: {},
  });
}
export function documentsFromAnnotated(values: unknown[]): EvidenceDocument[] {
  if (!values.length || values.length > LIMITS.documents)
    throw Error(`一次导入1–${LIMITS.documents}份资料。`);
  const used = new Set<string>();
  return values.map((v, index) => {
    if (!isRecord(v) || !Array.isArray(v.extractions))
      throw Error(`第${index + 1}行需要 text 和 extractions。`);
    if (v.extractions.length > LIMITS.records)
      throw Error(`第${index + 1}份资料超过${LIMITS.records}条记录。`);
    const source = text(v.text, LIMITS.documentChars),
      items = v.extractions.map(extraction);
    let id = v.document_id == null ? `doc-${index + 1}` : text(v.document_id, 120).trim() || `doc-${index + 1}`;
    while (used.has(id)) id = id + "-2";
    used.add(id);
    return {
      id,
      text: source,
      originalText: source,
      extractions: items,
      reviews: items.map(() => blankReview()),
    };
  });
}
export function importedDocuments(
  values: unknown[],
  origin: Origin = "import",
): EvidenceProject {
  const documents = documentsFromAnnotated(values);
  const names = [
    ...new Set(
      documents.flatMap((d) => d.extractions.map((e) => e.extraction_class)),
    ),
  ];
  return validateProject({
    schemaVersion: 1,
    origin,
    documents,
    fields: names.slice(0, LIMITS.fields).map((name) => ({ name, description: "", attributes: [] })),
    prompt: "从原文提取有明确依据的片段，不推断未出现的信息。",
    examples: [],
    model: DEFAULT_MODEL,
  });
}
/** Accept a LangExtract JSONL file, a JSON array, a single AnnotatedDocument or a project object. */
export function parseAnnotated(raw: string): unknown[] {
  let single: unknown;
  try {
    single = JSON.parse(raw);
  } catch {}
  if (Array.isArray(single)) return single;
  if (isRecord(single)) return [single];
  const lines = raw.split(/\r?\n/).filter((x) => x.trim());
  return lines.map((x, i) => {
    try {
      return JSON.parse(x);
    } catch {
      throw Error(`第${i + 1}行不是有效 JSON。`);
    }
  });
}
export function parseImport(raw: string): EvidenceProject {
  text(raw, MODEL_BYTES);
  let single: unknown;
  try {
    single = JSON.parse(raw);
  } catch {}
  if (isRecord(single) && single.schemaVersion === 1)
    return validateProject(single);
  try {
    return importedDocuments(parseAnnotated(raw));
  } catch (e) {
    throw Error(
      "无法导入 JSONL：" + (e instanceof Error ? e.message : "格式无效。"),
    );
  }
}
/** New documents from plain text files; ids are made unique against the current batch. */
export function textDocuments(
  files: { name: string; text: string }[],
  existing: string[] = [],
): EvidenceDocument[] {
  const used = new Set(existing);
  return files.map((f) => {
    const body = text(f.text.replace(/\r\n?/g, "\n"), LIMITS.documentChars);
    let id = f.name.replace(/\.[^.]+$/, "").trim().slice(0, 100) || "资料";
    const base = id;
    for (let n = 2; used.has(id); n++) id = `${base}-${n}`;
    used.add(id);
    return { id, text: body, originalText: body, extractions: [], reviews: [] };
  });
}
export function isStale(doc: EvidenceDocument) {
  return doc.text !== doc.originalText;
}
/** Effective interval of a record: reviewer anchor first, then the upstream char_interval. */
export function recordSpan(doc: EvidenceDocument, index: number): Span | null {
  if (isStale(doc)) return null;
  const e = doc.extractions[index],
    r = doc.reviews[index];
  if (!e) return null;
  const length = Array.from(doc.originalText).length;
  const s = r?.span ?? {
    start: e.char_interval?.start_pos ?? -1,
    end: e.char_interval?.end_pos ?? -1,
  };
  if (s.start == null || s.end == null || s.start < 0 || s.end <= s.start || s.end > length)
    return null;
  return { start: s.start, end: s.end };
}
export function evidenceSpan(
  doc: EvidenceDocument,
  e: Extraction,
): {
  before: string;
  quote: string;
  after: string;
  start: number;
  end: number;
} | null {
  const i = doc.extractions.indexOf(e);
  const s = i >= 0 ? recordSpan(doc, i) : null;
  if (!s) {
    if (i >= 0 || isStale(doc)) return null;
    const a = e.char_interval?.start_pos,
      b = e.char_interval?.end_pos;
    if (a == null || b == null || b <= a || b > Array.from(doc.originalText).length) return null;
    return evidenceSpan({ ...doc, extractions: [e], reviews: [blankReview()] }, e);
  }
  const chars = Array.from(doc.originalText);
  return {
    before: chars.slice(0, s.start).join(""),
    quote: chars.slice(s.start, s.end).join(""),
    after: chars.slice(s.end).join(""),
    start: s.start,
    end: s.end,
  };
}
export function finalClass(doc: EvidenceDocument, i: number) {
  return doc.reviews[i]?.correctedClass || doc.extractions[i].extraction_class;
}
export function finalText(doc: EvidenceDocument, i: number) {
  const r = doc.reviews[i];
  return r?.status === "corrected" && r.correctedText
    ? r.correctedText
    : doc.extractions[i].extraction_text;
}
export function finalAttributes(doc: EvidenceDocument, i: number) {
  return doc.reviews[i]?.attributes ?? doc.extractions[i].attributes;
}
export type LocationKind = "exact" | "fuzzy" | "anchored" | "unaligned" | "stale";
export function locationKind(doc: EvidenceDocument, i: number): LocationKind {
  if (isStale(doc)) return "stale";
  if (!recordSpan(doc, i)) return "unaligned";
  if (doc.reviews[i]?.span) return "anchored";
  return doc.extractions[i].alignment_status === "match_exact" ? "exact" : "fuzzy";
}
/** Re-align unlocated records with the Node aligner; anchors go into the review layer only. */
export function realignDocument(doc: EvidenceDocument): {
  doc: EvidenceDocument;
  aligned: number;
} {
  if (isStale(doc)) return { doc, aligned: 0 };
  const ctx = alignContext(doc.originalText);
  let cursor = 0,
    aligned = 0;
  const reviews = doc.reviews.map((r, i) => {
    const current = recordSpan(doc, i);
    if (current) {
      cursor = current.end;
      return r;
    }
    const hit = alignExtraction(ctx, doc.extractions[i].extraction_text, cursor);
    if (!hit) return r;
    cursor = hit.end;
    aligned++;
    return { ...r, span: { start: hit.start, end: hit.end } };
  });
  return { doc: { ...doc, reviews }, aligned };
}
/** A reviewer's own annotation over a codepoint range of the original text. */
export function manualRecord(
  doc: EvidenceDocument,
  cls: string,
  range: Span,
  attrs: Record<string, string> | null = null,
): EvidenceDocument {
  if (isStale(doc)) throw Error("原文已变更，请先恢复原文再标注。");
  if (!cls.trim()) throw Error("请先选择类别。");
  const quote = sliceCodepoints(doc.originalText, range.start, range.end);
  if (!quote.trim() || range.end <= range.start) throw Error("请先在原文中选中要标注的文字。");
  if (doc.extractions.length >= LIMITS.records) throw Error("本资料记录已达上限。");
  const e: Extraction = {
    extraction_class: cls,
    extraction_text: quote,
    char_interval: { start_pos: range.start, end_pos: range.end },
    alignment_status: "match_exact",
    extraction_index: null,
    group_index: null,
    description: null,
    attributes: attrs && Object.keys(attrs).length ? attrs : null,
  };
  // Keep the ledger in reading order.
  let at = doc.extractions.findIndex((_, i) => {
    const s = recordSpan(doc, i);
    return s ? s.start > range.start : false;
  });
  if (at < 0) at = doc.extractions.length;
  return {
    ...doc,
    extractions: [...doc.extractions.slice(0, at), e, ...doc.extractions.slice(at)],
    reviews: [...doc.reviews.slice(0, at), blankReview("manual"), ...doc.reviews.slice(at)],
  };
}
export function removeRecord(doc: EvidenceDocument, i: number): EvidenceDocument {
  if (doc.reviews[i]?.source !== "manual") throw Error("模型记录只能驳回，不能删除。");
  return {
    ...doc,
    extractions: doc.extractions.filter((_, j) => j !== i),
    reviews: doc.reviews.filter((_, j) => j !== i),
  };
}
/** LangExtract AnnotatedDocument JSONL with the records as the model returned them (manual records excluded). */
export function rawJsonl(project: EvidenceProject): string {
  return (
    project.documents
      .map((d) =>
        JSON.stringify({
          document_id: d.id,
          text: d.originalText,
          extractions: d.extractions.filter((_, i) => d.reviews[i]?.source !== "manual"),
        }),
      )
      .join("\n") + "\n"
  );
}
/** Accepted, corrected and manual records with final class/value/interval, in the same JSONL format. */
export function reviewedJsonl(project: EvidenceProject): string {
  return (
    project.documents
      .map((d) =>
        JSON.stringify({
          document_id: d.id,
          text: d.originalText,
          extractions: d.extractions.flatMap((e, i) => {
            const r = d.reviews[i];
            if (r.status !== "accepted" && r.status !== "corrected") return [];
            const s = recordSpan(d, i);
            const value = finalText(d, i);
            return [
              {
                extraction_class: finalClass(d, i),
                extraction_text: value,
                char_interval: s ? { start_pos: s.start, end_pos: s.end } : null,
                // A corrected value that is not verbatim keeps its evidence interval but is not claimed exact.
                alignment_status: !s
                  ? null
                  : sliceCodepoints(d.originalText, s.start, s.end) === value
                    ? "match_exact"
                    : "match_fuzzy",
                extraction_index: i + 1,
                group_index: e.group_index,
                description: r.note || null,
                attributes: finalAttributes(d, i),
              },
            ];
          }),
        }),
      )
      .join("\n") + "\n"
  );
}
const csvCell = (v: string) =>
  '"' +
  (/^\s*[=+\-@]|^[\t\r\n]/.test(v) ? "'" + v : v).replaceAll('"', '""') +
  '"';
const locationName: Record<LocationKind, string> = {
  exact: "精确定位",
  fuzzy: "模糊定位",
  anchored: "人工定位",
  unaligned: "未定位",
  stale: "原文已变更",
};
export function reviewCsv(p: EvidenceProject): string {
  const rows = [
    [
      "资料",
      "类别",
      "原始抽取",
      "复核类别",
      "复核值",
      "状态",
      "来源",
      "区间起点",
      "区间终点",
      "证据状态",
      "原文片段",
      "属性",
      "备注",
    ],
  ];
  for (const d of p.documents)
    d.extractions.forEach((e, i) => {
      const r = d.reviews[i],
        s = recordSpan(d, i);
      rows.push([
        d.id,
        e.extraction_class,
        e.extraction_text,
        finalClass(d, i),
        finalText(d, i),
        r.status,
        r.source === "manual" ? "人工标注" : "模型",
        String(s?.start ?? ""),
        String(s?.end ?? ""),
        locationName[locationKind(d, i)],
        s ? sliceCodepoints(d.originalText, s.start, s.end) : "",
        JSON.stringify(finalAttributes(d, i) ?? {}),
        r.note,
      ]);
    });
  return (
    "\ufeff" + rows.map((r) => r.map(csvCell).join(",")).join("\r\n") + "\r\n"
  );
}
export interface ClassStat {
  name: string;
  defined: boolean;
  total: number;
  pending: number;
  accepted: number;
  corrected: number;
  rejected: number;
  manual: number;
  unaligned: number;
  documents: number;
}
/** Counts per final class across the batch. */
export function classStats(p: EvidenceProject): ClassStat[] {
  const map = new Map<string, ClassStat & { docs: Set<string> }>();
  const make = (name: string, defined: boolean) => ({
    name,
    defined,
    total: 0,
    pending: 0,
    accepted: 0,
    corrected: 0,
    rejected: 0,
    manual: 0,
    unaligned: 0,
    documents: 0,
    docs: new Set<string>(),
  });
  for (const f of p.fields) if (f.name.trim() && !map.has(f.name)) map.set(f.name, make(f.name, true));
  for (const d of p.documents)
    d.extractions.forEach((_, i) => {
      const name = finalClass(d, i);
      let s = map.get(name);
      if (!s) map.set(name, (s = make(name, false)));
      const r = d.reviews[i];
      s.total++;
      s[r.status]++;
      if (r.source === "manual") s.manual++;
      if (!recordSpan(d, i)) s.unaligned++;
      s.docs.add(d.id);
    });
  return [...map.values()].map(({ docs, ...s }) => ({ ...s, documents: docs.size }));
}
export function runInput(v: unknown): RunInput {
  if (
    !isRecord(v) ||
    !Array.isArray(v.documents) ||
    v.documents.length < 1 ||
    v.documents.length > LIMITS.documents
  )
    throw Error(`抽取任务需要1–${LIMITS.documents}份资料。`);
  const documents = v.documents.map((d) => {
    if (!isRecord(d)) throw Error("资料格式无效。");
    const source = text(d.text, LIMITS.documentChars),
      id = text(d.id, 120);
    if (!source.trim() || !id) throw Error("资料原文和标识不能为空。");
    return { id, text: source };
  });
  if (new Set(documents.map((d) => d.id)).size !== documents.length)
    throw Error("资料标识重复。");
  const prompt = text(v.prompt, 12000),
    ex = examples(v.examples),
    fs = fields(v.fields);
  if (!prompt.trim()) throw Error("请填写抽取要求。");
  if (!ex.length) throw Error("至少提供一个已应用的抽取示例。");
  if (fs.some((f) => !f.name.trim())) throw Error("类别名称不能为空。");
  const out = { documents, fields: fs, prompt, examples: ex };
  if (new TextEncoder().encode(JSON.stringify(out)).length > 1_000_000)
    throw Error("抽取输入超过1MB，请拆成多个批次。");
  return out;
}
/** The optional Python service keeps its own 1.7.1 adapter limits (8 documents, 30k characters each). */
export function serviceInput(input: RunInput): RunInput {
  if (input.documents.length > 8)
    throw Error("Python 服务一次最多8份资料，请选择“当前资料”或拆分批次。");
  if (input.documents.some((d) => d.text.length > 30000))
    throw Error("Python 服务单份资料最多30,000字符，请拆分资料或改用 Floatboat 模型。");
  return {
    ...input,
    fields: input.fields.slice(0, 24).map((f) => ({ name: f.name, description: f.description, attributes: [] })),
  };
}
export function validateJob(v: unknown): Job {
  if (
    !isRecord(v) ||
    typeof v.id !== "string" ||
    !/^[a-f0-9-]{36}$/.test(v.id) ||
    ![
      "submitting",
      "unknown",
      "queued",
      "running",
      "succeeded",
      "failed",
      "interrupted",
      "cancelled",
    ].includes(String(v.status))
  )
    throw Error("任务响应无效。");
  return {
    id: v.id,
    projectId: text(v.projectId, 120),
    status: v.status as JobStatus,
    createdAt: text(v.createdAt, 60),
    updatedAt: text(v.updatedAt, 60),
    message: text(v.message, 2000),
    input: runInput(v.input),
    result:
      v.result === null
        ? null
        : documentsFromAnnotated(Array.isArray(v.result) ? v.result : []).map(
            (d) => ({
              document_id: d.id,
              text: d.originalText,
              extractions: d.extractions,
            }),
          ),
  };
}
