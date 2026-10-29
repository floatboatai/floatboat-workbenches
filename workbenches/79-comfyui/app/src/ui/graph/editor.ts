// ABOUTME: litegraph 画布的封装：加载/序列化、撤销重做、选择操作、运行视觉状态与控件编辑桥接。

import {
  LGraph,
  LGraphCanvas,
  LGraphGroup,
  LGraphNode,
  LiteGraph,
  type IWidget,
} from "@comfyorg/litegraph";
import { MODE_BYPASS, MODE_NEVER, type NodeDefs } from "../../contracts/comfy";
import type { UiWorkflow } from "../../contracts/workflow";
import { applyTheme } from "./palette";
import { PrimitiveNode, registerAll, runtime, type NodeVisual } from "./nodes";

export interface SearchRequest {
  graphPos: [number, number];
  screenPos: [number, number];
  /** Present when a link was released on empty canvas. */
  from?: { nodeId: string; slot: number; side: "output" | "input"; type: string };
}
export interface TextEditRequest {
  node: LGraphNode;
  widget: IWidget;
  title: string;
}
export interface ComboRequest {
  node: LGraphNode;
  widget: IWidget;
  options: string[];
}
export interface EditorEvents {
  change(workflow: UiWorkflow): void;
  selection(ids: string[]): void;
  search(request: SearchRequest): void;
  view(): void;
  editText(request: TextEditRequest): void;
  pickCombo(request: ComboRequest): void;
  upload(node: LGraphNode, widget: IWidget): void;
  inputImage(file: string): HTMLImageElement | null;
}

const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v)) as T;
const stateKey = (wf: UiWorkflow) => {
  const { extra, id: _id, revision: _revision, ...rest } = wf;
  const { ds: _ds, ...extraRest } = extra ?? {};
  void _id; void _revision; void _ds;
  return JSON.stringify({ ...rest, extra: extraRest });
};

export class GraphEditor {
  readonly graph = new LGraph();
  readonly canvas: LGraphCanvas;
  private readonly element: HTMLCanvasElement;
  private readonly events: EditorEvents;
  private defsSignature = "";
  private suspended = 0;
  private lastKey = "";
  private history: string[] = [];
  private cursor = -1;
  private timer = 0;
  private resizeObserver: ResizeObserver;
  private visuals = new Map<string, NodeVisual>();
  private errorCounts = new Map<string, number>();
  private images = new Map<string, HTMLImageElement[]>();
  private disposed = false;
  private versionTimer = 0;
  private lastEmptyDouble = 0;
  private lastVersion = -1;

  constructor(element: HTMLCanvasElement, events: EditorEvents) {
    applyTheme();
    this.element = element;
    this.events = events;
    this.canvas = new LGraphCanvas(element, this.graph, {});
    this.canvas.allow_searchbox = false;
    this.canvas.render_connection_arrows = false;
    this.canvas.clear_background_color = "#11141a";
    this.canvas.zoom_modify_alpha = false;
    this.canvas.show_info = false;
    this.canvas.render_canvas_border = false;
    this.canvas.low_quality_zoom_threshold = 0.3;
    this.canvas.ds.min_scale = 0.1;
    this.canvas.ds.max_scale = 4;
    this.canvas.default_connection_color_byType = {};
    runtime.visual = (id) => this.visuals.get(id);
    runtime.errorCount = (id) => this.errorCounts.get(id) ?? 0;
    runtime.images = (id) => this.images.get(id) ?? [];
    runtime.editText = (node, widget) =>
      events.editText({ node, widget, title: node.title || String(node.type) });
    runtime.pickCombo = (node, widget, options) => events.pickCombo({ node, widget, options });
    runtime.upload = (node, widget) => events.upload(node, widget);
    runtime.inputImage = (file) => events.inputImage(file);
    const schedule = () => this.schedule();
    this.graph.onNodeAdded = schedule;
    this.graph.onNodeRemoved = schedule;
    this.graph.onConnectionChange = schedule;
    this.graph.onAfterChange = schedule;
    LGraphNode.prototype.onWidgetChanged = schedule;
    this.canvas.ds.onChanged = () => events.view();
    this.canvas.onSelectionChange = () => events.selection(this.selectedIds());
    element.addEventListener("pointerup", schedule);
    element.addEventListener("keyup", schedule);
    element.addEventListener("litegraph:canvas", this.onCanvasEvent as EventListener);
    element.addEventListener("dblclick", this.onNativeDouble);
    // Programmatic or gesture-less changes still bump the graph version; poll it cheaply.
    this.versionTimer = window.setInterval(() => {
      const v = (this.graph as unknown as { _version: number })._version;
      if (v !== this.lastVersion) {
        this.lastVersion = v;
        this.schedule();
      }
    }, 300);
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(element.parentElement ?? element);
    this.resize();
    this.canvas.startRendering();
  }

  private onCanvasEvent = (event: CustomEvent) => {
    const detail = event.detail as
      | { subType: string; originalEvent?: MouseEvent; linkReleaseContext?: { links: { node: LGraphNode; slot: number; input?: { type: string }; output?: { type: string } }[] } }
      | undefined;
    if (!detail || !detail.originalEvent) return;
    const e = detail.originalEvent;
    const [gx, gy] = this.canvas.graph_mouse;
    if (detail.subType === "empty-double-click") this.lastEmptyDouble = performance.now();
    if (detail.subType === "empty-double-click")
      this.events.search({ graphPos: [gx, gy], screenPos: [e.clientX, e.clientY] });
    if (detail.subType === "empty-release") {
      const link = detail.linkReleaseContext?.links?.[0];
      if (!link) return;
      const side = link.output ? "output" : "input";
      const slotType = String((link.output ?? link.input)?.type ?? "*");
      this.events.search({
        graphPos: [gx, gy],
        screenPos: [e.clientX, e.clientY],
        from: { nodeId: String(link.node.id), slot: link.slot, side, type: slotType },
      });
    }
  };

  /** litegraph misses a double click when both clicks carry the same timestamp; the native event is the fallback. */
  private onNativeDouble = (e: MouseEvent) => {
    window.setTimeout(() => {
      if (this.disposed || performance.now() - this.lastEmptyDouble < 200) return;
      const [gx, gy] = this.canvas.graph_mouse;
      if (this.graph.getNodeOnPos(gx, gy) || this.graph.getGroupOnPos(gx, gy)) return;
      this.events.search({ graphPos: [gx, gy], screenPos: [e.clientX, e.clientY] });
    }, 30);
  };

  /** Re-fits the backing store to the container and device pixel ratio. */
  resize(): void {
    const parent = this.element.parentElement;
    if (!parent) return;
    const ratio = Math.max(window.devicePixelRatio || 1, 1);
    const w = Math.max(1, Math.round(parent.clientWidth)),
      h = Math.max(1, Math.round(parent.clientHeight));
    this.element.style.width = w + "px";
    this.element.style.height = h + "px";
    const pw = Math.round(w * ratio),
      ph = Math.round(h * ratio);
    if (this.element.width === pw && this.element.height === ph) return;
    this.element.width = pw;
    this.element.height = ph;
    const bg = this.canvas.bgcanvas;
    if (bg) {
      bg.width = pw;
      bg.height = ph;
      bg.getContext("2d")?.scale(ratio, ratio);
    }
    this.element.getContext("2d")?.scale(ratio, ratio);
    this.canvas.setDirty(true, true);
    this.events.view();
  }

  private schedule(): void {
    if (this.suspended || this.disposed) return;
    window.clearTimeout(this.timer);
    this.timer = window.setTimeout(() => this.checkpoint(), 90);
  }

  /** Marks a programmatic change (e.g. a widget edited outside the canvas). */
  touch(): void {
    this.canvas.setDirty(true, true);
    this.schedule();
  }

  serialize(): UiWorkflow {
    const wf = this.graph.serialize() as unknown as UiWorkflow;
    return clone(wf);
  }

  private checkpoint(): void {
    if (this.disposed) return;
    const wf = this.serialize();
    const key = stateKey(wf);
    if (key === this.lastKey) return;
    this.lastKey = key;
    this.history = this.history.slice(0, this.cursor + 1);
    this.history.push(JSON.stringify(wf));
    if (this.history.length > 120) this.history.shift();
    this.cursor = this.history.length - 1;
    this.events.change(wf);
  }

  private defsKey(defs: NodeDefs, missing: string[]): string {
    return Object.keys(defs).length + ":" + Object.keys(defs).slice(0, 5).join(",") + ":" + missing.sort().join(",");
  }

  /** Replaces the node classes; the graph is reloaded from its own serialisation. */
  setDefs(defs: NodeDefs, workflowForMissing?: UiWorkflow): void {
    const reload = this.graph._nodes.length ? this.serialize() : null;
    this.register(defs, reload ?? workflowForMissing);
    if (reload) this.configure(reload, false);
  }

  private register(defs: NodeDefs, wf?: UiWorkflow): void {
    const virtual = new Set(["Reroute", "PrimitiveNode", "Note", "MarkdownNote"]);
    const missing = wf ? [...new Set(wf.nodes.map((n) => n.type).filter((t) => !defs[t] && !virtual.has(t)))] : [];
    const sig = this.defsKey(defs, missing) + ":" + Object.values(defs).map((d) => d.inputs.length + d.output.length).join("").length;
    if (sig === this.defsSignature) return;
    this.defsSignature = sig;
    registerAll(defs, missing);
  }

  private configure(wf: UiWorkflow, resetHistory: boolean): void {
    this.suspended++;
    try {
      this.canvas.deselectAll();
      this.graph.configure(clone(wf) as never);
      for (const node of this.graph._nodes) if (node instanceof PrimitiveNode) node.adopt();
      const ds = wf.extra?.ds;
      if (ds && Array.isArray(ds.offset)) {
        this.canvas.ds.scale = ds.scale || 1;
        this.canvas.ds.offset = [ds.offset[0], ds.offset[1]];
      } else this.fit(false);
      this.canvas.setDirty(true, true);
    } finally {
      this.suspended--;
    }
    if (resetHistory) {
      const fresh = this.serialize();
      this.lastKey = stateKey(fresh);
      this.history = [JSON.stringify(fresh)];
      this.cursor = 0;
    } else this.lastKey = stateKey(this.serialize());
  }

  /** Loads a document: registers node classes (incl. placeholders) and rebuilds the graph. */
  load(wf: UiWorkflow, defs: NodeDefs): void {
    this.defsSignature = "";
    this.register(defs, wf);
    this.configure(wf, true);
    this.errorCounts.clear();
    this.visuals.clear();
    this.images.clear();
    this.events.selection([]);
    this.events.view();
  }

  get canUndo(): boolean {
    return this.cursor > 0;
  }
  get canRedo(): boolean {
    return this.cursor < this.history.length - 1;
  }
  undo(): void {
    this.step(-1);
  }
  redo(): void {
    this.step(1);
  }
  private step(delta: number): void {
    const next = this.cursor + delta;
    if (next < 0 || next >= this.history.length) return;
    const wf = JSON.parse(this.history[next]) as UiWorkflow;
    wf.extra = { ...wf.extra, ds: { scale: this.canvas.ds.scale, offset: [...this.canvas.ds.offset] as [number, number] } };
    this.cursor = next;
    this.configure(wf, false);
    this.events.change(this.serialize());
    this.events.selection([]);
  }

  selectedIds(): string[] {
    return Object.values(this.canvas.selected_nodes ?? {}).map((n) => String(n.id));
  }
  selectedNodes(): LGraphNode[] {
    return Object.values(this.canvas.selected_nodes ?? {});
  }

  centerPos(): [number, number] {
    const ds = this.canvas.ds;
    const w = this.element.clientWidth,
      h = this.element.clientHeight;
    return [w / 2 / ds.scale - ds.offset[0], h / 2 / ds.scale - ds.offset[1]];
  }
  clientToGraph(x: number, y: number): [number, number] {
    const rect = this.element.getBoundingClientRect();
    const ds = this.canvas.ds;
    return [(x - rect.left) / ds.scale - ds.offset[0], (y - rect.top) / ds.scale - ds.offset[1]];
  }
  graphToClient(x: number, y: number): [number, number] {
    const rect = this.element.getBoundingClientRect();
    const ds = this.canvas.ds;
    return [(x + ds.offset[0]) * ds.scale + rect.left, (y + ds.offset[1]) * ds.scale + rect.top];
  }

  /** Adds a node at a position; optionally connects it to a released link. */
  add(type: string, pos?: [number, number], from?: SearchRequest["from"]): LGraphNode | null {
    const node = LiteGraph.createNode(type);
    if (!node) return null;
    const at = pos ?? this.centerPos();
    node.pos = [Math.round(at[0]), Math.round(at[1])];
    this.graph.add(node);
    if (from) this.autoConnect(node, from);
    this.canvas.deselectAll();
    this.canvas.select(node);
    this.canvas.setDirty(true, true);
    this.schedule();
    return node;
  }

  private autoConnect(node: LGraphNode, from: NonNullable<SearchRequest["from"]>): void {
    const origin = this.graph.getNodeById(from.nodeId as never) ?? this.graph.getNodeById(Number(from.nodeId));
    if (!origin) return;
    if (from.side === "output") {
      const target = node.inputs?.findIndex((i) => compatible(from.type, String(i.type)) && i.link == null) ?? -1;
      if (target >= 0) origin.connect(from.slot, node, target);
    } else {
      const source = node.outputs?.findIndex((o) => compatible(String(o.type), from.type)) ?? -1;
      if (source >= 0) node.connect(source, origin, from.slot);
    }
  }

  nodeById(id: string): LGraphNode | null {
    return this.graph.getNodeById(Number(id)) ?? this.graph.getNodeById(id as never);
  }

  focusNode(id: string): void {
    const node = this.nodeById(id);
    if (!node) return;
    this.canvas.deselectAll();
    this.canvas.select(node);
    const ds = this.canvas.ds;
    const w = this.element.clientWidth,
      h = this.element.clientHeight;
    const scale = Math.max(ds.scale, 0.8);
    ds.scale = scale;
    ds.offset = [w / 2 / scale - (node.pos[0] + node.size[0] / 2), h / 2 / scale - (node.pos[1] + node.size[1] / 2)];
    this.canvas.setDirty(true, true);
    this.events.view();
  }

  fit(animate = true): void {
    try {
      if (!this.graph._nodes.length) {
        this.canvas.ds.reset();
        return;
      }
      const nodes = this.graph._nodes;
      let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
      for (const n of nodes) {
        x0 = Math.min(x0, n.pos[0]);
        y0 = Math.min(y0, n.pos[1] - 30);
        x1 = Math.max(x1, n.pos[0] + n.size[0]);
        y1 = Math.max(y1, n.pos[1] + n.size[1]);
      }
      const w = this.element.clientWidth || 800,
        h = this.element.clientHeight || 600;
      const scale = Math.max(0.5, Math.min(1.1, Math.min((w - 80) / (x1 - x0), (h - 80) / (y1 - y0))));
      void animate;
      this.canvas.ds.scale = scale;
      const fitsX = (x1 - x0) * scale <= w - 40;
      this.canvas.ds.offset = [fitsX ? (w / scale - (x1 - x0)) / 2 - x0 : 28 / scale - x0, (h / scale - (y1 - y0)) / 2 - y0];
      this.canvas.setDirty(true, true);
      this.events.view();
    } catch {
      /* nothing to fit */
    }
  }

  zoomBy(factor: number): void {
    const ds = this.canvas.ds;
    const center: [number, number] = [this.element.clientWidth / 2, this.element.clientHeight / 2];
    ds.changeScale(Math.max(ds.min_scale, Math.min(ds.max_scale, ds.scale * factor)), center);
    this.canvas.setDirty(true, true);
    this.events.view();
  }

  private mutateModes(mode: number): void {
    const nodes = this.selectedNodes();
    if (!nodes.length) return;
    const everyone = nodes.every((n) => n.mode === mode);
    for (const n of nodes) n.mode = everyone ? 0 : mode;
    this.canvas.setDirty(true, true);
    this.schedule();
  }
  toggleBypass(): void {
    this.mutateModes(MODE_BYPASS);
  }
  toggleMute(): void {
    this.mutateModes(MODE_NEVER);
  }
  toggleCollapse(): void {
    for (const n of this.selectedNodes()) n.collapse();
    this.schedule();
  }
  deleteSelected(): void {
    this.canvas.deleteSelected();
    this.schedule();
  }
  duplicate(): void {
    if (!this.selectedNodes().length) return;
    this.canvas.copyToClipboard();
    this.canvas.pasteFromClipboard({ connectInputs: false });
    this.schedule();
  }
  copy(): void {
    this.canvas.copyToClipboard();
  }
  paste(): void {
    this.canvas.pasteFromClipboard({ connectInputs: false });
    this.schedule();
  }
  selectAll(): void {
    this.canvas.selectItems();
  }
  groupSelected(): void {
    const nodes = this.selectedNodes();
    if (!nodes.length) return;
    const group = new LGraphGroup("分组");
    group.resizeTo(nodes, 24);
    this.graph.add(group);
    this.schedule();
  }

  /** Applies each seed "control after generate" to the value for the next run. */
  advanceSeeds(): void {
    for (const node of this.graph._nodes) {
      if (node.mode === MODE_NEVER || node.mode === MODE_BYPASS) continue;
      const widgets = node.widgets ?? [];
      widgets.forEach((control, i) => {
        if (control.name !== "control_after_generate" || i === 0) return;
        const seed = widgets[i - 1];
        if (seed.type !== "number" || typeof seed.value !== "number") return;
        const opts = seed.options as { min?: number; max?: number };
        const min = opts.min ?? 0,
          max = Math.min(opts.max ?? Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER);
        let v = seed.value;
        if (control.value === "increment") v += 1;
        else if (control.value === "decrement") v -= 1;
        else if (control.value === "randomize") v = min + Math.floor(Math.random() * Math.min(2 ** 48, max - min));
        else return;
        seed.value = Math.max(min, Math.min(max, v));
      });
    }
    this.touch();
  }

  setVisuals(map: Map<string, NodeVisual>): void {
    this.visuals = map;
    this.canvas.setDirty(true, true);
  }
  setErrorCounts(map: Map<string, number>): void {
    this.errorCounts = map;
    this.canvas.setDirty(true, true);
  }
  setImages(map: Map<string, HTMLImageElement[]>): void {
    this.images = map;
    this.canvas.setDirty(true, true);
  }
  redraw(): void {
    this.canvas.setDirty(true, true);
  }

  /** Axis-aligned bounds of all nodes, for the minimap. */
  bounds(): { x: number; y: number; w: number; h: number; nodes: { x: number; y: number; w: number; h: number; color: string }[] } {
    const nodes = this.graph._nodes.map((n) => ({
      x: n.pos[0], y: n.pos[1] - 28, w: n.size[0], h: n.size[1] + 28,
      color: n.mode === MODE_NEVER ? "#555b6b" : n.mode === MODE_BYPASS ? "#a46bd6" : (n.color ?? "#5d6a85"),
    }));
    if (!nodes.length) return { x: 0, y: 0, w: 1, h: 1, nodes };
    const x0 = Math.min(...nodes.map((n) => n.x)), y0 = Math.min(...nodes.map((n) => n.y));
    const x1 = Math.max(...nodes.map((n) => n.x + n.w)), y1 = Math.max(...nodes.map((n) => n.y + n.h));
    return { x: x0, y: y0, w: x1 - x0, h: y1 - y0, nodes };
  }
  viewport(): { x: number; y: number; w: number; h: number } {
    const ds = this.canvas.ds;
    return {
      x: -ds.offset[0],
      y: -ds.offset[1],
      w: this.element.clientWidth / ds.scale,
      h: this.element.clientHeight / ds.scale,
    };
  }
  panTo(gx: number, gy: number): void {
    const ds = this.canvas.ds;
    ds.offset = [this.element.clientWidth / 2 / ds.scale - gx, this.element.clientHeight / 2 / ds.scale - gy];
    this.canvas.setDirty(true, true);
    this.events.view();
  }

  /** Bounding rectangle (client px) of a widget, for overlay editors. */
  widgetRect(node: LGraphNode, widget: IWidget): { x: number; y: number; w: number; h: number } {
    const wy = (widget as unknown as { y: number }).y;
    const wh = (widget as unknown as { computedHeight?: number }).computedHeight ?? 24;
    const [sx, sy] = this.graphToClient(node.pos[0] + 8, node.pos[1] + wy);
    const s = this.canvas.ds.scale;
    return { x: sx, y: sy, w: (node.size[0] - 16) * s, h: (wh - 4) * s };
  }

  focus(): void {
    this.element.focus();
  }

  dispose(): void {
    this.disposed = true;
    window.clearTimeout(this.timer);
    window.clearInterval(this.versionTimer);
    this.resizeObserver.disconnect();
    this.canvas.stopRendering();
    this.element.removeEventListener("litegraph:canvas", this.onCanvasEvent as EventListener);
    this.element.removeEventListener("dblclick", this.onNativeDouble);
    this.canvas.setCanvas(null as never, false);
  }
}

function compatible(a: string, b: string): boolean {
  if (a === "*" || b === "*") return true;
  const x = a.toUpperCase().split(","), y = b.toUpperCase().split(",");
  return x.some((t) => y.includes(t));
}
