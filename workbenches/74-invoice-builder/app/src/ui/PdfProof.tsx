import { useEffect, useRef, useState } from "react";
import {
  getDocument,
  GlobalWorkerOptions,
  type PDFDocumentProxy,
  type RenderTask,
} from "pdfjs-dist";
import workerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
GlobalWorkerOptions.workerSrc = workerUrl;
export function PdfProof({ base64 }: { base64: string }) {
  const [pdf, setPdf] = useState<PDFDocumentProxy | null>(null),
    [page, setPage] = useState(1),
    [zoom, setZoom] = useState(1),
    [error, setError] = useState(""),
    [text, setText] = useState("");
  const host = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(600);
  useEffect(() => {
    let live = true;
    setError("");
    setPdf(null);
    setPage(1);
    const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
    const task = getDocument({
      data: bytes,
      useWasm: false,
      useSystemFonts: false,
      enableXfa: false,
      maxImageSize: 4000000,
    });
    void task.promise
      .then((doc) => {
        if (live) setPdf(doc);
      })
      .catch((e) => {
        if (live) setError(e instanceof Error ? e.message : "PDF无法读取。");
      });
    return () => {
      live = false;
      void task.destroy();
    };
  }, [base64]);
  useEffect(() => {
    if (!host.current) return;
    const root = host.current;
    const observer = new ResizeObserver(() =>
      setWidth(Math.min(780, root.clientWidth)),
    );
    observer.observe(root);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    if (!pdf || !host.current) return;
    let live = true;
    let render: RenderTask | undefined;
    const canvas = document.createElement("canvas");
    canvas.setAttribute("role", "img");
    canvas.setAttribute("aria-label", "PDF第" + page + "页");
    host.current.replaceChildren(canvas);
    void (async () => {
      const sheet = await pdf.getPage(page);
      if (!live) return;
      const v = sheet.getViewport({ scale: 1 });
      const scale = Math.max(0.25, (width / v.width) * zoom);
      const viewport = sheet.getViewport({ scale });
      const ratio = Math.min(
        devicePixelRatio || 1,
        2,
        Math.sqrt(8000000 / (viewport.width * viewport.height)),
      );
      canvas.width = Math.ceil(viewport.width * ratio);
      canvas.height = Math.ceil(viewport.height * ratio);
      canvas.style.width = viewport.width + "px";
      canvas.style.height = "auto";
      render = sheet.render({
        canvas,
        viewport,
        transform: [ratio, 0, 0, ratio, 0, 0],
      });
      await render.promise;
      const content = await sheet.getTextContent();
      if (live)
        setText(content.items.map((i) => ("str" in i ? i.str : "")).join(" "));
    })().catch((e) => {
      if (
        live &&
        !(e instanceof Error && e.name === "RenderingCancelledException")
      )
        setError(e instanceof Error ? e.message : "PDF绘制失败。");
    });
    return () => {
      live = false;
      render?.cancel();
    };
  }, [pdf, page, width, zoom]);
  return (
    <section className="pdf-proof" aria-label="PDF校样">
      {error ? (
        <p role="alert">{error}</p>
      ) : !pdf ? (
        <p role="status">正在加载校样…</p>
      ) : (
        <div className="proof-pages">
          <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
            上一页
          </button>
          <span aria-live="polite">
            {page} / {pdf.numPages}
          </span>
          <button
            disabled={page >= pdf.numPages}
            onClick={() => setPage((p) => p + 1)}
          >
            下一页
          </button>
          <label className="proof-zoom">
            <span>缩放</span>
            <select
              aria-label="PDF缩放"
              value={zoom}
              onChange={(e) => setZoom(Number(e.target.value))}
            >
              <option value={1}>整页宽度</option>
              <option value={1.5}>150%</option>
              <option value={2}>200%</option>
              <option value={3}>300%</option>
            </select>
          </label>
        </div>
      )}
      <div className="pdf-scroll">
        <div ref={host} className="pdf-canvas" />
      </div>
      <details>
        <summary>本页可读文字</summary>
        <p className="pdf-text">{text}</p>
      </details>
    </section>
  );
}
