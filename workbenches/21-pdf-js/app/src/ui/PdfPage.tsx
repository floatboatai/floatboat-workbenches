import { memo, useEffect, useRef, useState } from "react";
import { TextLayer, type PDFDocumentProxy, type RenderTask } from "pdfjs-dist";
import { pdfError } from "./engine";
export const PdfPage = memo(function PdfPage({
  pdf,
  page,
  width,
  zoom = 0,
  thumbnail = false,
}: {
  pdf: PDFDocumentProxy;
  page: number;
  width: number;
  zoom?: number;
  thumbnail?: boolean;
}) {
  const host = useRef<HTMLDivElement>(null),
    [error, setError] = useState(""),
    [visible, setVisible] = useState(!thumbnail);
  useEffect(() => {
    if (!thumbnail || !host.current) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: "200px" },
    );
    observer.observe(host.current);
    return () => observer.disconnect();
  }, [thumbnail]);
  useEffect(() => {
    if (!visible || !host.current) return;
    const root = host.current;
    let disposed = false,
      render: RenderTask | undefined,
      text: TextLayer | undefined;
    const canvas = document.createElement("canvas");
    canvas.setAttribute("aria-label", `第 ${page} 页`);
    canvas.setAttribute("role", "img");
    root.replaceChildren(canvas);
    setError("");
    void (async () => {
      const sheet = await pdf.getPage(page);
      if (disposed) return;
      const natural = sheet.getViewport({ scale: 1 });
      const scale = zoom || width / natural.width;
      const viewport = sheet.getViewport({ scale });
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      const output = Math.min(
        ratio,
        Math.sqrt(16000000 / (viewport.width * viewport.height)),
      );
      root.style.width = `${viewport.width}px`;
      root.style.height = `${viewport.height}px`;
      root.style.setProperty("--scale-factor", String(scale));
      root.style.setProperty("--total-scale-factor", String(scale));
      canvas.width = Math.floor(viewport.width * output);
      canvas.height = Math.floor(viewport.height * output);
      canvas.style.width = `${viewport.width}px`;
      canvas.style.height = `${viewport.height}px`;
      render = sheet.render({
        canvas,
        viewport,
        transform: [output, 0, 0, output, 0, 0],
      });
      await render.promise;
      if (disposed) return;
      if (!thumbnail) {
        const layer = document.createElement("div");
        layer.className = "textLayer";
        root.append(layer);
        text = new TextLayer({
          textContentSource: await sheet.getTextContent(),
          container: layer,
          viewport,
        });
        if (disposed) return;
        await text.render();
      }
    })().catch((e) => {
      if (!disposed) setError(pdfError(e).message);
    });
    return () => {
      disposed = true;
      render?.cancel();
      text?.cancel();
      root.replaceChildren();
    };
  }, [pdf, page, width, zoom, thumbnail, visible]);
  return (
    <>
      <div
        ref={host}
        className={thumbnail ? "pdf-page thumb-page" : "pdf-page"}
        style={thumbnail ? { width, height: width * 1.414 } : undefined}
      />
      {error && (
        <p className="render-error" role="alert">
          {error}
        </p>
      )}
    </>
  );
});
