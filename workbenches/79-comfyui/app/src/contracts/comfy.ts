// ABOUTME: ComfyUI 节点定义（/object_info）的类型、规范化与控件布局，页面与服务端共用。

import { isRecord } from "./project.ts";

export const MODE_ALWAYS = 0;
export const MODE_NEVER = 2;
export const MODE_BYPASS = 4;
export const SEED_CONTROLS = ["fixed", "increment", "decrement", "randomize"] as const;
export type SeedControl = (typeof SEED_CONTROLS)[number];
/** Highest integer a JS number holds exactly; ComfyUI's 64-bit seed range is clamped to it. */
export const SAFE_MAX = Number.MAX_SAFE_INTEGER;

/** Nodes that only exist in the editor and never reach the server prompt. */
export const VIRTUAL_TYPES = new Set(["Reroute", "PrimitiveNode", "Note", "MarkdownNote"]);
export const isVirtualType = (type: string) => VIRTUAL_TYPES.has(type);

export interface InputConfig {
  default?: unknown;
  min?: number;
  max?: number;
  step?: number;
  round?: number | false;
  multiline?: boolean;
  forceInput?: boolean;
  tooltip?: string;
  control_after_generate?: boolean;
  image_upload?: boolean;
  dynamicPrompts?: boolean;
  placeholder?: string;
  label_on?: string;
  label_off?: string;
  [key: string]: unknown;
}

export interface InputSpec {
  name: string;
  /** Socket type; combos are "COMBO". */
  type: string;
  /** Present for combo inputs. */
  options: string[] | null;
  config: InputConfig;
  required: boolean;
}

export interface NodeDef {
  name: string;
  display_name: string;
  description: string;
  category: string;
  python_module: string;
  inputs: InputSpec[];
  /** Hidden inputs (PROMPT, UNIQUE_ID, ...) are never shown or serialised by the editor. */
  hidden: string[];
  output: string[];
  output_is_list: boolean[];
  output_name: string[];
  output_tooltips: string[];
  output_node: boolean;
  search_aliases: string[];
  deprecated: boolean;
  experimental: boolean;
}
export type NodeDefs = Record<string, NodeDef>;

const strings = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : []);
const primitiveTypes = new Set(["INT", "FLOAT", "STRING", "BOOLEAN"]);

function parseSpec(name: string, raw: unknown, required: boolean): InputSpec | null {
  if (!Array.isArray(raw) || raw.length < 1) return null;
  const [kind, cfg] = raw as [unknown, unknown];
  const config: InputConfig = isRecord(cfg) ? { ...cfg } : {};
  if (Array.isArray(kind)) {
    return { name, type: "COMBO", options: kind.map(String), config, required };
  }
  if (typeof kind !== "string") return null;
  if (kind === "COMBO") {
    const options = Array.isArray(config.options)
      ? config.options
      : Array.isArray(config.values)
        ? config.values
        : [];
    return { name, type: "COMBO", options: options.map(String), config, required };
  }
  return { name, type: kind, options: null, config, required };
}

function outputType(value: unknown): string {
  return typeof value === "string" ? value : Array.isArray(value) ? "COMBO" : "*";
}

/** Converts one /object_info entry; returns null when it has no usable name. */
export function parseNodeDef(key: string, raw: unknown): NodeDef | null {
  if (!isRecord(raw)) return null;
  const input = isRecord(raw.input) ? raw.input : {};
  const order = isRecord(raw.input_order) ? raw.input_order : {};
  const inputs: InputSpec[] = [];
  for (const group of ["required", "optional"] as const) {
    const specs = isRecord(input[group]) ? input[group] : {};
    const names = [...new Set([...strings(order[group]), ...Object.keys(specs)])];
    for (const name of names) {
      const spec = parseSpec(name, specs[name], group === "required");
      if (spec) inputs.push(spec);
    }
  }
  const output = Array.isArray(raw.output) ? raw.output.map(outputType) : [];
  const name = typeof raw.name === "string" && raw.name ? raw.name : key;
  return {
    name,
    display_name: typeof raw.display_name === "string" && raw.display_name ? raw.display_name : name,
    description: typeof raw.description === "string" ? raw.description : "",
    category: typeof raw.category === "string" ? raw.category : "",
    python_module: typeof raw.python_module === "string" ? raw.python_module : "",
    inputs,
    hidden: isRecord(input.hidden) ? Object.keys(input.hidden) : [],
    output,
    output_is_list: output.map((_, i) => Array.isArray(raw.output_is_list) && raw.output_is_list[i] === true),
    output_name: output.map((t, i) =>
      Array.isArray(raw.output_name) && typeof raw.output_name[i] === "string" ? raw.output_name[i] : t,
    ),
    output_tooltips: output.map((_, i) =>
      Array.isArray(raw.output_tooltips) && typeof raw.output_tooltips[i] === "string"
        ? raw.output_tooltips[i]
        : "",
    ),
    output_node: raw.output_node === true,
    search_aliases: strings(raw.search_aliases),
    deprecated: raw.deprecated === true,
    experimental: raw.experimental === true,
  };
}

export function normaliseDefs(raw: unknown): NodeDefs {
  if (!isRecord(raw)) throw new Error("节点定义格式无效：应为 /object_info 的对象。");
  const defs: NodeDefs = {};
  for (const [key, value] of Object.entries(raw)) {
    const def = parseNodeDef(key, value);
    if (def) defs[key] = def;
  }
  if (!Object.keys(defs).length) throw new Error("节点定义为空。");
  return defs;
}

export type WidgetKind = "int" | "float" | "string" | "boolean" | "combo" | "control" | "upload";

export interface WidgetSpec {
  name: string;
  kind: WidgetKind;
  /** Source input; control/upload widgets reference the input they accompany. */
  input: InputSpec;
  default: unknown;
}

/** Widget kind for a socket-capable input; null when it is socket-only. */
export function widgetKind(spec: InputSpec): "int" | "float" | "string" | "boolean" | "combo" | null {
  if (spec.config.forceInput === true) return null;
  if (spec.type === "COMBO") return "combo";
  if (!primitiveTypes.has(spec.type)) return null;
  return spec.type.toLowerCase() as "int" | "float" | "string" | "boolean";
}

export function hasSeedControl(spec: InputSpec): boolean {
  if (widgetKind(spec) !== "int") return false;
  const c = spec.config.control_after_generate;
  if (c !== undefined && c !== null) return c !== false;
  return spec.name === "seed" || spec.name === "noise_seed";
}

/** Default mode of the control widget: some definitions name it ("fixed"), ComfyUI otherwise randomises. */
export function controlDefault(spec: InputSpec): string {
  const c = spec.config.control_after_generate;
  return typeof c === "string" && (SEED_CONTROLS as readonly string[]).includes(c) ? c : "randomize";
}

export function defaultValue(spec: InputSpec): unknown {
  const kind = widgetKind(spec);
  const d = spec.config.default;
  if (kind === "combo") return d !== undefined && d !== null ? d : (spec.options?.[0] ?? "");
  if (kind === "int" || kind === "float")
    return typeof d === "number" ? d : typeof spec.config.min === "number" ? spec.config.min : 0;
  if (kind === "boolean") return typeof d === "boolean" ? d : false;
  if (kind === "string") return typeof d === "string" ? d : "";
  return undefined;
}

/**
 * Widgets of a node in the order ComfyUI creates and serialises them (`widgets_values`):
 * one per primitive/combo input, followed by the seed-control combo directly after its
 * number and the image-upload button after all inputs.
 */
export function widgetLayout(def: NodeDef): WidgetSpec[] {
  const out: WidgetSpec[] = [];
  const uploads: WidgetSpec[] = [];
  for (const input of def.inputs) {
    const kind = widgetKind(input);
    if (!kind) continue;
    out.push({ name: input.name, kind, input, default: defaultValue(input) });
    if (hasSeedControl(input))
      out.push({ name: "control_after_generate", kind: "control", input, default: controlDefault(input) });
    if (input.config.image_upload === true || input.config.video_upload === true || input.config.audio_upload === true)
      uploads.push({ name: "upload", kind: "upload", input, default: "image" });
  }
  return [...out, ...uploads];
}

/** Output nodes that take an image (Save / Preview Image): they show their result inside the node. */
export const isImageSink = (def: NodeDef) => def.output_node && def.inputs.some((i) => i.type === "IMAGE");

/** Whether an upstream output of type `from` may feed an input of type `to`. */
export function typesCompatible(from: string, to: string): boolean {
  if (from === "*" || to === "*" || from === "" || to === "") return true;
  const a = from.toUpperCase().split(","),
    b = to.toUpperCase().split(",");
  return a.some((x) => b.includes(x));
}

/** Category tree key helper: "sampling/custom_sampling" -> ["sampling","custom_sampling"]. */
export const categoryPath = (category: string) => category.split("/").filter(Boolean);
