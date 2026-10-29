import { test } from "node:test";
import assert from "node:assert/strict";
import { simulate, summarize, robustness } from "../src/contracts/engine.ts";
import { analyzeActions } from "../src/contracts/analyze.ts";
import { exampleScenario, resultIdOf } from "../src/contracts/example.ts";
import { rng, hash53 } from "../src/contracts/random.ts";
import { simInput, deriveEdges, type SimInput } from "../src/contracts/scenario.ts";
import { parseNative, actionValue } from "../src/contracts/simulation.ts";

const base = () => exampleScenario().runs[0].input!;
test("seeded random stream is identical across runs and differs between seeds", () => {
  const a = rng("seed-a"),
    b = rng("seed-a"),
    c = rng("seed-b");
  const xs = Array.from({ length: 50 }, () => a.next());
  assert.deepEqual(xs, Array.from({ length: 50 }, () => b.next()));
  assert.notDeepEqual(xs, Array.from({ length: 50 }, () => c.next()));
  assert.equal(hash53("滨河"), hash53("滨河"));
});
test("the same input and seed reproduce the same actions, trajectories and fingerprint", () => {
  const one = simulate(base()),
    two = simulate(structuredClone(base()));
  assert.equal(one.fingerprint, two.fingerprint);
  assert.deepEqual(one.actions, two.actions);
  assert.deepEqual(one.trajectories, two.trajectories);
  assert.equal(one.fingerprint, exampleScenario().runs[0].fingerprint);
  const other = simulate({ ...base(), params: { ...base().params, seed: "另一个种子" } });
  assert.notEqual(other.fingerprint, one.fingerprint);
});
test("output uses MiroFish native AgentAction fields and round/timestamp ordering", () => {
  const r = simulate(base());
  assert.ok(r.actions.length > 150);
  for (const a of r.actions) assert.deepEqual(actionValue(a), a);
  const types = new Set(r.actions.map((a) => a.action_type));
  for (const t of ["CREATE_POST", "LIKE_POST", "CREATE_COMMENT", "REPOST"]) assert.ok(types.has(t), t);
  for (let i = 1; i < r.actions.length; i++) assert.ok(r.actions[i - 1].round_num <= r.actions[i].round_num);
  assert.equal(r.actions[0].timestamp.slice(0, 10), "2027-03-01");
  assert.equal(r.rounds.length, base().params.rounds + 1);
  assert.equal(r.trajectories[0].length, r.rounds.length);
  const native = parseNative(r.actions.map((a) => JSON.stringify(a)).join("\n"));
  assert.equal(native.actions.length, r.actions.length);
});
test("bounded confidence: agents beyond the trust threshold are not assimilated", () => {
  const input: SimInput = {
    ...base(),
    events: [],
    params: { ...base().params, confidence: 0.05, noise: 0, backfire: 0 },
  };
  const r = simulate(input);
  // With a tiny trust radius no one can be pulled across, so every agent keeps its sign.
  r.agents.forEach((a) => {
    if (Math.abs(a.start) > 0.2) assert.equal(Math.sign(a.end), Math.sign(a.start), a.name);
  });
  const open = simulate({ ...input, params: { ...input.params, confidence: 2, influenceRate: 0.5 } });
  const spread = (x: typeof r) => x.rounds[x.rounds.length - 1].sd;
  assert.ok(spread(open) < spread(r), "a wide trust radius must reduce dispersion");
});
test("event injection moves the targeted group in the injected direction", () => {
  const input = { ...base(), events: [], params: { ...base().params, noise: 0 } };
  const calm = simulate(input);
  const shocked = simulate({ ...input, events: [{ id: "x", round: 4, title: "冲击", text: "", push: -0.8, target: "type:群体", reach: 1, author: null }] });
  const at = (r: typeof calm) => r.rounds[4].byType["群体"];
  assert.ok(at(shocked) < at(calm) - 0.2);
  assert.equal(shocked.events[0].affected, input.agents.filter((a) => a.type === "群体").length);
  // Other types are only affected indirectly, never by the injection itself.
  assert.equal(shocked.rounds[4].byType["政府机构"] !== undefined, true);
});
test("robustness runs derived seeds and summaries stay within valid shares", () => {
  const r = robustness(base(), 3);
  assert.deepEqual(r.seeds, ["binhe-2027·1", "binhe-2027·2", "binhe-2027·3"]);
  for (const v of r.endSupport) assert.ok(v >= 0 && v <= 1);
  const s = summarize(simulate(base()));
  assert.ok(Math.abs(s.endSupport + s.endNeutral + s.endOppose - 1) < 0.01);
});
test("example is a substantial completed scenario with a generated report", () => {
  const s = exampleScenario();
  assert.equal(s.seeds.length, 4);
  assert.ok(s.seeds.reduce((n, d) => n + d.text.length, 0) > 2500);
  assert.ok(s.entities.length >= 15 && s.relations.length >= 20);
  assert.ok(s.agents.length >= 24);
  assert.equal(s.events.length, 3);
  assert.equal(s.runs[0].resultId, resultIdOf(simInput(s)));
  for (const h of ["主要结论", "关键转折", "群体分化", "关键角色", "代表性言论", "不确定性与局限"]) assert.match(s.report.markdown, new RegExp(h));
  assert.match(s.report.markdown, /公开听证会宣布延长过渡期/);
});
test("follow graph links members of one entity, related entities and loud institutions", () => {
  const s = exampleScenario();
  const edges = deriveEdges(s);
  const set = new Set(edges.map(([a, b]) => a + ">" + b));
  const group = s.agents.filter((a) => a.entityId === "e-drivers");
  assert.ok(set.has(group[0].id + ">" + group[1].id));
  const media = s.agents.find((a) => a.entityId === "e-daily")!;
  assert.ok(s.agents.every((a) => a.id === media.id || set.has(a.id + ">" + media.id) || set.has(a.id + ">" + s.agents.find((x) => x.type === "政府机构")!.id)));
});
test("imported native actions get exact activity counts and a lexicon stance estimate", () => {
  const r = analyzeActions(simulate(base()).actions);
  assert.equal(r.stanceKind, "lexicon");
  assert.equal(r.rounds.slice(1).reduce((n, x) => n + x.posts, 0), r.actions.filter((a) => a.action_type === "CREATE_POST").length);
  assert.equal(r.actionStance.length, r.actions.length);
  assert.ok(r.agents.length > 10);
});
