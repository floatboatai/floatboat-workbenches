// TypeScript port of DeepTutor `deeptutor/services/practice/importing.py`
// (HKUDS/DeepTutor @ a31d82624c27d75f4e771d4fcb78dce16470b383, Apache-2.0).
// Behaviour, limits, aliases, error texts and the question identity hash are
// kept identical; the Python original is retained in reference/deeptutor-practice/
// and app/tests/fixtures/python-parity.json records its outputs for comparison.
// Differences: input is already-decoded text (the browser decodes UTF-8 or
// GB18030 before upload, mirroring the upstream fallback) and XLSX, which needs
// openpyxl upstream, is not supported.
import { createHash } from "node:crypto";
import { CsvError, excel, excelTab, reader, sniff, type Dialect } from "./csv.ts";
import {
  PY_SPACE,
  PyValueError,
  codePoints,
  compareStr,
  dumpsSorted,
  loadsJson,
  pyLen,
  pyStr,
  strip,
  truthy,
  utf8,
} from "./pycompat.ts";

export const MAX_BYTES = 5 * 1024 * 1024;
export const MAX_ROWS = 500;
export const MAX_CELL = 20000;
export const MAX_COLUMNS = 64;
const ALIASES: Record<string, string[]> = {
  question: ["question", "题目", "题干"],
  question_type: ["question_type", "type", "题型"],
  correct_answer: ["correct_answer", "answer", "答案", "正确答案"],
  explanation: ["explanation", "解析"],
  difficulty: ["difficulty", "难度"],
  tags: ["tags", "标签", "分类"],
  user_answer: ["user_answer", "我的答案", "作答"],
  options: ["options", "选项"],
};
const TYPES: Record<string, string> = {
  single_choice: "single_choice",
  multiple_choice: "single_choice",
  mcq: "single_choice",
  单选: "single_choice",
  单选题: "single_choice",
  multi_choice: "multi_choice",
  多选: "multi_choice",
  多选题: "multi_choice",
  true_false: "true_false",
  判断: "true_false",
  判断题: "true_false",
  fill_blank: "fill_blank",
  填空: "fill_blank",
  填空题: "fill_blank",
  short_answer: "short_answer",
  简答: "short_answer",
  简答题: "short_answer",
  essay: "short_answer",
  free_response: "short_answer",
};
const SEPARATORS = new RegExp(`[,;，；${PY_SPACE}]+`, "u");

export interface NormalizedQuestion {
  question: string;
  question_type: string;
  options: Record<string, string>;
  correct_answer: string;
  explanation: string;
  difficulty: string;
  user_answer: string;
  tags: string[];
  question_id: string;
}
type Row = Record<string, unknown>;
const isObject = (v: unknown): v is Row =>
  typeof v === "object" &&
  v !== null &&
  !Array.isArray(v) &&
  [Object.prototype, null].includes(Object.getPrototypeOf(v));

export function cell(value: unknown): string {
  const text = value === null || value === undefined ? "" : strip(pyStr(value));
  if (pyLen(text) > MAX_CELL) throw new PyValueError("A cell exceeds 20,000 characters");
  return text;
}

export function parseRows(text: string, filename: string): [number, Row][] {
  if (!text || utf8(text).length > MAX_BYTES)
    throw new PyValueError("Choose a non-empty file up to 5 MB");
  const content = text.startsWith("﻿") ? text.slice(1) : text;
  const suffix = /\.[^./\\]*$/.exec(filename)?.[0].toLowerCase() ?? "";
  if (suffix === ".json") {
    let rows: unknown;
    try {
      rows = loadsJson(content);
    } catch (e) {
      throw new PyValueError(e instanceof Error ? e.message : "Invalid JSON");
    }
    if (!Array.isArray(rows) || rows.some((row) => !isObject(row)))
      throw new PyValueError("JSON must contain an array of question objects");
    if (rows.length > MAX_ROWS) throw new PyValueError("Import at most 500 questions at a time");
    return rows.map((row, i) => [i + 1, row as Row]);
  }
  if (suffix !== ".csv" && suffix !== ".tsv")
    throw new PyValueError("Supported formats: .xlsx, .csv, .tsv and .json");
  let dialect: Dialect;
  try {
    dialect = sniff(codePoints(content).slice(0, 8192).join(""), ",;\t");
  } catch (e) {
    if (!(e instanceof CsvError)) throw e;
    dialect = suffix === ".tsv" ? excelTab : excel;
  }
  const rows: string[][] = [];
  try {
    for (const row of reader(content, dialect)) {
      if (row.length > MAX_COLUMNS) throw new PyValueError("Import at most 64 columns at a time");
      rows.push(row);
      if (rows.length > MAX_ROWS + 1) throw new PyValueError("Import at most 500 questions at a time");
    }
  } catch (e) {
    if (e instanceof CsvError)
      throw new PyValueError("Invalid CSV data or a cell exceeds the supported size");
    throw e;
  }
  if (!rows.length) throw new PyValueError("The file is empty");
  const headers = rows[0].map((value) => cell(value).toLowerCase());
  const nonempty = headers.filter(Boolean);
  if (nonempty.length !== new Set(nonempty).size)
    throw new PyValueError("Column names must be unique");
  if (rows.length > MAX_ROWS + 1) throw new PyValueError("Import at most 500 questions at a time");
  const result: [number, Row][] = [];
  rows.slice(1).forEach((row, i) => {
    const record: Row = Object.create(null);
    for (let c = 0; c < Math.min(headers.length, row.length); c++) record[headers[c]] = row[c];
    if (row.some((value) => cell(value))) result.push([i + 2, record]);
  });
  return result;
}

export function normalizeQuestion(raw: Row): NormalizedQuestion {
  const row: Row = Object.create(null);
  for (const [key, value] of Object.entries(raw)) row[strip(key).toLowerCase()] = value;
  const has = (k: string) => Object.hasOwn(row, k);
  const fields: Record<string, unknown> = {};
  for (const [key, names] of Object.entries(ALIASES)) {
    const name = names.find(has);
    fields[key] = name === undefined ? "" : row[name];
  }
  const question = cell(fields.question);
  let answer = cell(fields.correct_answer);
  if (!question || !answer) throw new PyValueError("Question and correct answer are required");
  let options: unknown = truthy(fields.options) ? fields.options : {};
  if (typeof options === "string") {
    try {
      options = loadsJson(options);
    } catch (e) {
      throw new PyValueError(e instanceof Error ? e.message : "Invalid options JSON");
    }
  }
  if (Array.isArray(options))
    options = Object.fromEntries(options.map((value, i) => [String.fromCharCode(65 + i), value]));
  if (!isObject(options) || Object.keys(options).length > 10)
    throw new PyValueError("Options must contain at most 10 named choices");
  let choices: Record<string, string> = Object.create(null);
  for (const [key, value] of Object.entries(options))
    if (cell(value)) choices[strip(key).toUpperCase()] = cell(value);
  for (const letter of "ABCDEFGHIJ") {
    const lower = letter.toLowerCase();
    const value = has(lower) ? row[lower] : has(`选项${lower}`) ? row[`选项${lower}`] : "";
    if (cell(value)) choices[letter] = cell(value);
  }
  const rawType = cell(fields.question_type).toLowerCase();
  const kind = rawType
    ? (Object.hasOwn(TYPES, rawType) ? TYPES[rawType] : undefined)
    : Object.keys(choices).length
      ? "single_choice"
      : "short_answer";
  if (kind === undefined) throw new PyValueError("Unknown question type");
  if (kind === "true_false") {
    const truths = ["true", "正确", "对", "是", "t", "1"],
      falses = ["false", "错误", "错", "否", "f", "0"];
    const folded = answer.toLowerCase();
    if (!truths.includes(folded) && !falses.includes(folded))
      throw new PyValueError("A true/false answer must be true or false");
    choices = Object.assign(Object.create(null), { T: "True", F: "False" });
    answer = truths.includes(folded) ? "T" : "F";
  }
  if (kind === "single_choice" || kind === "multi_choice") {
    if (Object.keys(choices).length < 2)
      throw new PyValueError("Choice questions need at least two options");
    const byText = Object.entries(choices).find(([, text]) => text === answer);
    if (byText) answer = byText[0];
    let keys = answer
      .split(SEPARATORS)
      .map((key) => strip(key).toUpperCase())
      .filter(Boolean);
    if (kind === "multi_choice" && keys.length === 1 && !Object.hasOwn(choices, keys[0]))
      keys = codePoints(keys[0]);
    if (
      !keys.length ||
      keys.some((key) => !Object.hasOwn(choices, key)) ||
      (kind === "single_choice" && keys.length !== 1)
    )
      throw new PyValueError("The answer must name existing option keys (multi-choice: A,C)");
    answer = [...new Set(keys)].sort(compareStr).join(",");
  }
  const tagsValue = fields.tags;
  const rawTags = Array.isArray(tagsValue) ? tagsValue : cell(tagsValue).split(/[,;，；]/u);
  const tags = [...new Set(rawTags.filter((tag) => cell(tag)).map((tag) => cell(tag)))];
  if (tags.length > 20 || tags.some((tag) => pyLen(tag) > 100))
    throw new PyValueError("Use at most 20 tags, each up to 100 characters");
  const result = {
    question,
    question_type: kind,
    options: { ...choices },
    correct_answer: answer,
    explanation: cell(fields.explanation),
    difficulty: cell(fields.difficulty),
    user_answer: cell(fields.user_answer),
    tags,
  };
  const identity = {
    question: result.question,
    question_type: result.question_type,
    options: result.options,
    correct_answer: result.correct_answer,
  };
  const digest = createHash("sha256").update(utf8(dumpsSorted(identity))).digest("hex");
  return { ...result, question_id: "import:" + digest };
}

export interface RowError {
  row: number;
  message: string;
}
export function preview(text: string, filename: string) {
  const questions: NormalizedQuestion[] = [],
    errors: RowError[] = [];
  for (const [number, row] of parseRows(text, filename)) {
    try {
      questions.push(normalizeQuestion(row));
    } catch (e) {
      if (!(e instanceof PyValueError)) throw e;
      errors.push({ row: number, message: e.message });
    }
  }
  if (!questions.length && !errors.length) throw new PyValueError("The file contains no questions");
  return { questions, errors };
}
