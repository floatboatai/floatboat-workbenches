// ABOUTME: 最小 PDF 1.4 写出器：每页一张 JPEG（DCTDecode）铺满 16:9 页面，附文档标题；交叉引用表按实际字节偏移生成。

export type PdfPage = { jpeg: Uint8Array; width: number; height: number };
const enc = new TextEncoder();

/** PDF text string in UTF-16BE with BOM so Chinese titles survive in document properties. */
function pdfString(text: string): string {
  let hex = "FEFF";
  for (let i = 0; i < text.length; i++) hex += text.charCodeAt(i).toString(16).padStart(4, "0").toUpperCase();
  return `<${hex}>`;
}

export function buildPdf(pages: PdfPage[], title: string, pageWidthPt = 960, pageHeightPt = 540): Uint8Array {
  if (!pages.length) throw new Error("没有可写入 PDF 的页面。");
  for (const p of pages)
    if (p.jpeg[0] !== 0xff || p.jpeg[1] !== 0xd8) throw new Error("PDF 页面图像不是 JPEG。");
  const chunks: Uint8Array[] = [];
  const offsets: number[] = [];
  let length = 0;
  const push = (data: Uint8Array | string) => {
    const bytes = typeof data === "string" ? enc.encode(data) : data;
    chunks.push(bytes);
    length += bytes.length;
  };
  // Objects: 1 catalog, 2 pages, 3 info, then per page: page, content, image.
  const count = 3 + pages.length * 3;
  const begin = (n: number) => {
    offsets[n] = length;
    push(`${n} 0 obj\n`);
  };
  push("%PDF-1.4\n");
  push(new Uint8Array([0x25, 0xe2, 0xe3, 0xcf, 0xd3, 0x0a]));
  begin(1);
  push("<< /Type /Catalog /Pages 2 0 R >>\nendobj\n");
  begin(2);
  push(`<< /Type /Pages /Count ${pages.length} /Kids [${pages.map((_, i) => `${4 + i * 3} 0 R`).join(" ")}] >>\nendobj\n`);
  begin(3);
  push(`<< /Title ${pdfString(title)} /Producer (Floatboat Presenton workbench) >>\nendobj\n`);
  pages.forEach((p, i) => {
    const page = 4 + i * 3,
      content = page + 1,
      image = page + 2;
    begin(page);
    push(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageWidthPt} ${pageHeightPt}] /Resources << /XObject << /Im${i} ${image} 0 R >> >> /Contents ${content} 0 R >>\nendobj\n`,
    );
    const ops = `q ${pageWidthPt} 0 0 ${pageHeightPt} 0 0 cm /Im${i} Do Q\n`;
    begin(content);
    push(`<< /Length ${enc.encode(ops).length} >>\nstream\n${ops}endstream\nendobj\n`);
    begin(image);
    push(`<< /Type /XObject /Subtype /Image /Width ${p.width} /Height ${p.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${p.jpeg.length} >>\nstream\n`);
    push(p.jpeg);
    push("\nendstream\nendobj\n");
  });
  const xref = length;
  let table = `xref\n0 ${count + 1}\n0000000000 65535 f \n`;
  for (let n = 1; n <= count; n++) table += `${String(offsets[n]).padStart(10, "0")} 00000 n \n`;
  push(table);
  push(`trailer\n<< /Size ${count + 1} /Root 1 0 R /Info 3 0 R >>\nstartxref\n${xref}\n%%EOF\n`);
  const out = new Uint8Array(length);
  let at = 0;
  for (const c of chunks) {
    out.set(c, at);
    at += c.length;
  }
  return out;
}
