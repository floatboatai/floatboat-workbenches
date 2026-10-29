// ABOUTME: PDF.js浏览器引擎：同源worker、字体与CMap资源，以及可读的打开错误。
import { getDocument, GlobalWorkerOptions, type PDFDocumentLoadingTask } from "pdfjs-dist";
import workerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
GlobalWorkerOptions.workerSrc = workerUrl;

export function openPdf(bytes: Uint8Array): PDFDocumentLoadingTask {
  return getDocument({
    data: bytes.slice(),
    cMapUrl: "/api/pdfjs/cmaps/",
    cMapPacked: true,
    standardFontDataUrl: "/api/pdfjs/standard_fonts/",
    // The workbench CSP forbids eval and WebAssembly compilation; PDF.js falls back to JS decoders.
    useWasm: false,
    useSystemFonts: true,
    enableXfa: false,
    maxImageSize: 16_000_000,
    // Errors only: PDF.js recovery warnings for damaged files are reported through our own message.
    verbosity: 0,
  });
}

export function pdfError(e: unknown): Error {
  const name = e instanceof Error ? e.name : "";
  if (name === "PasswordException")
    return new Error("此PDF有打开密码。请先在原阅读器中解除密码，再打开副本。");
  if (name === "InvalidPDFException")
    return new Error("PDF文件损坏或格式无效，请重新导出原文件。");
  return e instanceof Error ? e : new Error("PDF无法读取，请尝试其他文件。");
}
