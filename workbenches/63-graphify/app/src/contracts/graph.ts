import { boundedText, isRecord } from "./project.ts";
import { example } from "./example-graph.ts";
export type Node = Record<string, unknown> & { id: string };
export type Link = Record<string, unknown> & { source: string; target: string };
export type Graph = Record<string, unknown> & {
  directed: boolean;
  nodes: Node[];
  links: Link[];
};
export type Point = { x: number; y: number };
export type MapProject = {
  name: string;
  source: string;
  graph: Graph;
  notes: Record<string, string>;
  positions: Record<string, Point>;
  selected: string;
  from: string;
  to: string;
};
export function graphValue(value: unknown): Graph {
  if (
    !isRecord(value) ||
    !Array.isArray(value.nodes) ||
    !Array.isArray(value.links) ||
    typeof value.directed !== "boolean"
  )
    throw new Error("请导入Graphify原生graph.json（nodes、links和directed）。");
  if (
    value.nodes.length > 400 ||
    value.links.length > 1600 ||
    new TextEncoder().encode(JSON.stringify(value)).length > 350000
  )
    throw new Error("图谱超过400节点、1600关系或350KB，请拆分后导入。");
  const ids = new Set<string>();
  const nodes = value.nodes.map((n) => {
    if (!isRecord(n)) throw new Error("节点格式无效。");
    const id = boundedText(n.id, 300);
    if (
      !id ||
      ["__proto__", "constructor", "prototype"].includes(id) ||
      ids.has(id)
    )
      throw new Error("节点编号为空或重复。");
    ids.add(id);
    return { ...n, id };
  });
  const links = value.links.map((l) => {
    if (!isRecord(l)) throw new Error("关系格式无效。");
    const source = boundedText(l.source, 300),
      target = boundedText(l.target, 300);
    if (!ids.has(source) || !ids.has(target))
      throw new Error("关系引用了不存在的节点。");
    return { ...l, source, target };
  });
  return { ...value, directed: value.directed, nodes, links };
}
function decodeProject(value: unknown, working: boolean): MapProject {
  if (
    !isRecord(value) ||
    !isRecord(value.notes) ||
    !isRecord(value.positions) ||
    new TextEncoder().encode(JSON.stringify(value)).length >
      (working ? 1500000 : 550000)
  )
    throw new Error("项目格式或大小无效。");
  const graph = graphValue(value.graph),
    ids = new Set(graph.nodes.map((n) => n.id));
  const notes: Record<string, string> = {},
    positions: Record<string, Point> = {};
  if (
    Object.keys(value.notes).length > 400 ||
    Object.keys(value.positions).length > 400
  )
    throw new Error("笔记或布局超限。");
  for (const [id, note] of Object.entries(value.notes)) {
    if (!ids.has(id)) throw new Error("笔记引用不存在的节点。");
    notes[id] = boundedText(note, 5000);
  }
  for (const [id, p] of Object.entries(value.positions)) {
    if (
      !ids.has(id) ||
      !isRecord(p) ||
      typeof p.x !== "number" ||
      typeof p.y !== "number" ||
      !Number.isFinite(p.x) ||
      !Number.isFinite(p.y) ||
      p.x < 40 ||
      p.x > 1560 ||
      p.y < 40 ||
      p.y > 960
    )
      throw new Error("节点位置无效。");
    positions[id] = { x: p.x, y: p.y };
  }
  return {
    name: boundedText(value.name, 100),
    source: boundedText(value.source, 80000),
    graph,
    notes,
    positions,
    selected: boundedText(value.selected, 300),
    from: boundedText(value.from, 300),
    to: boundedText(value.to, 300),
  };
}
export function label(node: Node) {
  return typeof node.label === "string" ? node.label : node.id;
}
export function field(node: Record<string, unknown>, key: string) {
  return typeof node[key] === "string" ? String(node[key]) : "";
}
export function shortestPath(graph: Graph, from: string, to: string): string[] {
  const next = new Map(graph.nodes.map((n) => [n.id, [] as string[]]));
  if (!next.has(from) || !next.has(to)) return [];
  for (const l of graph.links) {
    next.get(l.source)?.push(l.target);
    if (!graph.directed) next.get(l.target)?.push(l.source);
  }
  const previous = new Map<string, string | null>([[from, null]]),
    queue = [from];
  for (let i = 0; i < queue.length; i++) {
    const id = queue[i];
    if (id === to) {
      const path: string[] = [];
      let at: string | null = id;
      while (at !== null) {
        path.unshift(at);
        at = previous.get(at) ?? null;
      }
      return path;
    }
    for (const target of next.get(id) ?? []) {
      if (!previous.has(target)) {
        previous.set(target, id);
        queue.push(target);
      }
    }
  }
  return [];
}
export const exampleSource =
  "class Catalog:\n    def search(self, query):\n        return normalize(query)\n\ndef normalize(query):\n    return query.strip().lower()\n\ndef serve(query):\n    catalog = Catalog()\n    return catalog.search(query)\n";
export const seed: MapProject = {
  name: "catalog.py",
  source: exampleSource,
  graph: graphValue(example),
  notes: { catalog_catalog: "目录服务的入口对象；核对查询路径与调用者。" },
  positions: {},
  selected: "catalog_catalog",
  from: "catalog_serve",
  to: "catalog_normalize",
};
export function fromGraph(graph: Graph): MapProject {
  return {
    ...seed,
    source: "",
    name: "import.py",
    graph,
    notes: {},
    positions: {},
    selected: graph.nodes[0]?.id ?? "",
    from: "",
    to: "",
  };
}

export const projectValue = (value: unknown): MapProject =>
  decodeProject(value, false);
export const restoreDraftData = (value: unknown): MapProject =>
  decodeProject(value, true);
