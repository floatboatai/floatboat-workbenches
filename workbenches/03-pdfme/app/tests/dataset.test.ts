// ABOUTME: CSV/JSON 数据解析、列映射、单元格归一化与逐行校验。
import assert from "node:assert/strict";
import { test } from "node:test";
import { autoMap, fileNameFor, normalizeCell, parseCsv, parseJsonRows, rowInput, uniqueNames, validateInput, MAX_ROWS } from "../src/contracts/dataset.ts";
import { validatePdf } from "../src/contracts/domain.ts";
import { labelSample, quotationSample } from "../src/contracts/samples.ts";

test("CSV 支持 BOM、CRLF、引号内换行与逗号、转义引号和空行", () => {
  const table = parseCsv('﻿收件人,收件地址,备注\r\n王雨桐,"杭州市拱墅区\n湖墅南路 186 号","含""易碎""标记, 轻放"\r\n\r\n周以宁,上海市徐汇区,\r\n');
  assert.deepEqual(table.columns, ["收件人", "收件地址", "备注"]);
  assert.deepEqual(table.rows, [
    ["王雨桐", "杭州市拱墅区\n湖墅南路 186 号", '含"易碎"标记, 轻放'],
    ["周以宁", "上海市徐汇区", ""],
  ]);
});

test("CSV 自动识别分号与制表符分隔，补齐缺列并提示多余列，空表头和重复表头会命名", () => {
  assert.deepEqual(parseCsv("姓名;城市\n林晓雯;杭州").rows, [["林晓雯", "杭州"]]);
  assert.deepEqual(parseCsv("姓名\t城市\n林晓雯\t杭州\n许嘉禾").rows, [["林晓雯", "杭州"], ["许嘉禾", ""]]);
  const extra = parseCsv("姓名,城市\n林晓雯,杭州,多余");
  assert.equal(extra.warnings.length, 1);
  assert.deepEqual(parseCsv("姓名,,姓名\n1,2,3").columns, ["姓名", "列2", "姓名_2"]);
  assert.throws(() => parseCsv('姓名\n"未闭合'), /引号/);
  assert.throws(() => parseCsv(""), /没有内容/);
  assert.throws(() => parseCsv("a\n" + "1\n".repeat(MAX_ROWS + 1)), /拆分/);
});

test("JSON 行支持对象数组与 rows 包装，嵌套值转为 JSON 文本", () => {
  const table = parseJsonRows(JSON.stringify({ rows: [{ 姓名: "林晓雯", 学时: 48, 明细: [["a", "1"]] }, { 姓名: "许嘉禾", 合格: true, 备注: null }] }));
  assert.deepEqual(table.columns, ["姓名", "学时", "明细", "合格", "备注"]);
  assert.deepEqual(table.rows[0], ["林晓雯", "48", '[["a","1"]]', "", ""]);
  assert.deepEqual(table.rows[1], ["许嘉禾", "", "", "true", ""]);
  assert.throws(() => parseJsonRows("{"), /解析失败/);
  assert.throws(() => parseJsonRows('[1,2]'), /对象/);
});

test("自动映射按规范化名称匹配，保留仍然存在的手动映射", () => {
  const project = validatePdf(quotationSample);
  const mapping = autoMap(project.template, ["客户 名称", "报价编号", "联系人"], { 客户联系人: "联系人" });
  assert.equal(mapping.客户名称, "客户 名称");
  assert.equal(mapping.报价编号, "报价编号");
  assert.equal(mapping.客户联系人, "联系人");
  assert.equal(mapping.客户地址, "");
  assert.equal("公司名称" in mapping, false, "只读文字不参与映射");
  assert.equal("签章框" in mapping, false, "图形不参与映射");
});

test("单元格按字段类型归一化：日期、时间、勾选", () => {
  assert.equal(normalizeCell("date", "2026-11-5"), "2026/11/05");
  assert.equal(normalizeCell("date", "2026年11月15日"), "2026/11/15");
  assert.equal(normalizeCell("dateTime", "2026-11-15 9:30"), "2026/11/15 09:30");
  assert.equal(normalizeCell("dateTime", "2026-11-15T09:30:00"), "2026/11/15 09:30");
  assert.equal(normalizeCell("time", "9:05"), "09:05");
  assert.equal(normalizeCell("checkbox", "是"), "true");
  assert.equal(normalizeCell("checkbox", "否"), "false");
  assert.equal(normalizeCell("checkbox", "也许"), "也许");
  assert.equal(normalizeCell("text", " 原样 "), " 原样 ");
});

test("逐行校验给出可读的字段错误", () => {
  const project = validatePdf(labelSample);
  const base = rowInput(project, { columns: [], rows: [], warnings: [] }, {}, 0);
  assert.deepEqual(validateInput(project.template, base), []);
  const issues = validateInput(project.template, { ...base, 收件人: " ", 运单号: "顺达123", 服务类型: "加急", 寄件日期: "下周一", 易碎: "也许" });
  const messages = issues.map((issue) => issue.message).join("\n");
  assert.match(messages, /收件人.*必填/);
  assert.match(messages, /Code 128/);
  assert.match(messages, /标准件、次日达、冷链/);
  assert.match(messages, /寄件日期.*日期/);
  assert.match(messages, /易碎.*是\/否/);
  const quote = validatePdf(quotationSample);
  const table = validateInput(quote.template, { ...rowInput(quote, { columns: [], rows: [], warnings: [] }, {}, 0), 报价明细: "[[\"只有一列\"]]" });
  assert.match(table[0].message, /每行 4 列/);
});

test("ZIP 文件名来自所选列，过滤非法字符并去重", () => {
  const table = { columns: ["运单号"], rows: [["SD/01"], [""], ["SD/01"]], warnings: [] };
  const names = uniqueNames(table.rows.map((_, index) => fileNameFor(table, "运单号", index, "发货标签")));
  assert.deepEqual(names, ["SD_01.pdf", "发货标签-002.pdf", "SD_01-2.pdf"]);
});
