import { createElement } from "react";
import { Font, renderToBuffer } from "@react-pdf/renderer";
import resolveImage from "@react-pdf/image";
import { PDFDocument } from "../vendor/pdf.js";
import { toNative, validateDocument } from "../contracts/native.ts";
import type { InvoiceData } from "../contracts/document.ts";
let fontReady: Promise<void> | undefined;
export async function verifyImages(data: InvoiceData) {
  for (const asset of [data.logo, data.signature]) {
    if (!asset) continue;
    const image = await resolveImage(Buffer.from(asset.base64, "base64"), {
      cache: false,
    });
    if (!image || image.width !== asset.width || image.height !== asset.height)
      throw Error("图片原件无法解码，请重新附加。");
  }
}
export async function renderInvoice(
  raw: unknown,
  fontPath: (name: string) => Promise<string>,
) {
  const data = validateDocument(raw);
  await verifyImages(data);
  if (!fontReady) {
    fontReady = (async () => {
      const [regular, bold] = await Promise.all([
        fontPath("WorkbenchSansSC-Regular.ttf"),
        fontPath("WorkbenchSansSC-Bold.ttf"),
      ]);
      Font.register({
        family: "Roboto",
        fonts: [
          { src: regular, fontWeight: 400 },
          { src: bold, fontWeight: 700 },
        ],
      });
    })().catch((e) => {
      fontReady = undefined;
      throw e;
    });
  }
  await fontReady;
  const document = createElement(PDFDocument, toNative(data));
  const result = await renderToBuffer(
    document as Parameters<typeof renderToBuffer>[0],
  );
  if (result.length > 12000000) throw Error("PDF超过12MB，请拆分单据。");
  return result;
}
