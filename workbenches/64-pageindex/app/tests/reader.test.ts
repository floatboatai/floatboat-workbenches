import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { randomUUID } from "node:crypto";
import type { WorkbenchServer } from "../sdk/runtime.mjs";
import {
  indexValue,
  readerValue,
  seed,
  flatten,
  parseJson,
  answerValue,
  validateCitations,
} from "../src/contracts/reader.ts";
import { createQuestions } from "../src/server/questions.ts";
import { createStore } from "../src/server/store.ts";
const native = JSON.parse(
  readFileSync("app/tests/fixtures/native-index.json", "utf8"),
);
const doc = indexValue({
  source: {
    id: native.sha256,
    name: "Handbook.pdf",
    bytes: readFileSync("app/samples/handbook.pdf").length,
    pages: native.pages.length,
  },
  engineVersion: native.version,
  index: native.index,
  pages: native.pages,
});
test("real PageIndex Flash structure retains native node IDs, overlapping ranges and original page order", () => {
  assert.equal(doc.engineVersion, "0.2.10");
  assert.equal(
    doc.index.has_abstract_or_references_section,
    native.index.has_abstract_or_references_section,
  );
  assert.equal(doc.source.pages, 3);
  assert.equal(flatten(doc.index.structure)[2].title, "Closing handover");
  assert.equal(flatten(doc.index.structure)[2].start_index, 3);
  assert.match(doc.pages[2].text, /inspection photographs/);
  assert.deepEqual(indexValue(JSON.parse(JSON.stringify(doc))), doc);
});
test("malformed trees reject duplicate IDs, reversed ranges, missing pages and excess depth", () => {
  const n = doc.index.structure[0];
  for (const bad of [
    { ...doc, pages: [] },
    { ...doc, index: { ...doc.index, structure: [n, n] } },
    {
      ...doc,
      index: {
        ...doc.index,
        structure: [{ ...n, start_index: 3, end_index: 1 }],
      },
    },
  ])
    assert.throws(() => indexValue(bad));
  let node = { ...n };
  for (let i = 0; i < 14; i++)
    node = { ...n, node_id: "deep" + i, nodes: [node] };
  assert.throws(() =>
    indexValue({ ...doc, index: { ...doc.index, structure: [node] } }),
  );
});
test("unfinished question and note fields round-trip, and source/capacity boundaries remain explicit", () => {
  const data = {
    ...seed,
    document: doc.source,
    page: 3,
    question: "待补完的问题",
    notes: [{ id: randomUUID(), page: 3, quote: "", text: "" }],
  };
  assert.deepEqual(readerValue(data), data);
  assert.throws(() => readerValue({ ...data, page: 4 }));
  assert.throws(() =>
    readerValue({ ...data, notes: Array(201).fill(data.notes[0]) }),
  );
  assert.throws(() =>
    readerValue({ ...data, notes: [data.notes[0], data.notes[0]] }),
  );
});
test("model fences are accepted while extra prose, truncation and token-limited JSON are rejected", () => {
  assert.deepEqual(parseJson('```json\n{"node_ids":["0002"]}\n```', "STOP"), {
    node_ids: ["0002"],
  });
  assert.deepEqual(parseJson('```json\n{"node_ids":["0019"]}\n', "STOP"), {
    node_ids: ["0019"],
  });
  for (const s of ['prefix {"node_ids":[]}', '```json\n{"node_ids":[', "{} trailing", "```json\n{} trailing\n```"])
    assert.throws(() => parseJson(s, "STOP"));
  assert.throws(() => parseJson("{}", "MAX_TOKENS"));
});
test("citations must be verbatim original-page evidence within retrieved pages", () => {
  const answer = answerValue({
    id: randomUUID(),
    question: "What should be attached?",
    answer: "Attach inspection photographs.",
    at: new Date().toISOString(),
    insufficient: false,
    citations: [
      {
        page: 3,
        quote: "Attach the inspection photographs to the handover record.",
      },
    ],
  });
  assert.deepEqual(validateCitations(answer, doc, [3]), answer);
  assert.throws(() => validateCitations(answer, doc, [1]));
  assert.throws(() =>
    validateCitations(
      { ...answer, citations: [{ page: 3, quote: "Invented evidence" }] },
      doc,
      [3],
    ),
  );
  assert.throws(() => answerValue({ ...answer, citations: [] }));
});
function setup(fail = false, selection: unknown = { node_ids: ["0002"] }) {
  const db = new DatabaseSync(":memory:");
  db.exec(readFileSync("app/migrations/0002_projects.sql", "utf8"));
  db.exec(readFileSync("app/migrations/0004_reader.sql", "utf8"));
  const projects = createStore(db, readerValue),
    project = projects.create("Handbook", { ...seed, document: doc.source });
  let calls = 0;
  const work: Promise<unknown>[] = [];
  const app = {
    database: db,
    trackTask: (fn: () => Promise<unknown>) => {
      const p = fn();
      work.push(p);
      return p;
    },
    host: {
      llm: {
        generateText: async (
          _input: unknown,
          options: { requestId?: string },
        ) => {
          assert.match(
            options.requestId ?? "",
            /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
          );
          calls++;
          if (fail) throw new Error("upstream unavailable");
          return {
            finishReason: "STOP",
            text: JSON.stringify(
              calls % 2 === 1
                ? selection
                : {
                    answer: "Attach inspection photographs.",
                    insufficient: false,
                    citations: [
                      {
                        page: 3,
                        quote:
                          "Attach the inspection photographs to the handover record.",
                      },
                    ],
                  },
            ),
          };
        },
      },
    },
  } as unknown as WorkbenchServer;
  return { db, app, project, work, calls: () => calls };
}
test("question operation replay is durable and never calls the model twice for the same request", async () => {
  const x = setup(),
    service = createQuestions(x.app, () => doc),
    input = {
      id: randomUUID(),
      projectId: x.project.id,
      documentId: doc.source.id,
      question: "What should be attached?",
    };
  try {
    service.start(input);
    service.start(input);
    await Promise.all(x.work);
    assert.equal(x.calls(), 2);
    assert.equal(service.get(input.id).status, "completed");
    service.start(input);
    assert.equal(x.calls(), 2);
    assert.throws(() =>
      service.start({ ...input, question: "Different question" }),
    );
    assert.equal(
      createQuestions(x.app, () => doc).get(input.id).result?.citations[0].page,
      3,
    );
  } finally {
    x.db.close();
  }
});
test("unknown or excess chapter IDs are ignored; with no usable chapter the question's own terms pick pages", async () => {
  for (const selection of [{ node_ids: ["nope", "0002", "x", "y", "z"] }, { node_ids: ["missing"] }]) {
    const x = setup(false, selection),
      service = createQuestions(x.app, () => doc),
      input = {
        id: randomUUID(),
        projectId: x.project.id,
        documentId: doc.source.id,
        question: "What should be attached to the handover record?",
      };
    try {
      service.start(input);
      await Promise.all(x.work);
      const run = service.get(input.id);
      assert.equal(run.status, "completed", run.error);
      assert.equal(run.result?.citations[0].page, 3);
    } finally {
      x.db.close();
    }
  }
});
test("failed and interrupted model tasks remain recorded and cannot silently restart", async () => {
  const x = setup(true),
    service = createQuestions(x.app, () => doc),
    input = {
      id: randomUUID(),
      projectId: x.project.id,
      documentId: doc.source.id,
      question: "Question",
    };
  try {
    service.start(input);
    await Promise.all(x.work);
    assert.equal(service.get(input.id).status, "failed");
    service.start(input);
    assert.equal(x.calls(), 1);
    x.db
      .prepare("UPDATE reader_questions SET status='running' WHERE id=?")
      .run(input.id);
    const restored = createQuestions(x.app, () => doc);
    assert.equal(restored.get(input.id).status, "interrupted");
    restored.start(input);
    assert.equal(x.calls(), 1);
  } finally {
    x.db.close();
  }
});
test("source mismatch cannot submit a question against another document", () => {
  const x = setup();
  try {
    assert.throws(() =>
      createQuestions(x.app, () => doc).start({
        id: randomUUID(),
        projectId: x.project.id,
        documentId: "a".repeat(64),
        question: "Question",
      }),
    );
    assert.equal(x.calls(), 0);
  } finally {
    x.db.close();
  }
});
test("optimistic project updates preserve the earlier saved reader data", () => {
  const db = new DatabaseSync(":memory:");
  db.exec(readFileSync("app/migrations/0002_projects.sql", "utf8"));
  try {
    const store = createStore(db, readerValue),
      p = store.create("Reading", seed);
    store.update(
      p.id,
      p.title,
      { ...seed, question: "Saved question" },
      p.revision,
    );
    assert.throws(() =>
      store.update(p.id, p.title, { ...seed, question: "Stale" }, p.revision),
    );
    assert.equal(store.get(p.id).data.question, "Saved question");
  } finally {
    db.close();
  }
});
