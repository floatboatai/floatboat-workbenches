import { useEffect, useState, type RefObject } from "react";

/** Zoom that keeps the whole page width inside the writing surface. */
export function fitZoom(surfaceWidth: number, pageWidth: number) {
  if (!(surfaceWidth > 0) || !(pageWidth > 0)) return 150;
  return Math.max(25, Math.min(150, Math.floor(((surfaceWidth - 28) / pageWidth) * 100)));
}

/**
 * The saved zoom is a document preference; on a narrow window the page is
 * shrunk to fit unless the reader explicitly picks a zoom in this session.
 */
export function useFitZoom(surface: RefObject<HTMLElement | null>, pageWidth: number, saved: number) {
  const [width, setWidth] = useState(0);
  const [explicit, setExplicit] = useState(false);
  useEffect(() => {
    const element = surface.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => setWidth(Math.round(entry.contentRect.width)));
    observer.observe(element);
    setWidth(element.clientWidth);
    return () => observer.disconnect();
  }, [surface]);
  const fit = fitZoom(width, pageWidth);
  const clamped = !explicit && width > 0 && saved > fit;
  return { effective: clamped ? fit : saved, fit, clamped, choose: () => setExplicit(true) };
}
