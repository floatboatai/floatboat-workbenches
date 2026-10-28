import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { createServer } from "node:http";
import { randomUUID } from "node:crypto";
import {
  nativeValue,
  fromNative,
  lastReport,
  extractSources,
  researchValue,
  restoreResearch,
  assertReady,
  exportReport,
  safeUrl,
  seed,
} from "../src/contracts/research.ts";
import { createStore } from "../src/server/store.ts";
import { createSyncs } from "../src/server/syncs.ts";
import { fetchNative } from "../src/server/deerflow.ts";
const raw = readFileSync(
  new URL("../src/contracts/native-sample.json", import.meta.url),
  "utf8",
);
function database() {
  const db = new DatabaseSync(":memory:");
  db.exec(
    readFileSync(
      new URL("../migrations/0002_projects.sql", import.meta.url),
      "utf8",
    ),
  );
  db.exec(
    readFileSync(
      new URL("../migrations/0004_deerflow.sql", import.meta.url),
      "utf8",
    ),
  );
  return db;
}
async function until(fn: () => boolean) {
  for (let i = 0; i < 50; i++) {
    if (fn()) return;
    await new Promise((r) => setTimeout(r, 10));
  }
  assert.fail("state did not settle");
}
test("official serializer fixture reads real LangChain wire fields without executing tool calls", () => {
  const v = nativeValue(raw);
  assert.equal(v.view.messages.length, 4);
  assert.equal(v.view.messages[0].role, "human");
  assert.equal(v.view.messages[2].role, "tool");
  assert.equal(v.view.todos.length, 3);
  assert.equal(v.view.artifacts[0], "/mnt/user-data/outputs/walk-review.md");
  assert.equal(fromNative(raw).native, raw);
  assert.match(lastReport(raw), /城市步行导览/);
});
test("checkpoint history uses final materialized state and preserves the entire original envelope", () => {
  const state = JSON.parse(raw);
  const history = {
    thread_id: "research-1",
    checkpoints: [
      { values: { messages: [] }, checkpoint_id: "first" },
      { ...state, checkpoint_id: "last", unknownData: { retain: true } },
    ],
    unknownOuter: ["keep"],
  };
  const text = JSON.stringify(history);
  const p = fromNative(text, history.thread_id);
  assert.equal(p.native, text);
  assert.equal(nativeValue(p.native).view.checkpoint, "last");
  assert.deepEqual(JSON.parse(p.native).unknownOuter, ["keep"]);
});
test("sources are extracted from visible tool results and report links, not hidden context", () => {
  const state = JSON.parse(raw);
  state.values.messages.push({
    id: "secret-context",
    type: "tool",
    content: JSON.stringify({
      url: "https://private.example.org/internal",
      title: "hidden",
    }),
    additional_kwargs: { hide_from_ui: true },
  });
  const sources = extractSources(JSON.stringify(state));
  assert.equal(sources.length, 2);
  assert.ok(sources.every((s) => !s.checked));
  assert.ok(!sources.some((s) => s.url.includes("private.")));
});
test("intermediate tool-call proposals are not treated as completed reports", () => {
  const state = JSON.parse(raw);
  state.values.messages.push({
    type: "ai",
    content: "I will now research",
    tool_calls: [{ name: "web_search" }],
  });
  assert.equal(lastReport(JSON.stringify(state)), "");
});
test("source drafts preserve invalid URLs, while validated export rejects them", () => {
  const draft = structuredClone(seed);
  draft.sources[0].url = "https://";
  assert.equal(restoreResearch(draft).sources[0].url, "https://");
  assert.throws(() => researchValue(draft));
  assert.equal(safeUrl("javascript:alert(1)"), "");
  assert.equal(safeUrl("https://user:pass@example.org"), "");
});
test("delivery requires a report and reviewed evidence; inconsistent imported ready state is rejected", () => {
  assert.throws(() => assertReady(seed));
  const complete = {
    ...seed,
    report: lastReport(seed.native),
    sources: seed.sources.map((s) => ({ ...s, checked: true })),
    stage: "ready" as const,
  };
  assert.doesNotThrow(() => assertReady(complete));
  assert.match(exportReport(complete, "交付"), /人工已核验/);
  assert.throws(() => restoreResearch({ ...complete, sources: [] }));
});
test("native format and capacity checks fail without truncating data", () => {
  assert.throws(() => nativeValue("{"));
  assert.throws(() =>
    nativeValue(
      JSON.stringify({
        values: { messages: Array(301).fill({ type: "ai", content: "x" }) },
      }),
    ),
  );
  assert.throws(() => nativeValue(" ".repeat(650001)));
  assert.throws(() =>
    nativeValue(JSON.stringify({ values: { todos: [{ label: "wrong" }] } })),
  );
});
test("SQLite protects exact native state and report from stale project writes", () => {
  const db = database(),
    store = createStore(db, researchValue),
    p = store.create("报告", seed);
  store.update(p.id, "报告", { ...seed, report: "人工稿" }, p.revision);
  assert.throws(() => store.update(p.id, "旧", seed, p.revision), /另一窗口/);
  assert.equal(store.get(p.id).data.native, seed.native);
  assert.equal(store.get(p.id).data.report, "人工稿");
  db.close();
});
test("sync ledger deduplicates operation IDs and stores immutable snapshots without changing report", async () => {
  const db = database(),
    store = createStore(db, researchValue),
    p = store.create("报告", { ...seed, report: "人工草稿" });
  let calls = 0;
  const sync = createSyncs(db, async () => {
    calls++;
    return raw;
  });
  const id = randomUUID();
  sync.start(p.id, id, "upstream-1");
  sync.start(p.id, id, "upstream-1");
  await until(() => sync.read(id).status === "completed");
  assert.equal(calls, 1);
  assert.equal(sync.read(id).native, raw);
  assert.equal(sync.list(p.id)[0].native, "");
  assert.equal(store.get(p.id).data.report, "人工草稿");
  assert.throws(() => sync.start(p.id, id, "other"), /输入不一致/);
  db.close();
});
test("failed and interrupted syncs never become successful snapshots", async () => {
  const db = database(),
    p = createStore(db, researchValue).create("失败", seed),
    sync = createSyncs(db, async () => {
      throw new Error("unavailable");
    }),
    id = randomUUID();
  sync.start(p.id, id, "missing");
  await until(() => sync.read(id).status === "failed");
  assert.equal(sync.read(id).native, "");
  db.prepare("UPDATE deerflow_syncs SET status='running' WHERE id=?").run(id);
  const reopened = createSyncs(db, async () => raw);
  assert.equal(reopened.read(id).status, "interrupted");
  db.close();
});
test("HTTP read adapter follows the documented state path and rejects server errors", async () => {
  let path = "";
  const server = createServer((req, res) => {
    path = req.url ?? "";
    res.setHeader("content-type", "application/json");
    if (path.includes("missing")) {
      res.statusCode = 404;
      res.end("{}");
    } else res.end(raw);
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  const address = server.address();
  if (!address || typeof address === "string")
    throw new Error("missing address");
  const url = new URL("http://127.0.0.1:" + address.port);
  try {
    assert.equal(await fetchNative("research-1", url), raw);
    assert.equal(path, "/api/threads/research-1/state");
    await assert.rejects(fetchNative("missing", url), /HTTP 404/);
    await assert.rejects(fetchNative("../bad", url), /会话编号/);
  } finally {
    await new Promise<void>((r) => server.close(() => r()));
  }
});
