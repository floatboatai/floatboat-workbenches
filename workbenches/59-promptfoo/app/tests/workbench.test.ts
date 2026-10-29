import assert from "node:assert/strict";
import { test, after } from "node:test";
import { readFileSync, readdirSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import { emptyProject, validateProject, restoreProjectDraft, reviewKey, releaseKey } from "../src/contracts/evaluation.ts";
import { parseRun } from "../src/contracts/results.ts";
import { columnStats, diffCell, recommend, textDiff, defaultGate } from "../src/contracts/compare.ts";
import { reportCsv, reportHtml } from "../src/contracts/reports.ts";
import { createRuns, createTasks, migrateLegacyProjects } from "../src/server/runs.ts";
import { createSandbox } from "../src/server/sandbox.ts";
import { createRunner } from "../src/server/runner.ts";
import { createAutosaveStore } from "../src/server/autosave.ts";
import type { HostModel } from "../src/server/evaluator.ts";

const sampleConfig = readFileSync(new URL("../samples/promptfooconfig.yaml", import.meta.url), "utf8");
const recordedText = readFileSync(new URL("../samples/recorded-run.json", import.meta.url), "utf8");
const recorded = JSON.parse(recordedText);
const sandbox = createSandbox();
after(() => sandbox.close());
function database() {
  const db = new DatabaseSync(":memory:");
  const dir = new URL("../migrations/", import.meta.url);
  for (const f of readdirSync(dir).sort()) db.exec(readFileSync(new URL(f, dir), "utf8"));
  return db;
}
const until = async (fn: () => boolean, ms = 20000) => {
  const end = Date.now() + ms;
  while (!fn()) {
    if (Date.now() > end) throw new Error("timeout");
    await new Promise((r) => setTimeout(r, 20));
  }
};

test("baseline by prompt version: regressions, fixes, column stats and release gate", () => {
  const run = parseRun(recorded);
  const baseline = { kind: "prompt", prompt: "v1 现网" } as const;
  const stats = columnStats(run, baseline, null);
  const col = (prompt: string, provider: string) => stats.find((s) => s.column.prompt === prompt && s.column.provider === provider)!;
  const v3small = col("v3 精简", "小模型 · 示例录制");
  assert.equal(v3small.total, 36);
  assert.ok(v3small.compared === 36 && v3small.regressions >= 1);
  const v1 = col("v1 现网", "大模型 · 示例录制");
  assert.equal(recommend(v1, defaultGate, true).verdict, "baseline");
  const v3large = col("v3 精简", "大模型 · 示例录制");
  const rec = recommend(v3large, defaultGate, false);
  assert.equal(rec.verdict, v3large.regressions ? "hold" : "ship");
  const v2small = col("v2 结构化+工具", "小模型 · 示例录制");
  assert.ok(v2small.error > 0);
  assert.equal(recommend(v2small, defaultGate, false).verdict, "block", "execution errors block release");
  const script = col("v1 现网", "规则分诊脚本");
  assert.equal(script.compared, 0, "script column has no same-provider baseline");
  assert.equal(recommend({ ...script, passRate: 1, error: 0, regressions: 0, skipped: 1 }, defaultGate, false).verdict, "hold", "unexecuted grading cannot recommend shipping");
  const cell = run.cells.find((c) => run.columns[c.column].prompt === "v3 精简" && !c.pass)!;
  assert.ok(["regressed", "same-fail"].includes(diffCell(run, cell, baseline, null).state));
});

test("baseline by run compares the same cell keys across runs", () => {
  const a = parseRun(recorded);
  const changed = structuredClone(recorded);
  const row = changed.results.results.find((r: { success: boolean }) => r.success);
  row.success = false;
  row.failureReason = 1;
  const b = parseRun(changed);
  const regressed = b.cells.filter((c) => diffCell(b, c, { kind: "run", runId: "x" }, a).state === "regressed");
  assert.equal(regressed.length, 1);
  assert.equal(columnStats(b, { kind: "run", runId: "x" }, a).reduce((s, c) => s + c.regressions, 0), 1);
});

test("text diff marks inserted and removed words and CJK characters", () => {
  const parts = textDiff("退款已在 10 月 22 日退回", "退款已在 10 月 23 日原路退回");
  assert.equal(parts.filter((p) => p.kind !== "add").map((p) => p.text).join(""), "退款已在 10 月 22 日退回");
  assert.equal(parts.filter((p) => p.kind !== "del").map((p) => p.text).join(""), "退款已在 10 月 23 日原路退回");
  assert.ok(parts.some((p) => p.kind === "add" && p.text.includes("原路")));
  assert.ok(parts.some((p) => p.kind === "del" && p.text.includes("22")));
  assert.deepEqual(textDiff("same", "same"), [{ kind: "same", text: "same" }]);
});

test("CSV escapes formulas and HTML report escapes content with release decisions", () => {
  const run = parseRun(recorded);
  const runId = "smp-run";
  const cell = run.cells.find((c) => !c.pass)!;
  const col = run.columns[cell.column];
  const input = {
    title: "售后助手 <发布>",
    runId,
    runName: "示例",
    run,
    baseline: { kind: "prompt", prompt: "v1 现网" } as const,
    baselineRun: null,
    baselineName: "v1 现网",
    reviews: { [reviewKey(runId, cell.key)]: { decision: "reject" as const, note: "=cmd|' /C calc'!A0 <script>" } },
    releases: { [releaseKey(runId, col.key)]: { decision: "hold" as const, note: "等修复优先级" } },
    gate: defaultGate,
  };
  const csv = reportCsv(input);
  assert.ok(csv.startsWith("﻿"));
  assert.equal(csv.split("\r\n").length, 253);
  assert.match(csv, /"'=cmd/);
  const html = reportHtml(input);
  assert.match(html, /售后助手 &lt;发布&gt;/);
  assert.doesNotMatch(html, /<script>/);
  assert.match(html, /暂缓/);
  assert.match(html, /逐项发布判断/);
});

test("project validation: limits, decisions, baseline, legacy 0.4 shape and oversized drafts", () => {
  const ok = validateProject({
    ...emptyProject,
    runs: [{ id: "run-abcdef", name: "r", createdAt: "2026-10-29", origin: "local", stats: { total: 1, pass: 1, fail: 0, error: 0, columns: 1, tests: 1 } }],
    current: "run-abcdef",
    baseline: { kind: "prompt", prompt: "v1" },
    releases: { "run-abcdef:c": { decision: "ship", note: "" } },
  });
  assert.equal(ok.current, "run-abcdef");
  assert.throws(() => validateProject({ ...emptyProject, current: "missing-run" }), /当前运行/);
  assert.throws(() => validateProject({ ...emptyProject, releases: { x: { decision: "maybe" } } }), /发布判断/);
  assert.throws(() => validateProject({ ...emptyProject, reviews: { __proto__x: { decision: "accept" }, ["__proto__"]: { decision: "accept" } } }));
  assert.throws(() => validateProject({ ...emptyProject, gate: { minPassRate: 2, maxRegressions: 0 } }), /门槛/);
  const legacy = validateProject({ reports: [], activeId: "", baseline: 0, reviews: {}, suite: JSON.stringify({ description: "d", prompts: [{ label: "A", raw: "{{x}}" }], tests: [{ vars: { x: "1" }, assert: [] }] }) });
  assert.equal(legacy.version, 2);
  assert.match(legacy.config, /label: "A"/);
  const big = { ...emptyProject, reviews: Object.fromEntries(Array.from({ length: 200 }, (_, i) => [`r:${i}`, { decision: "accept", note: "x".repeat(5000) }])) };
  assert.throws(() => validateProject(big), /880KB/);
  assert.equal(Object.keys(restoreProjectDraft(big).reviews).length, 200);
});

test("chunked result import: assembles parts, validates, is idempotent and rejects broken JSON", () => {
  const db = database();
  const runs = createRuns(db);
  const uploadId = randomUUID();
  const size = Math.ceil(recordedText.length / 3);
  const parts = [0, 1, 2].map((i) => recordedText.slice(i * size, (i + 1) * size));
  assert.deepEqual(runs.importPart({ uploadId, part: 0, total: 3, data: parts[0], name: "录制" }), { done: false, received: 1 });
  runs.importPart({ uploadId, part: 2, total: 3, data: parts[2], name: "录制" });
  const done = runs.importPart({ uploadId, part: 1, total: 3, data: parts[1], name: "录制" });
  assert.equal(done.done, true);
  if (!done.done) return;
  assert.equal(done.run.stats.total, 252);
  assert.deepEqual(runs.importPart({ uploadId, part: 0, total: 3, data: "", name: "x" }), done, "replayed upload returns same run");
  assert.equal(JSON.parse(runs.raw(done.run.id)).results.results.length, 252);
  const broken = randomUUID();
  assert.throws(() => runs.importPart({ uploadId: broken, part: 0, total: 1, data: "{" }), /完整 JSON/);
  assert.throws(() => runs.importPart({ uploadId: broken, part: 0, total: 1, data: '{"a":1}' }), /Promptfoo 结果/);
  assert.throws(() => runs.raw("run-missing"), /不在本机/);
});

test("local evaluation task: persisted, idempotent, replays recordings, restart marks interrupted", async () => {
  const db = database();
  const runs = createRuns(db);
  const source = runs.store("smp-00000000-0000-4000-8000-000000000001", "示例录制", "sample", recorded);
  const tasks = createTasks(db, runs, { sandbox, host: () => null });
  const id = randomUUID();
  const body = { id, config: sampleConfig, sources: [source.id], name: "本机评测" };
  const first = tasks.start(body);
  assert.equal(first.total, 252);
  assert.equal(tasks.start(body).id, id, "same id + same input returns the same task");
  assert.throws(() => tasks.start({ ...body, name: "changed" }), /不同输入/);
  await until(() => tasks.view(id).state === "completed");
  const view = tasks.view(id);
  assert.equal(view.run?.stats.total, 252);
  const run = parseRun(JSON.parse(runs.raw(view.run!.id)));
  const official = parseRun(recorded);
  assert.equal(run.cells.filter((c) => c.pass).length, official.cells.filter((c) => c.pass).length);
  assert.ok(run.cells.filter((c) => c.replayedFrom === source.id).length === 216);
  db.prepare("UPDATE eval_tasks SET state='running' WHERE id=?").run(id);
  createRuns(db);
  assert.equal(tasks.view(id).state, "interrupted");
  assert.throws(() => tasks.start({ id: randomUUID(), config: "prompts: [", sources: [] }), /行|配置/);
});

test("Host columns need explicit confirmation and a connection; stop cancels without a run", async () => {
  const db = database();
  const runs = createRuns(db);
  let calls = 0;
  const host: HostModel = {
    async generateText(input) {
      calls++;
      await new Promise((r) => setTimeout(r, 30));
      return { text: `ok ${input.prompt}`, model: "m", finishReason: "STOP" };
    },
  };
  const config = "prompts: ['{{q}}']\nproviders: [floatboat:gemini-3.8-flash]\ntests:\n" + Array.from({ length: 12 }, (_, i) => `  - vars: {q: q${i}}\n`).join("");
  const offline = createTasks(db, runs, { sandbox, host: () => null });
  assert.throws(() => offline.start({ id: randomUUID(), config, sources: [], allowHost: true }), /没有连接 Floatboat/);
  const tasks = createTasks(db, runs, { sandbox, host: () => host });
  assert.throws(() => tasks.start({ id: randomUUID(), config, sources: [] }), /12 次真实模型调用/);
  const id = randomUUID();
  tasks.start({ id, config, sources: [], allowHost: true });
  await until(() => calls >= 2);
  tasks.cancel(id);
  await until(() => tasks.view(id).state === "cancelled");
  assert.equal(tasks.view(id).run, null);
  assert.ok(calls < 12);
});

test("0.4 projects migrate reports into runs and remap reviews to stable cell keys", () => {
  const db = database();
  const runs = createRuns(db);
  const real = readFileSync(new URL("./fixtures/promptfoo-0.125.1-echo.json", import.meta.url), "utf8");
  db.prepare("INSERT INTO projects(id,title,payload,revision,updated_at) VALUES(?,?,?,1,?)").run(
    "old",
    "旧项目",
    JSON.stringify({ reports: [{ id: "rep-1", name: "回显", raw: real }], activeId: "rep-1", baseline: 0, reviews: { "rep-1:1:1": { decision: "reject", note: "改" } }, suite: "{}" }),
    "2026-10-27",
  );
  migrateLegacyProjects(db, runs);
  const row = db.prepare("SELECT payload,revision FROM projects WHERE id='old'").get()!;
  const data = validateProject(JSON.parse(String(row.payload)));
  assert.equal(Number(row.revision), 2);
  assert.equal(data.runs.length, 1);
  assert.equal(data.current, data.runs[0].id);
  const [key] = Object.keys(data.reviews);
  const view = parseRun(JSON.parse(runs.raw(data.runs[0].id)));
  assert.equal(view.byKey.get(key.slice(data.runs[0].id.length + 1))?.test, 1);
  migrateLegacyProjects(db, runs);
  assert.equal(Number(db.prepare("SELECT revision FROM projects WHERE id='old'").get()!.revision), 2, "migration runs once");
});

test("autosave keeps invalid working copies as drafts and is idempotent for a lost response", async () => {
  const db = database();
  const store = createAutosaveStore(db, validateProject);
  const documentId = randomUUID(),
    mutationId = randomUUID();
  const request = { documentId, mutationId, draftRevision: 0, projectId: null, projectRevision: null, snapshot: { title: "发布评测", data: emptyProject, extra: { config: "prompts: [" } } };
  const first = await store.commit(request);
  assert.equal(first.phase, "saved");
  assert.deepEqual(await store.commit(request), first, "lost response retried with same mutation");
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM projects").get()!.n, 1);
  const invalid = await store.commit({ ...request, mutationId: randomUUID(), draftRevision: 1, projectId: first.project!.id, projectRevision: 1, snapshot: { ...request.snapshot, data: { ...emptyProject, current: "nope-run" } } });
  assert.equal(invalid.phase, "draft");
  assert.equal(store.get(documentId)?.snapshot.extra.config, "prompts: [");
});

test("official runner connector: status card when unconfigured, protocol check, uncertain receipts", async () => {
  const db = database();
  const runs = createRuns(db);
  const none = createRunner(db, runs, undefined);
  const h = await none.health();
  assert.equal(h.connected, false);
  assert.match(h.start, /pnpm start/);
  assert.match((await createRunner(db, runs, "http://example.com").health()).message, /HTTPS/);
  let fail = true;
  const fetcher = (async (url: URL | string, init?: RequestInit) => {
    const path = new URL(String(url)).pathname;
    if (path === "/health") return Response.json({ service: "floatboat-promptfoo-runner", version: "0.125.1", protocol: 2 });
    if (fail) throw new Error("socket hang up");
    const body = JSON.parse(String(init?.body ?? "{}"));
    return Response.json({ id: body.id ?? "eval-00000000-0000-4000-8000-000000000009", state: "completed", report: recorded });
  }) as typeof fetch;
  const runner = createRunner(db, runs, "http://127.0.0.1:8770", undefined, fetcher);
  assert.equal((await runner.health()).connected, true);
  const id = "eval-00000000-0000-4000-8000-000000000009";
  const pending = await runner.start({ id, config: sampleConfig, sources: [] });
  assert.equal(pending.state, "uncertain");
  fail = false;
  const done = await runner.poll(id);
  assert.equal(done.state, "completed");
  assert.equal(done.run?.origin, "official");
  assert.equal((await runner.start({ id, config: sampleConfig, sources: [] })).state, "completed");
  await assert.rejects(runner.start({ id, config: sampleConfig + "\n# changed", sources: [] }), /不同输入/);
});

test("official completion found by polling cannot regress under a late rejected submission", async () => {
  const db = database();
  const runs = createRuns(db);
  const id = "eval-00000000-0000-4000-8000-000000000010";
  let rejectPost!: (r: Response) => void;
  const post = new Promise<Response>((resolve) => { rejectPost = resolve; });
  const fetcher = (async (_url: URL | string, init?: RequestInit) =>
    init?.method === "POST" ? post : Response.json({ id, state: "completed", report: recorded })) as typeof fetch;
  const runner = createRunner(db, runs, "http://127.0.0.1:8770", undefined, fetcher);
  const submission = runner.start({ id, config: sampleConfig, sources: [] });
  assert.equal((await runner.poll(id)).state, "completed");
  rejectPost(Response.json({ error: "late rejection" }, { status: 400 }));
  assert.equal((await submission).state, "completed");
  assert.equal(runner.read(id).run?.origin, "official");
});
