import { Canvas, Ellipse, FabricObject, Rect, Textbox } from "fabric";
import {
  object,
  validatePoster,
  type Poster,
  type PosterObject,
} from "../contracts/poster";

function options(value: PosterObject) {
  return {
    left: value.x,
    top: value.y,
    width: value.width,
    height: value.height,
    originX: "left" as const,
    originY: "top" as const,
    scaleX: value.scaleX,
    scaleY: value.scaleY,
    angle: value.angle,
    opacity: value.opacity,
    fill: value.fill,
    stroke: value.stroke,
    strokeWidth: value.strokeWidth,
    lockSkewingX: true,
    lockSkewingY: true,
    lockScalingFlip: true,
    minScaleLimit: 0.01,
    cornerColor: "#dce578",
    borderColor: "#49694a",
    cornerStrokeColor: "#244b39",
    transparentCorners: false,
    cornerSize: 12,
    padding: 3,
    strokeUniform: true,
  };
}
function create(value: PosterObject): FabricObject {
  const opts = options(value);
  if (value.type === "text")
    return new Textbox(value.text, {
      ...opts,
      fontSize: value.fontSize,
      fontFamily: value.fontFamily,
      fontWeight: value.fontWeight,
      textAlign: value.textAlign,
      splitByGrapheme: true,
      lineHeight: 1.12,
    });
  if (value.type === "ellipse")
    return new Ellipse({ ...opts, rx: value.width / 2, ry: value.height / 2 });
  return new Rect({ ...opts, rx: value.radius, ry: value.radius });
}
export class PosterEngine {
  readonly canvas: Canvas;
  private records = new Map<FabricObject, PosterObject>();
  private current: Poster;
  private history: Poster[] = [];
  private cursor = 0;
  private suppress = false;
  private displayScale = 1;
  constructor(
    element: HTMLCanvasElement,
    initial: Poster,
    private change: (data: Poster) => void,
    private selection: (id: string | null) => void,
    private report: (error: unknown) => void,
    private historyChange: (undo: boolean, redo: boolean) => void,
  ) {
    this.current = initial;
    this.canvas = new Canvas(element, {
      preserveObjectStacking: true,
      selection: false,
      enableRetinaScaling: true,
      stopContextMenu: true,
    });
    this.load(initial);
    const normalized = validatePoster(this.snapshot());
    this.history = [normalized];
    this.historyChange(false, false);
    if (JSON.stringify(normalized) !== JSON.stringify(initial))
      this.change(normalized);
    this.current = normalized;
    this.canvas.on("object:modified", () => this.commit());
    this.canvas.on("text:changed", () => this.commit());
    const selected = () =>
      this.selection(
        this.records.get(this.canvas.getActiveObject() as FabricObject)?.id ??
          null,
      );
    this.canvas.on("selection:created", selected);
    this.canvas.on("selection:updated", selected);
    this.canvas.on("selection:cleared", selected);
    this.canvas.on("text:editing:entered", ({ target }) => {
      target.hiddenTextarea?.setAttribute("aria-label", "画板文字编辑");
    });
  }
  private snapshot(): Poster {
    return {
      ...this.current,
      objects: this.canvas.getObjects().map((item) => {
        const value = this.records.get(item);
        if (!value) throw new Error("对象未登记。");
        return {
          ...value,
          x: item.left,
          y: item.top,
          width: item.width,
          height: item.height,
          scaleX: item.scaleX,
          scaleY: item.scaleY,
          angle: item.angle,
          opacity: item.opacity,
          fill: typeof item.fill === "string" ? item.fill : value.fill,
          stroke: typeof item.stroke === "string" ? item.stroke : value.stroke,
          strokeWidth: item.strokeWidth,
          ...(item instanceof Textbox
            ? {
                text: item.text,
                fontSize: item.fontSize,
                fontFamily: item.fontFamily as PosterObject["fontFamily"],
                fontWeight: item.fontWeight as PosterObject["fontWeight"],
                textAlign: item.textAlign as PosterObject["textAlign"],
              }
            : {}),
        };
      }),
    };
  }
  private load(data: Poster) {
    this.suppress = true;
    this.canvas.discardActiveObject();
    this.canvas.remove(...this.canvas.getObjects());
    this.records.clear();
    this.current = structuredClone(data);
    this.canvas.setDimensions({ width: data.width, height: data.height });
    this.canvas.backgroundColor = data.background;
    for (const value of data.objects) {
      const item = create(value);
      this.records.set(item, value);
      this.canvas.add(item);
    }
    this.canvas.requestRenderAll();
    this.selection(null);
    this.scale(this.displayScale);
    this.suppress = false;
  }
  private commit(): boolean {
    if (this.suppress) return true;
    try {
      const next = validatePoster(this.snapshot());
      if (JSON.stringify(next) === JSON.stringify(this.current)) return true;
      this.current = next;
      this.history = this.history.slice(0, this.cursor + 1);
      this.history.push(structuredClone(next));
      if (this.history.length > 60) this.history.shift();
      this.cursor = this.history.length - 1;
      this.historyChange(this.cursor > 0, false);
      this.change(next);
      this.canvas.requestRenderAll();
      return true;
    } catch (error) {
      this.load(this.current);
      this.report(error);
      return false;
    }
  }
  select(id: string) {
    const target = [...this.records].find(([, v]) => v.id === id)?.[0];
    if (target) {
      this.canvas.setActiveObject(target);
      this.canvas.requestRenderAll();
    }
  }
  clear() {
    this.canvas.discardActiveObject();
    this.canvas.requestRenderAll();
  }
  add(type: PosterObject["type"]) {
    if (this.canvas.size() >= 160) {
      this.report(new Error("最多支持 160 个对象。"));
      return;
    }
    const data = object(type, {
      x: Math.round(this.current.width * 0.15),
      y: Math.round(this.current.height * 0.18),
      width: Math.min(360, this.current.width * 0.65),
      height: 160,
    });
    const item = create(data);
    this.records.set(item, data);
    this.canvas.add(item);
    this.canvas.setActiveObject(item);
    this.commit();
  }
  update(id: string, patch: Partial<PosterObject>) {
    const target = [...this.records].find(([, v]) => v.id === id)?.[0];
    if (!target) return;
    const source = this.snapshot().objects.find((v) => v.id === id);
    if (!source) return;
    const next = validatePoster({
      ...this.current,
      objects: this.snapshot().objects.map((v) =>
        v.id === id ? { ...v, ...patch } : v,
      ),
    }).objects.find((v) => v.id === id);
    if (!next) return;
    target.set(options(next));
    if (target instanceof Textbox) {
      target.set({
        text: next.text,
        fontSize: next.fontSize,
        fontFamily: next.fontFamily,
        fontWeight: next.fontWeight,
        textAlign: next.textAlign,
      });
      target.initDimensions();
    }
    if (target instanceof Rect)
      target.set({ rx: next.radius, ry: next.radius });
    if (target instanceof Ellipse)
      target.set({ rx: next.width / 2, ry: next.height / 2 });
    this.records.set(target, next);
    target.setCoords();
    if (!this.commit())
      throw new Error(
        "属性未应用：文字排版超出尺寸限制，请减少文字或增大文字框宽度。草稿仍已保留。",
      );
  }
  editText() {
    const item = this.canvas.getActiveObject();
    if (item instanceof Textbox) {
      item.enterEditing();
      item.selectAll();
      item.hiddenTextarea?.focus();
    }
  }
  duplicate() {
    const item = this.canvas.getActiveObject(),
      source = this.snapshot().objects.find(
        (v) => v.id === (item ? this.records.get(item)?.id : null),
      );
    if (!source) return;
    if (this.canvas.size() >= 160) {
      this.report(new Error("最多支持 160 个对象。"));
      return;
    }
    const copy = {
      ...source,
      id: crypto.randomUUID(),
      x: source.x + 24,
      y: source.y + 24,
    };
    const target = create(copy);
    this.records.set(target, copy);
    this.canvas.add(target);
    this.canvas.setActiveObject(target);
    this.commit();
  }
  remove() {
    const item = this.canvas.getActiveObject();
    if (!item) return;
    this.canvas.discardActiveObject();
    this.canvas.remove(item);
    this.records.delete(item);
    this.commit();
  }
  reorder(direction: number) {
    const item = this.canvas.getActiveObject();
    if (!item) return;
    const index = this.canvas.getObjects().indexOf(item);
    this.canvas.moveObjectTo(
      item,
      Math.max(0, Math.min(this.canvas.size() - 1, index + direction)),
    );
    this.commit();
  }
  resize(width: number, height: number, background: string) {
    validatePoster({ ...this.current, width, height, background });
    this.current = { ...this.current, width, height, background };
    this.canvas.setDimensions({ width, height });
    this.canvas.backgroundColor = background;
    const next = this.snapshot();
    this.current = next;
    this.history = this.history.slice(0, this.cursor + 1);
    this.history.push(structuredClone(next));
    if (this.history.length > 60) this.history.shift();
    this.cursor = this.history.length - 1;
    this.historyChange(this.cursor > 0, false);
    this.change(next);
    this.canvas.requestRenderAll();
  }
  undo(direction: number) {
    const next = this.cursor + direction;
    if (next < 0 || next >= this.history.length) return;
    this.cursor = next;
    this.load(this.history[next]);
    this.change(this.snapshot());
    this.historyChange(next > 0, next < this.history.length - 1);
  }
  scale(zoom: number) {
    this.displayScale = zoom;
    this.canvas.setDimensions(
      { width: this.current.width * zoom, height: this.current.height * zoom },
      { cssOnly: true },
    );
    this.canvas.calcOffset();
  }
  async png(): Promise<Blob> {
    const blob = await this.canvas.toBlob({
      format: "png",
      multiplier: 1,
      enableRetinaScaling: false,
    });
    if (!blob) throw new Error("PNG 编码失败，请重试。");
    return blob;
  }
  svg(): string {
    return this.canvas.toSVG({
      width: String(this.current.width),
      height: String(this.current.height),
      viewBox: {
        x: 0,
        y: 0,
        width: this.current.width,
        height: this.current.height,
      },
    });
  }
  destroy() {
    void this.canvas.dispose();
  }
}
