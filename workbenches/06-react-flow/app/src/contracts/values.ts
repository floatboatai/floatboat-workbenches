// ABOUTME: 流水线端口上流动的三种数据（文本、表格、JSON），CSV 解析/输出与结果预览。

export type PortType = "text" | "table" | "json";
export type Cell = string | number | boolean | null;
export type Row = Record<string, Cell>;
export type JsonValue =
  | null
  | boolean
  | number
  | string
  | JsonValue[]
  | { [key: string]: JsonValue };

export type Value =
  | { type: "text"; text: string }
  | { type: "table"; columns: string[]; rows: Row[] }
  | { type: "json"; value: JsonValue };

export const LIMITS = {
  /** 单个表格最多行数。 */
  rows: 200_000,
  /** 单个表格最多列数。 */
  columns: 500,
  /** 单段文本最多字符。 */
  text: 5_000_000,
  /** 单个输入节点的内联数据（随流水线保存）。 */
  inline: 600_000,
} as const;

export const typeLabels: Record<PortType, string> = {
  text: "文本",
  table: "表格",
  json: "JSON",
};

export class PipelineError extends Error {}

export const text = (value: string): Value => {
  if (value.length > LIMITS.text)
    throw new PipelineError(
      `文本超过 ${LIMITS.text.toLocaleString("zh-CN")} 个字符。`,
    );
  return { type: "text", text: value };
};

export function table(columns: string[], rows: Row[]): Value {
  if (rows.length > LIMITS.rows)
    throw new PipelineError(
      `表格超过 ${LIMITS.rows.toLocaleString("zh-CN")} 行，请先筛选或拆分数据。`,
    );
  if (columns.length > LIMITS.columns)
    throw new PipelineError(`表格超过 ${LIMITS.columns} 列。`);
  return { type: "table", columns, rows };
}

/** 把单元格转成用于比较、模板和 CSV 的字符串。 */
export function cellText(cell: Cell | undefined): string {
  if (cell === null || cell === undefined) return "";
  return typeof cell === "string" ? cell : String(cell);
}

const numeric = /^[-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?$/;
/** 只识别普通十进制数字；保留前导零的编号（如 007）为文本。 */
export function inferCell(raw: string): Cell {
  const trimmed = raw.trim();
  if (!numeric.test(trimmed)) return raw;
  if (/^[-+]?0\d/.test(trimmed)) return raw;
  const value = Number(trimmed);
  return Number.isFinite(value) ? value : raw;
}

export function toNumber(cell: Cell | undefined): number | null {
  if (typeof cell === "number") return Number.isFinite(cell) ? cell : null;
  if (typeof cell === "boolean") return cell ? 1 : 0;
  if (typeof cell !== "string") return null;
  const trimmed = cell.trim().replace(/,/g, "");
  if (!trimmed || !numeric.test(trimmed)) return null;
  const value = Number(trimmed);
  return Number.isFinite(value) ? value : null;
}

export function detectDelimiter(source: string): string {
  const head = source.split(/\r?\n/, 5).join("\n");
  let best = ",",
    count = 0;
  for (const candidate of [",", "\t", ";", "|"]) {
    const n = head.split(candidate).length;
    if (n > count) {
      best = candidate;
      count = n;
    }
  }
  return best;
}

/** RFC 4180 风格解析：引号、转义引号、引号内换行、CRLF、BOM。 */
export function parseCsv(
  source: string,
  options: { delimiter?: string; header?: boolean; inferNumbers?: boolean } = {},
): Value {
  const input = source.replace(/^﻿/, "");
  const delimiter =
    !options.delimiter || options.delimiter === "auto"
      ? detectDelimiter(input)
      : options.delimiter;
  const records: string[][] = [];
  let field = "",
    record: string[] = [],
    quoted = false,
    i = 0;
  const pushRecord = () => {
    record.push(field);
    field = "";
    if (record.length > 1 || record[0] !== "") records.push(record);
    record = [];
    if (records.length > LIMITS.rows + 1)
      throw new PipelineError(
        `CSV 超过 ${LIMITS.rows.toLocaleString("zh-CN")} 行。`,
      );
  };
  while (i < input.length) {
    const ch = input[i];
    if (quoted) {
      if (ch === '"') {
        if (input[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        quoted = false;
      } else field += ch;
      i++;
      continue;
    }
    if (ch === '"' && field === "") quoted = true;
    else if (ch === delimiter) {
      record.push(field);
      field = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && input[i + 1] === "\n") i++;
      pushRecord();
    } else field += ch;
    i++;
  }
  if (quoted) throw new PipelineError("CSV 中有未闭合的引号。");
  if (field !== "" || record.length) pushRecord();
  if (!records.length) return table([], []);
  const header = options.header !== false;
  const width = Math.max(...records.map((r) => r.length));
  const names = header
    ? uniqueNames(records[0].map((name, index) => name.trim() || `列${index + 1}`))
    : Array.from({ length: width }, (_, index) => `列${index + 1}`);
  while (names.length < width) names.push(`列${names.length + 1}`);
  const body = header ? records.slice(1) : records;
  const infer = options.inferNumbers !== false;
  const rows = body.map((cells) => {
    const row: Row = {};
    names.forEach((name, index) => {
      const raw = cells[index] ?? "";
      row[name] = infer ? inferCell(raw) : raw;
    });
    return row;
  });
  return table(uniqueNames(names), rows);
}

export function uniqueNames(names: string[]): string[] {
  const seen = new Map<string, number>();
  return names.map((name) => {
    const n = seen.get(name) ?? 0;
    seen.set(name, n + 1);
    return n ? `${name}_${n + 1}` : name;
  });
}

const csvCell = (cell: Cell | undefined) => {
  const value = cellText(cell);
  return /[",\r\n]/.test(value) || /^\s|\s$/.test(value)
    ? `"${value.replace(/"/g, '""')}"`
    : value;
};

export function toCsv(value: Extract<Value, { type: "table" }>): string {
  const lines = [value.columns.map(csvCell).join(",")];
  for (const row of value.rows)
    lines.push(value.columns.map((column) => csvCell(row[column])).join(","));
  return lines.join("\r\n") + "\r\n";
}

export function tableToJson(value: Extract<Value, { type: "table" }>): JsonValue {
  return value.rows.map((row) => {
    const out: { [key: string]: JsonValue } = {};
    for (const column of value.columns) out[column] = row[column] ?? null;
    return out;
  });
}

export function valueToText(value: Value): string {
  if (value.type === "text") return value.text;
  if (value.type === "table") return toCsv(value);
  return JSON.stringify(value.value, null, 2);
}

/** 把 JSON 数组（对象或基本值）转为表格；嵌套值写成 JSON 文本。 */
export function jsonToTable(value: JsonValue): Value {
  const list = Array.isArray(value) ? value : [value];
  const columns: string[] = [];
  const known = new Set<string>();
  const rows: Row[] = list.map((item) => {
    const row: Row = {};
    if (item !== null && typeof item === "object" && !Array.isArray(item)) {
      for (const [key, inner] of Object.entries(item)) {
        if (!known.has(key)) {
          known.add(key);
          columns.push(key);
        }
        row[key] = flatCell(inner);
      }
    } else {
      if (!known.has("value")) {
        known.add("value");
        columns.push("value");
      }
      row.value = flatCell(item);
    }
    return row;
  });
  return table(columns, rows);
}

const flatCell = (value: JsonValue): Cell =>
  value === null || typeof value !== "object" ? value : JSON.stringify(value);

export type Preview =
  | { type: "text"; text: string; total: number }
  | { type: "table"; columns: string[]; rows: Cell[][]; total: number }
  | { type: "json"; text: string; total: number };

/** 生成可随流水线保存的小型预览。 */
export function preview(value: Value, rows = 20, chars = 2000): Preview {
  if (value.type === "text")
    return { type: "text", text: value.text.slice(0, chars), total: value.text.length };
  if (value.type === "table")
    return {
      type: "table",
      columns: value.columns.slice(0, 40),
      rows: value.rows
        .slice(0, rows)
        .map((row) =>
          value.columns.slice(0, 40).map((c) => clip(row[c] ?? null, 200)),
        ),
      total: value.rows.length,
    };
  const json = JSON.stringify(value.value, null, 2) ?? "null";
  return { type: "json", text: json.slice(0, chars), total: json.length };
}

const clip = (cell: Cell, max: number): Cell =>
  typeof cell === "string" && cell.length > max ? cell.slice(0, max) + "…" : cell;

export function summarize(value: Value): string {
  if (value.type === "text") {
    const lines = value.text ? value.text.replace(/\n$/, "").split("\n").length : 0;
    return `${lines.toLocaleString("zh-CN")} 行文本`;
  }
  if (value.type === "table")
    return `${value.rows.length.toLocaleString("zh-CN")} 行 × ${value.columns.length} 列`;
  const v = value.value;
  return Array.isArray(v)
    ? `JSON 数组 · ${v.length} 项`
    : v !== null && typeof v === "object"
      ? `JSON 对象 · ${Object.keys(v).length} 键`
      : `JSON ${v === null ? "null" : typeof v}`;
}
