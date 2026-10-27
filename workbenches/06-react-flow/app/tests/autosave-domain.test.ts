import assert from "node:assert/strict";
import { test } from "node:test";
import { seed, restoreFlowDraft, validateFlow } from "../src/contracts/flow.ts";
test("暂时空白的节点名称可恢复，非法操作仍被拒绝", () => {
  const raw = structuredClone(seed);
  raw.nodes[0].data.label = "";
  assert.throws(() => validateFlow(raw));
  assert.equal(restoreFlowDraft(raw).nodes[0].data.label, "");
  assert.throws(() =>
    restoreFlowDraft({
      ...raw,
      nodes: [
        { ...raw.nodes[0], data: { ...raw.nodes[0].data, operation: "eval" } },
      ],
    }),
  );
});
