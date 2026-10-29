import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { nativeExample, parseNative, nativeResult, NATIVE_LIMITS } from "../src/contracts/simulation.ts";
import { scenarioValue } from "../src/contracts/validate.ts";
import { createStore } from "../src/server/store.ts";

const fixture = readFileSync(new URL("./fixtures/native-actions.json", import.meta.url), "utf8");
test("unmodified upstream AgentAction serializer fixture round-trips all native fields", () => {
  const r = parseNative(fixture);
  assert.deepEqual(nativeResult(r.simulationId, r.actions), JSON.parse(fixture));
  assert.equal(r.actions[0].agent_id, 7);
});
test("native JSONL rounds and metadata events map without inventing platform", () => {
  const a = JSON.parse(fixture).data.all_actions[0];
  const { round_num, platform, ...rest } = a;
  const text = JSON.stringify({ event_type: "round_start" }) + "\n" + JSON.stringify({ ...rest, round: round_num });
  assert.throws(() => parseNative(text));
  const r = parseNative(text, "reddit");
  assert.equal(r.ignoredEvents, 1);
  assert.equal(r.actions[0].round_num, 3);
  assert.equal(r.actions[0].platform, "reddit");
});
test("single failed JSONL action is not confused with failed API response", () => {
  const a = { ...nativeExample[0], success: false };
  assert.equal(parseNative(JSON.stringify(a)).actions[0].success, false);
  assert.throws(() => parseNative(JSON.stringify({ success: false, error: "no" })));
});
test("partial status responses and malformed lines are rejected; real-sized logs are accepted", () => {
  assert.throws(() => parseNative(JSON.stringify({ recent_actions: nativeExample })));
  assert.throws(() => parseNative("{broken"));
  // 0.5 rejected anything over 500 actions; a 30-round run is now read in full.
  const big = Array.from({ length: 6000 }, (_, i) => ({ ...nativeExample[i % 4], round_num: 1 + (i % 30) }));
  assert.equal(parseNative(big.map((x) => JSON.stringify(x)).join("\n")).actions.length, 6000);
  assert.ok(NATIVE_LIMITS.actions >= 100_000);
});
test("repeated original actions are preserved instead of silently deduplicated", () => {
  assert.equal(parseNative(JSON.stringify([nativeExample[0], nativeExample[0]])).actions.length, 2);
});
test("0.5 review projects stored in SQLite reopen as a scenario with a read-only imported run", () => {
  const db = new DatabaseSync(":memory:");
  db.exec(readFileSync(new URL("../migrations/0002_projects.sql", import.meta.url), "utf8"));
  const legacy = {
    simulationId: "示例 · 周末市集",
    origin: "example",
    sourceName: "人工编写的原生格式示例",
    background: "讨论社区公园周末市集。",
    assumptions: "仅演示",
    conclusion: "人工结论",
    actions: nativeExample,
    annotations: {},
    actors: {},
  };
  db.prepare("INSERT INTO projects(id,title,payload,revision,updated_at) VALUES(?,?,?,1,?)").run("old", "Review", JSON.stringify(legacy), new Date().toISOString());
  const store = createStore(db, scenarioValue);
  const opened = store.get("old").data;
  assert.equal(opened.version, 2);
  assert.equal(opened.runs[0].legacyActions?.length, 4);
  assert.match(opened.notes, /人工结论/);
  // Saving the converted copy writes the v2 shape and refuses stale revisions.
  store.update("old", "Review", opened, 1);
  assert.throws(() => store.update("old", "stale", opened, 1));
  assert.equal(store.get("old").data.runs[0].engine, "import");
  db.close();
});
