import { boundedText, isRecord } from "./project.ts";
import { idValue, questionsValue, type Question } from "./tutor.ts";

export const QUESTION_KINDS = [
  "mixed",
  "single_choice",
  "multi_choice",
  "true_false",
  "fill_blank",
  "short_answer",
] as const;
export const DIFFICULTIES = ["mixed", "基础", "理解", "应用"] as const;
export type GenerationOptions = {
  count: number;
  kind: (typeof QUESTION_KINDS)[number];
  difficulty: (typeof DIFFICULTIES)[number];
};
export const GENERATION_MAX = 12;
export const defaultGenerationOptions: GenerationOptions = {
  count: 5,
  kind: "mixed",
  difficulty: "mixed",
};
export function generationOptionsValue(
  v: unknown,
  fallback: GenerationOptions = defaultGenerationOptions,
): GenerationOptions {
  if (!isRecord(v)) return fallback;
  const count = v.count ?? fallback.count;
  if (
    typeof count !== "number" ||
    !Number.isInteger(count) ||
    count < 1 ||
    count > GENERATION_MAX
  )
    throw new Error(`每次出题1–${GENERATION_MAX}道`);
  const kind = v.kind ?? fallback.kind,
    difficulty = v.difficulty ?? fallback.difficulty;
  if (!(QUESTION_KINDS as readonly unknown[]).includes(kind))
    throw new Error("题型选项无效");
  if (!(DIFFICULTIES as readonly unknown[]).includes(difficulty))
    throw new Error("难度选项无效");
  return {
    count,
    kind: kind as GenerationOptions["kind"],
    difficulty: difficulty as GenerationOptions["difficulty"],
  };
}
export function parseGenerated(
  text: string,
  finish: string,
  max = GENERATION_MAX,
) {
  if (finish !== "STOP" || text.length > 200000)
    throw new Error("模型输出未完整结束，请调整讲义后另建生成任务。");
  const t = text.trim(),
    f = /^```(?:json)?[ \t]*\r?\n([\s\S]*?)\r?\n```$/i.exec(t);
  let value: unknown;
  try {
    value = JSON.parse(f ? f[1] : t);
  } catch {
    throw new Error("模型未返回完整题库JSON，输入已保留。");
  }
  if (!Array.isArray(value) || value.length < 1 || value.length > max)
    throw new Error(`模型题库需要1–${max}题。`);
  return value;
}
/** 0.5 generations asked for 3 single-choice/short-answer questions. */
const legacyOptions: GenerationOptions = {
  count: 3,
  kind: "mixed",
  difficulty: "mixed",
};
export type Generation = {
  id: string;
  status: "running" | "completed" | "failed" | "interrupted";
  lesson: string;
  goal: string;
  options: GenerationOptions;
  questions: Question[];
  error: string;
  createdAt: string;
};
export function generationValue(v: unknown): Generation {
  if (
    !isRecord(v) ||
    !["running", "completed", "failed", "interrupted"].includes(
      String(v.status),
    )
  )
    throw new Error("生成记录无效");
  return {
    id: idValue(v.id),
    status: v.status as Generation["status"],
    lesson: boundedText(v.lesson, 40000),
    goal: boundedText(v.goal, 2000),
    options: generationOptionsValue(v.options, legacyOptions),
    questions: questionsValue(v.questions),
    error: boundedText(v.error, 1000),
    createdAt: boundedText(v.createdAt, 50),
  };
}

