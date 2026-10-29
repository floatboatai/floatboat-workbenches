import assert from "node:assert/strict";
import { test } from "node:test";
import { validateFlow } from "../src/contracts/flow.ts";
import { seed } from "../src/contracts/templates.ts";
import { addNode, autoLayout, connect, copySelection, createNode, disconnect, pasteClip, removeElements } from "../src/ui/graph-edit.ts";

test("自动布局：从左到右分层，下游节点在上游右侧", () => {
  const nodes = autoLayout(seed, {});
  const x = (id: string) => nodes.find((n) => n.id === id)!.position.x;
  assert.ok(x("orders") < x("clean"));
  assert.ok(x("clean") < x("unique"));
  assert.ok(x("byRegion") < x("chart"));
  assert.doesNotThrow(() => validateFlow({ ...seed, nodes }));
});

test("复制粘贴：新标识、保留内部连线、偏移位置，结果仍可校验", () => {
  const clip = copySelection(seed, ["unique", "byRegion"])!;
  assert.equal(clip.edges.length, 1);
  const { doc, ids } = pasteClip(seed, clip);
  assert.equal(ids.length, 2);
  assert.equal(doc.nodes.length, seed.nodes.length + 2);
  assert.ok(ids.every((id) => !seed.nodes.some((n) => n.id === id)));
  const pastedEdge = doc.edges.at(-1)!;
  assert.ok(ids.includes(pastedEdge.source) && ids.includes(pastedEdge.target));
  assert.doesNotThrow(() => validateFlow(doc));
});

test("连接：替换同一输入端口的旧连线，拒绝类型不符与回路；删除节点同时删除连线", () => {
  const sort = createNode("sort", { x: 0, y: 0 });
  let doc = addNode(seed, sort);
  doc = connect(doc, { source: "unique", sourceHandle: "out", target: sort.id, targetHandle: "in" });
  doc = connect(doc, { source: "byRegion", sourceHandle: "out", target: sort.id, targetHandle: "in" });
  assert.equal(doc.edges.filter((e) => e.target === sort.id).length, 1);
  assert.equal(doc.edges.find((e) => e.target === sort.id)!.source, "byRegion");
  assert.throws(() => connect(doc, { source: "chart", target: "orders" }));
  assert.throws(() => connect(doc, { source: sort.id, sourceHandle: "out", target: "unique", targetHandle: "in" }), /环/);
  assert.equal(disconnect(doc, sort.id, "in").edges.length, seed.edges.length);
  const removed = removeElements(doc, ["byRegion"], []);
  assert.ok(!removed.edges.some((e) => e.source === "byRegion" || e.target === "byRegion"));
  assert.doesNotThrow(() => validateFlow(removed));
});
