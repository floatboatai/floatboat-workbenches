import assert from "node:assert/strict";
import { test } from "node:test";
import { randomUUID } from "node:crypto";
import { createJobs, configuration, statusValue, DEFAULT_SERVE_URL } from "../src/server/docling.ts";
import { defaultOptions, formFields, serveOptions } from "../src/contracts/jobs.ts";
import { blobStore, database, realDocling } from "./helpers.ts";
const config = { base: "http://localhost:5001", key: "test-server-key", defaulted: false };
async function setup(transport: typeof fetch) {
  const db = database();
  const store = await blobStore(db);
  const pdf = new TextEncoder().encode("%PDF-1.7 fixture bytes");
  const source = await store.blobs.put("source", "report.pdf", pdf);
  const jobs = createJobs(db, store.blobs, config, transport);
  return {
    db,
    jobs,
    blobs: store.blobs,
    source,
    input: (extra: Record<string, unknown> = {}) => ({ id: randomUUID(), sourceId: source.id, filename: "report.pdf", options: defaultOptions, ...extra }),
    close: async () => {
      db.close();
      await store.close();
    },
  };
}
test("contract: PDF multipart with official options, durable IDs, result stored by hash, no duplicate submit", async () => {
  let posts = 0;
  const f = await setup(async (url, init) => {
    assert.equal(new Headers(init?.headers).get("X-Api-Key"), "test-server-key");
    assert.equal(init?.redirect, "error");
    if (String(url).endsWith("/v1/convert/file/async")) {
      posts++;
      const form = init!.body as FormData;
      const file = form.get("files") as File;
      assert.equal(file.name, "report.pdf");
      assert.equal(await file.text(), "%PDF-1.7 fixture bytes");
      assert.equal(form.get("to_formats"), "json");
      assert.equal(form.get("table_mode"), "fast");
      assert.equal(form.get("do_ocr"), "true");
      assert.equal(form.get("force_ocr"), "true");
      assert.deepEqual(form.getAll("ocr_lang"), ["zh-Hans", "en"]);
      assert.deepEqual(form.getAll("page_range"), ["2", "4"]);
      assert.equal(form.get("ocr_preset"), "rapidocr");
      return Response.json({ task_id: "upstream-123", task_status: "pending" });
    }
    if (String(url).includes("/status/poll/")) return Response.json({ task_id: "upstream-123", task_status: "success" });
    return Response.json({ document: { json_content: realDocling }, status: "success", errors: [] });
  });
  try {
    const options = serveOptions({ ...defaultOptions, table_mode: "fast", force_ocr: true, ocr_lang: "zh-Hans, en", ocr_preset: "rapidocr", page_from: 2, page_to: 4 });
    const input = f.input({ options });
    const a = await f.jobs.submit(input);
    assert.equal(a.taskId, "upstream-123");
    assert.equal(a.sourceId, f.source.id);
    await f.jobs.submit(input);
    assert.equal(posts, 1);
    const done = await f.jobs.refresh(a.id);
    assert.equal(done.state, "success");
    const result = f.jobs.result(a.id);
    const stored = await f.blobs.document(result.documentId);
    assert.equal(stored.schema_name, "DoclingDocument");
    assert.equal(result.sourceId, f.source.id);
    assert.ok(result.documentBytes > 0);
    assert.equal(f.jobs.list()[0]!.options?.table_mode, "fast");
  } finally {
    await f.close();
  }
});
test("contract: unsupported extensions, missing sources and invalid options never reach the service", async () => {
  let calls = 0;
  const f = await setup(async () => {
    calls++;
    return Response.json({});
  });
  try {
    await assert.rejects(() => f.jobs.submit(f.input({ filename: "archive.7z" })), /不支持/);
    assert.equal((await f.jobs.submit(f.input({ sourceId: "a".repeat(64) }))).state, "failure");
    assert.throws(() => serveOptions({ page_from: 5, page_to: 2 }));
    assert.throws(() => serveOptions({ ocr_lang: "zh hans!" }));
    assert.equal(calls, 0);
  } finally {
    await f.close();
  }
});
test("contract: lost submission acknowledgement is uncertain and never automatically retried", async () => {
  let calls = 0;
  const f = await setup(async () => {
    calls++;
    throw new Error("lost response");
  });
  try {
    const input = f.input();
    assert.equal((await f.jobs.submit(input)).state, "uncertain");
    assert.equal((await f.jobs.submit(input)).state, "uncertain");
    await f.jobs.refresh(input.id);
    assert.equal(calls, 1);
  } finally {
    await f.close();
  }
});
test("contract: reload after in-flight submission becomes uncertain; known upstream ID can be attached", async () => {
  let lost = false;
  const f = await setup(async () => {
    if (lost) throw new Error("lost");
    return Response.json({ task_id: "upstream-456", task_status: "started" });
  });
  try {
    const job = await f.jobs.submit(f.input());
    f.db.prepare("UPDATE docling_operations SET state='submitting',task_id=NULL WHERE id=?").run(job.id);
    const restored = createJobs(f.db, f.blobs, config, async () => Response.json({ task_id: "upstream-456", task_status: "started" }));
    assert.equal(restored.get(job.id).state, "uncertain");
    const found = await restored.attach(job.id, "upstream-456");
    assert.equal(found.state, "running");
    assert.equal(restored.pause(job.id).state, "paused");
    assert.equal((await restored.refresh(job.id)).state, "paused");
    assert.equal(restored.resume(job.id).state, "running");
  } finally {
    await f.close();
  }
});
test("contract: configuration, IDs, rejected submissions and service changes are guarded", async () => {
  assert.throws(() => configuration({ DOCLING_SERVE_URL: "http://x/path" }));
  assert.throws(() => configuration({ DOCLING_SERVE_URL: "http://user:secret@x" }));
  assert.deepEqual(configuration({}), { base: DEFAULT_SERVE_URL, key: "", defaulted: true });
  assert.equal(configuration({ DOCLING_SERVE_URL: "off" }), null);
  assert.throws(() => statusValue({ task_id: "../bad", task_status: "pending" }));
  const f = await setup(async () => new Response("", { status: 422 }));
  try {
    const input = f.input();
    assert.equal((await f.jobs.submit(input)).state, "failure");
    await assert.rejects(() => f.jobs.submit({ ...input, sourceId: "b".repeat(64) }));
    const other = createJobs(f.db, f.blobs, { base: "http://other:5001", key: "", defaulted: false });
    await assert.rejects(() => other.refresh(input.id));
  } finally {
    await f.close();
  }
});
test("contract: malformed and oversized responses pause tracking but keep the task ID", async () => {
  const f = await setup(async (url) =>
    String(url).endsWith("/file/async")
      ? Response.json({ task_id: "upstream-123", task_status: "pending" })
      : String(url).includes("/status/")
        ? Response.json({ task_id: "upstream-123", task_status: "success" })
        : Response.json({ document: { json_content: { bad: true } } }),
  );
  try {
    const j = await f.jobs.submit(f.input());
    const next = await f.jobs.refresh(j.id);
    assert.equal(next.state, "paused");
    assert.ok(next.message.includes("DoclingDocument"));
    assert.equal(next.taskId, "upstream-123");
  } finally {
    await f.close();
  }
  const g = await setup(async (url) =>
    String(url).includes("/status/") ? new Response("x".repeat(1000001)) : Response.json({ task_id: "upstream-123", task_status: "pending" }),
  );
  try {
    const j = await g.jobs.submit(g.input());
    const next = await g.jobs.refresh(j.id);
    assert.equal(next.state, "paused");
    assert.ok(next.message.includes("MB"));
  } finally {
    await g.close();
  }
});
test("contract: pause wins over an in-flight status response", async () => {
  let release: () => void = () => {};
  const gate = new Promise<void>((r) => {
    release = r;
  });
  const f = await setup(async (url) => {
    if (String(url).includes("/status/")) {
      await gate;
      return Response.json({ task_id: "upstream-123", task_status: "started" });
    }
    return Response.json({ task_id: "upstream-123", task_status: "pending" });
  });
  try {
    const j = await f.jobs.submit(f.input());
    const flight = f.jobs.refresh(j.id);
    f.jobs.pause(j.id);
    release();
    assert.equal((await flight).state, "paused");
  } finally {
    await f.close();
  }
});
test("contract: health reports the default local address, version and a clear not-running message", async () => {
  const db = database();
  const store = await blobStore(db);
  try {
    const down = createJobs(db, store.blobs, configuration({})!, async () => {
      throw new TypeError("fetch failed");
    });
    const h = await down.health();
    assert.equal(h.reachable, false);
    assert.ok(h.message.includes("127.0.0.1:5001") && !h.message.includes("fetch failed"));
    const up = createJobs(db, store.blobs, config, async (url) =>
      String(url).endsWith("/version") ? Response.json({ "docling-serve": "1.38.2" }) : Response.json({ status: "ok" }),
    );
    const ok = await up.health();
    assert.equal(ok.reachable, true);
    assert.equal(ok.version, "1.38.2");
  } finally {
    db.close();
    await store.close();
  }
});
test("form fields omit page range by default and repeat list values", () => {
  const fields = formFields(defaultOptions);
  assert.equal(fields.filter(([k]) => k === "page_range").length, 0);
  assert.ok(fields.some(([k, v]) => k === "image_export_mode" && v === "placeholder"));
});
