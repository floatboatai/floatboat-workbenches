// ABOUTME: 离线校验：缺失输入、类型不符、未知节点、无输出节点、范围与枚举；并映射服务端 node_errors。

import { isRecord } from "./project.ts";
import { isVirtualType, typesCompatible, widgetKind, type InputSpec, type NodeDef, type NodeDefs } from "./comfy.ts";
import { MODE_BYPASS, MODE_NEVER } from "./comfy.ts";
import { indexGraph, isExecutable, resolveLink, widgetValues, type GraphIndex } from "./convert.ts";
import type { UiNode, UiWorkflow } from "./workflow.ts";

export type Severity = "error" | "warning" | "info";
export interface Problem {
  id: string;
  severity: Severity;
  code: string;
  nodeId: string | null;
  input: string | null;
  message: string;
  source: "local" | "server";
}

export interface ValidateOptions {
  /** True when combo lists come from the connected server (so a missing option is a real error). */
  authoritativeCombos: boolean;
}

const problem = (
  severity: Severity,
  code: string,
  nodeId: string | null,
  input: string | null,
  message: string,
  source: Problem["source"] = "local",
): Problem => ({ id: `${source}:${code}:${nodeId ?? "-"}:${input ?? "-"}`, severity, code, nodeId, input, message, source });

function upstreamOutputType(graph: GraphIndex, linkId: number, defs: NodeDefs, resolvedId: string, slot: number): string {
  const node = graph.nodes.get(resolvedId);
  const out = node?.outputs?.[slot]?.type ?? defs[node?.type ?? ""]?.output[slot];
  void linkId;
  return out ?? "*";
}

function checkWidget(
  node: UiNode,
  spec: InputSpec,
  value: unknown,
  opts: ValidateOptions,
  id: string,
  severity: Severity,
): Problem | null {
  const kind = widgetKind(spec);
  const name = spec.name;
  const bad = (msg: string, code = "invalid_value") => problem(severity, code, id, name, `${name}：${msg}`);
  if (kind === "int" || kind === "float") {
    if (typeof value !== "number" || !Number.isFinite(value)) return bad("需要数字", "invalid_type");
    if (kind === "int" && !Number.isInteger(value)) return bad("需要整数", "invalid_type");
    if (typeof spec.config.min === "number" && value < spec.config.min) return bad(`${value} 小于最小值 ${spec.config.min}`, "value_smaller_than_min");
    if (typeof spec.config.max === "number" && value > spec.config.max) return bad(`${value} 大于最大值 ${spec.config.max}`, "value_bigger_than_max");
  } else if (kind === "boolean") {
    if (typeof value !== "boolean") return bad("需要布尔值", "invalid_type");
  } else if (kind === "string") {
    if (typeof value !== "string") return bad("需要文本", "invalid_type");
  } else if (kind === "combo") {
    const options = spec.options ?? [];
    if (opts.authoritativeCombos && !options.includes(String(value))) {
      const hint = options.length ? "" : "（服务器没有提供可选项，例如尚未放入模型文件）";
      return problem(severity, "value_not_in_list", id, name, `${name}：“${String(value)}” 不在服务器的可选项中${hint}`);
    }
    if (value === undefined || value === null || value === "") return bad("尚未选择", "value_not_in_list");
  }
  void node;
  return null;
}

function reachableFromOutputs(workflow: UiWorkflow, graph: GraphIndex, defs: NodeDefs): Set<string> {
  const seen = new Set<string>();
  const stack: string[] = [];
  for (const node of workflow.nodes)
    if (isExecutable(node) && (defs[node.type]?.output_node ?? false)) stack.push(String(node.id));
  while (stack.length) {
    const id = stack.pop()!;
    if (seen.has(id)) continue;
    seen.add(id);
    for (const input of graph.nodes.get(id)?.inputs ?? []) {
      const r = resolveLink(graph, input.link, defs);
      if (r.kind === "node") stack.push(r.id);
    }
  }
  return seen;
}

function findCycle(workflow: UiWorkflow, graph: GraphIndex): string | null {
  const state = new Map<string, 1 | 2>();
  const visit = (id: string): string | null => {
    if (state.get(id) === 2) return null;
    if (state.get(id) === 1) return id;
    state.set(id, 1);
    for (const input of graph.nodes.get(id)?.inputs ?? []) {
      const link = input.link !== null && input.link !== undefined ? graph.links.get(input.link) : undefined;
      if (link) {
        const hit = visit(String(link.origin_id));
        if (hit) return hit;
      }
    }
    state.set(id, 2);
    return null;
  };
  for (const node of workflow.nodes) {
    const hit = visit(String(node.id));
    if (hit) return hit;
  }
  return null;
}

export function validateWorkflow(workflow: UiWorkflow, defs: NodeDefs, opts: ValidateOptions): Problem[] {
  const graph = indexGraph(workflow),
    out: Problem[] = [],
    reach = reachableFromOutputs(workflow, graph, defs);
  const hasOutput = workflow.nodes.some((n) => isExecutable(n) && defs[n.type]?.output_node);
  if (!workflow.nodes.length) return [problem("info", "empty", null, null, "画布为空：从左侧节点库添加节点，或双击画布搜索。")];
  if (!hasOutput)
    out.push(problem("error", "no_output", null, null, "没有可执行的输出节点（例如“保存图像”“预览图像”）；提示词不会产生结果。"));
  const cycle = findCycle(workflow, graph);
  if (cycle) out.push(problem("error", "cycle", cycle, null, "连线形成了环，ComfyUI 无法执行。"));
  if (isRecord(workflow.definitions) && Array.isArray((workflow.definitions as Record<string, unknown>).subgraphs))
    out.push(problem("warning", "subgraph", null, null, "工作流包含子图；画布保留它们，但 API 导出与运行暂不展开子图。"));
  for (const node of workflow.nodes) {
    const id = String(node.id);
    if (isVirtualType(node.type)) continue;
    const severity: Severity = reach.has(id) ? "error" : "warning";
    const def: NodeDef | undefined = defs[node.type];
    if (!def) {
      out.push(problem(severity === "error" ? "error" : "warning", "missing_node", id, null, `未知节点类型“${node.type}”：当前节点定义里没有它（缺少自定义节点？）。数据已保留。`));
      continue;
    }
    if (node.mode === MODE_NEVER || node.mode === MODE_BYPASS) continue;
    const values = widgetValues(node, def);
    for (const spec of def.inputs) {
      const slot = node.inputs?.find((i) => i.name === spec.name);
      const linked = slot?.link !== null && slot?.link !== undefined;
      const isWidget = widgetKind(spec) !== null;
      if (linked) {
        const r = resolveLink(graph, slot!.link, defs);
        if (r.kind === "node") {
          const from = upstreamOutputType(graph, slot!.link!, defs, r.id, r.slot);
          if (!typesCompatible(from, spec.type))
            out.push(problem(severity, "type_mismatch", id, spec.name, `${spec.name}：需要 ${spec.type}，连入的是 ${from}。`));
        } else if (r.kind === "none") {
          const why = r.reason === "muted" ? "上游节点已静音" : r.reason === "dead-end" ? "绕过/转接后没有可用的上游" : "连线无法解析";
          if (spec.required || isWidget) out.push(problem(severity, "dangling_link", id, spec.name, `${spec.name}：${why}。`));
        }
        continue;
      }
      if (isWidget) {
        const p = checkWidget(node, spec, values[spec.name], opts, id, severity);
        if (p) out.push(p);
      } else if (spec.required) {
        out.push(problem(severity, "required_input_missing", id, spec.name, `缺少必填输入“${spec.name}”（${spec.type}）。`));
      }
    }
    if (def.deprecated) out.push(problem("info", "deprecated", id, null, `${def.display_name} 已被标记为弃用。`));
  }
  return out.sort((a, b) => rank(a.severity) - rank(b.severity));
}
const rank = (s: Severity) => (s === "error" ? 0 : s === "warning" ? 1 : 2);

/** Maps the `{error, node_errors}` body of a rejected POST /prompt onto problems. */
export function problemsFromServer(body: unknown): Problem[] {
  if (!isRecord(body)) return [];
  const out: Problem[] = [];
  if (isRecord(body.error)) {
    const e = body.error;
    const perNode = isRecord(body.node_errors) && Object.keys(body.node_errors).length > 0;
    const msg = [e.message, perNode ? "" : e.details].filter((x): x is string => typeof x === "string" && x.length > 0).join("：");
    out.push(problem("error", String(e.type ?? "server_error"), null, null, msg || "服务器拒绝了提示词。", "server"));
  }
  if (isRecord(body.node_errors)) {
    for (const [id, entry] of Object.entries(body.node_errors)) {
      if (!isRecord(entry) || !Array.isArray(entry.errors)) continue;
      for (const err of entry.errors) {
        if (!isRecord(err)) continue;
        const info = isRecord(err.extra_info) ? err.extra_info : {};
        const input = typeof info.input_name === "string" ? info.input_name : null;
        const msg = [err.message, err.details].filter((x): x is string => typeof x === "string" && x.length > 0).join("：");
        out.push(problem("error", String(err.type ?? "node_error"), id, input, msg || "节点校验失败", "server"));
      }
    }
  }
  return out;
}

export function problemsByNode(problems: Problem[]): Map<string, Problem[]> {
  const map = new Map<string, Problem[]>();
  for (const p of problems) if (p.nodeId) map.set(p.nodeId, [...(map.get(p.nodeId) ?? []), p]);
  return map;
}
