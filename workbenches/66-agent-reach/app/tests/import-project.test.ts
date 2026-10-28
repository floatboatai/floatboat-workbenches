import assert from "node:assert/strict";
import { test } from "node:test";
import { seed } from "../src/contracts/research.ts";
import { decodeProjectImport } from "../src/contracts/import-project.ts";
test("cache snapshot restores the latest complete work, including an unfinished title", () => {
  const extra = {
    resultJson: "{ unfinished",
    pendingQuery: { id: "old", input: { query: "original" } },
    clipDrafts: { demo: { text: "draft", note: "keep" } },
  };
  const raw = {
    snapshot: { title: "", data: seed, extra },
    current: { title: "older", data: { old: true } },
    pending: {
      documentId: "old-doc",
      projectId: "old-project",
      mutationId: "old-mutation",
    },
  };
  const imported = decodeProjectImport(raw)!;
  assert.equal(imported.title, "");
  assert.deepEqual(imported.data, seed);
  assert.equal(imported.recovered, true);
  const history = imported.extra.importHistory as Array<
    Record<string, unknown>
  >;
  assert.equal(history.length, 1);
  assert.deepEqual(history[0].autosave, {
    documentId: "old-doc",
    projectId: "old-project",
    mutationId: "old-mutation",
  });
  for (const [key, value] of Object.entries({
    pendingQuery: { id: "old", input: { query: "original" } },
  })) {
    assert.equal(Object.hasOwn(imported.extra, key), false);
    assert.deepEqual(history[0][key], value);
  }
  for (const [key, value] of Object.entries(extra)) {
    if (
      !Object.hasOwn(
        { pendingQuery: { id: "old", input: { query: "original" } } },
        key,
      )
    )
      assert.deepEqual(imported.extra[key], value);
  }
});
test("malformed recovery snapshots fail without falling back to an older saved model", () => {
  assert.throws(() =>
    decodeProjectImport({
      snapshot: { title: "x", data: [], extra: {} },
      current: { data: seed },
    }),
  );
  assert.throws(() =>
    decodeProjectImport({ snapshot: { title: "x", data: seed, extra: [] } }),
  );
});
import {
  projectValue,
  restoreDraftData,
  captureValue,
} from "../src/contracts/research.ts";
test("working-copy restore preserves long source notes beyond the formal model budget", () => {
  const capture = captureValue({
    id: "00000000-0000-4000-8000-000000000001",
    input: seed.input,
    at: "2026-10-28T04:00:00Z",
    envelope: {
      schema_version: 1,
      ok: true,
      channel: "web",
      action: "read",
      backend: "fixture",
      items: Array.from({ length: 100 }, (_, i) => ({
        title: String(i),
        url: "https://example.com/" + i,
        author: null,
        published_at: null,
        text: "x".repeat(2000),
        raw: {},
      })),
      meta: {},
      error: null,
    },
  });
  const sources = capture.envelope.items.map((_, i) => ({
    id: "00000000-0000-4000-8000-" + i.toString(16).padStart(12, "0"),
    captureId: capture.id,
    index: i,
    note: "x".repeat(5000),
    status: "unreviewed" as const,
    clips: [],
  }));
  const data = {
    ...seed,
    captures: [capture],
    sources,
    selected: sources[0].id,
  };
  assert.throws(() => projectValue(data));
  assert.deepEqual(restoreDraftData(data), data);
  assert.deepEqual(
    decodeProjectImport({
      snapshot: { title: "large", data, extra: { resultJson: "{" } },
    })!.data,
    data,
  );
});
