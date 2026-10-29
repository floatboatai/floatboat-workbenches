// Mounts the upstream Scene/Simulator/Editor on layered canvases for one document
// epoch and wires live-trace reporting, publishing and keyboard handling.
import type { MutableRefObject } from "react";
import type { Editor, Scene, Simulator } from "./vendor/ray-optics.js";
import { htmlText, type OpticsModule } from "./engine";
import { sceneValue, qualityBudgets, type Quality } from "../contracts/optics";
import { isRecord } from "../contracts/project";
import type { Trace, TracePhase } from "./NativeBench";

export interface BenchCallbacks {
  documentKey: string;
  source: string;
  quality: Quality;
  disabled: boolean;
  selected: number;
  onScene(source: string): void;
  onSelection(index: number): void;
  onTrace(trace: Trace): void;
  onError(error: unknown): void;
}
export interface MountContext {
  latest: MutableRefObject<BenchCallbacks>;
  instance: MutableRefObject<Engine | null>;
  setFailure(message: string): void;
}
export interface Engine {
  key: string;
  alive: boolean;
  enabled: boolean;
  scene: Scene;
  editor: Editor;
  sim: Simulator;
  mod: OpticsModule;
  source: string;
  canvases: HTMLCanvasElement[];
  gl: HTMLCanvasElement;
  userStopped: boolean;
  loadError: string;
  commitTimer: number;
  phase: TracePhase;
  startedAt: number;
  elapsed: number;
  publish(): void;
  commit(): void;
  scheduleCommit(): void;
  report(phase?: TracePhase): void;
}
const LAYERS = ["grid", "below", "light", "light-gl", "above"];

export function mountBench(mod: OpticsModule, container: HTMLDivElement, key: string, ctx: MountContext): () => void {
  const { latest, instance, setFailure } = ctx;
  const canvases = LAYERS.map((name) => {
    const c = document.createElement("canvas");
    c.className = "optical-layer layer-" + name;
    c.setAttribute("aria-hidden", "true");
    container.append(c);
    return c;
  });
  const [gridCanvas, belowCanvas, lightCanvas, glCanvas, top] = canvases;
  top.tabIndex = 0;
  top.removeAttribute("aria-hidden");
  top.setAttribute("role", "application");
  top.setAttribute("aria-label", "光学平台：拖动元件或控制点；方向键微调，Delete 删除，Ctrl/⌘+Z 撤销");
  const scene = new mod.Scene();
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const measure = () => {
    const box = container.getBoundingClientRect();
    const w = Math.max(240, Math.round(box.width)),
      h = Math.max(240, Math.round(box.height));
    for (const c of canvases) {
      c.width = Math.round(w * dpr);
      c.height = Math.round(h * dpr);
    }
    scene.setViewportSize(w, h);
  };
  measure();
  let gl: WebGLRenderingContext | null = null;
  try {
    gl = glCanvas.getContext("webgl", { alpha: true, premultipliedAlpha: true, antialias: false, preserveDrawingBuffer: true });
    if (gl && !gl.getExtension("OES_texture_float")) gl = null;
  } catch {
    gl = null;
  }
  const sim = new mod.Simulator(
    scene,
    lightCanvas.getContext("2d"),
    belowCanvas.getContext("2d"),
    top.getContext("2d"),
    gridCanvas.getContext("2d"),
    document.createElement("canvas").getContext("2d"),
    true,
    qualityBudgets[latest.current.quality].rays,
    gl,
    null,
    (w, h) => Object.assign(document.createElement("canvas"), { width: w, height: h }),
  );
  sim.dpr = dpr;
  sim.manualLightRedraw = false;
  const editor = new mod.Editor(scene, top, sim);
  let frame = 0;
  const e: Engine = {
    key,
    alive: true,
    enabled: true,
    scene,
    editor,
    sim,
    mod,
    source: latest.current.source,
    canvases,
    gl: glCanvas,
    userStopped: false,
    loadError: "",
    commitTimer: 0,
    phase: "loading",
    startedAt: performance.now(),
    elapsed: 0,
    publish() {
      if (!valid() || scene.error) return;
      const wire = scene.toJSON();
      if (wire === e.source) return;
      try {
        sceneValue(wire);
      } catch (err) {
        latest.current.onError(err);
        return;
      }
      e.source = wire;
      latest.current.onScene(wire);
    },
    commit() {
      if (e.commitTimer) clearTimeout(e.commitTimer);
      e.commitTimer = 0;
      if (valid()) editor.onActionComplete();
    },
    scheduleCommit() {
      if (e.commitTimer) clearTimeout(e.commitTimer);
      e.commitTimer = window.setTimeout(() => e.commit(), 250);
    },
    report(phase) {
      if (phase && phase !== "tracing" && phase !== "loading") e.elapsed = performance.now() - e.startedAt;
      if (phase) e.phase = phase;
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        if (!valid()) return;
        const readings = scene.objs.flatMap((o, index) =>
          o.constructor.type === "Detector"
            ? [{ index, name: o.name || "探测器 " + (index + 1), power: Number(o.power ?? 0), normal: Number(o.normal ?? 0), shear: Number(o.shear ?? 0) }]
            : [],
        );
        const objError = scene.objs.map((o) => o.error).find(Boolean);
        const objWarning = scene.objs.map((o) => o.warning).find(Boolean);
        latest.current.onTrace({
          phase: e.loadError ? "error" : e.phase,
          rays: sim.processedRayCount,
          ms: Math.round(e.phase === "tracing" ? performance.now() - e.startedAt : e.elapsed),
          readings,
          error: e.loadError || htmlText(scene.error || sim.error || objError || ""),
          warning: htmlText(sim.warning || scene.warning || objWarning || ""),
        });
      });
    },
  };
  instance.current = e;
  function valid() {
    return e.alive && e.enabled && instance.current === e && latest.current.documentKey === key && !latest.current.disabled;
  }
  const showLayers = () => {
    const color = scene.colorMode !== "default" && gl !== null;
    glCanvas.style.display = color ? "" : "none";
    lightCanvas.style.display = color ? "none" : "";
    const bg = scene.theme.background.color;
    container.style.backgroundColor = `rgb(${Math.round(bg.r * 255)},${Math.round(bg.g * 255)},${Math.round(bg.b * 255)})`;
  };
  sim.on("update", showLayers);
  sim.on("webglContextLost", () => {
    glCanvas.style.display = "none";
    lightCanvas.style.display = "";
  });
  sim.on("simulationStart", () => {
    e.userStopped = false;
    e.startedAt = performance.now();
    e.report("tracing");
  });
  sim.on("simulationPause", () => e.report("tracing"));
  sim.on("simulationComplete", () => e.report("done"));
  sim.on("simulationStop", () => e.report(e.userStopped ? "stopped" : "limit"));
  sim.on("requestUpdateErrorAndWarning", () => e.report());
  editor.on("newAction", () => e.publish());
  editor.on("undo", () => {
    e.publish();
    latest.current.onSelection(-1);
  });
  editor.on("redo", () => {
    e.publish();
    latest.current.onSelection(-1);
  });
  editor.on("scaleChange", () => e.scheduleCommit());
  editor.on("selectionChange", (data) => {
    if (valid() && isRecord(data) && typeof data.newIndex === "number") latest.current.onSelection(data.newIndex);
  });
  editor.on("positioningStart", () => {
    if (valid()) {
      latest.current.onSelection(editor.positioningObjIndex);
      editor.endPositioning();
    }
  });
  try {
    sceneValue(latest.current.source);
    scene.loadJSON(latest.current.source, () => {});
    if (scene.error) throw Error(htmlText(scene.error));
    const json = scene.toJSON();
    Object.assign(editor, { undoData: [json], lastActionJson: json, undoIndex: 0, undoLBound: 0, undoUBound: 0 });
    editor.selectObj(latest.current.selected < scene.objs.length ? latest.current.selected : -1);
    showLayers();
    sim.updateSimulation(false, false);
  } catch (err) {
    const message = err instanceof Error ? err.message : "场景无法加载";
    setFailure(message);
    e.loadError = message;
    e.report("error");
  }
  const guards = (event: Event) => {
    if (!valid() || (event instanceof MouseEvent && event.ctrlKey && event.type !== "wheel")) {
      event.preventDefault();
      event.stopImmediatePropagation();
    }
  };
  const guarded = ["mousedown", "mousemove", "mouseup", "touchstart", "touchmove", "touchend", "wheel", "dblclick"];
  for (const name of guarded) top.addEventListener(name, guards, true);
  const keyboard = (event: KeyboardEvent) => {
    if (!valid()) return;
    const delta: Record<string, [number, number]> = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
    const selected = scene.objs[editor.selectedObjIndex];
    const mod = event.metaKey || event.ctrlKey;
    if (mod && event.key.toLowerCase() === "z") {
      event.preventDefault();
      if (event.shiftKey) editor.redo();
      else editor.undo();
    } else if (delta[event.key] && selected) {
      event.preventDefault();
      const [x, y] = delta[event.key];
      const step = (event.shiftKey ? 10 : 1) / scene.scale;
      selected.move(x * step, y * step);
      sim.updateSimulation(!selected.constructor.isOptical, true);
      e.scheduleCommit();
    } else if ((event.key === "Delete" || event.key === "Backspace") && selected) {
      event.preventDefault();
      editor.removeObj(editor.selectedObjIndex);
      sim.updateSimulation(false, true);
      e.commit();
      latest.current.onSelection(-1);
    } else if (event.key === "Escape") {
      editor.selectObj(-1);
      sim.updateSimulation(true, true);
      latest.current.onSelection(-1);
    }
  };
  top.addEventListener("keydown", keyboard);
  const resize = new ResizeObserver(() => {
    if (!e.alive) return;
    measure();
    sim.updateSimulation(false, false);
  });
  resize.observe(container);
  return () => {
    if (e.commitTimer) {
      clearTimeout(e.commitTimer);
      if (valid()) editor.onActionComplete();
    }
    e.alive = false;
    e.enabled = false;
    if (frame) cancelAnimationFrame(frame);
    resize.disconnect();
    if (instance.current === e) instance.current = null;
    if (sim.simulationTimerId !== -1) clearTimeout(sim.simulationTimerId);
    sim.simulationTimerId = -1;
    clearTimeout(editor.delayedValidationTimerId);
    if (editor.longPressTimer !== null) clearTimeout(editor.longPressTimer);
    sim.canvasRendererMain?.destroy?.();
    sim.eventListeners = {};
    editor.eventListeners = {};
    container.replaceChildren();
  };
}
