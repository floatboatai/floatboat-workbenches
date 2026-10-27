import assert from "node:assert/strict";
import { test } from "node:test";
import {
  seed,
  restoreDrawingDraft,
  validateDrawing,
} from "../src/contracts/drawing.ts";
test("暂时无效的尺寸可恢复，不会被静默改回合法尺寸", () => {
  const raw = { ...seed, width: 0, height: 40 };
  assert.throws(() => validateDrawing(raw));
  assert.deepEqual(restoreDrawingDraft(raw), raw);
  assert.throws(() => restoreDrawingDraft({ ...raw, width: "0" }));
  assert.throws(() => restoreDrawingDraft({ ...raw, width: Infinity }));
});
