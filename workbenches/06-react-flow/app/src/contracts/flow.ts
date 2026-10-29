// ABOUTME: 流水线文档（节点、带端口的连线、上次运行记录）的结构校验、草稿恢复与旧版单链转换。
import { isRecord, boundedText } from "./project.ts";
import { isOpKind, normalizeConfig, spec, type OpKind } from "./ops.ts";
import type { Cell, Preview } from "./values.ts";

export const MAX_NODES = 80;
export const MAX_EDGES = 160;

export interface NodeData {
  op: OpKind;
  label: string;
  config: Record<string, unknown>;
}
export interface PipelineNode {
  id: string;
  type: "op";
  position: { x: number; y: number };
  data: NodeData;
}
export interface PipelineEdge {
  id: string;
  source: string;
  sourceHandle: string;
  target: string;
  targetHandle: string;
}
export type RunStatus = "ok" | "error" | "skipped";
export interface NodeRun {
  status: RunStatus;
  ms: number;
  sig: string;
  summary: string;
  error?: string;
  preview?: Preview;
}
export interface RunRecord {
  at: string;
  ms: number;
  nodes: Record<string, NodeRun>;
}
export interface FlowDocument {
  version: 2;
  nodes: PipelineNode[];
  edges: PipelineEdge[];
  lastRun?: RunRecord;
}

const identifier = (value: unknown, what: string) => {
  if (typeof value !== "string" || !/^[A-Za-z0-9_-]{1,80}$/.test(value))
    throw new Error(`${what}标识无效。`);
  return value;
};
const finite = (value: unknown) =>
  typeof value === "number" && Number.isFinite(value) && Math.abs(value) <= 100000;

/** 0.3 版单链（input/uppercase/prefix/output）转换为新节点。 */
function legacyNode(data: Record<string, unknown>): { op: OpKind; config: Record<string, unknown> } {
  const value = typeof data.value === "string" ? data.value : "";
  switch (data.operation) {
    case "input":
      return { op: "textInput", config: { text: value } };
    case "uppercase":
      return { op: "textTransform", config: { mode: "upper" } };
    case "prefix":
      return { op: "textTransform", config: { mode: "prefix", value } };
    case "output":
      return { op: "textOutput", config: {} };
  }
  throw new Error("节点类型无效。");
}

function decodeNode(node: unknown, draft: boolean): PipelineNode {
  if (!isRecord(node) || !isRecord(node.data) || !isRecord(node.position) || !finite(node.position.x) || !finite(node.position.y))
    throw new Error("节点位置或配置无效。");
  const legacy = node.type === "step" || "operation" in node.data;
  const kind = legacy ? legacyNode(node.data) : { op: node.data.op, config: node.data.config };
  if (!isOpKind(kind.op)) throw new Error("不支持的节点类型。");
  const label = boundedText(node.data.label ?? spec(kind.op).title, 80);
  if (!draft && !label.trim()) throw new Error("节点名称不能为空。");
  return {
    id: identifier(node.id, "节点"),
    type: "op",
    position: { x: node.position.x as number, y: node.position.y as number },
    data: { op: kind.op, label, config: normalizeConfig(kind.op, kind.config ?? {}) },
  };
}

function decodePreview(value: unknown): Preview | undefined {
  if (!isRecord(value) || typeof value.total !== "number") return undefined;
  if ((value.type === "text" || value.type === "json") && typeof value.text === "string")
    return { type: value.type, text: value.text.slice(0, 4000), total: value.total };
  if (value.type === "table" && Array.isArray(value.columns) && Array.isArray(value.rows)) {
    const cell = (c: unknown): Cell =>
      c === null || typeof c === "boolean" || typeof c === "number" ? c : typeof c === "string" ? c.slice(0, 400) : null;
    return {
      type: "table",
      columns: value.columns.slice(0, 40).map((c) => String(c).slice(0, 200)),
      rows: value.rows.slice(0, 30).map((row) => (Array.isArray(row) ? row.slice(0, 40).map(cell) : [])),
      total: value.total,
    };
  }
  return undefined;
}

function decodeRun(value: unknown, ids: Set<string>): RunRecord | undefined {
  // 旧版运行记录（steps 数组）无法对应新节点，丢弃后需重新运行。
  if (!isRecord(value) || !isRecord(value.nodes) || typeof value.at !== "string") return undefined;
  const nodes: Record<string, NodeRun> = {};
  for (const [id, raw] of Object.entries(value.nodes)) {
    if (!ids.has(id) || !isRecord(raw)) continue;
    if (raw.status !== "ok" && raw.status !== "error" && raw.status !== "skipped") continue;
    nodes[id] = {
      status: raw.status,
      ms: typeof raw.ms === "number" && Number.isFinite(raw.ms) ? raw.ms : 0,
      sig: typeof raw.sig === "string" ? raw.sig.slice(0, 40) : "",
      summary: typeof raw.summary === "string" ? raw.summary.slice(0, 200) : "",
      ...(typeof raw.error === "string" ? { error: raw.error.slice(0, 1000) } : {}),
      ...(decodePreview(raw.preview) ? { preview: decodePreview(raw.preview) } : {}),
    };
  }
  return {
    at: value.at.slice(0, 40),
    ms: typeof value.ms === "number" && Number.isFinite(value.ms) ? value.ms : 0,
    nodes,
  };
}

function decode(value: unknown, draft: boolean): FlowDocument {
  if (!isRecord(value) || !Array.isArray(value.nodes) || !Array.isArray(value.edges))
    throw new Error("流水线需要 nodes 与 edges 数组。");
  if (value.nodes.length > MAX_NODES || value.edges.length > MAX_EDGES)
    throw new Error(`流水线最多 ${MAX_NODES} 个节点、${MAX_EDGES} 条连线。`);
  const nodes = value.nodes.map((node) => decodeNode(node, draft));
  const byId = new Map(nodes.map((node) => [node.id, node]));
  if (byId.size !== nodes.length) throw new Error("节点标识重复。");
  const taken = new Set<string>();
  const edges = value.edges.map((edge): PipelineEdge => {
    if (!isRecord(edge)) throw new Error("连线格式无效。");
    const source = byId.get(String(edge.source)),
      target = byId.get(String(edge.target));
    if (!source || !target || source === target) throw new Error("连线必须连接两个已有节点。");
    const sourceHandle = typeof edge.sourceHandle === "string" ? edge.sourceHandle : spec(source.data.op).outputs[0]?.id;
    const targetHandle = typeof edge.targetHandle === "string" ? edge.targetHandle : spec(target.data.op).inputs[0]?.id;
    if (!spec(source.data.op).outputs.some((port) => port.id === sourceHandle))
      throw new Error(`「${source.data.label}」没有输出端口 ${String(sourceHandle)}。`);
    if (!spec(target.data.op).inputs.some((port) => port.id === targetHandle))
      throw new Error(`「${target.data.label}」没有输入端口 ${String(targetHandle)}。`);
    const slot = target.id + ":" + targetHandle;
    if (taken.has(slot)) throw new Error(`「${target.data.label}」的同一输入端口只能连接一条线。`);
    taken.add(slot);
    return {
      id: identifier(edge.id, "连线"),
      source: source.id,
      sourceHandle: sourceHandle!,
      target: target.id,
      targetHandle: targetHandle!,
    };
  });
  if (new Set(edges.map((edge) => edge.id)).size !== edges.length) throw new Error("连线标识重复。");
  const lastRun = decodeRun(value.lastRun, new Set(byId.keys()));
  return { version: 2, nodes, edges, ...(lastRun ? { lastRun } : {}) };
}

export const validateFlow = (value: unknown): FlowDocument => decode(value, false);
/** 恢复工作副本：允许暂时为空的节点名称，结构与类型仍严格校验。 */
export const restoreFlowDraft = (value: unknown): FlowDocument => decode(value, true);
/** AI 生成的流水线不能携带运行记录。 */
export function validateGeneratedFlow(value: unknown): FlowDocument {
  if (!isRecord(value)) throw new Error("流水线配置无效。");
  return validateFlow({ nodes: value.nodes, edges: value.edges });
}

/** 结构签名：不含位置与运行记录。 */
export function signature(flow: FlowDocument) {
  return JSON.stringify({
    nodes: flow.nodes.map(({ id, data }) => ({ id, op: data.op, config: data.config })),
    edges: flow.edges.map(({ source, sourceHandle, target, targetHandle }) => ({ source, sourceHandle, target, targetHandle })),
  });
}

export const emptyFlow = (): FlowDocument => ({ version: 2, nodes: [], edges: [] });
