import assert from "node:assert/strict";
import { test, after } from "node:test";
import { mkdtempSync, rmSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { createService, officialSuite } from "./server.mjs";
import { recordingsOf, parseRun } from "../app/src/contracts/results.ts";
import { parseSuite } from "../app/src/contracts/config.ts";
import { evaluateSuite } from "../app/src/server/evaluator.ts";
import { createSandbox } from "../app/src/server/sandbox.ts";

const config = readFileSync(new URL("../app/samples/promptfooconfig.yaml", import.meta.url), "utf8");
const recorded = JSON.parse(readFileSync(new URL("../app/samples/recorded-run.json", import.meta.url), "utf8"));
const recordings = [...recordingsOf(recorded)];
const sandbox = createSandbox();
after(() => sandbox.close());

test("javascript needs explicit opt-in; local-only script columns are skipped", () => {
  assert.throws(() => officialSuite(config, recordings, false), /PROMPTFOO_RUNNER_ALLOW_JS=1/);
  const { testSuite, skipped } = officialSuite(config, recordings, true);
  assert.deepEqual(skipped, ["规则分诊脚本"]);
  assert.equal(testSuite.providers.length, 2);
  assert.equal(testSuite.tests.length, 36);
  assert.throws(() => officialSuite("prompts: [hello]\nproviders: [echo]\ntests:\n  - assert: [{type: llm-rubric, value: helpful}]", [], true), /外部评分断言/);
});

test("real promptfoo 0.125.1 evaluate agrees with the workbench evaluator on every cell", async () => {
  const dir = mkdtempSync(join(tmpdir(), "promptfoo-runner-"));
  const service = createService({ databasePath: join(dir, "jobs.db"), allowJavascript: true });
  try {
    const id = "eval-00000000-0000-4000-8000-000000000001";
    assert.equal(service.submit(id, { config, recordings }).state, "queued");
    service.submit(id, { config, recordings });
    assert.throws(() => service.submit(id, { config: config + "\n#x", recordings }), /Idempotency/);
    await service.drain();
    const job = service.get(id);
    assert.equal(job.state, "completed", job.error);
    assert.deepEqual(job.report.metadata.skippedProviders, ["规则分诊脚本"]);
    const official = parseRun(job.report);
    const local = parseRun(
      await evaluateSuite(parseSuite(config), {}, { sandbox, recordings: new Map(recordings.map(([k, v]) => [k, { ...v, runId: "r" }])), host: null, allowHost: false }),
    );
    assert.equal(official.cells.length, 216);
    for (const c of official.cells) {
      const l = local.byKey.get(c.key);
      assert.ok(l, c.key);
      assert.equal(l.pass, c.pass, c.key);
      assert.ok(Math.abs((l.score ?? 0) - (c.score ?? 0)) < 1e-6, c.key);
      assert.equal(Boolean(l.error), Boolean(c.error), c.key);
      assert.deepEqual(l.components.map((x) => x.pass), c.components.map((x) => x.pass), c.key);
    }
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
  db.prepare("INSERT INTO jobs2(id,digest,payload,state,created) VALUES(?,?,?,?,?)").run(
    "eval-00000000-0000-4000-8000-000000000002",
    "x",
    "{}",
    "running",
    new Date().toISOString(),
  );
  db.close();
  s = createService({ databasePath });
  assert.equal(s.get("eval-00000000-0000-4000-8000-000000000002").state, "interrupted");
  s.close();
  rmSync(dir, { recursive: true, force: true });
});
