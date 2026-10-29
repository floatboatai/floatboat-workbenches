import assert from "node:assert/strict";
import { test } from "node:test";
import { importDocument, pdfInput, renameField, restorePdfDraft, validatePdf, withPdfBase, withBlankBase, mapBlobs } from "../src/contracts/domain.ts";
import { quotationSample, labelSample } from "../src/contracts/samples.ts";
import { ASSET_PREFIX } from "../src/contracts/assets.ts";

const seed = quotationSample;

test("导出输入包含所有可编辑字段，使用默认内容并保留明确填写的空字符串", () => {
  const doc = structuredClone(seed);
  doc.template.schemas[0].push({ name: "新增字段", type: "text", content: "新增字段内容", position: { x: 10, y: 10 }, width: 30, height: 10 });
  doc.values.客户名称 = "";
  const input = pdfInput(doc);
  assert.equal(input.新增字段, "新增字段内容");
  assert.equal(input.客户名称, "");
  assert.equal(input.报价日期, "2026/11/07");
  assert.ok(input.报价明细.startsWith("[["));
  assert.equal("公司名称" in input, false, "只读文字不是输入");
  assert.equal("签章框" in input, false, "图形不是输入");
});

test("全部 pdfme 字段类型可保存；字体统一为内置中文字体（含表格与日期的嵌套样式）", () => {
  const doc = structuredClone(seed);
  const table = doc.template.schemas[0].find((field) => field.name === "报价明细")!;
  (table.headStyles as Record<string, unknown>).fontName = "Roboto";
  doc.template.schemas[0].push({ name: "远程字体", type: "text", content: "x", position: { x: 10, y: 10 }, width: 30, height: 10, fontName: "Remote" });
  const result = validatePdf(doc);
  const fields = result.template.schemas[0];
  assert.equal((fields.find((field) => field.name === "报价明细")!.headStyles as Record<string, unknown>).fontName, "NotoSansSC");
  assert.equal(fields.find((field) => field.name === "远程字体")!.fontName, "NotoSansSC");
  assert.equal((table.headStyles as Record<string, unknown>).fontName, "Roboto", "不修改调用方对象");
});

test("拒绝重复字段、保留名称、未知类型、外部 URL 底图、过大内联图片和非有限尺寸", () => {
  const reserved = structuredClone(seed);
  reserved.template.schemas[0][1].name = "constructor";
  assert.throws(() => validatePdf(reserved), /保留/);
  const duplicate = structuredClone(seed);
  duplicate.template.schemas[0].push(structuredClone(duplicate.template.schemas[0][1]));
  assert.throws(() => validatePdf(duplicate), /重复/);
  const unknown = structuredClone(seed);
  unknown.template.schemas[0][1].type = "signature";
  assert.throws(() => validatePdf(unknown), /不受支持/);
  assert.throws(() => validatePdf({ ...seed, template: { ...seed.template, basePdf: "https://external.test/file.pdf" } }), /底图/);
  const big = structuredClone(seed);
  big.template.schemas[0][0].content = "data:image/png;base64," + "A".repeat(99_000);
  assert.throws(() => validatePdf(big), /PNG\/JPEG/);
  const invalid = structuredClone(seed);
  invalid.template.schemas[0][1].position.x = Infinity;
  assert.throws(() => validatePdf(invalid), /位置/);
});

test("草稿恢复保留未完成字段名和越界位置，但不放宽类型与保留名称", () => {
  const draft = structuredClone(seed);
  draft.template.schemas[0][1].name = "";
  draft.template.schemas[0][1].position.x = -300;
  assert.equal(restorePdfDraft(draft).template.schemas[0][1].name, "");
  assert.throws(() => validatePdf(draft));
  draft.template.schemas[0][1].name = "__proto__";
  assert.throws(() => restorePdfDraft(draft));
});

test("字段改名同步填写值与数据映射，并拒绝重名、花括号和保留名", () => {
  const project = validatePdf(labelSample);
  project.values.收件人 = "王雨桐";
  const renamed = renameField(project, "收件人", "收件人姓名");
  assert.equal(renamed.values.收件人姓名, "王雨桐");
  assert.equal("收件人" in renamed.values, false);
  assert.equal(renamed.dataset?.mapping.收件人姓名, "收件人");
  assert.ok(renamed.template.schemas[0].some((field) => field.name === "收件人姓名"));
  assert.throws(() => renameField(project, "收件人", "寄件人"), /已有/);
  assert.throws(() => renameField(project, "收件人", "{x}"), /花括号/);
  assert.throws(() => renameField(project, "收件人", "constructor"), /保留/);
  assert.throws(() => renameField(project, "不存在", "新名"), /不存在/);
});

test("更换 PDF 底图对齐页数并报告被移除的字段；空白纸张可恢复", () => {
  const ref = ASSET_PREFIX + "a".repeat(64);
  const two = structuredClone(seed);
  two.template.schemas.push([{ name: "第二页", type: "text", content: "二", position: { x: 10, y: 10 }, width: 30, height: 10 }]);
  const { project, dropped } = withPdfBase(validatePdf(two), ref, 1);
  assert.equal(dropped, 1);
  assert.equal(project.template.schemas.length, 1);
  assert.equal(project.template.basePdf, ref);
  assert.throws(() => withPdfBase(validatePdf(two), ref, 101), /最多 100 页/);
  const blank = withBlankBase(project, 148, 210);
  assert.deepEqual(blank.template.basePdf, { width: 148, height: 210, padding: [10, 10, 10, 10] });
});

test("导入识别本应用导出、0.3 项目 JSON、pdfme 模板及旧版键值字段", () => {
  assert.equal(importDocument({ kind: "floatboat-pdfme", title: "报价单 2026", data: seed }, "x").title, "报价单 2026");
  assert.equal(importDocument({ template: seed.template, values: {} }, "旧项目").title, "旧项目");
  const native = importDocument({ basePdf: { width: 210, height: 297, padding: [0, 0, 0, 0] }, schemas: [{ 姓名: { type: "text", position: { x: 1, y: 1 }, width: 20, height: 8 } }] }, "pdfme");
  const project = validatePdf(native.data);
  assert.equal(project.template.schemas[0][0].name, "姓名");
  assert.throws(() => importDocument({ hello: 1 }, "x"), /无法识别/);
});

test("二进制槽位遍历覆盖底图、图片内容与填写值、数据源", async () => {
  const project = validatePdf(labelSample);
  project.template.basePdf = "data:application/pdf;base64,JVBERi0=";
  project.template.schemas[0].push({ name: "照片", type: "image", content: "data:image/png;base64,iVBORw0KGgo=", position: { x: 1, y: 1 }, width: 10, height: 10 });
  project.values.照片 = "data:image/jpeg;base64,/9j/4A==";
  const seen: string[] = [];
  const next = await mapBlobs(project, async (value, kind) => {
    seen.push(kind);
    return `${kind}:${value.length}`;
  });
  assert.deepEqual(seen.sort(), ["dataset", "image", "image", "pdf"]);
  assert.equal(next.values.照片, "image:31");
  assert.equal(project.values.照片, "data:image/jpeg;base64,/9j/4A==", "原对象不变");
});
