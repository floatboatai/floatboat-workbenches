import { isRecord, boundedText } from "./project.ts";
export interface SourceFile {
  id: string;
  path: string;
  source: string;
}
export interface Receipt {
  id: string;
  documentId: string;
  requestId: string;
  state: "initiated" | "complete" | "unknown";
  method: string;
  url: string;
  source: string;
  startedAt: string;
  status?: number;
  statusText?: string;
  headers?: Record<string, string>;
  body?: string;
  encoding?: string;
  bytes?: number;
  truncated?: boolean;
  durationMs?: number;
  message?: string;
}
export interface Collection {
  files: SourceFile[];
  results: Receipt[];
  notes: string;
}
export interface Fields {
  name: string;
  method: string;
  url: string;
  headers: string;
  query: string;
  bodyType: string;
  body: string;
}
export interface Parsed {
  fields: Fields | null;
  blocked: string[];
  kind: string;
}
const str = (v: unknown, max: number) => boundedText(v, max);
export function restoreCollection(value: unknown): Collection {
  if (
    !isRecord(value) ||
    !Array.isArray(value.files) ||
    value.files.length > 20 ||
    !Array.isArray(value.results) ||
    value.results.length > 4
  )
    throw new Error("集合最多 20 个源文件与 4 个响应快照，请先导出工程。");
  const ids = new Set<string>();
  for (const f of value.files) {
    if (!isRecord(f) || typeof f.id !== "string" || ids.has(f.id))
      throw new Error("文件标识无效。");
    ids.add(f.id);
    str(f.path, 160);
    str(f.source, 40000);
  }
  str(value.notes, 10000);
  for (const r of value.results) {
    if (
      !isRecord(r) ||
      typeof r.id !== "string" ||
      typeof r.documentId !== "string" ||
      typeof r.requestId !== "string" ||
      !["initiated", "complete", "unknown"].includes(String(r.state)) ||
      typeof r.method !== "string" ||
      typeof r.url !== "string" ||
      typeof r.startedAt !== "string" ||
      typeof r.source !== "string"
    )
      throw new Error("响应快照无效。");
    str(r.body ?? "", 90000);
    str(r.source, 40000);
    str(r.url, 10000);
    if (
      r.status !== undefined &&
      (typeof r.status !== "number" || !Number.isInteger(r.status))
    )
      throw new Error("响应状态无效。");
    if (r.bytes !== undefined && typeof r.bytes !== "number")
      throw new Error("响应体积无效。");
    if (
      r.headers !== undefined &&
      (!isRecord(r.headers) ||
        Object.values(r.headers).some((v) => typeof v !== "string"))
    )
      throw new Error("响应头无效。");
  }
  if (new TextEncoder().encode(JSON.stringify(value)).length > 2000000)
    throw new Error("完整工作稿超过恢复预算 2 MB。");
  return value as unknown as Collection;
}
export function validateCollection(raw: unknown): Collection {
  const v = restoreCollection(raw);
  const paths = new Set<string>();
  for (const f of v.files) {
    if (
      !f.path ||
      f.path.startsWith("/") ||
      f.path.split("/").some((s) => s === ".." || s === ".") ||
      f.path.includes("\\") ||
      paths.has(f.path) ||
      !/\.bru$|(^|\/)bruno\.json$/.test(f.path)
    )
      throw new Error("文件路径需为唯一相对 .bru 路径或 bruno.json。");
    paths.add(f.path);
  }
  if (new TextEncoder().encode(JSON.stringify(v)).length > 780000)
    throw new Error(
      "集合超过模型 780 KB 预算，完整工作稿保留。请导出后减少文件/快照。",
    );
  return v;
}
export function fieldsValue(v: unknown): Fields {
  if (!isRecord(v)) throw new Error("请求字段无效。");
  for (const key of [
    "name",
    "method",
    "url",
    "headers",
    "query",
    "bodyType",
    "body",
  ])
    str(v[key], 40000);
  return v as unknown as Fields;
}
export function parseResult(v: unknown): Parsed {
  if (
    !isRecord(v) ||
    !Array.isArray(v.blocked) ||
    v.blocked.some((x) => typeof x !== "string") ||
    typeof v.kind !== "string"
  )
    throw new Error("解析响应无效。");
  return {
    kind: v.kind,
    blocked: v.blocked as string[],
    fields: v.fields === null ? null : fieldsValue(v.fields),
  };
}
export function receiptValue(v: unknown): Receipt {
  const wrapper = { files: [], results: [v], notes: "" };
  restoreCollection(wrapper);
  return v as Receipt;
}
export function portable(raw: unknown): {
  data: Collection;
  title: string;
  extra: Record<string, unknown>;
} {
  if (!isRecord(raw)) throw new Error("工程格式无效。");
  const v = isRecord(raw.snapshot) ? raw.snapshot : raw;
  if (typeof v.title !== "string" || v.title.length > 120 || !isRecord(v.extra))
    throw new Error("工程标题或编辑稿无效。");
  return { data: restoreCollection(v.data), title: v.title, extra: v.extra };
}
export const exampleSource = `meta {\n  name: 查看服务状态\n  type: http\n  seq: 1\n}\n\nget {\n  url: http://127.0.0.1:8080/status\n  body: none\n  auth: none\n}\n\nheaders {\n  Accept: application/json\n}\n`;
export const seed: Collection = {
  files: [
    {
      id: "request-status",
      path: "requests/status.bru",
      source: exampleSource,
    },
    {
      id: "collection-config",
      path: "bruno.json",
      source:
        '{\n  "version": "1",\n  "name": "服务接口",\n  "type": "collection",\n  "ignore": ["node_modules", ".git"]\n}\n',
    },
  ],
  results: [],
  notes: "",
};
