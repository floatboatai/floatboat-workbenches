// Reproducible demo assets: the studio logo PNG and the certificate background PDF.
// Run from the workbench directory: node scripts/make-samples.mjs
import { writeFile } from "node:fs/promises";
import { deflateSync } from "node:zlib";
import pdfLib from "@pdfme/pdf-lib";
const { PDFDocument, rgb, StandardFonts } = pdfLib;

const out = (name) => new URL(`../app/src/assets/${name}`, import.meta.url);

function crc32(bytes) {
  let c,
    crc = 0xffffffff;
  for (const byte of bytes) {
    c = (crc ^ byte) & 0xff;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    crc = c ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const head = Buffer.alloc(8);
  head.writeUInt32BE(data.length, 0);
  head.write(type, 4, "latin1");
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([head.subarray(4), data])), 0);
  return Buffer.concat([head, data, crc]);
}
function png(size, paint) {
  const raw = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0;
    for (let x = 0; x < size; x++) {
      let r = 0, g = 0, b = 0, a = 0;
      const S = 4; // supersampling for smooth edges
      for (let sy = 0; sy < S; sy++)
        for (let sx = 0; sx < S; sx++) {
          const [pr, pg, pb, pa] = paint((x + (sx + 0.5) / S) / size, (y + (sy + 0.5) / S) / size);
          r += pr * pa; g += pg * pa; b += pb * pa; a += pa;
        }
      const o = y * (size * 4 + 1) + 1 + x * 4;
      raw[o] = a ? Math.round(r / a) : 0;
      raw[o + 1] = a ? Math.round(g / a) : 0;
      raw[o + 2] = a ? Math.round(b / a) : 0;
      raw[o + 3] = Math.round((a / (S * S)) * 255);
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}
// Logo: a deep green rounded tile with a pale rice-ear mark.
const logo = png(96, (u, v) => {
  const inset = 0.04, radius = 0.2;
  const dx = Math.max(Math.abs(u - 0.5) - (0.5 - inset - radius), 0);
  const dy = Math.max(Math.abs(v - 0.5) - (0.5 - inset - radius), 0);
  if (Math.hypot(dx, dy) > radius) return [0, 0, 0, 0];
  const stem = Math.abs(u - 0.5 - (v - 0.5) * 0.18) < 0.025 && v > 0.22 && v < 0.82;
  let grain = false;
  for (let i = 0; i < 4; i++) {
    const cy = 0.3 + i * 0.12, side = i % 2 ? 1 : -1;
    const cx = 0.5 + side * 0.11 + (cy - 0.5) * 0.18;
    const rx = (u - cx) * Math.cos(side * 0.7) + (v - cy) * Math.sin(side * 0.7);
    const ry = -(u - cx) * Math.sin(side * 0.7) + (v - cy) * Math.cos(side * 0.7);
    if ((rx / 0.1) ** 2 + (ry / 0.045) ** 2 < 1) grain = true;
  }
  return stem || grain ? [241, 228, 196, 1] : [31, 95, 91, 1];
});
await writeFile(out("sample-logo.png"), logo);
await writeFile(
  new URL("../app/src/contracts/sample-logo.ts", import.meta.url),
  `// ABOUTME: 示例报价单使用的工作室标志（由 scripts/make-samples.mjs 生成的 96×96 PNG）。\nexport const SAMPLE_LOGO =\n  "data:image/png;base64,${logo.toString("base64")}";\n`,
);

// Certificate background: A4 landscape, cream paper, double frame, wave borders and a seal ring.
const pdf = await PDFDocument.create();
pdf.setTitle("Certificate background");
pdf.setCreator("Floatboat pdfme workbench sample");
pdf.setCreationDate(new Date("2026-10-01T00:00:00Z"));
pdf.setModificationDate(new Date("2026-10-01T00:00:00Z"));
const page = pdf.addPage([841.89, 595.28]);
const { width, height } = page.getSize();
const green = rgb(0.13, 0.33, 0.31), gold = rgb(0.72, 0.58, 0.33), cream = rgb(0.985, 0.972, 0.94);
page.drawRectangle({ x: 0, y: 0, width, height, color: cream });
page.drawRectangle({ x: 18, y: 18, width: width - 36, height: height - 36, borderColor: green, borderWidth: 3 });
page.drawRectangle({ x: 28, y: 28, width: width - 56, height: height - 56, borderColor: gold, borderWidth: 0.8 });
for (const [x, y] of [[28, 28], [width - 28, 28], [28, height - 28], [width - 28, height - 28]]) {
  page.drawCircle({ x, y, size: 9, color: cream, borderColor: gold, borderWidth: 0.8 });
  page.drawCircle({ x, y, size: 3.5, color: green });
}
const wave = (y0, amp, phase) => {
  let path = "";
  for (let x = 60; x <= width - 60; x += 4) path += `${x === 60 ? "M" : "L"} ${x} ${(Math.sin(x / 18 + phase) * amp).toFixed(2)} `;
  return { path, y0 };
};
for (const y0 of [height - 52, 52]) {
  for (const phase of [0, Math.PI / 2, Math.PI]) {
    const { path } = wave(y0, 4, phase);
    page.drawSvgPath(path, { x: 0, y: y0, borderColor: gold, borderWidth: 0.35, borderOpacity: 0.8 });
  }
}
const font = await pdf.embedFont(StandardFonts.TimesRomanItalic);
const label = "Certificate of Completion";
page.drawText(label, { x: (width - font.widthOfTextAtSize(label, 13)) / 2, y: height - 82, size: 13, font, color: gold });
page.drawCircle({ x: width - 150, y: 118, size: 46, borderColor: rgb(0.75, 0.23, 0.2), borderWidth: 2, borderOpacity: 0.35 });
page.drawCircle({ x: width - 150, y: 118, size: 39, borderColor: rgb(0.75, 0.23, 0.2), borderWidth: 0.6, borderOpacity: 0.35 });
page.drawLine({ start: { x: 120, y: 132 }, end: { x: 330, y: 132 }, thickness: 0.6, color: green });
const bytes = await pdf.save({ useObjectStreams: false });
await writeFile(out("certificate-background.pdf"), bytes);
console.log("logo", logo.length, "bytes; certificate", bytes.length, "bytes");
