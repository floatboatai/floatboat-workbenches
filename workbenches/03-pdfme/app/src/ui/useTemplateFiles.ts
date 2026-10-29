// ABOUTME: 模板文件生命周期：示例与空白新建、以 PDF 新建或更换底图、纸张尺寸、模板 JSON 导入导出、批量数据导入。
import type { RefObject } from "react";
import {
  editableFields,
  importDocument,
  validatePdf,
  withBlankBase,
  withPdfBase,
  type Dataset,
  type PdfProject,
} from "../contracts/domain";
import { blankSample, certificateSample, labelSample, quotationSample } from "../contracts/samples";
import { autoMap, mappingSummary, parseDataset, type Table } from "../contracts/dataset";
import { MAX_DATASET_BYTES, MAX_PDF_BYTES } from "../contracts/assets";
import { download, type useProjects } from "./workspace";
import { dataUrlBytes, dehydrate, hydrate, readFileBytes, storeBlob } from "./assets";
import { inspectPdf } from "./pdf";
import type { SampleKind } from "./TemplateMenu";
import certificateBackground from "../assets/certificate-background.pdf?url";

export type Mode = "design" | "fill" | "data";
export const PAPERS = [
  { label: "A4 竖向", width: 210, height: 297 },
  { label: "A4 横向", width: 297, height: 210 },
  { label: "A5 竖向", width: 148, height: 210 },
  { label: "A6 竖向", width: 105, height: 148 },
  { label: "Letter", width: 216, height: 279 },
  { label: "物流标签", width: 100, height: 150 },
];
export const fileSafe = (title: string) => title.replace(/[\\/:*?"<>|\u0000-\u001f]/g, "_").trim() || "纸张工坊";
const csvCell = (value: string) => (/[",\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value);
function decodeText(bytes: Uint8Array): string {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    // Excel on Chinese Windows saves CSV as GBK; read it rather than rejecting the file.
    return new TextDecoder("gb18030").decode(bytes);
  }
}

type Projects = ReturnType<typeof useProjects<PdfProject>>;
export function useTemplateFiles({
  live,
  guarded,
  setWorking,
  opened,
  remount,
  setParsed,
  input,
}: {
  live: RefObject<Projects>;
  guarded: (label: string, work: () => Promise<void>) => Promise<void>;
  setWorking: (label: string) => void;
  /** A new document replaced the current one: switch to this view and remount the panes. */
  opened: (mode: Mode) => void;
  /** The template changed outside the Designer (base, paper size): remount it. */
  remount: () => void;
  setParsed: (value: { source: string; table: Table | null; error: string }) => void;
  input: Record<string, string>;
}) {
  async function importData(file: File) {
    await guarded("正在读取数据…", async () => {
      const format = /\.json$/i.test(file.name) || file.type === "application/json" ? "json" : "csv";
      const raw = await readFileBytes(file, MAX_DATASET_BYTES, "数据文件");
      const text = decodeText(raw);
      const parsedTable = parseDataset(text, format);
      if (!parsedTable.rows.length) throw new Error("数据只有表头，没有数据行。");
      const source = await storeBlob(new TextEncoder().encode(text), format === "json" ? "application/json" : "text/csv");
      const current = live.current.data;
      const nextMapping = autoMap(current.template, parsedTable.columns, current.dataset?.mapping);
      const previousColumn = current.dataset?.fileColumn ?? "";
      const next: Dataset = {
        source,
        name: file.name.slice(0, 200),
        format,
        mapping: nextMapping,
        fileColumn: parsedTable.columns.includes(previousColumn) ? previousColumn : (parsedTable.columns[0] ?? ""),
        selected: 0,
      };
      setParsed({ source, table: parsedTable, error: "" });
      live.current.setData((data) => ({ ...data, dataset: next }));
      const summary = mappingSummary(current, next, parsedTable.columns);
      live.current.setNotice(`已导入 ${parsedTable.rows.length} 行，自动对应 ${summary.mapped}/${summary.fields} 个字段。`);
    });
  }

  function downloadCsvTemplate() {
    const fields = editableFields(live.current.data.template).map(({ field }) => field.name);
    const row = fields.map((name) => csvCell(input[name] ?? ""));
    download(new Blob(["﻿" + fields.map(csvCell).join(",") + "\r\n" + row.join(",") + "\r\n"], { type: "text/csv" }), `${fileSafe(live.current.title)}-数据模板.csv`);
  }

  async function readPdfFile(file: File) {
    const bytes = await readFileBytes(file, MAX_PDF_BYTES, "PDF");
    const info = await inspectPdf(bytes);
    const ref = await storeBlob(bytes, "application/pdf", (fraction) => setWorking(`正在上传底图 ${Math.round(fraction * 100)}%…`));
    return { ref, info };
  }
  async function replaceBase(file: File) {
    await guarded("正在读取 PDF…", async () => {
      const { ref, info } = await readPdfFile(file);
      const { project, dropped } = withPdfBase(live.current.data, ref, info.pages);
      if (dropped && !confirm(`新底图只有 ${info.pages} 页，后面页面上的 ${dropped} 个字段会被移除。继续？`)) return;
      live.current.setData(project);
      remount();
      live.current.setNotice(`已使用「${file.name}」作为底图（${info.pages} 页）。`);
    });
  }
  async function removeBase() {
    await guarded("正在恢复空白纸…", async () => {
      const data = await hydrate(live.current.data);
      const base = data.template.basePdf;
      let size = { width: 210, height: 297 };
      if (typeof base === "string") {
        size = (await inspectPdf(dataUrlBytes(base))).sizes[0] ?? size;
      }
      live.current.setData(withBlankBase(live.current.data, Math.round(size.width), Math.round(size.height)));
      remount();
    });
  }
  function setPaper(index: number) {
    const paper = PAPERS[index];
    if (!paper) return;
    try {
      live.current.setData(withBlankBase(live.current.data, paper.width, paper.height));
      remount();
    } catch (error) {
      live.current.report(error);
    }
  }
  async function newFromPdf(file: File) {
    await guarded("正在读取 PDF…", async () => {
      const { ref, info } = await readPdfFile(file);
      const project = validatePdf({ template: { basePdf: ref, schemas: Array.from({ length: info.pages }, () => []) }, values: {} });
      if (await live.current.replace(project, file.name.replace(/\.pdf$/i, "").slice(0, 120) || "PDF 模板")) {
        opened("design");
        live.current.setNotice(`已以「${file.name}」（${info.pages} 页）新建模板，从左侧元素栏把字段拖到页面上。`);
      }
    });
  }
  async function createSample(kind: SampleKind) {
    await guarded("正在准备模板…", async () => {
      let data: PdfProject, title: string, next: Mode;
      if (kind === "quotation") [data, title, next] = [quotationSample, "报价单", "design"];
      else if (kind === "label") [data, title, next] = [labelSample, "发货标签", "data"];
      else if (kind === "certificate") {
        const response = await fetch(certificateBackground);
        if (!response.ok) throw new Error("示例底图加载失败，请重试。");
        const bytes = new Uint8Array(await response.arrayBuffer());
        await inspectPdf(bytes);
        [data, title, next] = [certificateSample(await storeBlob(bytes, "application/pdf")), "结业证书", "data"];
      } else if (kind === "a5") [data, title, next] = [blankSample(148, 210), "空白 A5", "design"];
      else if (kind === "label-blank") [data, title, next] = [blankSample(100, 150), "空白标签", "design"];
      else [data, title, next] = [blankSample(210, 297), "空白 A4", "design"];
      if (await live.current.replace(validatePdf(structuredClone(data)), title)) {
        opened(next);
      }
    });
  }
  async function exportJson() {
    await guarded("正在打包模板…", async () => {
      const data = await hydrate(live.current.data);
      const body = JSON.stringify({ kind: "floatboat-pdfme", version: 2, title: live.current.title, exportedAt: new Date().toISOString(), data }, null, 2);
      download(new Blob([body], { type: "application/json" }), `${fileSafe(live.current.title)}.json`);
    });
  }
  async function importJson(file: File) {
    await guarded("正在导入模板…", async () => {
      const bytes = await readFileBytes(file, 64 * 1024 * 1024, "模板文件");
      let raw: unknown;
      try {
        raw = JSON.parse(new TextDecoder().decode(bytes));
      } catch {
        throw new Error("模板文件不是有效的 JSON。");
      }
      const { title, data } = importDocument(raw, file.name.replace(/\.json$/i, "").slice(0, 120) || "导入的模板");
      let stored: PdfProject;
      try {
        stored = await dehydrate(data as PdfProject);
      } catch (error) {
        throw error instanceof TypeError ? new Error("模板结构无效：需要 basePdf 与按页排列的 schemas。") : error;
      }
      const project = validatePdf(stored);
      if (await live.current.replace(project, title)) {
        opened(project.dataset ? "data" : "design");
        live.current.setNotice(`已导入「${title}」为新模板。`);
      }
    });
  }
  return { importData, downloadCsvTemplate, replaceBase, removeBase, setPaper, newFromPdf, createSample, exportJson, importJson };
}
