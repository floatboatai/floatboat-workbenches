import { useRef } from "react";
import { label, type Graph, type Point } from "../contracts/graph.ts";
export function GraphCanvas({
  graph,
  positions,
  selected,
  path,
  query,
  zoom,
  onSelect,
  onMove,
}: {
  graph: Graph;
  positions: Record<string, Point>;
  selected: string;
  path: string[];
  query: string;
  zoom: number;
  onSelect: (id: string) => void;
  onMove: (id: string, p: Point) => void;
}) {
  const drag = useRef<{
    id: string;
    x: number;
    y: number;
    start: Point;
    active: boolean;
  } | null>(null);
  const height = graph.nodes.length > 30 ? 1000 : 660,
    width = graph.nodes.length > 30 ? 1600 : 960;
  const points = new Map(
    graph.nodes.map((n, i) => [
      n.id,
      positions[n.id] ?? {
        x:
          width / 2 +
          Math.cos(
            (i * 2 * Math.PI) / Math.max(graph.nodes.length, 1) - Math.PI / 2,
          ) *
            Math.min(350, 180 + graph.nodes.length * 12),
        y:
          height / 2 +
          Math.sin(
            (i * 2 * Math.PI) / Math.max(graph.nodes.length, 1) - Math.PI / 2,
          ) *
            Math.min(250, 140 + graph.nodes.length * 10),
      },
    ]),
  );
  const highlighted = new Set(
    path.slice(1).map((id, i) => path[i] + "\u0000" + id),
  );
  return (
    <div className="map-scroll" aria-label="知识地图画布">
      <div
        className="map-space"
        style={{ width: width * zoom, height: height * zoom }}
      >
        <div
          className="map-inner"
          style={{ width, height, transform: `scale(${zoom})` }}
        >
          <svg
            width={width}
            height={height}
            className="edges"
            aria-hidden="true"
          >
            <defs>
              <marker
                id="arrow"
                markerWidth="7"
                markerHeight="7"
                refX="11"
                refY="3.5"
                orient="auto"
              >
                <path d="M0,0 L7,3.5 L0,7" fill="currentColor" />
              </marker>
            </defs>
            {graph.links.map((edge, i) => {
              const a = points.get(edge.source),
                b = points.get(edge.target);
              if (!a || !b) return null;
              const active =
                highlighted.has(edge.source + "\u0000" + edge.target) ||
                (!graph.directed &&
                  highlighted.has(edge.target + "\u0000" + edge.source));
              return (
                <line
                  key={i}
                  x1={a.x}
                  y1={a.y}
                  x2={b.x}
                  y2={b.y}
                  className={
                    active
                      ? "path-edge"
                      : edge.source === selected || edge.target === selected
                        ? "selected-edge"
                        : ""
                  }
                  markerEnd={graph.directed ? "url(#arrow)" : undefined}
                />
              );
            })}
          </svg>
          {graph.nodes.map((n) => {
            const p = points.get(n.id)!;
            return (
              <button
                type="button"
                key={n.id}
                className={`graph-node ${n.id === selected ? "chosen" : ""} ${path.includes(n.id) ? "on-path" : ""} ${query && !label(n).toLowerCase().includes(query.toLowerCase()) ? "dim" : ""}`}
                style={{ left: p.x, top: p.y }}
                aria-label={`查看节点 ${label(n)}`}
                aria-pressed={n.id === selected}
                aria-describedby="map-keys"
                onKeyDown={(event) => {
                  if (
                    !event.altKey ||
                    ![
                      "ArrowLeft",
                      "ArrowRight",
                      "ArrowUp",
                      "ArrowDown",
                    ].includes(event.key)
                  )
                    return;
                  event.preventDefault();
                  onMove(n.id, {
                    x: Math.max(
                      40,
                      Math.min(
                        1560,
                        p.x +
                          (event.key === "ArrowRight"
                            ? 20
                            : event.key === "ArrowLeft"
                              ? -20
                              : 0),
                      ),
                    ),
                    y: Math.max(
                      40,
                      Math.min(
                        960,
                        p.y +
                          (event.key === "ArrowDown"
                            ? 20
                            : event.key === "ArrowUp"
                              ? -20
                              : 0),
                      ),
                    ),
                  });
                }}
                onClick={() => onSelect(n.id)}
                onPointerDown={(e) => {
                  if (e.button !== 0) return;
                  drag.current = {
                    id: n.id,
                    x: e.clientX,
                    y: e.clientY,
                    start: p,
                    active: false,
                  };
                  e.currentTarget.setPointerCapture(e.pointerId);
                }}
                onPointerMove={(e) => {
                  const d = drag.current;
                  if (!d || d.id !== n.id) return;
                  const dx = (e.clientX - d.x) / zoom,
                    dy = (e.clientY - d.y) / zoom;
                  if (Math.abs(dx) + Math.abs(dy) > 5) {
                    d.active = true;
                    onMove(n.id, {
                      x: Math.max(40, Math.min(1560, d.start.x + dx)),
                      y: Math.max(40, Math.min(960, d.start.y + dy)),
                    });
                  }
                }}
                onPointerUp={() => {
                  drag.current = null;
                }}
                onPointerCancel={() => {
                  drag.current = null;
                }}
              >
                <span className="node-symbol">
                  {n._callable_class ? "C" : n._callable ? "ƒ" : "◇"}
                </span>
                <strong>{label(n)}</strong>
                <small>
                  {typeof n.source_location === "string"
                    ? n.source_location
                    : "概念"}
                </small>
              </button>
            );
          })}
          {graph.nodes.length === 0 ? (
            <p className="map-empty">
              导入 graph.json，或从源码提取第一张知识地图。
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
