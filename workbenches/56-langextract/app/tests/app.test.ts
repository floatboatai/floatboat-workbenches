import assert from "node:assert/strict";
import { test } from "node:test";
import { DatabaseSync } from "node:sqlite";
import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import {
  seed,
  validateProject,
  parseImport,
  importedDocuments,
  evidenceSpan,
  rawJsonl,
  reviewCsv,
  runInput,
  examples,
} from "../src/contracts/evidence.ts";
import { jobStore, serviceConfig, serviceResult } from "../src/server/jobs.ts";
import { createAutosaveStore } from "../src/server/autosave.ts";
const clone = () => structuredClone(seed);
const input = () =>
  runInput({
    documents: seed.documents.map((d) => ({ id: d.id, text: d.text })),
    fields: seed.fields,
    prompt: seed.prompt,
    examples: seed.examples,
  });
function database() {
  const db = new DatabaseSync(":memory:");
  for (const name of [
    "0002_projects.sql",
    "0003_autosave.sql",
    "0004_langextract_jobs.sql",
  ])
    db.exec(
      readFileSync(new URL("../migrations/" + name, import.meta.url), "utf8"),
    );
  return db;
}
test("LangExtract codepoint spans highlight the intended Chinese text after emoji", () => {
  const d = seed.documents[0];
  for (const e of d.extractions.slice(0, 5))
    assert.equal(evidenceSpan(d, e)?.quote, e.extraction_text);
  const e = d.extractions[0];
  assert.notEqual(
    d.text.indexOf(e.extraction_text),
    e.char_interval?.start_pos,
  );
  assert.equal(evidenceSpan(d, d.extractions[5]), null);
});
test("JSONL roundtrip preserves upstream records and multiple documents", () => {
  const second = {
    document_id: "second",
    text: "甲乙",
    extractions: [
      {
        extraction_class: "name",
        extraction_text: "乙",
        char_interval: { start_pos: 1, end_pos: 2 },
        attributes: { tags: ["A", "B"] },
      },
    ],
  };
  const p = parseImport(rawJsonl(seed) + JSON.stringify(second));
  assert.equal(p.documents.length, 2);
  assert.equal(p.documents[1].reviews[0].status, "pending");
  assert.deepEqual(parseImport(rawJsonl(p)).documents, p.documents);
});
test("Missing and out-of-range positions stay unresolved, invalid negative intervals fail", () => {
  const d = clone().documents[0];
  const e = {
    ...d.extractions[0],
    char_interval: { start_pos: 0, end_pos: 999999 },
  };
  assert.equal(evidenceSpan(d, e), null);
  assert.equal(
    evidenceSpan(d, {
      ...e,
      char_interval: { start_pos: null, end_pos: null },
    }),
    null,
  );
  assert.throws(() =>
    importedDocuments([
      {
        document_id: "x",
        text: "abc",
        extractions: [{ ...e, char_interval: { start_pos: -1, end_pos: 1 } }],
      },
    ]),
  );
});
test("Editing source invalidates old evidence without dropping review history or original JSONL", () => {
  const p = clone();
  p.documents[0].reviews[0] = {
    status: "corrected",
    correctedText: "林晓（项目经理）",
    note: "已核对",
  };
  const original = rawJsonl(p);
  p.documents[0].text = "已修改 " + p.documents[0].text;
  assert.equal(
    evidenceSpan(p.documents[0], p.documents[0].extractions[0]),
    null,
  );
  assert.equal(rawJsonl(p), original);
  const restored = validateProject(JSON.parse(JSON.stringify(p)));
  assert.equal(restored.documents[0].reviews[0].note, "已核对");
  assert.match(reviewCsv(restored), /原文已变更/);
});
test("Review CSV preserves quotes/newlines and neutralizes spreadsheet formulas", () => {
  const p = clone();
  p.documents[0].reviews[0] = {
    status: "corrected",
    correctedText: '=HYPERLINK("bad")',
    note: 'line1\n"line2"',
  };
  const csv = reviewCsv(p);
  assert.match(csv, /"'=HYPERLINK\(""bad""\)"/);
  assert.match(csv, /line1\n""line2""/);
  assert.match(csv, /corrected/);
  assert.equal(csv.charCodeAt(0), 0xfeff);
});
test("Project and import validation reject duplicate IDs and oversized input but allow empty working text", () => {
  const p = clone();
  p.documents.push(structuredClone(p.documents[0]));
  assert.throws(() => validateProject(p), /唯一/);
  const empty = clone();
  empty.documents[0].text = "";
  assert.equal(validateProject(empty).documents[0].text, "");
  assert.throws(() => parseImport("x".repeat(800001)), /长度/);
  assert.throws(() => parseImport("{broken"), /无法导入/);
  assert.throws(() => examples({}), /数组/);
});
test("Submission validates examples independently from stored editable configuration", () => {
  const p = clone();
  p.examples = [];
  assert.equal(validateProject(p).examples.length, 0);
  assert.throws(() => runInput({ ...input(), examples: [] }), /示例/);
  assert.throws(
    () => runInput({ ...input(), documents: [{ id: "x", text: "" }] }),
    /不能为空/,
  );
});
test("Job identity binds an immutable snapshot and duplicate submit never creates another job", () => {
  const db = database();
  try {
    const jobs = jobStore(db),
      id = randomUUID(),
      data = input();
    assert.equal(jobs.create(id, "project-1", data).created, true);
    assert.equal(jobs.create(id, "project-1", data).created, false);
    assert.throws(
      () => jobs.create(id, "project-1", { ...data, prompt: "changed" }),
      /另一份输入/,
    );
    jobs.update(id, "unknown", "connection lost");
    assert.equal(jobStore(db).get(id).status, "unknown");
    assert.equal(jobStore(db).list().length, 1);
    assert.equal(jobStore(db).create(id, "project-1", data).created, false);
  } finally {
    db.close();
  }
});
test("Job completion retains original result and source provenance", () => {
  const db = database();
  try {
    const jobs = jobStore(db),
      id = randomUUID();
    jobs.create(id, "project-1", input());
    const result = jobs.update(
      id,
      "succeeded",
      "done",
      rawJsonl(seed)
        .trim()
        .split("\n")
        .map((x) => JSON.parse(x)),
    );
    assert.equal(result.status, "succeeded");
    assert.equal(
      parseImport(JSON.stringify(result.result)).documents[0].text,
      seed.documents[0].text,
    );
    assert.equal(jobs.update(id, "running", "late poll").status, "succeeded");
  } finally {
    db.close();
  }
});
test("Service connector rejects insecure remote URLs and response status mismatch", () => {
  assert.equal(serviceConfig({}), null);
  const token = "contract-test-token";
  assert.equal(
    serviceConfig({
      LANGEXTRACT_SERVICE_URL: "http://127.0.0.1:8767",
      LANGEXTRACT_SERVICE_TOKEN: token,
    })?.base.href,
    "http://127.0.0.1:8767/",
  );
  for (const url of [
    "http://example.com",
    "https://user:password@example.com",
    "file:///etc/passwd",
    "https://example.com?token=a",
  ])
    assert.throws(() =>
      serviceConfig({
        LANGEXTRACT_SERVICE_URL: url,
        LANGEXTRACT_SERVICE_TOKEN: token,
      }),
    );
  assert.throws(() => serviceResult({ id: "expected", status: "succeeded" }, "expected"));
  assert.throws(() => serviceResult({ id: "expected", status: "invented" }, "expected"));
});
test("Autosave stores full review and invalid JSON editor draft; same mutation replay is idempotent", async () => {
  const db = database();
  try {
    const store = createAutosaveStore(db, validateProject),
      id = randomUUID();
    const data = clone();
    data.documents[0].reviews[0].note = "证据笔记";
    const mutation = {
      documentId: id,
      mutationId: randomUUID(),
      draftRevision: 0,
      projectId: null,
      projectRevision: null,
      snapshot: {
        title: "review",
        data,
        extra: { examplesEditor: "[{ incomplete" },
      },
    };
    const receipt = await store.commit(mutation);
    assert.equal(receipt.phase, "saved");
    assert.equal(
      receipt.project?.data.documents[0].reviews[0].note,
      "证据笔记",
    );
    assert.equal(store.get(id)?.snapshot.extra.examplesEditor, "[{ incomplete");
    assert.deepEqual(await store.commit(mutation), receipt);
    assert.equal(db.prepare("SELECT COUNT(*) AS n FROM projects").get()?.n, 1);
  } finally {
    db.close();
  }
});
test("Autosave conflict preserves local review draft while leaving newer server model intact", async () => {
  const db = database();
  try {
    const store = createAutosaveStore(db, validateProject),
      id = randomUUID();
    const first = await store.commit({
      documentId: id,
      mutationId: randomUUID(),
      draftRevision: 0,
      projectId: null,
      projectRevision: null,
      snapshot: { title: "original", data: clone(), extra: {} },
    });
    db.prepare(
      "UPDATE projects SET title=?,revision=revision+1 WHERE id=?",
    ).run("server edit", id);
    const receipt = await store.commit({
      documentId: id,
      mutationId: randomUUID(),
      draftRevision: first.draftRevision,
      projectId: id,
      projectRevision: 1,
      snapshot: {
        title: "local draft",
        data: clone(),
        extra: { importText: "{unfinished" },
      },
    });
    assert.equal(receipt.phase, "conflict");
    assert.equal(
      db.prepare("SELECT title FROM projects WHERE id=?").get(id)?.title,
      "server edit",
    );
    assert.equal(store.get(id)?.snapshot.extra.importText, "{unfinished");
  } finally {
    db.close();
  }
});

test("Late polling cannot resurrect cancelled work and mismatched source results are rejected", () => {
  const db = database();
  try {
    const jobs = jobStore(db),
      id = randomUUID();
    jobs.create(id, "p1", input());
    assert.throws(
      () =>
        jobs.update(id, "succeeded", "bad", [
          { document_id: "other", text: "wrong source", extractions: [] },
        ]),
      /不一致/,
    );
    assert.equal(jobs.get(id).status, "submitting");
    jobs.update(id, "cancelled", "stopped");
    assert.equal(jobs.update(id, "running", "late poll").status, "cancelled");
    assert.equal(jobs.get(id).result, null);
  } finally {
    db.close();
  }
});

test("Service reply must match the requested job identity", () => {
  assert.throws(() => serviceResult({ id: "different", status: "running" }, "expected"));
  assert.equal(serviceResult({ id: "expected", status: "running" }, "expected").status, "running");
});
