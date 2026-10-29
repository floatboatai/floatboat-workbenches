import assert from "node:assert/strict";
import { test } from "node:test";
import { compile, type TopLevelSpec } from "vega-lite";
import { parse, View } from "vega";
import { expressionInterpreter } from "vega-interpreter";
import { gallery } from "../src/contracts/gallery.ts";
import { sampleDataset } from "../src/contracts/samples.ts";
import { parseDataset } from "../src/contracts/datasets.ts";
import { prepareSpec, referencedDatasets } from "../src/contracts/render-spec.ts";
import { loadSchema } from "../src/server/schema.ts";
import { parseJsonSource, locatePointer, lineColumn } from "../src/contracts/json-source.ts";
import { analyzeSpecText } from "../src/contracts/spec-analysis.ts";
import { insertEncoding, withDataset } from "../src/contracts/spec-edit.ts";
import { exampleModel } from "../src/contracts/model.ts";

const check = loadSchema().checker;

test("示例库：13 个示例全部通过官方 schema，并能编译、运行和导出 SVG", async () => {
  assert.ok(gallery.length >= 12);
  const covered = new Set(gallery.flatMap((item) => item.tags));
  for (const tag of ["layer", "facet", "repeat", "arc", "boxplot", "params", "hconcat", "vconcat", "regression", "window"])
    assert.ok(covered.has(tag), tag);
  for (const example of gallery) {
    assert.deepEqual(check(example.spec), [], example.id);
    const refs = example.datasets.map((name) => sampleDataset(name).ref);
    const rows = new Map(example.datasets.map((name) => [name, parseDataset(sampleDataset(name).text, "csv").rows]));
    const prepared = prepareSpec(example.spec, refs, rows, { width: 640, height: 360 });
    const vega = compile(prepared as unknown as TopLevelSpec).spec;
    const view = new View(parse(vega, undefined, { ast: true }), { expr: expressionInterpreter, renderer: "none" });
    await view.runAsync();
    const svg = await view.toSVG();
    assert.ok(svg.startsWith("<svg") && svg.length > 5000, example.id);
    view.finalize();
  }
});

test("schema 错误被归纳为少量可定位的问题", () => {
  const cases: [unknown, string, RegExp][] = [
    [{ data: { values: [] }, mak: "bar" }, "/mak", /不支持的属性 "mak"。是否想写 "mark"/],
    [{ data: { values: [] }, mark: "barr" }, "/mark", /"barr" 无效。可选：.*"bar"/],
    [{ data: { values: [] }, mark: "bar", encoding: { x: { field: "a", type: "quant" } } }, "/encoding/x/type", /"quantitative"/],
    [
      { vconcat: [{ mark: "bar", encoding: { x: { field: "a", type: "nominal", axis: { labelAngel: 3 } } } }] },
      "/vconcat/0/encoding/x/axis/labelAngel",
      /labelAngle/,
    ],
    [{ mark: { type: "bar", opacity: "x" } }, "/mark/opacity", /类型应为数字/],
  ];
  for (const [spec, pointer, message] of cases) {
    const issues = check(spec);
    assert.equal(issues[0].pointer, pointer, JSON.stringify(issues));
    assert.match(issues[0].message, message);
    assert.ok(issues.length <= 2, JSON.stringify(issues));
  }
  assert.deepEqual(check({ data: { url: "cars.json" }, mark: "trail" }), []);
});

test("带位置的 JSON 解析：语法错误行列与 Pointer 区间", () => {
  const bad = parseJsonSource('{\n  "mark": "bar",\n  "encoding": {,}\n}');
  assert.equal(bad.ok, false);
  if (!bad.ok) {
    assert.deepEqual(lineColumn('{\n  "mark": "bar",\n  "encoding": {,}\n}', bad.from), { line: 3, column: 16 });
    assert.match(bad.message, /属性名/);
  }
  const trailing = parseJsonSource('{"a":1,}');
  assert.equal(trailing.ok, false);
  if (!trailing.ok) assert.match(trailing.message, /多了逗号/);
  const text = '{\n  "encoding": {\n    "x": {"field": "a"}\n  }\n}';
  const ok = parseJsonSource(text);
  assert.ok(ok.ok);
  if (ok.ok) {
    const span = locatePointer(ok.pointers, "/encoding/x/field", true);
    assert.equal(text.slice(span.from, span.to), '"field"');
    const missing = locatePointer(ok.pointers, "/encoding/x/type/zzz");
    assert.equal(text.slice(missing.from, missing.to), '"x"');
  }
});

test("规格分析：schema 错误定位到行，外部 URL 与缺失数据集为警告", () => {
  const datasets = exampleModel("monthly-revenue-stack").datasets;
  const text = '{\n  "data": {"name": "sales"},\n  "mark": "bar",\n  "encoding": {\n    "x": {"field": "month", "type": "temporl"}\n  }\n}';
  const result = analyzeSpecText(text, datasets, check);
  assert.equal(result.spec, null);
  assert.equal(result.problems[0].line, 5);
  assert.equal(result.problems[0].source, "Schema");
  const ok = analyzeSpecText(text.replace("temporl", "temporal"), datasets, check);
  assert.ok(ok.spec);
  assert.equal(ok.problems.length, 0);
  const warn = analyzeSpecText('{"data":{"url":"https://example.com/x.csv"},"mark":"point"}', [], check);
  assert.ok(warn.spec, "外部 URL 只是警告，规格仍可应用");
  assert.equal(warn.problems[0].severity, "warning");
  assert.match(warn.problems[0].message, /不会被加载/);
  const unknown = analyzeSpecText('{"data":{"name":"nope"},"mark":"point"}', datasets, check);
  assert.match(unknown.problems[0].message, /数据集 "nope" 不在当前图表/);
  assert.equal(analyzeSpecText("{", [], check).problems[0].source, "JSON");
  // schema 未加载时不应用。
  assert.equal(analyzeSpecText(text.replace("temporl", "temporal"), datasets, null).spec, null);
});

test("渲染准备：注入数据集、改写同名 url、只为单视图补尺寸，且不修改原规格", () => {
  const model = exampleModel("monthly-revenue-stack");
  const rows = new Map([["sales", [{ month: "2024-01", revenue: 1 }]]]);
  const original = { data: { url: "data/sales.csv", format: { type: "csv" } }, mark: "bar" };
  const prepared = prepareSpec(original, model.datasets, rows, { width: 700, height: 400 });
  assert.deepEqual(prepared.data, { name: "sales" });
  assert.deepEqual((prepared.datasets as Record<string, unknown>).sales, rows.get("sales"));
  assert.equal(prepared.width, 700);
  assert.deepEqual(prepared.autosize, { type: "fit", contains: "padding" });
  assert.deepEqual(original.data, { url: "data/sales.csv", format: { type: "csv" } });
  const concat = prepareSpec({ data: { name: "sales" }, hconcat: [{ mark: "bar" }] }, model.datasets, rows, { width: 700 });
  assert.equal(concat.width, undefined);
  const fixed = prepareSpec({ mark: "bar", width: 1600 }, [], rows, { width: 700 });
  assert.equal(fixed.width, 1600, "不再把宽度夹到 900");
  assert.deepEqual([...referencedDatasets({ layer: [{ data: { name: "a" } }, { data: { name: "b" } }] }, [])], ["a", "b"]);
});

test("字段芯片插入编码：单视图、图层、分面、拼接与 tooltip", () => {
  const unit = insertEncoding({ mark: "bar" }, { name: "city", type: "nominal" }, "x", "weather");
  assert.deepEqual(unit, { mark: "bar", encoding: { x: { field: "city", type: "nominal" } }, data: { name: "weather" } });
  const layered = insertEncoding({ data: { values: [] }, layer: [{ mark: "line" }] }, { name: "t", type: "temporal" }, "x", "w");
  assert.deepEqual((layered.encoding as Record<string, unknown>).x, { field: "t", type: "temporal" });
  assert.deepEqual(layered.data, { values: [] });
  const faceted = insertEncoding({ facet: { row: { field: "a" } }, spec: { mark: "point" } }, { name: "b", type: "nominal" }, "column", null);
  assert.deepEqual((faceted.facet as Record<string, unknown>).column, { field: "b", type: "nominal" });
  const inner = insertEncoding({ facet: { row: { field: "a" } }, spec: { mark: "point" } }, { name: "v", type: "quantitative" }, "y", null);
  assert.deepEqual(((inner.spec as Record<string, unknown>).encoding as Record<string, unknown>).y, { field: "v", type: "quantitative" });
  const concat = insertEncoding({ hconcat: [{ mark: "bar" }, { mark: "line" }] }, { name: "v", type: "quantitative" }, "y", null);
  assert.ok(((concat.hconcat as Record<string, unknown>[])[0].encoding as Record<string, unknown>).y);
  let tip = insertEncoding({ mark: "bar", encoding: { tooltip: { field: "a" } } }, { name: "b", type: "nominal" }, "tooltip", null);
  tip = insertEncoding(tip, { name: "b", type: "nominal" }, "tooltip", null);
  assert.deepEqual((tip.encoding as Record<string, unknown>).tooltip, [{ field: "a" }, { field: "b", type: "nominal" }]);
  assert.deepEqual(withDataset({ data: { values: [1] }, mark: "bar" }, "sales").data, { name: "sales" });
});
