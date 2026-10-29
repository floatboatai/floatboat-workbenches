// Contract tests for the optional Floatboat model channel. A fake Host stands in;
// no real Host, model or upstream is called.
import { test } from "node:test";
import assert from "node:assert/strict";
import { WorkbenchHostError } from "../sdk/host.mjs";
import { hostStatus, draftPlan, draftReport, registerAssist } from "../src/server/assist.ts";
import { reportMaterial } from "../src/contracts/report.ts";
import { sampleResearch } from "../src/contracts/sample.ts";

type Call = { op: string; input: Record<string, unknown>; options: unknown };
function fakeHost(behaviour: { offline?: boolean; object?: unknown; text?: string; ops?: string[] } = {}) {
  const calls: Call[] = [];
  const offline = () => {
    throw new WorkbenchHostError({ code: "HOST_NOT_CONNECTED" });
  };
  const host = {
    capabilities: {
      list: async () => {
        if (behaviour.offline) offline();
        return { sdkVersion: "1.0.0", capabilities: (behaviour.ops ?? ["generateText", "generateObject"]).map((operation) => ({ domain: "llm", operation, status: "available" })) };
      },
    },
    llm: {
      generateObject: async (input: Record<string, unknown>, options: unknown) => {
        calls.push({ op: "generateObject", input, options });
        if (behaviour.offline) offline();
        return { object: behaviour.object, text: "", model: "fake-model", requestId: "req-1", finishReason: "stop" };
      },
      generateText: async (input: Record<string, unknown>, options: unknown) => {
        calls.push({ op: "generateText", input, options });
        if (behaviour.offline) offline();
        return { text: behaviour.text ?? "", model: "fake-model", requestId: "req-2", finishReason: "stop" };
      },
      streamText: () => {
        throw new Error("unused");
      },
    },
  };
  return { host: host as unknown as Parameters<typeof hostStatus>[0], calls };
}

test("status distinguishes connected, unauthorized and offline Host without throwing", async () => {
  assert.equal((await hostStatus(fakeHost().host)).llm, "available");
  assert.equal((await hostStatus(fakeHost({ ops: [] }).host)).llm, "unavailable");
  const off = await hostStatus(fakeHost({ offline: true }).host);
  assert.equal(off.llm, "not-connected");
  assert.match(off.message, /启动 Floatboat/);
});
test("plan drafting sends a JSON Schema request and validates the returned object", async () => {
  const { host, calls } = fakeHost({ object: { steps: [{ title: "界定标准", kind: "analyze", query: "", urls: [] }, { title: "读官方文档", kind: "read", query: "", urls: ["https://www.sqlite.org/wal.html"] }] } });
  const r = await draftPlan(host, { question: "是否开启 WAL？", scope: "单机" });
  assert.equal(calls[0].op, "generateObject");
  assert.ok(calls[0].input.schema, "structured output schema is passed to the Host");
  assert.match(String(calls[0].input.prompt), /是否开启 WAL/);
  assert.deepEqual(r.steps.map((s) => s.kind), ["analyze", "read"]);
  assert.equal(r.steps[1].urls, "https://www.sqlite.org/wal.html");
  await assert.rejects(draftPlan(fakeHost({ object: { steps: [{ title: "x", kind: "exec" }] } }).host, { question: "q" }), /无效/);
  await assert.rejects(draftPlan(host, { question: " " }), /研究问题/);
});
test("report drafting passes numbered material and flags citations the material does not contain", async () => {
  const { host, calls } = fakeHost({ text: "# 结论\n\n应开启 WAL [1]，但需监控 [7]，另见 [12]。" });
  const r = await draftReport(host, reportMaterial(sampleResearch));
  assert.match(String(calls[0].input.prompt), /\[1\] Write-Ahead Logging/);
  assert.match(String(calls[0].input.system), /\[编号\]/);
  assert.deepEqual(r.unknownCitations, [12]);
  await assert.rejects(draftReport(fakeHost({ text: "  " }).host, reportMaterial(sampleResearch)), /没有返回内容/);
});
test("routes answer 503 with a next step when the Host is offline; local work is unaffected", async () => {
  const routes = new Map<string, (ctx: { body: unknown }) => Promise<unknown>>();
  const app = { route: (method: string, path: string, handler: (ctx: { body: unknown }) => Promise<unknown>) => routes.set(method + " " + path, handler) };
  registerAssist(app as never, fakeHost({ offline: true }).host);
  const plan = (await routes.get("POST /api/assist/plan")!({ body: { question: "q" } })) as Response;
  assert.equal(plan.status, 503);
  assert.match((await plan.json()).error.message, /重新检查/);
  const report = (await routes.get("POST /api/assist/report")!({ body: reportMaterial(sampleResearch) })) as Response;
  assert.equal(report.status, 503);
  const bad = (await routes.get("POST /api/assist/report")!({ body: { sources: [], steps: [] } })) as Response;
  assert.equal(bad.status, 400);
});
