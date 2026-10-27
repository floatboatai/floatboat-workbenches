import assert from "node:assert/strict";
import { test } from "node:test";
import {
  seed,
  restoreSequenceDraft,
  validateDocument,
} from "../src/contracts/sequence.ts";
test("空序列输入阶段可恢复为草稿，不能构造有注释的空序列", () => {
  assert.throws(() => validateDocument(seed));
  assert.deepEqual(restoreSequenceDraft(seed), seed);
  assert.throws(() =>
    restoreSequenceDraft({ ...seed, features: [{ name: "未关联特征" }] }),
  );
});
