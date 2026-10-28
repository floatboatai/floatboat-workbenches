import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import {
  seed,
  reviewValue,
  parseNative,
  fromNative,
  nativeResult,
  actionKey,
  actorKey,
} from "../src/contracts/simulation.ts";
import { createStore } from "../src/server/store.ts";
const fixture = readFileSync(
  new URL("./fixtures/native-actions.json", import.meta.url),
  "utf8",
);
test("unmodified upstream AgentAction serializer fixture round-trips all native fields", () => {
  const result = fromNative(fixture, "native fixture");
  assert.deepEqual(nativeResult(result), JSON.parse(fixture));
  assert.equal(result.actions[0].agent_id, 7);
});
test("native JSONL rounds and metadata events map without inventing platform", () => {
  const a = JSON.parse(fixture).data.all_actions[0];
  const { round_num, platform, ...rest } = a;
  const text =
    JSON.stringify({ event_type: "round_start" }) +
    "\n" +
    JSON.stringify({ ...rest, round: round_num });
  assert.throws(() => parseNative(text));
  const r = parseNative(text, "reddit");
  assert.equal(r.ignoredEvents, 1);
  assert.equal(r.actions[0].round_num, 3);
  assert.equal(r.actions[0].platform, "reddit");
});
test("single failed JSONL action is not confused with failed API response", () => {
  const a = { ...seed.actions[0], success: false };
  assert.equal(parseNative(JSON.stringify(a)).actions[0].success, false);
  assert.throws(() =>
    parseNative(JSON.stringify({ success: false, error: "no" })),
  );
});
test("partial status responses, malformed lines and excess rows are rejected without truncation", () => {
  assert.throws(() =>
    parseNative(JSON.stringify({ recent_actions: seed.actions })),
  );
  assert.throws(() => parseNative("{broken"));
  assert.throws(() =>
    parseNative(JSON.stringify(Array(501).fill(seed.actions[0]))),
  );
});
test("human notes remain independent of immutable native action fields", () => {
  const v = structuredClone(seed),
    before = JSON.stringify(v.actions);
  v.annotations[actionKey(v.actions[0], 0)] = {
    note: "需要核对原始背景",
    reviewed: true,
  };
  v.actors[actorKey(v.actions[0])] = "组织者可能只掌握部分信息";
  const result = reviewValue(v);
  assert.equal(JSON.stringify(result.actions), before);
  assert.equal(result.annotations[actionKey(v.actions[0], 0)].reviewed, true);
  v.annotations.unknown = { note: "bad", reviewed: true };
  assert.throws(() => reviewValue(v));
});
test("repeated original actions are preserved instead of silently deduplicated", () => {
  const result = parseNative(
    JSON.stringify([seed.actions[0], seed.actions[0]]),
  );
  assert.equal(result.actions.length, 2);
  assert.notEqual(
    actionKey(result.actions[0], 0),
    actionKey(result.actions[1], 1),
  );
});
test("real SQLite saves annotations and refuses stale revision updates", () => {
  const db = new DatabaseSync(":memory:");
  db.exec(
    readFileSync(
      new URL("../migrations/0002_projects.sql", import.meta.url),
      "utf8",
    ),
  );
  const store = createStore(db, reviewValue),
    a = store.create("Review", seed);
  const data = { ...seed, conclusion: "人工结论" };
  store.update(a.id, "Review", data, 1);
  assert.throws(() => store.update(a.id, "stale", seed, 1));
  assert.equal(store.get(a.id).data.conclusion, "人工结论");
  assert.notEqual(store.create("Imported", data).id, a.id);
  db.close();
});
