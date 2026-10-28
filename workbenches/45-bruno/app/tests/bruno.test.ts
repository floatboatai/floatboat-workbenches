import { test } from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { readFileSync } from "node:fs";
import { createServer } from "node:http";
import {
  parse,
  compose,
  executable,
  native,
  validateNativeCollection,
} from "../src/server/bru.ts";
import { operations } from "../src/server/http.ts";
import {
  seed,
  restoreCollection,
  portable,
  receiptValue,
  type SourceFile,
} from "../src/contracts/bruno.ts";
import { createAutosaveStore } from "../src/server/autosave.ts";
import { randomUUID } from "node:crypto";
const file = () => structuredClone(seed.files[0]);
const db = () => {
  const d = new DatabaseSync(":memory:");
  for (const f of [
    "0002_projects.sql",
    "0003_autosave.sql",
    "0004_http_operations.sql",
    "0005_http_cancellations.sql",
  ])
    d.exec(
      readFileSync(new URL("../migrations/" + f, import.meta.url), "utf8"),
    );
  return d;
};
test("official Bru parse/serialize edits request and preserves docs", () => {
  const f = file();
  f.source += "\ndocs {\n  Endpoint notes\n}\n";
  const parsed = parse(f);
  assert.equal(parsed.fields!.method, "GET");
  const source = compose(f, {
    ...parsed.fields!,
    name: "Update",
    method: "POST",
    query: "page: 2\n~inactive: yes",
    headers: "Content-Type: application/json",
    bodyType: "json",
    body: '{"hello":"world"}',
  });
  const n = native(source);
  assert.deepEqual(n.http, {
    method: "post",
    url: "http://127.0.0.1:8080/status",
    body: "json",
    auth: "none",
  });
  assert.equal(n.docs, "Endpoint notes");
  assert.equal(
    parse({ ...f, source }).fields!.query,
    "page: 2\n~inactive: yes",
  );
});
test("script and tests remain in source and block send / compose", () => {
  for (const block of [
    'script:pre-request {\n  throw new Error("no run");\n}',
    'tests {\n  throw new Error("no test run");\n}',
  ]) {
    const f = file();
    f.source += "\n" + block;
    assert.ok(parse(f).blocked.length);
    assert.throws(() => executable([f], f.id));
    assert.throws(() => compose(f, parse(f).fields));
    assert.ok(f.source.includes(block));
  }
});
test("collection rules are parsed natively and block inheritance", () => {
  const rules: SourceFile = {
    id: "rules",
    path: "collection.bru",
    source:
      'meta {\n type: collection\n}\nscript:pre-request {\n throw new Error("never");\n}\n',
  };
  assert.equal(parse(rules).kind, "collection");
  assert.throws(() => executable([file(), rules], file().id));
});
test("unresolved variables / advanced auth / settings cannot run", () => {
  const f = file();
  f.source = f.source.replace("8080/status", "8080/{{id}}");
  assert.throws(() => executable([f], f.id));
  const config = {
    ...seed.files[1],
    source: '{"name":"demo","proxy":{"host":"invalid"}}',
  };
  assert.throws(() => executable([file(), config], file().id));
});
test("portable recovery retains unfinished editors and source bytes", () => {
  const v = {
    title: "copy",
    data: seed,
    extra: {
      "raw-request-status": "meta { unfinished",
      "fields-request-status": { url: "http://" },
    },
  };
  assert.deepEqual(portable({ snapshot: v }), v);
  assert.throws(() => portable({ snapshot: { ...v, title: "x".repeat(121) } }));
});
test("restoration bounds complete snapshots but permits unfinished source", () => {
  const v = {
    files: [{ id: "a", path: "", source: "meta {" }],
    results: [],
    notes: "",
  };
  assert.equal(restoreCollection(v), v);
  assert.throws(() => validateNativeCollection(v));
  assert.throws(() =>
    restoreCollection({
      ...v,
      files: [{ id: "a", path: "x", source: "x".repeat(40001) }],
    }),
  );
});
test("binary receipt accepts full 64KiB encoded response", () => {
  const r = {
    id: "a",
    documentId: "d",
    requestId: "f",
    state: "complete",
    method: "GET",
    url: "http://127.0.0.1/",
    source: "",
    startedAt: "now",
    body: Buffer.alloc(65536).toString("base64"),
    status: 200,
  };
  assert.equal(receiptValue(r), r);
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
  const invalid = { ...seed, files: [{ ...file(), source: "meta {" }] };
  const r2 = await s.commit({
    ...q,
    mutationId: randomUUID(),
    draftRevision: 1,
    snapshot: { ...q.snapshot, data: invalid },
  });
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
  const largeRequest = {
    ...q,
    mutationId: randomUUID(),
    draftRevision: r2.draftRevision,
    snapshot: { ...q.snapshot, data: largeData },
  };
  const requestBytes = Buffer.byteLength(JSON.stringify(largeRequest));
  assert.ok(requestBytes > 1850000 && requestBytes < 1950000);
  const largeReceipt = await s.commit(largeRequest);
  assert.equal(largeReceipt.phase, "draft");
  assert.match(largeReceipt.message, /780 KB/);
  const confirmedSnapshot = s.get(q.documentId)!.snapshot;
  assert.deepEqual(confirmedSnapshot.data, largeData);
  assert.equal(
    JSON.stringify(restoreCollection(confirmedSnapshot.data)),
    JSON.stringify(largeData),
  );
  assert.throws(() => validateNativeCollection(largeData), /780 KB/);
  await assert.rejects(s.commit({ ...q, mutationId: randomUUID() }));
  d.close();
});
test("HTTP writes initiation before real network; replay does not resend; response is inspected", async () => {
  const d = db();
  let count = 0;
  let sawRecord = false;
  const server = createServer(async (req, res) => {
    count++;
    sawRecord = Boolean(d.prepare("SELECT id FROM http_operations").get());
    let body = "";
    for await (const c of req) body += c;
    res.setHeader("Content-Type", "application/json");
    res.setHeader("x-fixture", "real-http");
    res.statusCode = 201;
    res.end(JSON.stringify({ method: req.method, url: req.url, body }));
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  const address = server.address();
  assert.ok(address && typeof address === "object");
  const f = file();
  f.source = compose(f, {
    ...parse(f).fields!,
    method: "POST",
    url: `http://127.0.0.1:${address.port}/echo`,
    query: "page: 2",
    bodyType: "json",
    body: '{"ok":true}',
  });
  const ops = operations(d),
    q = {
      operationId: randomUUID(),
      documentId: "doc",
      requestId: f.id,
      data: { files: [f], results: [], notes: "" },
    };
  const result = await ops.run(q);
  assert.equal(result.status, 201);
  assert.equal(result.headers!["x-fixture"], "real-http");
  assert.equal(JSON.parse(result.body!).url, "/echo?page=2");
  assert.equal(count, 1);
  assert.ok(sawRecord);
  assert.deepEqual(await ops.run(q), result);
  assert.equal(count, 1);
  await assert.rejects(
    ops.run({
      ...q,
      data: {
        files: [{ ...f, source: f.source + "\n" }],
        results: [],
        notes: "",
      },
    }),
  );
  await new Promise<void>((r, e) => server.close((x) => (x ? e(x) : r())));
  d.close();
});
test("cancel creates unknown receipt and repeated id never dispatches again", async () => {
  const d = db();
  let count = 0;
  const ops = operations(d, async (_url, init) => {
    count++;
    await new Promise((_r, reject) =>
      init!.signal!.addEventListener("abort", () =>
        reject(new Error("aborted")),
      ),
    );
    throw new Error("unreachable");
  });
  const q = {
    operationId: randomUUID(),
    documentId: "doc",
    requestId: file().id,
    data: seed,
  };
  const work = ops.run(q);
  assert.equal(ops.get(q.operationId)!.state, "initiated");
  ops.cancel(q.operationId);
  const r = await work;
  assert.equal(r.state, "unknown");
  await ops.run(q);
  assert.equal(count, 1);
  d.close();
});
test("response budget truncates and restart reconciles initiated record to unknown", async () => {
  const d = db();
  const ops = operations(
    d,
    async () =>
      new Response("a".repeat(70000), {
        headers: { "content-type": "text/plain" },
      }),
  );
  const q = {
    operationId: randomUUID(),
    documentId: "doc",
    requestId: file().id,
    data: seed,
  };
  const r = await ops.run(q);
  assert.equal(r.bytes, 65536);
  assert.equal(r.truncated, true);
  d.prepare("UPDATE http_operations SET payload=? WHERE id=?").run(
    JSON.stringify({ ...r, state: "initiated" }),
    r.id,
  );
  assert.equal(operations(d).get(r.id)!.state, "unknown");
  d.close();
});

test("inactive body fields are preserved and prevent lossy structured rewrite", () => {
  const f = file();
  f.source += "\nbody:text {\n  retained text\n}\n";
  assert.ok(parse(f).blocked.some((x) => x.includes("非当前")));
  assert.throws(() => compose(f, parse(f).fields));
  assert.ok(f.source.includes("retained text"));
});
test("quoted colon parameter names never silently change during execution", () => {
  const f = file();
  f.source += '\nparams:query {\n  "part:name": value\n}\n';
  assert.ok(parse(f).blocked.length);
  assert.throws(() => executable([f], f.id));
});
test("custom header budget blocks network before any operation record", async () => {
  const d = db();
  const f = file();
  f.source = compose(f, {
    ...parse(f).fields!,
    headers: "x-large: " + "a".repeat(17000),
  });
  const ops = operations(d, async () => {
    throw new Error("must not run");
  });
  await assert.rejects(
    ops.run({
      operationId: randomUUID(),
      documentId: "d",
      requestId: f.id,
      data: { files: [f], results: [], notes: "" },
    }),
  );
  assert.equal(
    d.prepare("SELECT COUNT(*) AS n FROM http_operations").get()!.n,
    0,
  );
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
  });
  const r = await ops.run({
    operationId: id,
    documentId: "doc",
    requestId: file().id,
    data: seed,
  });
  assert.equal(r.state, "unknown");
  assert.match(r.message!, /尚未发出/);
  assert.equal(count, 0);
  d.close();
});
