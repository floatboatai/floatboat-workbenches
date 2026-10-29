import assert from "node:assert/strict";
import { test } from "node:test";
import { DatabaseSync } from "node:sqlite";
import {
  checkConnection,
  cycleMembers,
  nodeSignatures,
  outputType,
  runPipeline,
  toRunRecord,
  topoOrder,
} from "../src/contracts/engine.ts";
import {
  restoreFlowDraft,
  signature,
  validateFlow,
  validateGeneratedFlow,
  type FlowDocument,
  type PipelineEdge,
  type PipelineNode,
} from "../src/contracts/flow.ts";
import { defaultConfig, opKinds, type OpKind } from "../src/contracts/ops.ts";
import { seed, templates } from "../src/contracts/templates.ts";
import { createStore, StoreError } from "../src/server/store.ts";

const node = (id: string, op: OpKind, config: Record<string, unknown> = {}, x = 0): PipelineNode => ({
  id,
  type: "op",
  position: { x, y: 0 },
  data: { op, label: id, config: { ...defaultConfig(op), ...config } },
});
const edge = (source: string, target: string, sourceHandle = "out", targetHandle = "in"): PipelineEdge => ({
  id: `${source}-${sourceHandle}-${target}-${targetHandle}`,
  source,
  sourceHandle,
  target,
  targetHandle,
});
const doc = (nodes: PipelineNode[], edges: PipelineEdge[]): FlowDocument => ({ version: 2, nodes, edges });

test("所有模板都通过校验，且每个节点运行成功", () => {
  assert.ok(templates.length >= 4);
  for (const template of templates) {
    const flow = validateFlow(structuredClone(template.doc));
    const report = runPipeline(flow);
    for (const [id, result] of Object.entries(report.results))
      assert.equal(result.status, "ok", `${template.title} / ${id}: ${result.error}`);
  }
});

test("种子：清洗、去重、按地区汇总得到确定结果", () => {
  const report = runPipeline(seed);
  const summary = report.results.summary.view;
  assert.equal(summary?.type, "table");
  if (summary?.type !== "table") return;
  assert.deepEqual(summary.columns, ["地区", "订单数", "销售额", "客单价"]);
  const east = summary.rows.find((row) => row.地区 === "华东");
  assert.deepEqual(east, { 地区: "华东", 订单数: 5, 销售额: 16084, 客单价: 3216.8 });
  assert.equal(report.results.rejected.summary, "3 行 × 8 列");
  const chart = report.results.chart.view;
  assert.equal(chart?.type === "table" && chart.rows[0].label, "华东");
});

test("拓扑顺序：分支与合并按依赖执行，同层按画布位置", () => {
  const flow = doc(
    [node("c", "concat", {}, 400), node("a", "textInput", { text: "x" }, 0), node("b", "textInput", { text: "y" }, 10), node("o", "textOutput", {}, 600)],
    [edge("a", "c", "out", "a"), edge("b", "c", "out", "b"), edge("c", "o")],
  );
  assert.deepEqual(topoOrder(flow).order, ["a", "b", "c", "o"]);
  const report = runPipeline(flow);
  assert.equal(report.results.o.view?.type === "text" && report.results.o.view.text, "x\ny");
});

test("环：检测环上节点，下游跳过，其它分支照常运行", () => {
  const flow = doc(
    [
      node("t", "textInput", { text: "a" }),
      node("u", "textTransform", { mode: "upper" }),
      node("v", "textTransform", { mode: "lower" }),
      node("w", "textOutput"),
      node("ok", "textOutput"),
    ],
    [edge("u", "v"), edge("v", "u"), edge("v", "w"), edge("t", "ok")],
  );
  assert.deepEqual([...cycleMembers(flow)].sort(), ["u", "v"]);
  const report = runPipeline(flow);
  assert.equal(report.results.u.status, "error");
  assert.match(report.results.u.error ?? "", /环/);
  assert.equal(report.results.w.status, "skipped");
  assert.equal(report.results.ok.status, "ok");
  assert.equal(nodeSignatures(flow).u, "cycle");
});

test("连接校验：类型不符、形成环、自连被拒绝", () => {
  const flow = doc(
    [node("t", "textInput"), node("c", "csvInput"), node("s", "sort"), node("u", "textTransform"), node("x", "textTransform")],
    [edge("t", "u"), edge("u", "x")],
  );
  assert.equal(checkConnection(flow, { source: "c", sourceHandle: "out", target: "s", targetHandle: "in" }).ok, true);
  assert.match(checkConnection(flow, { source: "t", sourceHandle: "out", target: "s", targetHandle: "in" }).reason ?? "", /类型不匹配/);
  assert.match(checkConnection(flow, { source: "x", sourceHandle: "out", target: "u", targetHandle: "in" }).reason ?? "", /环/);
  assert.equal(checkConnection(flow, { source: "u", target: "u" }).ok, false);
  assert.equal(checkConnection(flow, { source: "t", sourceHandle: "nope", target: "x", targetHandle: "in" }).ok, false);
});

test("类型推断：same 跟随输入，jsonPick 跟随配置", () => {
  const flow = doc(
    [node("c", "csvInput"), node("r", "regexReplace"), node("j", "jsonInput"), node("p", "jsonPick", { as: "json" })],
    [edge("c", "r"), edge("j", "p")],
  );
  assert.equal(outputType(flow, "r", "out"), "table");
  assert.equal(outputType(flow, "p", "out"), "json");
  flow.nodes[3].data.config.as = "table";
  assert.equal(outputType(flow, "p", "out"), "table");
  assert.equal(outputType(doc([node("r", "regexReplace")], []), "r", "out"), null);
});

test("运行时类型错误、缺失端口与上游失败分别钉在对应节点", () => {
  const flow = doc(
    [node("j", "jsonInput", { json: "{bad" }), node("p", "jsonPick"), node("s", "sort"), node("o", "tableOutput")],
    [edge("j", "p"), edge("s", "o")],
  );
  const report = runPipeline(flow);
  assert.match(report.results.j.error ?? "", /JSON 解析失败/);
  assert.equal(report.results.p.status, "skipped");
  assert.match(report.results.s.error ?? "", /没有连接/);
  assert.equal(report.results.o.status, "skipped");
});

const run1 = (op: OpKind, config: Record<string, unknown>, source: PipelineNode, extra?: { node: PipelineNode; port: string }) => {
  const nodes = [source, node("x", op, config), ...(extra ? [extra.node] : [])];
  const edges = [edge(source.id, "x", "out", op === "join" ? "left" : op === "concat" ? "a" : "in")];
  if (extra) edges.push(edge(extra.node.id, "x", "out", extra.port));
  const result = runPipeline(doc(nodes, edges)).results.x;
  assert.equal(result.status, "ok", result.error);
  return result.outputs;
};
const csv = (text: string) => node("src", "csvInput", { csv: text });
const rows = (value: unknown) => (value as { rows: Record<string, unknown>[] }).rows;

test("CSV：引号、引号内换行、分号分隔、数字识别保留前导零", () => {
  const out = run1("dedupe", {}, csv('编号;名称;数量\n007;"A;""甲""\n二行";3\n'));
  assert.deepEqual(rows(out.out), [{ 编号: "007", 名称: 'A;"甲"\n二行', 数量: 3 }]);
});

test("文本处理、按行拆分、正则提取与替换", () => {
  const t = node("src", "textInput", { text: " a1 \n\nb22\n" });
  assert.equal((run1("textTransform", { mode: "upper" }, t).out as { text: string }).text, " A1 \n\nB22\n");
  assert.deepEqual(rows(run1("splitLines", { column: "v", addIndex: true }, t).out), [
    { 行号: 1, v: "a1" },
    { 行号: 3, v: "b22" },
  ]);
  assert.deepEqual(rows(run1("regexExtract", { pattern: "(?<字母>[a-z])(?<数>\\d+)", flags: "" }, t).out), [
    { 字母: "a", 数: 1 },
    { 字母: "b", 数: 22 },
  ]);
  assert.equal((run1("regexReplace", { pattern: "\\d", replacement: "#" }, t).out as { text: string }).text, " a# \n\nb##\n");
  const table = csv("code,msg\nx,E12 boom\ny,ok\n");
  assert.deepEqual(rows(run1("regexExtract", { pattern: "E(\\d+)", column: "msg", keepUnmatched: true }, table).out), [
    { code: "x", msg: "E12 boom", 组1: 12 },
    { 组1: null, code: "y", msg: "ok" },
  ]);
});

test("不安全或无效正则在运行前被拒绝", () => {
  for (const pattern of ["(a+)+$", "(\\w*)*", "((ab)+c)+", "(x{2,})+"]) {
    const result = runPipeline(doc([node("t", "textInput", { text: "aaaa" }), node("r", "regexExtract", { pattern })], [edge("t", "r")]));
    assert.match(result.results.r.error ?? "", /嵌套/, pattern);
  }
  const invalid = runPipeline(doc([node("t", "textInput"), node("r", "regexExtract", { pattern: "(" })], [edge("t", "r")]));
  assert.match(invalid.results.r.error ?? "", /正则无效/);
  const flags = runPipeline(doc([node("t", "textInput"), node("r", "regexExtract", { pattern: "a", flags: "gy" })], [edge("t", "r")]));
  assert.match(flags.results.r.error ?? "", /标志/);
});

const people = csv("name,city,age,score\n张三,上海,31,88\n李四,北京,25,92\n王五,上海,40,75\n赵六,广州,25,\n");

test("筛选：条件构建器的全部/任一，符合与其余分两路输出", () => {
  const out = run1("filter", { mode: "all", conditions: [{ column: "city", op: "eq", value: "上海" }, { column: "age", op: "gte", value: "35" }] }, people);
  assert.deepEqual(rows(out.out).map((r) => r.name), ["王五"]);
  assert.equal(rows(out.rest).length, 3);
  const any = run1("filter", { mode: "any", conditions: [{ column: "score", op: "empty", value: "" }, { column: "name", op: "matches", value: "^李" }] }, people);
  assert.deepEqual(rows(any.out).map((r) => r.name), ["李四", "赵六"]);
});

test("字段映射、排序、去重、分组汇总", () => {
  const mapped = run1("mapFields", { keepOthers: false, fields: [{ from: "name", to: "姓名", cast: "keep" }, { from: "{{city}}-{{age}}", to: "标签", cast: "text" }, { from: "age", to: "年龄", cast: "text" }] }, people);
  assert.deepEqual(rows(mapped.out)[0], { 姓名: "张三", 标签: "上海-31", 年龄: "31" });
  const sorted = run1("sort", { keys: [{ column: "age", direction: "asc" }, { column: "score", direction: "desc" }] }, people);
  assert.deepEqual(rows(sorted.out).map((r) => r.name), ["李四", "赵六", "张三", "王五"]);
  const unique = run1("dedupe", { columns: ["age"], keep: "last" }, people);
  assert.deepEqual(rows(unique.out).map((r) => r.name), ["张三", "赵六", "王五"]);
  const grouped = run1("group", { by: ["city"], aggregations: [{ op: "count", column: "", as: "人数" }, { op: "sum", column: "score", as: "总分" }, { op: "avg", column: "age", as: "平均年龄" }, { op: "max", column: "score", as: "最高" }] }, people);
  assert.deepEqual(rows(grouped.out), [
    { city: "上海", 人数: 2, 总分: 163, 平均年龄: 35.5, 最高: 88 },
    { city: "北京", 人数: 1, 总分: 92, 平均年龄: 25, 最高: 92 },
    { city: "广州", 人数: 1, 总分: null, 平均年龄: 25, 最高: null },
  ]);
});

test("关联两表与合并追加", () => {
  const cities = { node: node("cities", "csvInput", { csv: "city,region\n上海,华东\n北京,华北\n" }), port: "right" };
  const inner = run1("join", { leftKey: "city" }, people, cities);
  assert.deepEqual(rows(inner.out).map((r) => `${r.name}:${r.region}`), ["张三:华东", "李四:华北", "王五:华东"]);
  const left = run1("join", { leftKey: "city", kind: "left" }, people, cities);
  assert.equal(rows(left.out).length, 4);
  assert.equal(rows(left.out)[3].region, null);
  const more = { node: node("more", "csvInput", { csv: "name,team\n钱七,A\n" }), port: "b" };
  const merged = run1("concat", { sourceColumn: "来源", labelA: "旧", labelB: "新" }, people, more) as Record<string, { columns: string[]; rows: unknown[] }>;
  assert.deepEqual(merged.out.columns, ["来源", "name", "city", "age", "score", "team"]);
  assert.equal(merged.out.rows.length, 5);
});

test("模板填充与 JSON 路径取值", () => {
  const filled = run1("template", { template: "{{#}}.{{name}}@{{city}}{{missing}}", separator: "\\n" }, people);
  assert.equal((filled.out as { text: string }).text.split("\n")[1], "2.李四@北京");
  const json = node("src", "jsonInput", { json: JSON.stringify({ data: { items: [{ id: 1, tags: ["a"] }, { id: 2 }] } }) });
  assert.deepEqual(rows(run1("jsonPick", { path: "$.data.items", as: "table" }, json).out), [
    { id: 1, tags: '["a"]' },
    { id: 2 },
  ]);
  assert.deepEqual((run1("jsonPick", { path: "data.items[*].id", as: "json" }, json).out as { value: unknown }).value, [1, 2]);
  assert.deepEqual((run1("jsonPick", { path: "$.data.items[-1]", as: "json" }, json).out as { value: unknown }).value, { id: 2 });
  const missing = runPipeline(doc([json, node("p", "jsonPick", { path: "$.nope" })], [edge("src", "p")]));
  assert.match(missing.results.p.error ?? "", /没有匹配/);
});

test("输出节点：柱状图排序截断，CSV 下载需要表格", () => {
  const flow = doc(
    [people, node("c", "chartOutput", { label: "name", value: "score", limit: 2 }), node("t", "textInput"), node("f", "fileOutput", { format: "csv" })],
    [edge("src", "c"), edge("t", "f")],
  );
  const report = runPipeline(flow);
  const chart = report.results.c.view as { rows: { label: string; value: number }[] };
  assert.deepEqual(chart.rows, [{ label: "李四", value: 92 }, { label: "张三", value: 88 }]);
  assert.match(report.results.f.error ?? "", /CSV/);
});

test("节点签名只让改动节点及下游过期；运行记录可保存", () => {
  const before = nodeSignatures(seed);
  const changed = structuredClone(seed);
  changed.nodes.find((n) => n.id === "unique")!.data.config.keep = "last";
  const after = nodeSignatures(changed);
  assert.equal(after.orders, before.orders);
  assert.equal(after.rejected, before.rejected);
  assert.notEqual(after.unique, before.unique);
  assert.notEqual(after.chart, before.chart);
  const moved = structuredClone(seed);
  moved.nodes[0].position.x += 50;
  assert.equal(signature(moved), signature(seed));
  const record = toRunRecord(runPipeline(seed));
  const restored = validateFlow({ ...seed, lastRun: record });
  assert.equal(restored.lastRun?.nodes.summary.status, "ok");
  assert.equal(restored.lastRun?.nodes.summary.preview?.type, "table");
});

test("文档校验：未知节点类型、端口、重复输入与超长配置被拒绝；草稿允许空名称", () => {
  const base = structuredClone(seed);
  assert.throws(() => validateFlow({ ...base, nodes: [{ ...base.nodes[0], data: { ...base.nodes[0].data, op: "eval" } }] }));
  assert.throws(() => validateFlow({ ...base, edges: [{ ...base.edges[0], sourceHandle: "nope" }] }));
  assert.throws(() => validateFlow({ ...base, edges: [...base.edges, { ...base.edges[0], id: "dup" }] }), /只能连接一条/);
  assert.throws(() => validateFlow({ ...base, nodes: [{ ...base.nodes[0], data: { ...base.nodes[0].data, config: { csv: "x".repeat(700_000) } } }, ...base.nodes.slice(1)] }));
  const draft = structuredClone(seed);
  draft.nodes[0].data.label = "";
  assert.throws(() => validateFlow(draft));
  assert.equal(restoreFlowDraft(draft).nodes[0].data.label, "");
  assert.equal(opKinds.length, 20);
});

test("旧版 0.3 单链文件自动转换并可运行", () => {
  const legacy = {
    nodes: [
      { id: "input", type: "step", position: { x: 0, y: 0 }, data: { label: "输入", operation: "input", value: "hello" } },
      { id: "upper", type: "step", position: { x: 200, y: 0 }, data: { label: "大写", operation: "uppercase", value: "" } },
      { id: "prefix", type: "step", position: { x: 400, y: 0 }, data: { label: "前缀", operation: "prefix", value: "结果：" } },
      { id: "output", type: "step", position: { x: 600, y: 0 }, data: { label: "输出", operation: "output", value: "" } },
    ],
    edges: [
      { id: "e1", source: "input", target: "upper" },
      { id: "e2", source: "upper", target: "prefix" },
      { id: "e3", source: "prefix", target: "output" },
    ],
    lastRun: { at: "2026-01-01", signature: "", output: "x", steps: [] },
  };
  const flow = validateFlow(legacy);
  assert.equal(flow.nodes[1].data.op, "textTransform");
  assert.equal(flow.lastRun, undefined);
  const out = runPipeline(flow).results.output.view;
  assert.equal(out?.type === "text" && out.text, "结果：HELLO");
});

test("AI 生成稿剔除运行记录；项目保存与版本冲突", () => {
  const withRun = { ...seed, lastRun: toRunRecord(runPipeline(seed)) };
  assert.equal(validateGeneratedFlow(withRun).lastRun, undefined);
  const db = new DatabaseSync(":memory:");
  try {
    db.exec("CREATE TABLE projects(id TEXT PRIMARY KEY,title TEXT,payload TEXT,revision INTEGER,updated_at TEXT)");
    const store = createStore(db, validateFlow);
    const saved = store.create("订单", withRun);
    assert.equal(store.get(saved.id).data.lastRun?.nodes.chart.status, "ok");
    store.update(saved.id, "新版本", saved.data, 1);
    assert.throws(() => store.update(saved.id, "覆盖", saved.data, 1), (e) => e instanceof StoreError && e.status === 409);
  } finally {
    db.close();
  }
});
