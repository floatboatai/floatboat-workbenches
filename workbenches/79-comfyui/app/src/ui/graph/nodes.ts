// ABOUTME: 由 ComfyUI 节点定义生成 litegraph 节点类：插槽、控件、种子控制、缺失节点与虚拟节点。

import { LGraphNode, LiteGraph, type CanvasPointer, type IWidget } from "@comfyorg/litegraph";
import {
  SAFE_MAX,
  isImageSink,
  SEED_CONTROLS,
  VIRTUAL_TYPES,
  typesCompatible,
  widgetLayout,
  type InputSpec,
  type NodeDef,
  type NodeDefs,
  type WidgetSpec,
} from "../../contracts/comfy";
import { typeColor } from "./palette";

export type VisualState = "queued" | "running" | "done" | "cached" | "error";
export interface NodeVisual {
  state: VisualState;
  progress?: number;
}
/** Bridge between canvas drawing / widget interaction and the surrounding React app. */
export interface EditorRuntime {
  visual(nodeId: string): NodeVisual | undefined;
  errorCount(nodeId: string): number;
  images(nodeId: string): HTMLImageElement[];
  editText(node: LGraphNode, widget: IWidget): void;
  pickCombo(node: LGraphNode, widget: IWidget, options: string[]): void;
  upload(node: LGraphNode, widget: IWidget): void;
  inputImage(file: string): HTMLImageElement | null;
}
export const runtime: EditorRuntime = {
  visual: () => undefined,
  errorCount: () => 0,
  images: () => [],
  editText: () => {},
  pickCombo: () => {},
  upload: () => {},
  inputImage: () => null,
};

type AnyWidget = IWidget & { computedHeight?: number; y: number };
const VISUAL_COLOR: Record<VisualState, string> = {
  queued: "#6b7a99",
  running: "#f0b24a",
  done: "#56c28a",
  cached: "#6fb4ee",
  error: "#ef6a6a",
};

function roundTo(value: number, step: number | undefined, precision: number): number {
  const v = step && step > 0 ? Math.round(value / step) * step : value;
  return Number(v.toFixed(Math.max(0, precision)));
}
const decimals = (n: number) => (Number.isInteger(n) ? 0 : (String(n).split(".")[1]?.length ?? 0));

/** Draws state outline, progress and run images; shared by every node class. */
function drawNodeOverlay(node: LGraphNode, ctx: CanvasRenderingContext2D): void {
  const id = String(node.id);
  const visual = runtime.visual(id);
  const errors = runtime.errorCount(id);
  const w = node.size[0],
    h = node.size[1],
    t = LiteGraph.NODE_TITLE_HEIGHT;
  if (node.flags?.collapsed) return;
  const files =
    node.type === "LoadImage" || node.type === "LoadImageMask"
      ? (() => {
          const name = node.widgets?.[0]?.value;
          const img = typeof name === "string" ? runtime.inputImage(name) : null;
          return img ? [img] : [];
        })()
      : runtime.images(id);
  if (files.length) {
    const wid = node.widgets?.at(-1) as AnyWidget | undefined;
    const top = wid ? wid.y + (wid.computedHeight ?? 24) + 4 : 10;
    const area = { x: 8, y: top, w: w - 16, h: h - top - 8 };
    if (area.h > 24) {
      const cols = files.length > 1 ? Math.min(files.length, Math.ceil(Math.sqrt(files.length))) : 1;
      const rows = Math.ceil(files.length / cols);
      const cw = area.w / cols,
        ch = area.h / rows;
      ctx.save();
      files.forEach((img, i) => {
        if (!img.complete || !img.naturalWidth) return;
        const cx = area.x + (i % cols) * cw,
          cy = area.y + Math.floor(i / cols) * ch;
        const s = Math.min((cw - 4) / img.naturalWidth, (ch - 4) / img.naturalHeight);
        const dw = img.naturalWidth * s,
          dh = img.naturalHeight * s;
        ctx.drawImage(img, cx + (cw - dw) / 2, cy + (ch - dh) / 2, dw, dh);
      });
      ctx.restore();
    }
  }
  if (visual || errors) {
    const color = errors ? VISUAL_COLOR.error : VISUAL_COLOR[visual!.state];
    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = visual?.state === "running" || errors ? 2.5 : 1.5;
    ctx.globalAlpha = visual?.state === "queued" ? 0.5 : 1;
    ctx.beginPath();
    ctx.roundRect(-2, -t - 2, w + 4, h + t + 4, 9);
    ctx.stroke();
    if (visual?.state === "running" && typeof visual.progress === "number") {
      ctx.fillStyle = color;
      ctx.fillRect(0, -3, Math.max(0, Math.min(1, visual.progress)) * w, 3);
    }
    ctx.restore();
  }
}

class ComfyNodeBase extends LGraphNode {
  comfyClass = "";
  onDrawForeground(ctx: CanvasRenderingContext2D): void {
    drawNodeOverlay(this, ctx);
  }
}

function clampSeed(value: number, spec: InputSpec): number {
  const max = Math.min(typeof spec.config.max === "number" ? spec.config.max : SAFE_MAX, SAFE_MAX);
  return Math.max(typeof spec.config.min === "number" ? spec.config.min : 0, Math.min(max, value));
}

export function addWidgetFor(node: LGraphNode, w: WidgetSpec): IWidget {
  const c = w.input.config;
  const callbackless = () => {};
  if (w.kind === "int" || w.kind === "float") {
    const step = typeof c.step === "number" ? c.step : w.kind === "int" ? 1 : 0.1;
    const round = typeof c.round === "number" ? c.round : undefined;
    const precision = w.kind === "int" ? 0 : Math.max(decimals(round ?? step), 2 > decimals(step) ? decimals(step) : 2);
    const max = Math.min(typeof c.max === "number" ? c.max : SAFE_MAX, SAFE_MAX);
    const min = typeof c.min === "number" ? c.min : -SAFE_MAX;
    const widget = node.addWidget(
      "number",
      w.name,
      w.default as number,
      (v: unknown) => {
        if (typeof v !== "number") return;
        widget.value = w.kind === "int" ? Math.round(v) : roundTo(v, round, Math.max(precision, 4));
      },
      { min, max, step: step * 10, step2: step, precision } as never,
    );
    if (c.tooltip) widget.tooltip = String(c.tooltip);
    return widget as IWidget;
  }
  if (w.kind === "boolean") {
    const widget = node.addWidget("toggle", w.name, w.default as boolean, callbackless, {
      on: String(c.label_on ?? "true"),
      off: String(c.label_off ?? "false"),
    } as never);
    if (c.tooltip) widget.tooltip = String(c.tooltip);
    return widget as IWidget;
  }
  if (w.kind === "combo") {
    const options = w.input.options ?? [];
    const widget = node.addWidget("combo", w.name, w.default as string, callbackless, { values: options } as never);
    if (c.tooltip) widget.tooltip = String(c.tooltip);
    (widget as IWidget & { onPointerDown?: unknown }).onPointerDown = (
      pointer: CanvasPointer,
      n: LGraphNode,
    ) => {
      const current = n.widgets?.find((x) => x.name === w.name);
      if (!current || options.length < 12) return false;
      const canvas = (n.graph?.primaryCanvas ?? null) as { graph_mouse: number[] } | null;
      const local = canvas ? canvas.graph_mouse[0] - n.pos[0] : 100;
      if (local < 36 || local > n.size[0] - 36) return false;
      pointer.onClick = () => runtime.pickCombo(n, current as unknown as IWidget, options);
      return true;
    };
    return widget as IWidget;
  }
  if (w.kind === "control") {
    const widget = node.addWidget("combo", "control_after_generate", String(w.default ?? "randomize"), callbackless, {
      values: [...SEED_CONTROLS],
    } as never);
    return widget as IWidget;
  }
  if (w.kind === "upload") {
    const widget = node.addWidget("button", "upload", "image", callbackless, {} as never);
    widget.label = "选择文件上传";
    widget.callback = () => runtime.upload(node, widget as unknown as IWidget);
    return widget as IWidget;
  }
  // string
  if (c.multiline === true) {
    const holder = { text: String(w.default ?? "") };
    const widget = {
      type: "customtext",
      name: w.name,
      get value() {
        return holder.text;
      },
      set value(v: unknown) {
        holder.text = typeof v === "string" ? v : String(v ?? "");
      },
      options: { multiline: true } as Record<string, unknown>,
      y: 0,
      tooltip: typeof c.tooltip === "string" ? c.tooltip : undefined,
      computeLayoutSize: () => ({ minHeight: 64, maxHeight: 600, minWidth: 220 }),
      draw(ctx: CanvasRenderingContext2D, n: LGraphNode, width: number, y: number) {
        const self = widget as unknown as AnyWidget;
        const h = (self.computedHeight ?? 64) - 4;
        const x = 8;
        ctx.save();
        ctx.fillStyle = LiteGraph.WIDGET_BGCOLOR;
        ctx.strokeStyle = LiteGraph.WIDGET_OUTLINE_COLOR;
        ctx.beginPath();
        ctx.roundRect(x, y, width - 16, h, 6);
        ctx.fill();
        ctx.stroke();
        ctx.beginPath();
        ctx.rect(x + 2, y + 2, width - 20, h - 4);
        ctx.clip();
        ctx.fillStyle = holder.text ? LiteGraph.WIDGET_TEXT_COLOR : LiteGraph.WIDGET_SECONDARY_TEXT_COLOR;
        ctx.font = "12px " + LiteGraph.DEFAULT_FONT;
        ctx.textBaseline = "top";
        const text = holder.text || String(c.placeholder ?? w.name);
        const lines: string[] = [];
        const maxWidth = width - 28;
        for (const para of text.split("\n")) {
          let line = "";
          for (const word of para.split(/(\s+)/)) {
            if (ctx.measureText(line + word).width > maxWidth && line) {
              lines.push(line);
              line = word.trimStart();
            } else line += word;
          }
          lines.push(line);
          if (lines.length * 15 > h) break;
        }
        lines.forEach((l, i) => ctx.fillText(l, x + 6, y + 6 + i * 15));
        ctx.restore();
        void n;
      },
      onPointerDown(pointer: CanvasPointer, n: LGraphNode) {
        pointer.onClick = () => runtime.editText(n, widget as unknown as IWidget);
        return true;
      },
    };
    node.addCustomWidget(widget as unknown as IWidget);
    return widget as unknown as IWidget;
  }
  const widget = node.addWidget("text", w.name, w.default as string, callbackless, {} as never);
  if (c.tooltip) widget.tooltip = String(c.tooltip);
  return widget as IWidget;
}

/** Builds the litegraph class for one node definition. */
export function nodeClassFor(def: NodeDef): typeof LGraphNode {
  const layout = widgetLayout(def);
  class DefNode extends ComfyNodeBase {
    static override title = def.display_name;
    static override type = def.name;
    constructor() {
      super(def.display_name);
      this.comfyClass = def.name;
      this.serialize_widgets = true;
      for (const input of def.inputs) {
        const spec = layout.find((w) => w.input === input && w.kind !== "control" && w.kind !== "upload");
        if (spec) {
          addWidgetFor(this, spec);
          const dependents = layout.filter((w) => w.input === input && (w.kind === "control" || w.kind === "upload"));
          for (const d of dependents) addWidgetFor(this, d);
          this.addInput(input.name, input.type, { widget: { name: input.name } } as never);
        } else {
          this.addInput(input.name, input.type, {
            color_off: typeColor(input.type),
            color_on: typeColor(input.type),
            shape: input.required ? undefined : 6,
          } as never);
        }
      }
      // widgets that follow other widgets (upload buttons) not yet attached
      for (const w of layout) {
        if (w.kind === "upload" && !this.widgets?.some((x) => x.name === "upload")) addWidgetFor(this, w);
      }
      def.output.forEach((type, i) => {
        const out = this.addOutput(def.output_name[i] ?? type, type, {
          color_off: typeColor(type),
          color_on: typeColor(type),
        } as never);
        if (def.output_tooltips[i]) (out as unknown as { tooltip?: string }).tooltip = def.output_tooltips[i];
      });
      this.size = this.computeSize();
      if (def.output_node) {
        this.color = "#3a3b2a";
        // image outputs show their result inside the node
        if (isImageSink(def)) this.size = [Math.max(this.size[0], 270), Math.max(this.size[1], 250)];
      }
    }
    onConfigure() {
      // Workflows from older frontends list only converted widgets; make every widget connectable.
      const have = new Set((this.inputs ?? []).map((i) => i.name));
      for (const input of def.inputs) {
        if (have.has(input.name)) continue;
        const isWidget = layout.some((w) => w.input === input && w.kind !== "control" && w.kind !== "upload");
        this.addInput(
          input.name,
          input.type,
          (isWidget ? { widget: { name: input.name } } : {}) as never,
        );
      }
    }
  }
  return DefNode as unknown as typeof LGraphNode;
}

/** Placeholder for workflow nodes whose class the connected server does not provide. */
export function missingClass(type: string): typeof LGraphNode {
  class Missing extends ComfyNodeBase {
    static override title = type;
    static override type = type;
    raw: unknown[] | null = null;
    constructor() {
      super(type);
      this.has_errors = true;
      this.color = "#5a2230";
      this.bgcolor = "#2a1419";
      this.serialize_widgets = false;
    }
    onConfigure(info: { widgets_values?: unknown }) {
      this.raw = Array.isArray(info.widgets_values) ? info.widgets_values : null;
      this.has_errors = true;
      const lines = this.raw?.length ? Math.min(3, this.raw.length) : 0;
      this.size = [Math.max(this.size[0], 220), Math.max(this.size[1], 70 + lines * 14)];
    }
    onSerialize(o: { widgets_values?: unknown }) {
      if (this.raw) o.widgets_values = this.raw;
    }
    onDrawForeground(ctx: CanvasRenderingContext2D) {
      super.onDrawForeground(ctx);
      if (this.flags?.collapsed) return;
      ctx.save();
      ctx.fillStyle = "#f2a4ad";
      ctx.font = "11px " + LiteGraph.DEFAULT_FONT;
      ctx.textBaseline = "top";
      ctx.fillText("缺失节点 · 数据已保留", 10, this.size[1] - 18);
      ctx.restore();
    }
  }
  return Missing as unknown as typeof LGraphNode;
}

/** Editor-only reroute: a single wildcard pass-through. */
export class RerouteNode extends ComfyNodeBase {
  static override title = "Reroute";
  static override type = "Reroute";
  constructor() {
    super("");
    this.addInput("", "*");
    this.addOutput("", "*");
    this.size = [75, 26];
    (this as unknown as { isVirtualNode: boolean }).isVirtualNode = true;
    (this as unknown as { title_mode: number }).title_mode = 1;
  }
  onConnectionsChange() {
    const input = this.inputs?.[0];
    const link = input?.link != null ? this.graph?._links.get(input.link) : null;
    const type = link ? String(link.type ?? "*") : "*";
    if (this.outputs?.[0]) {
      this.outputs[0].type = type;
      this.outputs[0].name = type === "*" ? "" : type;
    }
    if (input) input.type = type;
  }
}

/** Editor-only note. */
export class NoteNode extends ComfyNodeBase {
  static override title = "Note";
  static override type = "Note";
  constructor() {
    super("Note");
    this.serialize_widgets = true;
    this.color = "#4a4426";
    this.bgcolor = "#35311c";
    const holder = { text: "" };
    const self = this;
    const widget = {
      type: "customtext",
      name: "text",
      get value() {
        return holder.text;
      },
      set value(v: unknown) {
        holder.text = typeof v === "string" ? v : "";
      },
      options: { multiline: true } as Record<string, unknown>,
      y: 0,
      computeLayoutSize: () => ({ minHeight: 60, maxHeight: 600, minWidth: 180 }),
      draw(ctx: CanvasRenderingContext2D, _n: LGraphNode, width: number, y: number) {
        const h = ((widget as unknown as AnyWidget).computedHeight ?? 60) - 4;
        ctx.save();
        ctx.fillStyle = "#f3e7b7";
        ctx.font = "12px " + LiteGraph.DEFAULT_FONT;
        ctx.textBaseline = "top";
        ctx.beginPath();
        ctx.rect(8, y, width - 16, h);
        ctx.clip();
        const text = holder.text || "双击编辑备注";
        const lines: string[] = [];
        for (const para of text.split("\n")) {
          let line = "";
          for (const ch of para) {
            if (ctx.measureText(line + ch).width > width - 28) {
              lines.push(line);
              line = ch;
            } else line += ch;
          }
          lines.push(line);
        }
        lines.forEach((l, i) => ctx.fillText(l, 12, y + 4 + i * 15));
        ctx.restore();
      },
      onPointerDown(pointer: CanvasPointer) {
        pointer.onClick = () => runtime.editText(self, widget as unknown as IWidget);
        return true;
      },
    };
    this.addCustomWidget(widget as unknown as IWidget);
    this.size = [260, 120];
  }
}

/** Editor-only primitive: feeds one value into a widget input of another node. */
export class PrimitiveNode extends ComfyNodeBase {
  static override title = "Primitive";
  static override type = "PrimitiveNode";
  saved: unknown[] | null = null;
  constructor() {
    super("Primitive");
    this.addOutput("connect to widget input", "*");
    this.serialize_widgets = true;
    this.size = [220, 60];
  }
  onConfigure(info: { widgets_values?: unknown }) {
    this.saved = Array.isArray(info.widgets_values) ? info.widgets_values : null;
  }
  target(): { node: LGraphNode; widget: IWidget; slotType: string } | null {
    const out = this.outputs?.[0];
    for (const id of out?.links ?? []) {
      const link = this.graph?._links.get(id);
      const node = link ? this.graph?.getNodeById(link.target_id) : null;
      const input = node?.inputs?.[link?.target_slot ?? -1];
      const widget = input?.widget ? node?.widgets?.find((w) => w.name === input.widget?.name) : undefined;
      if (node && widget) return { node, widget: widget as IWidget, slotType: String(input?.type ?? "*") };
    }
    return null;
  }
  /** Re-creates the mirrored widget from the connected target (also after loading a workflow). */
  adopt(): void {
    const target = this.target();
    const out = this.outputs?.[0];
    if (!out) return;
    const existing = this.widgets?.[0];
    if (!target) {
      if (!out.links?.length) {
        this.widgets = [];
        out.type = "*";
        out.name = "connect to widget input";
        delete (out as { widget?: unknown }).widget;
      }
      return;
    }
    const { widget: tw, slotType } = target;
    if (existing && existing.type === tw.type && existing.name === String(tw.name)) return;
    this.widgets = [];
    out.type = slotType;
    out.name = slotType;
    (out as unknown as { widget: { name: string } }).widget = { name: String(tw.name) };
    const options = { ...(tw.options as Record<string, unknown>) };
    const value = this.saved?.[0] ?? tw.value;
    const w = this.addWidget(tw.type as never, "value", value as never, () => {}, options as never);
    w.value = value as never;
    if (tw.name === "seed" || tw.name === "noise_seed") {
      this.addWidget("combo", "control_after_generate", String(this.saved?.[1] ?? "fixed"), () => {}, {
        values: [...SEED_CONTROLS],
      } as never);
    }
    this.size = this.computeSize();
  }
  onConnectionsChange(type: number) {
    if (type === 2) queueMicrotask(() => this.adopt());
  }
  onSerialize(o: { widgets_values?: unknown }) {
    if (this.widgets?.length) o.widgets_values = this.widgets.map((w) => w.value);
  }
  isValidTarget(inputType: string): boolean {
    return typesCompatible(String(this.outputs?.[0]?.type ?? "*"), inputType);
  }
}

export function registerAll(defs: NodeDefs, extraMissing: string[]): void {
  const registry = LiteGraph.registered_node_types as Record<string, unknown>;
  for (const key of Object.keys(registry)) delete registry[key];
  for (const def of Object.values(defs)) LiteGraph.registerNodeType(def.name, nodeClassFor(def));
  LiteGraph.registerNodeType("Reroute", RerouteNode as unknown as typeof LGraphNode);
  LiteGraph.registerNodeType("Note", NoteNode as unknown as typeof LGraphNode);
  LiteGraph.registerNodeType("PrimitiveNode", PrimitiveNode as unknown as typeof LGraphNode);
  for (const type of extraMissing) {
    if (!(type in registry) && !VIRTUAL_TYPES.has(type)) LiteGraph.registerNodeType(type, missingClass(type));
  }
}
