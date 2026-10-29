// ABOUTME: 舞台几何：拖动/缩放的吸附计算（页边、中线、其它元素边线）与元素增删改、层级调整。
import type { Slide, SlideElement } from "../contracts/domain.ts";
import { newId } from "../contracts/layouts.ts";

export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}
export interface Guide {
  axis: "x" | "y";
  at: number;
}
export type Handle = "n" | "s" | "e" | "w" | "ne" | "nw" | "se" | "sw";

function targets(others: Box[], axis: "x" | "y") {
  const list = [0, 50, 100, 6, 94];
  for (const o of others) {
    const start = axis === "x" ? o.x : o.y,
      size = axis === "x" ? o.w : o.h;
    list.push(start, start + size / 2, start + size);
  }
  return list;
}
function bestSnap(edges: number[], candidates: number[], threshold: number) {
  let best: { delta: number; at: number } | null = null;
  for (const edge of edges)
    for (const target of candidates) {
      const delta = target - edge;
      if (Math.abs(delta) <= threshold && (!best || Math.abs(delta) < Math.abs(best.delta))) best = { delta, at: target };
    }
  return best;
}

export function moveBox(start: Box, dx: number, dy: number, others: Box[], snap: boolean, tx: number, ty: number): { box: Box; guides: Guide[] } {
  const box = { ...start, x: start.x + dx, y: start.y + dy };
  const guides: Guide[] = [];
  if (snap) {
    const sx = bestSnap([box.x, box.x + box.w / 2, box.x + box.w], targets(others, "x"), tx);
    if (sx) {
      box.x += sx.delta;
      guides.push({ axis: "x", at: sx.at });
    }
    const sy = bestSnap([box.y, box.y + box.h / 2, box.y + box.h], targets(others, "y"), ty);
    if (sy) {
      box.y += sy.delta;
      guides.push({ axis: "y", at: sy.at });
    }
  }
  return { box: round(box), guides };
}

export function resizeBox(
  start: Box,
  handle: Handle,
  dx: number,
  dy: number,
  others: Box[],
  options: { snap: boolean; keepRatio: boolean; minW: number; minH: number; tx: number; ty: number },
): { box: Box; guides: Guide[] } {
  let { x, y, w, h } = start;
  const guides: Guide[] = [];
  const right = start.x + start.w,
    bottom = start.y + start.h;
  if (handle.includes("e")) w = start.w + dx;
  if (handle.includes("w")) {
    x = start.x + dx;
    w = right - x;
  }
  if (handle.includes("s")) h = start.h + dy;
  if (handle.includes("n")) {
    y = start.y + dy;
    h = bottom - y;
  }
  if (options.snap) {
    if (handle.includes("e")) {
      const s = bestSnap([x + w], targets(others, "x"), options.tx);
      if (s) {
        w += s.delta;
        guides.push({ axis: "x", at: s.at });
      }
    }
    if (handle.includes("w")) {
      const s = bestSnap([x], targets(others, "x"), options.tx);
      if (s) {
        x += s.delta;
        w = right - x;
        guides.push({ axis: "x", at: s.at });
      }
    }
    if (handle.includes("s")) {
      const s = bestSnap([y + h], targets(others, "y"), options.ty);
      if (s) {
        h += s.delta;
        guides.push({ axis: "y", at: s.at });
      }
    }
    if (handle.includes("n")) {
      const s = bestSnap([y], targets(others, "y"), options.ty);
      if (s) {
        y += s.delta;
        h = bottom - y;
        guides.push({ axis: "y", at: s.at });
      }
    }
  }
  if (w < options.minW) {
    if (handle.includes("w")) x = right - options.minW;
    w = options.minW;
  }
  if (h < options.minH) {
    if (handle.includes("n")) y = bottom - options.minH;
    h = options.minH;
  }
  if (options.keepRatio && handle.length === 2 && start.w > 0 && start.h > 0) {
    const ratio = start.h / start.w;
    const scale = Math.max(w / start.w, h / start.h);
    w = start.w * scale;
    h = w * ratio;
    if (handle.includes("w")) x = right - w;
    if (handle.includes("n")) y = bottom - h;
    guides.length = 0;
  }
  return { box: round({ x, y, w, h }), guides };
}
function round(box: Box): Box {
  const r = (v: number) => Math.round(v * 100) / 100;
  return { x: r(box.x), y: r(box.y), w: r(box.w), h: r(box.h) };
}

export function clampBox(box: Box): Box {
  return {
    x: Math.min(199, Math.max(-99, box.x)),
    y: Math.min(199, Math.max(-99, box.y)),
    w: Math.min(299, Math.max(0, box.w)),
    h: Math.min(299, Math.max(0, box.h)),
  };
}

export function patchElement(slide: Slide, id: string, patch: (el: SlideElement) => SlideElement): Slide {
  return { ...slide, elements: slide.elements.map((el) => (el.id === id ? patch(el) : el)) };
}
export function removeElement(slide: Slide, id: string): Slide {
  return { ...slide, elements: slide.elements.filter((el) => el.id !== id) };
}
export function duplicateElement(slide: Slide, id: string): { slide: Slide; id: string } {
  const index = slide.elements.findIndex((el) => el.id === id);
  if (index < 0) return { slide, id };
  const source = slide.elements[index];
  const { slot: _slot, ...rest } = structuredClone(source);
  const copy = { ...rest, id: newId(source.type), x: source.x + 2, y: source.y + 2 } as SlideElement;
  const elements = [...slide.elements];
  elements.splice(index + 1, 0, copy);
  return { slide: { ...slide, elements }, id: copy.id };
}
export function insertElement(slide: Slide, element: SlideElement): Slide {
  return { ...slide, elements: [...slide.elements, element] };
}
export function reorderElement(slide: Slide, id: string, mode: "forward" | "backward" | "front" | "back"): Slide {
  const index = slide.elements.findIndex((el) => el.id === id);
  if (index < 0) return slide;
  const elements = [...slide.elements];
  const [item] = elements.splice(index, 1);
  const target =
    mode === "front" ? elements.length : mode === "back" ? 0 : mode === "forward" ? Math.min(elements.length, index + 1) : Math.max(0, index - 1);
  elements.splice(target, 0, item);
  return elements.every((el, i) => el === slide.elements[i]) ? slide : { ...slide, elements };
}
