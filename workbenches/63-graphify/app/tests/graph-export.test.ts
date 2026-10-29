import assert from "node:assert/strict";
import { test } from "node:test";
import { graphValue, shortestPath, lineOf } from "../src/contracts/graph.ts";
import { summarizeCommunities } from "../src/contracts/analysis.ts";
import { exportGraphJson, exportGraphML, exportHtmlReport, exportMarkdownReport } from "../src/contracts/exporters.ts";
import { sample } from "../src/contracts/sample/index.ts";

test("native metadata, parallel links, numeric ids and `edges` alias survive validation", () => {
  const native = {
    directed: true, multigraph: true, graph: { custom: { tags: ["a"] } }, hyperedges: [{ id: "h" }],
    nodes: [{ id: "a", extra: { deep: 1 } }, { id: "b" }],
    links: [{ source: "a", target: "b", relation: "calls" }, { source: "a", target: "b", relation: "calls", key: 1 }],
  };
  assert.deepEqual(graphValue(native), native);
  const nx = graphValue({ directed: false, nodes: [{ id: 0 }, { id: 1 }], edges: [{ source: 0, target: 1 }] });
  assert.deepEqual(nx.links, [{ source: "0", target: "1" }]);
  assert.equal(nx.edges, undefined);
  for (const bad of [
    { nodes: [{ id: "a" }, { id: "a" }], links: [] },
    { nodes: [{ id: "a" }], links: [{ source: "a", target: "missing" }] },
    { nodes: [{ id: "__proto__" }], links: [] },
    { nodes: Array.from({ length: 8001 }, (_, i) => ({ id: String(i) })), links: [] },
  ])
    assert.throws(() => graphValue(bad));
});

test("shortest path honours direction unless ignored and reports each relation", () => {
  const g = graphValue({
    directed: true,
    nodes: [{ id: "a" }, { id: "b" }, { id: "c" }],
    links: [{ source: "a", target: "b", relation: "calls" }, { source: "c", target: "b", relation: "mentions" }],
  });
  assert.deepEqual(shortestPath(g, "a", "c"), []);
  const p = shortestPath(g, "a", "c", true);
  assert.deepEqual(p.map((s) => s.id), ["a", "b", "c"]);
  assert.equal(p[2].via?.relation, "mentions");
  assert.equal(p[2].reversed, true);
  assert.deepEqual(lineOf({ id: "x", source_location: "L12", source_end: 30 }), [12, 30]);
  assert.deepEqual(lineOf({ id: "x", source_location: "L5-L9" }), [5, 9]);
});

test("graph.json export round-trips with community labels; GraphML keys every attribute and escapes XML", () => {
  const { graph, project } = sample();
  const communities = summarizeCommunities(graph);
  const json = JSON.parse(exportGraphJson(graph, communities));
  assert.equal(graphValue(json).nodes.length, graph.nodes.length);
  assert.equal(json.graph.community_labels["0"], communities[0].label);
  const tricky = graphValue({ directed: true, nodes: [{ id: "a&<b>", label: 'x"y\u0001', score: 1.5, flag: true, list: [1] }, { id: "c" }], links: [{ source: "a&<b>", target: "c", weight: 2 }] });
  const xml = exportGraphML(tricky, []);
  assert.match(xml, /<node id="a&amp;&lt;b&gt;">/);
  assert.match(xml, /attr.name="score" attr.type="double"/);
  assert.match(xml, /attr.name="flag" attr.type="boolean"/);
  assert.match(xml, /attr.name="weight" attr.type="int"/);
  assert.match(xml, /x&quot;y</);
  assert.doesNotMatch(xml, /\u0001/);
  const full = exportGraphML(graph, communities);
  assert.equal((full.match(/<node /g) ?? []).length, graph.nodes.length);
  assert.equal((full.match(/<edge /g) ?? []).length, graph.links.length);
  assert.match(full, /attr.name="community_label"/);
  void project;
});

test("HTML report is self-contained, embeds parseable data and escapes script-breaking text", () => {
  const { graph, project } = sample();
  const evil = { ...graph, nodes: graph.nodes.map((n, i) => (i === 0 ? { ...n, label: "</script><img src=x onerror=alert(1)>" } : n)) };
  const positions = new Map(graph.nodes.map((n, i) => [n.id, { x: i * 3, y: i * 2 }]));
  const html = exportHtmlReport("门店补货助手", evil, [], project.corpus, positions, "2026-10-29");
  assert.doesNotMatch(html, /(src|href)="https?:/);
  assert.doesNotMatch(html, /<script src=/);
  assert.equal((html.match(/<\/script>/g) ?? []).length, 2);
  const data = JSON.parse(/<script type="application\/json" id="graph-data">([\s\S]*?)<\/script>/.exec(html)![1]);
  assert.equal(data.nodes.length, graph.nodes.length);
  assert.equal(data.nodes[0].label, "</script><img src=x onerror=alert(1)>");
  assert.match(html, /核心节点/);
  assert.match(html, /意外关联/);
  const md = exportMarkdownReport("门店补货助手", graph, [], project.corpus);
  assert.match(md, /^# 门店补货助手 · 图谱报告/);
  assert.match(md, /\| replenish\/policy.py \| python \|/);
});
