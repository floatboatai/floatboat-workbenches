import { boundedText, isRecord } from "./project.ts";
import { example, lessonExample } from "./example.ts";
export type Question = {
  question_id: string;
  question: string;
  question_type: string;
  options: Record<string, string>;
  correct_answer: string;
  explanation: string;
  difficulty: string;
  tags: string[];
  user_answer: string;
};
export type Schedule = {
  interval_days: number;
  ease: number;
  streak: number;
  lapses: number;
  due_at: number;
  last_review_at: number;
  review_count: number;
  version: number;
};
export type Check = { answer: string; correct: boolean | null; at: number };
export type Review = {
  id: string;
  questionId: string;
  answer: string;
  correct: boolean | null;
  rating: string;
  at: number;
  state: Schedule;
};
export type TutorTurn = {
  role: "tutor" | "learner";
  text: string;
  at: number;
};
/** A tutoring thread about one checked answer (Host model explanation + follow-ups). */
export type Tutoring = { answer: string; turns: TutorTurn[] };
export const TUTOR_TURNS = 12;
export type Course = {
  lesson: string;
  goal: string;
  notes: string;
  questions: Question[];
  selected: string;
  answers: Record<string, string>;
  checks: Record<string, Check>;
  schedules: Record<string, Schedule>;
  events: Review[];
  tutoring: Record<string, Tutoring>;
};
export function questionValue(v: unknown): Question {
  if (
    !isRecord(v) ||
    !isRecord(v.options) ||
    !Array.isArray(v.tags) ||
    v.tags.length > 20
  )
    throw new Error("题目格式无效");
  const id = boundedText(v.question_id, 80),
    kind = boundedText(v.question_type, 30);
  if (
    !/^import:[a-f0-9]{64}$/.test(id) ||
    ![
      "single_choice",
      "multi_choice",
      "true_false",
      "fill_blank",
      "short_answer",
    ].includes(kind)
  )
    throw new Error("请先使用DeepTutor题库解析规范化题目");
  const entries = Object.entries(v.options);
  if (entries.length > 10) throw new Error("选项超限");
  const options = Object.fromEntries(
    entries.map(([k, x]) => {
      if (!/^[A-Z0-9]{1,8}$/.test(k)) throw new Error("选项编号无效");
      return [k, boundedText(x, 20000)];
    }),
  );
  if (
    typeof v.question !== "string" ||
    !v.question.trim() ||
    typeof v.correct_answer !== "string" ||
    !v.correct_answer.trim()
  )
    throw new Error("题干和参考答案不能为空");
  if (
    ["single_choice", "multi_choice", "true_false"].includes(kind) &&
    (Object.keys(options).length < 2 ||
      v.correct_answer.split(",").some((k) => !Object.hasOwn(options, k)))
  )
    throw new Error("正确答案必须对应已有选项");
  return {
    question_id: id,
    question: boundedText(v.question, 20000),
    question_type: kind,
    options,
    correct_answer: boundedText(v.correct_answer, 20000),
    explanation: boundedText(v.explanation, 20000),
    difficulty: boundedText(v.difficulty, 100),
    tags: v.tags.map((t) => boundedText(t, 100)),
    user_answer: boundedText(v.user_answer, 5000),
  };
}
/** Upstream DeepTutor imports at most 500 rows; a course must fit a 900 KB project. */
export const QUESTION_LIMIT = 500;
export const BANK_BYTES = 700000;
export const EVENT_LIMIT = 2000;
export function questionsValue(v: unknown): Question[] {
  if (
    !Array.isArray(v) ||
    v.length > QUESTION_LIMIT ||
    new TextEncoder().encode(JSON.stringify(v)).length > BANK_BYTES
  )
    throw new Error(`每份课程最多${QUESTION_LIMIT}题、规范化题库700KB`);
  const q = v.map(questionValue);
  if (new Set(q.map((x) => x.question_id)).size !== q.length)
    throw new Error("题目编号重复");
  return q;
}
function whole(v: unknown, max = 1000000) {
  const n = num(v, 0, max);
  if (!Number.isInteger(n)) throw new Error("复习次数必须是整数");
  return n;
}
function num(v: unknown, min = 0, max = 4102444800) {
  if (typeof v !== "number" || !Number.isFinite(v) || v < min || v > max)
    throw new Error("数值范围无效");
  return v;
}
export function scheduleValue(v: unknown): Schedule {
  if (!isRecord(v)) throw new Error("复习计划无效");
  return {
    interval_days: num(v.interval_days, 0, 365),
    ease: num(v.ease, 1.3, 3),
    streak: whole(v.streak),
    lapses: whole(v.lapses),
    due_at: num(v.due_at),
    last_review_at: num(v.last_review_at),
    review_count: whole(v.review_count),
    version: whole(v.version),
  };
}
function correct(v: unknown): boolean | null {
  if (v !== null && typeof v !== "boolean") throw new Error("核对结果无效");
  return v;
}
export function reviewValue(v: unknown): Review {
  if (
    !isRecord(v) ||
    !["again", "hard", "good", "easy"].includes(String(v.rating))
  )
    throw new Error("复习记录无效");
  return {
    id: idValue(v.id),
    questionId: boundedText(v.questionId, 80),
    answer: boundedText(v.answer, 5000),
    correct: correct(v.correct),
    rating: String(v.rating),
    at: num(v.at, 946684800),
    state: scheduleValue(v.state),
  };
}
export function idValue(v: unknown) {
  const id = boundedText(v, 40);
  if (
    !/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(id)
  )
    throw new Error("操作编号无效");
  return id;
}
function decodeProject(v: unknown, working: boolean): Course {
  if (
    !isRecord(v) ||
    !isRecord(v.answers) ||
    !isRecord(v.checks) ||
    !isRecord(v.schedules) ||
    !Array.isArray(v.events) ||
    v.events.length > EVENT_LIMIT ||
    (v.tutoring !== undefined && !isRecord(v.tutoring)) ||
    new TextEncoder().encode(JSON.stringify(v)).length >
      (working ? 1900000 : 900000)
  )
    throw new Error("课程格式或容量无效");
  const questions = questionsValue(v.questions),
    ids = new Set(questions.map((q) => q.question_id));
  const answers: Record<string, string> = {},
    checks: Record<string, Check> = {},
    schedules: Record<string, Schedule> = {};
  for (const [id, a] of Object.entries(v.answers)) {
    if (!ids.has(id)) throw new Error("答案引用未知题目");
    answers[id] = boundedText(a, 5000);
  }
  for (const [id, c] of Object.entries(v.checks)) {
    if (!ids.has(id) || !isRecord(c)) throw new Error("核对记录无效");
    checks[id] = {
      answer: boundedText(c.answer, 5000),
      correct: correct(c.correct),
      at: num(c.at),
    };
  }
  for (const [id, s] of Object.entries(v.schedules)) {
    if (!ids.has(id)) throw new Error("复习计划引用未知题目");
    schedules[id] = scheduleValue(s);
  }
  const tutoring: Record<string, Tutoring> = {};
  for (const [id, t] of Object.entries(isRecord(v.tutoring) ? v.tutoring : {})) {
    if (!ids.has(id)) throw new Error("讲解记录引用未知题目");
    tutoring[id] = tutoringValue(t);
  }
  const events = v.events.map(reviewValue);
  if (
    events.some((e) => !ids.has(e.questionId)) ||
    new Set(events.map((e) => e.id)).size !== events.length
  )
    throw new Error("复习事件不完整或重复");
  return {
    lesson: boundedText(v.lesson, 80000),
    goal: boundedText(v.goal, 2000),
    notes: boundedText(v.notes, 12000),
    questions,
    selected: boundedText(v.selected, 80),
    answers,
    checks,
    schedules,
    events,
    tutoring,
  };
}
export function tutoringValue(v: unknown): Tutoring {
  if (
    !isRecord(v) ||
    !Array.isArray(v.turns) ||
    v.turns.length > TUTOR_TURNS
  )
    throw new Error("讲解记录无效");
  return {
    answer: boundedText(v.answer, 5000),
    turns: v.turns.map((t) => {
      if (!isRecord(t) || (t.role !== "tutor" && t.role !== "learner"))
        throw new Error("讲解记录无效");
      return {
        role: t.role,
        text: boundedText(t.text, 8000),
        at: num(t.at),
      };
    }),
  };
}
export function applyReview(course: Course, event: Review): Course {
  if (course.events.some((e) => e.id === event.id)) return course;
  const previous = course.schedules[event.questionId];
  if (
    !course.questions.some((q) => q.question_id === event.questionId) ||
    (previous?.version ?? 0) + 1 !== event.state.version
  )
    throw new Error("复习状态已改变，请核对当前计划。");
  if (course.events.length >= EVENT_LIMIT)
    throw new Error(`已达到${EVENT_LIMIT}次复习记录，请导出后新建课程。`);
  return {
    ...course,
    schedules: { ...course.schedules, [event.questionId]: event.state },
    events: [...course.events, event],
  };
}
const questions = questionsValue(example);
export const seed: Course = {
  lesson: lessonExample,
  goal: "理解函数返回值、默认参数与可变集合，能举例说明哪些操作会改变原对象。",
  notes: "",
  questions,
  selected: questions[0].question_id,
  answers: {},
  checks: {},
  schedules: {},
  events: [],
  tutoring: {},
};
export function courseWithQuestions(
  base: Course,
  questions: Question[],
): Course {
  return {
    ...base,
    questions,
    selected: questions[0]?.question_id ?? "",
    answers: Object.fromEntries(
      questions
        .filter((q) => q.user_answer)
        .map((q) => [q.question_id, q.user_answer]),
    ),
    checks: {},
    schedules: {},
    events: [],
    tutoring: {},
  };
}
/** Append adopted questions to an existing course, keeping practice history. */
export function courseAppendingQuestions(
  base: Course,
  added: Question[],
): Course {
  const known = new Set(base.questions.map((q) => q.question_id));
  const fresh = added.filter((q) => !known.has(q.question_id));
  const questions = questionsValue([...base.questions, ...fresh]);
  return {
    ...base,
    questions,
    selected: fresh[0]?.question_id ?? base.selected,
  };
}

export const projectValue = (value: unknown): Course =>
  decodeProject(value, false);
export const restoreDraftData = (value: unknown): Course =>
  decodeProject(value, true);
