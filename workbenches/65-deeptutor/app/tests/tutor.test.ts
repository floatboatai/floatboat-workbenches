import assert from "node:assert/strict";
import { test } from "node:test";
import { DatabaseSync } from "node:sqlite";
import { readFileSync, mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  seed,
  projectValue,
  questionValue,
  questionsValue,
  applyReview,
  scheduleValue,
  type Review,
} from "../src/contracts/tutor.ts";
import { parseGenerated } from "../src/contracts/generation.ts";
import { createGenerations } from "../src/server/generations.ts";
import { createStore } from "../src/server/store.ts";
const op = "00000000-0000-4000-8000-000000000001";
const db = () => {
  const d = new DatabaseSync(":memory:");
  d.exec(
    readFileSync(
      new URL("../migrations/0004_generations.sql", import.meta.url),
      "utf8",
    ),
  );
  return d;
};
test("normalized native bank fields round-trip without losing choices and explanations", () => {
  assert.deepEqual(
    questionsValue(JSON.parse(JSON.stringify(seed.questions))),
    seed.questions,
  );
});
test("partial answers and lesson drafts survive a database close/reopen", () => {
  const dir = mkdtempSync(join(tmpdir(), "tutor-")),
    path = join(dir, "data.sqlite");
  let d = new DatabaseSync(path);
  try {
    d.exec(
      readFileSync(
        new URL("../migrations/0002_projects.sql", import.meta.url),
        "utf8",
      ),
    );
    const data = {
      ...seed,
      lesson: "# 未完成讲义\n",
      answers: { [seed.questions[1].question_id]: "尚未完成的回答…" },
      notes: "今天的笔记",
    };
    const record = createStore(d, projectValue).create("学习课程", data);
    d.close();
    d = new DatabaseSync(path);
    assert.deepEqual(createStore(d, projectValue).get(record.id).data, data);
  } finally {
    d.close();
    rmSync(dir, { recursive: true, force: true });
  }
});
test("generation replays share one recorded external call and one result", async () => {
  const d = db();
  let count = 0;
  try {
    const service = createGenerations(d, async () => {
      count++;
      return seed.questions;
    });
    const request = { id: op, lesson: "函数与集合", goal: "掌握基础" };
    service.start(request);
    service.start(request);
    const result = await service.settled(op);
    assert.equal(count, 1);
    assert.equal(result.status, "completed");
    assert.deepEqual(result.questions, seed.questions);
  } finally {
    d.close();
  }
});
test("same generation operation cannot be rebound to a new lesson", async () => {
  const d = db();
  try {
    const service = createGenerations(d, async () => seed.questions);
    service.start({ id: op, lesson: "甲", goal: "" });
    assert.throws(() => service.start({ id: op, lesson: "乙", goal: "" }));
    await service.settled(op);
  } finally {
    d.close();
  }
});
test("failed model work remains failed and is not resent by replay", async () => {
  const d = db();
  let count = 0;
  try {
    const service = createGenerations(d, async () => {
      count++;
      throw new Error("known failure");
    });
    const request = { id: op, lesson: "讲义", goal: "" };
    service.start(request);
    assert.equal((await service.settled(op)).status, "failed");
    service.start(request);
    assert.equal(count, 1);
  } finally {
    d.close();
  }
});
test("startup marks interrupted generation without calling a provider", () => {
  const d = db();
  try {
    d.prepare(
      "INSERT INTO tutor_generations(id,input,status,created_at,updated_at) VALUES(?,?,'running','2026-01-01','2026-01-01')",
    ).run(op, JSON.stringify({ lesson: "讲义", goal: "" }));
    let calls = 0;
    const service = createGenerations(d, async () => {
      calls++;
      return seed.questions;
    });
    assert.equal(service.view(op).status, "interrupted");
    assert.equal(calls, 0);
  } finally {
    d.close();
  }
});
const event: Review = {
  id: op,
  questionId: seed.questions[0].question_id,
  answer: "B",
  correct: true,
  rating: "good",
  at: 1793156400,
  state: {
    interval_days: 3,
    ease: 2.5,
    streak: 1,
    lapses: 0,
    due_at: 1793415600,
    last_review_at: 1793156400,
    review_count: 1,
    version: 1,
  },
};
test("one review operation produces one event, even after lost acknowledgement", () => {
  const course = applyReview(seed, event);
  assert.equal(applyReview(course, event).events.length, 1);
  assert.equal(course.schedules[event.questionId].review_count, 1);
  assert.throws(() =>
    applyReview(course, {
      ...event,
      id: "00000000-0000-4000-8000-000000000002",
    }),
  );
});
test("strict model decode accepts one complete JSON fence and rejects truncated or prose output", () => {
  assert.deepEqual(parseGenerated('```json\n[{"question":"q"}]\n```', "STOP"), [
    { question: "q" },
  ]);
  assert.throws(() => parseGenerated("[]", "MAX_TOKENS"));
  assert.throws(() => parseGenerated('prefix [{"question":"q"}]', "STOP"));
  assert.throws(() => parseGenerated("[", "STOP"));
});
test("invalid bank answer keys, empty questions and fractional counts are rejected", () => {
  assert.throws(() =>
    questionValue({ ...seed.questions[0], correct_answer: "Z" }),
  );
  assert.throws(() => questionValue({ ...seed.questions[0], question: "" }));
  assert.throws(() => scheduleValue({ ...event.state, review_count: 1.2 }));
});
test("portable course validates duplicate events and unknown question references", () => {
  assert.throws(() => projectValue({ ...seed, events: [event, event] }));
  assert.throws(() =>
    projectValue({ ...seed, answers: { unknown: "answer" } }),
  );
  assert.throws(() => questionsValue(Array(101).fill(seed.questions[0])));
});
