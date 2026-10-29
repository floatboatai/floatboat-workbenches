import { test, after } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { normaliseDefs } from "../src/contracts/comfy.ts";
import { toApiPrompt, type ApiPrompt } from "../src/contracts/convert.ts";
import { buildTemplate } from "../src/contracts/templates.ts";
import { readComfyPng } from "../src/contracts/png.ts";
import { isFinished, type RunSummary } from "../src/contracts/run.ts";
import { createRunStore } from "../src/server/runs.ts";
import { createSession } from "../src/server/comfy-session.ts";
import { registerComfyRoutes, type RouteContextLike } from "../src/server/comfy-routes.ts";
import { startMock, type MockServer } from "./support/mock-comfy.ts";
import { MINI_INFO } from "./support/mini-info.ts";

const defs = normaliseDefs(MINI_INFO);
const wf = () => buildTemplate("txt2img", defs);
const promptOf = () => toApiPrompt(wf(), defs).prompt;
const migration = readFileSync(new URL("../migrations/0004_comfy_runs.sql", import.meta.url), "utf8");
function stores() {
  const db = new DatabaseSync(":memory:");
  db.exec(migration);
  const store = createRunStore(db);
  return { db, store, session: createSession(store, { pollMs: 80 }) };
}
const mocks: MockServer[] = [];
const sessions: ReturnType<typeof createSession>[] = [];
async function mock(options: Partial<Parameters<typeof startMock>[0]> = {}) {
  const m = await startMock({ objectInfo: MINI_INFO, stepMs: 4, ...options });
  mocks.push(m);
  return m;
}
after(async () => {
  for (const s of sessions) s.shutdown();
  for (const m of mocks) await m.close();
});
const until = async <T,>(fn: () => T | Promise<T>, ok: (v: T) => boolean, ms = 8000): Promise<T> => {
  const end = Date.now() + ms;
  for (;;) {
    const v = await fn();
    if (ok(v)) return v;
    if (Date.now() > end) throw new Error("timeout waiting for condition");
    await new Promise((r) => setTimeout(r, 40));
  }
};
const post = (m: MockServer, body: unknown) => fetch(m.url + "/prompt", { method: "POST", body: JSON.stringify(body) });

test("mock follows ComfyUI's validation error shapes", async () => {
  const m = await mock();
  const bad = async (prompt: unknown) => ({ res: await post(m, { prompt }), });
  let r = await post(m, {});
  assert.equal(r.status, 400);
  assert.equal(((await r.json()) as { error: { type: string } }).error.type, "no_prompt");
  r = await post(m, { prompt: { "1": { class_type: "CLIPTextEncode", inputs: { text: "x" } } } });
  assert.equal(((await r.json()) as { error: { type: string } }).error.type, "prompt_no_outputs");
  r = await post(m, { prompt: { "1": { class_type: "NopeNode", inputs: {}, _meta: { title: "Nope" } } } });
  let body = (await r.json()) as { error: { type: string; message: string } };
  assert.equal(body.error.type, "missing_node_type");
  assert.match(body.error.message, /not found/);
  const p = promptOf();
  delete (p["3"].inputs as Record<string, unknown>).model;
  (p["3"].inputs as Record<string, unknown>).steps = 0;
  (p["4"].inputs as Record<string, unknown>).ckpt_name = "missing.safetensors";
  r = await post(m, { prompt: p });
  assert.equal(r.status, 400);
  body = (await r.json()) as never;
  const full = body as unknown as { error: { type: string }; node_errors: Record<string, { errors: { type: string; extra_info: { input_name: string } }[]; class_type: string; dependent_outputs: string[] }> };
  assert.equal(full.error.type, "prompt_outputs_failed_validation");
  const ks = full.node_errors["3"];
  assert.equal(ks.class_type, "KSampler");
  assert.deepEqual(ks.errors.map((e) => e.type).sort(), ["required_input_missing", "value_smaller_than_min"]);
  assert.deepEqual(ks.dependent_outputs, ["9"]);
  assert.equal(full.node_errors["4"].errors[0].type, "value_not_in_list");
  assert.equal(full.node_errors["4"].errors[0].extra_info.input_name, "ckpt_name");
  const mismatch = promptOf();
  (mismatch["3"].inputs as Record<string, unknown>).model = ["4", 1];
  const mm = (await (await post(m, { prompt: mismatch })).json()) as { node_errors: Record<string, { errors: { type: string }[] }> };
  assert.equal(mm.node_errors["3"].errors[0].type, "return_type_mismatch");
  void bad;
});

test("mock WebSocket emits ComfyUI's message sequence, caches repeats, serves /view with metadata", async () => {
  const m = await mock();
  const clientId = "11111111-1111-4111-8111-111111111111";
  const events: { type: string; data: Record<string, unknown> }[] = [];
  const ws = new WebSocket(`ws://127.0.0.1:${m.port}/ws?clientId=${clientId}`);
  ws.addEventListener("message", (e) => events.push(JSON.parse(String(e.data))));
  await new Promise((r) => ws.addEventListener("open", r, { once: true }));
  const submit = async () => {
    const res = await post(m, { prompt: promptOf(), client_id: clientId, extra_data: { extra_pnginfo: { workflow: wf() } } });
    return ((await res.json()) as { prompt_id: string }).prompt_id;
  };
  const id = await submit();
  await until(() => events, (e) => e.some((x) => x.type === "execution_success"));
  const types = events.map((e) => e.type);
  assert.equal(types[0], "status");
  assert.ok(types.indexOf("execution_start") < types.indexOf("execution_cached"));
  assert.ok(types.indexOf("execution_cached") < types.indexOf("executing"));
  assert.ok(types.filter((t) => t === "progress").length === 25);
  assert.ok(types.includes("progress_state"));
  assert.ok(types.indexOf("executed") < types.indexOf("execution_success"));
  const done = events.find((e) => e.type === "executed")!;
  const image = (done.data.output as { images: { filename: string; subfolder: string; type: string }[] }).images[0];
  const view = await fetch(`${m.url}/view?filename=${image.filename}&subfolder=&type=${image.type}`);
  const bytes = new Uint8Array(await view.arrayBuffer());
  const meta = await readComfyPng(bytes);
  assert.ok(Array.isArray((meta.workflow as { nodes: unknown[] }).nodes));
  assert.equal(Object.keys(meta.prompt as object).length, 7);
  const history = (await (await fetch(`${m.url}/history/${id}`)).json()) as Record<string, { status: { status_str: string } }>;
  assert.equal(history[id].status.status_str, "success");
  events.length = 0;
  await submit();
  await until(() => events, (e) => e.some((x) => x.type === "execution_success"));
  const cached = events.find((e) => e.type === "execution_cached")!.data.nodes as string[];
  assert.ok(cached.length >= 5, "unchanged nodes are served from cache");
  assert.equal(events.filter((e) => e.type === "progress").length, 0);
  // like ComfyUI 0.43: cached output nodes are listed as cached yet still replay their `executed` result
  assert.ok(cached.includes("9"));
  assert.ok(events.some((e) => e.type === "executed" && e.data.node === "9"));
  ws.close();
});

test("origin and auth: foreign Origin is refused like ComfyUI; the app's proxy works with a token", async () => {
  const m = await mock({ auth: { header: "Authorization", value: "Bearer secret" } });
  const foreign = await fetch(m.url + "/system_stats", { headers: { Origin: "http://evil.example", Authorization: "Bearer secret" } });
  assert.equal(foreign.status, 403);
  const { store, session } = stores();
  sessions.push(session);
  void store;
  session.setConfig({ baseUrl: m.url, headerName: "Authorization", token: "wrong", remember: false });
  await assert.rejects(session.connect(), /令牌|401|拒绝/);
  session.setConfig({ baseUrl: m.url, headerName: "Authorization", token: "Bearer secret", remember: false });
  const { status, defs: loaded } = await session.connect();
  assert.ok(status.ok);
  assert.equal(Object.keys(loaded).length, Object.keys(MINI_INFO).length);
  assert.equal(session.publicConfig().hasToken, true);
  assert.equal("token" in session.publicConfig(), false);
});

test("unreachable server gives an actionable message, not a raw fetch error", async () => {
  const { session } = stores();
  sessions.push(session);
  const closed = await mock();
  const port = closed.port;
  await closed.close();
  session.setConfig({ baseUrl: `http://127.0.0.1:${port}`, headerName: "", remember: false });
  await assert.rejects(session.connect(), (e: Error) => e.message.includes(String(port)) && /python main\.py/.test(e.message) && !/fetch failed/.test(e.message));
});

async function runToEnd(session: ReturnType<typeof createSession>, store: ReturnType<typeof createRunStore>, id: string): Promise<RunSummary> {
  return until(() => store.summary(id)!, (r) => isFinished(r.status));
}

test("session runs a workflow end to end and stores reproducible outputs", async () => {
  const m = await mock({ stepMs: 2 });
  const { store, session } = stores();
  sessions.push(session);
  session.setConfig({ baseUrl: m.url, headerName: "", remember: false });
  await session.connect();
  const result = await session.submit({ projectId: "p1", title: "Cabin", prompt: promptOf(), workflow: wf() });
  assert.ok(result.ok);
  if (!result.ok) return;
  const live = session.state("p1").runs.find((r) => r.runId === result.run.id);
  assert.ok(live);
  const run = await runToEnd(session, store, result.run.id);
  assert.equal(run.status, "success");
  assert.equal(run.outputs.length, 1);
  assert.equal(run.outputs[0].mime, "image/png");
  assert.deepEqual([run.outputs[0].width, run.outputs[0].height], [512, 512]);
  assert.equal(run.facts.seeds[0], 156680208700286);
  assert.equal(run.facts.steps, 25);
  assert.match(run.facts.positive, /cozy wooden cabin/);
  const detail = store.detail(run.id)!;
  assert.equal(detail.workflow.nodes.length, 7);
  const out = store.output(run.outputs[0].id)!;
  const meta = await readComfyPng(out.data);
  assert.ok(meta.workflow && meta.prompt);
  // a second identical run is answered from the server's cache and still has its image
  const again = await session.submit({ projectId: "p1", title: "Cabin", prompt: promptOf(), workflow: wf() });
  assert.ok(again.ok);
  if (!again.ok) return;
  const second = await runToEnd(session, store, again.run.id);
  assert.equal(second.status, "success");
  assert.equal(second.outputs.length, 1);
  assert.equal(store.list("p1").length, 2);
  store.removeProject("p1");
  assert.equal(store.list("p1").length, 0);
});

test("rejected prompts return node_errors through the route without creating a run", async () => {
  const m = await mock();
  const { store, session } = stores();
  sessions.push(session);
  const routes = new Map<string, (c: RouteContextLike) => unknown>();
  registerComfyRoutes({ route: (method, path, handler) => void routes.set(method + " " + path, handler) }, session, store);
  const call = async (key: string, body: unknown = {}, params: Record<string, string> = {}) => {
    const out = await routes.get(key)!({ body, params, url: new URL("http://x/") });
    return out instanceof Response ? { status: out.status, json: (await out.json()) as Record<string, unknown> } : { status: 200, json: out as Record<string, unknown> };
  };
  assert.equal((await call("GET /api/comfy/config")).json.baseUrl, "");
  await call("PUT /api/comfy/config", { baseUrl: m.url, headerName: "", remember: false });
  const p = promptOf();
  delete (p["6"].inputs as Record<string, unknown>).clip;
  const res = await call("POST /api/comfy/run", { projectId: "p2", title: "Bad", prompt: p, workflow: wf() });
  assert.equal(res.json.ok, false);
  assert.ok((res.json.node_errors as Record<string, unknown>)["6"]);
  assert.equal(store.list("p2").length, 0);
  const noUrl = createSession(createRunStore(new DatabaseSync(":memory:")));
  sessions.push(noUrl);
});

test("runtime errors become failed runs with the failing node; interrupt and cancel work", async () => {
  const m = await mock({ failClass: "VAEDecode", stepMs: 2 });
  const { store, session } = stores();
  sessions.push(session);
  session.setConfig({ baseUrl: m.url, headerName: "", remember: false });
  await session.connect();
  const failed = await session.submit({ projectId: "p3", title: "Boom", prompt: promptOf(), workflow: wf() });
  assert.ok(failed.ok);
  if (!failed.ok) return;
  const run = await runToEnd(session, store, failed.run.id);
  assert.equal(run.status, "error");
  assert.equal(run.error?.nodeType, "VAEDecode");
  assert.equal(run.error?.nodeId, "8");
  assert.match(run.error!.message, /Mock failure/);

  const slow = await mock({ stepMs: 60 });
  const second = stores();
  sessions.push(second.session);
  second.session.setConfig({ baseUrl: slow.url, headerName: "", remember: false });
  await second.session.connect();
  const a = await second.session.submit({ projectId: "p4", title: "A", prompt: promptOf(), workflow: wf() });
  const p2 = promptOf();
  (p2["3"].inputs as Record<string, unknown>).seed = 7;
  const b = await second.session.submit({ projectId: "p4", title: "B", prompt: p2, workflow: wf() });
  assert.ok(a.ok && b.ok);
  if (!a.ok || !b.ok) return;
  await until(() => second.session.state("p4").runs.find((r) => r.runId === a.run.id)?.status, (s) => s === "running");
  const queue = await second.session.queue();
  assert.deepEqual(queue.map((e) => e.state), ["running", "pending"]);
  await second.session.cancel(b.run.id);
  assert.equal(second.store.summary(b.run.id)!.status, "cancelled");
  await second.session.cancel(a.run.id);
  const interrupted = await runToEnd(second.session, second.store, a.run.id);
  assert.equal(interrupted.status, "interrupted");
});

test("uploads are forwarded to the server's input folder", async () => {
  const m = await mock();
  const { session } = stores();
  sessions.push(session);
  session.setConfig({ baseUrl: m.url, headerName: "", remember: false });
  const sent = await session.upload("photo.png", new Uint8Array([1, 2, 3, 4, 5]));
  assert.deepEqual(sent, { name: "photo.png", subfolder: "", type: "input" });
  assert.deepEqual(m.uploads, [{ name: "photo.png", bytes: 5 }]);
  const view = await session.view(new URLSearchParams({ filename: "photo.png", type: "input", subfolder: "" }));
  assert.equal(view.status, 200);
  assert.equal(view.bytes.length, 5);
});

test("run store keeps within its count and size limits", async () => {
  const { store } = stores();
  const p: ApiPrompt = { "1": { class_type: "SaveImage", inputs: {} } };
  for (let i = 0; i < 65; i++) {
    const r = store.create({ projectId: "big", promptId: "pid" + i, server: "s", title: "t" + i, prompt: p, workflow: wf() });
    store.setStatus(r.id, "success");
  }
  assert.equal(store.list("big").length, 60);
  const r = store.create({ projectId: "big", promptId: "x", server: "s", title: "t", prompt: p, workflow: wf() });
  assert.equal(store.addOutput(r.id, "big", { nodeId: "1", filename: "a.png", subfolder: "", kind: "output", mime: "image/png", width: 1, height: 1 }, new Uint8Array(33 * 1024 * 1024)), null);
});
