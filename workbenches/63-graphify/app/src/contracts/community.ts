// ABOUTME: 社区检测：多层 Louvain 加连通性细化（Leiden 的连通保证），确定性的节点顺序与编号。

export type WeightedEdge = { source: string; target: string; weight?: number };

type Adj = Map<number, number>[];

function buildAdjacency(n: number, edges: [number, number, number][]): Adj {
  const adj: Adj = Array.from({ length: n }, () => new Map());
  for (const [a, b, w] of edges) {
    if (!(w > 0)) continue;
    adj[a].set(b, (adj[a].get(b) ?? 0) + w);
    if (a !== b) adj[b].set(a, (adj[b].get(a) ?? 0) + w);
  }
  return adj;
}

/** 确定性伪随机：mulberry32 */
function rng(seed: number) {
  let t = seed >>> 0;
  return () => {
    t = (t + 0x6d2b79f5) >>> 0;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

/** 单层局部移动，返回每个节点的社区编号（0..k-1）以及是否有移动。 */
function localMoving(adj: Adj, resolution: number, random: () => number) {
  const n = adj.length;
  const degree = new Float64Array(n);
  let m2 = 0;
  for (let i = 0; i < n; i++) {
    for (const [j, w] of adj[i]) degree[i] += i === j ? 2 * w : w;
    m2 += degree[i];
  }
  const community = Int32Array.from({ length: n }, (_, i) => i);
  const total = Float64Array.from(degree);
  if (m2 === 0) return { community: Array.from(community), moved: false };
  const order = Array.from({ length: n }, (_, i) => i);
  for (let i = n - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  let moved = false, improved = true, rounds = 0;
  while (improved && rounds++ < 50) {
    improved = false;
    for (const i of order) {
      const own = community[i];
      const links = new Map<number, number>();
      for (const [j, w] of adj[i]) if (j !== i) links.set(community[j], (links.get(community[j]) ?? 0) + w);
      total[own] -= degree[i];
      let best = own;
      let bestGain = (links.get(own) ?? 0) - (resolution * total[own] * degree[i]) / m2;
      for (const [c, w] of links) {
        const gain = w - (resolution * total[c] * degree[i]) / m2;
        if (gain > bestGain + 1e-12) {
          bestGain = gain;
          best = c;
        }
      }
      total[best] += degree[i];
      if (best !== own) {
        community[i] = best;
        improved = true;
        moved = true;
      }
    }
  }
  const remap = new Map<number, number>();
  return { community: Array.from(community, (c) => remap.get(c) ?? (remap.set(c, remap.size), remap.size - 1)), moved };
}

function aggregate(adj: Adj, community: number[]): Adj {
  const k = Math.max(-1, ...community) + 1;
  const edges: [number, number, number][] = [];
  for (let i = 0; i < adj.length; i++)
    for (const [j, w] of adj[i]) {
      if (j < i) continue;
      edges.push([community[i], community[j], w]);
    }
  const out: Adj = Array.from({ length: k }, () => new Map());
  for (const [a, b, w] of edges) {
    out[a].set(b, (out[a].get(b) ?? 0) + w);
    if (a !== b) out[b].set(a, (out[b].get(a) ?? 0) + w);
  }
  return out;
}

/** 把不连通的社区拆开，保证每个社区在原图中连通。 */
function splitDisconnected(adj: Adj, community: number[]) {
  const result = new Array<number>(community.length).fill(-1);
  let next = 0;
  for (let i = 0; i < community.length; i++) {
    if (result[i] >= 0) continue;
    const label = next++;
    const queue = [i];
    result[i] = label;
    for (let q = 0; q < queue.length; q++) {
      for (const j of adj[queue[q]].keys())
        if (result[j] < 0 && community[j] === community[i]) {
          result[j] = label;
          queue.push(j);
        }
    }
  }
  return result;
}

export function modularity(ids: string[], edges: WeightedEdge[], membership: Map<string, number>, resolution = 1) {
  const index = new Map(ids.map((id, i) => [id, i]));
  const adj = buildAdjacency(ids.length, edgesToIndex(index, edges));
  const community = ids.map((id) => membership.get(id) ?? -1);
  let m2 = 0;
  const degree = adj.map((row, i) => {
    let d = 0;
    for (const [j, w] of row) d += i === j ? 2 * w : w;
    m2 += d;
    return d;
  });
  if (!m2) return 0;
  const inside = new Map<number, number>(), tot = new Map<number, number>();
  adj.forEach((row, i) => {
    tot.set(community[i], (tot.get(community[i]) ?? 0) + degree[i]);
    for (const [j, w] of row) if (community[i] === community[j]) inside.set(community[i], (inside.get(community[i]) ?? 0) + (i === j ? 2 * w : w));
  });
  let q = 0;
  for (const [c, t] of tot) q += (inside.get(c) ?? 0) / m2 - resolution * (t / m2) ** 2;
  return q;
}

function edgesToIndex(index: Map<string, number>, edges: WeightedEdge[]): [number, number, number][] {
  const out: [number, number, number][] = [];
  for (const e of edges) {
    const a = index.get(e.source), b = index.get(e.target);
    if (a === undefined || b === undefined || a === b) continue;
    const w = typeof e.weight === "number" && Number.isFinite(e.weight) && e.weight > 0 ? e.weight : 1;
    out.push([a, b, w]);
  }
  return out;
}

/**
 * 返回 节点→社区编号，社区按规模从大到小编号（0 最大），同规模按最小节点编号排序。
 * 关系方向忽略；平行关系权重累加。
 */
export function detectCommunities(
  ids: string[],
  edges: WeightedEdge[],
  { resolution = 1, seed = 42 }: { resolution?: number; seed?: number } = {},
): Map<string, number> {
  const sorted = [...ids].sort();
  const index = new Map(sorted.map((id, i) => [id, i]));
  const base = buildAdjacency(sorted.length, edgesToIndex(index, edges));
  const random = rng(seed);
  let membership = sorted.map((_, i) => i);
  let adj = base;
  for (let level = 0; level < 20; level++) {
    const { community, moved } = localMoving(adj, resolution, random);
    if (!moved) break;
    membership = membership.map((c) => community[c]);
    adj = aggregate(adj, community);
  }
  membership = splitDisconnected(base, membership);
  const groups = new Map<number, number[]>();
  membership.forEach((c, i) => groups.set(c, [...(groups.get(c) ?? []), i]));
  const ordered = [...groups.values()].sort((a, b) => b.length - a.length || a[0] - b[0]);
  const result = new Map<string, number>();
  ordered.forEach((members, c) => members.forEach((i) => result.set(sorted[i], c)));
  return result;
}
