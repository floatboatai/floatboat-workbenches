import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { createServer } from "node:http";
import { randomUUID } from "node:crypto";
import { nativeValue, nativeLinks, lastReport, safeUrl, compactNative } from "../src/contracts/native.ts";
import { researchValue, restoreResearch, fromNative, assertReady, citationsIn, reportProblems, emptyResearch, mergeNativeSources } from "../src/contracts/research.ts";
import { sampleResearch } from "../src/contracts/sample.ts";
import { createStore } from "../src/server/store.ts";
import { createSyncs } from "../src/server/syncs.ts";
import { fetchNative } from "../src/server/deerflow.ts";

const raw = readFileSync(new URL("../src/contracts/native-sample.json", import.meta.url), "utf8");
function database() {
  const db = new DatabaseSync(":memory:");
  for (const f of ["0002_projects.sql", "0004_deerflow.sql"]) db.exec(readFileSync(new URL("../migrations/" + f, import.meta.url), "utf8"));
  return db;
}
const legacy = () => ({ native: raw, brief: "城市步行导览研究", report: "人工稿 [1]", sources: [{ id: "s1", url: "https://example.org/a", title: "A", excerpt: "", note: "备注", checked: true, origin: "工具结果" }], stage: "reviewing", threadId: "t-1" });

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
test("checkpoint history uses final materialized state and keeps the original envelope when it fits", () => {
  const state = JSON.parse(raw);
  const history = { thread_id: "research-1", checkpoints: [{ values: { messages: [] }, checkpoint_id: "first" }, { ...state, checkpoint_id: "last", unknownData: { retain: true } }], unknownOuter: ["keep"] };
  const text = JSON.stringify(history);
  const p = fromNative(text, history.thread_id);
  assert.equal(p.native, text);
  assert.equal(nativeValue(p.native).view.checkpoint, "last");
  assert.deepEqual(JSON.parse(p.native).unknownOuter, ["keep"]);
  assert.equal(p.threadId, "research-1");
  assert.equal(p.plan.steps.length, 3, "native todos become plan steps");
});
test("links come from visible tool results and report links, not hidden context", () => {
  const state = JSON.parse(raw);
  state.values.messages.push({ id: "secret", type: "tool", content: JSON.stringify({ url: "https://private.example.org/internal", title: "hidden" }), additional_kwargs: { hide_from_ui: true } });
  const links = nativeLinks(JSON.stringify(state));
  assert.equal(links.length, 2);
  assert.ok(!links.some((s) => s.url.includes("private.")));
  const merged = mergeNativeSources(emptyResearch(), JSON.stringify(state));
  assert.deepEqual(merged.map((s) => s.cite), [1, 2]);
  assert.ok(merged.every((s) => !s.checked && s.origin === "deerflow"));
});
test("intermediate tool-call proposals are not treated as completed reports", () => {
  const state = JSON.parse(raw);
  state.values.messages.push({ type: "ai", content: "I will now research", tool_calls: [{ name: "web_search" }] });
  assert.equal(lastReport(JSON.stringify(state)), "");
});
test("large real sessions are accepted and compacted to the project budget with a marker", () => {
  const state = JSON.parse(raw);
  for (let i = 0; i < 400; i++) state.values.messages.push({ id: "m" + i, type: "tool", content: "长工具输出".repeat(1200) });
  const big = JSON.stringify(state);
  assert.ok(big.length > 450000);
  const small = compactNative(big);
  assert.ok(small.length <= 450000);
  const v = nativeValue(small).view;
  assert.equal(v.compacted, true);
  assert.equal(v.todos.length, 3);
  assert.equal(compactNative(raw), raw, "small sessions are kept byte for byte");
  assert.throws(() => nativeValue("{"));
  assert.throws(() => nativeValue(JSON.stringify({ values: { todos: [{ label: "wrong" }] } })));
});
test("version-1 projects upgrade to numbered sources and a plan without losing the report", () => {
  const v = researchValue(legacy());
  assert.equal(v.version, 2);
  assert.equal(v.report, "人工稿 [1]");
  assert.equal(v.sources[0].cite, 1);
  assert.equal(v.sources[0].note, "备注");
  assert.equal(v.question, "城市步行导览研究");
  assert.equal(v.plan.steps.length, 3);
  assert.equal(v.threadId, "t-1");
});
test("working drafts keep unfinished source URLs while canonical saves reject them", () => {
  const draft = structuredClone(sampleResearch);
  draft.sources[0].url = "https://";
  draft.stage = "reviewing";
  assert.equal(restoreResearch(draft).sources[0].url, "https://");
  assert.throws(() => researchValue(draft), /HTTP/);
  assert.equal(safeUrl("javascript:alert(1)"), "");
  assert.equal(safeUrl("https://user:pass@example.org"), "");
  const dup = structuredClone(sampleResearch);
  dup.sources[1].cite = 1;
  assert.throws(() => restoreResearch(dup), /引用编号重复/);
});
test("citations: [n], [n, m] and full-width commas; markdown links are not citations", () => {
  assert.deepEqual(citationsIn("见 [3]，另见 [1, 4] 与 [2，5]；[链接](https://x.org) [9](https://y.org)"), [1, 2, 3, 4, 5]);
  const p = reportProblems({ ...sampleResearch, report: sampleResearch.report + "\n新增 [42]" });
  assert.deepEqual(p.dangling, [42]);
  assert.deepEqual(p.uncited, []);
});
test("sample is a complete, deliverable study: confirmed plan, verified cited sources", () => {
  const s = researchValue(sampleResearch);
  assert.equal(s.stage, "ready");
  assert.equal(s.plan.confirmed, true);
  assert.equal(s.plan.steps.length, 7);
  assert.equal(s.sources.length, 7);
  assert.ok(s.report.length > 1200);
  const p = reportProblems(s);
  assert.deepEqual(p.cited, [1, 2, 3, 4, 5, 6, 7]);
  assert.deepEqual(p.dangling, []);
  assert.doesNotThrow(() => assertReady(s));
});
test("delivery requires cited, verified sources and no dangling citations", () => {
  const base = { ...structuredClone(sampleResearch), stage: "reviewing" as const };
  assert.throws(() => assertReady({ ...base, report: "" }), /报告正文/);
  assert.throws(() => assertReady({ ...base, report: "没有引用" }), /没有引用/);
  assert.throws(() => assertReady({ ...base, report: "见 [99]" }), /不存在的来源/);
  const unchecked = structuredClone(base);
  unchecked.sources[0].checked = false;
  assert.throws(() => assertReady(unchecked), /核验.*\[1\]/);
  assert.throws(() => researchValue({ ...unchecked, stage: "ready" }), /核验/);
});
test("SQLite protects the report from stale project writes", () => {
  const db = database(),
    store = createStore(db, researchValue),
    p = store.create("报告", sampleResearch);
  store.update(p.id, "报告", { ...sampleResearch, stage: "reviewing", report: "人工稿 [1]" }, p.revision);
  assert.throws(() => store.update(p.id, "旧", sampleResearch, p.revision), /另一窗口/);
  assert.equal(store.get(p.id).data.report, "人工稿 [1]");
  db.close();
});
test("sync ledger deduplicates operation IDs, awaits the read and never changes the report", async () => {
  const db = database(),
    store = createStore(db, researchValue),
    p = store.create("报告", { ...sampleResearch, stage: "reviewing", report: "人工草稿 [1]" });
  let calls = 0;
  const sync = createSyncs(db, async () => {
    calls++;
    return raw;
  });
  const id = randomUUID();
  assert.equal((await sync.start(p.id, id, "upstream-1")).status, "completed");
  assert.equal((await sync.start(p.id, id, "upstream-1")).native, raw);
  assert.equal(calls, 1);
  assert.equal(sync.list(p.id)[0].native, "");
  assert.equal(store.get(p.id).data.report, "人工草稿 [1]");
  await assert.rejects(sync.start(p.id, id, "other"), /输入不一致/);
  db.close();
});
test("failed and interrupted syncs never become successful snapshots", async () => {
  const db = database(),
    p = createStore(db, researchValue).create("失败", sampleResearch),
    sync = createSyncs(db, async () => {
      throw new Error("unavailable");
    }),
    id = randomUUID();
  assert.equal((await sync.start(p.id, id, "missing")).status, "failed");
  db.prepare("UPDATE deerflow_syncs SET status='running' WHERE id=?").run(id);
  assert.equal(createSyncs(db, async () => raw).read(id).status, "interrupted");
  db.close();
});
test("HTTP read adapter follows the documented state path; refused connections get a next step, not 'fetch failed'", async () => {
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
  if (!address || typeof address === "string") throw new Error("missing address");
  const url = new URL("http://127.0.0.1:" + address.port);
  try {
    assert.equal(await fetchNative("research-1", url), raw);
    assert.equal(path, "/api/threads/research-1/state");
    await assert.rejects(fetchNative("missing", url), /HTTP 404/);
    await assert.rejects(fetchNative("../bad", url), /会话编号/);
  } finally {
    await new Promise<void>((r) => server.close(() => r()));
  }
  // A stopped service may surface as a closed pooled socket or a refusal, depending on the platform.
  await assert.rejects(fetchNative("research-1", url), (e: Error) => /(ECONNREFUSED|ECONNRESET|UND_ERR_SOCKET)）。.*请/.test(e.message) && !/fetch failed/.test(e.message));
  const idle = createServer();
  await new Promise<void>((r) => idle.listen(0, "127.0.0.1", r));
  const port = (idle.address() as { port: number }).port;
  await new Promise<void>((r) => idle.close(() => r()));
  await assert.rejects(fetchNative("research-1", new URL("http://127.0.0.1:" + port)), /ECONNREFUSED.*请先启动DeerFlow/);
});
