import assert from "node:assert/strict";
import { test } from "node:test";
import { DatabaseSync } from "node:sqlite";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  graphValue,
  projectValue,
  shortestPath,
  seed,
  fromGraph,
} from "../src/contracts/graph.ts";
import { createStore } from "../src/server/store.ts";
test("Graphify native metadata and parallel links survive import/export without narrowing", () => {
  const native = {
    ...seed.graph,
    graph: {
      schema_version: 1,
      graphify_version: "0.9.97",
      custom: { tags: ["a"] },
    },
    hyperedges: [],
    links: [
      ...seed.graph.links,
      { ...seed.graph.links[0], relation: "second" },
    ],
  };
  assert.deepEqual(JSON.parse(JSON.stringify(graphValue(native))), native);
});
test("dangling, duplicate and unsafe node IDs are rejected rather than dropping relations", () => {
  for (const raw of [
    { ...seed.graph, nodes: [seed.graph.nodes[0], seed.graph.nodes[0]] },
    {
      ...seed.graph,
      links: [{ source: "missing", target: seed.graph.nodes[0].id }],
    },
    { nodes: [{ id: "__proto__" }], links: [], directed: true },
  ])
    assert.throws(() => graphValue(raw));
});
test("bounded graph rejects excessive size before rendering", () => {
  assert.throws(() =>
    graphValue({
      ...seed.graph,
      nodes: Array.from({ length: 401 }, (_, i) => ({ id: String(i) })),
    }),
  );
  assert.throws(() =>
    graphValue({ ...seed.graph, metadata: "x".repeat(350001) }),
  );
});
test("shortest path respects directed edges, cycles and disconnected nodes", () => {
  const graph = graphValue({
    nodes: [{ id: "a" }, { id: "b" }, { id: "c" }, { id: "d" }],
    links: [
      { source: "a", target: "b" },
      { source: "b", target: "a" },
      { source: "b", target: "c" },
    ],
    directed: true,
  });
  assert.deepEqual(shortestPath(graph, "a", "c"), ["a", "b", "c"]);
  assert.deepEqual(shortestPath(graph, "c", "a"), []);
  assert.deepEqual(shortestPath({ ...graph, directed: false }, "c", "a"), [
    "c",
    "b",
    "a",
  ]);
  assert.deepEqual(shortestPath(graph, "a", "d"), []);
});
test("native import resets review overlays and does not invent source", () => {
  const p = fromGraph(seed.graph);
  assert.deepEqual(p.notes, {});
  assert.equal(p.source, "");
  assert.deepEqual(projectValue(p).graph, seed.graph);
});
test("complete working inputs, layout and notes persist across database reopen", () => {
  const dir = mkdtempSync(join(tmpdir(), "graphify-test-")),
    path = join(dir, "db.sqlite");
  let db = new DatabaseSync(path);
  try {
    db.exec(
      readFileSync(
        new URL("../migrations/0002_projects.sql", import.meta.url),
        "utf8",
      ),
    );
    const store = createStore(db, projectValue),
      data = {
        ...seed,
        name: "unfinished.",
        source: "def unfinished(",
        notes: { ...seed.notes, catalog: "审阅中的笔记" },
        positions: { catalog: { x: 80, y: 90 } },
      };
    const created = store.create("测试地图", data);
    db.close();
    db = new DatabaseSync(path);
    assert.deepEqual(createStore(db, projectValue).get(created.id).data, data);
  } finally {
    db.close();
    rmSync(dir, { recursive: true, force: true });
  }
});
test("stale revisions cannot overwrite newer notes", () => {
  const db = new DatabaseSync(":memory:");
  try {
    db.exec(
      readFileSync(
        new URL("../migrations/0002_projects.sql", import.meta.url),
        "utf8",
      ),
    );
    const store = createStore(db, projectValue),
      p = store.create("关系地图", seed);
    const next = { ...seed, notes: { catalog: "第一窗口" } };
    store.update(p.id, p.title, next, p.revision);
    assert.throws(() => store.update(p.id, p.title, seed, p.revision));
    assert.equal(store.get(p.id).data.notes.catalog, "第一窗口");
  } finally {
    db.close();
  }
});
test("invalid and out-of-bounds coordinates reject the whole project", () => {
  assert.throws(() =>
    projectValue({ ...seed, positions: { catalog: { x: Infinity, y: 60 } } }),
  );
  assert.throws(() => projectValue({ ...seed, notes: { missing: "note" } }));
});

test("UTF-8 graph byte limits apply equally to multibyte metadata", () => {
 assert.throws(() => graphValue({...seed.graph,metadata:"测".repeat(120000)}));
});
