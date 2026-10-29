// In-process practice engine: the TypeScript port of DeepTutor's importing,
// answers and scheduler modules (see ../contracts/deeptutor/). It replaces the former
// loopback Python adapter, so import, grading and review work offline.
import type { WorkbenchServer } from "../../sdk/runtime.mjs";
import { isRecord } from "../contracts/project.ts";
import {
  questionsValue,
  questionValue,
  reviewValue,
  idValue,
  QUESTION_LIMIT,
  BANK_BYTES,
  type Question,
  type Review,
} from "../contracts/tutor.ts";
import { preview, normalizeQuestion, MAX_ROWS } from "../contracts/deeptutor/importing.ts";
import { checkAnswer } from "../contracts/deeptutor/answers.ts";
import { schedule } from "../contracts/deeptutor/scheduler.ts";
import { PyValueError, pyLen } from "../contracts/deeptutor/pycompat.ts";

export const ENGINE = {
  engine: "DeepTutor practice",
  runtime: "TypeScript port in the workbench server",
  commit: "a31d82624c27d75f4e771d4fcb78dce16470b383",
};
/** The workbench request body is capped at 2 MB, below upstream's 5 MB file limit. */
export const RAW_BANK_BYTES = 1_500_000;

const MESSAGES: Record<string, string> = {
  "Question and correct answer are required": "缺少题干或正确答案",
  "Unknown question type": "题型无法识别（可用：单选、多选、判断、填空、简答）",
  "Choice questions need at least two options": "选择题至少需要两个选项",
  "The answer must name existing option keys (multi-choice: A,C)":
    "答案必须对应已有选项（多选写作 A,C）",
  "A true/false answer must be true or false": "判断题答案需为 对/错、true/false",
  "Options must contain at most 10 named choices": "选项最多10个",
  "Use at most 20 tags, each up to 100 characters": "标签最多20个，每个不超过100字",
  "A cell exceeds 20,000 characters": "单元格超过20000字",
  "Choose a non-empty file up to 5 MB": "请选择非空且不超过5MB的题库",
  "JSON must contain an array of question objects": "JSON题库需要是题目对象组成的数组",
  "Import at most 500 questions at a time": `每次最多导入${MAX_ROWS}题`,
  "Import at most 64 columns at a time": "表格最多64列",
  "Invalid CSV data or a cell exceeds the supported size": "CSV格式无效，或单元格超过支持的大小",
  "The file is empty": "文件为空",
  "Column names must be unique": "表头列名不能重复",
  "The file contains no questions": "文件中没有题目",
  "Supported formats: .xlsx, .csv, .tsv and .json":
    "支持JSON、CSV或TSV题库；XLSX请另存为CSV",
  "Unknown review rating": "复习等级无效",
};
/** Upstream messages are English; the learner sees Chinese. */
export function localize(message: string) {
  return MESSAGES[message] ?? `格式无法解析：${message}`;
}

export interface BankResult {
  questions: Question[];
  errors: { row: number; message: string }[];
  engine: typeof ENGINE;
}
/** Normalize a raw bank. Row-level problems are returned, not partially imported. */
export function normalizeBank(text: unknown, format: unknown): BankResult {
  if (typeof text !== "string") throw new Error("题库原文无效");
  if (format !== "json" && format !== "csv" && format !== "tsv")
    throw new Error("支持JSON、CSV或TSV题库；XLSX请另存为CSV");
  if (new TextEncoder().encode(text).length > RAW_BANK_BYTES)
    throw new Error("单次检查的题库原文最多1.5MB，请拆分文件后分批导入");
  let result;
  try {
    result = preview(text, "questions." + format);
  } catch (e) {
    if (e instanceof PyValueError) throw new Error(localize(e.message));
    throw e;
  }
  const errors = result.errors.map((e) => ({ row: e.row, message: localize(e.message) }));
  const seen = new Map<string, number>();
  result.questions.forEach((q, i) => {
    const first = seen.get(q.question_id);
    if (first !== undefined)
      errors.push({ row: -1, message: `第${first + 1}题与第${i + 1}题重复，请先去重` });
    else seen.set(q.question_id, i);
  });
  if (errors.length) return { questions: [], errors, engine: ENGINE };
  if (result.questions.length > QUESTION_LIMIT)
    throw new Error(`每份课程最多${QUESTION_LIMIT}题`);
  if (new TextEncoder().encode(JSON.stringify(result.questions)).length > BANK_BYTES)
    throw new Error("规范化题库超过700KB，请拆分为多份课程");
  return { questions: questionsValue(result.questions), errors: [], engine: ENGINE };
}

/** Normalize a bank and require it to be clean (used for model-generated banks). */
export function strictBank(raw: unknown): Question[] {
  const result = normalizeBank(JSON.stringify(raw), "json");
  if (result.errors.length)
    throw new Error(
      "生成的题目没有通过题库规范化：" +
        result.errors
          .slice(0, 6)
          .map((e) => (e.row > 0 ? `第${e.row}题 ` : "") + e.message)
          .join("；"),
    );
  return result.questions;
}

export function check(body: unknown) {
  if (
    !isRecord(body) ||
    typeof body.answer !== "string" ||
    pyLen(body.answer) > 5000
  )
    throw new Error("答案或题目格式无效");
  const question = questionValue(body.question);
  let normalized;
  try {
    normalized = normalizeQuestion(question);
  } catch (e) {
    if (e instanceof PyValueError) throw new Error(localize(e.message));
    throw e;
  }
  if (normalized.question_id !== question.question_id)
    throw new Error("题目已变化，请重新导入规范化题库");
  return {
    questionId: question.question_id,
    answer: body.answer,
    correct: checkAnswer(normalized as unknown as Record<string, unknown>, body.answer),
  };
}

const STATE_KEYS = [
  "interval_days",
  "ease",
  "streak",
  "lapses",
  "due_at",
  "last_review_at",
  "review_count",
  "version",
];
export function review(body: unknown): Review {
  const result = check(body);
  const input = body as Record<string, unknown>;
  const state = input.state ?? {};
  if (!isRecord(state)) throw new Error("复习状态无效");
  for (const [key, value] of Object.entries(state))
    if (!STATE_KEYS.includes(key) || typeof value !== "number" || !Number.isFinite(value))
      throw new Error("复习状态无效");
  const get = (k: string, d: number) => (Object.hasOwn(state, k) ? (state[k] as number) : d);
  if (
    Object.keys(state).length &&
    (!(get("interval_days", 1) >= 0 && get("interval_days", 1) <= 365) ||
      !(get("ease", 2.5) >= 1.3 && get("ease", 2.5) <= 3) ||
      !["streak", "lapses", "review_count", "version"].every(
        (k) => get(k, 0) >= 0 && get(k, 0) <= 1000000,
      ))
  )
    throw new Error("复习状态范围无效");
  const at = input.at;
  if (typeof at !== "number" || !(at >= 946684800 && at <= 4102444800))
    throw new Error("复习时间无效");
  if (typeof input.id !== "string" || input.id.length !== 36) throw new Error("操作编号无效");
  idValue(input.id);
  let next;
  try {
    next = schedule(state, String(input.rating), at);
  } catch (e) {
    if (e instanceof PyValueError) throw new Error(localize(e.message));
    throw e;
  }
  return reviewValue({ ...result, id: input.id, at, rating: input.rating, state: next });
}

export function registerPractice(app: WorkbenchServer) {
  const fail = (e: unknown) =>
    Response.json(
      { error: { message: e instanceof Error ? e.message : "练习操作未完成" } },
      { status: 400 },
    );
  const route = (path: string, run: (body: unknown) => unknown) =>
    app.route("POST", path, ({ body }) => {
      try {
        return run(body);
      } catch (e) {
        return fail(e);
      }
    });
  app.route("GET", "/api/practice/status", () => ({
    available: true,
    message: "DeepTutor练习引擎随工作台运行",
    ...ENGINE,
  }));
  route("/api/practice/import", (body) => {
    if (!isRecord(body)) throw new Error("题库输入无效");
    return normalizeBank(body.text, body.format);
  });
  route("/api/practice/check", check);
  route("/api/practice/review", review);
}
