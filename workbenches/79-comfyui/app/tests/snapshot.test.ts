import { test, after } from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { readFileSync } from "node:fs";
import { coreDefs, coreSnapshotMeta } from "../src/contracts/core-nodes.ts";
import { CORE_OBJECT_INFO_JSON } from "../src/contracts/core-nodes-data.ts";
import { widgetLayout } from "../src/contracts/comfy.ts";
import { toApiPrompt } from "../src/contracts/convert.ts";
import { buildTemplate, TEMPLATES } from "../src/contracts/templates.ts";
import { validateWorkflow } from "../src/contracts/validate.ts";
import { exportUiJson, parseImportText } from "../src/contracts/importer.ts";
import { isFinished } from "../src/contracts/run.ts";
import { createRunStore } from "../src/server/runs.ts";
import { createSession } from "../src/server/comfy-session.ts";
import { startMock, type MockServer } from "./support/mock-comfy.ts";

const defs = coreDefs();
const mocks: MockServer[] = [];
const sessions: ReturnType<typeof createSession>[] = [];
after(async () => {
  for (const s of sessions) s.shutdown();
  for (const m of mocks) await m.close();
});

test("bundled snapshot is real ComfyUI core metadata", () => {
  assert.ok(Object.keys(defs).length >= 150);
  assert.match(coreSnapshotMeta.version, /^v\d+\.\d+\.\d+ \([0-9a-f]{40}\)$/);
  for (const name of ["KSampler", "CheckpointLoaderSimple", "CLIPTextEncode", "SaveImage", "LoadImage", "VAEDecode", "ControlNetApplyAdvanced", "VAEEncodeForInpaint", "UpscaleModelLoader", "ImageUpscaleWithModel"])
    assert.ok(defs[name], name);
  assert.equal(defs.SaveImage.output_node, true);
  const ks = widgetLayout(defs.KSampler).map((w) => w.name);
  assert.deepEqual(ks, ["seed", "control_after_generate", "steps", "cfg", "sampler_name", "scheduler", "denoise"]);
  assert.ok(defs.KSampler.inputs.find((i) => i.name === "sampler_name")!.options!.includes("dpmpp_2m"));
  // interface metadata only: no code, no weights
  const allowed = new Set(["input", "input_order", "output", "output_is_list", "output_name", "output_tooltips", "name", "display_name", "description", "python_module", "category", "output_node", "deprecated", "experimental", "search_aliases", "essentials_category", "has_intermediate_output", "is_input_list", "output_matchtypes", "price_badge", "dev_only", "api_node"]);
  for (const [name, entry] of Object.entries(JSON.parse(CORE_OBJECT_INFO_JSON) as Record<string, Record<string, unknown>>))
    for (const key of Object.keys(entry)) assert.ok(allowed.has(key), `${name}.${key}`);
});

test("every template builds from core nodes, validates and exports", async () => {
  for (const t of TEMPLATES) {
    const wf = buildTemplate(t.id, defs);
    const unknown = wf.nodes.filter((n) => !defs[n.type]);
    assert.deepEqual(unknown, [], t.id);
    const errors = validateWorkflow(wf, defs, { authoritativeCombos: false }).filter((p) => p.severity === "error");
    assert.deepEqual(errors, [], t.id + ": " + errors.map((e) => e.message).join("; "));
    const api = toApiPrompt(wf, defs).prompt;
    assert.ok(Object.keys(api).length >= 5, t.id);
    const again = await parseImportText(exportUiJson(wf), defs);
    assert.equal(exportUiJson(again.workflow), exportUiJson(wf), t.id + " UI JSON is stable");
  }
});

test("every template runs against the mock server and produces an image", async () => {
  const mock = await startMock({ objectInfo: JSON.parse(CORE_OBJECT_INFO_JSON), stepMs: 1 });
  mocks.push(mock);
  const db = new DatabaseSync(":memory:");
  db.exec(readFileSync(new URL("../migrations/0004_comfy_runs.sql", import.meta.url), "utf8"));
  const store = createRunStore(db);
  const session = createSession(store, { pollMs: 60 });
  sessions.push(session);
  session.setConfig({ baseUrl: mock.url, headerName: "", remember: false });
  const { status } = await session.connect();
  assert.ok(status.nodeCount >= 150);
  for (const t of TEMPLATES) {
    const wf = buildTemplate(t.id, defs, true);
    const result = await session.submit({ projectId: "tpl", title: t.title, prompt: toApiPrompt(wf, defs).prompt, workflow: wf });
    assert.ok(result.ok, t.id + ": " + (result.ok ? "" : result.message));
    if (!result.ok) continue;
    const end = Date.now() + 8000;
    let run = store.summary(result.run.id)!;
    while (!isFinished(run.status) && Date.now() < end) {
      await new Promise((r) => setTimeout(r, 40));
      run = store.summary(result.run.id)!;
    }
    assert.equal(run.status, "success", t.id);
    assert.ok(run.outputs.length >= 1, t.id);
  }
});
