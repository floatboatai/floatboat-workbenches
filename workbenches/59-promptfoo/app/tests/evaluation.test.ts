import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import {
  parseEvaluation,
  validateProject,
  restoreProjectDraft,
  validateSuite,
  emptyProject,
  sampleSuite,
  reviewCsv,
} from "../src/contracts/evaluation.ts";
import { createAutosaveStore } from "../src/server/autosave.ts";
import { createRunner } from "../src/server/runner.ts";
const raw = readFileSync(
  new URL("../samples/promptfoo-example.json", import.meta.url),
  "utf8",
);
const sample = JSON.parse(raw);
function database() {
  const db = new DatabaseSync(":memory:");
  db.exec(
    readFileSync(
      new URL("../migrations/0004_evaluation_jobs.sql", import.meta.url),
      "utf8",
    ),
  );
  return db;
}
test("real Promptfoo 0.125.1 summary preserves failed assertions, versions and no-model provider", () => {
  const e = parseEvaluation(raw);
  assert.equal(e.cells.length, 4);
  assert.equal(e.cells.filter((c) => c.pass).length, 3);
  assert.deepEqual(
    e.columns.map((c) => c.label),
    ["Baseline", "Revision"],
  );
  assert.equal(
    e.cells.find((c) => c.test === 0 && c.column === 0)?.output,
    "shipping date",
  );
  assert.match(e.cells.find((c) => !c.pass)?.reason ?? "", /Reviewed/);
  assert.equal(parseEvaluation(JSON.stringify(sample.results)).cells.length, 4);
});
test("reject incomplete, duplicate or unsupported result formats", () => {
  assert.throws(() => parseEvaluation("{"));
  assert.throws(() => parseEvaluation("{}"));
  const j = structuredClone(sample);
  j.results.results.push(j.results.results[0]);
  assert.throws(() => parseEvaluation(JSON.stringify(j)), /重复/);
  j.results.version = 2;
  assert.throws(() => parseEvaluation(JSON.stringify(j)), /v3/);
});
test("portable project preserves reports and review while retaining unparsed suite draft", () => {
  const data = validateProject({
    ...emptyProject,
    suite: "{",
    reports: [{ id: "report-a", name: "result", raw }],
    activeId: "report-a",
    reviews: {
      "report-a:0:0": { decision: "reject", note: "Keep this reasoning" },
    },
  });
  assert.equal(data.suite, "{");
  assert.equal(data.reviews["report-a:0:0"].note, "Keep this reasoning");
  assert.throws(() => validateProject({ ...data, activeId: "missing" }));
  assert.throws(() =>
    validateProject({ ...data, reports: [...data.reports, ...data.reports] }),
  );
});
test("CSV escaping protects formula-like output and preserves quoted review text", () => {
  const altered = structuredClone(sample);
  altered.results.results[0].response.output = "=SUM(A1)";
  const csv = reviewCsv(
    { id: "a", name: "test", raw: JSON.stringify(altered) },
    { "a:0:0": { decision: "reject", note: 'a,"b"\nline' } },
  );
  assert.match(csv, /"'=SUM\(A1\)"/);
  assert.match(csv, /a,""b""\nline/);
});
test("runner suite is bounded and rejects executable templates, file references and custom assertions", () => {
  assert.equal(validateSuite(JSON.parse(sampleSuite)).tests.length, 2);
  for (const mutation of [
    (v: ReturnType<typeof validateSuite>) =>
      (v.prompts[0].raw = "{{ range(9) }}"),
    (v: ReturnType<typeof validateSuite>) =>
      (v.prompts[0].raw = '{% include "file" %}'),
    (v: ReturnType<typeof validateSuite>) =>
      (v.tests[0].vars.input = "file:///etc/passwd"),
    (v: ReturnType<typeof validateSuite>) =>
      (v.tests[0].assert = [{ type: "javascript", value: "process.exit()" }]),
  ]) {
    const s = JSON.parse(sampleSuite);
    mutation(s);
    assert.throws(() => validateSuite(s));
  }
});
test("server persists stable job before side effect and deduplicates successful submission", async () => {
  const db = database();
  let calls = 0;
  const id = "eval-00000000-0000-4000-8000-000000000001";
  const runner = createRunner(
    db,
    "http://127.0.0.1:8770",
    undefined,
    async () => {
      calls++;
      assert.ok(
        db.prepare("SELECT id FROM evaluation_jobs WHERE id=?").get(id),
      );
      return Response.json({ id, state: "queued" });
    },
  );
  await runner.start(id, JSON.parse(sampleSuite));
  await runner.start(id, JSON.parse(sampleSuite));
  assert.equal(calls, 1);
  await assert.rejects(
    runner.start(id, { ...JSON.parse(sampleSuite), description: "different" }),
    /不同输入/,
  );
  db.close();
});
test("lost submit response stays uncertain, poll reconciles the existing task without resubmission", async () => {
  const db = database();
  let calls = 0;
  const id = "eval-00000000-0000-4000-8000-000000000002";
  const runner = createRunner(
    db,
    "http://127.0.0.1:8770",
    undefined,
    async (_url, options) => {
      calls++;
      if (options?.method === "POST") throw new Error("response lost");
      return Response.json({ id, state: "completed", report: sample });
    },
  );
  assert.equal(
    (await runner.start(id, JSON.parse(sampleSuite))).state,
    "uncertain",
  );
  const restored = createRunner(
    db,
    "http://127.0.0.1:8770",
    undefined,
    async () => Response.json({ id, state: "completed", report: sample }),
  );
  assert.equal((await restored.poll(id)).state, "completed");
  assert.equal(calls, 1);
  db.close();
});
test("connector rejects configured remote cleartext endpoints and cross-job results", async () => {
  const db = database();
  assert.throws(() => createRunner(db, "http://example.org"));
  const id = "eval-00000000-0000-4000-8000-000000000003";
  const runner = createRunner(
    db,
    "http://127.0.0.1:8770",
    undefined,
    async () =>
      Response.json({ id: "wrong", state: "completed", report: sample }),
  );
  assert.equal(
    (await runner.start(id, JSON.parse(sampleSuite))).state,
    "uncertain",
  );
  assert.equal(runner.read(id).report, null);
  db.close();
});

test("late submit acknowledgements and failures cannot regress a completed job", async () => {
  for (const fails of [false, true]) {
    const db = database(),
      id = fails
        ? "eval-00000000-0000-4000-8000-000000000005"
        : "eval-00000000-0000-4000-8000-000000000004";
    let accept: ((response: Response) => void) | undefined,
      reject: ((reason: Error) => void) | undefined;
    const runner = createRunner(
      db,
      "http://127.0.0.1:8770",
      undefined,
      async (_url, options) => {
        if (options?.method === "POST")
          return new Promise<Response>((resolve, fail) => {
            accept = resolve;
            reject = fail;
          });
        return Response.json({ id, state: "completed", report: sample });
      },
    );
    const pending = runner.start(id, JSON.parse(sampleSuite));
    assert.equal((await runner.poll(id)).state, "completed");
    if (fails) reject!(new Error("Late connection failure"));
    else accept!(Response.json({ id, state: "queued" }));
    assert.equal((await pending).state, "completed");
    assert.ok(runner.read(id).report);
    db.close();
  }
});

test("data fields reject Promptfoo template expansion and external-reference schemes", () => {
  const badValues = [
    "{{ env.PROMPTFOO_REVIEW_SENTINEL }}",
    "file:///a-test-fixture",
    "package:a-test-package",
    "portkey://a-prompt",
    "langfuse://a-prompt",
    "helicone://a-prompt",
  ];
  for (const value of badValues) {
    const assertion = JSON.parse(sampleSuite);
    assertion.tests[0].assert[0].value = value;
    assert.throws(() => validateSuite(assertion));
    const variable = JSON.parse(sampleSuite);
    variable.tests[0].vars.input = value;
    assert.throws(() => validateSuite(variable));
  }
  for (const raw of [
    "{{env}}",
    "{{missing}}",
    "langfuse://a-prompt",
    "{{input",
    "{{input.__proto__}}",
  ]) {
    const suite = JSON.parse(sampleSuite);
    suite.prompts[0].raw = raw;
    assert.throws(() => validateSuite(suite));
  }
  const reserved = JSON.parse(sampleSuite);
  reserved.tests[0].vars.env = "value";
  assert.throws(() => validateSuite(reserved));
});
test("large valid report sets retain oversized review drafts through server persistence", async () => {
  const make = (padding: number) => ({
    ...emptyProject,
    reports: [0, 1].map((n) => ({
      id: "report-" + n,
      name: "Large " + n,
      raw: JSON.stringify({ ...sample, padding: "x".repeat(padding) }),
    })),
    activeId: "report-0",
  });
  const blankBytes = Buffer.byteLength(JSON.stringify(make(0)));
  const base = validateProject(make(Math.floor((749000 - blankBytes) / 2)));
  const changed = {
    ...base,
    reviews: {
      "report-0:0:0": { decision: "pending", note: "复".repeat(6000) },
    },
  };
  assert.throws(() => validateProject(changed), /750KB/);
  assert.equal(
    restoreProjectDraft(changed).reviews["report-0:0:0"].note.length,
    6000,
  );
  const db = database();
  db.exec(
    readFileSync(
      new URL("../migrations/0002_projects.sql", import.meta.url),
      "utf8",
    ),
  );
  db.exec(
    readFileSync(
      new URL("../migrations/0003_autosave.sql", import.meta.url),
      "utf8",
    ),
  );
  try {
    const store = createAutosaveStore(db, validateProject),
      documentId = crypto.randomUUID();
    const first = await store.commit({
      documentId,
      mutationId: crypto.randomUUID(),
      draftRevision: 0,
      projectId: null,
      projectRevision: null,
      snapshot: { title: "Large report", data: base, extra: {} },
    });
    const draft = await store.commit({
      documentId,
      mutationId: crypto.randomUUID(),
      draftRevision: first.draftRevision,
      projectId: first.project?.id,
      projectRevision: first.project?.revision,
      snapshot: { title: "Large report", data: changed, extra: { suite: "{" } },
    });
    assert.equal(draft.phase, "draft");
    const recovered = restoreProjectDraft(store.get(documentId)!.snapshot.data);
    assert.equal(recovered.reviews["report-0:0:0"].note.length, 6000);
  } finally {
    db.close();
  }
});
