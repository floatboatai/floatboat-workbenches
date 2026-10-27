import assert from "node:assert/strict";
import { test } from "node:test";
import { seed, validateDeck, moveSlide } from "../src/contracts/domain.ts";
test("排序保留所有内容且不修改原始数组", () => {
  const original = structuredClone(seed),
    result = moveSlide(original, 0, 1);
  assert.equal(result.slides[1].id, original.slides[0].id);
  assert.deepEqual(original, seed);
  assert.equal(moveSlide(original, 0, -1), original);
  assert.equal(moveSlide(original, 2, 1), original);
  assert.deepEqual(validateDeck(seed), seed);
});
test("拒绝重复ID、空文稿、过多条目和超宽正文", () => {
  assert.throws(() => validateDeck({ ...seed, slides: [] }));
  assert.throws(() =>
    validateDeck({ ...seed, slides: [seed.slides[0], seed.slides[0]] }),
  );
  assert.throws(() =>
    validateDeck({
      ...seed,
      slides: [{ ...seed.slides[0], body: Array(8).fill("条目").join("\n") }],
    }),
  );
  assert.throws(() =>
    validateDeck({
      ...seed,
      slides: [{ ...seed.slides[0], body: "字".repeat(36) }],
    }),
  );
  assert.throws(() => validateDeck({ ...seed, theme: "unknown" }));
});
