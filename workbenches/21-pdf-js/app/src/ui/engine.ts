import { getDocument, GlobalWorkerOptions } from "pdfjs-dist";
import workerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import { checkPdfBytes, MAX_PAGES } from "../contracts/pdf";
GlobalWorkerOptions.workerSrc = workerUrl;
export function loadPdf(bytes: Uint8Array) {
  checkPdfBytes(bytes);
  return getDocument({
    data: bytes.slice(),
    cMapUrl: "/api/pdfjs/cmaps/",
    cMapPacked: true,
    standardFontDataUrl: "/api/pdfjs/standard_fonts/",
    wasmUrl: "/api/pdfjs/wasm/",
    // The workbench CSP uses JavaScript image decoders without WebAssembly eval.
    useWasm: false,
    useSystemFonts: true,
    enableXfa: false,
    maxImageSize: 16000000,
  });
}
export async function inspectPdf(bytes: Uint8Array) {
  const task = loadPdf(bytes);
  try {
    const pdf = await task.promise;
    if (pdf.numPages > MAX_PAGES)
      throw new Error("文档超过 200 页，请拆分后导入。");
    return pdf.numPages;
  } catch (e) {
    throw pdfError(e);
  } finally {
    await task.destroy();
  }
}
export function pdfError(e: unknown): Error {
  if (e instanceof Error && e.name === "PasswordException")
    return new Error(
      "此 PDF 有密码保护。请先在原阅读器中解除密码，再导入副本。",
    );
  if (e instanceof Error && e.name === "InvalidPDFException")
    return new Error("PDF 文件损坏或格式无效，请重新导出原文件。");
  return e instanceof Error ? e : new Error("PDF 无法读取，请尝试其他文件。");
}
