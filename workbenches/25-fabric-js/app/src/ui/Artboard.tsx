import { useEffect, useRef } from "react";
import { PosterEngine } from "./engine";
import type { Poster } from "../contracts/poster";

interface Props {
  initial: Poster;
  data: Poster;
  zoom: string;
  onChange: (data: Poster) => void;
  onSelection: (id: string | null) => void;
  onError: (error: unknown) => void;
  onReady: (engine: PosterEngine | null) => void;
  onScale: (value: number) => void;
  onHistory: (undo: boolean, redo: boolean) => void;
}
export function Artboard(props: Props) {
  const canvas = useRef<HTMLCanvasElement>(null),
    space = useRef<HTMLDivElement>(null),
    engine = useRef<PosterEngine | null>(null),
    latest = useRef(props);
  latest.current = props;
  useEffect(() => {
    if (!canvas.current) return;
    const active = new PosterEngine(
      canvas.current,
      latest.current.initial,
      (data) => latest.current.onChange(data),
      (id) => latest.current.onSelection(id),
      (error) => latest.current.onError(error),
      (undo, redo) => latest.current.onHistory(undo, redo),
    );
    engine.current = active;
    latest.current.onReady(active);
    return () => {
      latest.current.onReady(null);
      active.destroy();
      engine.current = null;
    };
  }, []);
  useEffect(() => {
    const container = space.current;
    if (!container) return;
    const resize = () => {
      const { width, height } = latest.current.data;
      const availableWidth = Math.max(120, container.clientWidth - 72),
        availableHeight = Math.max(220, container.clientHeight - 72);
      const zoom =
        latest.current.zoom === "fit"
          ? Math.min(availableWidth / width, availableHeight / height, 1)
          : Number(latest.current.zoom);
      engine.current?.scale(zoom);
      latest.current.onScale(zoom);
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(container);
    return () => observer.disconnect();
  }, [props.data.width, props.data.height, props.zoom]);
  return (
    <div
      className="pasteboard"
      ref={space}
      tabIndex={0}
      aria-label="海报画板。使用右侧图层和属性可通过键盘编辑。"
      onKeyDown={(event) => {
        if (event.target !== event.currentTarget) return;
        if (event.key === "Delete" || event.key === "Backspace") {
          event.preventDefault();
          engine.current?.remove();
        }
        if (event.key === "Escape") engine.current?.clear();
      }}
    >
      <div className="paper">
        <canvas ref={canvas} />
      </div>
    </div>
  );
}
