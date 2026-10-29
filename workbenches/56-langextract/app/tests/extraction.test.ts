import assert from "node:assert/strict";
import { test } from "node:test";
import { DatabaseSync } from "node:sqlite";
import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import type { WorkbenchServer } from "../sdk/runtime.mjs";
import { WorkbenchHostError } from "../sdk/host.mjs";
import { alignExtraction, codepointRange, tokenize } from "../src/contracts/align.ts";
import {
  buildPrompt,
  chunkDocument,
  exampleWarnings,
  parseModelOutput,
  resolveChunk,
} from "../src/contracts/prompting.ts";
import {
  classStats,
  documentsFromAnnotated,
  importedDocuments,
  manualRecord,
  parseImport,
  rawJsonl,
  realignDocument,
  recordSpan,
  removeRecord,
  reviewCsv,
  reviewedJsonl,
  runInput,
  serviceInput,
  textDocuments,
  validateProject,
  type EvidenceDocument,
} from "../src/contracts/evidence.ts";
import { blankProject, sampleProject, seed } from "../src/contracts/samples.ts";
import { segments, visualizationHtml } from "../src/contracts/visualize.ts";
import { chunkRequestId, createHostRuns } from "../src/server/host-runs.ts";
import { createStore } from "../src/server/store.ts";

const V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const slice = (s: string, a: number, b: number) => Array.from(s).slice(a, b).join("");

test("aligner returns Python codepoint intervals, prefers the occurrence after the cursor and folds width/case/space", () => {
  const src = "🌿甲方：北辰照明。乙方：北辰照明科技。Total ＵＳＤ 1,200";
  const first = alignExtraction(src, "北辰照明")!;
  assert.equal(first.status, "match_exact");
  assert.equal(slice(src, first.start, first.end), "北辰照明");
  assert.equal(first.start, 4, "emoji counts as one codepoint");
  const second = alignExtraction(src, "北辰照明", first.end)!;
  assert.ok(second.start > first.start);
  const folded = alignExtraction(src, "total usd 1,200")!;
  assert.equal(folded.status, "match_exact");
  assert.equal(slice(src, folded.start, folded.end), "Total ＵＳＤ 1,200");
  assert.equal(alignExtraction(src, ""), null);
});

test("fuzzy alignment accepts close paraphrase above 0.75 and leaves unrelated text unaligned", () => {
  const src = "会议决定：林晓负责在10月30日前给出答复，周岚准备招标文件。";
  const hit = alignExtraction(src, "由林晓负责在10月30日前答复")!;
  assert.equal(hit.status, "match_fuzzy");
  assert.ok(hit.ratio >= 0.75 && hit.ratio < 1);
  assert.match(slice(src, hit.start, hit.end), /^林晓负责在10月30日前/);
  assert.equal(alignExtraction(src, "预算5000元以内"), null);
  assert.equal(alignExtraction(src, "完全不同的一句话内容"), null);
  // CJK characters tokenize one by one, latin words stay whole.
  assert.deepEqual(tokenize(Array.from("LED射灯24套")).map((t) => t.norm), ["led", "射", "灯", "24", "套"]);
});

test("browser selections convert UTF-16 offsets to codepoints", () => {
  const text = "😀ab中文";
  // UTF-16: 😀 is 2 units, so "中" starts at 4.
  assert.deepEqual(codepointRange(text, 4, 6), { start: 3, end: 5 });
});

test("prompt follows the LangExtract Q/A few-shot format with class definitions and attribute keys", () => {
  const p = sampleProject();
  const prompt = buildPrompt({ ...p, text: "资料原文" });
  assert.match(prompt, /抽取类别：\n- 组织：/);
  assert.match(prompt, /属性：职务、所属/);
  assert.match(prompt, /Examples\nQ: 陈越代表远山设备/);
  assert.match(prompt, /"人员": "陈越"/);
  assert.match(prompt, /"人员_attributes": \{\s*"所属": "远山设备"/);
  assert.ok(prompt.endsWith("Q: 资料原文\nA:"));
});

test("model output parser accepts fenced LangExtract items, explicit items and bare JSON; rejects prose", () => {
  const fenced =
    '好的：\n```json\n{"extractions":[{"人员":"林晓","人员_attributes":{"职务":"负责人"}},{"金额":18000},{"extraction_class":"日期","extraction_text":"11月15日前","attributes":{"事件":"交付"}}]}\n```';
  const items = parseModelOutput(fenced);
  assert.deepEqual(items.map((i) => [i.extraction_class, i.extraction_text]), [
    ["人员", "林晓"],
    ["金额", "18000"],
    ["日期", "11月15日前"],
  ]);
  assert.deepEqual(items[0].attributes, { 职务: "负责人" });
  assert.equal(parseModelOutput('{"extractions": []}').length, 0);
  assert.equal(parseModelOutput('前缀 {"extractions":[{"组织":"北辰照明"}]} 后缀').length, 1);
  assert.throws(() => parseModelOutput("抱歉，我无法完成"), /JSON/);
  assert.throws(() => parseModelOutput('{"items": []}'), /extractions/);
  // Prototype keys from model output never become attributes.
  const evil = parseModelOutput('{"extractions":[{"组织":"x","组织_attributes":{"__proto__":"y","角色":"甲方"}}]}');
  assert.deepEqual(evil[0].attributes, { 角色: "甲方" });
});

test("chunking keeps codepoint offsets so chunk results land on the document text", () => {
  const para = "第一条 甲方应于签订后5日内付款。".repeat(40) + "\n" + "🌿乙方：北辰照明。".repeat(30);
  const chunks = chunkDocument(para, 300);
  assert.ok(chunks.length > 3);
  assert.equal(chunks.map((c) => c.text).join(""), para);
  for (const c of chunks) {
    assert.ok(Array.from(c.text).length <= 300);
    assert.equal(slice(para, c.start, c.start + Array.from(c.text).length), c.text);
  }
  const last = chunks.at(-1)!;
  const resolved = resolveChunk(last, [{ extraction_class: "组织", extraction_text: "北辰照明", attributes: null }, { extraction_class: "风险", extraction_text: "不存在的片段内容", attributes: null }], 7);
  assert.equal(slice(para, resolved[0].char_interval!.start_pos, resolved[0].char_interval!.end_pos), "北辰照明");
  assert.equal(resolved[0].extraction_index, 7);
  assert.equal(resolved[1].char_interval, null);
  assert.equal(resolved[1].alignment_status, null);
});

test("example validation warns when an example extraction is not verbatim in its example text", () => {
  assert.deepEqual(exampleWarnings(seed.examples), []);
  const warn = exampleWarnings([
    { text: "陈越采购12台投影机", extractions: [{ extraction_class: "数量", extraction_text: "十二台" }, { extraction_class: "人员", extraction_text: "" }] },
  ]);
  assert.equal(warn.length, 2);
  assert.match(warn[0], /十二台/);
});

test("sample batch is a five-document grounded set with fuzzy and unaligned cases", () => {
  const p = validateProject(seed);
  assert.equal(p.documents.length, 5);
  const records = p.documents.flatMap((d) => d.extractions);
  assert.ok(records.length >= 50);
  assert.ok(p.documents.every((d) => Array.from(d.text).length > 300));
  assert.equal(records.filter((e) => e.alignment_status === "match_fuzzy").length, 1);
  assert.equal(records.filter((e) => !e.char_interval).length, 1);
  for (const d of p.documents)
    d.extractions.forEach((e, i) => {
      if (e.alignment_status === "match_exact") assert.equal(slice(d.text, e.char_interval!.start_pos!, e.char_interval!.end_pos!), e.extraction_text, `${d.id} #${i}`);
    });
});

test("0.4 projects without the new review/field keys still load with defaults", () => {
  const old = JSON.parse(JSON.stringify(seed));
  delete old.model;
  for (const f of old.fields) delete f.attributes;
  for (const d of old.documents)
    d.reviews = d.reviews.map((r: { status: string }) => ({ status: r.status, correctedText: "", note: "" }));
  const p = validateProject(old);
  assert.equal(p.model, "gemini-3.8-flash");
  assert.deepEqual(p.fields[0].attributes, []);
  assert.equal(p.documents[0].reviews[0].source, "model");
  assert.equal(p.documents[0].reviews[0].span, null);
});

test("manual annotation, re-anchoring and deletion stay in the review layer", () => {
  let d: EvidenceDocument = structuredClone(seed.documents[1]);
  const before = d.extractions.length;
  const at = Array.from(d.text).join("").indexOf("滨江路88号");
  const start = Array.from(d.text.slice(0, at)).length;
  d = manualRecord(d, "组织", { start, end: start + 6 }, { 角色: "交付地点" });
  assert.equal(d.extractions.length, before + 1);
  const i = d.reviews.findIndex((r) => r.source === "manual");
  assert.equal(d.reviews[i].status, "accepted");
  assert.equal(d.extractions[i].extraction_text, "滨江路88号");
  // Ledger order follows reading order.
  assert.ok((recordSpan(d, i - 1)?.start ?? 0) <= start && (recordSpan(d, i + 1)?.start ?? Infinity) >= start);
  assert.throws(() => manualRecord({ ...d, text: d.text + "x" }, "组织", { start, end: start + 2 }), /原文已变更/);
  assert.throws(() => manualRecord(d, "组织", { start, end: start }), /选中/);
  assert.throws(() => removeRecord(d, 0), /只能驳回/);
  assert.equal(removeRecord(d, i).extractions.length, before);
  const p = { ...seed, documents: [d] };
  assert.ok(!rawJsonl(p).includes("滨江路88号\",\"char_interval"), "raw export excludes manual records");
  assert.match(reviewedJsonl(p), /滨江路88号/);
});

test("node re-alignment anchors unlocated imports without rewriting upstream intervals", () => {
  const [doc] = documentsFromAnnotated([
    {
      document_id: "x",
      text: "供应商北辰照明将于11月15日前交付。",
      extractions: [
        { extraction_class: "组织", extraction_text: "北辰照明" },
        { extraction_class: "日期", extraction_text: "11月15日前", char_interval: { start_pos: 9, end_pos: 16 } },
      ],
    },
  ]);
  assert.equal(recordSpan(doc, 0), null);
  const { doc: next, aligned } = realignDocument(doc);
  assert.equal(aligned, 1);
  assert.deepEqual(recordSpan(next, 0), { start: 3, end: 7 });
  assert.equal(next.extractions[0].char_interval, null, "upstream record untouched");
  assert.deepEqual(next.reviews[1].span, null);
});

test("reviewed JSONL carries final class/value/interval in LangExtract format and re-imports", () => {
  const p = structuredClone(seed);
  const d = p.documents[0];
  const s = d.reviews.findIndex((r) => r.status === "corrected");
  d.reviews[s].correctedClass = "数量（首批）";
  const out = reviewedJsonl(p).trim().split("\n").map((l) => JSON.parse(l));
  assert.equal(out.length, 5);
  const first = out[0].extractions;
  assert.ok(first.every((e: { extraction_class: string }) => e.extraction_class));
  const corrected = first.find((e: { extraction_text: string }) => e.extraction_text === "24套（首批）");
  assert.equal(corrected.extraction_class, "数量（首批）");
  // The corrected value differs from the grounded quote, so the interval is kept but not claimed exact.
  assert.equal(slice(out[0].text, corrected.char_interval.start_pos, corrected.char_interval.end_pos), "24套");
  assert.equal(corrected.alignment_status, "match_fuzzy");
  assert.ok(!first.some((e: { extraction_text: string }) => e.extraction_text === "第二批追加数量"), "rejected excluded");
  const again = parseImport(reviewedJsonl(p));
  assert.equal(again.documents.length, 5);
  assert.match(reviewCsv(p), /人工标注|模型/);
});

test("class statistics count final classes, statuses, unaligned and documents", () => {
  const stats = classStats(seed);
  const by = Object.fromEntries(stats.map((s) => [s.name, s]));
  assert.equal(stats.reduce((n, s) => n + s.total, 0), seed.documents.reduce((n, d) => n + d.extractions.length, 0));
  assert.equal(by["金额"].unaligned, 1);
  assert.equal(by["人员"].documents, 5);
  assert.ok(by["数量"].rejected >= 1 && by["数量"].corrected >= 1);
  assert.ok(stats.every((s) => s.defined));
});

test("visualization HTML is self-contained, escaped and highlights only non-rejected grounded records", () => {
  const p = structuredClone(seed);
  p.documents[0].reviews[0].note = '<script>alert("x")</script>';
  const html = visualizationHtml(p, "批次 <A&B>");
  assert.ok(!html.includes("<script>alert"));
  assert.match(html, /&lt;script&gt;/);
  assert.match(html, /批次 &lt;A&amp;B&gt;/);
  assert.ok(!/src=|href=|<script/i.test(html));
  const marks = html.match(/<mark /g)?.length ?? 0;
  const expected = p.documents.reduce((n, d) => n + d.extractions.filter((_, i) => recordSpan(d, i) && d.reviews[i].status !== "rejected").length, 0);
  assert.ok(marks >= expected - 2 && marks > 40);
  const segs = segments("abcdef", [{ start: 1, end: 4, index: 0 }, { start: 2, end: 5, index: 1 }], 1);
  assert.deepEqual(segs.map((s) => [s.text, s.index, s.last]), [["a", null, false], ["b", 0, false], ["cde", 1, true], ["f", null, false]]);
});

test("plain text files become uniquely named documents; service channel keeps its 1.7.1 limits", () => {
  const docs = textDocuments([{ name: "合同.txt", text: "a\r\nb" }, { name: "合同.md", text: "c" }], ["合同"]);
  assert.deepEqual(docs.map((d) => d.id), ["合同-2", "合同-3"]);
  assert.equal(docs[0].text, "a\nb");
  const input = runInput({
    documents: Array.from({ length: 9 }, (_, i) => ({ id: "d" + i, text: "x" })),
    fields: seed.fields,
    prompt: seed.prompt,
    examples: seed.examples,
  });
  assert.throws(() => serviceInput(input), /最多8份/);
  const ok = serviceInput({ ...input, documents: input.documents.slice(0, 2) });
  assert.ok(ok.fields.every((f) => f.attributes.length === 0));
  assert.equal(validateProject({ ...blankProject() }).documents[0].text, "");
  assert.equal(importedDocuments([{ document_id: "a", text: "t", extractions: [] }, { document_id: "a", text: "u", extractions: [] }]).documents[1].id, "a-2");
});

function hostSetup(reply: (prompt: string, call: number) => string | Error) {
  const db = new DatabaseSync(":memory:");
  for (const name of ["0002_projects.sql", "0005_host_runs.sql"])
    db.exec(readFileSync(new URL("../migrations/" + name, import.meta.url), "utf8"));
  const store = createStore(db, validateProject),
    project = store.create("批次", seed);
  const calls: { input: { model?: string; prompt: string; system?: string; temperature?: number }; requestId?: string }[] = [];
  const work: Promise<unknown>[] = [];
  const app = {
    database: db,
    trackTask: (fn: () => Promise<unknown>) => {
      const p = fn();
      work.push(p);
      return p;
    },
    host: {
      llm: {
        generateText: async (input: { model?: string; prompt: string }, options: { requestId?: string }) => {
          calls.push({ input, requestId: options.requestId });
          const r = reply(input.prompt, calls.length);
          if (r instanceof Error) throw r;
          return { type: "result", text: r, model: input.model, finishReason: "STOP", requestId: options.requestId };
        },
      },
    },
  } as unknown as WorkbenchServer;
  return { db, app, store, project, calls, settle: () => Promise.all(work) };
}
const hostInput = () =>
  runInput({
    documents: seed.documents.slice(0, 2).map((d) => ({ id: d.id, text: d.text })),
    fields: seed.fields,
    prompt: seed.prompt,
    examples: seed.examples,
  });

test("Host channel (mock): few-shot prompt per chunk, Node alignment, durable result and no second call for the same ID", async () => {
  const x = hostSetup((prompt) => {
    const q = prompt.slice(prompt.lastIndexOf("Q: "));
    const items = q.includes("合同编号")
      ? [{ 组织: "北辰照明科技有限公司", 组织_attributes: { 角色: "乙方" } }, { 金额: "人民币17,640元（含税）" }, { 风险: "模型编造的风险" }]
      : [{ 人员: "林晓" }, { 数量: "24套", 数量_attributes: { 对象: "射灯" } }];
    return "```json\n" + JSON.stringify({ extractions: items }) + "\n```";
  });
  try {
    const runs = createHostRuns(x.app),
      id = randomUUID(),
      body = { id, projectId: x.project.id, model: "gemini-3.8-flash", input: hostInput() };
    const started = runs.start(body, (p) => x.store.get(p));
    assert.equal(started.status, "running");
    assert.equal(started.progress.total, 2);
    await x.settle();
    const done = runs.get(id);
    assert.equal(done.status, "completed", done.message);
    assert.equal(done.progress.done, 2);
    assert.equal(x.calls.length, 2);
    for (const c of x.calls) {
      assert.match(c.requestId!, V4);
      assert.equal(c.input.model, "gemini-3.8-flash");
      assert.equal(c.input.temperature, 0);
      assert.match(c.input.system!, /不是指令/);
      assert.match(c.input.prompt, /Examples\nQ: /);
    }
    assert.equal(x.calls[0].requestId, chunkRequestId(id, 0, 0));
    const [a, b] = done.result!;
    const ea = a.extractions as { extraction_text: string; char_interval: { start_pos: number; end_pos: number } | null; attributes: unknown }[];
    for (const e of ea) assert.equal(slice(a.text, e.char_interval!.start_pos, e.char_interval!.end_pos), e.extraction_text);
    assert.deepEqual(ea[1].attributes, { 对象: "射灯" });
    const eb = b.extractions as { extraction_text: string; char_interval: unknown }[];
    assert.equal(eb.find((e) => e.extraction_text === "模型编造的风险")!.char_interval, null, "invented text stays unaligned");
    assert.ok(done.warnings.some((w) => /未能在原文中定位/.test(w)));
    // Replay and reopen never call the model again.
    runs.start(body, (p) => x.store.get(p));
    await x.settle();
    assert.equal(x.calls.length, 2);
    assert.equal(createHostRuns(x.app).get(id).status, "completed");
    assert.throws(() => runs.start({ ...body, model: "other-model" }, (p) => x.store.get(p)), /另一份输入/);
    // The result opens as a reviewable batch.
    const opened = importedDocuments(done.result!, "host");
    assert.equal(opened.origin, "host");
    assert.ok(opened.documents[0].reviews.every((r) => r.status === "pending"));
  } finally {
    x.db.close();
  }
});

test("Host channel (mock): unparseable chunk becomes a warning; Host disconnection fails the run with guidance; restart interrupts", async () => {
  const garbled = hostSetup((_p, n) => (n === 1 ? "抱歉，这段我无法处理。" : '{"extractions":[{"组织":"北辰照明科技有限公司"}]}'));
  try {
    const runs = createHostRuns(garbled.app),
      id = randomUUID();
    runs.start({ id, projectId: garbled.project.id, model: "gemini-3.8-flash", input: hostInput() }, (p) => garbled.store.get(p));
    await garbled.settle();
    const r = runs.get(id);
    assert.equal(r.status, "completed");
    assert.equal(r.result![0].extractions.length, 0);
    assert.equal(r.result![1].extractions.length, 1);
    assert.match(r.warnings[0], /不是有效 JSON/);
  } finally {
    garbled.db.close();
  }
  const offline = hostSetup(() => new WorkbenchHostError({ code: "HOST_NOT_CONNECTED", message: "offline" }));
  try {
    const runs = createHostRuns(offline.app),
      id = randomUUID();
    runs.start({ id, projectId: offline.project.id, model: "gemini-3.8-flash", input: hostInput() }, (p) => offline.store.get(p));
    await offline.settle();
    const r = runs.get(id);
    assert.equal(r.status, "failed");
    assert.match(r.message, /Floatboat 未连接/);
    assert.equal(r.result, null);
    assert.equal(offline.calls.length, 1, "stops at the first Host failure");
    assert.throws(() => runs.start({ id: randomUUID(), projectId: "missing", model: "m", input: hostInput() }, (p) => offline.store.get(p)));
    assert.throws(() => runs.start({ id: "not-a-uuid", projectId: offline.project.id, model: "m", input: hostInput() }, () => {}), /标识/);
    // A run left 'running' by a stopped server is not re-sent on restart.
    const stuck = randomUUID();
    offline.db
      .prepare("INSERT INTO langextract_host_runs(id,project_id,model,input_json,status,done,total,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?)")
      .run(stuck, offline.project.id, "m", JSON.stringify(hostInput()), "running", 0, 2, new Date().toISOString(), new Date().toISOString());
    const restarted = createHostRuns(offline.app);
    assert.equal(restarted.get(stuck).status, "interrupted");
    assert.equal(offline.calls.length, 1);
  } finally {
    offline.db.close();
  }
});
