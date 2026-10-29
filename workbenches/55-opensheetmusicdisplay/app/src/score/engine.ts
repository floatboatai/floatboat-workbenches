// ABOUTME: OpenSheetMusicDisplay 的配置、几何查询（小节/拍位/点击命中）、光标定位、批注图层与导出用的页面快照。
import type { GraphicalMeasure, IOSMDOptions, OpenSheetMusicDisplay, SourceMeasure } from "opensheetmusicdisplay";
import type { Beat, Focus, ViewSettings } from "../contracts/domain";

let pending: Promise<typeof import("opensheetmusicdisplay")> | undefined;
export function loadEngine() {
  return (pending ??= import("opensheetmusicdisplay").catch((error) => {
    pending = undefined;
    throw error;
  }));
}

/** OSMD 单位到 SVG 用户坐标：VexFlow SVG 后端以 10 个用户单位表示 1 个 OSMD 单位。 */
const UNIT = 10;
const SVG_NS = "http://www.w3.org/2000/svg";
export const ACCENT = "#c2410c";
const RESOLVED = "#5b6b7d";
const SELECTED = "#1d4ed8";

export function engineOptions(view: ViewSettings): IOSMDOptions {
  return {
    backend: "svg",
    autoResize: false,
    autoBeam: true,
    pageFormat: view.layout === "page" ? "A4_P" : view.layout === "landscape" ? "A4_L" : "Endless",
    renderSingleHorizontalStaffline: view.layout === "line",
    pageBackgroundColor: "#FFFFFF",
    drawTitle: view.credits,
    drawSubtitle: view.credits,
    drawComposer: view.credits,
    drawLyricist: view.credits,
    drawCredits: view.credits,
    drawPartNames: view.partNames,
    drawPartAbbreviations: view.partNames,
    drawMeasureNumbers: view.measureNumbers !== "off",
    drawMeasureNumbersOnlyAtSystemStart: view.measureNumbers === "system",
    measureNumberInterval: 1,
    useXMLMeasureNumbers: true,
    // 保持小节与 MusicXML 一一对应，批注锚点不会落在合并的多小节休止上。
    autoGenerateMultipleRestMeasuresFromRestMeasures: false,
    followCursor: true,
    cursorsOptions: [{ type: 0, color: "#2563eb", alpha: 0.28, follow: true }],
  };
}

/** 应用显示设置（移调时重新计算图形）；调用方随后 render()。 */
export async function configure(engine: OpenSheetMusicDisplay, view: ViewSettings): Promise<void> {
  engine.setOptions(engineOptions(view));
  engine.Zoom = view.zoom;
  for (const instrument of engine.Sheet.Instruments) instrument.Visible = !view.hiddenParts.includes(instrument.IdString);
  if (engine.Sheet.Transpose !== view.transpose) {
    if (!engine.TransposeCalculator) {
      const { TransposeCalculator } = await loadEngine();
      engine.TransposeCalculator = new TransposeCalculator();
    }
    engine.Sheet.Transpose = view.transpose;
    engine.updateGraphic();
  }
}

export interface Box {
  page: number;
  x: number;
  y: number;
  w: number;
  h: number;
}

function measureIndexMap(engine: OpenSheetMusicDisplay): Map<SourceMeasure, number> {
  const map = new Map<SourceMeasure, number>();
  engine.Sheet.SourceMeasures.forEach((measure, index) => map.set(measure, index));
  return map;
}
const pageOf = (engine: OpenSheetMusicDisplay, gm: GraphicalMeasure) => engine.GraphicSheet.MusicPages.indexOf(gm.ParentMusicSystem?.Parent);
const partOf = (gm: GraphicalMeasure | undefined) => gm?.ParentStaff?.ParentInstrument?.IdString;

function partMeasures(engine: OpenSheetMusicDisplay, partId: string, measureIndex: number): GraphicalMeasure[] {
  const source = engine.Sheet.SourceMeasures[measureIndex];
  if (!source) return [];
  const list = engine.GraphicSheet.MeasureList;
  const pick = (row: GraphicalMeasure[]) => row.filter((gm) => gm && partOf(gm) === partId && gm.ParentMusicSystem);
  const direct = list[measureIndex];
  if (direct?.find(Boolean)?.parentSourceMeasure === source) return pick(direct);
  for (const row of list) if (row.find(Boolean)?.parentSourceMeasure === source) return pick(row);
  return [];
}

/** 某声部某小节所有谱表的外框（SVG 用户坐标）。 */
export function measureBox(engine: OpenSheetMusicDisplay, partId: string, measureIndex: number): Box | null {
  const staves = partMeasures(engine, partId, measureIndex);
  if (!staves.length) return null;
  const first = staves[0].PositionAndShape;
  const top = Math.min(...staves.map((gm) => gm.PositionAndShape.AbsolutePosition.y));
  const bottom = Math.max(...staves.map((gm) => gm.PositionAndShape.AbsolutePosition.y + gm.PositionAndShape.Size.height));
  return { page: pageOf(engine, staves[0]), x: first.AbsolutePosition.x * UNIT, y: top * UNIT, w: first.Size.width * UNIT, h: (bottom - top) * UNIT };
}

const sameBeat = (a: { Numerator: number; Denominator: number }, beat: [number, number]) => a.Numerator * beat[1] === beat[0] * a.Denominator;

/** 拍位的横坐标：取该声部第一谱表上与拍位相同的音符位置；没有则取最近的。 */
export function beatX(engine: OpenSheetMusicDisplay, partId: string, measureIndex: number, beat: Beat): number | null {
  if (!beat) return null;
  const gm = partMeasures(engine, partId, measureIndex)[0];
  if (!gm?.staffEntries.length) return null;
  const target = beat[0] / beat[1];
  let best = gm.staffEntries[0];
  for (const entry of gm.staffEntries) {
    if (sameBeat(entry.relInMeasureTimestamp, beat)) return entry.PositionAndShape.AbsolutePosition.x * UNIT;
    if (Math.abs(entry.relInMeasureTimestamp.RealValue - target) < Math.abs(best.relInMeasureTimestamp.RealValue - target)) best = entry;
  }
  return best.PositionAndShape.AbsolutePosition.x * UNIT;
}

export interface Hit extends Focus {
  /** 点击是否落在音符附近（用于默认按拍位锚定）。 */
  nearNote: boolean;
}
/** 页面 SVG 用户坐标 → 最近的小节、声部与拍位。 */
export function hitTest(engine: OpenSheetMusicDisplay, page: number, x: number, y: number): Hit | null {
  const ux = x / UNIT,
    uy = y / UNIT;
  const indexes = measureIndexMap(engine);
  let best: { gm: GraphicalMeasure; distance: number } | null = null;
  for (const row of engine.GraphicSheet.MeasureList)
    for (const gm of row) {
      if (!gm?.ParentMusicSystem || pageOf(engine, gm) !== page) continue;
      const box = gm.PositionAndShape;
      const left = box.AbsolutePosition.x,
        top = box.AbsolutePosition.y;
      if (ux < left || ux > left + box.Size.width) continue;
      const distance = uy < top ? top - uy : uy > top + box.Size.height ? uy - top - box.Size.height : 0;
      if (distance > 6) continue;
      if (!best || distance < best.distance) best = { gm, distance };
    }
  if (!best) return null;
  const { gm } = best;
  const partId = partOf(gm);
  const measureIndex = indexes.get(gm.parentSourceMeasure);
  if (!partId || measureIndex === undefined) return null;
  let beat: Beat = null,
    nearNote = false;
  if (gm.staffEntries.length) {
    let entry = gm.staffEntries[0];
    for (const candidate of gm.staffEntries)
      if (Math.abs(candidate.PositionAndShape.AbsolutePosition.x - ux) < Math.abs(entry.PositionAndShape.AbsolutePosition.x - ux)) entry = candidate;
    beat = [entry.relInMeasureTimestamp.Numerator, entry.relInMeasureTimestamp.Denominator];
    nearNote = Math.abs(entry.PositionAndShape.AbsolutePosition.x - ux) < 2.5;
  }
  return { partId, measureIndex, beat, nearNote };
}

/** 光标所在小节与拍位。 */
export function cursorPosition(engine: OpenSheetMusicDisplay): { measureIndex: number; beat: [number, number] } | null {
  const iterator = engine.cursor?.Iterator;
  if (!iterator || iterator.EndReached) return null;
  const rel = iterator.CurrentRelativeInMeasureTimestamp;
  return { measureIndex: iterator.CurrentMeasureIndex, beat: [rel.Numerator, rel.Denominator] };
}

/** 把光标移到指定小节的拍位（或小节开头）；最多迭代 200 000 步。 */
export function moveCursorTo(engine: OpenSheetMusicDisplay, measureIndex: number, beat: Beat): void {
  const cursor = engine.cursor;
  if (!cursor) return;
  const target = beat ? beat[0] / beat[1] : 0;
  const before = () => {
    const it = cursor.Iterator;
    return it.CurrentMeasureIndex < measureIndex || (it.CurrentMeasureIndex === measureIndex && it.CurrentRelativeInMeasureTimestamp.RealValue < target - 1e-9);
  };
  const position = cursorPosition(engine);
  if (!position || position.measureIndex > measureIndex || (position.measureIndex === measureIndex && position.beat[0] / position.beat[1] > target + 1e-9))
    cursor.reset();
  for (let step = 0; step < 200_000 && !cursor.Iterator.EndReached && before(); step++) cursor.next();
  if (cursor.Iterator.EndReached) cursor.previous();
}

export interface Marker {
  id: string;
  number: number;
  partId: string;
  measureIndex: number;
  beat: Beat;
  resolved: boolean;
  label: string;
}
export interface OverlayModel {
  focus: Focus;
  markers: Marker[];
  selectedId: string | null;
}

const el = (name: string, attrs: Record<string, string | number>) => {
  const node = document.createElementNS(SVG_NS, name);
  for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, String(value));
  return node;
};

/** 在每页 SVG 内绘制批注层：当前位置、编号批注标记。坐标与谱面一致，随缩放与导出保留。 */
export function drawOverlay(container: HTMLElement, engine: OpenSheetMusicDisplay, model: OverlayModel): void {
  const pages = Array.from(container.querySelectorAll<SVGSVGElement>("svg"));
  for (const svg of pages) svg.querySelector(":scope > g.fb-overlay")?.remove();
  const layers = pages.map((svg) => {
    const g = el("g", { class: "fb-overlay" });
    svg.append(g);
    return g;
  });
  const focusBox = measureBox(engine, model.focus.partId, model.focus.measureIndex);
  if (focusBox && layers[focusBox.page]) {
    const layer = layers[focusBox.page];
    layer.append(el("rect", { class: "fb-focus", x: focusBox.x - 4, y: focusBox.y - 12, width: focusBox.w + 8, height: focusBox.h + 24, rx: 6, fill: ACCENT, "fill-opacity": 0.07, stroke: ACCENT, "stroke-opacity": 0.55, "stroke-width": 2 }));
    const x = beatX(engine, model.focus.partId, model.focus.measureIndex, model.focus.beat);
    if (x !== null) layer.append(el("line", { class: "fb-focus-beat", x1: x + 6, x2: x + 6, y1: focusBox.y - 14, y2: focusBox.y + focusBox.h + 14, stroke: ACCENT, "stroke-width": 3, "stroke-linecap": "round" }));
  }
  const taken = new Map<string, number>();
  for (const marker of model.markers) {
    const box = measureBox(engine, marker.partId, marker.measureIndex);
    if (!box || !layers[box.page]) continue;
    const color = marker.id === model.selectedId ? SELECTED : marker.resolved ? RESOLVED : ACCENT;
    const beat = beatX(engine, marker.partId, marker.measureIndex, marker.beat);
    const baseX = beat !== null ? beat + 6 : box.x + 14;
    const key = `${box.page}:${Math.round(baseX)}:${Math.round(box.y)}`;
    const stack = taken.get(key) ?? 0;
    taken.set(key, stack + 1);
    const cx = baseX + stack * 26,
      cy = box.y - 34;
    const group = el("g", { class: "fb-mark", "data-id": marker.id, tabindex: 0, role: "button", "aria-label": marker.label });
    const title = el("title", {});
    title.textContent = marker.label;
    group.append(title);
    if (beat === null)
      group.append(el("path", { d: `M${box.x} ${box.y - 12} v-6 h${box.w} v6`, fill: "none", stroke: color, "stroke-width": 2, "stroke-opacity": 0.7 }));
    else group.append(el("line", { x1: cx, x2: cx, y1: cy + 11, y2: box.y - 4, stroke: color, "stroke-width": 2 }));
    group.append(el("circle", { cx, cy, r: 12, fill: color, stroke: "#ffffff", "stroke-width": marker.id === model.selectedId ? 3 : 1.5 }));
    const label = el("text", { x: cx, y: cy + 4.5, "text-anchor": "middle", "font-size": 13, "font-weight": 700, "font-family": "Helvetica, Arial, sans-serif", fill: "#ffffff" });
    label.textContent = String(marker.number);
    group.append(label);
    layers[box.page].append(group);
  }
}

/** 某页 SVG 的客户端坐标 → 用户坐标。 */
export function toSvgPoint(svg: SVGSVGElement, clientX: number, clientY: number): { x: number; y: number } | null {
  const matrix = svg.getScreenCTM();
  if (!matrix) return null;
  const point = new DOMPoint(clientX, clientY).matrixTransform(matrix.inverse());
  return { x: point.x, y: point.y };
}

export interface PageSnapshot {
  svg: string;
  width: number;
  height: number;
}
/** 复制当前全部谱页（含批注层），白底、无工作台样式依赖。 */
export function snapshotPages(container: HTMLElement): PageSnapshot[] {
  const pages = Array.from(container.querySelectorAll<SVGSVGElement>("svg"));
  if (!pages.length) throw new Error("请等待乐谱渲染完成。");
  return pages.map((page) => {
    const box = page.viewBox.baseVal;
    const width = box?.width || Number.parseFloat(page.getAttribute("width") || "0");
    const height = box?.height || Number.parseFloat(page.getAttribute("height") || "0");
    if (!width || !height) throw new Error("乐谱页面尺寸无效。");
    const copy = page.cloneNode(true) as SVGSVGElement;
    copy.querySelectorAll(".fb-focus, .fb-focus-beat").forEach((node) => node.remove());
    copy.setAttribute("xmlns", SVG_NS);
    copy.setAttribute("width", String(width));
    copy.setAttribute("height", String(height));
    copy.setAttribute("viewBox", `${box?.x ?? 0} ${box?.y ?? 0} ${width} ${height}`);
    copy.removeAttribute("style");
    copy.prepend(el("rect", { x: box?.x ?? 0, y: box?.y ?? 0, width, height, fill: "#ffffff" }));
    return { svg: new XMLSerializer().serializeToString(copy), width, height };
  });
}

/** 把多页纵向拼成一个独立 SVG 文件。 */
export function stackSvg(pages: PageSnapshot[]): string {
  const gap = 24;
  const width = Math.max(...pages.map((page) => page.width));
  const height = pages.reduce((sum, page) => sum + page.height, 0) + gap * (pages.length - 1);
  let y = 0;
  const body = pages
    .map((page) => {
      const nested = page.svg.replace(/^<svg\b/, `<svg x="0" y="${y}"`);
      y += page.height + gap;
      return nested;
    })
    .join("");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="${SVG_NS}" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="Reviewed music score"><rect width="100%" height="100%" fill="#ffffff"/>${body}</svg>\n`;
}

/** 在屏幕外渲染一份（用于导入前试排与导出 A4 PDF），完成后清理。 */
export async function renderOffscreen<T>(xml: string, view: ViewSettings, work: (container: HTMLElement, engine: OpenSheetMusicDisplay) => T | Promise<T>, limitMeasures?: number): Promise<T> {
  const { OpenSheetMusicDisplay } = await loadEngine();
  const container = document.createElement("div");
  container.setAttribute("aria-hidden", "true");
  container.style.cssText = "position:fixed;left:-20000px;top:0;width:1200px;visibility:hidden;pointer-events:none";
  document.body.append(container);
  const engine = new OpenSheetMusicDisplay(container, { ...engineOptions(view), drawUpToMeasureNumber: limitMeasures });
  try {
    engine.setLogLevel("error");
    await engine.load(xml);
    await configure(engine, view);
    if (limitMeasures) engine.setOptions({ drawUpToMeasureNumber: limitMeasures });
    engine.render();
    return await work(container, engine);
  } finally {
    engine.clear();
    container.remove();
  }
}
