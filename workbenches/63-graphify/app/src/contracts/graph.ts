// ABOUTME: Graphify 原生 node-link 图谱的校验与查询；额外字段与并行关系原样保留。

import { boundedText, isRecord } from "./project.ts";

export type Node = Record<string, unknown> & { id: string };
export type Link = Record<string, unknown> & { source: string; target: string };
export type Graph = Record<string, unknown> & {
  directed: boolean;
  nodes: Node[];
  links: Link[];
};

export const GRAPH_LIMITS = { nodes: 8000, links: 40000 };
const UNSAFE = new Set(["__proto__", "constructor", "prototype"]);

/** networkx/Graphify node-link：source/target 可能是编号字符串或数字，统一为字符串。 */
const endpoint = (value: unknown) =>
  typeof value === "number" && Number.isFinite(value) ? String(value) : boundedText(value, 300);

export function graphValue(value: unknown): Graph {
  if (!isRecord(value)) throw new Error("请导入 Graphify 原生 graph.json（nodes、links）。");
  const linksRaw = Array.isArray(value.links) ? value.links : Array.isArray(value.edges) ? value.edges : null;
  if (!Array.isArray(value.nodes) || !linksRaw)
    throw new Error("请导入 Graphify 原生 graph.json（nodes、links）。");
  if (value.directed !== undefined && typeof value.directed !== "boolean")
    throw new Error("directed 字段必须是布尔值。");
  if (value.nodes.length > GRAPH_LIMITS.nodes || linksRaw.length > GRAPH_LIMITS.links)
    throw new Error(`图谱有 ${value.nodes.length} 个节点、${linksRaw.length} 条关系，超过 ${GRAPH_LIMITS.nodes} / ${GRAPH_LIMITS.links} 的浏览上限。请按目录拆分资料后分别建图。`);
  const ids = new Set<string>();
  const nodes = value.nodes.map((n, i) => {
    if (!isRecord(n)) throw new Error(`第 ${i + 1} 个节点格式无效。`);
    const id = endpoint(n.id);
    if (!id || UNSAFE.has(id)) throw new Error(`第 ${i + 1} 个节点编号无效。`);
    if (ids.has(id)) throw new Error(`节点编号重复：${id.slice(0, 60)}`);
    ids.add(id);
    return { ...n, id };
  });
  const links = linksRaw.map((l, i) => {
    if (!isRecord(l)) throw new Error(`第 ${i + 1} 条关系格式无效。`);
    const source = endpoint(l.source), target = endpoint(l.target);
    if (!ids.has(source) || !ids.has(target))
      throw new Error(`第 ${i + 1} 条关系引用了不存在的节点（${(ids.has(source) ? target : source).slice(0, 60)}）。`);
    return { ...l, source, target };
  });
  const out: Graph = { ...value, directed: value.directed ?? true, nodes, links };
  if (!Array.isArray(value.links)) {
    delete out.edges;
  }
  return out;
}

export function label(node: Node | undefined) {
  if (!node) return "";
  return typeof node.label === "string" && node.label ? node.label : node.id;
}
export function field(node: Record<string, unknown> | undefined, key: string) {
  if (!node) return "";
  const v = node[key];
  return typeof v === "string" ? v : typeof v === "number" ? String(v) : "";
}
export function communityOf(node: Node | undefined): number | null {
  const c = node?.community;
  return typeof c === "number" && Number.isInteger(c) && c >= 0 ? c : null;
}
export function lineOf(node: Node | undefined): [number, number] | null {
  const loc = field(node, "source_location");
  const m = /^L(\d+)(?:[-–]L?(\d+))?/.exec(loc);
  if (!m) return null;
  const start = Number(m[1]);
  const endRaw = node?.source_end;
  const end = m[2] ? Number(m[2]) : typeof endRaw === "number" && endRaw >= start ? endRaw : start;
  return [start, end];
}

export type PathStep = { id: string; via: Link | null; reversed: boolean };
/** BFS 最短路径；directed 图可选择忽略方向。返回每步与经由的关系。 */
export function shortestPath(graph: Graph, from: string, to: string, ignoreDirection = false): PathStep[] {
  const next = new Map<string, { id: string; link: Link; reversed: boolean }[]>(graph.nodes.map((n) => [n.id, []]));
  if (!next.has(from) || !next.has(to)) return [];
  if (from === to) return [{ id: from, via: null, reversed: false }];
  for (const l of graph.links) {
    next.get(l.source)?.push({ id: l.target, link: l, reversed: false });
    if (!graph.directed || ignoreDirection) next.get(l.target)?.push({ id: l.source, link: l, reversed: true });
  }
  const previous = new Map<string, { from: string; link: Link; reversed: boolean } | null>([[from, null]]);
  const queue = [from];
  for (let i = 0; i < queue.length; i++) {
    const id = queue[i];
    if (id === to) break;
    for (const step of next.get(id) ?? []) {
      if (previous.has(step.id)) continue;
      previous.set(step.id, { from: id, link: step.link, reversed: step.reversed });
      queue.push(step.id);
    }
  }
  if (!previous.has(to)) return [];
  const path: PathStep[] = [];
  let at: string | undefined = to;
  while (at !== undefined) {
    const p = previous.get(at);
    path.unshift({ id: at, via: p?.link ?? null, reversed: p?.reversed ?? false });
    at = p?.from;
  }
  return path;
}

export function degreeMap(graph: Graph) {
  const d = new Map<string, number>(graph.nodes.map((n) => [n.id, 0]));
  for (const l of graph.links) {
    d.set(l.source, (d.get(l.source) ?? 0) + 1);
    d.set(l.target, (d.get(l.target) ?? 0) + 1);
  }
  return d;
}

export const RELATION_NAMES: Record<string, string> = {
  contains: "包含",
  method: "方法",
  calls: "调用",
  imports: "导入",
  imports_from: "导入",
  inherits: "继承",
  implements: "实现",
  renders: "渲染",
  references: "引用",
  mentions: "提及",
  related_to: "共现",
  rationale_for: "设计理由",
  uses: "使用",
  defines: "定义",
};
export const KIND_NAMES: Record<string, string> = {
  file: "文件",
  class: "类",
  function: "函数",
  method: "方法",
  interface: "接口",
  type: "类型",
  enum: "枚举",
  variable: "变量",
  module: "外部模块",
  section: "章节",
  concept: "术语",
  rationale: "设计理由",
};
export function nodeKind(node: Node | undefined): string {
  if (!node) return "";
  if (typeof node.kind === "string") return node.kind;
  if (node._callable_class) return "class";
  if (node._callable) return label(node).startsWith(".") ? "method" : "function";
  if (node.file_type === "document") return "section";
  return "file";
}
