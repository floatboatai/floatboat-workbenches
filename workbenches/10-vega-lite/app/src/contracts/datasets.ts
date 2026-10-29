// ABOUTME: 项目数据集的引用契约、CSV/TSV/JSON 解析、字段类型推断与容量限制；页面和服务端共用。
import { isRecord } from "./project.ts";

export type DatasetFormat = "csv" | "tsv" | "json";
export type FieldType = "quantitative" | "temporal" | "nominal";
export interface DatasetColumn {
  name: string;
  type: FieldType;
}
/** 图表模型中保存的数据集引用；内容按 id 存在服务端数据集表中。 */
export interface DatasetRef {
  id: string;
  /** 规格中通过 data: {name} 引用的名称。 */
  name: string;
  /** 导入时的文件名；规格中的 data: {url: "文件名"} 也会解析到此数据集。 */
  file: string;
  format: DatasetFormat;
  bytes: number;
  rows: number;
  columns: DatasetColumn[];
}
export interface ParsedTable {
  columns: DatasetColumn[];
  rows: Record<string, unknown>[];
}

export const MAX_DATASET_BYTES = 20 * 1024 * 1024;
export const MAX_DATASET_ROWS = 500_000;
export const MAX_DATASET_COLUMNS = 500;
export const MAX_DATASETS = 16;
export const DATASET_ACCEPT =
  ".csv,.tsv,.tab,.txt,.json,text/csv,text/tab-separated-values,application/json,text/plain";

const ID = /^(?:[0-9a-f]{64}|sample-[a-z0-9-]{1,40})$/;
export const isDatasetId = (value: unknown): value is string =>
  typeof value === "string" && ID.test(value);
const NAME = /^[\p{L}\p{N}_][\p{L}\p{N}_.-]{0,63}$/u;
export const isDatasetName = (value: unknown): value is string =>
  typeof value === "string" && NAME.test(value);
const FILE = /^[^/\\\u0000-\u001f]{1,160}$/;

export function formatOf(file: string): DatasetFormat | null {
  const ext = /\.([a-z0-9]+)$/i.exec(file)?.[1]?.toLowerCase();
  if (ext === "csv" || ext === "txt") return "csv";
  if (ext === "tsv" || ext === "tab") return "tsv";
  if (ext === "json") return "json";
  return null;
}

/** 由文件名推导规格中可用的数据集名称，并避开已占用名称。 */
export function datasetName(file: string, taken: Iterable<string> = []): string {
  const used = new Set(taken);
  let base =
    file
      .replace(/\.[^.]+$/, "")
      .normalize("NFC")
      .replace(/[^\p{L}\p{N}_.-]+/gu, "_")
      .replace(/^[._-]+|_+$/g, "")
      .slice(0, 48) || "data";
  if (!NAME.test(base)) base = "data_" + base.replace(/^[^\p{L}\p{N}_]+/u, "");
  if (!NAME.test(base)) base = "data";
  let name = base,
    n = 2;
  while (used.has(name)) name = `${base}_${n++}`;
  return name;
}

export function decodeDatasetRef(value: unknown): DatasetRef {
  if (
    !isRecord(value) ||
    !isDatasetId(value.id) ||
    !isDatasetName(value.name) ||
    typeof value.file !== "string" ||
    !FILE.test(value.file) ||
    !["csv", "tsv", "json"].includes(String(value.format)) ||
    !Number.isInteger(value.bytes) ||
    Number(value.bytes) < 0 ||
    Number(value.bytes) > MAX_DATASET_BYTES ||
    !Number.isInteger(value.rows) ||
    Number(value.rows) < 0 ||
    Number(value.rows) > MAX_DATASET_ROWS ||
    !Array.isArray(value.columns) ||
    value.columns.length > MAX_DATASET_COLUMNS
  )
    throw new Error("数据集引用无效。");
  const columns = value.columns.map((column) => {
    if (
      !isRecord(column) ||
      typeof column.name !== "string" ||
      column.name.length > 200 ||
      !["quantitative", "temporal", "nominal"].includes(String(column.type))
    )
      throw new Error("数据集字段无效。");
    return { name: column.name, type: column.type as FieldType };
  });
  return {
    id: value.id,
    name: value.name,
    file: value.file,
    format: value.format as DatasetFormat,
    bytes: Number(value.bytes),
    rows: Number(value.rows),
    columns,
  };
}

/** RFC 4180 风格的分隔文本解析：支持引号、转义引号、引号内换行、CRLF 与 BOM。 */
export function parseDelimited(text: string, delimiter: string): string[][] {
  const source = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
  const D = delimiter.charCodeAt(0);
  const rows: string[][] = [];
  let row: string[] = [];
  let i = 0;
  const n = source.length;
  while (i < n) {
    let value: string;
    if (source.charCodeAt(i) === 34) {
      let j = i + 1;
      value = "";
      for (;;) {
        const q = source.indexOf('"', j);
        if (q < 0) throw new Error("文件末尾存在未闭合的引号。");
        value += source.slice(j, q);
        if (source.charCodeAt(q + 1) === 34) {
          value += '"';
          j = q + 2;
          continue;
        }
        j = q + 1;
        break;
      }
      i = j;
    } else value = "";
    let j = i;
    while (j < n) {
      const c = source.charCodeAt(j);
      if (c === D || c === 10 || c === 13) break;
      j++;
    }
    row.push(value + source.slice(i, j));
    i = j;
    if (i >= n) break;
    const c = source.charCodeAt(i);
    if (c === D) {
      i++;
      if (i >= n) row.push("");
      continue;
    }
    rows.push(row);
    row = [];
    if (rows.length > MAX_DATASET_ROWS + 1)
      throw new Error(`数据超过 ${MAX_DATASET_ROWS.toLocaleString("en-US")} 行。`);
    i += c === 13 && source.charCodeAt(i + 1) === 10 ? 2 : 1;
  }
  if (row.length) rows.push(row);
  return rows.filter((r) => r.length > 1 || r[0] !== "");
}

const NUMBER = /^[-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?$/;
const DATE =
  /^\d{4}(?:[-/]\d{1,2}(?:[-/]\d{1,2})?)(?:[T ]\d{1,2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:?\d{2})?)?$/;

function inferType(values: unknown[]): FieldType {
  let seen = 0,
    numbers = 0,
    dates = 0;
  for (const value of values) {
    if (value === null || value === undefined || value === "") continue;
    seen++;
    if (typeof value === "number") numbers++;
    else if (typeof value === "string") {
      const text = value.trim();
      if (NUMBER.test(text)) numbers++;
      else if (DATE.test(text) && !Number.isNaN(Date.parse(text.replace(/\//g, "-"))))
        dates++;
    }
    if (seen >= 2000) break;
  }
  if (!seen) return "nominal";
  if (numbers === seen) return "quantitative";
  if (dates === seen) return "temporal";
  return "nominal";
}

function uniqueHeaders(header: string[]): string[] {
  const used = new Set<string>();
  return header.map((raw, index) => {
    let name = raw.trim() || `列${index + 1}`;
    if (name.length > 200) name = name.slice(0, 200);
    let candidate = name,
      n = 2;
    while (used.has(candidate)) candidate = `${name}_${n++}`;
    used.add(candidate);
    return candidate;
  });
}

/** 解析数据集文本为带类型的行；数值列转为数字，时间列保留原文交给 Vega-Lite 解析。 */
export function parseDataset(text: string, format: DatasetFormat): ParsedTable {
  if (new TextEncoder().encode(text).length > MAX_DATASET_BYTES)
    throw new Error(`数据文件超过 ${MAX_DATASET_BYTES / 1024 / 1024} MiB。`);
  if (format === "json") return parseJsonRecords(text);
  const matrix = parseDelimited(text, format === "tsv" ? "\t" : ",");
  if (matrix.length < 1) throw new Error("文件中没有表头。");
  if (matrix[0].length > MAX_DATASET_COLUMNS)
    throw new Error(`字段超过 ${MAX_DATASET_COLUMNS} 列。`);
  const names = uniqueHeaders(matrix[0]);
  const body = matrix.slice(1);
  if (body.length > MAX_DATASET_ROWS)
    throw new Error(`数据超过 ${MAX_DATASET_ROWS.toLocaleString("en-US")} 行。`);
  const columns = names.map((name, index) => ({
    name,
    type: inferType(body.map((row) => row[index])),
  }));
  const rows = body.map((cells) => {
    const row: Record<string, unknown> = {};
    columns.forEach((column, index) => {
      const cell = cells[index];
      if (cell === undefined || cell === "") row[column.name] = null;
      else if (column.type === "quantitative") row[column.name] = Number(cell.trim());
      else row[column.name] = cell;
    });
    return row;
  });
  return { columns, rows };
}

function parseJsonRecords(text: string): ParsedTable {
  let raw: unknown;
  try {
    raw = JSON.parse(text.charCodeAt(0) === 0xfeff ? text.slice(1) : text);
  } catch (error) {
    throw new Error(
      "JSON 数据无法解析：" + (error instanceof Error ? error.message : "格式错误"),
    );
  }
  // 兼容 {"data":[...]} / {"values":[...]} 等只有一个数组字段的包装。
  if (isRecord(raw)) {
    const arrays = Object.values(raw).filter(Array.isArray);
    if (arrays.length === 1) raw = arrays[0];
  }
  if (!Array.isArray(raw)) throw new Error("JSON 数据需要是对象数组，例如 [{\"月份\":\"1月\",\"销量\":12}]。");
  if (raw.length > MAX_DATASET_ROWS)
    throw new Error(`数据超过 ${MAX_DATASET_ROWS.toLocaleString("en-US")} 行。`);
  const names: string[] = [];
  const seen = new Set<string>();
  for (const item of raw) {
    if (!isRecord(item)) throw new Error("JSON 数组中的每一项都需要是对象。");
    for (const key of Object.keys(item))
      if (!seen.has(key)) {
        if (["__proto__", "constructor", "prototype"].includes(key))
          throw new Error("数据字段名无效。");
        seen.add(key);
        names.push(key);
        if (names.length > MAX_DATASET_COLUMNS)
          throw new Error(`字段超过 ${MAX_DATASET_COLUMNS} 列。`);
      }
  }
  const rows = raw as Record<string, unknown>[];
  const columns = names.map((name) => ({
    name: name.slice(0, 200),
    type: inferType(rows.map((row) => row[name])),
  }));
  const typed = rows.map((row) => {
    const out: Record<string, unknown> = { ...row };
    for (const column of columns)
      if (column.type === "quantitative" && typeof out[column.name] === "string")
        out[column.name] = Number(String(out[column.name]).trim());
    return out;
  });
  return { columns, rows: typed };
}

export const fieldTypeLabel: Record<FieldType, string> = {
  quantitative: "数值",
  temporal: "时间",
  nominal: "类别",
};
