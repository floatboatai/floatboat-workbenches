import assert from "node:assert/strict";
import { test } from "node:test";
import { DatabaseSync } from "node:sqlite";
import { seed, validateForm, validateAnswers } from "../src/contracts/form.ts";
import { createStore, StoreError } from "../src/server/store.ts";
import { responseStore } from "../src/server/responses.ts";
test("问卷只允许已支持题型、唯一字段和纯文字", () => {
  assert.equal(validateForm(seed).schema.elements.length, 3);
  assert.throws(() =>
    validateForm({
      schema: {
        ...seed.schema,
        elements: [{ name: "html", title: "风险", type: "html" }],
      },
    }),
  );
  assert.throws(() =>
    validateForm({
      schema: { ...seed.schema, title: "<script>alert(1)</script>" },
    }),
  );
  assert.throws(() =>
    validateForm({
      schema: {
        ...seed.schema,
        elements: [seed.schema.elements[0], seed.schema.elements[0]],
      },
    }),
  );
});
test("答卷要求必填和选项一致性", () => {
  assert.throws(() => validateAnswers(seed.schema, {}));
  assert.throws(() =>
    validateAnswers(seed.schema, { name: "A", priority: "不存在" }),
  );
  assert.throws(() =>
    validateAnswers(seed.schema, {
      name: "A",
      priority: "工作效率",
      extra: "x",
    }),
  );
  assert.deepEqual(
    validateAnswers(seed.schema, { name: "测试者", priority: "工作效率" }),
    { name: "测试者", priority: "工作效率" },
  );
});
test("真实答卷持久化、重复提交保护、版本冲突和历史快照", () => {
  const db = new DatabaseSync(":memory:");
  try {
    db.exec(
      "CREATE TABLE projects(id TEXT PRIMARY KEY,title TEXT,payload TEXT,revision INTEGER,updated_at TEXT);CREATE TABLE responses(id TEXT PRIMARY KEY,project_id TEXT,schema_json TEXT,answers_json TEXT,created_at TEXT)",
    );
    const projects = createStore(db, validateForm),
      responses = responseStore(db),
      project = projects.create("调研", seed);
    const body = {
      id: "test-response-12345678",
      revision: 1,
      answers: { name: "甲", priority: "工作效率" },
    };
    responses.submit(project.id, body);
    responses.submit(project.id, body);
    assert.equal(responses.list(project.id).length, 1);
    projects.update(
      project.id,
      "新版本",
      { schema: { ...seed.schema, title: "新的标题" } },
      1,
    );
    assert.equal(responses.list(project.id)[0].schema.title, seed.schema.title);
    assert.throws(
      () =>
        responses.submit(project.id, { ...body, id: "test-response-87654321" }),
      (e) => e instanceof StoreError && e.status === 409,
    );
    assert.throws(
      () =>
        responses.submit(project.id, {
          ...body,
          answers: { name: "乙", priority: "工作效率" },
        }),
      (e) => e instanceof StoreError && e.status === 409,
    );
  } finally {
    db.close();
  }
});

test("多选、判断和评分保留准确类型，并拒绝越界答案", () => {
  const schema = validateForm({
    schema: {
      title: "类型边界",
      description: "",
      elements: [
        {
          name: "tags",
          type: "checkbox",
          title: "选择",
          isRequired: true,
          choices: ["甲", "乙"],
        },
        { name: "approved", type: "boolean", title: "确认", isRequired: true },
        { name: "score", type: "rating", title: "评分", isRequired: true },
      ],
    },
  }).schema;
  assert.deepEqual(
    validateAnswers(schema, { tags: ["甲"], approved: false, score: 5 }),
    { tags: ["甲"], approved: false, score: 5 },
  );
  assert.throws(() =>
    validateAnswers(schema, { tags: ["甲", "甲"], approved: false, score: 5 }),
  );
  assert.throws(() =>
    validateAnswers(schema, { tags: ["甲"], approved: "false", score: 5 }),
  );
  assert.throws(() =>
    validateAnswers(schema, { tags: ["甲"], approved: false, score: 6 }),
  );
});
