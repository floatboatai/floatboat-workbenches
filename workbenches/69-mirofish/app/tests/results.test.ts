import { test } from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { readFileSync, mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { randomUUID } from "node:crypto";
import { createResults } from "../src/server/results.ts";
import { exampleScenario, resultIdOf } from "../src/contracts/example.ts";
import { simulate } from "../src/contracts/engine.ts";
import { WorkbenchHostError } from "../sdk/host.mjs";
import { generatePersonas, deepenReport, parsePersonas, personaRequestValue, type Llm } from "../src/server/host.ts";
import { chunksOf } from "../src/contracts/chunks.ts";

const open = (path = ":memory:") => {
  const db = new DatabaseSync(path);
  if (!db.prepare("SELECT 1 FROM sqlite_master WHERE name='run_results'").get()) db.exec(readFileSync(new URL("../migrations/0005_results.sql", import.meta.url), "utf8"));
  return db;
};
const input = () => exampleScenario().runs[0].input!;

test("local simulation is content-addressed: repeated requests return one stored result", () => {
  const db = open(),
    r = createResults(db);
  const a = r.simulate({ input: input(), robustness: true }),
    b = r.simulate({ input: input() });
  assert.equal(a.resultId, resultIdOf(input()));
  assert.equal(a.resultId, b.resultId);
  assert.equal(a.fingerprint, exampleScenario().runs[0].fingerprint);
  assert.equal(a.robustness?.seeds.length, 5);
  assert.equal(b.robustness, null);
  assert.equal((db.prepare("SELECT COUNT(*) AS n FROM run_results").get() as { n: number }).n, 1);
  assert.equal(JSON.parse(r.raw(a.resultId)).actions.length, a.summary.actions);
  assert.throws(() => r.raw("missing"), /不在本机结果库/);
  assert.throws(() => r.simulate({ input: { ...input(), agents: [], edges: [], events: [] } }), /至少需要一个智能体/);
});
test("chunked native upload survives lost responses, reorder and process restart; commit is idempotent", () => {
  const dir = mkdtempSync(join(tmpdir(), "mirofish-up-"));
  const path = join(dir, "data.sqlite");
  try {
    const actions = simulate(input()).actions;
    const text = actions.map((a) => JSON.stringify(a)).join("\n");
    const parts = chunksOf(text, 20_000);
    assert.ok(parts.length > 3);
    assert.equal(parts.join(""), text);
    const id = randomUUID();
    let db = open(path),
      r = createResults(db);
    r.begin({ id, name: "actions.jsonl", platform: "", chunks: parts.length });
    // Send in reverse and repeat one chunk as if its response had been lost.
    for (let i = parts.length - 1; i >= 1; i--) r.chunk(id, i, { text: parts[i] });
    r.chunk(id, 2, { text: parts[2] });
    assert.throws(() => r.commit(id), /分片不完整/);
    db.close();
    db = open(path);
    r = createResults(db);
    assert.deepEqual(r.begin({ id, name: "actions.jsonl", platform: "", chunks: parts.length }).received.length, parts.length - 1);
    assert.throws(() => r.begin({ id, name: "other.jsonl", platform: "", chunks: parts.length }), /不一致/);
    r.chunk(id, 0, { text: parts[0] });
    const first = r.commit(id),
      again = r.commit(id);
    assert.deepEqual(again, first);
    assert.equal(first.summary.actions, actions.length);
    assert.equal(first.summary.stanceKind, "lexicon");
    assert.equal((db.prepare("SELECT COUNT(*) AS n FROM upload_chunks").get() as { n: number }).n, 0);
    // Re-uploading the same content under a new id stores the result once.
    const id2 = randomUUID();
    r.begin({ id: id2, name: "actions.jsonl", platform: "", chunks: 1 });
    r.chunk(id2, 0, { text });
    assert.equal(r.commit(id2).resultId, first.resultId);
    assert.equal((db.prepare("SELECT COUNT(*) AS n FROM run_results").get() as { n: number }).n, 1);
    db.close();
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
test("chunks stay under the 2 MB request limit even for quote-heavy Chinese JSONL", () => {
  const text = Array.from({ length: 20000 }, (_, i) => JSON.stringify({ content: `“引号”与\\反斜杠 ${i} 中文内容`.repeat(3) })).join("\n");
  const parts = chunksOf(text);
  for (const p of parts) assert.ok(new TextEncoder().encode(JSON.stringify({ text: p })).length <= 1_400_000);
  assert.equal(parts.join(""), text);
});

const mock = (text: string, finishReason = "STOP"): Llm & { calls: unknown[] } => {
  const calls: unknown[] = [];
  return {
    calls,
    async generateText(input, options) {
      calls.push({ input, options });
      return { text, finishReason, model: "mock-model" };
    },
  };
};
const personaBody = () => ({
  id: randomUUID(),
  question: "低排放区舆论",
  topic: "低排放区",
  excerpt: "资料摘录",
  aspects: ["空气质量"],
  entities: exampleScenario().entities.filter((e) => e.type !== "议题").slice(0, 3).map(({ id, name, type, summary, stance }) => ({ id, name, type, summary, stance })),
});
test("Host persona contract (mock): prompt carries entities, output is validated and clamped", async () => {
  const body = personaBody();
  const llm = mock("好的：\n```json\n" + JSON.stringify([{ entityId: body.entities[0].id, bio: "简介", persona: "人设", profession: "公务员", stance: 3, activity: 0.7, topics: ["空气质量"] }, { entityId: "unknown", bio: "x" }]) + "\n```");
  const r = await generatePersonas(llm, body);
  assert.equal(r.personas.length, 1);
  assert.equal(r.personas[0].stance, 1);
  assert.equal(r.model, "mock-model");
  const call = llm.calls[0] as { input: { prompt: string; model: string }; options: { requestId: string } };
  assert.match(call.input.prompt, new RegExp(body.entities[0].name));
  assert.equal(call.options.requestId, body.id);
  assert.throws(() => parsePersonas("没有 JSON", personaRequestValue(body)), /没有返回人设/);
  await assert.rejects(() => generatePersonas(mock("[]", "MAX_TOKENS"), personaBody()), /截断/);
  await assert.rejects(() => generatePersonas(mock("[]"), { ...personaBody(), entities: [] }), /1–60/);
});
test("Host report contract (mock) and actionable offline errors", async () => {
  const llm = mock("# 深化报告\n\n内容");
  const r = await deepenReport(llm, { id: randomUUID(), question: "q", draft: "# 规则报告", metrics: "[]" });
  assert.equal(r.markdown, "# 深化报告\n\n内容");
  await assert.rejects(() => deepenReport(llm, { id: randomUUID(), draft: "" }), /先生成规则报告/);
  const offline: Llm = {
    async generateText() {
      throw new WorkbenchHostError({ code: "HOST_NOT_CONNECTED", message: "offline" });
    },
  };
  await assert.rejects(() => deepenReport(offline, { id: randomUUID(), draft: "# x" }), /需要 Floatboat 客户端.*重新检查/);
  await assert.rejects(() => generatePersonas(offline, personaBody()), /规则生成不受影响/);
});
