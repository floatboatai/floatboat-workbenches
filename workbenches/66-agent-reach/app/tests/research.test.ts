import assert from "node:assert/strict";
import { test } from "node:test";
import { DatabaseSync } from "node:sqlite";
import { readFileSync, mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  envelopeValue,
  captureValue,
  mergeCapture,
  projectValue,
  restoreDraftData,
  sourceItem,
  report,
  seed,
} from "../src/contracts/research.ts";
import { createStore } from "../src/server/store.ts";
const env = {
  schema_version: 1 as const,
  ok: true,
  channel: "github",
  action: "read",
  backend: "fixture",
  items: [
    {
      title: "示例来源",
      url: "https://example.com/article",
      author: null,
      published_at: null,
      text: "A source with verifiable evidence.",
      raw: { custom: { a: 1 } },
    },
  ],
  meta: { elapsed_ms: 3, attempts: [], extra: "preserved" },
  error: null,
};
const capture = captureValue({
  id: "00000000-0000-4000-8000-000000000001",
  input: seed.input,
  at: "2026-10-28T04:00:00Z",
  envelope: env,
});
test("native envelope preserves metadata and raw source fields", () =>
  assert.deepEqual(JSON.parse(JSON.stringify(envelopeValue(env))), env));
test("failed envelopes never admit usable source items or silently report success", () => {
  assert.throws(() =>
    envelopeValue({
      ...env,
      ok: false,
      error: { code: "BAD_INPUT", message: "bad" },
    }),
  );
  assert.throws(() =>
    envelopeValue({ ...env, error: { code: "BAD_INPUT", message: "bad" } }),
  );
});
test("source URLs reject active schemes and embedded credentials", () => {
  for (const url of [
    "javascript:alert(1)",
    "https://user:password@example.com",
  ])
    assert.throws(() =>
      envelopeValue({ ...env, items: [{ ...env.items[0], url }] }),
    );
});
test("URL dedup preserves existing evidence and does not repeat a capture", () => {
  const first = mergeCapture(seed, capture, [0]);
  first.data.sources[0].note = "已有的审阅";
  const second = mergeCapture(first.data, capture, [0]);
  assert.equal(second.added, 0);
  assert.equal(second.skipped, 1);
  assert.equal(second.data.sources[0].note, "已有的审阅");
  assert.equal(second.data.captures.length, 1);
});
test("tracking parameters and fragments do not duplicate the same source", () => {
  const first = mergeCapture(seed, capture, [0]).data;
  const other = captureValue({
    ...capture,
    id: "00000000-0000-4000-8000-000000000002",
    envelope: {
      ...env,
      items: [
        {
          ...env.items[0],
          url: "https://example.com/article?utm_source=x#part",
        },
      ],
    },
  });
  assert.equal(mergeCapture(first, other, [0]).added, 0);
});
test("clippings must be exact text from the referenced source and retain their notes", () => {
  const data = mergeCapture(seed, capture, [0]).data;
  data.sources[0].clips = [
    {
      id: "00000000-0000-4000-8000-000000000003",
      text: "verifiable evidence",
      note: "支持观察",
    },
  ];
  assert.equal(projectValue(data).sources[0].clips[0].note, "支持观察");
  data.sources[0].clips[0].text = "invented evidence";
  assert.throws(() => projectValue(data));
});
test("missing capture references and invalid source indices reject whole imports", () => {
  const data = mergeCapture(seed, capture, [0]).data;
  assert.throws(() => projectValue({ ...data, captures: [] }));
  assert.throws(() =>
    projectValue({ ...data, sources: [{ ...data.sources[0], index: 9 }] }),
  );
});
test("complete collection persists across SQLite close/reopen", () => {
  const dir = mkdtempSync(join(tmpdir(), "reach-")),
    path = join(dir, "data.sqlite");
  let db = new DatabaseSync(path);
  try {
    db.exec(
      readFileSync(
        new URL("../migrations/0002_projects.sql", import.meta.url),
        "utf8",
      ),
    );
    const data = mergeCapture(seed, capture, [0]).data;
    data.brief = "未完成的小结";
    const saved = createStore(db, projectValue).create("调研", data);
    db.close();
    db = new DatabaseSync(path);
    assert.deepEqual(createStore(db, projectValue).get(saved.id).data, data);
  } finally {
    db.close();
    rmSync(dir, { recursive: true, force: true });
  }
});
test("report keeps source links, review state and attributed quotations", () => {
  const data = mergeCapture(seed, capture, [0]).data;
  data.sources[0].status = "verified";
  data.sources[0].clips = [
    {
      id: "00000000-0000-4000-8000-000000000003",
      text: "verifiable evidence",
      note: "核对过原文",
    },
  ];
  const md = report(data, "调研");
  assert.match(md, /https:\/\/example.com\/article/);
  assert.match(md, /> verifiable evidence/);
  assert.match(md, /已核对/);
});
test("native source size limits count UTF-8 bytes", () =>
  assert.throws(() =>
    envelopeValue({
      ...env,
      items: [{ ...env.items[0], text: "测".repeat(150000) }],
      meta: { large: "测".repeat(30000) },
    }),
  ));
