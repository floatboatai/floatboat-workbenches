// ABOUTME: CSV/JSON 数据行解析、列与字段映射、逐行转换为 pdfme 输入并按字段类型校验。
import type { Template } from "@pdfme/common";
import { isRecord } from "./project.ts";
import { IMAGE_MIMES, isBlobValue } from "./assets.ts";
import { fieldLabel, isEditableField, LIMITS, pdfInput, type Dataset, type PdfProject } from "./domain.ts";

export const MAX_ROWS = 5000;
export const MAX_COLUMNS = 200;

export interface Table {
  columns: string[];
  rows: string[][];
  warnings: string[];
}

function uniqueColumns(raw: string[]): string[] {
  const seen = new Map<string, number>();
  return raw.map((name, index) => {
    const base = name.trim() || `列${index + 1}`;
    const count = seen.get(base) ?? 0;
    seen.set(base, count + 1);
    return count ? `${base}_${count + 1}` : base;
  });
}

function detectDelimiter(text: string): string {
  const candidates = [",", ";", "\t", "|"];
  let best = ",",
    bestCount = 0;
  for (const delimiter of candidates) {
    let count = 0,
      quoted = false;
    for (const char of text) {
      if (char === '"') quoted = !quoted;
      else if (!quoted && (char === "\n" || char === "\r")) break;
      else if (!quoted && char === delimiter) count++;
    }
    if (count > bestCount) {
      best = delimiter;
      bestCount = count;
    }
  }
  return best;
}

/** RFC 4180 CSV with BOM, CRLF, quoted newlines/quotes and comma/semicolon/tab/pipe detection. */
export function parseCsv(input: string): Table {
  const text = input.replace(/^﻿/, "");
  const delimiter = detectDelimiter(text);
  const records: string[][] = [];
  let row: string[] = [],
    cell = "",
    quoted = false,
    i = 0;
  const endCell = () => {
    if (cell.length > LIMITS.value) throw new Error(`第 ${records.length + 1} 行有单元格超过 ${LIMITS.value} 个字符。`);
    row.push(cell);
    cell = "";
  };
  const endRow = () => {
    endCell();
    if (row.length > 1 || row[0] !== "") records.push(row);
    if (records.length > MAX_ROWS + 1) throw new Error(`数据超过 ${MAX_ROWS} 行，请拆分后导入。`);
    row = [];
  };
  while (i < text.length) {
    const char = text[i];
    if (quoted) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i++;
        } else quoted = false;
      } else cell += char;
    } else if (char === '"' && cell === "") quoted = true;
    else if (char === delimiter) endCell();
    else if (char === "\r") {
      if (text[i + 1] === "\n") i++;
      endRow();
    } else if (char === "\n") endRow();
    else cell += char;
    i++;
  }
  if (quoted) throw new Error("CSV 引号没有闭合，请检查文件。");
  if (cell !== "" || row.length) endRow();
  if (!records.length) throw new Error("CSV 没有内容。");
  const [header, ...body] = records;
  if (header.length > MAX_COLUMNS) throw new Error(`最多支持 ${MAX_COLUMNS} 列。`);
  const columns = uniqueColumns(header);
  const warnings: string[] = [];
  const rows = body.map((cells, index) => {
    if (cells.length > columns.length && cells.slice(columns.length).some((value) => value.trim()))
      warnings.push(`第 ${index + 2} 行比表头多 ${cells.length - columns.length} 列，多余内容已忽略。`);
    return columns.map((_, column) => cells[column] ?? "");
  });
  return { columns, rows, warnings: warnings.slice(0, 20) };
}

const cellText = (value: unknown): string =>
  value === null || value === undefined ? "" : typeof value === "string" ? value : typeof value === "object" ? JSON.stringify(value) : String(value);

/** JSON rows: an array of objects, or an object wrapping one under rows/data/items/records. */
export function parseJsonRows(input: string): Table {
  let value: unknown;
  try {
    value = JSON.parse(input.replace(/^﻿/, ""));
  } catch {
    throw new Error("JSON 解析失败，请检查文件格式。");
  }
  if (isRecord(value)) value = ["rows", "data", "items", "records"].map((key) => (value as Record<string, unknown>)[key]).find(Array.isArray);
  if (!Array.isArray(value)) throw new Error("JSON 需要是对象数组，或包含 rows/data/items/records 数组。");
  if (value.length > MAX_ROWS) throw new Error(`数据超过 ${MAX_ROWS} 行，请拆分后导入。`);
  const columns: string[] = [];
  for (const item of value) {
    if (!isRecord(item)) throw new Error("JSON 数组中的每一项都需要是对象。");
    for (const key of Object.keys(item)) if (!columns.includes(key)) columns.push(key);
    if (columns.length > MAX_COLUMNS) throw new Error(`最多支持 ${MAX_COLUMNS} 列。`);
  }
  const rows = value.map((item) =>
    columns.map((column) => {
      const text = cellText((item as Record<string, unknown>)[column]);
      if (text.length > LIMITS.value) throw new Error(`单元格超过 ${LIMITS.value} 个字符。`);
      return text;
    }),
  );
  return { columns, rows, warnings: [] };
}

export function parseDataset(text: string, format: "csv" | "json"): Table {
  return format === "json" ? parseJsonRows(text) : parseCsv(text);
}

const normalizeName = (value: string) => value.trim().toLowerCase().replace(/[\s_\-（）()：:]/g, "");
/** Map each editable field to the column with the same (normalized) name; unmatched fields keep "". */
export function autoMap(template: Template, columns: string[], previous: Record<string, string> = {}): Record<string, string> {
  const mapping: Record<string, string> = {};
  for (const field of template.schemas.flat().filter(isEditableField)) {
    if (previous[field.name] && columns.includes(previous[field.name])) mapping[field.name] = previous[field.name];
    else mapping[field.name] = columns.find((column) => normalizeName(column) === normalizeName(field.name)) ?? "";
  }
  return mapping;
}

const pad = (value: number) => String(value).padStart(2, "0");
function normalizeDate(value: string, kind: "date" | "time" | "dateTime"): string {
  const text = value.trim().replace(/[年月]/g, "-").replace(/日/g, "").replace(/T/, " ");
  if (!text) return "";
  if (kind === "time") {
    const time = /^(\d{1,2}):(\d{2})(?::\d{2})?$/.exec(text);
    return time ? `${pad(Number(time[1]))}:${time[2]}` : value;
  }
  const match = /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})(?:\s+(\d{1,2}):(\d{2})(?::\d{2})?)?$/.exec(text);
  if (!match) return value;
  const date = `${match[1]}/${pad(Number(match[2]))}/${pad(Number(match[3]))}`;
  return kind === "date" ? date : `${date} ${pad(Number(match[4] ?? 0))}:${match[5] ?? "00"}`;
}
const TRUE = new Set(["true", "1", "yes", "y", "是", "√", "✓", "x", "勾选", "on"]);
const FALSE = new Set(["false", "0", "no", "n", "否", "", "off"]);

/** Convert a raw cell to the value format pdfme expects for the field type. */
export function normalizeCell(type: string, raw: string): string {
  if (type === "date" || type === "time" || type === "dateTime") return normalizeDate(raw, type);
  if (type === "checkbox" || type === "radioGroup") {
    const key = raw.trim().toLowerCase();
    return TRUE.has(key) ? "true" : FALSE.has(key) ? "false" : raw;
  }
  return raw;
}

export function rowInput(project: PdfProject, table: Table, mapping: Record<string, string>, index: number): Record<string, string> {
  const input = pdfInput(project);
  const row = table.rows[index];
  if (!row) return input;
  for (const field of project.template.schemas.flat().filter(isEditableField)) {
    const column = mapping[field.name];
    const at = column ? table.columns.indexOf(column) : -1;
    if (at >= 0) input[field.name] = normalizeCell(field.type, row[at] ?? "");
    else if (field.type === "multiVariableText") {
      const variables = variableColumns(field, table.columns);
      if (!variables.length) continue;
      let values: Record<string, unknown> = {};
      try {
        const parsed: unknown = JSON.parse(input[field.name] || "{}");
        if (isRecord(parsed)) values = parsed;
      } catch {
        /* An invalid default is replaced by the row's variables. */
      }
      for (const name of variables) values[name] = row[table.columns.indexOf(name)] ?? "";
      input[field.name] = JSON.stringify(values);
    }
  }
  return input;
}
/** Variable text fills each {变量} from a column with the same name when the field itself is not mapped. */
export function variableColumns(field: { type: string; variables?: unknown }, columns: string[]): string[] {
  if (field.type !== "multiVariableText" || !Array.isArray(field.variables)) return [];
  return field.variables.filter((name): name is string => typeof name === "string" && columns.includes(name));
}

const CHECK_DIGIT = (digits: string) => {
  const body = digits.slice(0, -1);
  let sum = 0;
  for (let i = body.length - 1, odd = 1; i >= 0; i--, odd ^= 1) sum += Number(body[i]) * (odd ? 3 : 1);
  return String((10 - (sum % 10)) % 10) === digits.slice(-1);
};
const BARCODE_RULES: Record<string, { test: (v: string) => boolean; hint: string }> = {
  qrcode: { test: (v) => v.length < 500, hint: "二维码内容需少于 500 个字符" },
  ean13: { test: (v) => /^\d{12}$/.test(v) || (/^\d{13}$/.test(v) && CHECK_DIGIT(v)), hint: "EAN-13 需要 12 位数字或含正确校验位的 13 位数字" },
  ean8: { test: (v) => /^\d{7}$/.test(v) || (/^\d{8}$/.test(v) && CHECK_DIGIT(v)), hint: "EAN-8 需要 7 位数字或含正确校验位的 8 位数字" },
  itf14: { test: (v) => /^\d{13}$/.test(v) || (/^\d{14}$/.test(v) && CHECK_DIGIT(v)), hint: "ITF-14 需要 13 位数字或含正确校验位的 14 位数字" },
  upca: { test: (v) => /^\d{11}$/.test(v) || (/^\d{12}$/.test(v) && CHECK_DIGIT(v)), hint: "UPC-A 需要 11 或 12 位数字" },
  upce: { test: (v) => /^0\d{6}$/.test(v) || (/^0\d{7}$/.test(v) && CHECK_DIGIT(v)), hint: "UPC-E 需要以 0 开头的 7 或 8 位数字" },
  code39: { test: (v) => /^[0-9A-Z\-.$/+%\s]+$/.test(v), hint: "Code 39 只支持大写字母、数字、空格和 - . $ / + %" },
  // Code 128 encodes ASCII; CJK and full-width characters make bwip-js fail.
  code128: { test: (v) => /^[\x20-\x7e]+$/.test(v), hint: "Code 128 只支持英文字母、数字和半角符号" },
  nw7: { test: (v) => /^[A-Da-d][0-9\-.$:/+]+[A-Da-d]$/.test(v), hint: "NW-7 需要以 A–D 开头和结尾" },
  gs1datamatrix: { test: (v) => /\(01\)\d{8,14}/.test(v) && v.length <= 52, hint: "GS1 DataMatrix 需要 (01) 商品编码，最长 52 个字符" },
  pdf417: { test: (v) => v.length > 0 && v.length <= 1000, hint: "PDF417 内容需在 1000 个字符以内" },
  japanpost: { test: (v) => /^(\d{7})(\d|[A-Z]|-)+$/.test(v), hint: "日本邮政条码需要 7 位邮编加地址编码" },
};

export interface FieldIssue {
  field: string;
  message: string;
}
/** Validate one pdfme input against the template; returns readable problems per field. */
export function validateInput(template: Template, input: Record<string, string>): FieldIssue[] {
  const issues: FieldIssue[] = [];
  for (const field of template.schemas.flat().filter(isEditableField)) {
    const value = input[field.name] ?? "";
    const add = (message: string) => issues.push({ field: field.name, message });
    if (!value.trim()) {
      if (field.required) add(`「${field.name}」为必填，当前为空`);
      continue;
    }
    if (value.length > LIMITS.value) add(`「${field.name}」超过 ${LIMITS.value} 个字符`);
    const rule = BARCODE_RULES[field.type];
    if (rule && !rule.test(value)) add(`「${field.name}」：${rule.hint}`);
    if (field.type === "date" && !/^\d{4}\/\d{2}\/\d{2}$/.test(value)) add(`「${field.name}」需要日期，如 2026-11-15`);
    if (field.type === "time" && !/^\d{2}:\d{2}$/.test(value)) add(`「${field.name}」需要时间，如 09:30`);
    if (field.type === "dateTime" && !/^\d{4}\/\d{2}\/\d{2} \d{2}:\d{2}$/.test(value)) add(`「${field.name}」需要日期时间，如 2026-11-15 09:30`);
    if ((field.type === "checkbox" || field.type === "radioGroup") && value !== "true" && value !== "false")
      add(`「${field.name}」需要 是/否`);
    if (field.type === "select") {
      const options = Array.isArray(field.options) ? field.options.map(String) : [];
      if (options.length && !options.includes(value)) add(`「${field.name}」只能是：${options.join("、")}`);
    }
    if (field.type === "image" && !isBlobValue(value, IMAGE_MIMES, Number.MAX_SAFE_INTEGER)) add(`「${field.name}」需要 PNG/JPEG 图片数据`);
    if (field.type === "table") {
      let rows: unknown;
      try {
        rows = JSON.parse(value);
      } catch {
        rows = null;
      }
      const width = Array.isArray(field.head) ? field.head.length : 0;
      if (!Array.isArray(rows) || !rows.every((row) => Array.isArray(row) && (!width || row.length === width)))
        add(`「${field.name}」需要 JSON 表格，如 [["项目","说明"]]，每行 ${width || "相同"} 列`);
    }
    if (field.type === "multiVariableText") {
      let vars: unknown;
      try {
        vars = JSON.parse(value);
      } catch {
        vars = null;
      }
      if (!isRecord(vars)) add(`「${field.name}」需要变量 JSON，如 {"姓名":"王芳"}`);
    }
  }
  return issues;
}

export interface RowReport {
  index: number;
  issues: FieldIssue[];
}
export function validateRows(project: PdfProject, table: Table, mapping: Record<string, string>): RowReport[] {
  return table.rows.map((_, index) => ({ index, issues: validateInput(project.template, rowInput(project, table, mapping, index)) }));
}

/** Unmapped required fields fall back to the template value; report them so the user knows. */
export function mappingSummary(project: PdfProject, dataset: Pick<Dataset, "mapping">, columns: string[]) {
  const fields = project.template.schemas.flat().filter(isEditableField);
  const mapped = fields.filter(
    (field) =>
      (dataset.mapping[field.name] && columns.includes(dataset.mapping[field.name])) || variableColumns(field, columns).length > 0,
  );
  return { fields: fields.length, mapped: mapped.length, unmapped: fields.filter((field) => !mapped.includes(field)).map((field) => `${field.name}（${fieldLabel(field.type)}）`) };
}

const UNSAFE_FILE = /[\\/:*?"<>|\u0000-\u001f]/g;
export function fileNameFor(table: Table, fileColumn: string, index: number, fallback: string): string {
  const at = fileColumn ? table.columns.indexOf(fileColumn) : -1;
  const raw = at >= 0 ? (table.rows[index]?.[at] ?? "").trim() : "";
  const base = (raw || `${fallback}-${String(index + 1).padStart(3, "0")}`).replace(UNSAFE_FILE, "_").slice(0, 100);
  return `${base}.pdf`;
}
/** Make ZIP entry names unique without losing the user's naming column. */
export function uniqueNames(names: string[]): string[] {
  const seen = new Map<string, number>();
  return names.map((name) => {
    const count = seen.get(name) ?? 0;
    seen.set(name, count + 1);
    return count ? name.replace(/\.pdf$/, `-${count + 1}.pdf`) : name;
  });
}
