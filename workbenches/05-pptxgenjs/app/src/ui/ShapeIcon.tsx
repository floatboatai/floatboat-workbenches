// ABOUTME: 插入菜单中的形状小图标。
import type { ShapeElement } from "../contracts/domain";

export function ShapeIcon({ kind }: { kind: ShapeElement["shape"] }) {
  const common = { fill: "currentColor", stroke: "currentColor", strokeWidth: 1.5 };
  return (
    <svg width="18" height="14" viewBox="0 0 18 14" aria-hidden="true">
      {kind === "rect" ? <rect x="1" y="1" width="16" height="12" {...common} fillOpacity={0.25} /> : null}
      {kind === "roundRect" ? <rect x="1" y="1" width="16" height="12" rx="3" {...common} fillOpacity={0.25} /> : null}
      {kind === "ellipse" ? <ellipse cx="9" cy="7" rx="8" ry="6" {...common} fillOpacity={0.25} /> : null}
      {kind === "triangle" ? <polygon points="9,1 17,13 1,13" {...common} fillOpacity={0.25} /> : null}
      {kind === "rightArrow" ? <polygon points="1,4 10,4 10,1 17,7 10,13 10,10 1,10" {...common} fillOpacity={0.25} /> : null}
      {kind === "line" ? <line x1="1" y1="13" x2="17" y2="1" stroke="currentColor" strokeWidth={1.8} /> : null}
    </svg>
  );
}
