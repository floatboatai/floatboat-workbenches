import type PptxGenJS from "pptxgenjs";
import engineUrl from "../vendor/pptxgen.bundle.js?url";
declare global {
  interface Window {
    PptxGenJS?: typeof PptxGenJS;
  }
}
let pending: Promise<typeof PptxGenJS> | undefined;
export function loadPresentationEngine(): Promise<typeof PptxGenJS> {
  if (window.PptxGenJS) return Promise.resolve(window.PptxGenJS);
  return (pending ??= new Promise<typeof PptxGenJS>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = engineUrl;
    script.async = true;
    script.onload = () => {
      if (window.PptxGenJS) resolve(window.PptxGenJS);
      else {
        pending = undefined;
        reject(new Error("演示引擎没有正确加载。"));
      }
    };
    script.onerror = () => {
      pending = undefined;
      script.remove();
      reject(new Error("演示引擎加载失败，请重试。"));
    };
    document.head.appendChild(script);
  }));
}
