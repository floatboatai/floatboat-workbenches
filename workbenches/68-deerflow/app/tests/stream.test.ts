// DeerFlow streaming channel: SSE decoding, durable progress events, reconnect with Last-Event-ID,
// page event stream replay and service checks. Uses fakes and loopback servers only.
import { test } from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { createServer } from "node:http";
import { createResearchRuns, summarizeFrame, progressOf } from "../src/server/research-runs.ts";
import { parseSse, type SseFrame } from "../src/server/research-gateway.ts";
import { eventStream } from "../src/server/run-events.ts";
import { checkService, validateServiceUrl, saveServiceUrl, loadSettings, configuration, configSource } from "../src/server/deerflow.ts";
import { createStore } from "../src/server/store.ts";
import { researchValue } from "../src/contracts/research.ts";
import { sampleResearch } from "../src/contracts/sample.ts";
import { DEFAULT_MODEL } from "../src/contracts/run.ts";

const NATIVE = readFileSync(new URL("../src/contracts/native-sample.json", import.meta.url), "utf8");
function database() {
  const db = new DatabaseSync(":memory:");
  for (const f of ["0002_projects.sql", "0005_research_runs.sql", "0006_research_active.sql", "0007_research_desk.sql"])
    db.exec(readFileSync(new URL("../migrations/" + f, import.meta.url), "utf8"));
  return db;
}
async function until(fn: () => boolean, label = "state") {
  for (let i = 0; i < 300; i++) {
    if (fn()) return;
    await new Promise((r) => setTimeout(r, 5));
  }
  assert.fail(label + " did not settle");
}
const sse = (text: string) =>
  new ReadableStream<Uint8Array>({
    start(c) {
      const bytes = new TextEncoder().encode(text);
      c.enqueue(bytes.slice(0, 17));
      c.enqueue(bytes.slice(17));
      c.close();
    },
  });
async function* frames(list: SseFrame[], fail?: Error) {
  for (const f of list) yield f;
  if (fail) throw fail;
}
const values = (todos: [string, string][], messages: { type: string; content: string }[]) =>
  JSON.stringify({ messages, todos: todos.map(([content, status]) => ({ content, status })) });

test("SSE decoder handles split chunks, CRLF, multi-line data, ids and heartbeat comments", async () => {
  const out: SseFrame[] = [];
  for await (const f of parseSse(sse('event: metadata\r\ndata: {"run_id":"r1"}\r\nid: 1-0\r\n\r\n: heartbeat\n\nevent: values\ndata: {"a":\ndata: 1}\nid: 2-0\n\nevent: end\ndata: null\n\n')))
    out.push(f);
  assert.deepEqual(out.map((f) => [f.event, f.id]), [["metadata", "1-0"], ["values", "2-0"], ["end", ""]]);
  assert.deepEqual(JSON.parse(out[1].data), { a: 1 });
});
test("frames become readable progress lines; values carry todo progress and the latest visible message", () => {
  assert.equal(summarizeFrame({ event: "metadata", data: '{"run_id":"r1"}', id: "" }), "运行已开始（r1）");
  const v = values([["检索", "completed"], ["写报告", "in_progress"]], [{ type: "human", content: "问题" }, { type: "ai", content: "正在整理 WAL 资料" }]);
  assert.match(summarizeFrame({ event: "values", data: v, id: "" }), /2 条消息，任务 1\/2。助手：正在整理/);
  assert.equal(progressOf(JSON.parse(v))?.todos[1].status, "in_progress");
  assert.match(summarizeFrame({ event: "updates", data: '{"researcher":{"messages":[{"type":"tool","content":"读取 sqlite.org"}]}}', id: "" }), /节点更新 · researcher：工具返回 读取 sqlite\.org/);
  assert.match(summarizeFrame({ event: "gap", data: "{}", id: "" }), /读取完整状态/);
  assert.match(summarizeFrame({ event: "error", data: '{"message":"model quota"}', id: "" }), /model quota/);
});

function harness(streamImpl: (call: number, lastEventId: string) => AsyncIterable<SseFrame>, finalStatus = () => "success") {
  const db = database(),
    project = createStore(db, researchValue).create("研究", sampleResearch),
    id = randomUUID();
  let thread = "",
    posts = 0,
    streams = 0;
  const lastIds: string[] = [];
  const runs = createResearchRuns(
    db,
    async (path, method = "GET") => {
      if (method === "POST") posts++;
      if (path === "/api/threads") {
        thread = String(db.prepare("SELECT thread_id FROM deerflow_research_runs WHERE id=?").get(id)!.thread_id);
        return { thread_id: thread, metadata: { floatboat_operation_id: id } };
      }
      const status = method === "POST" ? "pending" : finalStatus();
      return { thread_id: thread, run_id: "run_1", status, metadata: { floatboat_operation_id: id } };
    },
    () => "https://deerflow.example",
    async () => NATIVE,
    {
      stream: async (_t, runId, last) => {
        assert.equal(runId, "run_1");
        lastIds.push(last);
        return streamImpl(streams++, last);
      },
      sleep: async () => {},
    },
  );
  return { db, project, id, runs, counts: () => ({ posts, streams }), lastIds };
}

test("submission joins the official run stream, records events and resumes after a drop with Last-Event-ID", async () => {
  let status = "running";
  const h = harness(
    (call) =>
      call === 0
        ? frames(
            [
              { event: "metadata", data: '{"run_id":"run_1"}', id: "1-0" },
              { event: "values", data: values([["检索资料", "in_progress"]], [{ type: "human", content: "研究 WAL" }]), id: "2-0" },
            ],
            new Error("socket hang up"),
          )
        : ((status = "success"),
          frames([
            { event: "values", data: values([["检索资料", "completed"]], [{ type: "human", content: "研究 WAL" }, { type: "ai", content: "报告完成" }]), id: "3-0" },
            { event: "end", data: "null", id: "4-0" },
          ])),
    () => status,
  );
  h.runs.start(h.project.id, h.id, "研究 WAL", DEFAULT_MODEL);
  await until(() => h.runs.read(h.id).hasResult && !h.runs.following(h.id), "result");
  assert.deepEqual(h.lastIds, ["", "2-0"], "reconnect resumes after the last stored upstream event");
  assert.equal(h.counts().posts, 2, "streaming never re-posts the run");
  const r = h.runs.read(h.id);
  assert.equal(r.phase, "success");
  assert.equal(r.stream, "ended");
  assert.equal(r.progress?.todos[0].status, "completed");
  const events = h.runs.events(h.id).map((e) => e.event);
  assert.deepEqual(events, ["command", "metadata", "values", "stream", "values", "end"]);
  assert.match(h.runs.events(h.id)[3].summary, /socket hang up/);
  assert.deepEqual(h.runs.events(h.id, 4).map((e) => e.seq), [5, 6], "events replay after a sequence number");
  h.db.close();
});
test("a replay gap falls back to the durable state read; repeated failures pause instead of looping", async () => {
  const gap = harness(() => frames([{ event: "gap", data: '{"recovery":"reload_durable_state"}', id: "" }]));
  gap.runs.start(gap.project.id, gap.id, "q", DEFAULT_MODEL);
  await until(() => gap.runs.read(gap.id).hasResult && !gap.runs.following(gap.id));
  assert.equal(gap.runs.read(gap.id).native, NATIVE);
  gap.db.close();
  const broken = harness(() => frames([], new Error("refused")), () => "running");
  broken.runs.start(broken.project.id, broken.id, "q", DEFAULT_MODEL);
  await until(() => broken.runs.read(broken.id).stream === "paused", "paused");
  assert.equal(broken.counts().streams, 7);
  assert.equal(broken.runs.read(broken.id).phase, "running");
  assert.equal(broken.counts().posts, 2);
  broken.db.close();
});
test("page event stream replays from Last-Event-ID, sends the run state and closes when the run is finished", async () => {
  const h = harness(() => frames([{ event: "end", data: "null", id: "9-0" }]));
  h.runs.start(h.project.id, h.id, "q", DEFAULT_MODEL);
  await until(() => h.runs.read(h.id).hasResult && !h.runs.following(h.id));
  const reader = eventStream(h.runs, h.id, 1, 2000).getReader();
  let text = "";
  for (;;) {
    const x = await reader.read();
    if (x.done) break;
    text += new TextDecoder().decode(x.value);
  }
  assert.match(text, /^retry: 1500/);
  assert.ok(!text.includes("id: 1\n"), "events up to Last-Event-ID are not resent");
  assert.match(text, /id: 2\nevent: progress\ndata: \{"seq":2,"event":"end"/);
  assert.match(text, /event: run\ndata: \{[^\n]*"phase":"success"/);
  assert.ok(!text.includes(NATIVE.slice(0, 40)), "the run event omits the native snapshot");
  assert.match(text, /event: done/);
  h.db.close();
});
test("service check reads the model list; refused, unauthorized and wrong services explain the next step", async () => {
  const server = createServer((req, res) => {
    res.setHeader("content-type", "application/json");
    if (req.headers.authorization === "Bearer wrong") {
      res.statusCode = 401;
      return res.end("{}");
    }
    if (req.url === "/api/models") return res.end(JSON.stringify({ models: [{ name: "gemini-3.8-flash", model: "x" }, { name: "deepseek" }], token_usage: { enabled: false } }));
    res.statusCode = 404;
    res.end("{}");
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  const a = server.address();
  if (!a || typeof a === "string") throw new Error("no address");
  const base = new URL("http://127.0.0.1:" + a.port);
  try {
    const ok = await checkService(base);
    assert.equal(ok.reachable, true);
    assert.deepEqual(ok.models, ["gemini-3.8-flash", "deepseek"]);
    process.env.DEERFLOW_TOKEN = "wrong";
    assert.match((await checkService(base)).message, /DEERFLOW_TOKEN/);
    delete process.env.DEERFLOW_TOKEN;
  } finally {
    await new Promise<void>((r) => server.close(() => r()));
  }
  // The stopped service may surface as a closed pooled socket or a refusal, depending on the platform.
  const stopped = await checkService(base);
  assert.equal(stopped.reachable, false);
  assert.match(stopped.message, /(ECONNREFUSED|ECONNRESET|UND_ERR_SOCKET)）。.*请/);
  assert.doesNotMatch(stopped.message, /fetch failed/);
  const refused = await checkService(await closedPort());
  assert.match(refused.message, /ECONNREFUSED.*请先启动DeerFlow/);
  assert.equal((await checkService(null)).configured, false);
});
/** A loopback port nothing listens on and no client has pooled a socket for. */
async function closedPort() {
  const server = createServer();
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  const a = server.address();
  if (!a || typeof a === "string") throw new Error("no address");
  await new Promise<void>((r) => server.close(() => r()));
  return new URL("http://127.0.0.1:" + a.port);
}
test("service address: loopback HTTP or remote HTTPS only; saved address is used when no environment variable is set", () => {
  assert.equal(validateServiceUrl("http://localhost:2026/x").origin, "http://localhost:2026");
  assert.throws(() => validateServiceUrl("http://deerflow.example.com"), /HTTPS/);
  assert.throws(() => validateServiceUrl("https://u:p@deerflow.example.com"), /登录信息/);
  assert.throws(() => validateServiceUrl("localhost:2026"), /http\(s\)/);
  assert.throws(() => validateServiceUrl("not a url"), /完整/);
  const db = new DatabaseSync(":memory:");
  db.exec(readFileSync(new URL("../migrations/0007_research_desk.sql", import.meta.url), "utf8").replace(/^ALTER.*$/gm, ""));
  const old = process.env.DEERFLOW_URL;
  delete process.env.DEERFLOW_URL;
  try {
    saveServiceUrl(db, "http://127.0.0.1:2026");
    loadSettings(db);
    assert.equal(configuration()?.origin, "http://127.0.0.1:2026");
    assert.equal(configSource(), "saved");
    process.env.DEERFLOW_URL = "https://deerflow.example.com";
    assert.equal(configSource(), "env");
    assert.equal(configuration()?.origin, "https://deerflow.example.com");
    delete process.env.DEERFLOW_URL;
    saveServiceUrl(db, "");
    assert.equal(configuration(), null);
  } finally {
    if (old === undefined) delete process.env.DEERFLOW_URL;
    else process.env.DEERFLOW_URL = old;
  }
});
