import assert from "node:assert/strict";
import { test } from "node:test";
import { DatabaseSync } from "node:sqlite";
import { readFileSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { seed } from "../src/contracts/samples.ts";
import {
  blankReview,
  MODEL_BYTES,
  validateProject,
  restoreProjectDraft,
  restoreWorkingCopy,
  serializeWorkingCopy,
  parseWorkingImport,
  jsonBytes,
  DRAFT_DATA_BYTES,
  DRAFT_EXTRA_BYTES,
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
function database(path = ":memory:") {
  const db = new DatabaseSync(path);
  for (const name of [
    "0002_projects.sql",
    "0003_autosave.sql",
    "0004_langextract_jobs.sql",
    "0005_host_runs.sql",
  ])
    db.exec(
      readFileSync(new URL("../migrations/" + name, import.meta.url), "utf8"),
    );
  return db;
}
test("LangExtract codepoint spans highlight the intended Chinese text after emoji", () => {
  const d = seed.documents[0];
  const grounded = d.extractions.filter((e) => e.char_interval);
  assert.ok(grounded.length >= 14);
  for (const e of grounded)
    if (e.alignment_status === "match_exact")
      assert.equal(evidenceSpan(d, e)?.quote, e.extraction_text);
  const e = d.extractions[2];
  assert.equal(e.extraction_text, "林晓");
  // 🌿 is one Python codepoint but two UTF-16 units before this record.
  assert.equal(d.text.indexOf(e.extraction_text), e.char_interval!.start_pos! + 1);
  const unaligned = d.extractions.find((x) => !x.char_interval)!;
  assert.equal(evidenceSpan(d, unaligned), null);
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
  assert.equal(p.documents.length, seed.documents.length + 1);
  assert.equal(p.documents.at(-1)!.reviews[0].status, "pending");
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
    ...blankReview(),
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
    ...blankReview(),
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
  assert.throws(() => parseImport("x".repeat(MODEL_BYTES + 1)), /长度/);
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
  assert.throws(() =>
    serviceResult({ id: "expected", status: "succeeded" }, "expected"),
  );
  assert.throws(() =>
    serviceResult({ id: "expected", status: "invented" }, "expected"),
  );
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
  assert.throws(() =>
    serviceResult({ id: "different", status: "running" }, "expected"),
  );
  assert.equal(
    serviceResult({ id: "expected", status: "running" }, "expected").status,
    "running",
  );
});

function sizedProject(targetBytes: number) {
  const project = validateProject(clone());
  const doc = project.documents[0];
  doc.extractions = Array.from({ length: 300 }, (_, i) => ({
    ...structuredClone(doc.extractions[0]),
    extraction_index: i,
    attributes: {},
  }));
  project.documents = [doc];
  doc.reviews = doc.extractions.map(() => blankReview());
  for (let i = doc.extractions.length - 1; i >= 0; i--) {
    for (let j = 0; j < 10; j++) {
      if (jsonBytes(project) >= targetBytes) return project;
      const attrs = doc.extractions[i].attributes!;
      attrs["padding" + j] = "";
      const left = targetBytes - jsonBytes(project);
      if (left < 0) {
        delete attrs["padding" + j];
        return project;
      }
      attrs["padding" + j] = "x".repeat(Math.min(left, 2000));
    }
  }
  throw Error("Fixture could not reach requested size");
}

test("A near-limit model saves larger review work as SQLite draft and restores after database reopen", async () => {
  const directory = mkdtempSync(join(tmpdir(), "langextract-draft-")),
    path = join(directory, "data.sqlite");
  let db = database(path);
  try {
    const store = createAutosaveStore(db, validateProject),
      id = randomUUID();
    const model = validateProject(sizedProject(MODEL_BYTES - 1000));
    const first = await store.commit({
      documentId: id,
      mutationId: randomUUID(),
      draftRevision: 0,
      projectId: null,
      projectRevision: null,
      snapshot: { title: "近限项目", data: model, extra: {} },
    });
    assert.equal(first.phase, "saved");
    const data = structuredClone(model);
    data.documents[0].reviews[0].note = "中".repeat(1000);
    const snapshot = restoreWorkingCopy({
      title: "容量工作稿",
      data,
      extra: {
        examplesEditor: "[{ incomplete 中文",
        importText: "{ unfinished",
      },
    });
    assert.throws(() => validateProject(snapshot.data), /880KB/);
    const request = {
      documentId: id,
      mutationId: randomUUID(),
      draftRevision: first.draftRevision,
      projectId: id,
      projectRevision: first.project!.revision,
      snapshot,
    };
    assert.ok(jsonBytes(request) < 1950000);
    const draft = await store.commit(request);
    assert.equal(draft.phase, "draft");
    assert.equal(
      JSON.parse(
        String(
          db.prepare("SELECT payload FROM projects WHERE id=?").get(id)!
            .payload,
        ),
      ).documents[0].reviews[0].note,
      "",
    );
    db.close();
    db = new DatabaseSync(path);
    const reopened = createAutosaveStore(db, validateProject).get(id)!;
    const restored = restoreWorkingCopy(reopened.snapshot);
    assert.equal(reopened.receipt.phase, "draft");
    assert.equal(restored.data.documents[0].reviews[0].note, "中".repeat(1000));
    assert.equal(restored.extra.examplesEditor, "[{ incomplete 中文");
    assert.equal(restored.extra.importText, "{ unfinished");
  } finally {
    db.close();
    rmSync(directory, { recursive: true, force: true });
  }
});

test("Working draft limits preserve structure and account for serialized extra and wire overhead", () => {
  const data = sizedProject(DRAFT_DATA_BYTES - 2000);
  assert.equal(jsonBytes(restoreProjectDraft(data)), jsonBytes(data));
  const extra = { examplesEditor: "中".repeat(140000), importText: "pending" };
  const copy = restoreWorkingCopy({ title: "草稿", data, extra });
  assert.ok(jsonBytes(copy.extra) < DRAFT_EXTRA_BYTES);
  assert.ok(
    jsonBytes({
      documentId: randomUUID(),
      mutationId: randomUUID(),
      draftRevision: 100,
      projectId: randomUUID(),
      projectRevision: 100,
      snapshot: copy,
    }) < 1950000,
  );
  const tooLarge = structuredClone(data);
  tooLarge.documents[0].reviews[0].note = "中".repeat(1000);
  assert.throws(() => restoreProjectDraft(tooLarge), /1.35MB/);
  assert.throws(
    () =>
      restoreWorkingCopy({
        ...copy,
        extra: { ...extra, importText: "x".repeat(40000) },
      }),
    /450KB/,
  );
  assert.throws(
    () =>
      restoreWorkingCopy({
        ...copy,
        extra: { examplesEditor: { invalid: true } },
      }),
    /文本/,
  );
  assert.throws(
    () =>
      restoreProjectDraft({
        ...data,
        documents: [{ ...data.documents[0], reviews: [] }],
      }),
    /不匹配/,
  );
});

test("Portable working copies roundtrip oversized review drafts and unfinished editors without relaxing core JSONL", () => {
  const data = sizedProject(MODEL_BYTES + 100000);
  const copy = restoreWorkingCopy({
    title: "可恢复资料",
    data,
    extra: { examplesEditor: "[{ not finished", importText: "{draft" },
  });
  assert.deepEqual(parseWorkingImport(serializeWorkingCopy(copy)), copy);
  const oldRecovery = JSON.stringify({
    documentId: randomUUID(),
    mutationId: randomUUID(),
    snapshot: copy,
    current: null,
    pending: { ignored: true },
  });
  assert.deepEqual(parseWorkingImport(oldRecovery), copy);
  assert.deepEqual(
    parseWorkingImport(JSON.stringify(data), "旧项目").data,
    data,
  );
  assert.throws(() => parseImport(JSON.stringify(data)), /长度|880KB/);
  assert.throws(() => parseWorkingImport(rawJsonl(data)), /长度|880KB/);
  assert.throws(
    () =>
      parseWorkingImport(
        JSON.stringify({
          format: "langextract-working-copy",
          version: 2,
          snapshot: copy,
        }),
      ),
    /版本/,
  );
});
