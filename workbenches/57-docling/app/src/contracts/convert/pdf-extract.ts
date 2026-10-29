// ABOUTME: 从 pdf.js 页面对象读取文字片段与图片位置（浏览器与 Node 测试共用，不直接依赖 pdfjs 模块）。
import type { PdfImage, PdfPageInput, PdfRun } from "./pdf-layout.ts";
type Matrix = [number, number, number, number, number, number];
interface TextItemLike {
  str?: unknown;
  transform?: unknown;
  width?: unknown;
}
export interface PdfPageLike {
  view: number[];
  rotate: number;
  getTextContent(): Promise<{ items: unknown[] }>;
  getOperatorList(): Promise<{ fnArray: number[]; argsArray: unknown[] }>;
  cleanup?(): void;
}
export interface PdfDocumentLike {
  numPages: number;
  getPage(n: number): Promise<PdfPageLike>;
}
export type PdfOps = Record<string, number>;
const multiply = (m: Matrix, n: Matrix): Matrix => [
  m[0] * n[0] + m[2] * n[1],
  m[1] * n[0] + m[3] * n[1],
  m[0] * n[2] + m[2] * n[3],
  m[1] * n[2] + m[3] * n[3],
  m[0] * n[4] + m[2] * n[5] + m[4],
  m[1] * n[4] + m[3] * n[5] + m[5],
];
const isMatrix = (v: unknown): v is Matrix =>
  (Array.isArray(v) || ArrayBuffer.isView(v)) && (v as ArrayLike<unknown>).length === 6 && Array.from(v as ArrayLike<number>).every((x) => typeof x === "number" && Number.isFinite(x));
/** Bounding boxes of painted raster images, tracking the graphics state's CTM. */
function images(ops: { fnArray: number[]; argsArray: unknown[] }, OPS: PdfOps, x0: number, y0: number): PdfImage[] {
  const out: PdfImage[] = [];
  const stack: Matrix[] = [];
  let ctm: Matrix = [1, 0, 0, 1, 0, 0];
  const paint = new Set([OPS.paintImageXObject, OPS.paintInlineImageXObject, OPS.paintImageMaskXObject, OPS.paintImageXObjectRepeat].filter((x) => x !== undefined));
  for (let i = 0; i < ops.fnArray.length; i++) {
    const fn = ops.fnArray[i]!,
      args = ops.argsArray[i] as unknown[] | null;
    if (fn === OPS.save) stack.push(ctm);
    else if (fn === OPS.restore) ctm = stack.pop() ?? ctm;
    else if (fn === OPS.transform && args && args.length === 6 && args.every((x) => typeof x === "number"))
      ctm = multiply(ctm, args as Matrix);
    else if (fn === OPS.paintFormXObjectBegin) {
      stack.push(ctm);
      if (args && isMatrix(args[0])) ctm = multiply(ctm, Array.from(args[0] as ArrayLike<number>) as Matrix);
    } else if (fn === OPS.paintFormXObjectEnd) ctm = stack.pop() ?? ctm;
    else if (paint.has(fn)) {
      const corners = [
        [0, 0],
        [1, 0],
        [0, 1],
        [1, 1],
      ].map(([u, v]) => [ctm[0] * u! + ctm[2] * v! + ctm[4], ctm[1] * u! + ctm[3] * v! + ctm[5]]);
      const xs = corners.map((c) => c[0]!),
        ys = corners.map((c) => c[1]!);
      out.push({ l: Math.min(...xs) - x0, r: Math.max(...xs) - x0, b: Math.min(...ys) - y0, t: Math.max(...ys) - y0 });
      if (out.length > 500) break;
    }
  }
  return out;
}
export async function readPdfPage(page: PdfPageLike, number: number, OPS: PdfOps): Promise<PdfPageInput> {
  const [x0 = 0, y0 = 0, x1 = 612, y1 = 792] = page.view;
  const content = await page.getTextContent();
  const runs: PdfRun[] = [];
  for (const raw of content.items) {
    const item = raw as TextItemLike;
    if (typeof item.str !== "string" || !Array.isArray(item.transform)) continue;
    const t = item.transform as number[];
    // Horizontal text only; rotated or vertical runs are left to Docling Serve.
    if (Math.abs(t[1] ?? 0) > 0.01 || Math.abs(t[2] ?? 0) > 0.01) continue;
    runs.push({
      str: item.str,
      x: (t[4] ?? 0) - x0,
      y: (t[5] ?? 0) - y0,
      w: typeof item.width === "number" ? item.width : 0,
      size: Math.abs(t[3] ?? 0) || Math.abs(t[0] ?? 0),
    });
  }
  let found: PdfImage[] = [];
  try {
    found = images(await page.getOperatorList(), OPS, x0, y0);
  } catch {
    found = [];
  }
  return { number, width: x1 - x0, height: y1 - y0, runs, images: found };
}
export async function readPdf(
  pdf: PdfDocumentLike,
  OPS: PdfOps,
  progress?: (done: number, total: number) => void,
): Promise<{ pages: PdfPageInput[]; rotated: number }> {
  const pages: PdfPageInput[] = [];
  let rotated = 0;
  for (let n = 1; n <= pdf.numPages; n++) {
    const page = await pdf.getPage(n);
    if (page.rotate % 360 !== 0) rotated++;
    pages.push(await readPdfPage(page, n, OPS));
    page.cleanup?.();
    progress?.(n, pdf.numPages);
  }
  return { pages, rotated };
}
