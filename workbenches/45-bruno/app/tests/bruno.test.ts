import { test } from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { readFileSync } from "node:fs";
import { createServer } from "node:http";
import { randomUUID } from "node:crypto";
import {
  parse,
  compose,
  composeEnvironment,
  native,
  validateNativeCollection,
} from "../src/server/bru.ts";
import { prepare } from "../src/server/prepare.ts";
import { operations, classify, redactor } from "../src/server/http.ts";
import { createEchoServer } from "../src/server/echo.ts";
import {
  restoreCollection,
  portable,
  receiptValue,
  compactResults,
  type Receipt,
  type SourceFile,
} from "../src/contracts/bruno.ts";
import { seed, blankCollection } from "../src/contracts/seed.ts";
import { syncFromUrl, syncToUrl, buildTree, sourceHash } from "../src/ui/model.ts";
import { runAssertions, parseOperator, evaluatePath } from "../src/contracts/assert.ts";
import { createInterpolator } from "../src/contracts/vars.ts";
import { createAutosaveStore } from "../src/server/autosave.ts";

const byId = (id: string) => structuredClone(seed.files.find((f) => f.id === id)!);
const db = () => {
  const d = new DatabaseSync(":memory:");
  for (const f of ["0002_projects.sql", "0003_autosave.sql", "0004_http_operations.sql", "0005_http_cancellations.sql"])
    d.exec(readFileSync(new URL("../migrations/" + f, import.meta.url), "utf8"));
  return d;
};
async function listen(server: ReturnType<typeof createServer>) {
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  const a = server.address();
  assert.ok(a && typeof a === "object");
  return `http://127.0.0.1:${a.port}`;
}
const close = (server: ReturnType<typeof createServer>) =>
  new Promise<void>((r, e) => server.close((x) => (x ? e(x) : r())));

test("seed collection is a valid native collection and every file parses", () => {
  const v = validateNativeCollection(structuredClone(seed));
  const kinds = v.files.map((f) => parse(f).kind);
  assert.ok(kinds.includes("environment") && kinds.includes("collection") && kinds.includes("folder"));
  for (const f of v.files) if (parse(f).kind === "request") assert.deepEqual(parse(f).blocked, [], f.path);
  validateNativeCollection(blankCollection());
});

test("structured edit composes with the official serializer and preserves scripts, tests and docs", () => {
  const f = byId("seed-health");
  f.source += "\nscript:pre-request {\n  req.setHeader('x', 1)\n}\n\ntests {\n  test('ok', () => {})\n}\n";
  const parsed = parse(f);
  assert.equal(parsed.blocked.length, 0);
  assert.ok(parsed.warnings.some((w) => w.includes("不执行脚本")));
  const model = parsed.model!;
  const source = compose(f, {
    ...model,
    method: "POST",
    url: "{{baseUrl}}/echo/:id?x=1",
    query: [{ name: "x", value: "1", enabled: true }],
    path: [{ name: "id", value: "42", enabled: true }],
    headers: [{ name: "X-Trace", value: "{{$randomUUID}}", enabled: true }, { name: "Off", value: "1", enabled: false }],
    bodyMode: "formUrlEncoded",
    body: { ...model.body, formUrlEncoded: [{ name: "a", value: "b", enabled: true }] },
    authMode: "apikey",
    auth: { ...model.auth, apikey: { key: "X-Key", value: "{{apiToken}}", placement: "header" } },
  });
  const n = native(source);
  assert.deepEqual(n.http, { method: "post", url: "{{baseUrl}}/echo/:id?x=1", body: "formUrlEncoded", auth: "apikey" });
  assert.equal(n.docs, "确认本机回声服务在线。首次打开即可发送。");
  assert.ok(source.includes("req.setHeader('x', 1)"));
  assert.ok(source.includes("test('ok', () => {})"));
  assert.ok(source.includes("~Off: 1"));
  const again = parse({ ...f, source }).model!;
  assert.equal(again.path[0].value, "42");
  assert.equal(again.body.formUrlEncoded[0].value, "b");
  assert.equal(again.auth.apikey.key, "X-Key");
  assert.equal(again.assertions.length, 2);
});

test("environment files use the official converters and never write secret values", () => {
  const env = byId("seed-env-staging");
  const vars = parse(env).environment!;
  assert.deepEqual(
    vars.map((v) => [v.name, v.secret]),
    [["baseUrl", false], ["customer", false], ["apiToken", true]],
  );
  const source = composeEnvironment([
    ...vars.filter((v) => v.name !== "apiToken"),
    { name: "apiToken", value: "s3cr3t-value", enabled: true, secret: true },
    { name: "plain", value: "visible", enabled: true, secret: false },
  ]);
  assert.ok(!source.includes("s3cr3t-value"));
  assert.ok(source.includes("vars:secret ["));
  assert.ok(source.includes("plain: visible"));
  assert.throws(() => composeEnvironment([{ name: "bad name", value: "", enabled: true, secret: false }]));
});

test("prepare resolves env, collection, folder and request variables with inherited auth", () => {
  const files = structuredClone(seed.files);
  const p = prepare(files, "seed-create-order", {
    environment: "本机回声",
    dynamic: { $localEcho: "http://127.0.0.1:9" },
  });
  assert.equal(p.method, "POST");
  assert.equal(p.url, "http://127.0.0.1:9/echo/v1/orders");
  assert.equal(p.headers.get("authorization"), "Bearer demo-token-2026");
  assert.equal(p.headers.get("accept"), "application/json");
  assert.equal(p.headers.get("x-client"), "floatboat-bruno");
  assert.match(p.headers.get("idempotency-key")!, /^[0-9a-f-]{36}$/);
  assert.equal(JSON.parse(String(p.body)).customer, "林知夏");
  const q = prepare(files, "seed-list-orders", { environment: "本机回声", dynamic: { $localEcho: "http://h:1" } });
  assert.equal(q.url, "http://h:1/echo/v1/orders?status=paid&page=1");
});

test("missing variables and secrets fail before any operation record", async () => {
  const files = structuredClone(seed.files);
  assert.throws(() => prepare(files, "seed-health", {}), /未定义变量 \{\{baseUrl\}\}/);
  assert.throws(
    () => prepare(files, "seed-create-order", { environment: "预发布" }),
    /秘密变量 apiToken 尚未在本次会话输入/,
  );
  const ok = prepare(files, "seed-create-order", { environment: "预发布", secrets: { apiToken: "tok-123456" } });
  assert.equal(ok.headers.get("authorization"), "Bearer tok-123456");
  assert.equal(ok.sent.headers.authorization, "•••（秘密变量）");
  const f = byId("seed-health");
  f.source = f.source.replace("{{baseUrl}}", "{{process.env.HOME}}");
  assert.throws(() => prepare([f], f.id, {}), /不读取系统环境变量/);
  const d = db();
  const ops = operations(d, async () => {
    throw new Error("must not dispatch");
  });
  const rejected = await ops.run({ operationId: randomUUID(), documentId: "d", requestId: "seed-health", data: { files, results: [], notes: "" } });
  assert.equal(rejected.state, "failed");
  assert.equal(rejected.errorKind, "invalid");
  assert.match(rejected.message!, /baseUrl/);
  assert.equal(d.prepare("SELECT COUNT(*) AS n FROM http_operations").get()!.n, 0);
  d.close();
});

test("real HTTP through the echo service: json, form, multipart and graphql bodies with assertions", async () => {
  const echo = createEchoServer();
  const base = await listen(echo);
  const d = db();
  const ops = operations(d, fetch, async () => ({ $localEcho: base }));
  const data = { files: structuredClone(seed.files), results: [], notes: "" };
  const run = (requestId: string, extra: Record<string, unknown> = {}) =>
    ops.run({ operationId: randomUUID(), documentId: "doc", requestId, data, environment: "本机回声", ...extra });
  const health = await run("seed-health");
  assert.equal(health.status, 200);
  assert.deepEqual(health.assertions!.map((a) => a.passed), [true, true]);
  const order = await run("seed-create-order");
  assert.equal(order.status, 200);
  assert.deepEqual(order.assertions!.map((a) => [a.name, a.passed]), [
    ["res.status", true],
    ["res.body.json.customer", true],
    ["res.body.json.items", true],
    ["res.body.headers.authorization", true],
  ]);
  assert.match(order.captured!.lastEchoId, /^[0-9a-f-]{36}$/);
  assert.equal(order.request!.headers["content-type"], "application/json");
  const list = await run("seed-list-orders");
  assert.ok(list.assertions!.every((a) => a.passed), JSON.stringify(list.assertions));
  const form = await run("seed-form");
  assert.equal(JSON.parse(form.body!).form.name, "林知夏");
  assert.equal(JSON.parse(form.body!).form.draft, undefined);
  assert.ok(form.assertions!.every((a) => a.passed));
  const multipart = await run("seed-multipart");
  assert.equal(JSON.parse(multipart.body!).form.note, "周五下午送达");
  assert.ok(multipart.assertions!.every((a) => a.passed));
  const gql = await run("seed-graphql");
  assert.equal(JSON.parse(gql.body!).json.query.trim().startsWith("query Order"), true);
  assert.ok(gql.assertions!.every((a) => a.passed));
  await close(echo);
  d.close();
});

test("secret values are redacted from the persisted receipt and ledger", async () => {
  const echo = createEchoServer();
  const base = await listen(echo);
  const d = db();
  const ops = operations(d, fetch, async () => ({}));
  const files = structuredClone(seed.files);
  const staging = files.find((f) => f.id === "seed-env-staging")!;
  staging.source = staging.source.replace("https://staging.orders.example", base);
  const r = await ops.run({
    operationId: randomUUID(),
    documentId: "doc",
    requestId: "seed-create-order",
    environment: "预发布",
    secrets: { apiToken: "very-secret-token" },
    data: { files, results: [], notes: "" },
  });
  assert.equal(r.status, 200);
  const ledger = String(d.prepare("SELECT payload FROM http_operations").get()!.payload);
  assert.ok(!ledger.includes("very-secret-token"));
  assert.ok(!JSON.stringify(r).includes("very-secret-token"));
  assert.equal(JSON.parse(r.body!).headers.authorization, "•••");
  assert.equal(r.request!.headers.authorization, "•••（秘密变量）");
  assert.equal(redactor(["abc123"])("x abc123 " + Buffer.from("abc123").toString("base64")), "x ••• •••");
  await close(echo);
  d.close();
});

test("connection refused and DNS failures are definite failures, not unknown receipts", async () => {
  const probe = createServer();
  const base = await listen(probe);
  await close(probe);
  const d = db();
  const files = structuredClone(seed.files);
  const ops = operations(d, fetch, async () => ({ $localEcho: base }));
  for (const requestId of ["seed-health", "seed-create-order"]) {
    const r = await ops.run({ operationId: randomUUID(), documentId: "doc", requestId, environment: "本机回声", data: { files, results: [], notes: "" } });
    assert.equal(r.state, "failed", requestId);
    assert.equal(r.errorKind, "refused");
    assert.match(r.message!, /连接被拒绝/);
  }
  const dns = Object.assign(new TypeError("fetch failed"), { cause: Object.assign(new Error("getaddrinfo ENOTFOUND x"), { code: "ENOTFOUND" }) });
  assert.equal(classify(dns, "POST", null).state, "failed");
  assert.equal(classify(dns, "POST", null).errorKind, "dns");
  const reset = Object.assign(new TypeError("fetch failed"), { cause: { code: "ECONNRESET" } });
  assert.equal(classify(reset, "POST", null).state, "unknown");
  assert.equal(classify(reset, "GET", null).state, "failed");
  assert.equal(classify(new Error("aborted"), "PATCH", "timeout").state, "unknown");
  assert.equal(classify(new Error("aborted"), "GET", "timeout").state, "failed");
  d.close();
});

test("replayed operation id never dispatches twice and mismatched content is rejected", async () => {
  const echo = createEchoServer();
  const base = await listen(echo);
  const d = db();
  let count = 0;
  const ops = operations(d, async (u, i) => {
    count++;
    return fetch(u, i);
  }, async () => ({ $localEcho: base }));
  const files = structuredClone(seed.files);
  const q = { operationId: randomUUID(), documentId: "doc", requestId: "seed-create-order", environment: "本机回声", data: { files, results: [], notes: "" } };
  const first = await ops.run(q);
  assert.deepEqual(await ops.run(q), first);
  assert.equal(count, 1);
  const changed = structuredClone(files);
  changed[0].source += "\n";
  await assert.rejects(ops.run({ ...q, data: { files: changed, results: [], notes: "" } }));
  await close(echo);
  d.close();
});

test("cancel keeps POST receipt unknown and never retries", async () => {
  const d = db();
  let count = 0;
  const ops = operations(
    d,
    async (_url, init) => {
      count++;
      await new Promise((_r, reject) => init!.signal!.addEventListener("abort", () => reject(new Error("aborted"))));
      throw new Error("unreachable");
    },
    async () => ({ $localEcho: "http://127.0.0.1:1" }),
  );
  const q = { operationId: randomUUID(), documentId: "doc", requestId: "seed-create-order", environment: "本机回声", data: seed };
  const work = ops.run(q);
  await new Promise((r) => setTimeout(r, 10));
  assert.equal(ops.get(q.operationId)!.state, "initiated");
  ops.cancel(q.operationId);
  const r = await work;
  assert.equal(r.state, "unknown");
  assert.equal(r.errorKind, "cancelled");
  await ops.run(q);
  assert.equal(count, 1);
  d.close();
});

test("cancel before dispatch persists across restart and never sends HTTP", async () => {
  const d = db(),
    id = randomUUID();
  operations(d).cancel(id);
  let count = 0;
  const ops = operations(d, async () => {
    count++;
    return new Response("unexpected");
  }, async () => ({ $localEcho: "http://127.0.0.1:1" }));
  const r = await ops.run({ operationId: id, documentId: "doc", requestId: "seed-health", environment: "本机回声", data: seed });
  assert.equal(r.state, "failed");
  assert.match(r.message!, /尚未发出/);
  assert.equal(count, 0);
  d.close();
});

test("response budget truncates at 2 MiB; restart reconciles initiated records by method safety", async () => {
  const d = db();
  const ops = operations(
    d,
    async () => new Response("a".repeat(2 * 1024 * 1024 + 10), { headers: { "content-type": "text/plain" } }),
    async () => ({ $localEcho: "http://127.0.0.1:1" }),
  );
  const q = { operationId: randomUUID(), documentId: "doc", requestId: "seed-health", environment: "本机回声", data: seed };
  const r = await ops.run(q);
  assert.equal(r.bytes, 2 * 1024 * 1024);
  assert.equal(r.truncated, true);
  receiptValue(r);
  const post = { ...r, id: randomUUID(), method: "POST", state: "initiated" };
  d.prepare("UPDATE http_operations SET payload=? WHERE id=?").run(JSON.stringify({ ...r, state: "initiated" }), r.id);
  d.prepare("INSERT INTO http_operations(id,document_id,request_fingerprint,payload) VALUES(?,?,?,?)").run(post.id, "doc", "x", JSON.stringify(post));
  const after = operations(d);
  assert.equal(after.get(r.id)!.state, "failed");
  assert.equal(after.get(post.id)!.state, "unknown");
  d.close();
});

test("forbidden header and GET body are rejected before any operation record", async () => {
  const d = db();
  const ops = operations(d, async () => {
    throw new Error("must not run");
  }, async () => ({ $localEcho: "http://127.0.0.1:1" }));
  const f = byId("seed-health");
  f.source = compose(f, { ...parse(f).model!, headers: [{ name: "Host", value: "evil", enabled: true }] });
  const hostHeader = await ops.run({ operationId: randomUUID(), documentId: "d", requestId: f.id, environment: "本机回声", data: { files: [...seed.files.filter((x) => x.id !== f.id), f], results: [], notes: "" } });
  assert.equal(hostHeader.state, "failed");
  assert.match(hostHeader.message!, /受控请求头/);
  const g = byId("seed-health");
  g.source = compose(g, { ...parse(g).model!, bodyMode: "json", body: { ...parse(g).model!.body, json: "{}" } });
  const getBody = await ops.run({ operationId: randomUUID(), documentId: "d", requestId: g.id, environment: "本机回声", data: { files: [...seed.files.filter((x) => x.id !== g.id), g], results: [], notes: "" } });
  assert.match(getBody.message!, /不能携带请求体/);
  assert.equal(d.prepare("SELECT COUNT(*) AS n FROM http_operations").get()!.n, 0);
  d.close();
});

test("declarative assertions follow Bruno operators without evaluating JavaScript", () => {
  const res = {
    status: 201,
    statusText: "Created",
    headers: { "content-type": "application/json" },
    body: { id: 7, tags: ["a", "b"], name: "Ada Lovelace", nested: { ok: true }, empty: [] },
    responseTime: 42,
  };
  assert.deepEqual(parseOperator("eq 201"), { operator: "eq", value: "201" });
  assert.deepEqual(parseOperator("isNumber"), { operator: "isNumber", value: "" });
  assert.deepEqual(parseOperator("201"), { operator: "eq", value: "201" });
  assert.equal(evaluatePath("res.headers.Content-Type", res), "application/json");
  assert.equal(evaluatePath("res.body.tags[1]", res), "b");
  assert.equal(evaluatePath("res.body['nested'].ok", res), true);
  const rows = [
    ["res.status", "eq 201"],
    ["res.status", "in 200, 201"],
    ["res.status", "between 200, 299"],
    ["res.body.id", "isNumber"],
    ["res.body.tags", "length 2"],
    ["res.body.tags", "contains \"a\""],
    ["res.body.name", "startsWith Ada"],
    ["res.body.name", "matches ^Ada\\s"],
    ["res.body.missing", "isUndefined"],
    ["res.body.empty", "isEmpty"],
    ["res.body.nested", "eq {\"ok\":true}"],
    ["res.responseTime", "lt 1000"],
    ["res.body.name", "eq {{who}}"],
  ].map(([name, value]) => ({ name, value, enabled: true }));
  const results = runAssertions(rows, res, createInterpolator([{ label: "t", values: { who: "Ada Lovelace" } }]));
  assert.deepEqual(results.filter((r) => !r.passed), []);
  const failing = runAssertions(
    [
      { name: "res.status", value: "eq 200", enabled: true },
      { name: "res.body.constructor.constructor('x')()", value: "isDefined", enabled: true },
      { name: "res.status", value: "eq 1", enabled: false },
    ],
    res,
  );
  assert.equal(failing.length, 2);
  assert.equal(failing[0].passed, false);
  assert.equal(failing[0].actual, "201");
  assert.match(failing[1].error!, /不执行 JavaScript|无法解析/);
});

test("per-request history is bounded and compacts old bodies first", () => {
  const make = (i: number, requestId: string): Receipt => ({
    id: "r" + i,
    documentId: "d",
    requestId,
    state: "complete",
    method: "GET",
    url: "http://x",
    source: "",
    startedAt: new Date(1700000000000 + i * 1000).toISOString(),
    status: 200,
    body: "x".repeat(70000),
  });
  const list = [...Array.from({ length: 15 }, (_, i) => make(i, "a")), make(100, "b")];
  const out = compactResults(list);
  assert.equal(out.filter((r) => r.requestId === "a").length, 12);
  assert.ok(new TextEncoder().encode(JSON.stringify(out)).length <= 320000);
  const latestA = out.filter((r) => r.requestId === "a").at(-1)!;
  assert.equal(latestA.compacted, undefined);
  assert.equal(latestA.snapshotTruncated, true);
  assert.equal(out.find((r) => r.requestId === "b")!.compacted, undefined);
  assert.ok(out.some((r) => r.compacted));
  restoreCollection({ files: [], results: out, notes: "" });
});

test("portable recovery retains unfinished editors and source bytes", () => {
  const v = {
    title: "copy",
    data: seed,
    extra: { "raw-seed-health": "meta { unfinished", "req-seed-health": { model: { url: "http://" }, hash: null } },
  };
  assert.deepEqual(portable({ snapshot: v }), v);
  assert.throws(() => portable({ snapshot: { ...v, title: "x".repeat(121) } }));
});

test("restoration bounds complete snapshots but permits unfinished source", () => {
  const v = { files: [{ id: "a", path: "", source: "meta {" }], results: [], notes: "" };
  assert.equal(restoreCollection(v), v);
  assert.throws(() => validateNativeCollection(v));
  assert.throws(() => restoreCollection({ ...v, files: [{ id: "a", path: "x", source: "x".repeat(200001) }] }));
  const many = { files: Array.from({ length: 300 }, (_, i) => ({ id: "f" + i, path: `r/${i}.bru`, source: "get {\n  url: http://x\n}\n" })), results: [], notes: "" };
  validateNativeCollection(many);
});

test("inactive body variants are preserved across structured edits", () => {
  const f = byId("seed-health");
  f.source += "\nbody:text {\n  retained text\n}\n";
  const model = parse(f).model!;
  assert.equal(model.body.text, "retained text");
  const source = compose(f, { ...model, name: "renamed" });
  assert.ok(source.includes("retained text"));
  assert.ok(source.includes("name: renamed"));
});

test("unsupported auth and body modes block sending but keep source", () => {
  const f = byId("seed-health");
  f.source = f.source.replace("auth: none", "auth: awsv4");
  assert.ok(parse(f).blocked.some((b) => b.includes("awsv4")));
  assert.throws(() => prepare([f], f.id, {}), /awsv4/);
  const g = byId("seed-multipart");
  g.source = g.source.replace("note: 周五下午送达", "attachment: @file(/tmp/a.txt)");
  const parsed = parse(g);
  assert.ok(parsed.blocked.some((b) => b.includes("文件字段")), JSON.stringify(parsed));
});

test("SQLite drafts keep invalid sources, duplicate receipts and conflicts", async () => {
  const d = db(),
    s = createAutosaveStore(d, validateNativeCollection);
  const q = {
    documentId: randomUUID(),
    mutationId: randomUUID(),
    draftRevision: 0,
    projectId: null,
    projectRevision: null,
    snapshot: { title: "API", data: seed, extra: { raw: "meta {" } },
  };
  const r = await s.commit(q);
  assert.equal(r.phase, "saved");
  assert.deepEqual(await s.commit(q), r);
  const invalid = { ...seed, files: [{ ...byId("seed-health"), source: "meta {" }] };
  const r2 = await s.commit({ ...q, mutationId: randomUUID(), draftRevision: 1, snapshot: { ...q.snapshot, data: invalid } });
  assert.equal(r2.phase, "draft");
  const largeData = {
    files: Array.from({ length: 20 }, (_, index) => ({
      id: `large-${index}`,
      path: `requests/large-${index}.bru`,
      source: "汉".repeat(31000),
    })),
    results: [],
    notes: "",
  };
  const largeRequest = { ...q, mutationId: randomUUID(), draftRevision: r2.draftRevision, snapshot: { ...q.snapshot, data: largeData } };
  const requestBytes = Buffer.byteLength(JSON.stringify(largeRequest));
  assert.ok(requestBytes > 1850000 && requestBytes < 1950000);
  const largeReceipt = await s.commit(largeRequest);
  assert.equal(largeReceipt.phase, "draft");
  assert.match(largeReceipt.message, /780 KB/);
  const confirmedSnapshot = s.get(q.documentId)!.snapshot;
  assert.deepEqual(confirmedSnapshot.data, largeData);
  assert.equal(JSON.stringify(restoreCollection(confirmedSnapshot.data)), JSON.stringify(largeData));
  await assert.rejects(s.commit({ ...q, mutationId: randomUUID() }));
  d.close();
});

test("URL and query table stay in sync both ways; tree groups folders and hides environments", () => {
  const model = parse(byId("seed-list-orders")).model!;
  const typed = syncFromUrl(model, "{{baseUrl}}/orders/:orderId?status=open&page=2#top");
  assert.deepEqual(typed.query.map((r) => [r.name, r.value, r.enabled]), [
    ["status", "open", true],
    ["page", "2", true],
    ["include", "items", false],
  ]);
  assert.deepEqual(typed.path.map((r) => r.name), ["orderId"]);
  const edited = syncToUrl(typed, [...typed.query.slice(0, 1), { name: "include", value: "items", enabled: true }]);
  assert.equal(edited.url, "{{baseUrl}}/orders/:orderId?status=open&include=items#top");
  const tree = buildTree(seed.files);
  assert.deepEqual(tree.folders.map((f) => f.name), ["本机", "公开示例"]);
  assert.equal(tree.folders[0].requests[0].name, "健康检查");
  assert.equal(tree.folders[0].settings?.id, "seed-folder-local");
  assert.ok(!JSON.stringify(tree).includes("environments/"));
  assert.notEqual(sourceHash("a"), sourceHash("b"));
});

test("legacy working copies from 0.6 still restore", () => {
  const legacy: { files: SourceFile[]; results: Receipt[]; notes: string } = {
    files: [{ id: "request-status", path: "requests/status.bru", source: "meta {\n  name: s\n}\n\nget {\n  url: http://127.0.0.1:8080/status\n  body: none\n  auth: none\n}\n" }],
    results: [{ id: "x", documentId: "d", requestId: "request-status", state: "unknown", method: "GET", url: "http://127.0.0.1:8080/status", source: "", startedAt: "2026-10-01T00:00:00Z", message: "fetch failed" }],
    notes: "",
  };
  validateNativeCollection(legacy);
  assert.equal(parse(legacy.files[0]).model!.url, "http://127.0.0.1:8080/status");
});
