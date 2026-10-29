import assert from "node:assert/strict";
import { test } from "node:test";
import { condense, extractStat, parseBrief, timeMarker } from "../src/contracts/brief.ts";
import { chartFromTable, outlineFromBrief, slidesFromOutline, switchLayout } from "../src/contracts/generate.ts";
import { blank, validateDeck, type Brief } from "../src/contracts/model.ts";
import { example } from "../src/contracts/deck.ts";
import { SAMPLE_AUDIENCE, SAMPLE_BRIEF, SAMPLE_OBJECTIVE } from "../src/contracts/sample-brief.ts";

const sample: Brief = { source: SAMPLE_BRIEF, audience: SAMPLE_AUDIENCE, objective: SAMPLE_OBJECTIVE, language: "auto", length: 0, density: "standard" };

test("示例资料按内容选择版式：表格→图表、数字→关键数字、引语、对比、时间线、结尾", () => {
  const { items, log } = outlineFromBrief(sample);
  assert.deepEqual(
    items.map((i) => i.layout),
    ["cover", "agenda", "bullets", "bullets", "chart", "stats", "quote", "comparison", "image-text", "chart", "timeline", "closing"],
  );
  const chart = items[4].chart!;
  assert.equal(chart.type, "bar");
  assert.deepEqual(chart.series.map((s) => s.name), ["2025", "2026"]);
  assert.deepEqual(chart.series[1].values, ["46", "41", "58"]);
  assert.equal(chart.unit, "%");
  assert.match(items[4].points[0], /平均从 25.7% 到 48.3%/);
  assert.equal(items[9].chart!.type, "doughnut");
  assert.match(log.find((l) => l.section === "试点路线的遮荫变化")!.note, /未纳入量级不同的列「长度（米）」/);
  assert.deepEqual(items[7].columnTitles, ["做得好的", "仍需改进"]);
  assert.match(items[10].points[0], /^2026 年 11 月：/);
  assert.deepEqual(outlineFromBrief(sample), outlineFromBrief(sample), "deterministic");
});
test("幻灯片继承大纲并派生关键数字、引语出处与插画；结果是合格正式模型", () => {
  const slides = slidesFromOutline(outlineFromBrief(sample).items, sample);
  const stats = slides.find((s) => s.layout === "stats")!;
  assert.deepEqual(stats.stats[3], { value: "81%", label: "步行满意度（原 52%）" });
  assert.equal(stats.stats[0].value, "23 个百分点");
  const quote = slides.find((s) => s.layout === "quote")!;
  assert.equal(quote.subtitle, "桂园小区居民 陈女士");
  assert.equal(slides[0].image?.kind, "art");
  assert.ok(slides.every((s) => s.notes.length > 0 || s.layout === "agenda"));
  validateDeck({ ...blank, slides, brief: sample });
  assert.deepEqual(example.slides, slides);
});
test("目标页数与密度：精简为指定页数，详尽保留更多要点", () => {
  const eight = outlineFromBrief({ ...sample, length: 8 });
  assert.equal(eight.items.length, 8);
  assert.equal(eight.items[0].layout, "cover");
  assert.equal(eight.items.at(-1)!.layout, "closing");
  assert.ok(!eight.items.some((i) => i.layout === "agenda"));
  const concise = outlineFromBrief({ ...sample, density: "concise" }).items;
  const detailed = outlineFromBrief({ ...sample, density: "detailed" }).items;
  assert.ok(concise.filter((i) => i.layout === "bullets").every((i) => i.points.length <= 5));
  assert.ok(detailed.flatMap((i) => i.points).join("").length > concise.flatMap((i) => i.points).join("").length);
});
test("没有标题的普通文本与英文资料也能成稿", () => {
  const text = `Quarterly operations review

Revenue grew in every region this quarter. The north region led growth, while costs stayed flat. Customer churn fell for the second quarter in a row.

Next steps

We will hire two account managers. We will expand the pilot to three new cities. We will report results in January.`;
  const { items } = outlineFromBrief({ ...blank.brief, source: text });
  assert.equal(items[0].title, "Quarterly operations review");
  assert.equal(items.at(-1)!.layout, "closing");
  assert.equal(items.at(-1)!.title, "Next steps");
  const zh = outlineFromBrief({ ...blank.brief, source: "这是一段没有任何标题的资料。它只有两句话。" }).items;
  assert.ok(zh.length >= 2);
});
test("Markdown 解析：表格、引语出处、嵌套小节、续行列表", () => {
  const p = parseBrief("# T\n\n## A\n\n| 名称 | 数 |\n| --- | --- |\n| 甲 | 1 |\n| 乙 | 2 |\n\n> 很好。——张三\n\n### x\n- 一\n  续\n### y\n1. 二");
  assert.equal(p.title, "T");
  const a = p.sections[0];
  assert.equal(a.blocks[0].kind, "table");
  assert.deepEqual(a.blocks[1], { kind: "quote", text: "很好。", cite: "张三" });
  assert.deepEqual(a.parts.map((x) => x.title), ["x", "y"]);
  assert.deepEqual(a.parts[0].blocks[0], { kind: "list", items: ["一续"], ordered: false });
});
test("要点压缩按分句、去掉引导语、不截断数字", () => {
  assert.equal(condense("2025 年的测量显示，三条路线午后地表温度普遍超过 45℃，最高处达到 52℃。", 20), "三条路线午后地表温度普遍超过 45℃");
  assert.equal(condense("工作日每天约有 6,800 人次步行通过", 12), "工作日每天约有 6,800…");
  assert.deepEqual(extractStat("新植树木成活率达到 94%"), { value: "94%", label: "新植树木成活率" });
  assert.deepEqual(timeMarker("Q3 2026: launch"), { label: "Q3 2026", rest: "launch" });
  assert.equal(timeMarker("普通句子"), null);
});
test("表格转图表：时间分类为折线，量级不同的列被排除，非数字表不转换", () => {
  const line = chartFromTable(["月份", "销售额（万元）"], [["1月", "12"], ["2月", "15"], ["3月", "18"]], "销售");
  assert.equal(line?.chart.type, "line");
  assert.equal(line?.chart.unit, "万元");
  assert.equal(chartFromTable(["名称", "说明"], [["甲", "好"], ["乙", "差"]], ""), null);
});
test("切换版式时从要点派生图表与关键数字，内容不丢失", () => {
  const s = slidesFromOutline(outlineFromBrief(sample).items, sample)[2];
  const chart = switchLayout(s, "chart");
  assert.equal(chart.layout, "chart");
  assert.ok(chart.chart && chart.chart.categories.length >= 2);
  const stats = switchLayout(s, "stats");
  assert.ok(stats.stats.length >= 2);
  const cmp = switchLayout(s, "comparison");
  assert.deepEqual([...cmp.bullets, ...cmp.bullets2], s.bullets);
  assert.deepEqual(switchLayout(chart, "bullets").bullets, s.bullets);
});
