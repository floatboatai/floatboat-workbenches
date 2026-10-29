// ABOUTME: 单页原页渲染：PDF.js画布与可选文字层，标出摘录、引用和当前定位，支持选中文字摘录。
import { memo, useEffect, useRef, useState } from "react";
import { TextLayer, type PDFDocumentProxy, type RenderTask } from "pdfjs-dist";
import { quoteSpans } from "../contracts/outline.ts";
import { pdfError } from "./pdf.ts";

export type Mark = { quote: string; kind: "note" | "cite" | "focus" };
type Layer = { divs: HTMLElement[]; strings: string[] };

export const PdfPage = memo(function PdfPage({
  pdf,
  page,
  width,
  zoom,
  marks,
  focusKey,
  onSelectText,
}: {
  pdf: PDFDocumentProxy;
  page: number;
  /** Available reading width in CSS pixels, used when zoom is 0 (fit width). */
  width: number;
  zoom: number;
  marks: Mark[];
  focusKey: number;
  onSelectText: (text: string, rect: DOMRect | null) => void;
}) {
  const host = useRef<HTMLDivElement>(null),
    [error, setError] = useState(""),
    [layer, setLayer] = useState<Layer | null>(null),
    [rendering, setRendering] = useState(true);
  useEffect(() => {
    const root = host.current;
    if (!root || width < 40) return;
    let disposed = false,
      render: RenderTask | undefined,
      text: TextLayer | undefined;
    const canvas = document.createElement("canvas");
    canvas.setAttribute("role", "img");
    canvas.setAttribute("aria-label", `原PDF第${page}页`);
    root.replaceChildren(canvas);
    setError("");
    setLayer(null);
    setRendering(true);
    void (async () => {
      const sheet = await pdf.getPage(page);
      if (disposed) return;
      const natural = sheet.getViewport({ scale: 1 });
      const scale = zoom ? zoom / 100 : Math.min(2.4, width / natural.width);
      const viewport = sheet.getViewport({ scale });
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      const output = Math.min(ratio, Math.sqrt(16_000_000 / (viewport.width * viewport.height)));
      root.style.width = `${Math.floor(viewport.width)}px`;
      root.style.height = `${Math.floor(viewport.height)}px`;
      root.style.setProperty("--scale-factor", String(scale));
      root.style.setProperty("--total-scale-factor", String(scale));
      canvas.width = Math.floor(viewport.width * output);
      canvas.height = Math.floor(viewport.height * output);
      canvas.style.width = `${Math.floor(viewport.width)}px`;
      canvas.style.height = `${Math.floor(viewport.height)}px`;
      render = sheet.render({ canvas, viewport, transform: [output, 0, 0, output, 0, 0] });
      await render.promise;
      if (disposed) return;
      setRendering(false);
      const container = document.createElement("div");
      container.className = "textLayer";
      root.append(container);
      text = new TextLayer({
        textContentSource: await sheet.getTextContent(),
        container,
        viewport,
      });
      if (disposed) return;
      await text.render();
      if (disposed) return;
      setLayer({ divs: text.textDivs, strings: text.textContentItemsStr });
    })().catch((e: unknown) => {
      if (!disposed && !(e instanceof Error && e.name === "RenderingCancelledException"))
        setError(pdfError(e).message);
    });
    return () => {
      disposed = true;
      render?.cancel();
      text?.cancel();
      root.replaceChildren();
    };
  }, [pdf, page, width, zoom]);
  // Highlights are applied to the rendered text layer without re-rendering the page.
  useEffect(() => {
    if (!layer) return;
    // Rebuild only the covered runs, wrapping the exact characters of each passage.
    const rank = { note: 1, cite: 2, focus: 3 } as const,
      names = ["", "note", "cite", "focus"];
    const levels = new Map<number, number[]>();
    for (const mark of marks)
      for (const span of quoteSpans(layer.strings, mark.quote)) {
        const level = levels.get(span.run) ?? Array(layer.strings[span.run].length).fill(0);
        for (let c = span.from; c < span.to; c++) level[c] = Math.max(level[c], rank[mark.kind]);
        levels.set(span.run, level);
      }
    layer.divs.forEach((div, i) => {
      if (div.dataset.marked && !levels.has(i)) {
        div.textContent = layer.strings[i];
        delete div.dataset.marked;
      }
    });
    let first: HTMLElement | null = null;
    for (const [i, level] of levels) {
      const div = layer.divs[i],
        text = layer.strings[i];
      if (!div) continue;
      div.dataset.marked = "1";
      div.replaceChildren();
      for (let c = 0; c < text.length; ) {
        let end = c + 1;
        while (end < text.length && level[end] === level[c]) end++;
        const piece = text.slice(c, end);
        if (level[c]) {
          const mark = document.createElement("span");
          mark.className = `mark mark-${names[level[c]]}`;
          mark.textContent = piece;
          div.append(mark);
          if (level[c] === 3) first ??= mark;
        } else div.append(piece);
        c = end;
      }
    }
    first?.scrollIntoView({
      block: "center",
      behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
    });
  }, [layer, marks, focusKey]);
  return (
    <div className="page-frame">
      <div
        ref={host}
        className={rendering ? "pdf-page rendering" : "pdf-page"}
        onMouseUp={() => {
          const selection = window.getSelection();
          const value = selection?.toString().trim() ?? "";
          if (!value || !host.current || !selection?.rangeCount) {
            onSelectText("", null);
            return;
          }
          const range = selection.getRangeAt(0);
          if (!host.current.contains(range.commonAncestorContainer)) return;
          onSelectText(value, range.getBoundingClientRect());
        }}
      />
      {error ? (
        <p className="render-error" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
});
