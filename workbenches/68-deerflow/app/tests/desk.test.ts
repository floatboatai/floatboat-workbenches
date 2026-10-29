import { test } from "node:test";
import assert from "node:assert/strict";
import { templatePlan, planProblems, definitionChanged, planFromModel, keywords, deerflowBrief, newStep } from "../src/contracts/plan.ts";
import { compileReport, exportMarkdown, htmlDocument, linkCitations, reportMaterial, reportRequestValue, reportPrompt } from "../src/contracts/report.ts";
import { mergeStepResults, retrieveRequestValue, requestForStep, retrieveResultValue } from "../src/contracts/retrieval.ts";
import { emptyResearch, researchValue, restoreResearch, type Research } from "../src/contracts/research.ts";
import { sampleResearch } from "../src/contracts/sample.ts";

const question = "单机多进程服务使用 SQLite 时是否应开启 WAL？";
function confirmed(): Research {
  return { ...emptyResearch(question), plan: { steps: templatePlan(question, "参考 https://www.sqlite.org/wal.html 与 https://www.sqlite.org/pragma.html"), confirmed: true, confirmedAt: "", origin: "template" } };
}

test("template plan works without a model: five steps, Latin keywords for GitHub, scope URLs become a read step", () => {
  const steps = templatePlan(question, "参考 https://www.sqlite.org/wal.html。");
  assert.deepEqual(steps.map((s) => s.kind), ["analyze", "web-search", "github", "read", "analyze"]);
  assert.equal(steps[2].query, "SQLite WAL");
  assert.equal(steps[3].urls, "https://www.sqlite.org/wal.html");
  assert.equal(keywords("如何选择"), "如何选择");
  assert.deepEqual(planProblems(steps), []);
  assert.match(planProblems(templatePlan(question))[0], /第4步需要至少一个网址/);
  assert.match(planProblems([])[0], /至少需要一步/);
});
test("changing a step's definition requires reconfirmation; findings and status do not", () => {
  const s = newStep("web-search", "检索", "sqlite");
  assert.equal(definitionChanged(s, { ...s, query: "sqlite wal" }), true);
  assert.equal(definitionChanged(s, { ...s, findings: "记录", status: "done" }), false);
});
test("model plans are validated, never trusted: unknown kinds rejected, non-http URLs dropped", () => {
  const steps = planFromModel({ steps: [{ title: "读文档", kind: "read", query: "", urls: ["https://www.sqlite.org/wal.html", "javascript:alert(1)"] }, { title: "比较", kind: "analyze", query: "", urls: [] }] });
  assert.equal(steps[0].urls, "https://www.sqlite.org/wal.html");
  assert.equal(steps[1].status, "todo");
  assert.throws(() => planFromModel({ steps: [{ title: "x", kind: "shell", query: "", urls: [] }] }), /无效/);
  assert.throws(() => planFromModel({ steps: [] }), /无效/);
});
test("DeerFlow brief carries the question, scope and confirmed plan as explicit instructions", () => {
  const brief = deerflowBrief(sampleResearch);
  assert.match(brief, /研究问题：单机多进程/);
  assert.match(brief, /已确认的研究计划：\n1\. 界定场景与判断标准/);
  assert.match(brief, /\[n\] 标注来源/);
});
test("retrieval requests are bounded and analyze steps never hit the network", () => {
  assert.throws(() => retrieveRequestValue({ kind: "read", urls: [] }), /1–10/);
  assert.throws(() => retrieveRequestValue({ kind: "github", query: " " }), /检索词/);
  assert.throws(() => requestForStep(newStep("analyze")), /不需要检索/);
  assert.deepEqual(requestForStep(newStep("read", "读", "", "https://a.org/x\n\n https://b.org/y ")).urls, ["https://a.org/x", "https://b.org/y"]);
  assert.throws(() => retrieveResultValue({ items: "x" }), /格式无效/);
});
test("merging step results keeps numbers, notes, checks and citations stable across re-runs", () => {
  const d = confirmed();
  const step = d.plan.steps[1];
  const at = "2026-10-29T00:00:00.000Z";
  const first = mergeStepResults(d, step, [
    { url: "https://a.org/1", title: "A", excerpt: "a", text: "aa", via: "Exa 搜索", published: "" },
    { url: "https://b.org/2", title: "B", excerpt: "b", text: "bb", via: "Exa 搜索", published: "" },
    { url: "javascript:x", title: "bad", excerpt: "", text: "", via: "", published: "" },
  ], [], at);
  assert.deepEqual(first.map((s) => [s.cite, s.url]), [[1, "https://a.org/1"], [2, "https://b.org/2"]]);
  const touched = { ...d, sources: first.map((s) => (s.cite === 1 ? { ...s, note: "有用" } : s)) };
  const again = mergeStepResults(touched, step, [{ url: "https://c.org/3", title: "C", excerpt: "", text: "", via: "", published: "" }, { url: "https://a.org/1", title: "A2", excerpt: "", text: "", via: "", published: "" }], [], at);
  assert.deepEqual(again.map((s) => [s.cite, s.url, s.note]), [[1, "https://a.org/1", "有用"], [3, "https://c.org/3", ""]]);
  const cited = mergeStepResults({ ...d, sources: first }, step, [], [2], at);
  assert.deepEqual(cited.map((s) => s.cite), [2], "cited sources survive a re-run");
});
test("local report draft compiles plan, findings and numbered sources without a model", () => {
  const text = compileReport(sampleResearch, "WAL 研究");
  assert.match(text, /^# WAL 研究/);
  assert.match(text, /## 研究方法\n\n1\. 界定场景与判断标准（人工分析）/);
  assert.match(text, /### 精读 WAL 官方说明\n\nWAL 的核心收益/);
  assert.match(text, /\[1\]/);
  assert.match(text, /所有来源均已核验/);
  const empty = compileReport(confirmed(), "");
  assert.match(empty, /尚未记录这一步的发现/);
});
test("Markdown export lists cited sources and further reading; HTML export is standalone and escaped", () => {
  const data = structuredClone(sampleResearch);
  data.sources.push({ ...data.sources[0], id: "extra", cite: 8, title: "<script>x</script>", url: "https://example.org/?a=1&b=2" });
  const md = exportMarkdown(data);
  assert.match(md, /## 参考来源\n\n- \[1\] Write-Ahead Logging/);
  assert.match(md, /### 延伸阅读（未在正文引用）\n\n- \[8\]/);
  const html = htmlDocument("报告 <1>", "<p>正文</p>", data);
  assert.match(html, /<title>报告 &lt;1&gt;<\/title>/);
  assert.match(html, /<li id="source-1">/);
  assert.ok(!html.includes("<script>x</script>"));
  assert.match(html, /a=1&amp;b=2/);
  assert.equal(linkCitations("见 [1, 9]。", data.sources), "见 [\\[1\\]](#source-1)\\[9?\\]。");
});
test("report material for the optional model is bounded and prompts require [n] citations", () => {
  const m = reportMaterial(sampleResearch);
  assert.equal(m.sources.length, 7);
  const r = reportRequestValue(m);
  assert.match(reportPrompt(r), /\[1\] Write-Ahead Logging/);
  assert.throws(() => reportRequestValue({ ...m, sources: [] }), /1–24/);
});
test("autosave restore accepts unfinished plans; canonical validation enforces plan and source limits", () => {
  const d = confirmed();
  d.plan.steps[0].title = "";
  assert.equal(restoreResearch(d).plan.steps[0].title, "");
  assert.doesNotThrow(() => researchValue(d), "blank titles are drafts of the plan, not invalid data");
  const many = { ...d, plan: { ...d.plan, steps: Array.from({ length: 13 }, () => newStep()) } };
  assert.throws(() => researchValue(many), /最多12步/);
});
