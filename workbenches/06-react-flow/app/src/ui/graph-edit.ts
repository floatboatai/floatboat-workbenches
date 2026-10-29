// ABOUTME: 画布编辑的纯操作：dagre 自动布局、新增/复制/粘贴节点、按端口替换连线。
import dagre from "@dagrejs/dagre";
import { checkConnection } from "../contracts/engine.ts";
import type { FlowDocument, PipelineEdge, PipelineNode } from "../contracts/flow.ts";
import { MAX_NODES } from "../contracts/flow.ts";
import { defaultConfig, spec, type OpKind } from "../contracts/ops.ts";

export const NODE_WIDTH = 224;
const DEFAULT_HEIGHT = 150;

export const newId = (prefix: string) => `${prefix}-${crypto.randomUUID().slice(0, 8)}`;

/** 从左到右分层排布；节点高度使用已测量尺寸。 */
export function autoLayout(
  doc: FlowDocument,
  sizes: Record<string, { width: number; height: number }>,
): PipelineNode[] {
  const graph = new dagre.graphlib.Graph();
  graph.setGraph({ rankdir: "LR", nodesep: 36, ranksep: 64, marginx: 0, marginy: 0 });
  graph.setDefaultEdgeLabel(() => ({}));
  for (const node of doc.nodes)
    graph.setNode(node.id, { width: sizes[node.id]?.width ?? NODE_WIDTH, height: sizes[node.id]?.height ?? DEFAULT_HEIGHT });
  for (const edge of doc.edges) graph.setEdge(edge.source, edge.target);
  dagre.layout(graph);
  return doc.nodes.map((node) => {
    const placed = graph.node(node.id);
    const width = sizes[node.id]?.width ?? NODE_WIDTH,
      height = sizes[node.id]?.height ?? DEFAULT_HEIGHT;
    return placed
      ? { ...node, position: { x: Math.round(placed.x - width / 2), y: Math.round(placed.y - height / 2) } }
      : node;
  });
}

export function createNode(op: OpKind, position: { x: number; y: number }, config: Record<string, unknown> = {}, label?: string): PipelineNode {
  return {
    id: newId(op),
    type: "op",
    position: { x: Math.round(position.x), y: Math.round(position.y) },
    data: { op, label: label ?? spec(op).title, config: { ...defaultConfig(op), ...config } },
  };
}

export function addNode(doc: FlowDocument, node: PipelineNode): FlowDocument {
  if (doc.nodes.length >= MAX_NODES) throw new Error(`最多 ${MAX_NODES} 个节点。`);
  return { ...doc, nodes: [...doc.nodes, node] };
}

export interface Clip {
  nodes: PipelineNode[];
  edges: PipelineEdge[];
}

/** 复制所选节点及它们之间的连线。 */
export function copySelection(doc: FlowDocument, ids: string[]): Clip | null {
  const chosen = new Set(ids);
  const nodes = doc.nodes.filter((node) => chosen.has(node.id));
  if (!nodes.length) return null;
  return {
    nodes: structuredClone(nodes),
    edges: structuredClone(doc.edges.filter((edge) => chosen.has(edge.source) && chosen.has(edge.target))),
  };
}

/** 以新标识粘贴；返回新文档和新节点标识（用于选中）。 */
export function pasteClip(doc: FlowDocument, clip: Clip, offset = 40): { doc: FlowDocument; ids: string[] } {
  if (doc.nodes.length + clip.nodes.length > MAX_NODES) throw new Error(`最多 ${MAX_NODES} 个节点。`);
  const map = new Map(clip.nodes.map((node) => [node.id, newId(node.data.op)]));
  const nodes = clip.nodes.map((node) => ({
    ...structuredClone(node),
    id: map.get(node.id)!,
    position: { x: node.position.x + offset, y: node.position.y + offset },
  }));
  const edges = clip.edges.map((edge) => ({
    ...edge,
    id: newId("e"),
    source: map.get(edge.source)!,
    target: map.get(edge.target)!,
  }));
  return { doc: { ...doc, nodes: [...doc.nodes, ...nodes], edges: [...doc.edges, ...edges] }, ids: nodes.map((node) => node.id) };
}

export function removeElements(doc: FlowDocument, nodeIds: string[], edgeIds: string[]): FlowDocument {
  const nodes = new Set(nodeIds),
    edges = new Set(edgeIds);
  return {
    ...doc,
    nodes: doc.nodes.filter((node) => !nodes.has(node.id)),
    edges: doc.edges.filter((edge) => !edges.has(edge.id) && !nodes.has(edge.source) && !nodes.has(edge.target)),
  };
}

/** 连接两个端口；目标端口已有连线时替换。校验失败抛出可读原因。 */
export function connect(
  doc: FlowDocument,
  c: { source: string; sourceHandle?: string | null; target: string; targetHandle?: string | null },
): FlowDocument {
  const check = checkConnection(doc, c);
  if (!check.ok) throw new Error(check.reason);
  const sourceHandle = c.sourceHandle ?? "out",
    targetHandle = c.targetHandle ?? "in";
  return {
    ...doc,
    edges: [
      ...doc.edges.filter((edge) => !(edge.target === c.target && edge.targetHandle === targetHandle)),
      { id: newId("e"), source: c.source, sourceHandle, target: c.target, targetHandle },
    ],
  };
}

export function disconnect(doc: FlowDocument, target: string, targetHandle: string): FlowDocument {
  return { ...doc, edges: doc.edges.filter((edge) => !(edge.target === target && edge.targetHandle === targetHandle)) };
}
