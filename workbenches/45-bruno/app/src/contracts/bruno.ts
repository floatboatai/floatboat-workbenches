import { isRecord, boundedText } from "./project.ts";

export interface SourceFile {
  id: string;
  path: string;
  source: string;
}
export type ReceiptState = "initiated" | "complete" | "unknown" | "failed";
export interface AssertionResult {
  name: string;
  operator: string;
  expected: string;
  actual: string;
  passed: boolean;
  error?: string;
}
export interface SentRequest {
  method: string;
  url: string;
  headers: Record<string, string>;
  body?: string;
  bodyBytes?: number;
}
export interface Receipt {
  id: string;
  documentId: string;
  requestId: string;
  state: ReceiptState;
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
  /** refused | dns | timeout | tls | reset | cancelled | invalid | network | service */
  errorKind?: string;
  environment?: string;
  assertions?: AssertionResult[];
  request?: SentRequest;
  warnings?: string[];
  captured?: Record<string, string>;
  /** Older history entries keep status and timing but drop bodies to fit the working-copy budget. */
  compacted?: boolean;
  /** The saved snapshot keeps the first 64K characters; the execution ledger keeps the full body. */
  snapshotTruncated?: boolean;
}
export interface Collection {
  files: SourceFile[];
  results: Receipt[];
  notes: string;
  activeEnvironment?: string;
}

/** A key/value row as written by the official Bru serializer. Extra keys (type, contentType, local) survive edits. */
export interface Row {
  name: string;
  value: string;
  enabled: boolean;
  [key: string]: unknown;
}
export interface RequestModel {
  name: string;
  method: string;
  url: string;
  query: Row[];
  path: Row[];
  headers: Row[];
  bodyMode: string;
  body: {
    json: string;
    text: string;
    xml: string;
    formUrlEncoded: Row[];
    multipartForm: Row[];
    graphql: { query: string; variables: string };
  };
  authMode: string;
  auth: {
    bearer: { token: string };
    basic: { username: string; password: string };
    apikey: { key: string; value: string; placement: string };
  };
  vars: Row[];
  postVars: Row[];
  assertions: Row[];
  docs: string;
}
export interface Parsed {
  kind: "request" | "collection" | "folder" | "environment" | "config";
  /** Execution blockers: the request cannot be sent as written. Source is always preserved. */
  blocked: string[];
  /** Non-blocking notes, e.g. scripts that are preserved but not executed. */
  warnings: string[];
  model: RequestModel | null;
  environment: EnvVar[] | null;
}
export interface EnvVar {
  name: string;
  value: string;
  enabled: boolean;
  secret: boolean;
}

export const METHODS = [
  "GET",
  "POST",
  "PUT",
  "PATCH",
  "DELETE",
  "HEAD",
  "OPTIONS",
] as const;
export const BODY_MODES = [
  "none",
  "json",
  "text",
  "xml",
  "formUrlEncoded",
  "multipartForm",
  "graphql",
] as const;
export const AUTH_MODES = ["none", "inherit", "bearer", "basic", "apikey"] as const;

export const LIMITS = {
  files: 400,
  pathChars: 300,
  sourceChars: 200000,
  results: 400,
  historyPerRequest: 12,
  snapshotBodyChars: 65536,
  liveBodyChars: 3000000,
  resultsBudgetBytes: 320000,
  modelBytes: 780000,
  recoveryBytes: 2000000,
} as const;

const str = (v: unknown, max: number) => boundedText(v, max);

export function fileKind(path: string): Parsed["kind"] {
  if (/(^|\/)bruno\.json$/.test(path)) return "config";
  if (/(^|\/)collection\.bru$/.test(path)) return "collection";
  if (/(^|\/)folder\.bru$/.test(path)) return "folder";
  if (/^environments\/[^/]+\.bru$/.test(path)) return "environment";
  return "request";
}
export function environmentName(path: string) {
  return path.replace(/^environments\//, "").replace(/\.bru$/, "");
}

function stringMap(v: unknown, label: string) {
  if (
    v !== undefined &&
    (!isRecord(v) || Object.values(v).some((x) => typeof x !== "string"))
  )
    throw new Error(label + "无效。");
}
function receiptShape(r: unknown, bodyMax: number): asserts r is Receipt {
  if (
    !isRecord(r) ||
    typeof r.id !== "string" ||
    typeof r.documentId !== "string" ||
    typeof r.requestId !== "string" ||
    !["initiated", "complete", "unknown", "failed"].includes(String(r.state)) ||
    typeof r.method !== "string" ||
    typeof r.url !== "string" ||
    typeof r.startedAt !== "string" ||
    typeof r.source !== "string"
  )
    throw new Error("响应快照无效。");
  str(r.body ?? "", bodyMax);
  str(r.source, LIMITS.sourceChars);
  str(r.url, 20000);
  if (r.status !== undefined && (typeof r.status !== "number" || !Number.isInteger(r.status)))
    throw new Error("响应状态无效。");
  if (r.bytes !== undefined && typeof r.bytes !== "number") throw new Error("响应体积无效。");
  if (r.durationMs !== undefined && typeof r.durationMs !== "number")
    throw new Error("响应耗时无效。");
  for (const key of ["message", "errorKind", "environment", "statusText", "encoding"])
    if (r[key] !== undefined) str(r[key], 4000);
  stringMap(r.headers, "响应头");
  stringMap(r.captured, "捕获变量");
  if (r.warnings !== undefined && (!Array.isArray(r.warnings) || r.warnings.some((w) => typeof w !== "string")))
    throw new Error("执行提示无效。");
  if (r.assertions !== undefined) {
    if (!Array.isArray(r.assertions)) throw new Error("断言结果无效。");
    for (const a of r.assertions)
      if (
        !isRecord(a) ||
        typeof a.name !== "string" ||
        typeof a.operator !== "string" ||
        typeof a.expected !== "string" ||
        typeof a.actual !== "string" ||
        typeof a.passed !== "boolean"
      )
        throw new Error("断言结果无效。");
  }
  if (r.request !== undefined) {
    const q = r.request;
    if (!isRecord(q) || typeof q.method !== "string" || typeof q.url !== "string")
      throw new Error("请求记录无效。");
    stringMap(q.headers, "请求头记录");
    if (q.body !== undefined) str(q.body, 70000);
  }
}

/** Structural guard used for every persisted working copy, including unfinished ones. */
export function restoreCollection(value: unknown): Collection {
  if (
    !isRecord(value) ||
    !Array.isArray(value.files) ||
    value.files.length > LIMITS.files ||
    !Array.isArray(value.results) ||
    value.results.length > LIMITS.results
  )
    throw new Error(
      `集合最多 ${LIMITS.files} 个源文件与 ${LIMITS.results} 条响应历史。`,
    );
  const ids = new Set<string>();
  for (const f of value.files) {
    if (!isRecord(f) || typeof f.id !== "string" || ids.has(f.id))
      throw new Error("文件标识无效。");
    ids.add(f.id);
    str(f.path, LIMITS.pathChars);
    str(f.source, LIMITS.sourceChars);
  }
  str(value.notes, 20000);
  if (value.activeEnvironment !== undefined) str(value.activeEnvironment, 200);
  for (const r of value.results) receiptShape(r, 90000);
  if (new TextEncoder().encode(JSON.stringify(value)).length > LIMITS.recoveryBytes)
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
      f.path.split("/").some((s) => s === ".." || s === "." || s === "") ||
      f.path.includes("\\") ||
      paths.has(f.path) ||
      !/\.bru$|(^|\/)bruno\.json$/.test(f.path)
    )
      throw new Error(`文件路径需为唯一相对 .bru 路径或 bruno.json：${f.path || "（空）"}`);
    paths.add(f.path);
  }
  if (new TextEncoder().encode(JSON.stringify(v)).length > LIMITS.modelBytes)
    throw new Error(
      "集合超过模型 780 KB 预算，完整工作稿保留。请导出后减少文件或清理响应历史。",
    );
  return v;
}

function rowList(v: unknown, label: string): Row[] {
  if (!Array.isArray(v)) throw new Error(label + "无效。");
  for (const r of v)
    if (
      !isRecord(r) ||
      typeof r.name !== "string" ||
      typeof r.value !== "string" ||
      typeof r.enabled !== "boolean" ||
      r.name.length > 4000 ||
      r.value.length > LIMITS.sourceChars
    )
      throw new Error(label + "无效。");
  return v as Row[];
}

/** Decodes a structured request draft restored from autosave extras. */
export function requestModel(v: unknown): RequestModel {
  if (!isRecord(v) || !isRecord(v.body) || !isRecord(v.auth)) throw new Error("请求字段无效。");
  for (const key of ["name", "method", "url", "bodyMode", "authMode", "docs"])
    str(v[key], LIMITS.sourceChars);
  for (const key of ["query", "path", "headers", "vars", "postVars", "assertions"])
    rowList(v[key], key);
  const b = v.body;
  for (const key of ["json", "text", "xml"]) str(b[key], LIMITS.sourceChars);
  rowList(b.formUrlEncoded, "表单");
  rowList(b.multipartForm, "multipart");
  if (!isRecord(b.graphql)) throw new Error("GraphQL 字段无效。");
  str(b.graphql.query, LIMITS.sourceChars);
  str(b.graphql.variables, LIMITS.sourceChars);
  const a = v.auth;
  if (!isRecord(a.bearer) || !isRecord(a.basic) || !isRecord(a.apikey)) throw new Error("认证字段无效。");
  str(a.bearer.token, 20000);
  str(a.basic.username, 4000);
  str(a.basic.password, 4000);
  str(a.apikey.key, 4000);
  str(a.apikey.value, 20000);
  str(a.apikey.placement, 40);
  return v as unknown as RequestModel;
}
export function envVars(v: unknown): EnvVar[] {
  if (!Array.isArray(v)) throw new Error("环境变量无效。");
  for (const r of v)
    if (
      !isRecord(r) ||
      typeof r.name !== "string" ||
      typeof r.value !== "string" ||
      typeof r.enabled !== "boolean" ||
      typeof r.secret !== "boolean" ||
      r.name.length > 4000 ||
      r.value.length > LIMITS.sourceChars
    )
      throw new Error("环境变量无效。");
  return v as EnvVar[];
}

export function parseResult(v: unknown): Parsed {
  if (
    !isRecord(v) ||
    !Array.isArray(v.blocked) ||
    v.blocked.some((x) => typeof x !== "string") ||
    !Array.isArray(v.warnings) ||
    v.warnings.some((x) => typeof x !== "string") ||
    !["request", "collection", "folder", "environment", "config"].includes(String(v.kind))
  )
    throw new Error("解析响应无效。");
  return {
    kind: v.kind as Parsed["kind"],
    blocked: v.blocked as string[],
    warnings: v.warnings as string[],
    model: v.model === null || v.model === undefined ? null : requestModel(v.model),
    environment:
      v.environment === null || v.environment === undefined ? null : envVars(v.environment),
  };
}

/** Validates a live receipt returned by the server (full body up to the execution budget). */
export function receiptValue(v: unknown): Receipt {
  receiptShape(v, LIMITS.liveBodyChars);
  return v;
}

/** Converts a live receipt into the bounded snapshot kept in the working copy. */
export function snapshotOf(r: Receipt): Receipt {
  if (r.body === undefined || r.body.length <= LIMITS.snapshotBodyChars) return r;
  return { ...r, body: r.body.slice(0, LIMITS.snapshotBodyChars), snapshotTruncated: true };
}

/**
 * Keeps per-request history bounded. Newest entries keep bodies; older entries
 * are compacted (status, timing, assertions) and remain fully readable from the
 * server ledger by id.
 */
export function compactResults(results: Receipt[]): Receipt[] {
  const sorted = [...results].sort((a, b) => a.startedAt.localeCompare(b.startedAt));
  const perRequest = new Map<string, number>();
  const kept: Receipt[] = [];
  for (let i = sorted.length - 1; i >= 0; i--) {
    const r = sorted[i];
    const n = (perRequest.get(r.requestId) ?? 0) + 1;
    perRequest.set(r.requestId, n);
    if (n <= LIMITS.historyPerRequest && kept.length < LIMITS.results) kept.unshift(snapshotOf(r));
  }
  const latest = new Set<string>(),
    seen = new Set<string>();
  for (let i = kept.length - 1; i >= 0; i--) {
    if (seen.has(kept[i].requestId)) continue;
    seen.add(kept[i].requestId);
    latest.add(kept[i].id);
  }
  const size = () => new TextEncoder().encode(JSON.stringify(kept)).length;
  const compact = (r: Receipt): Receipt => {
    const { body: _b, headers: _h, request: _q, ...rest } = r;
    return { ...rest, compacted: true };
  };
  // First pass: older history entries; second pass: latest entries of other requests.
  for (const onlyOld of [true, false]) {
    for (let i = 0; i < kept.length && size() > LIMITS.resultsBudgetBytes; i++) {
      const r = kept[i];
      if (r.compacted || r.state === "initiated") continue;
      if (onlyOld && latest.has(r.id)) continue;
      kept[i] = compact(r);
    }
  }
  return kept;
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
