// ABOUTME: ComfyUI 界面工作流（litegraph v0.4 序列化）的宽松类型、校验与节点构造器。

import { isRecord } from "./project.ts";
import { isImageSink, widgetLayout, type NodeDef } from "./comfy.ts";

export type NodeId = number | string;
export interface UiSlotInput {
  name: string;
  type: string;
  link: number | null;
  widget?: { name: string };
  label?: string;
  localized_name?: string;
  shape?: number;
  [key: string]: unknown;
}
export interface UiSlotOutput {
  name: string;
  type: string;
  links: number[] | null;
  slot_index?: number;
  label?: string;
  localized_name?: string;
  shape?: number;
  [key: string]: unknown;
}
export interface UiNode {
  id: NodeId;
  type: string;
  pos: [number, number];
  size: [number, number] | Record<string, number>;
  flags: Record<string, unknown>;
  order?: number;
  mode: number;
  inputs?: UiSlotInput[];
  outputs?: UiSlotOutput[];
  properties?: Record<string, unknown>;
  widgets_values?: unknown;
  title?: string;
  color?: string;
  bgcolor?: string;
  [key: string]: unknown;
}
export type UiLinkTuple = [number, NodeId, number, NodeId, number, string];
export interface UiLinkObject {
  id: number;
  origin_id: NodeId;
  origin_slot: number;
  target_id: NodeId;
  target_slot: number;
  type: string;
}
export interface UiGroup {
  id?: number;
  title: string;
  bounding: [number, number, number, number];
  color?: string;
  font_size?: number;
  flags?: Record<string, unknown>;
}
export interface UiWorkflow {
  id?: string;
  revision?: number;
  last_node_id: number;
  last_link_id: number;
  nodes: UiNode[];
  links: (UiLinkTuple | UiLinkObject)[];
  groups: UiGroup[];
  config: Record<string, unknown>;
  extra: Record<string, unknown> & { ds?: { scale: number; offset: [number, number] } };
  version: number;
  [key: string]: unknown;
}

export const MAX_WORKFLOW_BYTES = 880_000;

export function emptyWorkflow(): UiWorkflow {
  return { last_node_id: 0, last_link_id: 0, nodes: [], links: [], groups: [], config: {}, extra: {}, version: 0.4 };
}

const isId = (v: unknown): v is NodeId => typeof v === "number" || (typeof v === "string" && v.length > 0 && v.length < 100);

export function normaliseLink(raw: unknown): UiLinkObject | null {
  if (Array.isArray(raw) && raw.length >= 5 && isId(raw[1]) && isId(raw[3]) && typeof raw[0] === "number")
    return {
      id: raw[0],
      origin_id: raw[1],
      origin_slot: Number(raw[2]),
      target_id: raw[3],
      target_slot: Number(raw[4]),
      type: typeof raw[5] === "string" ? raw[5] : "*",
    };
  if (isRecord(raw) && typeof raw.id === "number" && isId(raw.origin_id) && isId(raw.target_id))
    return {
      id: raw.id,
      origin_id: raw.origin_id,
      origin_slot: Number(raw.origin_slot),
      target_id: raw.target_id,
      target_slot: Number(raw.target_slot),
      type: typeof raw.type === "string" ? raw.type : "*",
    };
  return null;
}

/**
 * Structural check for a workflow coming from import, a saved draft or the server. It keeps
 * unknown node types and unconnected inputs: those are reported by validation, not rejected.
 */
export function checkWorkflow(value: unknown): UiWorkflow {
  if (!isRecord(value) || !Array.isArray(value.nodes))
    throw new Error("不是 ComfyUI 工作流：缺少 nodes 数组。");
  if (value.nodes.length > 5000) throw new Error("节点超过 5000 个。");
  const seen = new Set<string>();
  for (const node of value.nodes) {
    if (!isRecord(node) || !isId(node.id) || typeof node.type !== "string" || !node.type)
      throw new Error("工作流中的节点缺少 id 或 type。");
    if (seen.has(String(node.id))) throw new Error(`节点 id ${String(node.id)} 重复。`);
    seen.add(String(node.id));
  }
  const links = Array.isArray(value.links) ? value.links.filter((l) => normaliseLink(l)) : [];
  const out = {
    ...value,
    last_node_id:
      typeof value.last_node_id === "number"
        ? value.last_node_id
        : isRecord(value.state) && typeof value.state.lastNodeId === "number"
          ? value.state.lastNodeId
          : maxNumeric(value.nodes.map((n) => n.id)),
    last_link_id:
      typeof value.last_link_id === "number"
        ? value.last_link_id
        : isRecord(value.state) && typeof value.state.lastLinkId === "number"
          ? value.state.lastLinkId
          : maxNumeric(links.map((l) => normaliseLink(l)?.id)),
    links,
    groups: Array.isArray(value.groups) ? value.groups.filter(isRecord) : [],
    config: isRecord(value.config) ? value.config : {},
    extra: isRecord(value.extra) ? value.extra : {},
    version: typeof value.version === "number" ? value.version : 0.4,
  } as unknown as UiWorkflow;
  return out;
}

function maxNumeric(ids: unknown[]): number {
  let max = 0;
  for (const id of ids) if (typeof id === "number" && id > max) max = id;
  return max;
}

export function sizeOfNode(node: UiNode): [number, number] {
  const s = node.size;
  if (Array.isArray(s)) return [Number(s[0]) || 200, Number(s[1]) || 80];
  return [Number(s?.["0"]) || 200, Number(s?.["1"]) || 80];
}

/** Rough node size from slots and widgets, close to what the canvas computes. */
export function estimateSize(def: NodeDef, layout = widgetLayout(def)): [number, number] {
  const sockets = def.inputs.filter((i) => !layout.some((w) => w.input === i)).length;
  const rows = Math.max(sockets, def.output.length, 1);
  let widgets = 0;
  for (const w of layout) widgets += w.kind === "string" && w.input.config.multiline === true ? 112 : 24;
  const wide = layout.some((w) => w.kind === "string" && w.input.config.multiline === true);
  const preview = isImageSink(def) ? 190 : 0;
  return [wide ? 340 : 270, 30 + rows * 22 + widgets + 16 + preview];
}

export interface BuiltNode {
  node: UiNode;
  def: NodeDef;
}

export function buildNode(
  def: NodeDef,
  id: number,
  pos: [number, number],
  values: Record<string, unknown> = {},
  extra: Partial<UiNode> = {},
): UiNode {
  const layout = widgetLayout(def);
  const widgetNames = new Set(layout.map((w) => w.name));
  const widgets_values = layout.map((w) => (w.name in values && w.kind !== "upload" ? values[w.name] : w.default));
  const hasWidgets = layout.length > 0;
  return {
    id,
    type: def.name,
    pos,
    size: estimateSize(def, layout),
    flags: {},
    order: 0,
    mode: 0,
    inputs: def.inputs.map((input) => ({
      name: input.name,
      type: input.type,
      link: null,
      ...(widgetNames.has(input.name) && layout.find((w) => w.input === input && w.kind !== "control" && w.kind !== "upload")
        ? { widget: { name: input.name } }
        : {}),
    })),
    outputs: def.output.map((type, slot) => ({
      name: def.output_name[slot] ?? type,
      type,
      links: null,
      slot_index: slot,
    })),
    properties: { "Node name for S&R": def.name },
    ...(hasWidgets ? { widgets_values } : {}),
    ...extra,
  };
}

/** Adds a link to the workflow's arrays and the endpoints' slot bookkeeping. */
export function connect(
  workflow: UiWorkflow,
  from: UiNode,
  fromSlot: number,
  to: UiNode,
  toSlot: number,
): void {
  const id = ++workflow.last_link_id;
  const type = from.outputs?.[fromSlot]?.type ?? "*";
  workflow.links.push([id, from.id, fromSlot, to.id, toSlot, type] as UiLinkTuple);
  const out = from.outputs?.[fromSlot];
  if (out) out.links = [...(out.links ?? []), id];
  const input = to.inputs?.[toSlot];
  if (input) input.link = id;
}

export function nodeTitle(node: UiNode, defs: Record<string, NodeDef>): string {
  return node.title || defs[node.type]?.display_name || node.type;
}
