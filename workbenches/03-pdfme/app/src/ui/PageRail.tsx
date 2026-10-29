// ABOUTME: DTP 页面轨：用真实生成的 PDF 渲染缩略图（pdf2img），点击跳到对应页；顶部是纸张/底图控制。
import { memo, useEffect, useRef, useState, type ReactNode } from "react";
import type { Template } from "@pdfme/common";
import { renderPdf, thumbnails } from "./pdf";

const LIMIT = 40;

export const PageRail = memo(function PageRail({
  template,
  input,
  version,
  current,
  onSelect,
  children,
}: {
  template: Template | null;
  input: Record<string, string>;
  /** Changes whenever what the thumbnails show changes. */
  version: string;
  current: number;
  onSelect: (page: number) => void;
  children?: ReactNode;
}) {
  const [thumbs, setThumbs] = useState<{ urls: string[]; pages: number } | null>(null);
  const [state, setState] = useState<"idle" | "rendering" | "error">("idle");
  const latest = useRef({ template, input });
  latest.current = { template, input };
  useEffect(() => {
    if (!latest.current.template) return;
    let live = true;
    setState("rendering");
    const timer = setTimeout(() => {
      const { template: t, input: i } = latest.current;
      if (!t) return;
      renderPdf(t, [i])
        .then((bytes) => thumbnails(bytes, LIMIT))
        .then((next) => {
          if (!live) return;
          setThumbs(next);
          setState("idle");
        })
        .catch(() => {
          if (live) setState("error");
        });
    }, 650);
    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [version]);
  const pageCount = template?.schemas.length ?? 0;
  return (
    <nav className="page-rail" aria-label="页面">
      {children}
      <div className="rail-heading">
        <h2>页面</h2>
        <span aria-live="polite">{state === "rendering" ? "更新中…" : state === "error" ? "缩略图失败" : `${thumbs?.pages ?? pageCount} 页`}</span>
      </div>
      <ol className="rail-pages">
        {Array.from({ length: Math.min(thumbs?.pages ?? pageCount, LIMIT) }, (_, index) => (
          <li key={index}>
            <button type="button" aria-current={current === index ? "page" : undefined} aria-label={`跳到第 ${index + 1} 页`} onClick={() => onSelect(index)}>
              {thumbs?.urls[index] ? <img src={thumbs.urls[index]} alt="" width={96} height={136} /> : <span className="thumb-placeholder" aria-hidden="true" />}
              <span className="page-number">{index + 1}</span>
            </button>
          </li>
        ))}
      </ol>
      {(thumbs?.pages ?? 0) > LIMIT ? <p className="rail-note">仅显示前 {LIMIT} 页缩略图</p> : null}
    </nav>
  );
});
