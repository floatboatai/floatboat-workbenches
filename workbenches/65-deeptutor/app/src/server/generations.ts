import type { DatabaseSync } from "node:sqlite";
import { boundedText, isRecord } from "../contracts/project.ts";
import { idValue, questionsValue, type Question } from "../contracts/tutor.ts";
import {
  generationValue,
  generationOptionsValue,
  type Generation,
  type GenerationOptions,
} from "../contracts/generation.ts";
export interface GenerationInput {
  lesson: string;
  goal: string;
  options: GenerationOptions;
  avoid: string[];
}
import { StoreError } from "./store.ts";
export function createGenerations(
  db: DatabaseSync,
  generate: (input: GenerationInput, id: string) => Promise<Question[]>,
) {
  db.prepare(
    "UPDATE tutor_generations SET status='interrupted',error='生成进程中断，已保留输入。请先核对记录，再显式建立新任务。' WHERE status='running'",
  ).run();
  const running = new Map<string, Promise<void>>();
  function view(id: string): Generation {
    const row = db
      .prepare("SELECT * FROM tutor_generations WHERE id=?")
      .get(idValue(id));
    if (!row) throw new StoreError(404, "生成记录不存在；可重试提交原操作。");
    const input: unknown = JSON.parse(String(row.input));
    if (!isRecord(input)) throw new Error("生成输入损坏");
    return generationValue({
      id: row.id,
      status: row.status,
      ...input,
      questions: JSON.parse(String(row.questions)),
      error: row.error,
      createdAt: row.created_at,
    });
  }
  function start(raw: unknown) {
    if (!isRecord(raw)) throw new Error("生成参数无效");
    const id = idValue(raw.id),
      lesson = boundedText(raw.lesson, 40000),
      goal = boundedText(raw.goal, 2000);
    if (!lesson.trim()) throw new Error("请先填写课程讲义");
    if (raw.avoid !== undefined && (!Array.isArray(raw.avoid) || raw.avoid.length > 60))
      throw new Error("已有题目列表无效");
    const avoid = (raw.avoid ?? []).map((x: unknown) => boundedText(x, 400));
    // Older clients sent only lesson+goal; keep their stored input byte-identical.
    const options =
        raw.options === undefined ? undefined : generationOptionsValue(raw.options),
      record = options ? { lesson, goal, options, avoid } : { lesson, goal };
    const input = JSON.stringify(record),
      existing = db
        .prepare("SELECT input FROM tutor_generations WHERE id=?")
        .get(id);
    if (existing) {
      if (existing.input !== input)
        throw new StoreError(409, "同一操作编号对应了不同讲义");
      return view(id);
    }
    const now = new Date().toISOString();
    db.prepare(
      "INSERT INTO tutor_generations(id,input,status,created_at,updated_at) VALUES(?,?,'running',?,?)",
    ).run(id, input, now, now);
    const task = (async () => {
      try {
        const result = questionsValue(
          await generate(
            { lesson, goal, options: generationOptionsValue(options, { count: 3, kind: "mixed", difficulty: "mixed" }), avoid },
            id,
          ),
        );
        db.prepare(
          "UPDATE tutor_generations SET status='completed',questions=?,updated_at=? WHERE id=? AND status='running'",
        ).run(JSON.stringify(result), new Date().toISOString(), id);
      } catch (e) {
        db.prepare(
          "UPDATE tutor_generations SET status='failed',error=?,updated_at=? WHERE id=? AND status='running'",
        ).run(
          (e instanceof Error ? e.message : "题库生成失败").slice(0, 1000),
          new Date().toISOString(),
          id,
        );
      } finally {
        running.delete(id);
      }
    })();
    running.set(id, task);
    return view(id);
  }
  return {
    start,
    view,
    settled: async (id: string) => {
      await running.get(id);
      return view(id);
    },
  };
}
