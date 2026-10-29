import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import type { NativeObject } from "./vendor/ray-optics.js";
import { loadOptics, htmlText, ObjBarCollector, parseControl, type Control } from "./engine";
import { mountBench, type Engine } from "./bench-mount";
import { sceneValue, objectValue, qualityBudgets, MAX_OBJECTS, type OpticalObject, type Quality } from "../contracts/optics";
import { objectNames, presetObject } from "../contracts/catalog";
import { isRecord } from "../contracts/project";

export interface Reading {
  index: number;
  name: string;
  power: number;
  normal: number;
  shear: number;
}
export type TracePhase = "loading" | "tracing" | "done" | "limit" | "stopped" | "error";
export interface Trace {
  phase: TracePhase;
  rays: number;
  ms: number;
  readings: Reading[];
  error: string;
  warning: string;
}
export interface PointField {
  key: string;
  label: string;
  x: number;
  y: number;
}
export interface Inspection {
  index: number;
  type: string;
  title: string;
  name: string;
  controls: Control[];
  hasAdvanced: boolean;
  points: PointField[];
}
export type ScenePatch = Partial<{
  mode: string;
  simulateColors: boolean;
  colorMode: string;
  rayModeDensity: number;
  imageModeDensity: number;
  showGrid: boolean;
  snapToGrid: boolean;
  gridSize: number;
  redWavelength: number;
  violetWavelength: number;
  showRayArrows: boolean;
  maxRayDepth: number | null;
  observerR: number;
}>;
export interface BenchHandle {
  inspect(index: number, advanced: boolean): Inspection | null;
  setControl(index: number, advanced: boolean, id: string, raw: string | boolean): boolean;
  setName(index: number, name: string): void;
  setPoint(index: number, key: string, x: number, y: number): void;
  add(type: string): void;
  duplicate(index: number): void;
  select(index: number): void;
  remove(index: number): void;
  nudge(index: number, x: number, y: number): void;
  setScene(patch: ScenePatch): void;
  undo(): void;
  redo(): void;
  stop(): void;
  retrace(): void;
  fit(): void;
  zoom(factor: number): void;
  png(): Promise<{ blob: Blob; partial: boolean }>;
  suspend(): () => void;
}
interface Props {
  documentKey: string;
  source: string;
  quality: Quality;
  disabled: boolean;
  selected: number;
  onScene(source: string): void;
  onSelection(index: number): void;
  onChange(): void;
  onTrace(trace: Trace): void;
  onError(error: unknown): void;
}

function valueAt(data: Record<string, unknown>, key: string): unknown {
  if (!key) return data;
  return key.split(".").reduce<unknown>((v, k) => (isRecord(v) || Array.isArray(v) ? (v as Record<string, unknown>)[k] : undefined), data);
}
function boundsOf(objs: NativeObject[]) {
  const pts: { x: number; y: number }[] = [];
  const visit = (v: unknown, depth: number) => {
    if (depth > 3) return;
    if (isRecord(v) && typeof v.x === "number" && typeof v.y === "number") pts.push({ x: v.x, y: v.y });
    else if (Array.isArray(v)) v.forEach((x) => visit(x, depth + 1));
    else if (isRecord(v)) for (const k of ["p1", "p2", "p3", "p4", "path"]) visit(v[k], depth + 1);
  };
  for (const o of objs) visit(o.serialize(), 0);
  return pts;
}

export const NativeBench = forwardRef<BenchHandle, Props>(function NativeBench(props, ref) {
  const host = useRef<HTMLDivElement>(null),
    instance = useRef<Engine | null>(null),
    latest = useRef(props);
  latest.current = props;
  const [failure, setFailure] = useState("");

  function current() {
    const e = instance.current;
    return e?.alive && e.enabled && e.key === latest.current.documentKey && !latest.current.disabled ? e : null;
  }
  function need() {
    const e = current();
    if (!e) throw Error("光学平台尚未就绪。");
    return e;
  }
  function collect(e: Engine, index: number, advanced: boolean) {
    const obj = e.scene.objs[index];
    if (!obj) return null;
    const bar = new ObjBarCollector(obj, advanced);
    obj.populateObjBar(bar);
    return { obj, bar };
  }
  function changed(e: Engine, obj: NativeObject | null) {
    e.sim.updateSimulation(obj ? !obj.constructor.isOptical : false, true);
    e.scheduleCommit();
    latest.current.onChange();
  }

  useImperativeHandle(ref, () => ({
    inspect(index, advanced) {
      const e = current();
      if (!e) return null;
      const got = collect(e, index, advanced);
      if (!got) return null;
      const { obj, bar } = got;
      const data = obj.serialize();
      const type = obj.constructor.type;
      let points: PointField[] = [];
      try {
        points = obj.constructor
          .getPropertySchema(data, e.scene)
          .filter((d) => d.type === "point")
          .flatMap((d) => {
            const v = valueAt(data, d.key);
            return isRecord(v) && typeof v.x === "number" && typeof v.y === "number"
              ? [{ key: d.key, label: htmlText(d.label) || "位置", x: v.x, y: v.y }]
              : [];
          });
      } catch {
        points = [];
      }
      return {
        index,
        type,
        title: bar.title || objectNames[type] || type,
        name: obj.name,
        controls: bar.controls,
        hasAdvanced: bar.hasAdvanced,
        points,
      };
    },
    setControl(index, advanced, id, raw) {
      const e = need();
      const got = collect(e, index, advanced);
      if (!got) throw Error("元件已不存在。");
      const at = got.bar.controls.findIndex((c) => c.id === id);
      const setter = got.bar.setters[at];
      if (at < 0 || !setter) throw Error("参数已变化，请重新选择元件。");
      const value = parseControl(got.bar.controls[at], raw);
      if (value === null) return false;
      got.bar.setOption((obj) => setter(obj, value));
      changed(e, got.obj);
      return true;
    },
    setName(index, name) {
      const e = need();
      const obj = e.scene.objs[index];
      if (!obj) return;
      obj.name = name.slice(0, 120);
      changed(e, null);
    },
    setPoint(index, key, x, y) {
      const e = need();
      const obj = e.scene.objs[index];
      if (!obj) throw Error("元件已不存在。");
      const data = structuredClone(obj.serialize()) as Record<string, unknown>;
      if (!key) Object.assign(data, { x, y });
      else {
        const parts = key.split(".");
        const target = valueAt(data, parts.join("."));
        if (!isRecord(target)) throw Error("控制点不存在。");
        target.x = x;
        target.y = y;
      }
      objectValue(data);
      e.scene.objs[index] = new e.mod.sceneObjs[obj.constructor.type](e.scene, data);
      changed(e, null);
    },
    add(type) {
      const e = need();
      if (e.scene.objs.length >= MAX_OBJECTS) throw Error("场景最多 " + MAX_OBJECTS + " 个元件。");
      const s = e.scene;
      const center = { x: (s.width / 2 - s.origin.x) / s.scale, y: (s.height / 2 - s.origin.y) / s.scale };
      const ordinal = s.objs.filter((o) => o.constructor.type === type).length + 1;
      const data = presetObject(type, center, 70 / s.scale, ordinal);
      s.pushObj(new e.mod.sceneObjs[type](s, data));
      e.editor.selectObj(s.objs.length - 1);
      changed(e, null);
      e.commit();
      latest.current.onSelection(s.objs.length - 1);
    },
    duplicate(index) {
      const e = need();
      const obj = e.scene.objs[index];
      if (!obj) return;
      if (e.scene.objs.length >= MAX_OBJECTS) throw Error("场景最多 " + MAX_OBJECTS + " 个元件。");
      const copy = new e.mod.sceneObjs[obj.constructor.type](e.scene, structuredClone(obj.serialize()));
      copy.move(24 / e.scene.scale, 24 / e.scene.scale);
      e.scene.pushObj(copy);
      e.editor.selectObj(e.scene.objs.length - 1);
      changed(e, null);
      e.commit();
      latest.current.onSelection(e.scene.objs.length - 1);
    },
    select(index) {
      const e = current();
      if (!e) return;
      e.editor.selectObj(index);
      e.sim.updateSimulation(true, true);
      latest.current.onSelection(index);
    },
    remove(index) {
      const e = need();
      if (!e.scene.objs[index]) return;
      e.editor.removeObj(index);
      changed(e, null);
      e.commit();
      latest.current.onSelection(-1);
    },
    nudge(index, x, y) {
      const e = need();
      const obj = e.scene.objs[index];
      if (!obj) return;
      obj.move(x, y);
      changed(e, obj);
    },
    setScene(patch) {
      const e = need();
      const s = e.scene;
      for (const [k, v] of Object.entries(patch)) {
        if (k === "observerR") {
          if (s.observer && typeof v === "number" && v > 0) s.observer.r = v;
        } else (s as unknown as Record<string, unknown>)[k] = v;
      }
      if (s.mode === "observer" && !s.observer)
        s.observer = { c: { x: (s.width * 0.5 - s.origin.x) / s.scale, y: (s.height * 0.5 - s.origin.y) / s.scale }, r: 20 };
      if (patch.simulateColors !== undefined) e.editor.selectObj(e.editor.selectedObjIndex);
      e.sim.updateSimulation(false, false);
      e.commit();
      latest.current.onChange();
    },
    undo() {
      need().editor.undo();
    },
    redo() {
      need().editor.redo();
    },
    stop() {
      const e = current();
      if (e && e.sim.simulationTimerId !== -1) {
        e.userStopped = true;
        e.sim.stopSimulation();
      }
    },
    retrace() {
      const e = need();
      e.sim.updateSimulation(false, false);
    },
    fit() {
      const e = need();
      const pts = boundsOf(e.scene.objs);
      if (!pts.length) return;
      const minX = Math.min(...pts.map((p) => p.x)),
        maxX = Math.max(...pts.map((p) => p.x)),
        minY = Math.min(...pts.map((p) => p.y)),
        maxY = Math.max(...pts.map((p) => p.y));
      const s = e.scene;
      s.scale = Math.min(20, Math.max(0.01, Math.min((s.width - 80) / (maxX - minX + 60), (s.height - 80) / (maxY - minY + 60))));
      s.origin = { x: s.width / 2 - ((minX + maxX) / 2) * s.scale, y: s.height / 2 - ((minY + maxY) / 2) * s.scale };
      e.sim.updateSimulation(false, false);
      e.commit();
    },
    zoom(factor) {
      const e = need();
      const s = e.scene;
      e.editor.setScaleWithCenter(Math.min(20, Math.max(0.01, s.scale * factor)), s.width / 2 / s.scale, s.height / 2 / s.scale);
      e.commit();
    },
    async png() {
      const e = need();
      const deadline = Date.now() + 20000;
      while (e.alive && e.sim.simulationTimerId !== -1 && Date.now() < deadline) await new Promise((r) => setTimeout(r, 60));
      if (!e.alive) throw Error("实验已切换，未导出图像。");
      const [first] = e.canvases;
      const frozen = document.createElement("canvas");
      frozen.width = first.width;
      frozen.height = first.height;
      const context = frozen.getContext("2d");
      if (!context) throw Error("图像导出不可用。");
      const bg = e.scene.theme.background.color;
      context.fillStyle = `rgb(${Math.round(bg.r * 255)},${Math.round(bg.g * 255)},${Math.round(bg.b * 255)})`;
      context.fillRect(0, 0, frozen.width, frozen.height);
      for (const c of e.canvases) if (c.style.display !== "none") context.drawImage(c, 0, 0);
      const partial = e.phase !== "done";
      const blob = await new Promise<Blob>((resolve, reject) =>
        frozen.toBlob((b) => (b ? resolve(b) : reject(Error("无法导出图像。"))), "image/png"),
      );
      return { blob, partial };
    },
    suspend() {
      const e = instance.current;
      if (e) {
        e.commit();
        e.enabled = false;
      }
      return () => {
        if (e?.alive && e.key === latest.current.documentKey) e.enabled = true;
      };
    },
  }));

  useEffect(() => {
    const container = host.current;
    if (!container) return;
    const key = props.documentKey;
    let disposed = false;
    let cleanup = () => {};
    setFailure("");
    latest.current.onTrace({ phase: "loading", rays: 0, ms: 0, readings: [], error: "", warning: "" });
    loadOptics()
      .then((mod) => {
        if (disposed) return;
        cleanup = mountBench(mod, container, key, { latest, instance, setFailure });
      })
      .catch((err: unknown) => {
        if (disposed) return;
        const message = "光学内核加载失败：" + (err instanceof Error ? err.message : String(err)) + "。请刷新重试。";
        setFailure(message);
        latest.current.onTrace({ phase: "error", rays: 0, ms: 0, readings: [], error: message, warning: "" });
      });
    return () => {
      disposed = true;
      cleanup();
    };
  }, [props.documentKey]);


  useEffect(() => {
    const e = instance.current;
    if (!e?.alive || e.key !== props.documentKey || e.source === props.source) return;
    try {
      sceneValue(props.source);
      e.editor.loadJSON(props.source);
      if (e.scene.error) throw Error(htmlText(e.scene.error));
      e.source = props.source;
      e.loadError = "";
      e.editor.onActionComplete();
      setFailure("");
    } catch (err) {
      e.loadError = err instanceof Error ? err.message : "场景无法加载";
      setFailure(e.loadError);
      e.report("error");
    }
  }, [props.source, props.documentKey]);

  useEffect(() => {
    const e = instance.current;
    if (!e?.alive) return;
    e.sim.rayCountLimit = qualityBudgets[props.quality].rays;
    e.sim.updateSimulation(false, true);
  }, [props.quality]);

  return (
    <div className="bench" aria-busy={false}>
      <div ref={host} className="canvas-host" inert={props.disabled} />
      {failure ? (
        <p className="bench-failure" role="alert">
          {failure}
        </p>
      ) : null}
    </div>
  );
});

export type { OpticalObject };
