import assert from "node:assert/strict";
import { test } from "node:test";
import { projectValue, restoreDraftData, emptyProject, refFor, isLegacyProject, EMPTY_REF } from "../src/contracts/map.ts";
import { decodeProjectImport, PROJECT_FORMAT } from "../src/contracts/import-project.ts";
import { sample } from "../src/contracts/sample/index.ts";
import { sha256 } from "../src/contracts/hash.ts";

const legacyGraph = {
  directed: true, multigraph: false, graph: { graphify_version: "0.9.97" },
  nodes: [{ id: "catalog", label: "catalog.py", source_file: "catalog.py", source_location: "L1" }, { id: "catalog_serve", label: "serve()" }],
  links: [{ source: "catalog", target: "catalog_serve", relation: "contains" }], hyperedges: [],
};
const legacy = { name: "catalog.py", source: "def serve():\n    pass\n", graph: legacyGraph, notes: { catalog_serve: "入口" }, positions: { catalog: { x: 100, y: 200 } }, selected: "catalog_serve", from: "", to: "" };

test("working object validation: v2 accepted, legacy and malformed rejected, notes for vanished nodes kept", () => {
  const p = sample().project;
  assert.deepEqual(projectValue(JSON.parse(JSON.stringify(p))), p);
  assert.ok(isLegacyProject(legacy));
  assert.throws(() => projectValue(legacy), /旧版本/);
  assert.throws(() => projectValue({ ...p, graph: { ...p.graph, hash: "x" } }));
  assert.throws(() => projectValue({ ...p, pins: { a: { x: Infinity, y: 0 } } }));
  assert.throws(() => projectValue({ ...p, corpus: [p.corpus[0], p.corpus[0]] }), /重复/);
  const orphan = projectValue({ ...emptyProject(), notes: { gone: "旧节点的笔记" } });
  assert.equal(orphan.notes.gone, "旧节点的笔记");
  assert.equal(restoreDraftData(emptyProject()).graph.hash, EMPTY_REF.hash);
});

test("complete project import verifies embedded sources and graph against the working copy", () => {
  const { project, graph, texts } = sample();
  const sources = Object.fromEntries(texts);
  const file = { format: PROJECT_FORMAT, version: 2, title: "补货", data: project, extra: { pasteText: "未完成" }, graph, sources };
  const imported = decodeProjectImport(JSON.parse(JSON.stringify(file)));
  assert.equal(imported.kind, "project");
  assert.equal(imported.sources.size, texts.size);
  assert.equal(imported.extra.pasteText, "未完成");
  const [h] = Object.keys(sources);
  assert.throws(() => decodeProjectImport({ ...file, sources: { [h]: "被改过" } }), /不一致/);
  assert.throws(() => decodeProjectImport({ ...file, graph: { ...graph, nodes: graph.nodes.slice(1), links: [] } }), /不一致/);
});

test("recovery files, 0.5 projects and native graph.json each import as a new map", () => {
  const { project } = sample();
  const recovery = decodeProjectImport({ snapshot: { title: "恢复", data: project, extra: { graphJson: "{bad" } }, pending: { documentId: "d", projectId: null, mutationId: "m" } });
  assert.equal(recovery.kind, "recovery");
  assert.equal(recovery.extra.graphJson, "{bad");
  assert.ok(Array.isArray(recovery.extra.importHistory));
  const old = decodeProjectImport({ format: PROJECT_FORMAT, version: 1, title: "目录服务", data: legacy, extra: { graphJson: "x", extracted: {} } });
  assert.equal(old.kind, "legacy");
  assert.equal(old.data.corpus[0].path, "catalog.py");
  assert.equal(old.sources.get(sha256(legacy.source)), legacy.source);
  assert.equal(old.data.graph.hash, refFor(old.graph!).hash);
  assert.deepEqual(old.data.pins, { catalog: { x: 100, y: 200 } });
  assert.equal(old.data.notes.catalog_serve, "入口");
  assert.equal(old.extra.graphJson, undefined);
  const native = decodeProjectImport(legacyGraph, "graph");
  assert.equal(native.kind, "graph");
  assert.equal(native.data.selected, "catalog");
});
