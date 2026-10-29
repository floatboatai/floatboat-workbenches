// ABOUTME: 缩略轨：真实缩略图、拖动/键盘排序、复制与删除页面、按版式新增页面。
import { memo, useEffect, useRef, useState } from "react";
import { Copy, EyeOff, Plus, Trash2 } from "lucide-react";
import { LAYOUT_IDS, type LayoutId, type Slide, type Theme } from "../contracts/domain";
import { LAYOUTS } from "../contracts/layouts";
import { ScaledSlide } from "./SlideView";
import { LayoutGlyph } from "./Inspector";

const Thumb = memo(function Thumb({ slide, theme, number, width }: { slide: Slide; theme: Theme; number: number; width: number }) {
  return <ScaledSlide slide={slide} theme={theme} number={number} width={width} mode="thumb" />;
});

export function Rail({
  slides,
  theme,
  current,
  onSelect,
  onMove,
  onAdd,
  onDuplicate,
  onDelete,
}: {
  slides: Slide[];
  theme: Theme;
  current: number;
  onSelect: (index: number) => void;
  onMove: (from: number, to: number) => void;
  onAdd: (layout: LayoutId) => void;
  onDuplicate: () => void;
  onDelete: () => void;
}) {
  const [dragFrom, setDragFrom] = useState<number | null>(null);
  const [dropAt, setDropAt] = useState<number | null>(null);
  const [picker, setPicker] = useState(false);
  const addButton = useRef<HTMLButtonElement>(null);
  const pickerRef = useRef<HTMLDivElement>(null);
  const list = useRef<HTMLOListElement>(null);
  useEffect(() => {
    list.current?.querySelector<HTMLElement>(`[data-slide-index="${current}"]`)?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [current]);
  useEffect(() => {
    if (!picker) return;
    const close = (event: PointerEvent) => {
      if (!pickerRef.current?.contains(event.target as Node) && event.target !== addButton.current) setPicker(false);
    };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [picker]);
  return (
    <nav className="rail" aria-label="幻灯片">
      <ol className="rail-list" ref={list}>
        {slides.map((slide, i) => (
          <li
            key={slide.id}
            className={(dropAt === i && dragFrom !== null && dragFrom !== i ? "drop-target " : "") + (dragFrom === i ? "is-dragging" : "")}
            onDragOver={(event) => {
              if (dragFrom === null) return;
              event.preventDefault();
              setDropAt(i);
            }}
            onDrop={(event) => {
              event.preventDefault();
              if (dragFrom !== null && dragFrom !== i) onMove(dragFrom, i);
              setDragFrom(null);
              setDropAt(null);
            }}
          >
            <button
              type="button"
              className="thumb"
              data-slide-index={i}
              aria-current={i === current ? "page" : undefined}
              aria-label={`第 ${i + 1} 页，${LAYOUTS[slide.layout].label}${slide.hidden ? "，已隐藏" : ""}`}
              draggable
              onDragStart={(event) => {
                setDragFrom(i);
                event.dataTransfer.effectAllowed = "move";
                event.dataTransfer.setData("text/plain", String(i));
              }}
              onDragEnd={() => {
                setDragFrom(null);
                setDropAt(null);
              }}
              onClick={() => onSelect(i)}
              onKeyDown={(event) => {
                if (event.key !== "ArrowUp" && event.key !== "ArrowDown" && event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
                event.preventDefault();
                event.stopPropagation();
                const delta = event.key === "ArrowUp" || event.key === "ArrowLeft" ? -1 : 1;
                const target = Math.max(0, Math.min(slides.length - 1, i + delta));
                if (event.altKey) onMove(i, target);
                else onSelect(target);
                requestAnimationFrame(() => list.current?.querySelector<HTMLElement>(`[data-slide-index="${target}"]`)?.focus());
              }}
            >
              <span className="thumb-number">
                {i + 1}
                {slide.hidden ? <EyeOff size={11} aria-label="已隐藏" /> : null}
              </span>
              <span className={"thumb-frame" + (slide.hidden ? " is-hidden" : "")}>
                <Thumb slide={slide} theme={theme} number={i + 1} width={128} />
              </span>
            </button>
          </li>
        ))}
      </ol>
      <div className="rail-actions">
        <div className="rail-add">
          <button ref={addButton} type="button" className="add-slide" aria-expanded={picker} aria-haspopup="true" onClick={() => setPicker((v) => !v)}>
            <Plus size={14} aria-hidden="true" />
            新页面
          </button>
          {picker ? (
            <div
              className="layout-popover"
              ref={pickerRef}
              role="dialog"
              aria-label="选择新页面的版式"
              onKeyDown={(event) => {
                if (event.key === "Escape") {
                  setPicker(false);
                  addButton.current?.focus();
                }
              }}
            >
              <div className="layout-grid">
                {LAYOUT_IDS.map((id, index) => (
                  <button
                    key={id}
                    type="button"
                    autoFocus={index === 2}
                    title={LAYOUTS[id].hint}
                    onClick={() => {
                      onAdd(id);
                      setPicker(false);
                    }}
                  >
                    <LayoutGlyph id={id} />
                    <span>{LAYOUTS[id].label}</span>
                  </button>
                ))}
              </div>
            </div>
          ) : null}
        </div>
        <button type="button" className="icon-button" aria-label="复制当前页" title="复制当前页" onClick={onDuplicate}>
          <Copy size={14} aria-hidden="true" />
        </button>
        <button type="button" className="icon-button" aria-label="删除当前页" title="删除当前页" onClick={onDelete} disabled={slides.length <= 1}>
          <Trash2 size={14} aria-hidden="true" />
        </button>
      </div>
    </nav>
  );
}
