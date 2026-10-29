// ABOUTME: 浏览器内 PDF 生成、分批合并、ZIP 打包、底图页数/尺寸读取与页面缩略图。
import type { Template } from "@pdfme/common";
import { loadFont } from "./fonts";
import { loadPdfEngine, pdfPlugins, type PdfmeEngine } from "./browser-engine";
import { createZip } from "../contracts/zip";
import { bytesToDataUrl } from "./assets";
import { MAX_PDF_BYTES, MAX_PDF_PAGES, formatBytes } from "../contracts/assets";

export async function engineWithFont() {
  const [engine, font] = await Promise.all([loadPdfEngine(), loadFont()]);
  return { engine, font, plugins: pdfPlugins(engine) };
}

export async function renderPdf(template: Template, inputs: Record<string, string>[], title = ""): Promise<Uint8Array> {
  const { engine, font, plugins } = await engineWithFont();
  return engine.generate({ template, inputs, plugins, options: { font, title, lang: "zh", creator: "纸张工坊 · pdfme 5.4.6" } });
}

export interface BatchProgress {
  done: number;
  total: number;
}
const BATCH = 25;
const pause = () => new Promise((resolve) => setTimeout(resolve, 0));

/** One merged PDF; generated in slices so progress shows and the page stays responsive. */
export async function renderMerged(
  template: Template,
  inputs: Record<string, string>[],
  title: string,
  progress: (value: BatchProgress) => void,
  signal: AbortSignal,
): Promise<Uint8Array> {
  const { engine } = await engineWithFont();
  if (inputs.length <= BATCH) {
    progress({ done: 0, total: inputs.length });
    const bytes = await renderPdf(template, inputs, title);
    progress({ done: inputs.length, total: inputs.length });
    return bytes;
  }
  const merged = await engine.PDFDocument.create();
  merged.setTitle(title);
  merged.setCreator("纸张工坊 · pdfme 5.4.6");
  for (let start = 0; start < inputs.length; start += BATCH) {
    if (signal.aborted) throw new DOMException("已取消批量生成。", "AbortError");
    const part = await engine.PDFDocument.load(await renderPdf(template, inputs.slice(start, start + BATCH), title));
    for (const page of await merged.copyPages(part, part.getPageIndices())) merged.addPage(page);
    progress({ done: Math.min(start + BATCH, inputs.length), total: inputs.length });
    await pause();
  }
  return merged.save();
}

/** One PDF per row, packed into a ZIP. */
export async function renderZip(
  template: Template,
  inputs: Record<string, string>[],
  names: string[],
  progress: (value: BatchProgress) => void,
  signal: AbortSignal,
): Promise<Uint8Array> {
  const files = [];
  for (const [index, input] of inputs.entries()) {
    if (signal.aborted) throw new DOMException("已取消批量生成。", "AbortError");
    files.push({ name: names[index], data: await renderPdf(template, [input], names[index].replace(/\.pdf$/, "")) });
    progress({ done: index + 1, total: inputs.length });
    if (index % 5 === 4) await pause();
  }
  return createZip(files);
}

export interface PdfInfo {
  pages: number;
  sizes: { width: number; height: number }[];
}
/** Validate an uploaded PDF before it becomes a background: size, header, page count, readable by pdf.js. */
export async function inspectPdf(bytes: Uint8Array, engine?: PdfmeEngine): Promise<PdfInfo> {
  if (bytes.length > MAX_PDF_BYTES) throw new Error(`PDF 为 ${formatBytes(bytes.length)}，超过 ${formatBytes(MAX_PDF_BYTES)} 上限。`);
  if (!new TextDecoder("latin1").decode(bytes.subarray(0, 1024)).includes("%PDF-")) throw new Error("所选文件不是 PDF。");
  const pdf = engine ?? (await loadPdfEngine());
  let sizes: { width: number; height: number }[];
  try {
    sizes = await pdf.pdf2size(bytes.slice());
  } catch (error) {
    const text = error instanceof Error ? error.message : "";
    throw new Error(/password/i.test(text) ? "PDF 已加密，请先移除打开密码。" : "PDF 无法读取，可能已损坏。");
  }
  if (!sizes.length) throw new Error("PDF 没有页面。");
  if (sizes.length > MAX_PDF_PAGES) throw new Error(`PDF 有 ${sizes.length} 页，模板最多 ${MAX_PDF_PAGES} 页。`);
  return { pages: sizes.length, sizes };
}

/** Raster thumbnails of the rendered pages (first `limit` pages). */
export async function thumbnails(bytes: Uint8Array, limit: number): Promise<{ urls: string[]; pages: number }> {
  const { engine } = await engineWithFont();
  const pages = (await engine.pdf2size(bytes.slice())).length;
  const images = await engine.pdf2img(bytes.slice(), { scale: 0.32, imageType: "png", range: { start: 0, end: Math.min(pages, limit) - 1 } });
  // Data URLs: the workbench CSP allows data: images but not blob: ones.
  return { urls: images.map((image) => bytesToDataUrl(new Uint8Array(image), "image/png")), pages };
}
