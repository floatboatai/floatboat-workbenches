import type { Designer } from "@pdfme/ui";
import type { generate } from "@pdfme/generator";
import type { text, rectangle } from "@pdfme/schemas";
import engineUrl from "../vendor/pdfme-browser.js?url";
interface PdfmeEngine {
  Designer: typeof Designer;
  generate: typeof generate;
  text: typeof text;
  rectangle: typeof rectangle;
}
declare global {
  interface Window {
    PdfmeBrowser?: PdfmeEngine;
  }
}
let pending: Promise<PdfmeEngine> | undefined;
export function loadPdfEngine(): Promise<PdfmeEngine> {
  if (window.PdfmeBrowser) return Promise.resolve(window.PdfmeBrowser);
  return (pending ??= new Promise<PdfmeEngine>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = engineUrl;
    script.async = true;
    script.onload = () => {
      if (window.PdfmeBrowser) resolve(window.PdfmeBrowser);
      else {
        pending = undefined;
        reject(new Error("PDF 引擎没有正确加载。"));
      }
    };
    script.onerror = () => {
      pending = undefined;
      script.remove();
      reject(new Error("PDF 引擎加载失败，请重试。"));
    };
    document.head.appendChild(script);
  }));
}
