import assert from "node:assert/strict";
import { test } from "node:test";
import {
  seed,
  restoreFormDraft,
  validateForm,
  partialAnswers,
  readFillDraft,
} from "../src/contracts/form.ts";
test("未完成题目保留原文，填写草稿允许必填项暂空但拒绝未知答案", () => {
  const raw = structuredClone(seed);
  raw.schema.elements[0].title = "";
  assert.throws(() => validateForm(raw));
  assert.equal(restoreFormDraft(raw).schema.elements[0].title, "");
  assert.deepEqual(partialAnswers(seed.schema, {}), {});
  assert.throws(() => partialAnswers(seed.schema, { unknown: "x" }));
});
test("填写草稿保留开始填写时的定义与稳定提交ID", () => {
  const raw = {
    schema: seed.schema,
    answers: {},
    id: "d75de211-a213-4102-9f11-2ca018335433",
    revision: 2,
    submitted: false,
  };
  const restored = readFillDraft(raw);
  assert.ok(restored);
  assert.deepEqual(restored.schema, seed.schema);
  assert.equal(restored.id, raw.id);
  assert.equal(restored.revision, 2);
  assert.throws(() => readFillDraft({ ...raw, id: "bad" }));
});
