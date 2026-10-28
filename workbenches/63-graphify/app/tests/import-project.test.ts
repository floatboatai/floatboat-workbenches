import assert from "node:assert/strict";
import { test } from "node:test";
import { seed } from "../src/contracts/graph.ts";
import { decodeProjectImport } from "../src/contracts/import-project.ts";
test("cache snapshot restores the latest complete work, including an unfinished title", () => {
  const extra = { graphJson: "{ unfinished", custom: { text: "keep" } };
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
  for (const [key, value] of Object.entries({})) {
    assert.equal(Object.hasOwn(imported.extra, key), false);
    assert.deepEqual(history[0][key], value);
  }
  for (const [key, value] of Object.entries(extra)) {
    if (!Object.hasOwn({}, key)) assert.deepEqual(imported.extra[key], value);
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
import { projectValue, restoreDraftData } from "../src/contracts/graph.ts";
test("working-copy restore preserves editable notes above the formal model budget", () => {
  const nodes = Array.from({ length: 200 }, (_, i) => ({
    id: "n" + i,
    label: "Node " + i,
  }));
  const data = {
    ...seed,
    graph: { directed: true, nodes, links: [] },
    notes: Object.fromEntries(nodes.map((n) => [n.id, "x".repeat(3000)])),
    positions: {},
    selected: "n0",
    from: "",
    to: "",
  };
  assert.throws(() => projectValue(data));
  assert.deepEqual(restoreDraftData(data), data);
  assert.deepEqual(
    decodeProjectImport({
      snapshot: { title: "large", data, extra: { graphJson: "{" } },
    })!.data,
    data,
  );
});
