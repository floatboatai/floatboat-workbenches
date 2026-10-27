import assert from "node:assert/strict";
import { test } from "node:test";
import {
  restoreMindmapDraft,
  validateMindmap,
} from "../src/contracts/mindmap.ts";
test("超出行数的大纲仍可恢复为草稿，不能误当合法项目", () => {
  const raw = { markdown: "# 标题\n" + "- 项目\n".repeat(501) };
  assert.throws(() => validateMindmap(raw));
  assert.deepEqual(restoreMindmapDraft(raw), raw);
  assert.throws(() => restoreMindmapDraft({ markdown: 4 }));
});
