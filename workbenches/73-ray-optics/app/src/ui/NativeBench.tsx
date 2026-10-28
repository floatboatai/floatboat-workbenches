import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import { Scene, Simulator, Editor, sceneObjs } from "./vendor/ray-optics.js";
import {
  sceneValue,
  makeObject,
  MAX_OBJECTS,
  type OpticalObject,
} from "../contracts/optics";
import { isRecord } from "../contracts/project";
export interface Reading {
  index: number;
  name: string;
  power: number;
  normal: number;
  shear: number;
}
export interface BenchHandle {
  inspect(index: number): OpticalObject | null;
  run(): void;
  stop(): void;
  add(type: string): void;
  select(index: number): void;
  remove(index: number): void;
  nudge(index: number, x: number, y: number): void;
  update(index: number, base: string, object: OpticalObject): void;
  fit(): void;
  zoom(factor: number): void;
  png(): Promise<Blob>;
  suspend(): () => void;
}
interface Props {
  documentKey: string;
  source: string;
  disabled: boolean;
  selected: number;
  onScene(source: string): void;
  onSelection(index: number): void;
  onError(error: unknown): void;
  onInvalidate(): void;
  onResult(readings: Reading[], rays: number, truncated: boolean): void;
}
interface RunStamp {
  revision: number;
  wire: string;
}
interface Engine {
  key: string;
  alive: boolean;
  enabled: boolean;
  scene: Scene;
  editor: Editor;
  sim: Simulator;
  wire: string;
  revision: number;
  activeRun: RunStamp | null;
  completedRun: RunStamp | null;
  invalidate(notify?: boolean): void;
  canvases: HTMLCanvasElement[];
  select(index: number): void;
  publish(): void;
  run(): void;
}
export const NativeBench = forwardRef<BenchHandle, Props>(
  function NativeBench(props, ref) {
    const host = useRef<HTMLDivElement>(null),
      instance = useRef<Engine | null>(null),
      latest = useRef(props);
    latest.current = props;
    const [phase, setPhase] = useState<
        "idle" | "stale" | "running" | "ready" | "stopped"
      >("idle"),
      [error, setError] = useState("");
    function current() {
      const e = instance.current;
      return e?.alive &&
        e.enabled &&
        e.key === latest.current.documentKey &&
        !latest.current.disabled
        ? e
        : null;
    }
    useImperativeHandle(
      ref,
      () => ({
        inspect(index) {
          const e = current();
          return (e?.scene.objs[index]?.serialize() as OpticalObject) ?? null;
        },
        run() {
          current()?.run();
        },
        stop() {
          const e = current();
          if (e) {
            e.invalidate();
            setPhase("stopped");
          }
        },
        add(type) {
          const e = current();
          if (!e) return;
          if (e.scene.objs.length >= MAX_OBJECTS)
            throw Error("最多 100 个元件。");
          const value = makeObject(type, e.scene.objs.length);
          const Constructor = sceneObjs[type];
          e.scene.pushObj(new Constructor(e.scene, value));
          e.editor.selectObj(e.scene.objs.length - 1);
          e.editor.onActionComplete();
          e.sim.updateSimulation(true, false);
        },
        select(index) {
          current()?.select(index);
        },
        remove(index) {
          const e = current();
          if (!e || !e.scene.objs[index]) return;
          e.editor.removeObj(index);
          e.editor.onActionComplete();
          e.sim.updateSimulation(true, false);
        },
        nudge(index, x, y) {
          const e = current();
          if (!e || !e.scene.objs[index]) return;
          e.scene.objs[index].move(x, y);
          e.editor.onActionComplete();
          e.sim.updateSimulation(true, false);
        },
        update(index, base, object) {
          const e = current();
          if (!e) throw Error("画布尚未就绪。");
          const old = e.scene.objs[index];
          if (!old || JSON.stringify(old.serialize()) !== base)
            throw Error(
              "元件已在画布中变化，参数稿仍保留。请先复制所需内容，再重新读取参数。",
            );
          const next = JSON.parse(e.scene.toJSON()) as {
            objs: OpticalObject[];
          };
          next.objs[index] = object;
          sceneValue(JSON.stringify(next));
          e.scene.objs[index] = new sceneObjs[object.type](e.scene, object);
          e.editor.onActionComplete();
          e.sim.updateSimulation(true, false);
        },
        fit() {
          const e = current();
          if (!e) return;
          const values = e.scene.objs.flatMap((o) => {
            const d = o.serialize();
            return [
              d.p1,
              d.p2,
              typeof d.x === "number" ? { x: d.x, y: d.y } : null,
            ].filter(
              (p): p is { x: number; y: number } =>
                isRecord(p) &&
                typeof p.x === "number" &&
                typeof p.y === "number",
            );
          });
          if (!values.length) return;
          const minX = Math.min(...values.map((p) => p.x)),
            maxX = Math.max(...values.map((p) => p.x)),
            minY = Math.min(...values.map((p) => p.y)),
            maxY = Math.max(...values.map((p) => p.y));
          e.scene.scale = Math.min(
            2,
            Math.max(
              0.05,
              Math.min(
                (e.scene.width - 90) / (maxX - minX + 80),
                (e.scene.height - 90) / (maxY - minY + 80),
              ),
            ),
          );
          e.scene.origin = {
            x: e.scene.width / 2 - ((minX + maxX) / 2) * e.scene.scale,
            y: e.scene.height / 2 - ((minY + maxY) / 2) * e.scene.scale,
          };
          e.editor.onActionComplete();
          e.sim.updateSimulation(true, false);
        },
        zoom(factor) {
          const e = current();
          if (!e) return;
          e.editor.setScale(
            Math.min(8, Math.max(0.05, e.scene.scale * factor)),
          );
          e.editor.onActionComplete();
        },
        async png() {
          const e = current();
          if (!e) throw Error("画布尚未就绪。");
          if (
            phase !== "ready" ||
            !e.completedRun ||
            e.completedRun.revision !== e.revision ||
            e.completedRun.wire !== e.scene.toJSON()
          )
            throw Error("请先计算当前光路，再导出图像。");
          const frozen = document.createElement("canvas");
          frozen.width = e.canvases[0].width;
          frozen.height = e.canvases[0].height;
          const context = frozen.getContext("2d");
          if (!context) throw Error("图像导出不可用。");
          context.fillStyle = "#0b1119";
          context.fillRect(0, 0, frozen.width, frozen.height);
          for (const c of e.canvases) context.drawImage(c, 0, 0);
          return new Promise<Blob>((resolve, reject) =>
            frozen.toBlob(
              (b) => (b ? resolve(b) : reject(Error("无法导出图像。"))),
              "image/png",
            ),
          );
        },
        suspend() {
          const e = instance.current;
          if (e) {
            e.invalidate();
            e.enabled = false;
          }
          return () => {
            if (e?.alive && e.key === latest.current.documentKey)
              e.enabled = true;
          };
        },
      }),
      [phase],
    );
    useEffect(() => {
      if (!host.current) return;
      const container = host.current,
        key = props.documentKey;
      setError("");
      setPhase("idle");
      const canvases = Array.from({ length: 4 }, (_, i) => {
        const c = document.createElement("canvas");
        c.className = "optical-layer layer-" + i;
        c.setAttribute("aria-hidden", String(i !== 3));
        container.append(c);
        return c;
      });
      const top = canvases[3];
      top.tabIndex = 0;
      top.setAttribute(
        "aria-label",
        "光路画布：拖动元件，方向键微调，使用参数区精确编辑",
      );
      top.setAttribute("role", "img");
      const scene = new Scene();
      const contexts = canvases.map((c) => c.getContext("2d"));
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const measure = () => {
        const box = container.getBoundingClientRect();
        const w = Math.max(240, Math.round(box.width)),
          h = Math.max(320, Math.round(box.height));
        canvases.forEach((c) => {
          c.width = Math.round(w * dpr);
          c.height = Math.round(h * dpr);
        });
        scene.setViewportSize(w, h);
      };
      measure();
      const sim = new Simulator(
        scene,
        contexts[2],
        contexts[1],
        contexts[3],
        contexts[0],
        document.createElement("canvas").getContext("2d"),
        true,
        10000,
      );
      sim.dpr = dpr;
      sim.manualLightRedraw = true;
      const editor = new Editor(scene, top, sim);
      let publishing = false,
        initialized = false;
      const e: Engine = {
        key,
        alive: true,
        enabled: true,
        scene,
        editor,
        sim,
        wire: props.source,
        revision: 0,
        activeRun: null,
        completedRun: null,
        invalidate(notify = true) {
          e.revision++;
          e.activeRun = null;
          e.completedRun = null;
          if (sim.simulationTimerId !== -1) clearTimeout(sim.simulationTimerId);
          sim.simulationTimerId = -1;
          sim.shouldSimulatorStop = false;
          sim.pendingRays = [];
          if (notify && e.alive && latest.current.documentKey === key) {
            setPhase((value) => (value === "idle" ? "idle" : "stale"));
            latest.current.onInvalidate();
          }
        },
        canvases,
        select(index) {
          if (valid()) {
            editor.selectObj(index);
            sim.updateSimulation(true, true);
          }
        },
        publish() {
          if (
            !valid() ||
            !initialized ||
            publishing ||
            latest.current.source !== e.wire
          )
            return;
          const wire = scene.toJSON();
          if (wire === e.wire) return;
          e.wire = wire;
          e.invalidate();
          setPhase("stale");
          latest.current.onScene(wire);
        },
        run() {
          if (!valid()) return;
          try {
            const wire = scene.toJSON();
            sceneValue(wire);
            e.invalidate();
            const stamp: RunStamp = { revision: e.revision, wire };
            e.activeRun = stamp;
            sim.eventListeners.simulationComplete = [
              () => result(false, stamp),
            ];
            sim.eventListeners.simulationStop = [() => result(true, stamp)];
            setError("");
            setPhase("running");
            sim.manualRedrawLightLayer();
          } catch (err) {
            setError(err instanceof Error ? err.message : "无法计算光路");
            latest.current.onError(err);
          }
        },
      };
      instance.current = e;
      function valid() {
        return (
          e.alive &&
          e.enabled &&
          instance.current === e &&
          latest.current.documentKey === key &&
          !latest.current.disabled
        );
      }
      // Upstream Editor owns mouse geometry and selection. The wrapper owns document epochs.
      try {
        sceneValue(props.source);
        scene.loadJSON(props.source, () => {});
        if (scene.error) throw Error(scene.error);
        editor.selectObj(props.selected);
        sim.updateSimulation(true, false);
        initialized = true;
      } catch (err) {
        setError(err instanceof Error ? err.message : "场景无法加载");
        latest.current.onError(err);
      }
      editor.on("newAction", () => e.publish());
      editor.on("scaleChange", () => e.publish());
      editor.on("undo", () => e.publish());
      editor.on("redo", () => e.publish());
      editor.on("selectionChange", (data) => {
        if (valid() && isRecord(data) && typeof data.newIndex === "number")
          latest.current.onSelection(data.newIndex);
      });
      editor.on("positioningStart", () => {
        if (valid()) {
          latest.current.onSelection(editor.positioningObjIndex);
          editor.endPositioning();
        }
      });
      sim.on("lightLayerSyncChange", (data) => {
        if (valid() && isRecord(data) && data.isSynced === false)
          setPhase("stale");
      });
      const result = (stopped: boolean, stamp: RunStamp) => {
        if (
          !valid() ||
          e.activeRun !== stamp ||
          stamp.revision !== e.revision ||
          stamp.wire !== scene.toJSON()
        )
          return;
        e.activeRun = null;
        e.completedRun = stopped ? null : stamp;
        const readings = scene.objs.flatMap((o, index) =>
          o.serialize().type === "Detector"
            ? [
                {
                  index,
                  name: o.name || "探测器",
                  power: o.power ?? 0,
                  normal: o.normal ?? 0,
                  shear: o.shear ?? 0,
                },
              ]
            : [],
        );
        setPhase(stopped ? "stopped" : "ready");
        latest.current.onResult(
          readings,
          sim.processedRayCount,
          sim.processedRayCount >= 10000,
        );
      };

      const moving = (event: MouseEvent | TouchEvent) => {
        if (!valid()) return;
        if (event instanceof MouseEvent && event.buttons !== 1) return;
        e.publish();
        queueMicrotask(() => e.publish());
      };
      top.addEventListener("mousemove", moving);
      top.addEventListener("touchmove", moving);
      const guards = (event: Event) => {
        if (!valid() || (event instanceof MouseEvent && event.ctrlKey)) {
          event.preventDefault();
          event.stopImmediatePropagation();
        }
      };
      for (const name of [
        "mousedown",
        "mousemove",
        "mouseup",
        "touchstart",
        "touchmove",
        "touchend",
        "wheel",
        "dblclick",
      ])
        top.addEventListener(name, guards, true);
      const keyboard = (event: KeyboardEvent) => {
        const delta: Record<string, [number, number]> = {
          ArrowLeft: [-1, 0],
          ArrowRight: [1, 0],
          ArrowUp: [0, -1],
          ArrowDown: [0, 1],
        };
        if (
          valid() &&
          delta[event.key] &&
          scene.objs[editor.selectedObjIndex]
        ) {
          event.preventDefault();
          const [x, y] = delta[event.key];
          scene.objs[editor.selectedObjIndex].move(
            x * (event.shiftKey ? 10 : 1),
            y * (event.shiftKey ? 10 : 1),
          );
          editor.onActionComplete();
          sim.updateSimulation(true, false);
        }
      };
      top.addEventListener("keydown", keyboard);
      const resize = new ResizeObserver(() => {
        if (!e.alive) return;
        publishing = true;
        e.invalidate();
        measure();
        sim.updateSimulation(true, false);
        publishing = false;
      });
      resize.observe(container);
      return () => {
        e.alive = false;
        e.invalidate(false);
        e.enabled = false;
        initialized = false;
        resize.disconnect();
        if (instance.current === e) instance.current = null;
        sim.stopSimulation();
        if (sim.simulationTimerId !== -1) clearTimeout(sim.simulationTimerId);
        clearTimeout(editor.delayedValidationTimerId);
        if (editor.longPressTimer !== null) clearTimeout(editor.longPressTimer);
        sim.eventListeners = {};
        editor.eventListeners = {};
        container.replaceChildren();
      };
    }, [props.documentKey]);
    useEffect(() => {
      const e = instance.current;
      if (!e?.alive || e.key !== props.documentKey || e.wire === props.source)
        return;
      try {
        sceneValue(props.source);
        e.invalidate();
        e.scene.loadJSON(props.source, () => {});
        if (e.scene.error) throw Error(e.scene.error);
        e.wire = props.source;
        e.editor.selectObj(props.selected);
        e.sim.updateSimulation(true, false);
        setPhase("stale");
        setError("");
      } catch (err) {
        setError(err instanceof Error ? err.message : "场景无法加载");
      }
    }, [props.source, props.documentKey]);
    return (
      <div className={"bench " + phase} aria-busy={phase === "running"}>
        <div ref={host} className="canvas-host" inert={props.disabled} />
        <div className="bench-label">
          <span>OPTICAL BENCH</span>
          <span role="status">
            {error ||
              {
                idle: "场景已恢复 · 点击计算光路",
                stale: "场景已更改 · 需要重新计算",
                running: "正在追踪光线…",
                ready: "光路已计算",
                stopped: "计算已停止",
              }[phase]}
          </span>
        </div>
      </div>
    );
  },
);
