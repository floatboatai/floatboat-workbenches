import { useEffect, useRef } from "react";
import Konva from "konva";
import type { Board, Item } from "../contracts/board";
import { request } from "./requests";
import { isRecord } from "../contracts/project";
export type CanvasHandle = { png: () => Promise<Blob> };
export function Canvas({
  board,
  selected,
  onSelect,
  onChange,
  handle,
  disabled,
  onError,
}: {
  board: Board;
  selected: string;
  onSelect: (id: string) => void;
  onChange: (item: Item) => void;
  handle: React.RefObject<CanvasHandle | null>;
  disabled: boolean;
  onError: (e: unknown) => void;
}) {
  const host = useRef<HTMLDivElement>(null),
    stage = useRef<Konva.Stage | null>(null),
    layer = useRef<Konva.Layer | null>(null),
    latest = useRef({ board, selected, onSelect, onChange, disabled, onError }),
    images = useRef(new Map<string, HTMLImageElement>()),
    pending = useRef<Promise<void>[]>([]);
  latest.current = { board, selected, onSelect, onChange, disabled, onError };
  useEffect(() => {
    if (!host.current) return;
    const s = new Konva.Stage({
        container: host.current,
        width: board.width,
        height: board.height,
      }),
      l = new Konva.Layer();
    s.add(l);
    stage.current = s;
    layer.current = l;
    const observer = new ResizeObserver(() => {
      const width = host.current?.parentElement?.clientWidth ?? board.width;
      const scale = Math.min(1, width / latest.current.board.width);
      s.size({
        width: latest.current.board.width * scale,
        height: latest.current.board.height * scale,
      });
      s.scale({ x: scale, y: scale });
    });
    observer.observe(host.current.parentElement!);
    s.on("click tap", (e) => {
      if (e.target === s) latest.current.onSelect("");
    });
    handle.current = {
      png: async () => {
        const captured = structuredClone(latest.current.board);
        const clone = s.clone({ container: document.createElement("div") });
        clone.size({ width: captured.width, height: captured.height });
        clone.scale({ x: 1, y: 1 });
        clone.find("Transformer").forEach((n) => n.destroy());
        try {
          await Promise.all(
            captured.items
              .filter((i) => i.source)
              .map(async (item) => {
                const src = item.source!;
                let img = images.current.get(src.id);
                if (!img) {
                  const value = await request("/api/originals/" + src.id);
                  if (!isRecord(value) || typeof value.base64 !== "string")
                    throw new Error("原图读取失败");
                  const loaded = new Image();
                  await new Promise<void>((resolve, reject) => {
                    loaded.onload = () => resolve();
                    loaded.onerror = () => reject(new Error("原图无法解码"));
                    loaded.src = "data:" + src.mime + ";base64," + value.base64;
                  });
                  img = loaded;
                }
                const node = clone
                  .find("Image")
                  .find((n) => n.id() === item.id);
                if (node instanceof Konva.Image) node.image(img);
              }),
          );
          clone.draw();
          return await new Promise<Blob>((resolve, reject) =>
            clone
              .toCanvas({ pixelRatio: 1 })
              .toBlob(
                (blob) =>
                  blob ? resolve(blob) : reject(new Error("PNG 导出失败")),
                "image/png",
              ),
          );
        } finally {
          clone.destroy();
        }
      },
    };
    return () => {
      observer.disconnect();
      s.destroy();
      handle.current = null;
    };
  }, []);
  useEffect(() => {
    const l = layer.current,
      s = stage.current;
    if (!l || !s) return;
    let disposed = false;
    pending.current = [];
    l.destroyChildren();
    s.size({
      width: board.width * s.scaleX(),
      height: board.height * s.scaleY(),
    });
    l.add(
      new Konva.Rect({
        width: board.width,
        height: board.height,
        fill: board.background,
        listening: false,
      }),
    );
    const tr = new Konva.Transformer({
      rotateEnabled: true,
      flipEnabled: false,
      ignoreStroke: true,
      boundBoxFunc: (old, b) =>
        Math.abs(b.width) < 8 || Math.abs(b.height) < 8 ? old : b,
    });
    for (const item of board.items) {
      const attrs = {
        id: item.id,
        x: item.x,
        y: item.y,
        width: Math.max(1, item.width),
        height: Math.max(1, item.height),
        rotation: item.rotation,
        fill: item.fill,
        stroke: item.stroke,
        strokeWidth: item.strokeWidth,
        draggable: !disabled,
      };
      let node: Konva.Shape;
      if (item.kind === "rect")
        node = new Konva.Rect({ ...attrs, cornerRadius: 4 });
      else if (item.kind === "text")
        node = new Konva.Text({
          ...attrs,
          text: item.text,
          fontSize: Math.max(8, item.height * 0.65),
          fontFamily: "Arial",
          verticalAlign: "middle",
        });
      else if (item.kind === "arrow")
        node = new Konva.Arrow({
          ...attrs,
          points: [0, 0, item.width, item.height],
          pointerLength: 12,
          pointerWidth: 12,
        });
      else {
        const n = new Konva.Image({ ...attrs, image: undefined });
        node = n;
        if (item.source) {
          const src = item.source,
            cached = images.current.get(src.id);
          if (cached) n.image(cached);
          else {
            const promise = (async () => {
              const value = await request("/api/originals/" + src.id);
              if (!isRecord(value) || typeof value.base64 !== "string")
                throw new Error("原图读取失败");
              const img = new Image();
              await new Promise<void>((resolve, reject) => {
                img.onload = () => resolve();
                img.onerror = () =>
                  reject(new Error("图片解码失败，请重新附加原图。"));
                img.src = "data:" + src.mime + ";base64," + value.base64;
              });
              images.current.set(src.id, img);
              if (!disposed) {
                n.image(img);
                l.draw();
              }
            })();
            pending.current.push(promise);
            void promise.catch((error) => {
              if (!disposed) {
                latest.current.onError(error);
                n.fill("#ffe4de");
                n.stroke("#d94e3e");
                l.draw();
              }
            });
          }
        }
      }
      node.on("click tap", () => latest.current.onSelect(item.id));
      node.on("dragend transformend", () => {
        const next = {
          ...item,
          x: node.x(),
          y: node.y(),
          width: Math.max(1, item.width * node.scaleX()),
          height: Math.max(1, item.height * node.scaleY()),
          rotation: node.rotation(),
        };
        latest.current.onChange(next);
      });
      l.add(node);
      if (item.id === selected && !disabled) tr.nodes([node]);
    }
    l.add(tr);
    l.draw();
    return () => {
      disposed = true;
    };
  }, [board, selected, disabled]);
  return (
    <div className="canvas-fit">
      <div
        ref={host}
        aria-label="标注画布；通过图层与属性可键盘编辑"
        role="img"
      />
    </div>
  );
}
