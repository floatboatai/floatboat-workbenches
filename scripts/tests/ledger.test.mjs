import assert from "node:assert/strict";
import { test } from "node:test";
import {
  columnName,
  ledgerRows,
  planLedger,
  storeColumns,
} from "../ledger.mjs";
import { repository } from "../ci-workbenches.mjs";

const header = [
  "编号",
  "工作台",
  "标识",
  "开发状态",
  "仓库版本",
  "商店状态",
  "商店版本",
  "最近变更",
  "主要能力",
  "已知限制",
  "测试结论（Sheet1/Sheet2）",
  "测试问题",
  "下一步",
];
const row = (slug, extra = {}) => ({
  registryName: `${slug}-studio`,
  mit: true,
  number: "01",
  name: "示例",
  slug,
  status: "已开发 · 本地验收",
  version: "1.0.0",
  changelog: "首版",
  features: "能力",
  caveat: "",
  ...extra,
});
const line = (r, tester = ["不可用", "打不开", "待排查"]) => [
  r.number,
  r.name,
  r.slug,
  r.status,
  r.version,
  "已上架",
  "1.0.0",
  r.changelog,
  r.features,
  r.caveat,
  ...tester,
];

test("column names cover single and double letters", () => {
  assert.deepEqual([0, 12, 25, 26, 51].map(columnName), [
    "A",
    "M",
    "Z",
    "AA",
    "AZ",
  ]);
});

test("unchanged rows produce no writes", () => {
  const a = row("a");
  assert.deepEqual(
    planLedger([header, line(a)], [a], { sheet: "S" }).writes,
    [],
  );
});

test("only changed repository cells are written; tester and store columns are kept", () => {
  const before = row("a");
  const after = row("a", { version: "1.0.1", changelog: "修复" });
  const plan = planLedger([header, line(before)], [after], { sheet: "S" });
  assert.deepEqual(
    plan.writes.map((w) => w.range),
    ["E2", "H2"],
  );
  assert.deepEqual(
    plan.writes.map((w) => w.cells[0][0].value),
    ["1.0.1", "修复"],
  );
  assert.ok(plan.writes.every((w) => w.sheet_name === "S"));
});

test("columns are found by header, so reordered sheets still sync the right cells", () => {
  const order = [12, 2, 4, 0, 1, 3, 5, 6, 7, 8, 9, 10, 11];
  const shuffled = order.map((i) => header[i]);
  const before = line(row("a"));
  const plan = planLedger(
    [shuffled, order.map((i) => before[i])],
    [row("a", { version: "2.0.0" })],
    { sheet: "S" },
  );
  assert.deepEqual(
    plan.writes.map((w) => w.range),
    ["C2"],
  );
});

test("new workbenches are appended after the last filled row with full-width styling", () => {
  const plan = planLedger(
    [header, line(row("a")), [], []],
    [row("a"), row("b")],
    { sheet: "S" },
  );
  assert.deepEqual(plan.appended, ["b"]);
  assert.equal(plan.writes[0].range, "A3:M3");
  const cells = plan.writes[0].cells[0];
  assert.equal(cells.length, 13);
  assert.equal(cells[2].value, "b");
  assert.equal(cells[10].value, undefined);
  assert.ok(cells.every((cell) => cell.border_styles));
});

test("store columns are written only with a store export", () => {
  const a = row("a");
  const states = new Map([
    ["a-studio", { visibility: "unlisted", version: "1.0.0" }],
  ]);
  assert.deepEqual(
    planLedger([header, line(a)], [a], { sheet: "S" }).writes,
    [],
  );
  const plan = planLedger([header, line(a)], [a], { sheet: "S", states });
  assert.deepEqual(
    plan.writes.map((w) => [w.range, w.cells[0][0].value]),
    [
      ["F2", "已下架"],
      ["G2", ""],
    ],
  );
  assert.deepEqual(storeColumns(row("p", { status: "规划中" }), states), {
    store: "未开发",
    storeVersion: "",
  });
  assert.deepEqual(storeColumns(row("x"), states), {
    store: "未上架",
    storeVersion: "",
  });
  assert.deepEqual(storeColumns(row("g", { mit: false }), states), {
    store: "未上架（非 MIT 许可）",
    storeVersion: "",
  });
});

test("a missing owned header stops the sync", () => {
  assert.throws(
    () => planLedger([header.slice(0, 5)], [row("a")], { sheet: "S" }),
    /最近变更/,
  );
});

test("every catalog entry becomes a ledger row", async () => {
  const rows = await ledgerRows(repository);
  const catalog = (
    await import("../../catalog.json", { with: { type: "json" } })
  ).default;
  assert.equal(rows.length, catalog.length);
  assert.equal(new Set(rows.map((r) => r.slug)).size, rows.length);
  assert.ok(
    rows
      .filter((r) => r.status === "已开发 · 本地验收")
      .every((r) => r.registryName && r.version),
  );
});
