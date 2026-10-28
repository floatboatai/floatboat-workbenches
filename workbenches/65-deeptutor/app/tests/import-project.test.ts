import assert from "node:assert/strict";
import { test } from "node:test";
import { seed } from "../src/contracts/tutor.ts";
import { decodeProjectImport } from "../src/contracts/import-project.ts";
test("cache snapshot restores the latest complete work, including an unfinished title", () => {
  const extra = {
    bankText: "[{ unfinished",
    pendingGeneration: { id: "old", lesson: "original" },
    generationId: "old",
    pendingReview: { id: "review" },
    custom: { text: "keep" },
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
    pendingGeneration: { id: "old", lesson: "original" },
    generationId: "old",
    pendingReview: { id: "review" },
  })) {
    assert.equal(Object.hasOwn(imported.extra, key), false);
    assert.deepEqual(history[0][key], value);
  }
  for (const [key, value] of Object.entries(extra)) {
    if (
      !Object.hasOwn(
        {
          pendingGeneration: { id: "old", lesson: "original" },
          generationId: "old",
          pendingReview: { id: "review" },
        },
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
import { projectValue, restoreDraftData } from "../src/contracts/tutor.ts";
test("working-copy restore preserves long unfinished answers beyond the formal model budget", () => {
  const questions = Array.from({ length: 100 }, (_, i) => ({
    ...seed.questions[0],
    question_id: "import:" + i.toString(16).padStart(64, "0"),
  }));
  const data = {
    ...seed,
    questions,
    selected: questions[0].question_id,
    answers: Object.fromEntries(
      questions.map((q) => [q.question_id, "测".repeat(2600)]),
    ),
    checks: {},
    schedules: {},
    events: [],
  };
  assert.throws(() => projectValue(data));
  assert.deepEqual(restoreDraftData(data), data);
  assert.deepEqual(
    decodeProjectImport({
      snapshot: { title: "large", data, extra: { bankText: "[" } },
    })!.data,
    data,
  );
});
