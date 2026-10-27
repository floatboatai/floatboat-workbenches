import { example } from "../src/contracts/example.ts";
import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import {
  createJobs,
  configuration,
  statusValue,
} from "../src/server/docling.ts";
const fixture = example;
async function setup(transport: typeof fetch) {
  const dir = await mkdtemp(join(tmpdir(), "docling-test-")),
    db = new DatabaseSync(":memory:");
  db.exec(
    readFileSync(
      new URL("../migrations/0004_docling_operations.sql", import.meta.url),
      "utf8",
    ),
  );
  const config = { base: "http://localhost:5001", key: "test-server-key" };
  const path = async (name: string) => join(dir, name);
  const jobs = createJobs(db, path, config, transport);
  return {
    jobs,
    db,
    path,
    config,
    close: async () => {
      db.close();
      await rm(dir, { recursive: true, force: true });
    },
  };
}
const input = () => ({
  id: randomUUID(),
  html: "<h1>Test</h1>",
  filename: "input.html",
});
test("contract: official multipart upload, durable IDs, poll and result, no duplicate submit", async () => {
  let posts = 0;
  const transport: typeof fetch = async (url, init) => {
    assert.equal(
      new Headers(init?.headers).get("X-Api-Key"),
      "test-server-key",
    );
    assert.equal(init?.redirect, "error");
    if (String(url).endsWith("/file/async")) {
      posts++;
      assert.ok(init?.body instanceof FormData);
      assert.equal(init.body.get("to_formats"), "json");
      assert.ok(init.body.get("files") instanceof Blob);
      return Response.json({ task_id: "upstream-123", task_status: "pending" });
    }
    if (String(url).includes("/status/poll/"))
      return Response.json({ task_id: "upstream-123", task_status: "success" });
    return Response.json({ document: { json_content: fixture } });
  };
  const f = await setup(transport);
  try {
    const source = input();
    const a = await f.jobs.submit(source);
    assert.equal(a.taskId, "upstream-123");
    assert.equal(
      await readFile(await f.path(source.id + ".input.html"), "utf8"),
      source.html,
    );
    await f.jobs.submit(source);
    assert.equal(posts, 1);
    assert.equal((await f.jobs.refresh(a.id)).state, "success");
    assert.equal((await f.jobs.result(a.id)).schema_name, "DoclingDocument");
    assert.equal(f.jobs.list().length, 1);
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
    const source = input();
    assert.equal((await f.jobs.submit(source)).state, "uncertain");
    assert.equal((await f.jobs.submit(source)).state, "uncertain");
    await f.jobs.refresh(source.id);
    assert.equal(calls, 1);
  } finally {
    await f.close();
  }
});
test("contract: reload after in-flight submission becomes uncertain", async () => {
  const f = await setup(async () =>
    Response.json({ task_id: "upstream-123", task_status: "pending" }),
  );
  try {
    const job = await f.jobs.submit(input());
    f.db
      .prepare(
        "UPDATE docling_operations SET state='submitting',task_id=NULL WHERE id=?",
      )
      .run(job.id);
    const restored = createJobs(f.db, f.path, f.config);
    assert.equal(restored.get(job.id).state, "uncertain");
  } finally {
    await f.close();
  }
});
test("contract: uncertain task can reconcile a known upstream ID", async () => {
  let lost = true;
  const f = await setup(async () => {
    if (lost) throw new Error("lost");
    return Response.json({ task_id: "upstream-456", task_status: "started" });
  });
  try {
    const job = await f.jobs.submit(input());
    lost = false;
    const found = await f.jobs.attach(job.id, "upstream-456");
    assert.equal(found.taskId, "upstream-456");
    assert.equal(found.state, "running");
    assert.equal(f.jobs.pause(job.id).state, "paused");
    assert.equal((await f.jobs.refresh(job.id)).state, "paused");
    assert.equal(f.jobs.resume(job.id).state, "running");
  } finally {
    await f.close();
  }
});
test("contract: failed and redirected submissions, malformed IDs and service changes are guarded", async () => {
  assert.throws(() => configuration({ DOCLING_SERVE_URL: "http://x/path" }));
  assert.throws(() =>
    configuration({ DOCLING_SERVE_URL: "http://user:secret@x" }),
  );
  assert.throws(() =>
    statusValue({ task_id: "../bad", task_status: "pending" }),
  );
  const f = await setup(async () => new Response("", { status: 422 }));
  try {
    const source = input();
    assert.equal((await f.jobs.submit(source)).state, "failure");
    await assert.rejects(() => f.jobs.submit({ ...source, html: "changed" }));
    const other = createJobs(f.db, f.path, {
      base: "http://other:5001",
      key: "",
    });
    await assert.rejects(() => other.refresh(source.id));
  } finally {
    await f.close();
  }
});
test("contract: bounded result and malformed payload keep known task recoverable", async () => {
  const f = await setup(async (url) =>
    String(url).endsWith("/file/async")
      ? Response.json({ task_id: "upstream-123", task_status: "pending" })
      : String(url).includes("/status/")
        ? Response.json({ task_id: "upstream-123", task_status: "success" })
        : Response.json({ document: { json_content: { bad: true } } }),
  );
  try {
    const j = await f.jobs.submit(input());
    const next = await f.jobs.refresh(j.id);
    assert.equal(next.state, "paused");
    assert.ok(next.message.includes("DoclingDocument"));
    assert.equal(next.taskId, "upstream-123");
  } finally {
    await f.close();
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
    const j = await f.jobs.submit(input());
    const flight = f.jobs.refresh(j.id);
    f.jobs.pause(j.id);
    release();
    assert.equal((await flight).state, "paused");
    assert.equal(f.jobs.get(j.id).state, "paused");
  } finally {
    await f.close();
  }
});
test("contract: oversized response stops tracking with durable task ID", async () => {
  const f = await setup(async (url) =>
    String(url).includes("/status/")
      ? new Response("x".repeat(1000001))
      : Response.json({ task_id: "upstream-123", task_status: "pending" }),
  );
  try {
    const j = await f.jobs.submit(input());
    const next = await f.jobs.refresh(j.id);
    assert.equal(next.state, "paused");
    assert.ok(next.message.includes("1 MB"));
    assert.equal(next.taskId, "upstream-123");
  } finally {
    await f.close();
  }
});
