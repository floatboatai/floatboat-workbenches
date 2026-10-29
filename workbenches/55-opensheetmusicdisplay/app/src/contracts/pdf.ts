// ABOUTME: 最小 PDF 1.4 写入器：每页嵌入一张 JPEG（DCTDecode），用于导出带批注的谱面校样。
export interface PdfPage {
  jpeg: Uint8Array;
  /** 图像像素尺寸。 */
  width: number;
  height: number;
  /** 页面尺寸（pt，1/72 英寸）。 */
  pageWidth: number;
  pageHeight: number;
}

export function jpegSize(bytes: Uint8Array): { width: number; height: number } {
  if (bytes[0] !== 0xff || bytes[1] !== 0xd8) throw new Error("不是 JPEG 图像。");
  let offset = 2;
  while (offset + 9 < bytes.length) {
    if (bytes[offset] !== 0xff) throw new Error("JPEG 结构无效。");
    const marker = bytes[offset + 1];
    const length = (bytes[offset + 2] << 8) | bytes[offset + 3];
    if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker))
      return { height: (bytes[offset + 5] << 8) | bytes[offset + 6], width: (bytes[offset + 7] << 8) | bytes[offset + 8] };
    offset += 2 + length;
  }
  throw new Error("JPEG 缺少尺寸信息。");
}

export function buildPdf(pages: PdfPage[], info: { title: string; subject?: string }): Uint8Array {
  if (!pages.length) throw new Error("没有可导出的页面。");
  const encoder = new TextEncoder();
  const chunks: Uint8Array[] = [];
  const offsets: number[] = [];
  let length = 0;
  const push = (part: string | Uint8Array) => {
    const bytes = typeof part === "string" ? encoder.encode(part) : part;
    chunks.push(bytes);
    length += bytes.length;
  };
  // PDF 文本字符串用 UTF-16BE 十六进制，标题可含中文。
  const pdfText = (value: string) => {
    let hex = "FEFF";
    for (const unit of value.slice(0, 200)) {
      const code = unit.codePointAt(0)!;
      if (code > 0xffff) {
        const v = code - 0x10000;
        hex += (0xd800 + (v >> 10)).toString(16).padStart(4, "0") + (0xdc00 + (v & 0x3ff)).toString(16).padStart(4, "0");
      } else hex += code.toString(16).padStart(4, "0");
    }
    return `<${hex.toUpperCase()}>`;
  };
  const object = (id: number, body: string | (string | Uint8Array)[]) => {
    offsets[id] = length;
    push(`${id} 0 obj\n`);
    for (const part of Array.isArray(body) ? body : [body]) push(part);
    push("\nendobj\n");
  };
  push("%PDF-1.4\n%âãÏÓ\n");
  const pageIds = pages.map((_, i) => 4 + i * 3);
  object(1, "<< /Type /Catalog /Pages 2 0 R >>");
  object(2, `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${pages.length} >>`);
  object(3, `<< /Title ${pdfText(info.title)} ${info.subject ? `/Subject ${pdfText(info.subject)} ` : ""}/Producer (Floatboat score review) >>`);
  pages.forEach((page, i) => {
    const id = pageIds[i];
    const w = page.pageWidth.toFixed(2),
      h = page.pageHeight.toFixed(2);
    const content = `q ${w} 0 0 ${h} 0 0 cm /Im0 Do Q`;
    object(id, `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${w} ${h}] /Resources << /XObject << /Im0 ${id + 2} 0 R >> >> /Contents ${id + 1} 0 R >>`);
    object(id + 1, `<< /Length ${content.length} >>\nstream\n${content}\nendstream`);
    object(id + 2, [
      `<< /Type /XObject /Subtype /Image /Width ${page.width} /Height ${page.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${page.jpeg.length} >>\nstream\n`,
      page.jpeg,
      "\nendstream",
    ]);
  });
  const count = 4 + pages.length * 3;
  const xref = length;
  push(`xref\n0 ${count}\n0000000000 65535 f \n`);
  for (let id = 1; id < count; id++) push(`${String(offsets[id]).padStart(10, "0")} 00000 n \n`);
  push(`trailer\n<< /Size ${count} /Root 1 0 R /Info 3 0 R >>\nstartxref\n${xref}\n%%EOF\n`);
  const out = new Uint8Array(length);
  let at = 0;
  for (const chunk of chunks) {
    out.set(chunk, at);
    at += chunk.length;
  }
  return out;
}
