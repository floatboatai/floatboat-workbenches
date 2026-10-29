// ABOUTME: 每种 pdfme 字段类型都用中文字体真实生成 PDF，并检查页数、文字与图像对象；示例模板与批量数据端到端生成。
import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import pdfLib from "@pdfme/pdf-lib";
import type { Template } from "@pdfme/common";
import { plugins, readPdf, render } from "./support/pdf.ts";
import { FIELD_TYPES, pdfInput, validatePdf, type PdfProject } from "../src/contracts/domain.ts";
import { certificateSample, labelSample, quotationSample } from "../src/contracts/samples.ts";
import { SAMPLE_LOGO } from "../src/contracts/sample-logo.ts";
import { parseDataset, rowInput, validateRows } from "../src/contracts/dataset.ts";
import { createZip, readZip } from "../src/contracts/zip.ts";

const { PDFDocument, PDFName, PDFDict } = pdfLib;

/** Field-specific value and the text pdf.js must find in the output (null for graphics-only fields). */
const CASES: Record<string, { patch?: Record<string, unknown>; value?: string; expect: string | null }> = {
  text: { value: "中文正文 Alpha", expect: "中文正文 Alpha" },
  multiVariableText: { patch: { text: "您好，{姓名}", variables: ["姓名"] }, value: JSON.stringify({ 姓名: "王芳" }), expect: "您好，王芳" },
  table: { patch: { head: ["品名", "数量"], headWidthPercentages: [70, 30] }, value: JSON.stringify([["龙井茶礼盒", "2"]]), expect: "龙井茶礼盒" },
  image: { value: SAMPLE_LOGO, expect: null },
  svg: { expect: null },
  date: { patch: { format: "yyyy年MM月dd日" }, value: "2026/11/15", expect: "2026年11月15日" },
  time: { patch: { format: "HH:mm" }, value: "09:30", expect: "09:30" },
  dateTime: { patch: { format: "yyyy-MM-dd HH:mm" }, value: "2026/11/15 09:30", expect: "2026-11-15 09:30" },
  select: { patch: { options: ["标准件", "次日达"] }, value: "次日达", expect: "次日达" },
  radioGroup: { value: "true", expect: null },
  checkbox: { value: "true", expect: null },
  line: { expect: null },
  rectangle: { expect: null },
  ellipse: { expect: null },
};

async function xobjects(bytes: Uint8Array): Promise<number> {
  const doc = await PDFDocument.load(bytes);
  const resources = doc.getPage(0).node.Resources();
  const dict = resources?.lookup(PDFName.of("XObject"));
  return dict instanceof PDFDict ? dict.keys().length : 0;
}
async function operators(bytes: Uint8Array): Promise<number> {
  const doc = await PDFDocument.load(bytes);
  const contents = doc.getPage(0).node.Contents();
  return contents ? String(contents).length : 0;
}

for (const type of Object.keys(FIELD_TYPES)) {
  test(`字段类型 ${type}（${FIELD_TYPES[type as keyof typeof FIELD_TYPES]}）生成单页 PDF 并嵌入中文`, async () => {
    const plugin = (plugins as Record<string, { propPanel: { defaultSchema: Record<string, unknown> } }>)[type];
    assert.ok(plugin, `插件 ${type} 已注册`);
    const spec = CASES[type] ?? { expect: null };
    const field = { ...structuredClone(plugin.propPanel.defaultSchema), ...spec.patch, name: "被测字段", position: { x: 20, y: 40 } };
    const marker = { name: "标记", type: "text", content: `字段类型：${type}`, position: { x: 20, y: 15 }, width: 170, height: 10, readOnly: true };
    const project = validatePdf({ template: { basePdf: { width: 210, height: 297, padding: [10, 10, 10, 10] }, schemas: [[marker, field]] }, values: spec.value === undefined ? {} : { 被测字段: spec.value } });
    const bytes = await render(project.template, [pdfInput(project)]);
    const pdf = await readPdf(bytes);
    assert.equal(pdf.pages, 1);
    assert.ok(pdf.text[0].includes(`字段类型：${type}`), `标记文字存在：${pdf.text[0]}`);
    if (spec.expect) assert.ok(pdf.text[0].includes(spec.expect), `${type} 输出 ${spec.expect}，实际：${pdf.text[0]}`);
    if (type === "image" || type in { qrcode: 1, code128: 1, ean13: 1, ean8: 1, code39: 1, itf14: 1, upca: 1, upce: 1, nw7: 1, gs1datamatrix: 1, pdf417: 1, japanpost: 1 })
      assert.ok((await xobjects(bytes)) >= 1, `${type} 嵌入了图像对象`);
    if (type === "svg" || type === "line" || type === "rectangle" || type === "ellipse" || type === "checkbox" || type === "radioGroup")
      assert.ok((await operators(bytes)) > 0);
  });
}

test("报价单示例：标志、明细表、计算合计与收款码在一页内生成", async () => {
  const project = validatePdf(quotationSample);
  const bytes = await render(project.template, [pdfInput(project)]);
  const pdf = await readPdf(bytes);
  assert.equal(pdf.pages, 1);
  for (const expected of ["报价单", "杭州远山茶业有限公司", "品牌视觉升级", "小计 ¥48600.00", "增值税 6% ¥2916.00", "合计 ¥51516.00", "签约后支付 50% 预付款", "第 1/1 页"])
    assert.ok(pdf.text[0].includes(expected), `缺少「${expected}」`);
  assert.ok((await xobjects(bytes)) >= 2, "标志与二维码作为图像嵌入");
});

test("报价单明细增加到需要换页时，页脚在每一页重复并更新页码", async () => {
  const project = validatePdf(quotationSample);
  const rows = Array.from({ length: 40 }, (_, i) => [`服务项目 ${i + 1}`, "按月交付的设计服务", "1", "1000"]);
  const input = { ...pdfInput(project), 报价明细: JSON.stringify(rows) };
  const pdf = await readPdf(await render(project.template, [input]));
  assert.ok(pdf.pages >= 2);
  assert.ok(pdf.text[pdf.pages - 1].includes(`第 ${pdf.pages}/${pdf.pages} 页`));
  assert.ok(pdf.text.join("").includes("合计 ¥42400.00"));
});

function datasetText(project: PdfProject): string {
  const source = project.dataset!.source;
  return Buffer.from(source.slice(source.indexOf(",") + 1), "base64").toString("utf8");
}

test("发货标签：CSV 映射逐行校验，跳过有误的行后合并为多页 PDF 并打包 ZIP", async () => {
  const project = validatePdf(labelSample);
  const table = parseDataset(datasetText(project), "csv");
  assert.equal(table.rows.length, 7);
  const mapping = project.dataset!.mapping;
  const reports = validateRows(project, table, mapping);
  const invalid = reports.filter((report) => report.issues.length);
  assert.deepEqual(invalid.map((report) => report.index), [4]);
  assert.match(invalid[0].issues[0].message, /收件人.*必填/);
  const rows = reports.filter((report) => !report.issues.length).map((report) => rowInput(project, table, mapping, report.index));
  assert.equal(rows[0].运单二维码, "SD7708123456CN", "同一列可以映射到二维码与条码");
  assert.equal(rows[0].易碎, "true");
  assert.equal(rows[0].寄件日期, "2026/11/07");
  const merged = await readPdf(await render(project.template, rows));
  assert.equal(merged.pages, 6);
  assert.ok(merged.text[1].includes("周以宁") && merged.text[1].includes("1/2"));
  assert.ok(merged.text[3].includes("冷链"));
  const files = [];
  for (const [index, input] of rows.slice(0, 3).entries()) files.push({ name: `${input.运单号}.pdf`, data: await render(project.template, [input]) });
  const zip = readZip(createZip(files));
  assert.deepEqual(zip.map((entry) => entry.name), ["SD7708123456CN.pdf", "SD7708123457CN.pdf", "SD7708123458CN.pdf"]);
  assert.equal((await readPdf(zip[2].data)).pages, 1);
});

test("结业证书：导入的 PDF 底图保留在每一页，变量文本从同名列填充", async () => {
  const background = readFileSync(new URL("../src/assets/certificate-background.pdf", import.meta.url));
  const project = validatePdf(certificateSample(`data:application/pdf;base64,${background.toString("base64")}`));
  const table = parseDataset(datasetText(project), "csv");
  const rows = table.rows.map((_, index) => rowInput(project, table, project.dataset!.mapping, index));
  assert.equal(JSON.parse(rows[3].证书正文).课程名称, "包装结构与印前工艺");
  assert.equal(rows[3].颁发日期, "2026/11/07");
  const pdf = await readPdf(await render(project.template as Template, rows));
  assert.equal(pdf.pages, 6);
  for (const [index, row] of table.rows.entries()) {
    assert.ok(pdf.text[index].includes(row[0]), `第 ${index + 1} 页是 ${row[0]}`);
    assert.ok(pdf.text[index].includes("Certificate of Completion"), "底图文字仍在");
    assert.ok(pdf.text[index].includes("2026年11月07日"));
  }
  assert.ok(pdf.text[3].includes("完成「包装结构与印前工艺」全部 32 学时课程"));
});
