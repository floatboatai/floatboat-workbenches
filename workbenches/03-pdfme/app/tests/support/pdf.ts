// ABOUTME: 测试辅助：在 Node 中用与页面相同的插件集和中文字体生成 PDF，并用 pdf.js 读取页数与文字。
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { generate } from "@pdfme/generator";
import * as schemas from "@pdfme/schemas";
import type { Template } from "@pdfme/common";

const require = createRequire(import.meta.url);
export const font = {
  NotoSansSC: { data: readFileSync(new URL("../../src/assets/noto-sans-sc.otf", import.meta.url)), fallback: true },
};
export const plugins = {
  text: schemas.text,
  multiVariableText: schemas.multiVariableText,
  table: schemas.table,
  image: schemas.image,
  svg: schemas.svg,
  line: schemas.line,
  rectangle: schemas.rectangle,
  ellipse: schemas.ellipse,
  date: schemas.date,
  time: schemas.time,
  dateTime: schemas.dateTime,
  select: schemas.select,
  radioGroup: schemas.radioGroup,
  checkbox: schemas.checkbox,
  ...schemas.barcodes,
};
export async function render(template: Template, inputs: Record<string, string>[]): Promise<Uint8Array> {
  return generate({ template, inputs, plugins, options: { font } });
}
type PdfJs = {
  getDocument(options: object): {
    promise: Promise<{
      numPages: number;
      getPage(n: number): Promise<{ getTextContent(): Promise<{ items: { str?: string }[] }> }>;
      destroy(): Promise<void>;
    }>;
  };
};
// Text extraction never paints; stubs keep pdf.js from probing for the optional native canvas package.
const scope = globalThis as Record<string, unknown>;
scope.DOMMatrix ??= class {};
scope.Path2D ??= class {};
const pdfjs = require("pdfjs-dist/legacy/build/pdf.js") as PdfJs;
export async function readPdf(bytes: Uint8Array): Promise<{ pages: number; text: string[] }> {
  const doc = await pdfjs.getDocument({ data: new Uint8Array(bytes), disableFontFace: true, isEvalSupported: false, verbosity: 0 }).promise;
  const text: string[] = [];
  for (let n = 1; n <= doc.numPages; n++) {
    const content = await (await doc.getPage(n)).getTextContent();
    text.push(content.items.map((item) => item.str ?? "").join(""));
  }
  const pages = doc.numPages;
  await doc.destroy();
  return { pages, text };
}
