import { test } from "node:test";
import assert from "node:assert/strict";
import { exampleScenario } from "../src/contracts/example.ts";
import { extractGraph, layoutGraph, extractAspects, sentencesOf } from "../src/contracts/extract.ts";
import { generateAgents } from "../src/contracts/personas.ts";
import { buildReport, roundsCsv, agentsCsv, actionsJsonl } from "../src/contracts/report.ts";
import { simulate } from "../src/contracts/engine.ts";
import { blankScenario } from "../src/contracts/scenario.ts";
import { restoreScenario, scenarioProblem, scenarioValue } from "../src/contracts/validate.ts";
import { lexiconScore } from "../src/contracts/lexicon.ts";

test("rule extraction finds institutions, groups and people in Chinese seed text", () => {
  const s = exampleScenario();
  const ex = extractGraph(s.seeds, "低排放区");
  const names = ex.entities.map((e) => e.name);
  for (const n of ["滨河市生态环境局", "滨河市交通运输局", "滨河大学交通研究所", "老城区商户联合会", "清河环保志愿者协会", "滨河公交集团", "网约车司机", "老城区居民", "李教授"])
    assert.ok(names.includes(n), n + " in " + names.join("、"));
  // A name nested in a longer one is not a separate actor, and verbs are not part of names.
  assert.ok(!names.includes("滨河大学"));
  assert.ok(!names.some((n) => n.includes("会同")));
  assert.equal(ex.entities.find((e) => e.name === "低排放区")?.type, "议题");
  const eco = ex.entities.find((e) => e.name === "滨河市生态环境局")!,
    traffic = ex.entities.find((e) => e.name === "滨河市交通运输局")!;
  assert.equal(ex.relations.find((r) => r.source === eco.id && r.target === traffic.id)?.type, "合作");
  assert.deepEqual(extractGraph(s.seeds, "低排放区"), ex, "extraction is deterministic");
});
test("explicit markup, negation and aspect cues are honoured", () => {
  const ex = extractGraph([{ id: "d", name: "x", text: "【星河社区】并不反对改建。[[阿强|个人]]担心停车位减少，希望改善步行环境。" }]);
  assert.ok(ex.entities.some((e) => e.name === "星河社区"));
  assert.equal(ex.entities.find((e) => e.name === "阿强")?.type, "个人");
  assert.ok(lexiconScore("并不反对").score > 0);
  const aspects = extractAspects(sentencesOf("居民担心停车位减少。方案有利于改善步行环境。"));
  assert.deepEqual(aspects.map((a) => [a.label, a.lean]).sort(), [["停车位减少", -1], ["步行环境", 1]]);
});
test("layout keeps manual positions and places new entities inside the canvas", () => {
  const s = exampleScenario();
  const moved = s.entities.map((e, i) => (i === 0 ? { ...e, x: 111, y: 222 } : { ...e, x: 0, y: 0 }));
  const laid = layoutGraph(moved, s.relations);
  assert.deepEqual([laid[0].x, laid[0].y], [111, 222]);
  for (const e of laid) assert.ok(e.x >= 20 && e.x <= 980 && e.y >= 20 && e.y <= 620);
});
test("rule personas follow entity type, group variants and graph degree", () => {
  const s = exampleScenario();
  const agents = generateAgents(s.entities, s.relations, s.aspects, { perGroup: 2, seed: "t" });
  assert.equal(agents.filter((a) => a.entityId === "e-drivers").length, 2);
  assert.ok(!agents.some((a) => a.type === "议题"));
  const gov = agents.find((a) => a.type === "政府机构")!,
    crowd = agents.find((a) => a.type === "群体")!;
  assert.ok(gov.stubbornness > crowd.stubbornness);
  assert.ok(gov.influence > crowd.influence);
  assert.deepEqual(generateAgents(s.entities, s.relations, s.aspects, { perGroup: 2, seed: "t" }), agents);
});
test("strict validation blocks runs on unfinished input while draft restore keeps it", () => {
  const s = structuredClone(exampleScenario());
  s.entities[1].name = "";
  s.params.rounds = 0;
  assert.throws(() => scenarioValue(s), /不能为空|轮次/);
  assert.match(scenarioProblem(s), /实体名称不能为空/);
  const restored = restoreScenario(JSON.parse(JSON.stringify(s)));
  assert.equal(restored.entities[1].name, "");
  assert.equal(restored.params.rounds, 0);
  // Structure is still enforced on restore.
  assert.throws(() => restoreScenario({ ...s, entities: "oops" }));
  assert.throws(() => restoreScenario({ ...s, relations: [{ ...s.relations[0], target: "e-missing" }] }), /不存在/);
  assert.equal(scenarioProblem(blankScenario()), "");
});
test("deleting an entity that an agent depends on is reported before running", () => {
  const s = structuredClone(exampleScenario());
  s.entities = s.entities.filter((e) => e.id !== "e-bus");
  s.relations = s.relations.filter((r) => r.source !== "e-bus" && r.target !== "e-bus");
  assert.match(scenarioProblem(s), /来源实体已删除/);
});
test("report and data exports describe the run faithfully", () => {
  const s = exampleScenario();
  const result = simulate(s.runs[0].input!);
  const md = buildReport(s, s.runs[0], result);
  const last = result.rounds[result.rounds.length - 1];
  assert.match(md, new RegExp(`${Math.round(last.support * 100)}% 支持`));
  assert.match(md, /稳健性：另用 5 个随机种子/);
  const raw = roundsCsv(result);
  assert.ok(raw.startsWith("\uFEFFround,time,mean"), "UTF-8 BOM keeps Excel from garbling Chinese headers");
  const rounds = raw.trim().split("\r\n");
  assert.equal(rounds.length, result.rounds.length + 1);
  assert.equal(agentsCsv(result).trim().split("\r\n").length, result.agents.length + 1);
  assert.equal(actionsJsonl(result).trim().split("\n").length, result.actions.length);
});

test("historical report uses the run's saved question and topic after the working copy changes", () => {
  const s = structuredClone(exampleScenario());
  const run = s.runs[0];
  const result = simulate(run.input!);
  s.question = "新的问题，还没有重新运行";
  s.topic = "新的话题";
  const md = buildReport(s, run, result);
  assert.ok(md.includes(run.input!.question));
  assert.ok(md.startsWith(`# ${run.input!.topic} · 推演报告`));
  assert.ok(!md.includes(s.question));
  assert.ok(!md.includes(s.topic));
});
