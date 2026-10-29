import assert from "node:assert/strict";
import { test } from "node:test";
import { detectCommunities, modularity } from "../src/contracts/community.ts";
import { carryCommunityNames, ensureCommunities, summarizeCommunities, godNodes, surprisingConnections } from "../src/contracts/analysis.ts";
import { extractCorpus } from "../src/contracts/extract/index.ts";
import { sampleFiles } from "../src/contracts/sample/corpus.ts";

const clique = (prefix: string, n: number) => {
  const ids = Array.from({ length: n }, (_, i) => `${prefix}${i}`);
  const edges = ids.flatMap((a, i) => ids.slice(i + 1).map((b) => ({ source: a, target: b })));
  return { ids, edges };
};

test("Louvain separates two cliques joined by one bridge and isolates components", () => {
  const a = clique("a", 6), b = clique("b", 5);
  const ids = [...a.ids, ...b.ids, "lonely"];
  const edges = [...a.edges, ...b.edges, { source: "a0", target: "b0" }];
  const m = detectCommunities(ids, edges);
  assert.equal(new Set(a.ids.map((id) => m.get(id))).size, 1);
  assert.equal(new Set(b.ids.map((id) => m.get(id))).size, 1);
  assert.notEqual(m.get("a1"), m.get("b1"));
  assert.equal(m.get("a1"), 0, "largest community is numbered 0");
  assert.ok(![...a.ids, ...b.ids].some((id) => m.get(id) === m.get("lonely")));
  assert.ok(modularity(ids, edges, m) > 0.4);
  assert.deepEqual([...detectCommunities([...ids].reverse(), [...edges].reverse())], [...m]);
});

test("sample graph communities have positive modularity and every community is connected", () => {
  const { graph } = extractCorpus(sampleFiles);
  const m = new Map(graph.nodes.map((n) => [n.id, n.community as number]));
  assert.ok(modularity(graph.nodes.map((n) => n.id), graph.links, m) > 0.3);
  const adj = new Map<string, string[]>();
  for (const l of graph.links) {
    adj.set(l.source, [...(adj.get(l.source) ?? []), l.target]);
    adj.set(l.target, [...(adj.get(l.target) ?? []), l.source]);
  }
  for (const c of new Set(m.values())) {
    const members = graph.nodes.filter((n) => n.community === c).map((n) => n.id);
    const seen = new Set([members[0]]), queue = [members[0]];
    while (queue.length) for (const x of adj.get(queue.pop()!) ?? []) if (m.get(x) === c && !seen.has(x)) (seen.add(x), queue.push(x));
    assert.equal(seen.size, members.length, `community ${c} connected`);
  }
  const summary = summarizeCommunities(graph);
  assert.ok(summary.every((s) => s.label && s.top.length));
  assert.ok(godNodes(graph).length === 10);
  assert.ok(surprisingConnections(graph).some(({ link }) => link.relation === "mentions"));
});

test("imported graphs without communities get them; names follow members across re-extraction", () => {
  const raw = { directed: false, nodes: [{ id: "x" }, { id: "y" }, { id: "z" }], links: [{ source: "x", target: "y" }] };
  const { graph, detected } = ensureCommunities(raw as never);
  assert.ok(detected);
  assert.ok(graph.nodes.every((n) => Number.isInteger(n.community)));
  const before = { ...graph, nodes: graph.nodes.map((n) => ({ ...n, community: n.id === "z" ? 1 : 0 })) };
  const after = { ...graph, nodes: graph.nodes.map((n) => ({ ...n, community: n.id === "z" ? 0 : 3 })) };
  const carried = carryCommunityNames(before, after, [{ id: 0, label: "核心", summary: "", origin: "manual" }]);
  assert.deepEqual(carried, [{ id: 3, label: "核心", summary: "", origin: "manual" }]);
});
