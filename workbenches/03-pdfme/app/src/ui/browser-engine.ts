// ABOUTME: 按需加载本地打包的 pdfme 浏览器引擎（Designer/Form/Viewer、生成器、全部字段插件、PDF 转图与 pdf-lib）。
import type { Designer, Form, Viewer } from "@pdfme/ui";
import type { generate } from "@pdfme/generator";
import type { Plugins } from "@pdfme/common";
import type { pdf2img, pdf2size } from "@pdfme/converter";
import type { PDFDocument } from "@pdfme/pdf-lib";
import engineUrl from "../vendor/pdfme-browser.js?url";
import { FIELD_TYPES } from "../contracts/domain";

type AnyPlugin = Plugins[string];
export interface PdfmeEngine {
  Designer: typeof Designer;
  Form: typeof Form;
  Viewer: typeof Viewer;
  generate: typeof generate;
  pdf2img: typeof pdf2img;
  pdf2size: typeof pdf2size;
  PDFDocument: typeof PDFDocument;
  text: AnyPlugin;
  multiVariableText: AnyPlugin;
  image: AnyPlugin;
  svg: AnyPlugin;
  table: AnyPlugin;
  barcodes: Record<string, AnyPlugin>;
  line: AnyPlugin;
  rectangle: AnyPlugin;
  ellipse: AnyPlugin;
  date: AnyPlugin;
  time: AnyPlugin;
  dateTime: AnyPlugin;
  select: AnyPlugin;
  radioGroup: AnyPlugin;
  checkbox: AnyPlugin;
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
/** Warm the engine on hover/focus of actions that need it. */
export function preloadPdfEngine() {
  void loadPdfEngine().catch(() => {});
}

let plugins: Record<string, AnyPlugin> | undefined;
/**
 * Every @pdfme/schemas plugin, keyed by its Chinese label: the Designer shows the key in its
 * element palette and type picker; rendering looks plugins up by schema type, so keys are free.
 */
export function pdfPlugins(engine: PdfmeEngine): Record<string, AnyPlugin> {
  if (plugins) return plugins;
  const byType: Record<string, AnyPlugin> = {
    text: engine.text,
    multiVariableText: engine.multiVariableText,
    table: engine.table,
    image: engine.image,
    svg: engine.svg,
    ...engine.barcodes,
    date: engine.date,
    time: engine.time,
    dateTime: engine.dateTime,
    select: engine.select,
    radioGroup: engine.radioGroup,
    checkbox: engine.checkbox,
    line: engine.line,
    rectangle: engine.rectangle,
    ellipse: engine.ellipse,
  };
  plugins = Object.fromEntries(
    (Object.keys(FIELD_TYPES) as (keyof typeof FIELD_TYPES)[]).filter((type) => byType[type]).map((type) => [FIELD_TYPES[type], byType[type]]),
  );
  return plugins;
}
