import assert from "node:assert/strict";
import { test } from "node:test";
import { readDesignerDrafts, applyDesignerDrafts, designerDraftApplied } from "../src/contracts/designer-draft.ts";
import { seed } from "../src/contracts/samples.ts";

const x = () => seed.template.schemas[0].find((field) => field.name === "客户名称")?.position.x;

test("设计器未应用属性保留原字符串，修正后才变更模板", () => {
  const raw = { field: "客户名称", property: "position_x", value: "-100" };
  const draft = readDesignerDrafts([raw]);
  assert.equal(draft.length, 1);
  assert.throws(() => applyDesignerDrafts(seed, draft));
  assert.equal(x(), 18);
  const applied = applyDesignerDrafts(seed, [{ ...draft[0], value: "24" }]);
  assert.equal(applied.template.schemas[0].find((field) => field.name === "客户名称")?.position.x, 24);
  assert.equal(designerDraftApplied(applied.template, { ...draft[0], value: "24" }), true);
  assert.throws(() => applyDesignerDrafts(seed, [{ ...draft[0], value: "" }]));
  assert.throws(() => applyDesignerDrafts(seed, [{ ...draft[0], field: "missing", value: "28" }]));
  assert.throws(() => applyDesignerDrafts(seed, [{ ...draft[0], property: "name", value: "__proto__" }]));
  assert.deepEqual(readDesignerDrafts([{ ...raw, property: "__proto__" }, { ...raw, value: {} }]), []);
});

test("设计器改名草稿应用后同步填写值", () => {
  const project = structuredClone(seed);
  project.values.客户名称 = "杭州远山茶业有限公司";
  const applied = applyDesignerDrafts(project, [{ field: "客户名称", property: "name", value: "客户全称" }]);
  assert.equal(applied.values.客户全称, "杭州远山茶业有限公司");
  assert.ok(applied.template.schemas[0].some((field) => field.name === "客户全称"));
});
