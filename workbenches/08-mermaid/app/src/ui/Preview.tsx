// ABOUTME: 图形预览舞台：缩放、平移、适应窗口，以及错误时保留上一版图形。
import {
  useCallback,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useRef,
  useState,
  type Ref,
} from "react";
import type { Rendered } from "./engine";

export interface PreviewHandle {
  zoomIn: () => void;
  zoomOut: () => void;
  actual: () => void;
  fit: () => void;
}
interface View {
  scale: number;
  x: number;
  y: number;
}
const MIN = 0.1,
  MAX = 8;
const clamp = (value: number) => Math.min(MAX, Math.max(MIN, value));

export function Preview({
  rendered,
  stale,
  fitKey,
  handle,
  onScale,
}: {
  rendered: Rendered | null;
  stale: boolean;
  fitKey: string;
  handle: Ref<PreviewHandle>;
  onScale: (scale: number) => void;
}) {
  const stage = useRef<HTMLDivElement>(null);
  const [view, setView] = useState<View>({ scale: 1, x: 0, y: 0 });
  const viewRef = useRef(view);
  viewRef.current = view;
  const size = useRef({ width: 0, height: 0 });
  const drag = useRef<{ id: number; x: number; y: number } | null>(null);

  const apply = useCallback(
    (next: View) => {
      viewRef.current = next;
      setView(next);
      onScale(next.scale);
    },
    [onScale],
  );

  const pendingFit = useRef(false);
  const fit = useCallback(() => {
    const box = stage.current?.getBoundingClientRect();
    const { width, height } = size.current;
    if (!box || !width || !height || !box.width || !box.height) {
      pendingFit.current = true;
      return;
    }
    pendingFit.current = false;
    const pad = Math.min(48, box.width * 0.06);
    const scale = clamp(
      Math.min(
        (box.width - pad * 2) / width,
        (box.height - pad * 2) / height,
        2,
      ),
    );
    apply({
      scale,
      x: (box.width - width * scale) / 2,
      y: (box.height - height * scale) / 2,
    });
  }, [apply]);

  const zoomAt = useCallback(
    (factor: number, cx?: number, cy?: number) => {
      const box = stage.current?.getBoundingClientRect();
      if (!box) return;
      const current = viewRef.current;
      const px = cx ?? box.width / 2,
        py = cy ?? box.height / 2;
      const scale = clamp(current.scale * factor);
      const ratio = scale / current.scale;
      apply({
        scale,
        x: px - (px - current.x) * ratio,
        y: py - (py - current.y) * ratio,
      });
    },
    [apply],
  );

  useImperativeHandle(
    handle,
    () => ({
      zoomIn: () => zoomAt(1.25),
      zoomOut: () => zoomAt(1 / 1.25),
      actual: () => {
        const box = stage.current?.getBoundingClientRect();
        if (!box) return;
        const { width, height } = size.current;
        apply({
          scale: 1,
          x: Math.max(16, (box.width - width) / 2),
          y: Math.max(16, (box.height - height) / 2),
        });
      },
      fit,
    }),
    [zoomAt, fit, apply],
  );

  // 新文件或首次出图时适应窗口；继续编辑时保持当前视角。
  const fitted = useRef("");
  useLayoutEffect(() => {
    if (!rendered) return;
    const changed =
      size.current.width !== rendered.width ||
      size.current.height !== rendered.height;
    size.current = { width: rendered.width, height: rendered.height };
    if (fitted.current !== fitKey) {
      fitted.current = fitKey;
      fit();
    } else if (changed && pendingFit.current) fit();
  }, [rendered, fitKey, fit]);

  useEffect(() => {
    const element = stage.current;
    if (!element) return;
    const wheel = (event: WheelEvent) => {
      event.preventDefault();
      const box = element.getBoundingClientRect();
      if (event.ctrlKey || event.metaKey) {
        zoomAt(
          Math.exp(-event.deltaY * 0.0025),
          event.clientX - box.left,
          event.clientY - box.top,
        );
      } else {
        const current = viewRef.current;
        apply({
          ...current,
          x: current.x - event.deltaX,
          y: current.y - event.deltaY,
        });
      }
    };
    element.addEventListener("wheel", wheel, { passive: false });
    // 窄屏切换到“图形”页签前舞台尺寸为 0，显示后补做适应。
    const observer = new ResizeObserver(() => {
      if (pendingFit.current) fit();
    });
    observer.observe(element);
    return () => {
      element.removeEventListener("wheel", wheel);
      observer.disconnect();
    };
  }, [zoomAt, apply, fit]);

  return (
    <div
      ref={stage}
      className={"stage" + (stale ? " stale" : "")}
      style={{ backgroundColor: rendered?.background ?? "#ffffff" }}
      tabIndex={0}
      role="group"
      aria-roledescription="图形画布"
      aria-label="图形预览。拖动平移，Ctrl 或 ⌘ 加滚轮缩放，按 + − 0 键缩放与适应。"
      onPointerDown={(event) => {
        if (event.button !== 0) return;
        event.currentTarget.setPointerCapture(event.pointerId);
        drag.current = {
          id: event.pointerId,
          x: event.clientX,
          y: event.clientY,
        };
      }}
      onPointerMove={(event) => {
        const start = drag.current;
        if (!start || start.id !== event.pointerId) return;
        const current = viewRef.current;
        apply({
          ...current,
          x: current.x + event.clientX - start.x,
          y: current.y + event.clientY - start.y,
        });
        drag.current = { ...start, x: event.clientX, y: event.clientY };
      }}
      onPointerUp={() => {
        drag.current = null;
      }}
      onPointerCancel={() => {
        drag.current = null;
      }}
      onDoubleClick={fit}
      onClick={(event) => {
        const link = (event.target as Element).closest?.("a");
        if (link) event.preventDefault();
      }}
      onKeyDown={(event) => {
        const step = 40;
        const current = viewRef.current;
        if (event.key === "+" || event.key === "=") zoomAt(1.25);
        else if (event.key === "-" || event.key === "_") zoomAt(0.8);
        else if (event.key === "0") fit();
        else if (event.key === "ArrowLeft")
          apply({ ...current, x: current.x + step });
        else if (event.key === "ArrowRight")
          apply({ ...current, x: current.x - step });
        else if (event.key === "ArrowUp")
          apply({ ...current, y: current.y + step });
        else if (event.key === "ArrowDown")
          apply({ ...current, y: current.y - step });
        else return;
        event.preventDefault();
      }}
    >
      {rendered ? (
        <div
          className="svg-layer"
          style={{
            width: rendered.width,
            height: rendered.height,
            transform: `translate(${view.x}px, ${view.y}px) scale(${view.scale})`,
          }}
          dangerouslySetInnerHTML={{ __html: rendered.svg }}
        />
      ) : null}
    </div>
  );
}
