// ABOUTME: 界面工作流与 ComfyUI API 提示词互转，含 Reroute、静音、绕过与 Primitive 解析。

import { isRecord } from "./project.ts";
import {
  MODE_BYPASS,
  MODE_NEVER,
  isVirtualType,
  typesCompatible,
  widgetLayout,
  type NodeDef,
  type NodeDefs,
} from "./comfy.ts";
import {
  buildNode,
  connect,
  emptyWorkflow,
  estimateSize,
  normaliseLink,
  type UiLinkObject,
  type UiNode,
  type UiWorkflow,
} from "./workflow.ts";

export interface ApiNode {
  class_type: string;
  inputs: Record<string, unknown>;
  _meta?: { title?: string };
}
export type ApiPrompt = Record<string, ApiNode>;

/** Where an input value comes from after reroutes, bypassed and primitive nodes are looked through. */
export type Resolved =
  | { kind: "node"; id: string; slot: number }
  | { kind: "value"; value: unknown }
  | { kind: "none"; reason: "unlinked" | "muted" | "dead-end" | "cycle" | "missing" };

export interface GraphIndex {
  nodes: Map<string, UiNode>;
  links: Map<number, UiLinkObject>;
}

export function indexGraph(workflow: UiWorkflow): GraphIndex {
  const nodes = new Map<string, UiNode>(),
    links = new Map<number, UiLinkObject>();
  for (const node of workflow.nodes) nodes.set(String(node.id), node);
  for (const raw of workflow.links) {
    const link = normaliseLink(raw);
    if (link) links.set(link.id, link);
  }
  return { nodes, links };
}

export function widgetValues(node: UiNode, def: NodeDef): Record<string, unknown> {
  const layout = widgetLayout(def),
    raw = node.widgets_values,
    out: Record<string, unknown> = {};
  if (isRecord(raw)) {
    for (const w of layout) if (w.kind !== "control" && w.kind !== "upload" && w.name in raw) out[w.name] = raw[w.name];
    return out;
  }
  const list = Array.isArray(raw) ? raw : [];
  layout.forEach((w, i) => {
    if (w.kind === "control" || w.kind === "upload") return;
    out[w.name] = i < list.length ? list[i] : w.default;
  });
  return out;
}

const firstInput = (node: UiNode) => node.inputs?.find((i) => i.link !== null && i.link !== undefined);

/** Follows a link upstream through reroutes, bypassed nodes and primitive nodes. */
export function resolveLink(graph: GraphIndex, linkId: number | null | undefined, defs: NodeDefs): Resolved {
  let current = linkId;
  for (let hops = 0; hops < 200; hops++) {
    if (current === null || current === undefined) return { kind: "none", reason: "unlinked" };
    const link = graph.links.get(current);
    if (!link) return { kind: "none", reason: "missing" };
    const origin = graph.nodes.get(String(link.origin_id));
    if (!origin) return { kind: "none", reason: "missing" };
    if (origin.mode === MODE_NEVER) return { kind: "none", reason: "muted" };
    if (origin.type === "Reroute") {
      current = origin.inputs?.[0]?.link ?? null;
      if (current === null) return { kind: "none", reason: "dead-end" };
      continue;
    }
    if (origin.type === "PrimitiveNode") {
      const v = Array.isArray(origin.widgets_values) ? origin.widgets_values[0] : undefined;
      return { kind: "value", value: v };
    }
    if (isVirtualType(origin.type)) return { kind: "none", reason: "dead-end" };
    if (origin.mode === MODE_BYPASS) {
      const slotType = link.type ?? origin.outputs?.[link.origin_slot]?.type ?? "*";
      const inputs = origin.inputs ?? [];
      let pass = inputs[link.origin_slot];
      if (!pass || !typesCompatible(slotType, pass.type) || (pass.link ?? null) === null)
        pass = inputs.find((i) => i.link !== null && i.link !== undefined && typesCompatible(slotType, i.type)) as
          typeof pass;
      if (!pass || pass.link === null || pass.link === undefined) return { kind: "none", reason: "dead-end" };
      current = pass.link;
      continue;
    }
    if (!defs[origin.type] && !origin.properties?.__apiInputs && origin.type) {
      /* unknown node still addresses the server by class_type */
    }
    return { kind: "node", id: String(origin.id), slot: link.origin_slot };
  }
  return { kind: "none", reason: "cycle" };
}

export const isExecutable = (node: UiNode) =>
  !isVirtualType(node.type) && node.mode !== MODE_NEVER && node.mode !== MODE_BYPASS;

export interface PromptConversion {
  prompt: ApiPrompt;
  /** Human readable remarks, e.g. unknown nodes whose widget values could not be mapped. */
  notes: string[];
}

/** Converts the editor graph to the API prompt the ComfyUI server executes. */
export function toApiPrompt(workflow: UiWorkflow, defs: NodeDefs): PromptConversion {
  const graph = indexGraph(workflow),
    prompt: ApiPrompt = {},
    notes: string[] = [];
  for (const node of workflow.nodes) {
    if (!isExecutable(node)) continue;
    const def = defs[node.type],
      inputs: Record<string, unknown> = {};
    if (def) Object.assign(inputs, widgetValues(node, def));
    else if (isRecord(node.properties?.__apiInputs)) Object.assign(inputs, node.properties.__apiInputs);
    else notes.push(`${node.type} #${node.id}：节点定义缺失，只能导出连线输入。`);
    for (const input of node.inputs ?? []) {
      if (input.link === null || input.link === undefined) continue;
      const r = resolveLink(graph, input.link, defs);
      if (r.kind === "node") inputs[input.name] = [r.id, r.slot];
      else if (r.kind === "value") inputs[input.name] = r.value;
      else delete inputs[input.name];
    }
    prompt[String(node.id)] = {
      class_type: node.type,
      inputs,
      _meta: { title: node.title || def?.display_name || node.type },
    };
  }
  for (const entry of Object.values(prompt))
    for (const [name, value] of Object.entries(entry.inputs))
      if (Array.isArray(value) && value.length === 2 && typeof value[0] === "string" && !prompt[value[0]])
        delete entry.inputs[name];
  return { prompt, notes };
}

const isLinkValue = (v: unknown): v is [string | number, number] =>
  Array.isArray(v) && v.length === 2 && (typeof v[0] === "string" || typeof v[0] === "number") && typeof v[1] === "number";

export function checkPrompt(value: unknown): ApiPrompt {
  if (!isRecord(value) || !Object.keys(value).length) throw new Error("API 提示词应为非空对象。");
  const out: ApiPrompt = {};
  for (const [id, node] of Object.entries(value)) {
    if (!isRecord(node) || typeof node.class_type !== "string" || !node.class_type)
      throw new Error(`节点 ${id} 缺少 class_type。`);
    out[id] = {
      class_type: node.class_type,
      inputs: isRecord(node.inputs) ? { ...node.inputs } : {},
      ...(isRecord(node._meta) ? { _meta: { title: typeof node._meta.title === "string" ? node._meta.title : undefined } } : {}),
    };
  }
  return out;
}

/** Recognises API-format JSON (`{id: {class_type, inputs}}`), optionally wrapped as `{prompt: ...}`. */
export function looksLikePrompt(value: unknown): ApiPrompt | null {
  const candidate = isRecord(value) && isRecord(value.prompt) && !("nodes" in value) ? value.prompt : value;
  if (!isRecord(candidate) || "nodes" in candidate) return null;
  const entries = Object.values(candidate);
  if (!entries.length || !entries.every((n) => isRecord(n) && typeof n.class_type === "string")) return null;
  try {
    return checkPrompt(candidate);
  } catch {
    return null;
  }
}

/** Builds an editable workflow (with auto layout) from an API prompt. Unknown classes keep their raw inputs. */
export function fromApiPrompt(prompt: ApiPrompt, defs: NodeDefs): UiWorkflow {
  const wf = emptyWorkflow();
  const ids = Object.keys(prompt);
  const numeric = (id: string) => (/^\d+$/.test(id) ? Number(id) : null);
  const used = new Set<number>();
  const uiId = new Map<string, number>();
  let next = Math.max(0, ...ids.map((id) => numeric(id) ?? 0));
  for (const id of ids) {
    let n = numeric(id);
    if (n === null || used.has(n)) n = ++next;
    used.add(n);
    uiId.set(id, n);
  }
  // depth = longest path from a source node
  const depth = new Map<string, number>();
  const visiting = new Set<string>();
  const depthOf = (id: string): number => {
    if (depth.has(id)) return depth.get(id)!;
    if (visiting.has(id)) return 0;
    visiting.add(id);
    let d = 0;
    for (const v of Object.values(prompt[id].inputs))
      if (isLinkValue(v) && prompt[String(v[0])]) d = Math.max(d, depthOf(String(v[0])) + 1);
    visiting.delete(id);
    depth.set(id, d);
    return d;
  };
  ids.forEach(depthOf);
  const columns = new Map<number, string[]>();
  for (const id of ids) columns.set(depth.get(id)!, [...(columns.get(depth.get(id)!) ?? []), id]);
  const built = new Map<string, UiNode>();
  const colX = new Map<number, number>();
  let x = 0;
  for (const d of [...columns.keys()].sort((a, b) => a - b)) {
    colX.set(d, x);
    let y = 0,
      width = 0;
    for (const id of columns.get(d)!) {
      const entry = prompt[id],
        def = defs[entry.class_type];
      const n = uiId.get(id)!;
      let node: UiNode;
      if (def) {
        const values: Record<string, unknown> = {};
        for (const input of def.inputs) if (input.name in entry.inputs && !isLinkValue(entry.inputs[input.name])) values[input.name] = entry.inputs[input.name];
        node = buildNode(def, n, [x, y], values);
        const widgets = widgetLayout(def);
        node.widgets_values = widgets.map((w) =>
          w.kind === "control" ? "fixed" : w.name in values ? values[w.name] : w.default,
        );
        node.size = estimateSize(def, widgets);
      } else {
        const raw: Record<string, unknown> = {};
        const inputs: UiNode["inputs"] = [];
        for (const [name, v] of Object.entries(entry.inputs)) {
          if (isLinkValue(v)) inputs.push({ name, type: "*", link: null });
          else raw[name] = v;
        }
        node = {
          id: n,
          type: entry.class_type,
          pos: [x, y],
          size: [320, 60 + inputs.length * 20 + Object.keys(raw).length * 4],
          flags: {},
          order: 0,
          mode: 0,
          inputs,
          outputs: [],
          properties: { "Node name for S&R": entry.class_type, __apiInputs: raw },
        };
      }
      if (entry._meta?.title && entry._meta.title !== (def?.display_name ?? entry.class_type)) node.title = entry._meta.title;
      built.set(id, node);
      const size = node.size as [number, number];
      y += size[1] + 50;
      width = Math.max(width, size[0]);
      wf.nodes.push(node);
    }
    x += width + 56;
  }
  // links
  for (const id of ids) {
    const target = built.get(id)!;
    for (const [name, v] of Object.entries(prompt[id].inputs)) {
      if (!isLinkValue(v)) continue;
      const source = built.get(String(v[0]));
      if (!source) continue;
      const slot = target.inputs?.findIndex((i) => i.name === name) ?? -1;
      if (slot < 0) continue;
      const outs = source.outputs ?? [];
      while (outs.length <= v[1]) outs.push({ name: String(outs.length), type: "*", links: null, slot_index: outs.length });
      source.outputs = outs;
      if (target.inputs![slot].type === "*") target.inputs![slot].type = outs[v[1]].type;
      connect(wf, source, v[1], target, slot);
    }
  }
  wf.last_node_id = Math.max(0, ...wf.nodes.map((n) => Number(n.id)));
  const order = [...ids].sort((a, b) => depth.get(a)! - depth.get(b)!);
  order.forEach((id, i) => (built.get(id)!.order = i));
  return wf;
}
