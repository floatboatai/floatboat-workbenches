// ABOUTME: 图谱分析：社区摘要与自动命名、核心节点、跨社区的意外关联，供界面与报告共用。

import { communityOf, degreeMap, label, nodeKind, field, type Graph, type Link, type Node } from "./graph.ts";
import { detectCommunities } from "./community.ts";

export type CommunityMeta = {
  id: number;
  label: string;
  summary: string;
  origin: "auto" | "host" | "manual";
};
export type CommunitySummary = CommunityMeta & {
  size: number;
  members: string[];
  top: string[];
  files: number;
  internal: number;
  external: number;
};

/** 12 色分类色板（地图浅底与深底都可辨认）；超过 12 个社区的其余社区用中性灰。 */
export const PALETTE = [
  "#2f7fc1", "#e3793b", "#3a9e6b", "#c2416b", "#7b5cc4", "#b38a1d",
  "#1b9aa6", "#d1543f", "#5f8f2f", "#a6599e", "#4a6fa5", "#8c6d4f",
];
export const OTHER_COLOR = "#8b949e";
export const colorOf = (community: number | null) =>
  community === null ? OTHER_COLOR : community < PALETTE.length ? PALETTE[community] : OTHER_COLOR;

const REP_RANK: Record<string, number> = { class: 0, concept: 1, interface: 2, section: 3, function: 4, method: 5, type: 6, file: 7, module: 8, rationale: 9 };

function topFolder(path: string) {
  const parts = path.split("/");
  return parts.length > 1 ? parts[0] : path;
}

export function summarizeCommunities(graph: Graph, labels: CommunityMeta[] = []): CommunitySummary[] {
  const degree = degreeMap(graph);
  const byId = new Map(graph.nodes.map((n) => [n.id, n]));
  const groups = new Map<number, Node[]>();
  for (const n of graph.nodes) {
    const c = communityOf(n);
    if (c === null) continue;
    groups.set(c, [...(groups.get(c) ?? []), n]);
  }
  const internal = new Map<number, number>(), external = new Map<number, number>();
  for (const l of graph.links) {
    const a = communityOf(byId.get(l.source)), b = communityOf(byId.get(l.target));
    if (a === null || b === null) continue;
    if (a === b) internal.set(a, (internal.get(a) ?? 0) + 1);
    else {
      external.set(a, (external.get(a) ?? 0) + 1);
      external.set(b, (external.get(b) ?? 0) + 1);
    }
  }
  const saved = new Map(labels.map((l) => [l.id, l]));
  return [...groups.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([id, members]) => {
      const ranked = [...members].sort(
        (a, b) =>
          (degree.get(b.id) ?? 0) - (degree.get(a.id) ?? 0) ||
          (REP_RANK[nodeKind(a)] ?? 9) - (REP_RANK[nodeKind(b)] ?? 9) ||
          a.id.localeCompare(b.id),
      );
      const rep = ranked.find((n) => !["file", "module", "rationale"].includes(nodeKind(n))) ?? ranked[0];
      const folders = new Map<string, number>();
      const files = new Set<string>();
      for (const n of members) {
        const sf = field(n, "source_file");
        if (!sf) continue;
        files.add(sf);
        const f = topFolder(sf);
        folders.set(f, (folders.get(f) ?? 0) + 1);
      }
      const folder = [...folders.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0]?.[0];
      const repLabel = label(rep).replace(/\(\)$/, "");
      const auto = members.length === 1 ? repLabel : folder && folder !== repLabel ? `${repLabel} · ${folder}` : repLabel;
      const meta = saved.get(id);
      return {
        id,
        label: meta?.label || auto,
        summary: meta?.summary ?? "",
        origin: meta?.origin ?? "auto",
        size: members.length,
        members: members.map((n) => n.id),
        top: ranked.slice(0, 8).map((n) => n.id),
        files: files.size,
        internal: internal.get(id) ?? 0,
        external: external.get(id) ?? 0,
      };
    });
}

export function godNodes(graph: Graph, limit = 10) {
  const degree = degreeMap(graph);
  return graph.nodes
    .filter((n) => !["file", "module"].includes(nodeKind(n)))
    .map((n) => ({ id: n.id, degree: degree.get(n.id) ?? 0 }))
    .sort((a, b) => b.degree - a.degree || a.id.localeCompare(b.id))
    .slice(0, limit);
}

const STRUCTURAL = new Set(["contains", "method"]);
/** 跨社区、跨资料类型或推断得来的关系，按“出乎意料”程度排序。 */
export function surprisingConnections(graph: Graph, limit = 12) {
  const byId = new Map(graph.nodes.map((n) => [n.id, n]));
  const kindGroup = (n: Node | undefined) => (field(n, "file_type") === "code" ? "code" : "doc");
  return graph.links
    .map((l, index) => {
      if (STRUCTURAL.has(String(l.relation))) return null;
      const a = byId.get(l.source), b = byId.get(l.target);
      const ca = communityOf(a), cb = communityOf(b);
      if (ca === null || cb === null || ca === cb) return null;
      let score = 2;
      if (kindGroup(a) !== kindGroup(b)) score += 1;
      if (topFolder(field(a, "source_file")) !== topFolder(field(b, "source_file"))) score += 0.5;
      const conf = typeof l.confidence_score === "number" ? l.confidence_score : 1;
      score += 1 - conf;
      return { index, link: l as Link, score };
    })
    .filter((x): x is { index: number; link: Link; score: number } => x !== null)
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .slice(0, limit);
}

/** 导入的图谱若缺少社区编号，按本地 Louvain 补齐；已有编号保持不变。 */
export function ensureCommunities(graph: Graph): { graph: Graph; detected: boolean } {
  if (graph.nodes.length && graph.nodes.every((n) => communityOf(n) !== null)) return { graph, detected: false };
  const membership = detectCommunities(
    graph.nodes.map((n) => n.id),
    graph.links.map((l) => ({ source: l.source, target: l.target, weight: typeof l.weight === "number" ? l.weight : 1 })),
  );
  return { graph: { ...graph, nodes: graph.nodes.map((n) => ({ ...n, community: membership.get(n.id) ?? null })) }, detected: true };
}

export function graphStats(graph: Graph) {
  const count = (xs: string[]) => xs.reduce<Record<string, number>>((acc, x) => ((acc[x] = (acc[x] ?? 0) + 1), acc), {});
  return {
    nodes: graph.nodes.length,
    links: graph.links.length,
    communities: new Set(graph.nodes.map(communityOf).filter((c) => c !== null)).size,
    files: new Set(graph.nodes.map((n) => field(n, "source_file")).filter(Boolean)).size,
    byKind: count(graph.nodes.map(nodeKind)),
    byConfidence: count(graph.links.map((l) => String(l.confidence ?? "EXTRACTED"))),
  };
}

/** 重新抽取后社区编号会变：人工或模型命名按成员重合度（Jaccard ≥ 0.5）迁移到新社区。 */
export function carryCommunityNames(oldGraph: Graph, newGraph: Graph, metas: CommunityMeta[]): CommunityMeta[] {
  if (!metas.length) return [];
  const group = (g: Graph) => {
    const m = new Map<number, Set<string>>();
    for (const n of g.nodes) {
      const c = communityOf(n);
      if (c === null) continue;
      if (!m.has(c)) m.set(c, new Set());
      m.get(c)!.add(n.id);
    }
    return m;
  };
  const before = group(oldGraph), after = group(newGraph);
  const out: CommunityMeta[] = [];
  const taken = new Set<number>();
  for (const meta of metas) {
    const members = before.get(meta.id);
    if (!members) continue;
    let best: { id: number; score: number } | null = null;
    for (const [id, set] of after) {
      if (taken.has(id)) continue;
      let shared = 0;
      for (const x of members) if (set.has(x)) shared++;
      const score = shared / (members.size + set.size - shared);
      if (score >= 0.5 && (!best || score > best.score)) best = { id, score };
    }
    if (best) {
      taken.add(best.id);
      out.push({ ...meta, id: best.id });
    }
  }
  return out;
}
