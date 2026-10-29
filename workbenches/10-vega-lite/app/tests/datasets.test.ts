import assert from "node:assert/strict";
import { test } from "node:test";
import {
  datasetName,
  decodeDatasetRef,
  formatOf,
  parseDataset,
  parseDelimited,
  MAX_DATASET_ROWS,
} from "../src/contracts/datasets.ts";
import { sampleDataset } from "../src/contracts/samples.ts";

test("CSV 解析：引号、转义引号、引号内换行、CRLF、BOM 与空行", () => {
  const text = '﻿名称,备注,数量\r\n"上海, 浦东","他说""好""",12\r\n"多行\n备注",,3\r\n\r\n';
  assert.deepEqual(parseDelimited(text, ","), [
    ["名称", "备注", "数量"],
    ["上海, 浦东", '他说"好"', "12"],
    ["多行\n备注", "", "3"],
  ]);
  assert.deepEqual(parseDelimited("a\tb\n1\t2", "\t"), [
    ["a", "b"],
    ["1", "2"],
  ]);
  assert.deepEqual(parseDelimited("a,b\n1,", ","), [
    ["a", "b"],
    ["1", ""],
  ]);
  assert.throws(() => parseDelimited('a\n"open', ","), /未闭合/);
});

test("字段类型推断与数值转换", () => {
  const table = parseDataset(
    "日期,城市,温度,编号,标记\n2024-01-01,北京,-3.5,001,true\n2024/01/02,上海,1e1,002,false\n2024-01-03T08:00:00Z,广州,,003,\n",
    "csv",
  );
  assert.deepEqual(
    table.columns.map((c) => [c.name, c.type]),
    [
      ["日期", "temporal"],
      ["城市", "nominal"],
      ["温度", "quantitative"],
      ["编号", "quantitative"],
      ["标记", "nominal"],
    ],
  );
  assert.equal(table.rows[0].温度, -3.5);
  assert.equal(table.rows[1].温度, 10);
  assert.equal(table.rows[2].温度, null);
  assert.equal(table.rows[0].日期, "2024-01-01");
  // 重复与空表头会被改名。
  assert.deepEqual(
    parseDataset("a,a,\n1,2,3", "csv").columns.map((c) => c.name),
    ["a", "a_2", "列3"],
  );
});

test("JSON 数据：对象数组、单数组包装与错误提示", () => {
  const table = parseDataset('{"data":[{"x":1,"y":"2"},{"x":2,"z":"2024-05-01"}]}', "json");
  assert.deepEqual(
    table.columns.map((c) => `${c.name}:${c.type}`),
    ["x:quantitative", "y:quantitative", "z:temporal"],
  );
  assert.equal(table.rows[0].y, 2);
  assert.throws(() => parseDataset('{"a":1}', "json"), /对象数组/);
  assert.throws(() => parseDataset("[1,2]", "json"), /每一项/);
  assert.throws(() => parseDataset("[{", "json"), /无法解析/);
  assert.throws(() => parseDataset('[{"__proto__":1}]', "json"), /字段名无效/);
});

test("数据集命名、格式识别与引用校验", () => {
  assert.equal(datasetName("2024 销售 明细.csv"), "2024_销售_明细");
  assert.equal(datasetName("sales.csv", ["sales"]), "sales_2");
  assert.equal(datasetName("../.csv"), "data");
  assert.equal(formatOf("a.TSV"), "tsv");
  assert.equal(formatOf("a.txt"), "csv");
  assert.equal(formatOf("a.xlsx"), null);
  const ref = sampleDataset("weather").ref;
  assert.deepEqual(decodeDatasetRef(ref), ref);
  assert.throws(() => decodeDatasetRef({ ...ref, id: "../etc" }));
  assert.throws(() => decodeDatasetRef({ ...ref, name: "a b" }));
  assert.throws(() => decodeDatasetRef({ ...ref, rows: MAX_DATASET_ROWS + 1 }));
});

test("示例数据确定且真实感合理", () => {
  const weather = sampleDataset("weather");
  assert.equal(weather.ref.rows, 366 * 3);
  const rows = parseDataset(weather.text, "csv").rows;
  const beijingJuly = rows.filter((r) => r.city === "北京" && String(r.date).startsWith("2024-07"));
  const beijingJan = rows.filter((r) => r.city === "北京" && String(r.date).startsWith("2024-01"));
  const mean = (list: Record<string, unknown>[]) => list.reduce((s, r) => s + Number(r.temp_max), 0) / list.length;
  assert.ok(mean(beijingJuly) > 26 && mean(beijingJuly) < 36);
  assert.ok(mean(beijingJan) < 8);
  assert.equal(sampleDataset("sales").ref.rows, 600);
  assert.equal(sampleDataset("stores").ref.rows, 160);
  assert.equal(sampleDataset("weather").text, weather.text);
});
