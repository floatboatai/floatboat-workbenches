// ABOUTME: 流水线执行引擎：拓扑排序与环检测、端口类型推断、连接校验，以及逐节点执行与计时。
import type { FlowDocument, NodeRun, PipelineEdge, PipelineNode, RunRecord, RunStatus } from "./flow.ts";
import { spec } from "./ops.ts";
import { runOp } from "./transforms.ts";
import { PipelineError, preview, summarize, typeLabels, type PortType, type Value } from "./values.ts";

export interface NodeResult {
  status: RunStatus;
  ms: number;
  error?: string;
  outputs: Record<string, Value>;
  view?: Value;
  summary: string;
}
export interface RunReport {
  at: string;
  ms: number;
  order: string[];
  results: Record<string, NodeResult>;
  sigs: Record<string, string>;
}

const now = () => globalThis.performance?.now() ?? Date.now();

/** Kahn 拓扑排序；剩余无法排序的节点位于环上或环的下游。 */
export function topoOrder(doc: Pick<FlowDocument, "nodes" | "edges">): { order: string[]; blocked: string[] } {
  const indegree = new Map(doc.nodes.map((node) => [node.id, 0]));
  const next = new Map<string, string[]>();
  for (const edge of doc.edges) {
    indegree.set(edge.target, (indegree.get(edge.target) ?? 0) + 1);
    next.set(edge.source, [...(next.get(edge.source) ?? []), edge.target]);
  }
  // 按画布位置（左→右、上→下）稳定排序，使执行顺序与阅读顺序一致。
  const position = new Map(doc.nodes.map((node) => [node.id, node.position]));
  const byPlace = (a: string, b: string) =>
    position.get(a)!.x - position.get(b)!.x || position.get(a)!.y - position.get(b)!.y || (a < b ? -1 : 1);
  const ready = doc.nodes.filter((node) => !indegree.get(node.id)).map((node) => node.id).sort(byPlace);
  const order: string[] = [];
  while (ready.length) {
    const id = ready.shift()!;
    order.push(id);
    for (const target of next.get(id) ?? []) {
      const left = indegree.get(target)! - 1;
      indegree.set(target, left);
      if (!left) {
        ready.push(target);
        ready.sort(byPlace);
      }
    }
  }
  const done = new Set(order);
  return { order, blocked: doc.nodes.filter((node) => !done.has(node.id)).map((node) => node.id) };
}

/** 找出真正处在环上的节点（可以从自身出发回到自身）。 */
export function cycleMembers(doc: Pick<FlowDocument, "nodes" | "edges">): Set<string> {
  const { blocked } = topoOrder(doc);
  const members = new Set<string>();
  for (const id of blocked) if (reaches(doc.edges, id, id)) members.add(id);
  return members;
}

function reaches(edges: PipelineEdge[], from: string, to: string): boolean {
  const stack = edges.filter((edge) => edge.source === from).map((edge) => edge.target);
  const seen = new Set<string>();
  while (stack.length) {
    const id = stack.pop()!;
    if (id === to) return true;
    if (seen.has(id)) continue;
    seen.add(id);
    for (const edge of edges) if (edge.source === id) stack.push(edge.target);
  }
  return false;
}

const incoming = (doc: Pick<FlowDocument, "edges">, id: string) => doc.edges.filter((edge) => edge.target === id);

/** 推断某个输出端口的数据类型；无法确定（未连接或环）时返回 null。 */
export function outputType(
  doc: Pick<FlowDocument, "nodes" | "edges">,
  nodeId: string,
  portId: string,
  visiting = new Set<string>(),
): PortType | null {
  const node = doc.nodes.find((item) => item.id === nodeId);
  const port = node && spec(node.data.op).outputs.find((item) => item.id === portId);
  if (!node || !port) return null;
  if (typeof port.type === "function") return port.type(node.data.config);
  if (port.type !== "same") return port.type;
  if (visiting.has(nodeId)) return null;
  visiting.add(nodeId);
  for (const edge of incoming(doc, nodeId)) {
    const type = outputType(doc, edge.source, edge.sourceHandle, visiting);
    if (type) return type;
  }
  return null;
}

export interface ConnectionCheck {
  ok: boolean;
  reason?: string;
}
/** 连接前检查：端口存在、类型兼容、不形成环。目标端口已有连线时允许替换。 */
export function checkConnection(
  doc: Pick<FlowDocument, "nodes" | "edges">,
  c: { source: string; sourceHandle?: string | null; target: string; targetHandle?: string | null },
): ConnectionCheck {
  if (c.source === c.target) return { ok: false, reason: "不能连接到节点自身。" };
  const source = doc.nodes.find((node) => node.id === c.source),
    target = doc.nodes.find((node) => node.id === c.target);
  if (!source || !target) return { ok: false, reason: "节点不存在。" };
  const input = spec(target.data.op).inputs.find((port) => port.id === (c.targetHandle ?? "in"));
  if (!input) return { ok: false, reason: `「${target.data.label}」没有这个输入端口。` };
  if (!spec(source.data.op).outputs.some((port) => port.id === (c.sourceHandle ?? "out")))
    return { ok: false, reason: `「${source.data.label}」没有这个输出端口。` };
  const without = doc.edges.filter((edge) => !(edge.target === c.target && edge.targetHandle === input.id));
  const type = outputType({ nodes: doc.nodes, edges: without }, c.source, c.sourceHandle ?? "out");
  if (type && !input.accepts.includes(type))
    return {
      ok: false,
      reason: `类型不匹配：「${source.data.label}」输出${typeLabels[type]}，「${target.data.label}」的${input.label}只接受${input.accepts.map((t) => typeLabels[t]).join("/")}。`,
    };
  if (reaches(without, c.target, c.source)) return { ok: false, reason: "这条连线会形成环。" };
  return { ok: true };
}

function hash(value: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < value.length; i++) {
    h ^= value.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(36);
}

/** 每个节点的配置+上游签名；用于判断运行结果是否过期（只影响改动节点及其下游）。 */
export function nodeSignatures(doc: Pick<FlowDocument, "nodes" | "edges">): Record<string, string> {
  const { order, blocked } = topoOrder(doc);
  const byId = new Map(doc.nodes.map((node) => [node.id, node]));
  const sigs: Record<string, string> = {};
  for (const id of order) {
    const node = byId.get(id)!;
    const upstream = incoming(doc, id)
      .map((edge) => `${edge.targetHandle}<${sigs[edge.source]}.${edge.sourceHandle}`)
      .sort()
      .join("|");
    sigs[id] = hash(node.data.op + JSON.stringify(node.data.config) + upstream);
  }
  for (const id of blocked) sigs[id] = "cycle";
  return sigs;
}

export interface RunHooks {
  onNodeStart?: (id: string) => void;
  onNodeDone?: (id: string, result: NodeResult) => void;
}

export function runPipeline(doc: FlowDocument, hooks: RunHooks = {}): RunReport {
  const started = now();
  const { order, blocked } = topoOrder(doc);
  const cycle = cycleMembers(doc);
  const byId = new Map<string, PipelineNode>(doc.nodes.map((node) => [node.id, node]));
  const results: Record<string, NodeResult> = {};
  const fail = (error: string, status: RunStatus = "error"): NodeResult => ({ status, ms: 0, error, outputs: {}, summary: status === "error" ? "失败" : "已跳过" });
  for (const id of order) {
    const node = byId.get(id)!;
    const op = spec(node.data.op);
    const inputs: Record<string, Value | undefined> = {};
    let problem: NodeResult | null = null;
    for (const port of op.inputs) {
      const edge = doc.edges.find((item) => item.target === id && item.targetHandle === port.id);
      if (!edge) {
        problem = fail(`「${port.label}」端口没有连接。`);
        break;
      }
      const upstream = results[edge.source];
      if (!upstream || upstream.status !== "ok") {
        problem = fail(`上游「${byId.get(edge.source)?.data.label ?? edge.source}」未成功，已跳过。`, "skipped");
        break;
      }
      const value = upstream.outputs[edge.sourceHandle];
      if (!value) {
        problem = fail(`上游没有产生「${edge.sourceHandle}」输出。`);
        break;
      }
      if (!port.accepts.includes(value.type)) {
        problem = fail(`类型不匹配：${port.label}只接受${port.accepts.map((t) => typeLabels[t]).join("/")}，收到${typeLabels[value.type]}。`);
        break;
      }
      inputs[port.id] = value;
    }
    if (problem) {
      results[id] = problem;
      hooks.onNodeDone?.(id, problem);
      continue;
    }
    hooks.onNodeStart?.(id);
    const t0 = now();
    try {
      const result = runOp(node.data.op, node.data.config, inputs);
      const shown = result.view ?? result.outputs.out ?? Object.values(result.outputs)[0];
      results[id] = {
        status: "ok",
        ms: now() - t0,
        outputs: result.outputs,
        ...(result.view ? { view: result.view } : {}),
        summary: shown ? summarize(shown) : "完成",
      };
    } catch (error) {
      results[id] = {
        ...fail(error instanceof PipelineError || error instanceof Error ? error.message : "运行失败。"),
        ms: now() - t0,
      };
    }
    hooks.onNodeDone?.(id, results[id]);
  }
  for (const id of blocked) {
    results[id] = cycle.has(id)
      ? fail("节点处在环中：请删除形成回路的连线。")
      : fail("上游存在环，已跳过。", "skipped");
    hooks.onNodeDone?.(id, results[id]);
  }
  return { at: new Date().toISOString(), ms: now() - started, order: [...order, ...blocked], results, sigs: nodeSignatures(doc) };
}

/** 把运行报告压缩为可随流水线保存的记录（每节点小预览）。 */
export function toRunRecord(report: RunReport): RunRecord {
  const nodes: Record<string, NodeRun> = {};
  for (const [id, result] of Object.entries(report.results)) {
    const shown = result.view ?? result.outputs.out ?? Object.values(result.outputs)[0];
    nodes[id] = {
      status: result.status,
      ms: Math.round(result.ms * 100) / 100,
      sig: report.sigs[id] ?? "",
      summary: result.summary,
      ...(result.error ? { error: result.error } : {}),
      ...(shown ? { preview: preview(shown, 12, 1200) } : {}),
    };
  }
  return { at: report.at, ms: Math.round(report.ms * 100) / 100, nodes };
}
