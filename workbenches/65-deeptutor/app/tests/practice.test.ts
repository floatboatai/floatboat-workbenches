// Mirrors the retired Python adapter tests (service/test_server.py, 0.5.0) and
// covers the in-process engine, generation options and tutoring requests.
import assert from "node:assert/strict";
import { test } from "node:test";
import { DatabaseSync } from "node:sqlite";
import { readFileSync } from "node:fs";
import { normalizeBank, check, review, strictBank, RAW_BANK_BYTES } from "../src/server/practice.ts";
import { createGenerations } from "../src/server/generations.ts";
import { generationPrompt, tutorPrompt, tutorRequestValue } from "../src/server/prompts.ts";
import {
  seed,
  projectValue,
  restoreDraftData,
  courseAppendingQuestions,
} from "../src/contracts/tutor.ts";
import { generationValue, generationOptionsValue } from "../src/contracts/generation.ts";

const ROW = {
  question: "哪个类型可以去重？",
  question_type: "single_choice",
  options: { A: "list", B: "set" },
  correct_answer: "B",
  explanation: "集合元素唯一",
  tags: ["集合"],
};
const op = "00000000-0000-4000-8000-000000000001";
const question = () => normalizeBank(JSON.stringify([ROW]), "json").questions[0];

test("real JSON parser assigns a stable identity", () => {
  assert.equal(question().question_id, question().question_id);
  assert.match(question().question_id, /^import:[0-9a-f]{64}$/);
});
test("CSV parser supports Chinese headers", () => {
  const q = normalizeBank("题目,题型,A,B,答案\n哪一个正确,单选,一,二,B\n", "csv").questions[0];
  assert.equal(q.correct_answer, "B");
  assert.deepEqual(q.options, { A: "一", B: "二" });
});
test("partially invalid banks report every bad row and import nothing", () => {
  const r = normalizeBank(JSON.stringify([ROW, { question: "missing answer" }, { ...ROW, correct_answer: "Z" }]), "json");
  assert.deepEqual(r.questions, []);
  assert.deepEqual(
    r.errors.map((e) => e.row),
    [2, 3],
  );
  assert.match(r.errors[0].message, /缺少题干或正确答案/);
});
test("duplicate questions are reported instead of silently merged", () => {
  const r = normalizeBank(JSON.stringify([ROW, ROW]), "json");
  assert.equal(r.questions.length, 0);
  assert.match(r.errors[0].message, /第1题与第2题重复/);
});
test("file-level problems use clear Chinese messages", () => {
  assert.throws(() => normalizeBank("{}", "json"), /JSON题库需要是题目对象组成的数组/);
  assert.throws(() => normalizeBank("[", "json"), /格式无法解析/);
  assert.throws(() => normalizeBank("a", "xlsx"), /XLSX请另存为CSV/);
  assert.throws(() => normalizeBank("x".repeat(RAW_BANK_BYTES + 1), "csv"), /1\.5MB/);
});
test("a 500-question bank with explanations is accepted", () => {
  const rows = Array.from({ length: 500 }, (_, i) => ({
    ...ROW,
    question: `第${i + 1}题：哪个类型可以去重？`,
    explanation: "集合元素唯一，可用于去重与成员判断。".repeat(4),
  }));
  assert.equal(normalizeBank(JSON.stringify(rows), "json").questions.length, 500);
});
test("objective grading runs in-process", () => {
  const q = question();
  assert.equal(check({ question: q, answer: "B" }).correct, true);
  assert.equal(check({ question: q, answer: "A" }).correct, false);
  assert.equal(check({ question: q, answer: "set" }).correct, true);
});
test("subjective grading remains self-assessment", () => {
  const q = normalizeBank(
    JSON.stringify([{ ...ROW, question_type: "short_answer", options: {}, correct_answer: "说明集合性质" }]),
    "json",
  ).questions[0];
  assert.equal(check({ question: q, answer: "我的解释" }).correct, null);
});
test("a pure review replay is stable", () => {
  const body = { id: op, question: question(), answer: "B", rating: "good", at: 1793156400, state: {} };
  const a = review(body);
  assert.deepEqual(a, review(body));
  assert.equal(a.state.review_count, 1);
  assert.equal(a.state.interval_days, 3);
  assert.equal(a.id, op);
});
test("review input is validated like the Python adapter", () => {
  const body = { id: op, question: question(), answer: "B", rating: "good", at: 1793156400, state: {} };
  assert.throws(() => review({ ...body, rating: "later" }), /复习等级无效/);
  assert.throws(() => review({ ...body, at: 10 }), /复习时间无效/);
  assert.throws(() => review({ ...body, id: "short" }), /操作编号无效/);
  assert.throws(() => review({ ...body, state: { ease: 9 } }), /范围无效/);
  assert.throws(() => review({ ...body, state: { other: 1 } }), /复习状态无效/);
});
test("a changed question identity is rejected", () => {
  const q = { ...question(), question: "改变的题目" };
  assert.throws(() => check({ question: q, answer: "B" }), /题目已变化/);
});
test("every demonstration question can be checked and scheduled offline", () => {
  for (const q of seed.questions) {
    const answer = q.correct_answer;
    const result = check({ question: q, answer });
    if (["single_choice", "multi_choice", "true_false"].includes(q.question_type))
      assert.equal(result.correct, true, q.question);
    else assert.equal(result.correct, null, q.question);
    review({ id: op, question: q, answer, rating: "hard", at: 1793156400, state: {} });
  }
  assert.ok(seed.questions.length >= 10);
});

test("generated banks must normalize cleanly", () => {
  assert.equal(strictBank([ROW]).length, 1);
  assert.throws(() => strictBank([ROW, { question: "缺答案" }]), /没有通过题库规范化/);
});
test("generation options are validated and default for legacy records", () => {
  assert.deepEqual(generationOptionsValue({ count: 8, kind: "true_false", difficulty: "应用" }), {
    count: 8,
    kind: "true_false",
    difficulty: "应用",
  });
  assert.throws(() => generationOptionsValue({ count: 13 }));
  assert.throws(() => generationOptionsValue({ kind: "essay" }));
  const legacy = generationValue({
    id: op,
    status: "completed",
    lesson: "讲义",
    goal: "",
    questions: [],
    error: "",
    createdAt: "2026-10-28",
  });
  assert.equal(legacy.options.count, 3);
});
test("generation prompts carry count, type, difficulty and existing questions", () => {
  const p = generationPrompt({
    lesson: "函数讲义",
    goal: "目标",
    options: { count: 7, kind: "fill_blank", difficulty: "理解" },
    avoid: ["已有题目甲"],
  });
  assert.match(p.system, /生成7道/);
  assert.match(p.system, /全部为fill_blank/);
  assert.match(p.system, /difficulty全部为“理解”/);
  assert.match(p.prompt, /已有题目甲/);
  assert.equal(p.model, "gemini-3.8-flash");
  assert.match(
    generationPrompt({ lesson: "x", goal: "", options: { count: 5, kind: "mixed", difficulty: "mixed" }, avoid: [] }).system,
    /混合/,
  );
});
test("generation records keep options and stay idempotent", async () => {
  const d = new DatabaseSync(":memory:");
  d.exec(readFileSync(new URL("../migrations/0004_generations.sql", import.meta.url), "utf8"));
  let seen: unknown = null,
    calls = 0;
  try {
    const service = createGenerations(d, async (input) => {
      calls++;
      seen = input;
      return seed.questions.slice(0, 2);
    });
    const request = {
      id: op,
      lesson: "讲义",
      goal: "",
      options: { count: 2, kind: "single_choice", difficulty: "基础" },
      avoid: ["旧题"],
    };
    service.start(request);
    service.start(request);
    const done = await service.settled(op);
    assert.equal(calls, 1);
    assert.deepEqual(done.options, { count: 2, kind: "single_choice", difficulty: "基础" });
    assert.deepEqual((seen as { avoid: string[] }).avoid, ["旧题"]);
    assert.throws(() => service.start({ ...request, options: { ...request.options, count: 3 } }));
  } finally {
    d.close();
  }
});

test("tutoring requests are bounded and need a follow-up after the first answer", () => {
  const base = {
    id: op,
    question: seed.questions[5],
    answer: "A",
    correct: false,
    lesson: seed.lesson,
    goal: seed.goal,
    turns: [],
  };
  const first = tutorRequestValue(base);
  const prompt = tutorPrompt(first);
  assert.match(prompt.prompt, /学习者答案：A\. \[2\]/);
  assert.match(prompt.prompt, /判定：答错/);
  assert.match(prompt.prompt, /请给出第一次讲解/);
  assert.throws(() => tutorRequestValue({ ...base, turns: [{ role: "tutor", text: "讲解" }] }), /追问/);
  const follow = tutorRequestValue({ ...base, turns: [{ role: "tutor", text: "讲解" }], followUp: "为什么共享？" });
  assert.match(tutorPrompt(follow).prompt, /学习者追问：为什么共享？/);
  assert.throws(() => tutorRequestValue({ ...base, answer: " " }), /请先作答/);
  assert.throws(
    () => tutorRequestValue({ ...base, turns: Array(12).fill({ role: "tutor", text: "x" }), followUp: "再问" }),
    /上限/,
  );
});
test("tutoring threads round-trip with the course and older courses without them load", () => {
  const id = seed.questions[0].question_id;
  const course = {
    ...seed,
    tutoring: { [id]: { answer: "A", turns: [{ role: "tutor" as const, text: "先看讲义第3节", at: 1793156400 }] } },
  };
  assert.deepEqual(projectValue(JSON.parse(JSON.stringify(course))), course);
  const { tutoring: _omit, ...legacy } = seed;
  assert.deepEqual(restoreDraftData(legacy).tutoring, {});
  assert.throws(() => projectValue({ ...seed, tutoring: { unknown: course.tutoring[id] } }));
});
test("appending generated questions keeps answers, checks and reviews", () => {
  const id = seed.questions[0].question_id;
  const base = { ...seed, answers: { [id]: "B" }, questions: seed.questions.slice(0, 3) };
  const next = courseAppendingQuestions(base, seed.questions.slice(2, 6));
  assert.equal(next.questions.length, 6);
  assert.equal(next.answers[id], "B");
  assert.equal(next.selected, seed.questions[3].question_id);
});
