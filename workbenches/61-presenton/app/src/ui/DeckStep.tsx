// ABOUTME: 第 3 步「成稿」：缩略页轨、演示舞台（点选文字/图表/图片定位到右侧字段）、演讲备注，导出 PPTX 与 PDF 为主操作。
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { ArrowDown, ArrowUp, Copy, Download, Plus, Trash2 } from "lucide-react";
import { switchLayout } from "../contracts/generate";
import { LIMITS, newId, type Slide } from "../contracts/model";
import type { Field } from "../shared/geometry";
import type { Doc, Step } from "./App";
import { useExports } from "./FileMenu";
import { Inspector } from "./Inspector";
import { SlideView } from "./SlideView";

function useWidth<T extends HTMLElement>(): [React.RefObject<T | null>, { w: number; h: number }] {
  const ref = useRef<T>(null);
  const [size, setSize] = useState({ w: 800, h: 450 });
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setSize({ w: e.contentRect.width, h: e.contentRect.height }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, size];
}

function useNarrow() {
  const query = "(max-width: 860px)";
  const [narrow, setNarrow] = useState(() => window.matchMedia(query).matches);
  useEffect(() => {
    const m = window.matchMedia(query);
    const on = () => setNarrow(m.matches);
    m.addEventListener("change", on);
    return () => m.removeEventListener("change", on);
  }, []);
  return narrow;
}

export function DeckStep({ doc, go }: { doc: Doc; go: (s: Step) => void }) {
  const slides = doc.data.slides;
  const activeId = typeof doc.draft.activeSlide === "string" && slides.some((s) => s.id === doc.draft.activeSlide) ? doc.draft.activeSlide : slides[0]?.id ?? "";
  const index = Math.max(0, slides.findIndex((s) => s.id === activeId));
  const slide = slides[index];
  const select = (id: string) => doc.setDraft((d) => ({ ...d, activeSlide: id }));
  const [field, setField] = useState<Field | null>(null);
  const [stageRef, stage] = useWidth<HTMLDivElement>();
  const ex = useExports(doc);
  const narrow = useNarrow();
  const rail = useRef<HTMLOListElement>(null);
  const stageWidth = Math.max(240, Math.min(stage.w, (stage.h * 16) / 9));
  useEffect(() => {
    rail.current?.querySelector(`[data-id="${CSS.escape(activeId)}"]`)?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [activeId]);
  const update = (patch: Partial<Slide> | ((s: Slide) => Slide)) =>
    doc.setData((d) => ({ ...d, slides: d.slides.map((s) => (s.id === slide.id ? (typeof patch === "function" ? patch(s) : { ...s, ...patch }) : s)) }));
  function move(by: number) {
    const to = index + by;
    if (to < 0 || to >= slides.length) return;
    doc.setData((d) => {
      const next = [...d.slides];
      [next[index], next[to]] = [next[to], next[index]];
      return { ...d, slides: next };
    });
  }
  function add(copy?: Slide) {
    if (slides.length >= LIMITS.slides) return doc.setError(`最多 ${LIMITS.slides} 页。`);
    const s: Slide = copy
      ? { ...structuredClone(copy), id: newId("s") }
      : { id: newId("s"), layout: "bullets", title: "新的一页", subtitle: "", bullets: ["第一条要点"], bullets2: [], columnTitles: ["", ""], stats: [], chart: null, image: null, notes: "", outlineId: "", source: "" };
    doc.setData((d) => ({ ...d, slides: [...d.slides.slice(0, index + 1), s, ...d.slides.slice(index + 1)] }));
    select(s.id);
  }
  function remove() {
    const next = slides[index + 1] ?? slides[index - 1];
    doc.setData((d) => ({ ...d, slides: d.slides.filter((s) => s.id !== slide.id) }));
    if (next) select(next.id);
    doc.setNotice(`已删除第 ${index + 1} 页。`);
  }
  function pick(f: Field) {
    setField(f);
    requestAnimationFrame(() => document.getElementById(`field-${f}`)?.focus());
  }
  const deckTitle = doc.title;

  if (!slide)
    return (
      <div className="deck-empty">
        <h1>还没有幻灯片</h1>
        <p>在大纲页按“生成幻灯片”，或从一页空白开始。</p>
        <div>
          <button type="button" className="primary" onClick={() => go("outline")}>
            去大纲
          </button>
          <button type="button" onClick={() => add()}>
            <Plus size={15} aria-hidden="true" />
            新建一页
          </button>
        </div>
      </div>
    );

  return (
    <div className="deck-step">
      <nav className="rail" aria-label="幻灯片">
        <ol ref={rail}>
          {slides.map((s, i) => (
            <li key={s.id} data-id={s.id}>
              <button type="button" className={s.id === slide.id ? "thumb current" : "thumb"} aria-current={s.id === slide.id ? "true" : undefined} aria-label={`第 ${i + 1} 页：${s.title || "未命名"}`} onClick={() => select(s.id)}>
                <span className="thumb-num">{i + 1}</span>
                <SlideView slide={s} themeId={doc.data.theme} index={i} total={slides.length} deckTitle={deckTitle} width={narrow ? 108 : 150} />
              </button>
            </li>
          ))}
        </ol>
        <button type="button" className="add-slide" onClick={() => add()}>
          <Plus size={15} aria-hidden="true" />
          新的一页
        </button>
      </nav>
      <section className="stage-area" aria-label="舞台">
        <div className="stage-bar">
          <span className="where">
            第 {index + 1} / {slides.length} 页
          </span>
          <span className="tools">
            <button type="button" className="ghost icon" aria-label="上移此页" disabled={index === 0} onClick={() => move(-1)}>
              <ArrowUp size={16} aria-hidden="true" />
            </button>
            <button type="button" className="ghost icon" aria-label="下移此页" disabled={index === slides.length - 1} onClick={() => move(1)}>
              <ArrowDown size={16} aria-hidden="true" />
            </button>
            <button type="button" className="ghost icon" aria-label="复制此页" onClick={() => add(slide)}>
              <Copy size={16} aria-hidden="true" />
            </button>
            <button type="button" className="ghost icon danger" aria-label="删除此页" disabled={slides.length <= 1} onClick={remove}>
              <Trash2 size={16} aria-hidden="true" />
            </button>
          </span>
          <span className="exports">
            <button type="button" onClick={ex.pdf} disabled={!!ex.busy}>
              {ex.busy === "pdf" ? "正在生成 PDF…" : "导出 PDF"}
            </button>
            <button type="button" className="primary" onClick={ex.pptx} disabled={!!ex.busy}>
              <Download size={15} aria-hidden="true" />
              {ex.busy === "pptx" ? "正在生成…" : "导出 PPTX"}
            </button>
          </span>
        </div>
        <div className="stage" ref={stageRef} onClick={() => setField(null)}>
          <div className="stage-slide">
            <SlideView slide={slide} themeId={doc.data.theme} index={index} total={slides.length} deckTitle={deckTitle} width={stageWidth} pick={pick} active={field} />
          </div>
        </div>
        <label className="notes-field">
          <span>演讲备注</span>
          <textarea rows={3} value={slide.notes} maxLength={LIMITS.notes} placeholder="讲这一页时要说的话，会写入 PPTX 备注" onChange={(e) => update({ notes: e.target.value })} />
        </label>
      </section>
      <Inspector
        key={slide.id}
        doc={doc}
        slide={slide}
        update={update}
        focusField={field}
        onLayout={(layout) => update((s) => switchLayout(s, layout))}
      />
    </div>
  );
}
