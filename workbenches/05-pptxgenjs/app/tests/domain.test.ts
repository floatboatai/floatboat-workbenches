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

test("未完成标题与过长要点作为草稿恢复，仍禁止非法页面标识", async () => {
  const { restoreDeckDraft } = await import("../src/contracts/domain.ts");
  const draft = {
    ...seed,
    slides: [{ ...seed.slides[0], title: "", body: "字".repeat(36) }],
  };
  assert.equal(restoreDeckDraft(draft).slides[0].title, "");
  assert.throws(() => validateDeck(draft));
  assert.throws(() =>
    restoreDeckDraft({
      ...draft,
      slides: [{ ...draft.slides[0], id: "bad/id" }],
    }),
  );
});
