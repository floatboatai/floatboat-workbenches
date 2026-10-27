import assert from "node:assert/strict";
import { test } from "node:test";
import { allowNewSubmission } from "../src/ui/submission-guard.ts";
import {
  localOperation,
  unresolvedOperation,
  mergeJobs,
  type LocalOperation,
} from "../src/contracts/operation.ts";
import { example, portable, importDeck } from "../src/contracts/deck.ts";
const operation: LocalOperation = {
  id: "persisted-operation",
  projectId: "project-one",
  title: "Contract fixture",
  kind: "generate",
  createdAt: "2026-10-27T12:00:00.000Z",
};
test("lost POST and failed list/detail: persisted operation guards the next submission after restore", async () => {
  const restored = importDeck(
    portable("Deck", example, {
      lastOperation: operation.id,
      pendingOperation: operation,
    }),
  );
  const local = localOperation(restored.extra.pendingOperation);
  let confirmations = 0,
    newIds = 0;
  const queried: string[] = [];
  if (
    await allowNewSubmission({
      operation: local,
      jobs: [],
      projectId: operation.projectId,
      query: async (id) => {
        queried.push(id);
        throw new Error("history unavailable");
      },
      confirm: (message) => {
        confirmations++;
        assert.match(message, /persisted-operation/);
        return false;
      },
    })
  )
    newIds++;
  assert.deepEqual(queried, [operation.id]);
  assert.equal(confirmations, 1);
  assert.equal(newIds, 0);
});
test("missing operation (404) is still unknown; explicit confirmation can intentionally create a new task", async () => {
  let prompts = 0;
  assert.equal(
    await allowNewSubmission({
      operation,
      jobs: [],
      projectId: operation.projectId,
      query: async () => {
        throw Object.assign(new Error("missing"), { status: 404 });
      },
      confirm: () => {
        prompts++;
        return true;
      },
    }),
    true,
  );
  assert.equal(prompts, 1);
});
test("exact ID reconciliation permits a completed task without an unnecessary new-task warning", async () => {
  const completed = {
    ...unresolvedOperation(operation),
    state: "completed" as const,
  };
  let queries = 0;
  assert.equal(
    await allowNewSubmission({
      operation,
      jobs: [],
      projectId: operation.projectId,
      query: async () => {
        queries++;
        return completed;
      },
      confirm: () => {
        throw new Error("unexpected prompt");
      },
    }),
    true,
  );
  assert.equal(queries, 1);
});
test("pending and stopped tasks still need explicit confirmation", async () => {
  for (const state of ["pending", "stopped"] as const) {
    const job = { ...unresolvedOperation(operation), state };
    assert.equal(
      await allowNewSubmission({
        operation,
        jobs: [job],
        projectId: operation.projectId,
        query: async () => job,
        confirm: () => false,
      }),
      false,
    );
  }
});
test("empty or unrelated list results cannot erase the locally persisted submission", () => {
  const placeholder = unresolvedOperation(operation);
  assert.deepEqual(mergeJobs([placeholder], []), [placeholder]);
  const completed = { ...placeholder, state: "completed" as const };
  assert.deepEqual(mergeJobs([placeholder], [completed]), [completed]);
});
test("portable and full recovery files preserve unfinished import JSON and submission metadata", () => {
  const extra = {
    importText: '{"unfinished":\n',
    pendingOperation: operation,
    lastOperation: operation.id,
  };
  for (const text of [
    portable("Deck", example, extra),
    JSON.stringify({ snapshot: { title: "Deck", data: example, extra } }),
  ])
    assert.deepEqual(importDeck(text).extra, extra);
});
