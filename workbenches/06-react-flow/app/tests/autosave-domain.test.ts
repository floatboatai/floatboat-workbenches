import assert from "node:assert/strict";
import { test } from "node:test";
import { restoreFlowDraft, validateFlow } from "../src/contracts/flow.ts";
import { seed } from "../src/contracts/templates.ts";

test("暂时空白的节点名称可恢复，非法操作仍被拒绝", () => {
  const raw = structuredClone(seed);
  raw.nodes[0].data.label = "";
  assert.throws(() => validateFlow(raw));
  assert.equal(restoreFlowDraft(raw).nodes[0].data.label, "");
  assert.throws(() =>
    restoreFlowDraft({
      ...raw,
      nodes: [{ ...raw.nodes[0], data: { ...raw.nodes[0].data, op: "eval" } }],
    }),
  );
});

test("未完成的正则或空 CSV 仍是合法工作副本，运行时再报错", () => {
  const raw = structuredClone(seed);
  raw.nodes[0].data.config.csv = "";
  assert.equal(validateFlow(raw).nodes[0].data.config.csv, "");
});
