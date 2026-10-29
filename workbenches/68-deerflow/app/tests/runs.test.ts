import { test } from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { createResearchRuns as create } from "../src/server/research-runs.ts";
import { GatewayError, gateway } from "../src/server/research-gateway.ts";
import { createStore } from "../src/server/store.ts";
import { researchValue, threadValue } from "../src/contracts/research.ts";
import { sampleResearch } from "../src/contracts/sample.ts";
import { runPayload, DEFAULT_MODEL } from "../src/contracts/run.ts";
import { createServer } from "node:http";
const NATIVE = readFileSync(new URL("../src/contracts/native-sample.json", import.meta.url), "utf8");
const seed = { ...sampleResearch, stage: "reviewing" as const, native: NATIVE };
const createResearchRuns = (db: DatabaseSync, ...rest: [Parameters<typeof create>[1]?, Parameters<typeof create>[2]?, Parameters<typeof create>[3]?]) =>
  create(db, rest[0], rest[1], rest[2], { follow: false });
function database() {
  const db = new DatabaseSync(":memory:");
  for (const f of ["0002_projects.sql", "0005_research_runs.sql", "0006_research_active.sql", "0007_research_desk.sql"])
    db.exec(
      readFileSync(new URL("../migrations/" + f, import.meta.url), "utf8"),
    );
  return db;
}
async function until(fn: () => boolean) {
  for (let i = 0; i < 100; i++) {
    if (fn()) return;
    await new Promise((r) => setTimeout(r, 5));
  }
  assert.fail("did not settle");
}
const receipt = (thread: string, id: string, status = "running") => ({
  thread_id: thread,
  run_id: "run_" + id,
  status,
  metadata: { floatboat_operation_id: id },
});
test("command is durable before either remote write; duplicate command does not send twice", async () => {
  const db = database(),
    store = createStore(db, researchValue),
    project = store.create("研究", seed),
    id = randomUUID();
  let posts = 0,
    thread = "";
  const runs = createResearchRuns(
    db,
    async (path, method, body, key) => {
      const row = db
        .prepare("SELECT * FROM deerflow_research_runs WHERE id=?")
        .get(id);
      assert.ok(row);
      assert.equal(row.prompt, "明确研究目标");
      posts++;
      if (path === "/api/threads") {
        thread = String(row.thread_id);
        assert.equal(row.phase, "creating_thread");
        return { thread_id: thread, metadata: { floatboat_operation_id: id } };
      }
      assert.equal(row.phase, "submitting");
      assert.equal(key, id);
      assert.deepEqual(body, runPayload(id, "明确研究目标", DEFAULT_MODEL));
      return receipt(thread, id);
    },
    () => "https://deerflow.example",
    async () => seed.native,
  );
  runs.start(project.id, id, "明确研究目标", DEFAULT_MODEL);
  runs.start(project.id, id, "明确研究目标", DEFAULT_MODEL);
  await until(() => runs.read(id).phase === "running");
  assert.equal(posts, 2);
  assert.throws(
    () => runs.start(project.id, id, "changed", DEFAULT_MODEL),
    /不能改变/,
  );
  assert.throws(
    () => runs.start(project.id, randomUUID(), "second", DEFAULT_MODEL),
    /已有运行/,
  );
  assert.equal(store.get(project.id).data.native, seed.native);
  db.close();
});
test("accepted run with lost receipt is recovered using reads only, including after restart", async () => {
  const db = database(),
    project = createStore(db, researchValue).create("研究", seed),
    id = randomUUID();
  let postCount = 0,
    thread = "";
  const http = async (path: string, method = "GET") => {
    if (method === "POST") {
      postCount++;
      if (path === "/api/threads") {
        thread = String(
          db
            .prepare("SELECT thread_id FROM deerflow_research_runs WHERE id=?")
            .get(id)!.thread_id,
        );
        return { thread_id: thread, metadata: { floatboat_operation_id: id } };
      }
      throw new Error("connection reset after remote admission");
    }
    return [receipt(thread, id, "success")];
  };
  let runs = createResearchRuns(
    db,
    http,
    () => "https://deerflow.example",
    async () => seed.native,
  );
  runs.start(project.id, id, "question", DEFAULT_MODEL);
  await until(() => runs.read(id).phase === "unknown");
  runs = createResearchRuns(
    db,
    http,
    () => "https://deerflow.example",
    async () => seed.native,
  );
  assert.equal(postCount, 2);
  await runs.refresh(id);
  assert.equal(runs.read(id).phase, "success");
  assert.equal(runs.read(id).native, seed.native);
  assert.equal(postCount, 2);
  assert.equal(runs.list(project.id)[0].native, "");
  assert.equal(runs.list(project.id)[0].hasResult, true);
  db.close();
});
test("unknown admission and server restart never retry a POST or silently mark missing as failure", async () => {
  const db = database(),
    project = createStore(db, researchValue).create("研究", seed),
    id = randomUUID();
  let posts = 0;
  const http = async (_path: string, method = "GET") => {
    if (method === "POST") {
      posts++;
      throw new Error("lost thread response");
    }
    return [];
  };
  let runs = createResearchRuns(db, http, () => "https://deerflow.example");
  runs.start(project.id, id, "question", DEFAULT_MODEL);
  await until(() => runs.read(id).phase === "unknown");
  db.prepare(
    "UPDATE deerflow_research_runs SET phase='submitting' WHERE id=?",
  ).run(id);
  runs = createResearchRuns(db, http, () => "https://deerflow.example");
  assert.equal(runs.read(id).phase, "unknown");
  await runs.refresh(id);
  assert.equal(posts, 1);
  assert.equal(runs.read(id).phase, "unknown");
  assert.match(runs.read(id).error, /不代表未执行/);
  db.close();
});
test("model allowlist rejection is explicit and mismatched acknowledgments cannot become success", async () => {
  for (const reject of [true, false]) {
    const db = database(),
      project = createStore(db, researchValue).create("研究", seed),
      id = randomUUID();
    let thread = "";
    const runs = createResearchRuns(
      db,
      async (path) => {
        if (path === "/api/threads") {
          thread = String(
            db
              .prepare(
                "SELECT thread_id FROM deerflow_research_runs WHERE id=?",
              )
              .get(id)!.thread_id,
          );
          return {
            thread_id: thread,
            metadata: { floatboat_operation_id: id },
          };
        }
        if (reject)
          throw new GatewayError(
            400,
            "Model is not in configured model allowlist",
          );
        return receipt(thread, "wrong", "success");
      },
      () => "https://deerflow.example",
    );
    runs.start(project.id, id, "question", DEFAULT_MODEL);
    await until(() => ["unknown", "rejected"].includes(runs.read(id).phase));
    assert.equal(runs.read(id).phase, reject ? "rejected" : "unknown");
    assert.equal(runs.read(id).native, "");
    db.close();
  }
});
test("completed result read can retry without rerunning; project report stays independent", async () => {
  const db = database(),
    store = createStore(db, researchValue),
    project = store.create("研究", { ...seed, report: "edited report" }),
    id = randomUUID();
  let thread = "",
    reads = 0,
    posts = 0;
  const runs = createResearchRuns(
    db,
    async (path, method = "GET") => {
      if (method === "POST") posts++;
      if (path === "/api/threads") {
        thread = String(
          db
            .prepare("SELECT thread_id FROM deerflow_research_runs WHERE id=?")
            .get(id)!.thread_id,
        );
        return { thread_id: thread, metadata: { floatboat_operation_id: id } };
      }
      return receipt(thread, id, "success");
    },
    () => "https://deerflow.example",
    async () => {
      if (++reads === 1) throw new Error("state unavailable");
      return seed.native;
    },
  );
  runs.start(project.id, id, "question", DEFAULT_MODEL);
  await until(() => runs.read(id).error === "state unavailable");
  assert.equal(runs.read(id).phase, "success");
  await runs.refresh(id);
  assert.equal(runs.read(id).native, seed.native);
  assert.equal(posts, 2);
  assert.equal(store.get(project.id).data.report, "edited report");
  db.close();
});
test("server origin changes do not redirect retained task queries to another deployment", async () => {
  const db = database(),
    project = createStore(db, researchValue).create("研究", seed),
    id = randomUUID();
  let origin = "https://first.example",
    calls = 0;
  const runs = createResearchRuns(
    db,
    async () => {
      calls++;
      throw new Error("unknown");
    },
    () => origin,
  );
  runs.start(project.id, id, "question", DEFAULT_MODEL);
  await until(() => runs.read(id).phase === "unknown");
  origin = "https://other.example";
  await runs.refresh(id);
  assert.equal(calls, 1);
  assert.match(runs.read(id).error, /地址已改变/);
  db.close();
});
test("real HTTP adapter sends the official payload and idempotency header and validates errors", async () => {
  const old = process.env.DEERFLOW_URL;
  const calls: { path: string; method: string; key: unknown; body: unknown }[] =
    [];
  const server = createServer(async (req, res) => {
    let data = "";
    for await (const chunk of req) data += chunk;
    calls.push({
      path: req.url ?? "",
      method: req.method ?? "",
      key: req.headers["idempotency-key"],
      body: data ? JSON.parse(data) : null,
    });
    res.setHeader("content-type", "application/json");
    if (req.url?.includes("rejected")) {
      res.statusCode = 400;
      res.end(JSON.stringify({ detail: "Model not configured" }));
    } else res.end(JSON.stringify({ accepted: true }));
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  process.env.DEERFLOW_URL = "http://127.0.0.1:" + address.port;
  try {
    const id = randomUUID();
    await gateway(
      "/api/threads/thread-1/runs",
      "POST",
      runPayload(id, "Research", DEFAULT_MODEL),
      id,
    );
    assert.equal(calls[0].method, "POST");
    assert.equal(calls[0].key, id);
    assert.deepEqual(calls[0].body, runPayload(id, "Research", DEFAULT_MODEL));
    await assert.rejects(gateway("/rejected"), /Model not configured/);
    assert.throws(() => threadValue("invalid.dot"));
    assert.throws(() => threadValue("a".repeat(65)));
  } finally {
    if (old === undefined) delete process.env.DEERFLOW_URL;
    else process.env.DEERFLOW_URL = old;
    await new Promise<void>((r) => server.close(() => r()));
  }
});
