// ABOUTME: 放映：全窗口逐页播放（跳过隐藏页），方向键/空格翻页，Esc 退出并把焦点还给「放映」按钮。
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { Deck } from "../contracts/domain";
import { ScaledSlide, slidePixels } from "./SlideView";

export function Slideshow({ deck, start, onExit }: { deck: Deck; start: number; onExit: () => void }) {
  const visible = deck.slides.map((s, i) => ({ s, i })).filter(({ s }) => !s.hidden);
  const initial = Math.max(0, visible.findIndex(({ i }) => i >= start));
  const [at, setAt] = useState(initial);
  const [width, setWidth] = useState(960);
  const root = useRef<HTMLDivElement>(null);
  const size = slidePixels(deck.theme);
  useLayoutEffect(() => {
    const measure = () => setWidth(Math.min(window.innerWidth, (window.innerHeight * size.w) / size.h));
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [size.w, size.h]);
  useEffect(() => {
    root.current?.focus();
  }, []);
  const current = visible[Math.min(at, visible.length - 1)];
  const go = (delta: number) => setAt((v) => Math.max(0, Math.min(visible.length - 1, v + delta)));
  return (
    <div
      className="slideshow"
      ref={root}
      tabIndex={-1}
      role="dialog"
      aria-modal="true"
      aria-label="放映"
      onKeyDown={(event) => {
        if (event.key === "Escape") onExit();
        else if (["ArrowRight", "ArrowDown", "PageDown", " ", "Enter"].includes(event.key)) go(1);
        else if (["ArrowLeft", "ArrowUp", "PageUp", "Backspace"].includes(event.key)) go(-1);
        else if (event.key === "Home") setAt(0);
        else if (event.key === "End") setAt(visible.length - 1);
        else return;
        event.preventDefault();
      }}
      onClick={(event) => go(event.clientX < window.innerWidth / 3 ? -1 : 1)}
    >
      {current ? <ScaledSlide slide={current.s} theme={deck.theme} number={current.i + 1} width={width} mode="show" /> : <p>所有页面都已隐藏。</p>}
      <div className="slideshow-bar" onClick={(event) => event.stopPropagation()}>
        <span aria-live="polite">
          {Math.min(at + 1, visible.length)} / {visible.length}
        </span>
        <button type="button" onClick={onExit}>
          退出放映 Esc
        </button>
      </div>
    </div>
  );
}
