// Regenerates the bundled example conversions with the same local converters the page uses.
// Run from the workbench root: node --experimental-strip-types app/tools/build-examples.ts
import { readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { convertLocal, ENGINES, formatOf } from "../src/contracts/convert/index.ts";
import { readPdf } from "../src/contracts/convert/pdf-extract.ts";
import { layoutPdf } from "../src/contracts/convert/pdf-layout.ts";
import { summary } from "../src/contracts/review.ts";
const root = resolve("app/fixtures/examples");
const pdfjs = await import(pathToFileURL(resolve("node_modules/pdfjs-dist/legacy/build/pdf.mjs")).href);
const list = [
  { key: "water-report", file: "water-report.pdf", title: "城东水厂 2026 年第三季度水质报告" },
  { key: "pump-inspection", file: "pump-inspection.docx", title: "二号泵房设备巡检作业指导书" },
  { key: "shift-handover", file: "shift-handover.md", title: "泵站夜班交接记录" },
];
const sha = (b: Uint8Array | string) => createHash("sha256").update(b).digest("hex");
export async function convertExample(file: string) {
  const bytes = new Uint8Array(readFileSync(resolve(root, file)));
  const format = formatOf(file);
  if (format === "pdf") {
    const pdf = await pdfjs.getDocument({ data: bytes.slice(), cMapUrl: resolve("app/pdfjs/cmaps") + "/", cMapPacked: true, standardFontDataUrl: resolve("app/pdfjs/standard_fonts") + "/", useWasm: false, verbosity: 0 }).promise;
    const { pages } = await readPdf(pdf, pdfjs.OPS);
    return { bytes, format, conversion: layoutPdf(pages, file, bytes) };
  }
  return { bytes, format, conversion: convertLocal(format, bytes, file) };
}
const entries = [];
for (const e of list) {
  const { bytes, format, conversion } = await convertExample(e.file);
  const json = JSON.stringify(conversion.doc);
  const docFile = e.file.replace(/\.[^.]+$/, ".docling.json");
  writeFileSync(resolve(root, docFile), json);
  const source = { id: sha(bytes), name: e.file, format, bytes: bytes.length };
  const document = summary(conversion.doc, sha(json), new TextEncoder().encode(json).length, ENGINES[format as "pdf"], source);
  entries.push({ key: e.key, title: e.title, sourceFile: e.file, documentFile: docFile, document });
}
writeFileSync(
  resolve("app/src/contracts/examples.ts"),
  `// ABOUTME: 内置示例（由 app/tools/build-examples.ts 以本地解析器生成，勿手改）：原文件与结构文档的内容哈希。
import type { DocumentRef } from "./review.ts";
export interface Example {
  key: string;
  title: string;
  sourceFile: string;
  documentFile: string;
  document: DocumentRef & { source: NonNullable<DocumentRef["source"]> };
}
export const EXAMPLES: Example[] = ${JSON.stringify(entries, null, 2)};
`,
);
console.log(entries.map((e) => `${e.key}: ${e.document.items} items, ${e.document.pages} pages`).join("\n"));
