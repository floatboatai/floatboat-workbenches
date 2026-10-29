// ABOUTME: 文稿模型：严格校验、草稿恢复、0.3.0 旧格式迁移、版式切换、几何吸附、历史与 AI 大纲转换。
import assert from "node:assert/strict";
import { test } from "node:test";
import { moveSlide, restoreDeckDraft, validateDeck, migrateLegacyDeck, mediaIds, type Deck, type ChartElement } from "../src/contracts/domain.ts";
import { seed, SEED_MEDIA_ID } from "../src/contracts/seed.ts";
import { LAYOUTS, applyLayout, newSlide, onPlaceholder } from "../src/contracts/layouts.ts";
import { outlineToDeck, parseOutline } from "../src/contracts/outline.ts";
import { moveBox, resizeBox, reorderElement, duplicateElement } from "../src/ui/geometry.ts";
import { createHistory } from "../src/ui/history.ts";
import { sniffImage } from "../src/contracts/media.ts";

const legacy = {
  theme: "ink",
  slides: [
    { id: "opening", title: "把计划，变成下一步。", kicker: "PLAN / 01", body: "明确核心问题\n聚焦目标", notes: "开场" },
    { id: "next", title: "下一步", kicker: "", body: "", notes: "" },
  ],
};

test("示例文稿通过严格校验：10 页覆盖全部版式，并含图表、表格、图片、形状与超链接", () => {
  const deck = validateDeck(seed);
  assert.deepEqual(deck, seed);
  assert.equal(deck.slides.length, 10);
  assert.deepEqual(new Set(deck.slides.map((s) => s.layout)), new Set(Object.keys(LAYOUTS)));
  const types = new Set(deck.slides.flatMap((s) => s.elements.map((e) => e.type)));
  for (const t of ["text", "image", "table", "chart", "shape"]) assert.ok(types.has(t as never), t);
  assert.deepEqual(mediaIds(deck), [SEED_MEDIA_ID]);
  assert.ok(JSON.stringify(deck).includes('"link":"https://www.example.com/reports/membership-2026q3"'));
  assert.ok(Buffer.byteLength(JSON.stringify(deck)) < 900000);
});

test("0.3.0 旧文稿确定性迁移为“标题 + 内容”版式，标题绑定母版占位", () => {
  const a = validateDeck(legacy),
    b = validateDeck(structuredClone(legacy));
  assert.deepEqual(a, b);
  assert.equal(a.version, 2);
  assert.equal(a.theme.preset, "ink");
  assert.equal(a.slides[0].layout, "content");
  assert.equal(a.slides[0].notes, "开场");
  const body = a.slides[0].elements.find((e) => e.slot === "body");
  assert.ok(body && body.type === "text");
  assert.deepEqual(
    body.paragraphs.map((p) => [p.bullet, p.runs[0]?.text]),
    [
      [true, "明确核心问题"],
      [true, "聚焦目标"],
    ],
  );
  const title = a.slides[0].elements.find((e) => e.slot === "title")!;
  assert.equal(onPlaceholder("content", title), "title");
  assert.deepEqual(migrateLegacyDeck(legacy as never), a);
  assert.throws(() => validateDeck({ ...legacy, slides: [legacy.slides[0], legacy.slides[0]] }));
});

test("严格校验拒绝坏结构；草稿恢复保留未完成的图表数值、字体与链接", () => {
  assert.throws(() => validateDeck({ ...seed, slides: [] }));
  assert.throws(() => validateDeck({ ...seed, slides: [seed.slides[0], seed.slides[0]] }), /重复/);
  assert.throws(() => validateDeck({ ...seed, theme: { ...seed.theme, aspect: "21:9" } }));
  assert.throws(() => validateDeck({ ...seed, theme: { ...seed.theme, colors: { ...seed.theme.colors, accent: "red" } } }));

  const draft: Deck = structuredClone(seed);
  const chart = draft.slides[2].elements.find((e) => e.type === "chart") as ChartElement;
  chart.series[0].values[1] = "约 400";
  draft.theme.headFont = "";
  const text = draft.slides[3].elements.find((e) => e.slot === "body");
  if (text?.type === "text") text.paragraphs[0].runs[0].link = "www.example.com";
  assert.throws(() => validateDeck(draft), /不是数字|不能为空|链接/);
  const restored = restoreDeckDraft(draft);
  assert.equal((restored.slides[2].elements.find((e) => e.type === "chart") as ChartElement).series[0].values[1], "约 400");
  assert.equal(restored.theme.headFont, "");
  assert.throws(() => restoreDeckDraft({ ...draft, slides: [{ ...draft.slides[0], id: "bad/id" }] }));
  assert.throws(() => restoreDeckDraft({ ...draft, slides: [{ ...draft.slides[0], elements: [{ ...draft.slides[0].elements[0], type: "video" }] }] }));
});

test("页面排序保持内容且不修改原数组", () => {
  const original = structuredClone(seed);
  const moved = moveSlide(original, 0, 2);
  assert.equal(moved.slides[2].id, "cover");
  assert.deepEqual(original, seed);
  assert.equal(moveSlide(original, 0, 0), original);
  assert.equal(moveSlide(original, 0, 99), original);
});

test("切换版式：占位移到新母版位置，缺失占位补齐，多余占位变为自由元素", () => {
  const content = seed.slides[3];
  const switched = applyLayout(content, "two-column");
  const title = switched.elements.find((e) => e.slot === "title")!;
  assert.equal(onPlaceholder("two-column", title), "title");
  assert.ok(switched.elements.some((e) => e.slot === "body2"));
  const body = switched.elements.find((e) => e.id === "body")!;
  assert.equal(body.w, 42);
  const toBlank = applyLayout(content, "blank");
  assert.ok(toBlank.elements.every((e) => !e.slot));
  assert.equal(toBlank.elements.length, content.elements.length);
  const imageText = applyLayout(content, "image-text");
  assert.ok(imageText.elements.some((e) => e.type === "image" && e.mediaId === ""));
  validateDeck({ ...seed, slides: [switched, { ...toBlank, id: "b" }, { ...imageText, id: "c" }, newSlide("chart"), newSlide("table")] });
});

test("拖动吸附到页边/中线/其它元素，缩放保持最小尺寸与比例", () => {
  const moved = moveBox({ x: 10, y: 10, w: 20, h: 10 }, 29.6, 0, [], true, 1, 1);
  assert.equal(moved.box.x + moved.box.w / 2, 50);
  assert.deepEqual(moved.guides, [{ axis: "x", at: 50 }]);
  const free = moveBox({ x: 10, y: 10, w: 20, h: 10 }, 29.6, 0, [], false, 1, 1);
  assert.equal(free.box.x, 39.6);
  const aligned = moveBox({ x: 10, y: 60, w: 20, h: 10 }, 0, -9.7, [{ x: 50, y: 40, w: 10, h: 10 }], true, 1, 1);
  assert.equal(aligned.box.y, 50);
  const tiny = resizeBox({ x: 10, y: 10, w: 20, h: 10 }, "w", 40, 0, [], { snap: false, keepRatio: false, minW: 1, minH: 1, tx: 1, ty: 1 });
  assert.deepEqual(tiny.box, { x: 29, y: 10, w: 1, h: 10 });
  const ratio = resizeBox({ x: 10, y: 10, w: 20, h: 10 }, "se", 10, 0, [], { snap: false, keepRatio: true, minW: 1, minH: 1, tx: 1, ty: 1 });
  assert.deepEqual(ratio.box, { x: 10, y: 10, w: 30, h: 15 });
});

test("层级调整与复制元素", () => {
  const slide = seed.slides[9];
  const first = slide.elements[0].id;
  const front = reorderElement(slide, first, "front");
  assert.equal(front.elements.at(-1)!.id, first);
  assert.equal(reorderElement(slide, first, "back"), slide);
  const { slide: copied, id } = duplicateElement(slide, first);
  assert.equal(copied.elements.length, slide.elements.length + 1);
  assert.equal(copied.elements[1].id, id);
  assert.equal(copied.elements[1].x, slide.elements[0].x + 2);
});

test("撤销/重做：同一拖动会话合并为一步，新的编辑清空重做栈", () => {
  const h = createHistory<number>();
  h.record(0, "drag:1", 1000);
  h.record(1, "drag:1", 1100);
  h.record(2, "drag:1", 1200);
  assert.equal(h.undo(3), 0);
  assert.equal(h.canUndo, false);
  assert.equal(h.redo(0), 3);
  h.record(3, "", 5000);
  assert.equal(h.canRedo, false);
  assert.equal(h.undo(4), 3);
});

test("AI 大纲转换为使用当前主题的母版文稿", () => {
  const outline = parseOutline({
    title: "新会员方案",
    slides: [
      { layout: "title", title: "新会员方案", subtitle: "销售团队培训" },
      { layout: "comparison", title: "现行与新方案", leftHeading: "现行", rightHeading: "新方案", bullets: ["积分抵现"], right: ["月度权益"] },
      { layout: "quote", title: "让每次到店都有收获", subtitle: "会员运营组" },
      { layout: "unknown", title: "下一步", bullets: ["三店试点", "六周复盘"], notes: "确认负责人" },
    ],
  });
  const deck = outlineToDeck(outline, seed.theme);
  assert.equal(deck.slides.length, 4);
  assert.equal(deck.slides[3].layout, "content");
  assert.equal(deck.slides[3].notes, "确认负责人");
  assert.deepEqual(deck.theme, seed.theme);
  for (const slide of deck.slides) for (const el of slide.elements) if (el.slot === "title") assert.ok(onPlaceholder(slide.layout, el));
  assert.throws(() => parseOutline({ slides: [] }));
});

test("图片格式识别读取真实尺寸，拒绝非图片", () => {
  const png = new Uint8Array(24);
  png.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 0);
  new DataView(png.buffer).setUint32(16, 640);
  new DataView(png.buffer).setUint32(20, 480);
  assert.deepEqual(sniffImage(png), { mime: "image/png", width: 640, height: 480 });
  const gif = new Uint8Array([0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 0x20, 0x00, 0x10, 0x00]);
  assert.deepEqual(sniffImage(gif), { mime: "image/gif", width: 32, height: 16 });
  assert.equal(sniffImage(new TextEncoder().encode("<svg></svg>")), null);
});
