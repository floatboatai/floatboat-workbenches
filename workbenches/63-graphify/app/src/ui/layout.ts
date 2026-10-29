// ABOUTME: d3-force 力导向布局：社区向各自中心聚拢，人工固定的节点不参与模拟；分帧运行不阻塞输入。

import { forceCollide, forceLink, forceManyBody, forceSimulation, forceX, forceY, type SimulationNodeDatum } from "d3-force";
import { communityOf, degreeMap, type Graph } from "../contracts/graph.ts";
import type { Point } from "../contracts/map.ts";

export type LayoutNode = SimulationNodeDatum & { id: string; community: number | null; degree: number; r: number };
export type Layout = { nodes: LayoutNode[]; byId: Map<string, LayoutNode> };

export const nodeRadius = (degree: number) => 4 + Math.min(12, Math.sqrt(degree) * 1.9);

/** 社区中心排成黄金角螺旋：大社区靠近中心，彼此留出与规模相称的间距。 */
function centers(graph: Graph) {
  const sizes = new Map<number, number>();
  for (const n of graph.nodes) {
    const c = communityOf(n);
    if (c !== null) sizes.set(c, (sizes.get(c) ?? 0) + 1);
  }
  const ordered = [...sizes.entries()].sort((a, b) => b[1] - a[1] || a[0] - b[0]);
  const out = new Map<number, Point>();
  let radius = 0;
  ordered.forEach(([c, size], i) => {
    const spread = 52 * Math.sqrt(size);
    radius = i === 0 ? 0 : Math.max(radius + spread * 0.5, 110 * Math.sqrt(i) + spread);
    const angle = i * 2.39996;
    out.set(c, { x: Math.cos(angle) * radius, y: Math.sin(angle) * radius });
  });
  return out;
}

export function startLayout(
  graph: Graph,
  pins: Record<string, Point>,
  onTick: (layout: Layout, done: boolean) => void,
): () => void {
  const degree = degreeMap(graph);
  const center = centers(graph);
  const nodes: LayoutNode[] = graph.nodes.map((n, i) => {
    const c = communityOf(n);
    const base = c !== null ? center.get(c)! : { x: 0, y: 0 };
    const angle = i * 2.39996, dist = 10 * Math.sqrt(i % 97);
    const pin = pins[n.id];
    const d = degree.get(n.id) ?? 0;
    return {
      id: n.id,
      community: c,
      degree: d,
      r: nodeRadius(d),
      x: pin ? pin.x : base.x + Math.cos(angle) * dist,
      y: pin ? pin.y : base.y + Math.sin(angle) * dist,
      ...(pin ? { fx: pin.x, fy: pin.y } : {}),
    };
  });
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const links = graph.links
    .filter((l) => l.source !== l.target)
    .map((l) => ({ source: l.source, target: l.target, same: byId.get(l.source)?.community === byId.get(l.target)?.community }));
  const big = nodes.length > 1500;
  const sim = forceSimulation(nodes)
    .force(
      "link",
      forceLink<LayoutNode, { source: string | LayoutNode; target: string | LayoutNode; same: boolean }>(links)
        .id((d) => d.id)
        .distance((l) => (l.same ? 46 : 150))
        .strength((l) => (l.same ? 0.45 : 0.02)),
    )
    .force("charge", forceManyBody<LayoutNode>().strength((d) => -90 - d.degree * 4).theta(big ? 1.2 : 0.9).distanceMax(600))
    .force("x", forceX<LayoutNode>((d) => (d.community !== null ? center.get(d.community)!.x : 0)).strength(0.08))
    .force("y", forceY<LayoutNode>((d) => (d.community !== null ? center.get(d.community)!.y : 0)).strength(0.08))
    .force("collide", forceCollide<LayoutNode>((d) => d.r + 6).iterations(big ? 1 : 2))
    .alphaDecay(big ? 0.05 : 0.03)
    .stop();
  const layout = { nodes, byId };
  let frame = 0, cancelled = false;
  const step = () => {
    if (cancelled) return;
    const started = performance.now();
    while (sim.alpha() > sim.alphaMin() && performance.now() - started < 14) sim.tick();
    const done = sim.alpha() <= sim.alphaMin();
    onTick(layout, done);
    if (!done) frame = requestAnimationFrame(step);
  };
  // 小图同步算完，首帧即为最终布局
  if (nodes.length <= 400) {
    while (sim.alpha() > sim.alphaMin()) sim.tick();
    onTick(layout, true);
  } else frame = requestAnimationFrame(step);
  return () => {
    cancelled = true;
    cancelAnimationFrame(frame);
    sim.stop();
  };
}
