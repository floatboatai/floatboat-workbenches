// ABOUTME: 原页对照：pdf.js 渲染原 PDF 页面，按 DoclingDocument prov 坐标框选每个结构块，点选与结构目录、校订面板联动。
import { memo, useEffect, useMemo, useRef, useState } from "react";
import type { PDFDocumentProxy, RenderTask } from "pdfjs-dist/legacy/build/pdf.mjs";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { boxes, pageSizes, type Box, type Document, type Item } from "../contracts/docling.ts";
import { loadSource } from "./library.ts";
import { openPdf, pdfError } from "./pdf.ts";
export interface Mark {
  ref: string;
  box: Box;
  kind: string;
  label: string;
  edited: boolean;
  reviewed: boolean;
}
const kindOf = (n: Item) => (n.data ? "table" : n.self_ref.startsWith("#/pictures") ? "picture" : n.label === "title" || n.label === "section_header" ? "heading" : n.content_layer === "furniture" ? "furniture" : "text");
export function marksFor(doc: Document, rows: { item: Item }[], labelOf: (n: Item) => string, corrections: Record<string, { reviewed: boolean; text?: string; cells?: object; label?: string }>): Map<number, Mark[]> {
  const out = new Map<number, Mark[]>();
  for (const { item } of rows)
    for (const box of boxes(item)) {
      const c = corrections[item.self_ref];
      const list = out.get(box.page) ?? [];
      list.push({ ref: item.self_ref, box, kind: kindOf(item), label: labelOf(item) + (item.text ? "：" + item.text.slice(0, 40) : ""), edited: !!c && (c.text !== undefined || c.cells !== undefined || c.label !== undefined), reviewed: !!c?.reviewed });
      out.set(box.page, list);
    }
  void doc;
  return out;
}
const Page = memo(function Page({
  pdf,
  number,
  width,
  size,
  marks,
  active,
  showAll,
  onSelect,
}: {
  pdf: PDFDocumentProxy;
  number: number;
  width: number;
  size: { width: number; height: number };
  marks: Mark[];
  active: string;
  showAll: boolean;
  onSelect: (ref: string) => void;
}) {
  const frame = useRef<HTMLDivElement>(null),
    canvasHost = useRef<HTMLDivElement>(null),
    [visible, setVisible] = useState(false),
    [error, setError] = useState("");
  useEffect(() => {
    const el = frame.current;
    if (!el) return;
    const io = new IntersectionObserver((entries) => setVisible(entries.some((e) => e.isIntersecting)), { rootMargin: "900px 0px" });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  useEffect(() => {
    const host = canvasHost.current;
    if (!host || !visible || width < 40) return;
    let disposed = false,
      task: RenderTask | undefined;
    const canvas = document.createElement("canvas");
    canvas.setAttribute("aria-hidden", "true");
    void (async () => {
      const sheet = await pdf.getPage(number);
      if (disposed) return;
      const natural = sheet.getViewport({ scale: 1 });
      const viewport = sheet.getViewport({ scale: width / natural.width });
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      const output = Math.min(ratio, Math.sqrt(16_000_000 / (viewport.width * viewport.height)));
      canvas.width = Math.floor(viewport.width * output);
      canvas.height = Math.floor(viewport.height * output);
      task = sheet.render({ canvas, viewport, transform: [output, 0, 0, output, 0, 0] });
      await task.promise;
      if (!disposed) host.replaceChildren(canvas);
    })().catch((e: unknown) => {
      if (!disposed && !(e instanceof Error && e.name === "RenderingCancelledException")) setError(pdfError(e).message);
    });
    return () => {
      disposed = true;
      task?.cancel();
    };
  }, [pdf, number, width, visible]);
  const W = size.width,
    H = size.height;
  return (
    <div ref={frame} className="pdf-sheet" data-page={number} style={{ width, aspectRatio: `${W} / ${H}` }} aria-label={`原页第 ${number} 页`} role="group">
      <div ref={canvasHost} className="pdf-canvas" />
      {error ? <p className="page-error" role="alert">{error}</p> : null}
      {marks.map((m, i) => {
        const top = m.box.origin === "BOTTOMLEFT" ? H - m.box.t : m.box.t,
          bottom = m.box.origin === "BOTTOMLEFT" ? H - m.box.b : m.box.b;
        const on = m.ref === active;
        return (
          <button
            key={m.ref + i}
            type="button"
            data-ref={m.ref}
            className={`box ${m.kind}${on ? " on" : ""}${showAll || on ? " shown" : ""}${m.reviewed ? " reviewed" : ""}${m.edited ? " edited" : ""}`}
            style={{
              left: `${(Math.min(m.box.l, m.box.r) / W) * 100}%`,
              top: `${(Math.min(top, bottom) / H) * 100}%`,
              width: `${(Math.abs(m.box.r - m.box.l) / W) * 100}%`,
              height: `${(Math.abs(bottom - top) / H) * 100}%`,
            }}
            aria-label={`选择 ${m.label}`}
            aria-pressed={on}
            onClick={() => onSelect(m.ref)}
          />
        );
      })}
      <span className="page-no" aria-hidden="true">{number}</span>
    </div>
  );
});
export function PageView({
  sourceId,
  doc,
  marks,
  active,
  onSelect,
  showAll,
  onShowAll,
}: {
  sourceId: string;
  doc: Document;
  marks: Map<number, Mark[]>;
  active: string;
  onSelect: (ref: string) => void;
  showAll: boolean;
  onShowAll: (v: boolean) => void;
}) {
  const [pdf, setPdf] = useState<PDFDocumentProxy | null>(null),
    [error, setError] = useState(""),
    [zoom, setZoom] = useState(1),
    [width, setWidth] = useState(0),
    [current, setCurrent] = useState(1);
  const scroller = useRef<HTMLDivElement>(null);
  const sizes = useMemo(() => pageSizes(doc), [doc]);
  useEffect(() => {
    let disposed = false;
    let destroy: (() => void) | undefined;
    setPdf(null);
    setError("");
    setCurrent(1);
    loadSource(sourceId)
      .then(async (bytes) => {
        if (disposed) return;
        const task = openPdf(bytes);
        destroy = () => void task.destroy();
        const proxy = await task.promise;
        if (!disposed) setPdf(proxy);
      })
      .catch((e: unknown) => {
        if (!disposed) setError(pdfError(e).message);
      });
    return () => {
      disposed = true;
      destroy?.();
    };
  }, [sourceId]);
  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setWidth(Math.max(240, el.clientWidth - 32)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  // Follow the selection from the structure list or proof into the page.
  useEffect(() => {
    const el = scroller.current?.querySelector<HTMLElement>(`.box[data-ref="${CSS.escape(active)}"]`);
    if (!el || !scroller.current) return;
    const a = el.getBoundingClientRect(),
      b = scroller.current.getBoundingClientRect();
    if (a.top < b.top + 40 || a.bottom > b.bottom - 40)
      el.scrollIntoView({ block: "center", behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
  }, [active, pdf, width]);
  const total = pdf?.numPages ?? sizes.size;
  const onScroll = () => {
    const el = scroller.current;
    if (!el) return;
    const mid = el.getBoundingClientRect().top + el.clientHeight / 3;
    for (const sheet of el.querySelectorAll<HTMLElement>(".pdf-sheet")) {
      const r = sheet.getBoundingClientRect();
      if (r.top <= mid && r.bottom >= mid) {
        setCurrent(Number(sheet.dataset.page));
        break;
      }
    }
  };
  const go = (n: number) => {
    const el = scroller.current?.querySelector<HTMLElement>(`.pdf-sheet[data-page="${n}"]`);
    el?.scrollIntoView({ block: "start" });
    setCurrent(n);
  };
  const pageWidth = Math.round(width * zoom);
  return (
    <div className="page-view">
      <div className="view-tools" role="toolbar" aria-label="原页工具">
        <button type="button" className="icon" aria-label="上一页" disabled={current <= 1} onClick={() => go(current - 1)}>
          <ChevronLeft size={16} aria-hidden="true" />
        </button>
        <span className="page-count" aria-live="polite">
          第 {current} / {total || "…"} 页
        </span>
        <button type="button" className="icon" aria-label="下一页" disabled={current >= total} onClick={() => go(current + 1)}>
          <ChevronRight size={16} aria-hidden="true" />
        </button>
        <label className="zoom">
          <span className="sr-only">缩放</span>
          <select value={zoom} onChange={(e) => setZoom(Number(e.target.value))}>
            <option value={1}>适合宽度</option>
            <option value={1.25}>125%</option>
            <option value={1.5}>150%</option>
            <option value={2}>200%</option>
          </select>
        </label>
        <label className="toggle">
          <input type="checkbox" checked={showAll} onChange={(e) => onShowAll(e.target.checked)} />
          显示全部框
        </label>
      </div>
      <div ref={scroller} className="page-scroll" onScroll={onScroll} tabIndex={-1}>
        {error ? (
          <div className="page-missing" role="alert">
            <p>{error}</p>
            <p className="hint">结构与校订仍可编辑；重新转换原文件即可恢复原页对照。</p>
          </div>
        ) : !pdf || !width ? (
          <p className="page-loading" role="status">正在打开原页…</p>
        ) : (
          Array.from({ length: pdf.numPages }, (_, i) => i + 1).map((n) => (
            <Page key={n} pdf={pdf} number={n} width={pageWidth} size={sizes.get(n) ?? sizes.get(1) ?? { width: 595, height: 842 }} marks={marks.get(n) ?? []} active={active} showAll={showAll} onSelect={onSelect} />
          ))
        )}
      </div>
    </div>
  );
}
