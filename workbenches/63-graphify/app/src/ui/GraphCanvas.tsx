// ABOUTME: Canvas 知识地图：按社区着色、缩放平移、拖动固定节点、路径与检索高亮；键盘可在相邻节点间移动。

import { memo, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState, type Ref } from "react";
import { quadtree, type Quadtree } from "d3-quadtree";
import { colorOf } from "../contracts/analysis.ts";
import { communityOf, label, nodeKind, type Graph } from "../contracts/graph.ts";
import type { Point } from "../contracts/map.ts";
import type { Layout, LayoutNode } from "./layout.ts";

export type CanvasHandle = { fit: () => void; focus: (id: string) => void; zoomBy: (f: number) => void };
type Props = {
  graph: Graph;
  layout: Layout | null;
  hidden: Set<number>;
  selected: string;
  pathNodes: Set<string>;
  pathLinks: Set<number>;
  matches: Set<string> | null;
  onSelect: (id: string) => void;
  onOpen: (id: string) => void;
  onMove: (id: string, p: Point) => void;
  handle: Ref<CanvasHandle>;
  ariaLabel: string;
};
type View = { k: number; x: number; y: number };

const css = (name: string, fallback: string) => {
  if (typeof document === "undefined") return fallback;
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;
};

function GraphCanvasImpl(props: Props) {
  const { graph, layout, hidden, selected, pathNodes, pathLinks, matches, onSelect, onOpen, onMove, handle, ariaLabel } = props;
  const wrap = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const view = useRef<View>({ k: 1, x: 0, y: 0 });
  const size = useRef({ w: 800, h: 600 });
  const tree = useRef<Quadtree<LayoutNode> | null>(null);
  const frame = useRef(0);
  const fitted = useRef("");
  const autoFit = useRef(true);
  const [tag, setTag] = useState<{ x: number; y: number; text: string } | null>(null);
  const [hover, setHover] = useState("");

  const nodeIndex = useMemo(() => new Map(graph.nodes.map((n, i) => [n.id, i])), [graph]);
  const neighbors = useMemo(() => {
    const m = new Map<string, Set<string>>();
    for (const l of graph.links) {
      if (!m.has(l.source)) m.set(l.source, new Set());
      if (!m.has(l.target)) m.set(l.target, new Set());
      m.get(l.source)!.add(l.target);
      m.get(l.target)!.add(l.source);
    }
    return m;
  }, [graph]);
  const labelled = useMemo(() => {
    const ranked = [...graph.nodes].map((n) => n.id).sort((a, b) => (neighbors.get(b)?.size ?? 0) - (neighbors.get(a)?.size ?? 0));
    return new Set(ranked.slice(0, Math.max(12, Math.min(40, Math.round(graph.nodes.length / 6)))));
  }, [graph, neighbors]);
  const visible = useCallback((n: LayoutNode) => n.community === null || !hidden.has(n.community), [hidden]);

  const draw = useCallback(() => {
    frame.current = 0;
    const c = canvas.current;
    if (!c) return;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    const dpr = window.devicePixelRatio || 1;
    const { w, h } = size.current;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = css("--map", "#eef1f4");
    ctx.fillRect(0, 0, w, h);
    if (!layout) return;
    const { k, x: ox, y: oy } = view.current;
    const sx = (x: number) => x * k + ox, sy = (y: number) => y * k + oy;
    const focusSet = selected ? neighbors.get(selected) ?? new Set<string>() : null;
    const edge = css("--edge", "#8a97a6"), edgeStrong = css("--edge-strong", "#243447"), pathColor = css("--path", "#9ccc2b");
    // 关系
    ctx.lineCap = "round";
    graph.links.forEach((l, i) => {
      const a = layout.byId.get(l.source), b = layout.byId.get(l.target);
      if (!a || !b || !visible(a) || !visible(b)) return;
      const onPath = pathLinks.has(i);
      const touching = selected && (l.source === selected || l.target === selected);
      ctx.globalAlpha = onPath ? 1 : touching ? 0.9 : selected || matches ? 0.12 : 0.32;
      ctx.strokeStyle = onPath ? pathColor : touching ? edgeStrong : edge;
      ctx.lineWidth = onPath ? 4 : touching ? 1.6 : 1;
      ctx.setLineDash(l.confidence === "INFERRED" ? [5, 4] : l.confidence === "AMBIGUOUS" ? [2, 4] : []);
      ctx.beginPath();
      ctx.moveTo(sx(a.x!), sy(a.y!));
      ctx.lineTo(sx(b.x!), sy(b.y!));
      ctx.stroke();
      if ((onPath || touching) && graph.directed && k > 0.7) {
        const angle = Math.atan2(b.y! - a.y!, b.x! - a.x!);
        const tx = sx(b.x!) - Math.cos(angle) * (b.r * k + 2), ty = sy(b.y!) - Math.sin(angle) * (b.r * k + 2);
        ctx.setLineDash([]);
        ctx.fillStyle = ctx.strokeStyle;
        ctx.beginPath();
        ctx.moveTo(tx, ty);
        ctx.lineTo(tx - Math.cos(angle - 0.45) * 8, ty - Math.sin(angle - 0.45) * 8);
        ctx.lineTo(tx - Math.cos(angle + 0.45) * 8, ty - Math.sin(angle + 0.45) * 8);
        ctx.fill();
      }
    });
    ctx.setLineDash([]);
    // 节点
    const ink = css("--ink", "#16202b"), paper = css("--map", "#eef1f4");
    for (const n of layout.nodes) {
      if (!visible(n)) continue;
      const x = sx(n.x!), y = sy(n.y!);
      if (x < -40 || y < -40 || x > w + 40 || y > h + 40) continue;
      const dim = (focusSet && n.id !== selected && !focusSet.has(n.id) && !pathNodes.has(n.id)) || (matches && !matches.has(n.id) && !pathNodes.has(n.id));
      const r = Math.max(2.5, n.r * Math.min(1.6, Math.max(0.55, k)));
      const node = graph.nodes[nodeIndex.get(n.id)!];
      const kind = nodeKind(node);
      ctx.globalAlpha = dim ? 0.28 : 1;
      ctx.fillStyle = colorOf(communityOf(node));
      ctx.strokeStyle = paper;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      if (kind === "file") ctx.rect(x - r, y - r, r * 2, r * 2);
      else if (kind === "concept") {
        ctx.moveTo(x, y - r * 1.25);
        ctx.lineTo(x + r * 1.25, y);
        ctx.lineTo(x, y + r * 1.25);
        ctx.lineTo(x - r * 1.25, y);
        ctx.closePath();
      } else if (kind === "section") ctx.roundRect(x - r, y - r * 0.8, r * 2, r * 1.6, 2);
      else if (kind === "rationale") {
        ctx.moveTo(x, y - r);
        ctx.lineTo(x + r, y + r * 0.8);
        ctx.lineTo(x - r, y + r * 0.8);
        ctx.closePath();
      } else ctx.arc(x, y, r, 0, Math.PI * 2);
      if (kind === "module") {
        ctx.fillStyle = paper;
        ctx.fill();
        ctx.strokeStyle = colorOf(communityOf(node));
        ctx.lineWidth = 2;
        ctx.stroke();
      } else {
        ctx.fill();
        ctx.stroke();
      }
      if (n.id === selected || pathNodes.has(n.id) || n.id === hover) {
        ctx.globalAlpha = 1;
        ctx.strokeStyle = n.id === selected ? ink : pathNodes.has(n.id) ? pathColor : ink;
        ctx.lineWidth = n.id === selected ? 3 : 2;
        ctx.beginPath();
        ctx.arc(x, y, r + 4, 0, Math.PI * 2);
        ctx.stroke();
      }
      if (n.fx !== undefined && n.fx !== null) {
        ctx.globalAlpha = dim ? 0.3 : 1;
        ctx.fillStyle = ink;
        ctx.beginPath();
        ctx.arc(x + r * 0.8, y - r * 0.8, 2, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    // 标签
    ctx.globalAlpha = 1;
    ctx.font = `12px ${css("--font-ui", "system-ui, sans-serif")}`;
    ctx.textBaseline = "middle";
    ctx.lineJoin = "round";
    for (const n of layout.nodes) {
      if (!visible(n)) continue;
      const important = n.id === selected || pathNodes.has(n.id) || n.id === hover || (matches?.has(n.id) ?? false) || ((focusSet?.has(n.id) ?? false) && k >= 0.9);
      if (n.id === selected) continue; // 选中节点由浮动标签显示
      if (!important && !(k >= 1.5 || (labelled.has(n.id) && k >= 0.45))) continue;
      if (!important && matches) continue;
      ctx.globalAlpha = important || !focusSet ? 1 : 0.5;
      const x = sx(n.x!), y = sy(n.y!);
      if (x < -100 || y < -20 || x > w + 20 || y > h + 20) continue;
      const text = label(graph.nodes[nodeIndex.get(n.id)!]).slice(0, 36);
      const tx = x + n.r * Math.min(1.6, Math.max(0.55, k)) + 5;
      ctx.lineWidth = 4;
      ctx.strokeStyle = paper;
      ctx.strokeText(text, tx, y);
      ctx.fillStyle = important ? ink : css("--muted", "#4b5866");
      ctx.fillText(text, tx, y);
    }
    ctx.globalAlpha = 1;
    const s = selected ? layout.byId.get(selected) : null;
    setTag(s && visible(s) ? { x: sx(s.x!), y: sy(s.y!), text: label(graph.nodes[nodeIndex.get(s.id)!]) } : null);
  }, [graph, layout, visible, selected, pathLinks, pathNodes, matches, neighbors, labelled, nodeIndex, hover]);

  const schedule = useCallback(() => {
    if (!frame.current) frame.current = requestAnimationFrame(draw);
  }, [draw]);
  useEffect(() => {
    schedule();
  }, [schedule]);
  useEffect(() => () => cancelAnimationFrame(frame.current), []);

  useEffect(() => {
    if (layout) tree.current = quadtree<LayoutNode>().x((d) => d.x!).y((d) => d.y!).addAll(layout.nodes.filter(visible));
  }, [layout, visible, graph]);

  const fit = useCallback(() => {
    if (!layout || !layout.nodes.length) return;
    const pts = layout.nodes.filter(visible);
    if (!pts.length) return;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const n of pts) {
      minX = Math.min(minX, n.x!);
      minY = Math.min(minY, n.y!);
      maxX = Math.max(maxX, n.x!);
      maxY = Math.max(maxY, n.y!);
    }
    const { w, h } = size.current;
    const k = Math.min(2, Math.max(0.08, Math.min((w - 80) / Math.max(1, maxX - minX), (h - 80) / Math.max(1, maxY - minY))));
    view.current = { k, x: w / 2 - ((minX + maxX) / 2) * k, y: h / 2 - ((minY + maxY) / 2) * k };
    schedule();
  }, [layout, visible, schedule]);
  const focusNode = useCallback(
    (id: string) => {
      const n = layout?.byId.get(id);
      if (!n) return;
      const { w, h } = size.current;
      const k = Math.max(view.current.k, 0.9);
      autoFit.current = false;
      view.current = { k, x: w / 2 - n.x! * k, y: h / 2 - n.y! * k };
      schedule();
    },
    [layout, schedule],
  );
  const zoomBy = useCallback(
    (f: number, cx = size.current.w / 2, cy = size.current.h / 2) => {
      autoFit.current = false;
      const v = view.current;
      const k = Math.min(6, Math.max(0.05, v.k * f));
      view.current = { k, x: cx - ((cx - v.x) * k) / v.k, y: cy - ((cy - v.y) * k) / v.k };
      schedule();
    },
    [schedule],
  );
  useImperativeHandle(handle, () => ({ fit, focus: focusNode, zoomBy }), [fit, focusNode, zoomBy]);

  // 新图谱首次布局完成后自动适配视野
  const graphKey = `${graph.nodes.length}:${graph.nodes[0]?.id ?? ""}:${graph.links.length}`;
  useEffect(() => {
    if (layout && fitted.current !== graphKey) {
      fitted.current = graphKey;
      autoFit.current = true;
    }
    if (layout && autoFit.current) fit();
  }, [layout, graphKey, fit]);
  const fitRef = useRef(fit);
  fitRef.current = fit;

  useEffect(() => {
    const el = wrap.current, c = canvas.current;
    if (!el || !c) return;
    const resize = () => {
      const r = el.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      size.current = { w: Math.max(1, r.width), h: Math.max(1, r.height) };
      c.width = Math.round(size.current.w * dpr);
      c.height = Math.round(size.current.h * dpr);
      c.style.width = `${size.current.w}px`;
      c.style.height = `${size.current.h}px`;
      if (autoFit.current) fitRef.current();
      schedule();
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(el);
    return () => ro.disconnect();
  }, [schedule]);

  const toWorld = (cx: number, cy: number) => ({ x: (cx - view.current.x) / view.current.k, y: (cy - view.current.y) / view.current.k });
  const hit = (cx: number, cy: number) => {
    const p = toWorld(cx, cy);
    return tree.current?.find(p.x, p.y, 14 / Math.min(1, view.current.k) + 4) ?? null;
  };
  const drag = useRef<{ mode: "pan" | "node"; id?: string; sx: number; sy: number; vx: number; vy: number; moved: boolean } | null>(null);

  useEffect(() => {
    const el = canvas.current;
    if (!el) return;
    const wheel = (e: WheelEvent) => {
      e.preventDefault();
      const r = el.getBoundingClientRect();
      zoomBy(Math.exp(-e.deltaY * 0.0015), e.clientX - r.left, e.clientY - r.top);
    };
    el.addEventListener("wheel", wheel, { passive: false });
    return () => el.removeEventListener("wheel", wheel);
  }, [zoomBy]);

  function move(id: string, p: Point) {
    const n = layout?.byId.get(id);
    if (!n) return;
    n.x = n.fx = p.x;
    n.y = n.fy = p.y;
    tree.current = quadtree<LayoutNode>().x((d) => d.x!).y((d) => d.y!).addAll(layout!.nodes.filter(visible));
    schedule();
  }

  function nearestInDirection(dx: number, dy: number) {
    const from = layout?.byId.get(selected);
    if (!from) return;
    let best: { id: string; score: number } | null = null;
    const pool = neighbors.get(selected)?.size ? [...neighbors.get(selected)!] : layout!.nodes.map((n) => n.id);
    for (const id of pool) {
      const n = layout!.byId.get(id);
      if (!n || id === selected || !visible(n)) continue;
      const vx = n.x! - from.x!, vy = n.y! - from.y!;
      const dist = Math.hypot(vx, vy) || 1;
      const cos = (vx * dx + vy * dy) / dist;
      if (cos < 0.3) continue;
      const score = dist / cos;
      if (!best || score < best.score) best = { id, score };
    }
    if (best) {
      onSelect(best.id);
      const n = layout!.byId.get(best.id)!;
      const { w, h } = size.current, sxp = n.x! * view.current.k + view.current.x, syp = n.y! * view.current.k + view.current.y;
      if (sxp < 40 || syp < 40 || sxp > w - 40 || syp > h - 40) focusNode(best.id);
    }
  }

  return (
    <div
      ref={wrap}
      className="graph-canvas"
      tabIndex={0}
      role="application"
      aria-label={ariaLabel}
      aria-describedby="map-keys"
      onKeyDown={(e) => {
        const dirs: Record<string, [number, number]> = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
        const d = dirs[e.key];
        if (d && e.altKey && selected && layout?.byId.get(selected)) {
          e.preventDefault();
          const n = layout.byId.get(selected)!;
          const p = { x: Math.round(n.x! + d[0] * 20), y: Math.round(n.y! + d[1] * 20) };
          move(selected, p);
          onMove(selected, p);
        } else if (d && e.shiftKey) {
          e.preventDefault();
          view.current = { ...view.current, x: view.current.x - d[0] * 60, y: view.current.y - d[1] * 60 };
          schedule();
        } else if (d) {
          e.preventDefault();
          if (selected) nearestInDirection(d[0], d[1]);
          else if (layout?.nodes[0]) onSelect(layout.nodes[0].id);
        } else if (e.key === "+" || e.key === "=") zoomBy(1.25);
        else if (e.key === "-") zoomBy(0.8);
        else if (e.key === "0") fit();
        else if (e.key === "Enter" && selected) onOpen(selected);
      }}
    >
      <canvas
        ref={canvas}
        onPointerDown={(e) => {
          const r = e.currentTarget.getBoundingClientRect();
          const cx = e.clientX - r.left, cy = e.clientY - r.top;
          const n = hit(cx, cy);
          e.currentTarget.setPointerCapture(e.pointerId);
          drag.current = n
            ? { mode: "node", id: n.id, sx: cx, sy: cy, vx: n.x!, vy: n.y!, moved: false }
            : { mode: "pan", sx: cx, sy: cy, vx: view.current.x, vy: view.current.y, moved: false };
        }}
        onPointerMove={(e) => {
          const r = e.currentTarget.getBoundingClientRect();
          const cx = e.clientX - r.left, cy = e.clientY - r.top;
          const d = drag.current;
          if (!d) {
            const n = hit(cx, cy);
            const id = n?.id ?? "";
            if (id !== hover) setHover(id);
            e.currentTarget.style.cursor = n ? "pointer" : "grab";
            return;
          }
          if (Math.hypot(cx - d.sx, cy - d.sy) > 3) d.moved = true;
          if (!d.moved) return;
          if (d.mode === "pan") {
            autoFit.current = false;
            view.current = { ...view.current, x: d.vx + cx - d.sx, y: d.vy + cy - d.sy };
            schedule();
          } else if (d.id) move(d.id, { x: d.vx + (cx - d.sx) / view.current.k, y: d.vy + (cy - d.sy) / view.current.k });
        }}
        onPointerUp={(e) => {
          const d = drag.current;
          drag.current = null;
          if (!d) return;
          if (d.mode === "node" && d.id) {
            if (d.moved) {
              const n = layout?.byId.get(d.id);
              if (n) onMove(d.id, { x: Math.round(n.x!), y: Math.round(n.y!) });
            } else onSelect(d.id);
          }
          e.currentTarget.releasePointerCapture(e.pointerId);
        }}
        onDoubleClick={(e) => {
          const r = e.currentTarget.getBoundingClientRect();
          const n = hit(e.clientX - r.left, e.clientY - r.top);
          if (n) onOpen(n.id);
          else zoomBy(1.6, e.clientX - r.left, e.clientY - r.top);
        }}
      />
      {tag ? (
        <span className="selected-tag" style={{ transform: `translate(${Math.round(tag.x)}px, ${Math.round(tag.y)}px)` }} aria-hidden="true">
          {tag.text}
        </span>
      ) : null}
    </div>
  );
}

export const GraphCanvas = memo(GraphCanvasImpl);
