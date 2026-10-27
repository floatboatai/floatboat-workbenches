import assert from "node:assert/strict";
import { test } from "node:test";
import { DatabaseSync } from "node:sqlite";
import {
  executeFlow,
  seed,
  signature,
  validateFlow,
  validateGeneratedFlow,
} from "../src/contracts/flow.ts";
import { createStore, StoreError } from "../src/server/store.ts";
test("真实单链按连接顺序执行并保留步骤输入输出", () => {
  const result = executeFlow(seed);
  assert.equal(result.output, "结果：HELLO FLOATBOAT");
  assert.equal(result.steps[1].input, "hello floatboat");
  assert.equal(result.steps[1].output, "HELLO FLOATBOAT");
  assert.equal(result.steps.length, 4);
  assert.equal(result.signature, signature(seed));
});
test("拒绝分支、断链、循环及悬空引用", () => {
  assert.throws(() => executeFlow({ ...seed, edges: seed.edges.slice(1) }));
  assert.throws(() =>
    executeFlow({
      ...seed,
      edges: [
        ...seed.edges,
        { id: "extra", source: "input", target: "output" },
      ],
    }),
  );
  assert.throws(() =>
    executeFlow({
      ...seed,
      edges: [
        ...seed.edges,
        { id: "cycle", source: "output", target: "input" },
      ],
    }),
  );
  assert.throws(() =>
    validateFlow({
      ...seed,
      edges: [{ id: "bad", source: "missing", target: "output" }],
    }),
  );
  assert.throws(() =>
    validateFlow({ ...seed, nodes: [...seed.nodes, seed.nodes[0]] }),
  );
});
test("位置变化不使执行结果过期，参数变化会过期", () => {
  const moved = structuredClone(seed);
  moved.nodes[0].position.x += 100;
  assert.equal(signature(moved), signature(seed));
  moved.nodes[0].data.value = "changed";
  assert.notEqual(signature(moved), signature(seed));
});
test("保存结果、恢复及并发版本检查", () => {
  const db = new DatabaseSync(":memory:");
  try {
    db.exec(
      "CREATE TABLE projects(id TEXT PRIMARY KEY,title TEXT,payload TEXT,revision INTEGER,updated_at TEXT)",
    );
    const store = createStore(db, validateFlow);
    const saved = store.create("运行记录", {
      ...seed,
      lastRun: executeFlow(seed),
    });
    assert.equal(
      store.get(saved.id).data.lastRun?.output,
      "结果：HELLO FLOATBOAT",
    );
    store.update(saved.id, "新版本", saved.data, 1);
    assert.throws(
      () => store.update(saved.id, "覆盖", saved.data, 1),
      (e) => e instanceof StoreError && e.status === 409,
    );
  } finally {
    db.close();
  }
});

test("AI 配置剔除模型伪造的运行结果，保存恢复仍保留真实结果", () => {
  const value = { ...seed, lastRun: executeFlow(seed) };
  assert.equal(validateGeneratedFlow(value).lastRun, undefined);
  assert.deepEqual(validateGeneratedFlow(value).nodes, seed.nodes);
  assert.equal(validateFlow(value).lastRun?.output, "结果：HELLO FLOATBOAT");
  assert.equal(
    validateGeneratedFlow({ ...seed, lastRun: { malformed: true } }).lastRun,
    undefined,
  );
});
