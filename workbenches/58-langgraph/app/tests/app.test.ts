import assert from "node:assert/strict";
import { test } from "node:test";
import { DatabaseSync } from "node:sqlite";
import { readFileSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { emptyCheckpoint, INTERRUPT } from "@langchain/langgraph-checkpoint";
import { createRunService, type ModelPrepare } from "../src/server/runs.ts";
import { SqliteCheckpointer } from "../src/server/checkpointer.ts";
import { createStore } from "../src/server/store.ts";
import {
  seed,
  projectValue,
  restoreProjectDraft,
  recordValue,
  inputValue,
  runValue,
} from "../src/contracts/review.ts";

function setup(
  model: ModelPrepare = async () => {
    throw new Error("Test Host disconnected");
  },
) {
  const dir = mkdtempSync(join(tmpdir(), "langgraph-review-"));
  let db = new DatabaseSync(join(dir, "state.sqlite"));
  for (const name of [
    "0002_projects.sql",
    "0003_autosave.sql",
    "0004_langgraph.sql",
  ])
    db.exec(
      readFileSync(new URL("../migrations/" + name, import.meta.url), "utf8"),
    );
  const project = createStore(db, projectValue).create("资料", seed);
  let runs = createRunService(db, model);
  return {
    get db() {
      return db;
    },
    get runs() {
      return runs;
    },
    project,
    reopen() {
      db.close();
      db = new DatabaseSync(join(dir, "state.sqlite"));
      runs = createRunService(db, model);
    },
    dispose() {
      db.close();
      rmSync(dir, { recursive: true, force: true });
    },
  };
}
const input = () => ({
  mode: "structured",
  source: seed.source,
  record: structuredClone(seed.input),
});

test("real LangGraph interrupts, persists SQLite across close/reopen, resumes edited delivery", async () => {
  const s = setup();
  try {
    const id = randomUUID();
    await s.runs.start(id, s.project.id, "交付", input());
    const paused = await s.runs.settle(id);
    assert.equal(paused.status, "waiting");
    assert.ok(paused.checkpoints.length >= 3);
    assert.equal(
      Number(s.db.prepare("SELECT COUNT(*) AS n FROM lg_writes").get()?.n) > 0,
      true,
    );
    s.reopen();
    const reopened = await s.runs.view(id);
    assert.equal(reopened.status, "waiting");
    assert.deepEqual(reopened.prepared, seed.input);
    const revised = { ...seed.input, summary: "由复核人员修改后的交付摘要" };
    await s.runs.resume(id, randomUUID(), reopened.version, {
      decision: "approve",
      record: revised,
      note: "已核查",
    });
    const done = await s.runs.settle(id);
    assert.equal(done.status, "completed");
    assert.equal(done.output?.summary, revised.summary);
    assert.equal(done.input.record.summary, seed.input.summary);
    assert.equal(runValue(done).id, id);
    s.reopen();
    assert.equal((await s.runs.view(id)).output?.summary, revised.summary);
  } finally {
    s.dispose();
  }
});

test("start and review command replay are idempotent; mismatched content is rejected", async () => {
  const s = setup();
  try {
    const id = randomUUID();
    await s.runs.start(id, s.project.id, "资料", input());
    await s.runs.settle(id);
    await s.runs.start(id, s.project.id, "资料", input());
    assert.equal(s.db.prepare("SELECT COUNT(*) AS n FROM lg_runs").get()?.n, 1);
    await assert.rejects(
      s.runs.start(id, s.project.id, "资料", { ...input(), source: "changed" }),
      /相同操作编号/,
    );
    const r = await s.runs.view(id),
      op = randomUUID(),
      d = { decision: "approve", record: seed.input, note: "确认" };
    await s.runs.resume(id, op, r.version, d);
    await s.runs.settle(id);
    await s.runs.resume(id, op, r.version, d);
    assert.equal(
      s.db.prepare("SELECT COUNT(*) AS n FROM lg_actions").get()?.n,
      1,
    );
    await assert.rejects(
      s.runs.resume(id, op, r.version, { ...d, note: "changed" }),
      /另一份决定/,
    );
  } finally {
    s.dispose();
  }
});

test("stale review does not overwrite the accepted decision", async () => {
  const s = setup();
  try {
    const id = randomUUID();
    await s.runs.start(id, s.project.id, "资料", input());
    const r = await s.runs.settle(id);
    await assert.rejects(
      s.runs.resume(id, randomUUID(), r.version - 1, {
        decision: "approve",
        record: seed.input,
        note: "",
      }),
      /状态已变化/,
    );
    assert.equal((await s.runs.view(id)).status, "waiting");
  } finally {
    s.dispose();
  }
});

test("rejection terminates without a delivery output", async () => {
  const s = setup();
  try {
    const id = randomUUID();
    await s.runs.start(id, s.project.id, "资料", input());
    const r = await s.runs.settle(id);
    await s.runs.resume(id, randomUUID(), r.version, {
      decision: "reject",
      record: seed.input,
      note: "需要补充附件",
    });
    const result = await s.runs.settle(id);
    assert.equal(result.status, "rejected");
    assert.equal(result.output, null);
    assert.equal(result.review?.note, "需要补充附件");
  } finally {
    s.dispose();
  }
});

test("model failure is durable and cannot silently resubmit an uncertain model call", async () => {
  let calls = 0;
  const s = setup(async () => {
    calls++;
    throw new Error("Host unavailable");
  });
  try {
    const id = randomUUID();
    await s.runs.start(id, s.project.id, "模型", { ...input(), mode: "model" });
    const r = await s.runs.settle(id);
    assert.equal(r.status, "failed");
    assert.equal(calls, 1);
    await s.runs.start(id, s.project.id, "模型", { ...input(), mode: "model" });
    await assert.rejects(s.runs.recover(id, r.version), /避免重复调用/);
    assert.equal(calls, 1);
    s.reopen();
    assert.equal((await s.runs.view(id)).status, "failed");
  } finally {
    s.dispose();
  }
});

test("cancellation survives a late provider result and never publishes a delivery", async () => {
  let release: (record: typeof seed.input) => void = () => {};
  const delayed = new Promise<typeof seed.input>((resolve) => {
    release = resolve;
  });
  const s = setup(async () => delayed);
  try {
    const id = randomUUID();
    await s.runs.start(id, s.project.id, "模型", { ...input(), mode: "model" });
    const r = await s.runs.view(id);
    await s.runs.cancel(id, r.version);
    release(seed.input);
    await s.runs.settle(id);
    assert.equal((await s.runs.view(id)).status, "cancelled");
    assert.equal((await s.runs.view(id)).output, null);
  } finally {
    s.dispose();
  }
});

test("startup marks interrupted work without executing it; saved review interruption can recover", async () => {
  const s = setup();
  try {
    const id = randomUUID();
    await s.runs.start(id, s.project.id, "资料", input());
    await s.runs.settle(id);
    s.db.prepare("UPDATE lg_runs SET status='running' WHERE id=?").run(id);
    s.reopen();
    const r = await s.runs.view(id);
    assert.equal(r.status, "interrupted");
    const recovered = await s.runs.recover(id, r.version);
    assert.equal(recovered.status, "waiting");
  } finally {
    s.dispose();
  }
});

test("checkpointer preserves metadata, parent chain, typed pending writes and overwrite semantics", async () => {
  const s = setup();
  try {
    const saver = new SqliteCheckpointer(s.db),
      cp = emptyCheckpoint();
    cp.v = 4;
    const cfg = await saver.put(
      { configurable: { thread_id: "thread", checkpoint_ns: "" } },
      cp,
      { source: "input", step: -1, parents: {} },
      {},
    );
    await saver.putWrites(cfg, [["item", { v: 1 }]], "task", "b");
    await saver.putWrites(cfg, [["item", { v: 2 }]], "task", "b");
    await saver.putWrites(
      cfg,
      [[INTERRUPT, [{ value: "first" }]]],
      "task",
      "b",
    );
    await saver.putWrites(
      cfg,
      [[INTERRUPT, [{ value: "latest" }]]],
      "task",
      "b",
    );
    const t = await saver.getTuple(cfg);
    assert.equal(t?.metadata?.step, -1);
    assert.deepEqual(t?.pendingWrites?.find((x) => x[1] === "item")?.[2], {
      v: 1,
    });
    assert.deepEqual(t?.pendingWrites?.find((x) => x[1] === INTERRUPT)?.[2], [
      { value: "latest" },
    ]);
    const cp2 = emptyCheckpoint();
    cp2.v = 4;
    const next = await saver.put(
      cfg,
      cp2,
      { source: "loop", step: 0, parents: {} },
      {},
    );
    assert.equal(
      (await saver.getTuple(next))?.parentConfig?.configurable?.checkpoint_id,
      cp.id,
    );
    let count = 0;
    for await (const _ of saver.list(
      { configurable: { thread_id: "thread" } },
      { filter: { source: "input" } },
    ))
      count++;
    assert.equal(count, 1);
    await saver.deleteThread("thread");
    assert.equal(await saver.getTuple(cfg), undefined);
  } finally {
    s.dispose();
  }
});

test("business validation rejects invalid records while editable project drafts may be incomplete", () => {
  assert.throws(() => recordValue({ ...seed.input, subject: "" }), /主题/);
  assert.equal(
    projectValue({ ...seed, input: { ...seed.input, subject: "" } }).input
      .subject,
    "",
  );
  assert.throws(
    () => inputValue({ mode: "model", source: "", record: seed.input }),
    /原始资料/,
  );
  assert.throws(
    () => recordValue({ ...seed.input, checklist: Array(41).fill("x") }),
    /40/,
  );
});

test("project revision conflicts preserve earlier saved data", () => {
  const s = setup();
  try {
    const store = createStore(s.db, projectValue);
    store.update(s.project.id, "修改", seed, 1);
    assert.throws(
      () => store.update(s.project.id, "旧稿", seed, 1),
      /另一窗口/,
    );
    assert.equal(store.get(s.project.id).title, "修改");
  } finally {
    s.dispose();
  }
});

test("incomplete long checklists and dates restore as working drafts without dropping user input", () => {
  const draft = {
    ...seed,
    input: {
      ...seed.input,
      dueDate: "2026-13-40",
      checklist: Array(41).fill("还未整理的事项"),
    },
  };
  assert.throws(() => projectValue(draft));
  const restored = restoreProjectDraft(draft);
  assert.equal(restored.input.checklist.length, 41);
  assert.equal(restored.input.dueDate, "2026-13-40");
  assert.throws(
    () => recordValue({ ...seed.input, dueDate: "2026-02-30" }),
    /日期/,
  );
});
