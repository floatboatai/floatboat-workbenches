import { useEffect, useMemo, useRef, useState, type RefObject } from "react";
import Reveal, { type RevealApi } from "reveal.js";
import "reveal.js/reveal.css";
import { type Deck, deckSections } from "../contracts/deck.ts";
import { stageCSS } from "../contracts/theme.ts";

export function Stage({
  data,
  index,
  onIndex,
  api,
  presenting,
}: {
  data: Deck;
  index: number;
  onIndex: (value: number) => void;
  api: RefObject<RevealApi | null>;
  presenting: boolean;
}) {
  const root = useRef<HTMLDivElement>(null),
    slides = useRef<HTMLDivElement>(null),
    callbacks = useRef(onIndex),
    live = useRef({ data, index });
  callbacks.current = onIndex;
  live.current = { data, index };
  const [error, setError] = useState("");
  const [ready, setReady] = useState(false);
  // Reveal owns its subtree. Save receipts never replace this mounted instance.
  const html = useMemo(() => deckSections(data), [data.slides, data.fragments]);
  useEffect(() => {
    if (!root.current || !slides.current) return;
    slides.current.innerHTML = deckSections(live.current.data);
    const deck = new Reveal(root.current, {
      embedded: true,
      keyboardCondition: "focused",
      width: 960,
      height: 540,
      margin: 0.05,
      center: true,
      controls: true,
      progress: true,
      hash: false,
      postMessage: false,
      postMessageEvents: false,
      help: false,
      view: null,
      scrollActivationWidth: 0,
      transition: "none",
      overview: true,
      slideNumber: "c/t",
    });
    api.current = deck;
    let disposed = false;
    deck.on("slidechanged", (event) => {
      if ("indexh" in event && typeof event.indexh === "number")
        callbacks.current(event.indexh);
    });
    void deck
      .initialize()
      .then(() => {
        if (!disposed) {
          deck.slide(live.current.index);
          setReady(true);
        }
      })
      .catch(() => {
        if (!disposed) setError("舞台暂时无法加载，请刷新重试。");
      });
    const observer = new ResizeObserver(() => deck.layout());
    observer.observe(root.current);
    return () => {
      disposed = true;
      observer.disconnect();
      api.current = null;
      deck.destroy();
    };
  }, [api]);
  useEffect(() => {
    if (!ready || !api.current || !slides.current) return;
    const deck = api.current,
      position = deck.getIndices();
    slides.current.innerHTML = html;
    deck.sync();
    deck.slide(live.current.index, 0, position.f);
  }, [html, ready, api]);
  useEffect(() => {
    if (!ready || !api.current) return;
    const reduced = matchMedia("(prefers-reduced-motion: reduce)");
    const configure = () =>
      api.current?.configure({
        height: data.ratio === "wide" ? 540 : 720,
        transition: reduced.matches ? "none" : data.transition,
        slideNumber: data.numbers ? "c/t" : false,
      });
    configure();
    reduced.addEventListener("change", configure);
    return () => reduced.removeEventListener("change", configure);
  }, [data.ratio, data.transition, data.numbers, ready, api]);
  useEffect(() => {
    if (ready && api.current?.getIndices().h !== index)
      api.current?.slide(index);
  }, [index, ready, api]);
  useEffect(() => {
    if (ready) {
      api.current?.layout();
      if (presenting) {
        root.current?.focus();
        root.current?.dispatchEvent(
          new PointerEvent("pointerdown", { bubbles: true }),
        );
      }
    }
  }, [presenting, ready, api]);
  return (
    <>
      <style>{stageCSS}</style>
      {error ? <p role="alert">{error}</p> : null}
      <div
        ref={root}
        className="reveal live-stage"
        data-theme={data.theme}
        data-ready={ready}
        tabIndex={0}
        role="region"
        aria-label="演示舞台，聚焦后用方向键翻页"
        onFocus={() =>
          root.current?.dispatchEvent(
            new PointerEvent("pointerdown", { bubbles: true }),
          )
        }
        onBlur={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget))
            document.body.dispatchEvent(
              new PointerEvent("pointerdown", { bubbles: true }),
            );
        }}
      >
        <div className="slides" ref={slides} />
      </div>
    </>
  );
}
