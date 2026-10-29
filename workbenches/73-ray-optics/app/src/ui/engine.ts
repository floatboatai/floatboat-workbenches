// Helpers around the vendored upstream core: lazy module loading, an ObjBar
// collector that turns upstream populateObjBar() calls into inspector controls,
// and HTML-to-text for upstream i18n strings.
import type { NativeObject } from "./vendor/ray-optics.js";

export type OpticsModule = typeof import("./vendor/ray-optics.js");
let modulePromise: Promise<OpticsModule> | null = null;
/** The 1.8 MB core is split from the shell and loaded once. */
export function loadOptics(): Promise<OpticsModule> {
  modulePromise ??= import("./vendor/ray-optics.js").catch((error: unknown) => {
    modulePromise = null;
    throw error;
  });
  return modulePromise;
}

export function htmlText(html: unknown): string {
  if (typeof html !== "string" || !html) return "";
  if (!/[<&]/.test(html)) return html;
  const doc = new DOMParser().parseFromString(html, "text/html");
  doc.querySelectorAll("p,br,li").forEach((el) => el.append(" "));
  return (doc.body.textContent ?? "").replace(/\s+/g, " ").trim();
}

export type ControlKind = "number" | "boolean" | "dropdown" | "text" | "equation" | "tuple" | "button" | "info" | "note";
export interface Control {
  id: string;
  kind: ControlKind;
  label: string;
  info: string;
  value: string | number | boolean;
  min?: number;
  max?: number;
  step?: number;
  slider?: boolean;
  options?: [string, string][];
}
type Setter = (obj: NativeObject, value: unknown) => void;

/** Duck-typed stand-in for upstream src/app/services/objBar.js. */
export class ObjBarCollector {
  targetObj: NativeObject;
  shouldShowAdvanced: boolean;
  shouldApplyToAll = false;
  usesPrimitiveEngine = false;
  title = "";
  hasAdvanced = false;
  controls: Control[] = [];
  setters: (Setter | null)[] = [];
  eventListeners: Record<string, unknown[]> = {};
  constructor(target: NativeObject, advanced: boolean) {
    this.targetObj = target;
    this.shouldShowAdvanced = advanced;
  }
  private push(control: Omit<Control, "id" | "info"> & { info?: unknown }, setter: Setter | null) {
    const label = htmlText(control.label);
    this.controls.push({
      ...control,
      label,
      info: htmlText(control.info),
      id: this.controls.length + ":" + control.kind + ":" + label,
    });
    this.setters.push(setter);
  }
  on() {}
  emit() {}
  setTitle(title: string) {
    this.title = htmlText(title);
  }
  createNumber(label: string, min: number, max: number, step: number, value: unknown, func: Setter, info?: string, hideSlider?: boolean) {
    const n = Number(value);
    this.push(
      { kind: "number", label, info, value: Number.isFinite(n) ? Math.round(n * 1e6) / 1e6 : String(value ?? ""), min, max, step, slider: !hideSlider },
      func,
    );
  }
  createTuple(label: string, value: unknown, func: Setter, info?: string) {
    this.push({ kind: "tuple", label, info, value: String(value ?? "") }, func);
  }
  createText(label: string, value: unknown, func: Setter) {
    this.push({ kind: "text", label, value: String(value ?? "") }, func);
  }
  createBoolean(label: string, value: unknown, func: Setter, info?: string) {
    this.push({ kind: "boolean", label, info, value: Boolean(value) }, func);
  }
  createEquation(label: string, value: unknown, func: Setter, info?: string) {
    this.push({ kind: "equation", label, info, value: String(value ?? "") }, func);
  }
  createDropdown(label: string, value: unknown, options: Record<string, string>, func: Setter, info?: string) {
    this.push(
      {
        kind: "dropdown",
        label,
        info,
        value: String(value),
        options: Object.entries(options).map(([k, v]) => [k, htmlText(v)]),
      },
      func,
    );
  }
  createButton(label: string, func: (obj: NativeObject) => void) {
    this.push({ kind: "button", label, value: "" }, (obj) => func(obj));
  }
  createInfoBox(info: string) {
    this.push({ kind: "info", label: "", info, value: "" }, null);
  }
  createNote(content: string) {
    this.push({ kind: "note", label: content, value: "" }, null);
  }
  createStyleControl() {}
  createStrokeStyleControl() {}
  createFillStyleControl() {}
  setOption(func: (obj: NativeObject) => void) {
    func(this.targetObj);
  }
  showAdvanced(condition: boolean) {
    if (this.shouldShowAdvanced || condition) return true;
    this.hasAdvanced = true;
    return false;
  }
}

/** Parse an inspector input into the value an upstream setter expects, or null if unfinished. */
export function parseControl(control: Control, raw: string | boolean): unknown {
  if (control.kind === "boolean") return Boolean(raw);
  if (control.kind === "number") {
    const text = String(raw).trim();
    if (!text || !/^[-+]?(\d+\.?\d*|\.\d+)(e[-+]?\d+)?$/i.test(text)) return null;
    const n = Number(text);
    return Number.isFinite(n) ? n : null;
  }
  if (control.kind === "dropdown") return control.options?.some(([k]) => k === raw) ? raw : null;
  return String(raw);
}
