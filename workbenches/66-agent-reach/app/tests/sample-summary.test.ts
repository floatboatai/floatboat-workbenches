import assert from "node:assert/strict";
import { test } from "node:test";
import { projectValue, sourceItem, report, size, PROJECT_BYTES, empty, canonical } from "../src/contracts/research.ts";
import { sample, SAMPLE_TITLE } from "../src/contracts/sample.ts";
import { summaryMaterial, summaryRequestValue, summaryPrompt, summaryDraftValue, SUMMARY_TEXT_CHARS } from "../src/contracts/summary.ts";
import { CHANNELS } from "../src/contracts/channels.ts";
import { decodeProjectImport } from "../src/contracts/import-project.ts";

test("first-open sample is a valid project with verbatim clips, review states and a brief", () => {
  const data = projectValue(sample);
  assert.equal(data.sources.length, 4);
  assert.ok(size(data) < PROJECT_BYTES / 4);
  for (const s of data.sources) for (const c of s.clips) assert.ok(sourceItem(data, s).text?.includes(c.text));
  assert.deepEqual(new Set(data.sources.map((s) => s.status)), new Set(["verified", "followup", "unreviewed"]));
  assert.equal(new Set(data.sources.map((s) => canonical(sourceItem(data, s)))).size, 4);
  assert.ok(data.sources.some((s) => s.id === data.selected));
  assert.ok(CHANNELS.some((c) => c.id === data.input.channel && c.actions.some((a) => a.id === data.input.action)));
});

test("sample report carries counts, brief, attributed quotations and review state", () => {
  const md = report(sample, SAMPLE_TITLE, new Date("2026-10-29T12:00:00Z"));
  assert.match(md, /^# 浏览器端 SQLite 持久化选型/);
  assert.match(md, /2026-10-29 · 4 条来源（已核对 2 · 待跟进 1 · 未核对 1）/);
  assert.match(md, /## 研究小结/);
  assert.match(md, /- 来源：https:\/\/sqlite\.org\/wasm\/doc\/trunk\/persistence\.md/);
  assert.match(md, /> OPFS is only available in Worker-thread contexts/);
  assert.match(md, /说明：架构约束/);
  assert.equal(report(empty, "空").includes("## 来源与证据"), false);
});

test("exported project with summary draft imports as a new collection keeping extra", () => {
  const extra = { summary: { text: "要点［1］", model: "m", requestId: "r", at: "2026-10-29T00:00:00Z", sourceIds: [sample.sources[0].id], focus: "q" }, summaryPick: [sample.sources[0].id] };
  const imported = decodeProjectImport({ format: "floatboat.agent-reach.collection", version: 1, title: SAMPLE_TITLE, data: sample, extra });
  assert.ok(imported);
  assert.deepEqual(imported.extra.summary, extra.summary);
  assert.equal(summaryDraftValue(imported.extra.summary)?.text, "要点［1］");
  assert.equal(summaryDraftValue({ text: 5 }), null);
});

test("summary material uses notes, clips and a bounded opening of each chosen source", () => {
  const ids = sample.sources.slice(0, 2).map((s) => s.id);
  const m = summaryMaterial(sample, ids, "选哪种 VFS？");
  assert.equal(m.sources.length, 2);
  assert.ok(m.sources.every((s) => s.text.length <= SUMMARY_TEXT_CHARS));
  assert.equal(m.sources[0].clips.length, 3);
  const valid = summaryRequestValue(JSON.parse(JSON.stringify(m)));
  const prompt = summaryPrompt(valid);
  assert.match(prompt, /研究问题：选哪种 VFS？/);
  assert.match(prompt, /［1］Persistent Storage Options/);
  assert.match(prompt, /研究者摘录：/);
  assert.throws(() => summaryRequestValue({ sources: [] }));
  assert.throws(() => summaryRequestValue({ sources: Array(9).fill(m.sources[0]) }));
  assert.throws(() => summaryRequestValue({ sources: [{ ...m.sources[0], text: "x".repeat(SUMMARY_TEXT_CHARS + 1) }] }));
});
