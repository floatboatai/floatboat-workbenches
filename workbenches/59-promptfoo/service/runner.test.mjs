import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { createService } from "./server.mjs";
import { sampleSuite } from "../app/src/contracts/evaluation.ts";
test("actual Promptfoo evaluates echo suite once and survives restart", async () => {
  const dir = mkdtempSync(join(tmpdir(), "promptfoo-runner-")),
    databasePath = join(dir, "jobs.db");
  const id = "eval-00000000-0000-4000-8000-000000000001";
  let service = createService({ databasePath });
  try {
    assert.equal(service.submit(id, JSON.parse(sampleSuite)).state, "queued");
    service.submit(id, JSON.parse(sampleSuite));
    await service.drain();
    const job = service.get(id);
    assert.equal(job.state, "completed");
    assert.equal(job.report.results.stats.successes, 3);
    assert.equal(job.report.results.stats.failures, 1);
    assert.equal(job.report.provenance.mode, "echo");
    service.close();
    service = createService({ databasePath });
    assert.equal(service.get(id).state, "completed");
    assert.throws(() =>
      service.submit(id, {
        ...JSON.parse(sampleSuite),
        description: "changed",
      }),
    );
  } finally {
    service.close();
    rmSync(dir, { recursive: true, force: true });
  }
});
test("restart marks unfinished jobs interrupted without replay", () => {
  const dir = mkdtempSync(join(tmpdir(), "promptfoo-recovery-")),
    databasePath = join(dir, "jobs.db");
  let s = createService({ databasePath });
  s.close();
  const db = new DatabaseSync(databasePath);
  db.prepare(
    "INSERT INTO jobs(id,digest,suite,state,created) VALUES(?,?,?,?,?)",
  ).run(
    "eval-00000000-0000-4000-8000-000000000002",
    "x",
    "{}",
    "running",
    new Date().toISOString(),
  );
  db.close();
  s = createService({ databasePath });
  assert.equal(
    s.get("eval-00000000-0000-4000-8000-000000000002").state,
    "interrupted",
  );
  s.close();
  rmSync(dir, { recursive: true, force: true });
});

test("unsafe assertion and provider-reference data never reach the evaluator", () => {
  const service = createService({
    databasePath: ":memory:",
    evaluator: async () => {
      throw new Error("Evaluator must never run");
    },
  });
  try {
    for (const value of [
      "{{ env.PROMPTFOO_REVIEW_SENTINEL }}",
      "file:///fixture",
      "package:fixture",
      "portkey://fixture",
      "langfuse://fixture",
      "helicone://fixture",
    ]) {
      const suite = JSON.parse(sampleSuite);
      suite.tests[0].assert[0].value = value;
      assert.throws(() =>
        service.submit("eval-00000000-0000-4000-8000-000000000006", suite),
      );
    }
    assert.equal(
      service.get("eval-00000000-0000-4000-8000-000000000006"),
      null,
    );
  } finally {
    service.close();
  }
});
