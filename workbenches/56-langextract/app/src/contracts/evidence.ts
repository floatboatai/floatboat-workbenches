import { isRecord, boundedText } from "./project.ts";
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
export interface Review {
  status: ReviewStatus;
  correctedText: string;
  note: string;
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
}
export interface Example {
  text: string;
  extractions: {
    extraction_class: string;
    extraction_text: string;
    attributes?: Record<string, string | string[]> | null;
  }[];
}
export interface EvidenceProject {
  schemaVersion: 1;
  origin: "example" | "import" | "manual" | "service";
  documents: EvidenceDocument[];
  fields: Field[];
  prompt: string;
  examples: Example[];
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
  if (!Array.isArray(v) || v.length > 24) throw Error("字段定义最多24项。");
  return v.map((x) => {
    if (!isRecord(x)) throw Error("字段格式无效。");
    return { name: text(x.name, 100), description: text(x.description, 1000) };
  });
}
export function examples(v: unknown): Example[] {
  if (!Array.isArray(v) || v.length > 8) throw Error("示例需要数组，最多8项。");
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
  };
}
export function validateProject(v: unknown): EvidenceProject {
  if (
    !isRecord(v) ||
    v.schemaVersion !== 1 ||
    !["example", "import", "manual", "service"].includes(String(v.origin)) ||
    !Array.isArray(v.documents) ||
    v.documents.length < 1 ||
    v.documents.length > 8
  )
    throw Error("项目需要1–8份资料。");
  const docs = v.documents.map((x) => {
    if (
      !isRecord(x) ||
      !Array.isArray(x.extractions) ||
      x.extractions.length > 300 ||
      !Array.isArray(x.reviews) ||
      x.reviews.length !== x.extractions.length
    )
      throw Error("记录与复核数据不匹配。");
    return {
      id: text(x.id, 120),
      text: text(x.text, 30000),
      originalText: text(x.originalText, 30000),
      extractions: x.extractions.map(extraction),
      reviews: x.reviews.map(review),
    };
  });
  if (
    docs.some((x) => !x.id) ||
    new Set(docs.map((x) => x.id)).size !== docs.length
  )
    throw Error("资料标识必须唯一。");
  const out: EvidenceProject = {
    schemaVersion: 1,
    origin: v.origin as EvidenceProject["origin"],
    documents: docs,
    fields: fields(v.fields),
    prompt: text(v.prompt, 12000),
    examples: examples(v.examples),
  };
  if (new TextEncoder().encode(JSON.stringify(out)).length > 800000)
    throw Error("项目超过800KB，请拆分资料后导入。");
  return out;
}
export function importedDocuments(
  values: unknown[],
  origin: EvidenceProject["origin"] = "import",
): EvidenceProject {
  if (!values.length || values.length > 8) throw Error("一次导入1–8份资料。");
  const documents = values.map((v, index) => {
    if (!isRecord(v) || !Array.isArray(v.extractions))
      throw Error(`第${index + 1}行需要 text 和 extractions。`);
    const source = text(v.text, 30000),
      items = v.extractions.map(extraction);
    return {
      id: v.document_id == null ? `doc-${index + 1}` : text(v.document_id, 120),
      text: source,
      originalText: source,
      extractions: items,
      reviews: items.map(() => ({
        status: "pending" as const,
        correctedText: "",
        note: "",
      })),
    };
  });
  const names = [
    ...new Set(
      documents.flatMap((d) => d.extractions.map((e) => e.extraction_class)),
    ),
  ];
  return validateProject({
    schemaVersion: 1,
    origin,
    documents,
    fields: names.slice(0, 24).map((name) => ({ name, description: "" })),
    prompt: "从原文提取有明确依据的字段，不推断未出现的信息。",
    examples: [],
  });
}
export function parseImport(raw: string): EvidenceProject {
  text(raw, 800000);
  let single: unknown;
  try {
    single = JSON.parse(raw);
  } catch {}
  if (isRecord(single) && single.schemaVersion === 1)
    return validateProject(single);
  if (Array.isArray(single)) return importedDocuments(single);
  if (isRecord(single)) return importedDocuments([single]);
  try {
    return importedDocuments(
      raw
        .split(/\r?\n/)
        .filter((x) => x.trim())
        .map((x) => JSON.parse(x)),
    );
  } catch (e) {
    throw Error(
      "无法导入 JSONL：" + (e instanceof Error ? e.message : "格式无效。"),
    );
  }
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
  if (doc.text !== doc.originalText) return null;
  const a = e.char_interval?.start_pos,
    b = e.char_interval?.end_pos,
    chars = Array.from(doc.originalText);
  if (a == null || b == null || a < 0 || b <= a || b > chars.length)
    return null;
  return {
    before: chars.slice(0, a).join(""),
    quote: chars.slice(a, b).join(""),
    after: chars.slice(b).join(""),
    start: a,
    end: b,
  };
}
export function rawJsonl(project: EvidenceProject): string {
  return (
    project.documents
      .map((d) =>
        JSON.stringify({
          document_id: d.id,
          text: d.originalText,
          extractions: d.extractions,
        }),
      )
      .join("\n") + "\n"
  );
}
const csvCell = (v: string) =>
  '"' +
  (/^\s*[=+\-@]|^[\t\r\n]/.test(v) ? "'" + v : v).replaceAll('"', '""') +
  '"';
export function reviewCsv(p: EvidenceProject): string {
  const rows = [
    [
      "资料",
      "类别",
      "原始抽取",
      "复核值",
      "状态",
      "区间起点",
      "区间终点",
      "证据状态",
      "属性",
      "备注",
    ],
  ];
  for (const d of p.documents)
    d.extractions.forEach((e, i) => {
      const r = d.reviews[i];
      rows.push([
        d.id,
        e.extraction_class,
        e.extraction_text,
        r.status === "corrected" ? r.correctedText : e.extraction_text,
        r.status,
        String(e.char_interval?.start_pos ?? ""),
        String(e.char_interval?.end_pos ?? ""),
        d.text !== d.originalText
          ? "原文已变更"
          : evidenceSpan(d, e)
            ? "有定位"
            : "未定位",
        JSON.stringify(e.attributes ?? {}),
        r.note,
      ]);
    });
  return (
    "\ufeff" + rows.map((r) => r.map(csvCell).join(",")).join("\r\n") + "\r\n"
  );
}
export function runInput(v: unknown): RunInput {
  if (
    !isRecord(v) ||
    !Array.isArray(v.documents) ||
    v.documents.length < 1 ||
    v.documents.length > 8
  )
    throw Error("抽取任务需要1–8份资料。");
  const documents = v.documents.map((d) => {
    if (!isRecord(d)) throw Error("资料格式无效。");
    const source = text(d.text, 30000),
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
  if (fs.some((f) => !f.name.trim())) throw Error("字段名称不能为空。");
  const out = { documents, fields: fs, prompt, examples: ex };
  if (new TextEncoder().encode(JSON.stringify(out)).length > 400000)
    throw Error("抽取输入超过400KB，请拆分任务。");
  return out;
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
        : importedDocuments(
            Array.isArray(v.result) ? v.result : [],
            "service",
          ).documents.map((d) => ({
            document_id: d.id,
            text: d.originalText,
            extractions: d.extractions,
          })),
  };
}
export const exampleText =
  "采购访谈记录 · 2026年10月\n\n🌿 青禾工作室正在为冬季展览采购灯具。项目负责人林晓确认，首批需要24套可调光射灯，预算为18,000元。\n\n供应商北辰照明承诺于11月15日前交付，安装地点是西岸展厅。林晓希望每套灯具附带两年质保，并在交付前提供色温测试报告。\n\n待确认：第二批追加数量尚未决定。";
function seedExtraction(
  cls: string,
  value: string,
  attrs: Record<string, string>,
): Extraction {
  const start = Array.from(
    exampleText.slice(0, exampleText.indexOf(value)),
  ).length;
  return {
    extraction_class: cls,
    extraction_text: value,
    char_interval: {
      start_pos: start,
      end_pos: start + Array.from(value).length,
    },
    alignment_status: "match_exact",
    extraction_index: null,
    group_index: null,
    description: null,
    attributes: attrs,
  };
}
export const seed: EvidenceProject = {
  schemaVersion: 1,
  origin: "example",
  documents: [
    {
      id: "采购访谈-01",
      text: exampleText,
      originalText: exampleText,
      extractions: [
        seedExtraction("负责人", "林晓", { 角色: "项目负责人" }),
        seedExtraction("供应商", "北辰照明", { 行业: "照明" }),
        seedExtraction("数量", "24套", { 对象: "可调光射灯" }),
        seedExtraction("预算", "18,000元", { 币种: "人民币" }),
        seedExtraction("交付日期", "11月15日前", { 限定: "最晚交付" }),
        {
          extraction_class: "追加数量",
          extraction_text: "尚未确定",
          char_interval: null,
          alignment_status: null,
          extraction_index: null,
          group_index: null,
          description: "示例：需要人工确认的未定位项",
          attributes: null,
        },
      ],
      reviews: Array.from({ length: 6 }, () => ({
        status: "pending",
        correctedText: "",
        note: "",
      })),
    },
  ],
  fields: [
    { name: "负责人", description: "负责项目交付的人" },
    { name: "供应商", description: "提供产品的组织" },
    { name: "数量", description: "明确数量与单位" },
    { name: "预算", description: "明确金额和币种" },
    { name: "交付日期", description: "明确交付时间" },
  ],
  prompt:
    "提取采购访谈中的负责人、供应商、数量、预算和交付日期。只使用原文中的确切表达；未决定的事项不要推断。",
  examples: [
    {
      text: "陈越向远山设备采购12台灯具，预算6000元，6月1日前交付。",
      extractions: [
        { extraction_class: "负责人", extraction_text: "陈越" },
        { extraction_class: "供应商", extraction_text: "远山设备" },
        { extraction_class: "数量", extraction_text: "12台" },
        { extraction_class: "预算", extraction_text: "6000元" },
        { extraction_class: "交付日期", extraction_text: "6月1日前" },
      ],
    },
  ],
};
