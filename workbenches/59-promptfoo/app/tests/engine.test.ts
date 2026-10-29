import assert from "node:assert/strict";
import { test, after } from "node:test";
import { readFileSync } from "node:fs";
import { renderTemplate, templateVariables } from "../src/contracts/template.ts";
import { parseSuite, testsFromCsv, appendTestsToConfig, renderPrompt } from "../src/contracts/config.ts";
import { parseRun, recordingsOf, runStats } from "../src/contracts/results.ts";
import { runAssertion, runAssertions, extractJsonObjects } from "../src/server/assertions.ts";
import { evaluateSuite, hostPrompt, type HostModel } from "../src/server/evaluator.ts";
import { createSandbox, functionBody } from "../src/server/sandbox.ts";
import type { ProviderDef, TestCase } from "../src/contracts/config.ts";

const fixture = JSON.parse(readFileSync(new URL("./fixtures/official-parity.json", import.meta.url), "utf8"));
const sampleConfig = readFileSync(new URL("../samples/promptfooconfig.yaml", import.meta.url), "utf8");
const recorded = JSON.parse(readFileSync(new URL("../samples/recorded-run.json", import.meta.url), "utf8"));
const sandbox = createSandbox();
after(() => sandbox.close());

const tools = [
  {
    type: "function",
    function: { name: "lookup_order", parameters: { type: "object", properties: { order_id: { type: "string", pattern: "^QY\\d{8}$" } }, required: ["order_id"], additionalProperties: false } },
  },
];
const provider: ProviderDef = { id: "p", label: "p", kind: "replay", model: "", config: { tools }, prompts: null, replayOf: "p" };
const testCase = (assert: TestCase["assert"] = [], extra: Partial<TestCase> = {}): TestCase => ({
  description: "",
  vars: { lang: "en", order_id: "QY20261018" },
  assert,
  options: {},
  metadata: {},
  key: "k",
  ...extra,
});

test("template subset renders vars, filters, conditions and loops; blocks prototype access", () => {
  const vars = { name: "Ada", items: ["a", "b"], o: { k: "v" }, empty: "", n: 3 };
  assert.equal(renderTemplate("Hi {{ name | upper }} {{o.k}} {{ missing }}!", vars), "Hi ADA v !");
  assert.equal(renderTemplate("{% for x in items %}{{loop.index}}={{x}}{% if not loop.last %},{% endif %}{% endfor %}", vars), "1=a,2=b");
  assert.equal(renderTemplate("{% if empty %}A{% elif n > 2 %}B{% else %}C{% endif %}", vars), "B");
  assert.equal(renderTemplate('{{ empty | default("无", true) }} {{ items | join("/") }} {{ o | dump }}', vars), '无 a/b {"k":"v"}');
  assert.equal(renderTemplate("{%- if name -%}  x  {%- endif -%}", vars), "x");
  assert.deepEqual(templateVariables("{{a}} {% for i in list %}{{ i }} {{b.c}}{% endfor %}"), ["a", "list", "b"]);
  assert.throws(() => renderTemplate("{{ name.constructor }}", vars), /不能访问/);
  assert.throws(() => renderTemplate("{{ name | system }}", vars), /过滤器/);
  assert.throws(() => renderTemplate("{% include 'x' %}", vars), /不支持模板标签/);
  assert.throws(() => renderTemplate("{{ name ", vars), /没有闭合/);
});

test("sample promptfooconfig.yaml: 36 cases × 3 prompts × 2 recorded providers + filtered script", () => {
  const s = parseSuite(sampleConfig);
  assert.equal(s.tests.length, 36);
  assert.equal(s.prompts.length, 3);
  assert.equal(s.columns.length, 7);
  assert.deepEqual(s.providers.map((p) => p.kind), ["replay", "replay", "script"]);
  assert.ok(s.tests.every((t) => t.assert.length >= 10), "defaultTest assertions merged");
  const zh = s.tests[0];
  assert.match(renderPrompt(s.prompts[1].raw, zh.vars), /订单号：QY20261018/);
  assert.doesNotMatch(renderPrompt(s.prompts[1].raw, { ...zh.vars, order_id: "" }), /订单号：/);
});

test("config normalization: defaultTest, array var expansion, provider kinds, references rejected", () => {
  const s = parseSuite(`
prompts: ["Q: {{q}} ({{lang}})", {label: B, raw: "{{q}}"}]
providers:
  - echo
  - id: floatboat:gemini-3.8-flash
    label: Host
  - openai:gpt-4.1-mini
defaultTest:
  vars: {lang: zh}
  assert: [{type: not-contains, value: "undefined"}]
tests:
  - vars: {q: [a, b, c]}
    assert: [{type: icontains, value: "{{q}}"}]
    threshold: 0.5
`);
  assert.equal(s.tests.length, 3);
  assert.deepEqual(s.tests.map((t) => t.vars.q), ["a", "b", "c"]);
  assert.equal(s.tests[0].vars.lang, "zh");
  assert.equal(s.tests[0].assert.length, 2);
  assert.equal(s.tests[0].threshold, 0.5);
  assert.deepEqual(s.providers.map((p) => [p.kind, p.model]), [["echo", ""], ["host", "gemini-3.8-flash"], ["replay", ""]]);
  assert.equal(s.columns.length, 6);
  assert.ok(s.warnings.some((w) => w.includes("openai:gpt-4.1-mini")));
  assert.throws(() => parseSuite("prompts: [file://p.txt]\nproviders: [echo]\ntests: [{vars: {}}]"), /外部文件/);
  assert.throws(() => parseSuite("prompts: [x]\nproviders: [echo]\ntests: file://tests.csv"), /导入用例 CSV/);
  assert.throws(() => parseSuite("prompts: [x]\nproviders: [echo]\ntests: [{assert: [{type: contains-magic}]}]"), /未知断言/);
  assert.throws(() => parseSuite("prompts: [x]\nproviders: [echo]\ntests: [{assert: [{type: latency}]}]"), /threshold/);
  assert.throws(() => parseSuite("prompts: [x]\nproviders: [{id: floatboat:script}]\ntests: [{}]"), /config.code/);
  assert.throws(() => parseSuite("prompts: [x]\nproviders: [echo]\ntests: [{}]\nfoo: [1, 2"), /第 \d+ 行/);
  const remote = parseSuite("prompts: [x]\nproviders: [echo]\ntests: [{assert: [{type: llm-rubric, value: polite}]}]");
  assert.ok(remote.warnings.some((w) => w.includes("llm-rubric")));
});

test("CSV test import follows promptfoo __expected columns and appends to YAML", () => {
  const tests = testsFromCsv('question,__expected,__expected2,__description\n"退货, 换货",contains: 退货,not-icontains: AI,第一条\nhello,javascript: output.length > 2,,\n');
  assert.equal(tests.length, 2);
  assert.deepEqual(tests[0].vars, { question: "退货, 换货" });
  assert.deepEqual(tests[0].assert, [{ type: "contains", value: "退货" }, { type: "not-icontains", value: "AI" }]);
  assert.equal(tests[0].description, "第一条");
  assert.deepEqual(tests[1].assert, [{ type: "javascript", value: "output.length > 2" }]);
  const next = appendTestsToConfig("# keep me\nprompts: ['{{question}}']\nproviders: [echo]\ntests:\n  - vars: {question: x}\n", tests);
  assert.match(next, /# keep me/);
  assert.equal(parseSuite(next).tests.length, 3);
  assert.throws(() => testsFromCsv("a,__expected\nx,=HYPERLINK(1)\n"), /公式/);
});

test("single assertions match promptfoo 0.125.1 runAssertion (fixture from the real package)", async () => {
  for (const c of fixture.single) {
    const r = await runAssertion(c.assertion, c.output, {
      prompt: "",
      promptLabel: "",
      vars: { lang: "en", order_id: "QY20261018" },
      test: testCase([c.assertion]),
      provider,
      sandbox,
      ...c.extra,
    });
    assert.equal(r.pass, c.expected.pass, `${c.name} pass`);
    assert.ok(Math.abs(r.score - c.expected.score) < 1e-6, `${c.name} score ${r.score} vs ${c.expected.score}`);
  }
  assert.equal(fixture.single.length, 48);
});

test("weights, test threshold, assert-set and named metrics aggregate like upstream", async () => {
  for (const c of fixture.aggregate) {
    const t = testCase(c.test.assert, { threshold: c.test.threshold, vars: {} });
    const r = await runAssertions(t, c.output, { prompt: "", promptLabel: "", vars: {}, test: t, provider, sandbox });
    assert.equal(r.pass, c.expected.pass, c.name);
    assert.ok(Math.abs(r.score - c.expected.score) < 1e-6, `${c.name} ${r.score}`);
    for (const [k, v] of Object.entries(c.expected.namedScores)) assert.ok(Math.abs((r.namedScores?.[k] ?? -1) - (v as number)) < 1e-6);
  }
});

test("remote model-graded assertions are reported as not executed and excluded from score", async () => {
  const t = testCase([{ type: "llm-rubric", value: "polite" }, { type: "contains", value: "ok" }]);
  const r = await runAssertions(t, "ok", { prompt: "", promptLabel: "", vars: {}, test: t, provider, sandbox });
  assert.equal(r.pass, true);
  assert.equal(r.score, 1);
  assert.equal(r.componentResults?.[0].metadata?.skipped, true);
});

test("javascript sandbox: no host objects, no string compilation, loops time out, async allowed", async () => {
  const run = (code: string, output: unknown = "x") => sandbox.run(functionBody(code), ["output", "context"], [output, {}], 200);
  assert.deepEqual(await run("output + '!'"), { ok: true, value: "x!" });
  assert.equal((await run("this.constructor.constructor('return process')()")).ok, false);
  assert.match((await run("Object.getPrototypeOf(output).constructor.constructor('return this')()")).error ?? "", /Code generation/);
  assert.match((await run("eval('1')")).error ?? "", /Code generation/);
  assert.deepEqual(await run("typeof process + typeof require + typeof fetch"), { ok: true, value: "undefinedundefinedundefined" });
  assert.match((await run("let i = 0;\nwhile (true) { i++; }")).error ?? "", /超时/);
  assert.deepEqual(await run("Promise.resolve(41).then((v) => v + 1)"), { ok: true, value: 42 });
  assert.deepEqual(await run("output.length"), { ok: true, value: 1 }, "sandbox recovers after a timeout");
  assert.equal((await run("undefined")).value, undefined);
});

test("lenient JSON extraction mirrors upstream for fenced, embedded and unbalanced text", () => {
  assert.deepEqual(extractJsonObjects('x ```json\n{"a":1}\n``` y {"b":[2]}'), [{ a: 1 }, { b: [2] }]);
  assert.equal(extractJsonObjects("{broken").length, 1);
  assert.equal(extractJsonObjects("no braces").length, 0);
});

test("full sample re-evaluated locally equals the official promptfoo 0.125.1 run cell by cell", async () => {
  const suite = parseSuite(sampleConfig);
  const recordings = new Map([...recordingsOf(recorded)].map(([k, v]) => [k, { ...v, runId: "smp" }]));
  const local = parseRun(await evaluateSuite(suite, {}, { sandbox, recordings, host: null, allowHost: false }));
  let compared = 0;
  for (const [key, [pass, score, error, components]] of Object.entries(fixture.cells) as [string, [boolean, number, number, string]][]) {
    const cell = local.byKey.get(key);
    assert.ok(cell, `local cell ${key}`);
    assert.equal(cell.pass, pass, key);
    assert.ok(Math.abs((cell.score ?? 0) - score) < 1e-6, `${key} score`);
    assert.equal(cell.error ? 1 : 0, error, `${key} error`);
    assert.equal(cell.components.map((c) => (c.pass ? 1 : 0)).join(""), components, `${key} components`);
    compared++;
  }
  assert.equal(compared, 216);
  const stats = runStats(local);
  assert.equal(stats.total, 252);
  assert.ok(local.cells.some((c) => c.replayedFrom === "smp"));
});

test("replay misses, echo, script provider and transform errors become explicit cell states", async () => {
  const suite = parseSuite(`
prompts: ["Ticket {{t}}"]
providers:
  - echo
  - id: recorded:none
  - id: floatboat:script
    label: rules
    config:
      code: |
        return { output: JSON.stringify({ upper: prompt.toUpperCase(), vars: context.vars.t }), cost: 0.0001 };
tests:
  - vars: {t: abc}
    assert:
      - {type: icontains, value: "TICKET"}
      - {type: cost, threshold: 0.01}
  - vars: {t: def}
    assert: [{type: equals, value: x, transform: "JSON.parse(output).missing"}]
`);
  const run = parseRun(await evaluateSuite(suite, {}, { sandbox, recordings: new Map(), host: null, allowHost: false }));
  const byCol = (label: string, t: number) => run.cells.find((c) => run.columns[c.column].provider === label && c.test === t)!;
  assert.equal(byCol("echo", 0).pass, true);
  assert.equal(byCol("echo", 0).output, "Ticket abc");
  assert.match(byCol("recorded:none", 0).error, /没有录制输出/);
  assert.equal(byCol("rules", 0).pass, true);
  assert.match(byCol("rules", 0).output, /TICKET ABC/);
  assert.match(byCol("echo", 1).error, /Transform failed|did not return/);
});

test("Floatboat Host provider (mock): explicit opt-in, chat prompts split, failures stay per cell", async () => {
  const calls: { input: Parameters<HostModel["generateText"]>[0]; requestId: string }[] = [];
  const host: HostModel = {
    async generateText(input, options) {
      calls.push({ input, requestId: options.requestId });
      if (input.prompt.includes("boom")) throw Object.assign(new Error("offline"), { code: "HOST_NOT_CONNECTED" });
      return { text: `answer:${input.prompt}`, model: "gemini-3.8-flash", finishReason: "STOP", usage: { inputTokens: 5, outputTokens: 3, totalTokens: 8 } };
    },
  };
  const suite = parseSuite(`
prompts:
  - label: chat
    raw: '[{"role":"system","content":"be brief"},{"role":"user","content":"{{q}}"}]'
providers:
  - id: floatboat:gemini-3.8-flash
    config: {temperature: 0, maxOutputTokens: 64}
tests:
  - vars: {q: hello}
    assert: [{type: starts-with, value: "answer:"}, {type: finish-reason, value: stop}]
  - vars: {q: boom}
`);
  const blocked = parseRun(await evaluateSuite(suite, {}, { sandbox, recordings: new Map(), host, allowHost: false }));
  assert.equal(calls.length, 0);
  assert.match(blocked.cells[0].error, /未运行 Floatboat 模型/);
  const run = parseRun(await evaluateSuite(suite, {}, { sandbox, recordings: new Map(), host, allowHost: true }));
  assert.equal(calls.length, 2);
  assert.deepEqual(calls[0].input, { prompt: "hello", model: "gemini-3.8-flash", system: "be brief", temperature: 0, maxOutputTokens: 64 });
  assert.match(calls[0].requestId, /^[0-9a-f-]{36}$/);
  assert.equal(run.cells[0].pass, true);
  assert.equal(run.cells[0].tokens, 8);
  assert.match(run.cells[1].error, /Floatboat 未连接/);
  assert.deepEqual(hostPrompt("plain"), { prompt: "plain" });
});

test("real promptfoo 0.125.1 CLI output imports with columns, failures and recordings", () => {
  const real = JSON.parse(readFileSync(new URL("./fixtures/promptfoo-0.125.1-echo.json", import.meta.url), "utf8"));
  const view = parseRun(real);
  assert.equal(view.cells.length, 4);
  assert.deepEqual(view.columns.map((c) => c.prompt), ["Baseline", "Revision"]);
  assert.equal(runStats(view).pass, 3);
  assert.ok(view.cells.find((c) => !c.pass)!.components.some((c) => !c.pass));
  assert.equal(parseRun(real.results).cells.length, 4, "bare summary also accepted");
  assert.equal(recordingsOf(real).size, 4);
  const dup = structuredClone(real);
  dup.results.results.push(dup.results.results[0]);
  assert.throws(() => parseRun(dup), /重复/);
  assert.throws(() => parseRun({ results: { version: 4, results: [{}] } }), /版本/);
});
