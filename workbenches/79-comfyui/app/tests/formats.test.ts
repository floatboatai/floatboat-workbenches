import { test } from "node:test";
import assert from "node:assert/strict";
import { deflateSync } from "node:zlib";
import { normaliseDefs } from "../src/contracts/comfy.ts";
import { embedPngText, asciiJson, readComfyPng, readPngText, pngSize, isPng, crc32 } from "../src/contracts/png.ts";
import { fromApiPrompt, looksLikePrompt, toApiPrompt, type ApiPrompt } from "../src/contracts/convert.ts";
import { buildTemplate, TEMPLATES } from "../src/contracts/templates.ts";
import { exportApiJson, exportUiJson, parseImport, parseImportText } from "../src/contracts/importer.ts";
import { validateWorkflow, problemsFromServer } from "../src/contracts/validate.ts";
import { connect, emptyWorkflow, type UiNode, type UiWorkflow } from "../src/contracts/workflow.ts";
import { encodePng } from "./support/mock-comfy.ts";
import { MINI_INFO } from "./support/mini-info.ts";

const defs = normaliseDefs(MINI_INFO);
const sample = () => buildTemplate("txt2img", defs);
const byType = (wf: UiWorkflow, type: string) => wf.nodes.find((n) => n.type === type)!;
const strip = (p: ApiPrompt) => Object.fromEntries(Object.entries(p).map(([k, v]) => [k, { class_type: v.class_type, inputs: v.inputs }]));
const png = () => Buffer.from(encodePng(8, 6, (x, y) => [x * 30, y * 40, 90]));

test("PNG text chunks: embed, read, replace and ASCII-escape", async () => {
  const base = new Uint8Array(png());
  assert.ok(isPng(base));
  assert.deepEqual(pngSize(base), { width: 8, height: 6 });
  const workflow = { nodes: [{ id: 1, type: "Note", widgets_values: ["雪夜 ☃"] }] };
  const out = embedPngText(base, { workflow: asciiJson(workflow), prompt: asciiJson({ "1": { class_type: "X", inputs: {} } }) });
  assert.deepEqual(pngSize(out), { width: 8, height: 6 });
  const meta = await readComfyPng(out);
  assert.deepEqual(meta.workflow, workflow);
  assert.deepEqual(Object.keys(meta.prompt as object), ["1"]);
  const again = embedPngText(out, { workflow: asciiJson({ nodes: [] }) });
  assert.deepEqual((await readComfyPng(again)).workflow, { nodes: [] });
  assert.equal(Object.keys(await readPngText(again)).filter((k) => k === "workflow").length, 1);
  assert.equal(crc32(new TextEncoder().encode("IEND")), 0xae426082);
  assert.throws(() => pngSize(new Uint8Array([1, 2, 3])), /PNG/);
});

test("PNG reader decodes zTXt and iTXt like other tools write them", async () => {
  const chunkOf = (type: string, body: Buffer) => {
    const head = Buffer.alloc(8);
    head.writeUInt32BE(body.length, 0);
    head.write(type, 4, "latin1");
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(Buffer.concat([head.subarray(4), body])));
    return Buffer.concat([head, body, crc]);
  };
  const base = png();
  const idat = base.indexOf("IDAT") - 4;
  const z = chunkOf("zTXt", Buffer.concat([Buffer.from("workflow\0\0", "latin1"), deflateSync(Buffer.from('{"nodes":[]}'))]));
  const i = chunkOf("iTXt", Buffer.concat([Buffer.from("prompt\0\0\0\0\0", "latin1"), Buffer.from('{"1":{"class_type":"A","inputs":{}}}', "utf8")]));
  const out = new Uint8Array(Buffer.concat([base.subarray(0, idat), z, i, base.subarray(idat)]));
  const meta = await readComfyPng(out);
  assert.deepEqual(meta.workflow, { nodes: [] });
  assert.deepEqual(meta.prompt, { "1": { class_type: "A", inputs: {} } });
});

test("node definitions: both combo encodings and widget layout", () => {
  assert.deepEqual(defs.ModernCombo.inputs[0].options, ["a", "b"]);
  assert.equal(defs.KSampler.inputs.find((i) => i.name === "sampler_name")!.type, "COMBO");
  const wf = sample();
  const ks = byType(wf, "KSampler");
  // seed is followed by its control widget
  assert.equal((ks.widgets_values as unknown[])[0], 156680208700286);
  assert.equal((ks.widgets_values as unknown[])[1], "randomize");
  assert.equal((ks.widgets_values as unknown[]).length, 7);
  assert.ok(ks.inputs!.find((i) => i.name === "seed")!.widget);
});

test("graph to API prompt reproduces the source prompt and survives a round trip", () => {
  const wf = sample();
  const { prompt } = toApiPrompt(wf, defs);
  const source = TEMPLATES[0].prompt;
  assert.deepEqual(strip(prompt), strip(source));
  assert.equal(prompt["6"]._meta?.title, "正向提示词");
  const back = fromApiPrompt(prompt, defs);
  assert.deepEqual(strip(toApiPrompt(back, defs).prompt), strip(source));
  assert.ok(back.nodes.every((n) => (n.size as number[]).length === 2));
});

test("bypass passes the matching input through; mute drops the node and its links", () => {
  const wf = buildTemplate("lora", { ...defs, ...normaliseDefs({ ...MINI_INFO }) });
  const lora = byType(wf, "LoraLoader");
  const known = toApiPrompt(wf, defs);
  assert.ok(known.prompt[String(lora.id)]);
  lora.mode = 4;
  const bypassed = toApiPrompt(wf, defs).prompt;
  assert.equal(bypassed[String(lora.id)], undefined);
  const sampler = Object.values(bypassed).find((n) => n.class_type === "KSampler")!;
  const ckpt = String(byType(wf, "CheckpointLoaderSimple").id);
  assert.deepEqual(sampler.inputs.model, [ckpt, 0]);
  const encoder = Object.values(bypassed).find((n) => n.class_type === "CLIPTextEncode")!;
  assert.deepEqual(encoder.inputs.clip, [ckpt, 1]);
  lora.mode = 2;
  const muted = toApiPrompt(wf, defs).prompt;
  assert.equal(muted[String(lora.id)], undefined);
  const mutedSampler = Object.values(muted).find((n) => n.class_type === "KSampler")!;
  assert.equal("model" in mutedSampler.inputs, false);
});

test("reroutes and primitive nodes are resolved, never emitted", () => {
  const wf = sample();
  const ks = byType(wf, "KSampler"), decode = byType(wf, "VAEDecode");
  // insert a reroute between the sampler and the decoder
  const linkId = decode.inputs!.find((i) => i.name === "samples")!.link!;
  const reroute: UiNode = { id: 90, type: "Reroute", pos: [0, 0], size: [75, 26], flags: {}, mode: 0, inputs: [{ name: "", type: "*", link: null }], outputs: [{ name: "", type: "LATENT", links: null }] };
  wf.nodes.push(reroute);
  wf.links = wf.links.filter((l) => (Array.isArray(l) ? l[0] : l.id) !== linkId);
  ks.outputs![0].links = [];
  decode.inputs!.find((i) => i.name === "samples")!.link = null;
  connect(wf, ks, 0, reroute, 0);
  connect(wf, reroute, 0, decode, 0);
  const prompt = toApiPrompt(wf, defs).prompt;
  assert.equal(prompt["90"], undefined);
  assert.deepEqual(prompt[String(decode.id)].inputs.samples, [String(ks.id), 0]);
  // primitive feeding the seed widget input
  const prim: UiNode = { id: 91, type: "PrimitiveNode", pos: [0, 0], size: [200, 60], flags: {}, mode: 0, outputs: [{ name: "INT", type: "INT", links: null, widget: { name: "seed" } } as never], widgets_values: [4242, "fixed"] };
  wf.nodes.push(prim);
  const seedSlot = ks.inputs!.findIndex((i) => i.name === "seed");
  connect(wf, prim, 0, ks, seedSlot);
  const withPrimitive = toApiPrompt(wf, defs).prompt;
  assert.equal(withPrimitive[String(ks.id)].inputs.seed, 4242);
  assert.equal(withPrimitive["91"], undefined);
});

test("validation: missing input, type mismatch, range, unknown node, no output", () => {
  const wf = sample();
  const ks = byType(wf, "KSampler");
  assert.deepEqual(validateWorkflow(wf, defs, { authoritativeCombos: false }).filter((p) => p.severity === "error"), []);
  // required socket removed
  const slot = ks.inputs!.find((i) => i.name === "negative")!;
  const gone = slot.link!;
  slot.link = null;
  wf.links = wf.links.filter((l) => (Array.isArray(l) ? l[0] : l.id) !== gone);
  let problems = validateWorkflow(wf, defs, { authoritativeCombos: false });
  assert.ok(problems.some((p) => p.code === "required_input_missing" && p.nodeId === String(ks.id) && p.input === "negative"));
  // type mismatch: connect a CLIP output to the MODEL input
  const ckpt = byType(wf, "CheckpointLoaderSimple");
  connect(wf, ckpt, 1, ks, ks.inputs!.findIndex((i) => i.name === "model"));
  problems = validateWorkflow(wf, defs, { authoritativeCombos: false });
  assert.ok(problems.some((p) => p.code === "type_mismatch" && p.input === "model"));
  // out of range
  (ks.widgets_values as unknown[])[2] = 0;
  assert.ok(validateWorkflow(wf, defs, { authoritativeCombos: false }).some((p) => p.code === "value_smaller_than_min" && p.input === "steps"));
  // unknown node
  wf.nodes.push({ id: 77, type: "SomeCustomNode", pos: [0, 0], size: [100, 50], flags: {}, mode: 0 });
  assert.ok(validateWorkflow(wf, defs, { authoritativeCombos: false }).some((p) => p.code === "missing_node" && p.nodeId === "77"));
  // muting the only output removes the executable output
  byType(wf, "SaveImage").mode = 2;
  assert.ok(validateWorkflow(wf, defs, { authoritativeCombos: false }).some((p) => p.code === "no_output"));
  assert.equal(validateWorkflow(emptyWorkflow(), defs, { authoritativeCombos: false })[0].code, "empty");
});

test("combo validation is only authoritative with server lists", () => {
  const wf = sample();
  byType(wf, "CheckpointLoaderSimple").widgets_values = ["not-installed.safetensors"];
  assert.equal(validateWorkflow(wf, defs, { authoritativeCombos: false }).filter((p) => p.severity === "error").length, 0);
  const problems = validateWorkflow(wf, defs, { authoritativeCombos: true });
  assert.ok(problems.some((p) => p.code === "value_not_in_list" && p.input === "ckpt_name"));
});

test("server node_errors map onto nodes and inputs", () => {
  const problems = problemsFromServer({
    error: { type: "prompt_outputs_failed_validation", message: "Prompt outputs failed validation", details: "x" },
    node_errors: { "3": { class_type: "KSampler", dependent_outputs: ["9"], errors: [{ type: "required_input_missing", message: "Required input is missing", details: "model", extra_info: { input_name: "model" } }] } },
  });
  assert.equal(problems.length, 2);
  assert.ok(problems.some((p) => p.nodeId === "3" && p.input === "model" && p.source === "server"));
});

test("import detects UI JSON, API JSON (also wrapped) and PNG metadata; export is idempotent", async () => {
  const wf = sample();
  const ui = exportUiJson(wf);
  const a = await parseImportText(ui, defs);
  assert.equal(a.kind, "ui");
  assert.equal(exportUiJson(a.workflow), ui);
  const api = exportApiJson(wf, defs).text;
  const b = await parseImportText(api, defs, "cabin_api.json");
  assert.equal(b.kind, "api");
  assert.equal(b.title, "cabin api");
  assert.deepEqual(strip(toApiPrompt(b.workflow, defs).prompt), strip(JSON.parse(api)));
  assert.equal((await parseImportText(JSON.stringify({ prompt: JSON.parse(api) }), defs)).kind, "api");
  const withWorkflow = embedPngText(new Uint8Array(png()), { workflow: asciiJson(wf), prompt: asciiJson(JSON.parse(api)) });
  const c = await parseImport({ name: "x.png", bytes: withWorkflow }, defs);
  assert.equal(c.kind, "png-ui");
  assert.equal(exportUiJson(c.workflow), ui);
  const onlyPrompt = embedPngText(new Uint8Array(png()), { prompt: asciiJson(JSON.parse(api)) });
  assert.equal((await parseImport({ name: "y.png", bytes: onlyPrompt }, defs)).kind, "png-api");
  await assert.rejects(parseImport({ name: "z.png", bytes: new Uint8Array(png()) }, defs), /元数据/);
  await assert.rejects(parseImportText("{not json", defs), /JSON/);
  await assert.rejects(parseImportText('{"hello":1}', defs), /无法识别/);
  assert.equal(looksLikePrompt({ nodes: [] }), null);
});

test("workflows with unknown node types import and keep their data", async () => {
  const src = {
    last_node_id: 2, last_link_id: 0, links: [], groups: [], config: {}, extra: {}, version: 0.4,
    nodes: [{ id: 2, type: "ImpactWildcardProcessor", pos: [10, 20], size: [300, 120], flags: {}, order: 0, mode: 0, widgets_values: ["a {b|c}", 1, "fixed"], properties: { x: 1 } }],
  };
  const r = await parseImportText(JSON.stringify(src), defs);
  assert.match(r.notes.join(" "), /ImpactWildcardProcessor/);
  assert.deepEqual(r.workflow.nodes[0].widgets_values, ["a {b|c}", 1, "fixed"]);
});

test("every template builds a connected graph with core node shapes", () => {
  for (const t of TEMPLATES) {
    const wf = buildTemplate(t.id, defs);
    assert.ok(wf.nodes.length >= 5, t.id);
    assert.ok(wf.links.length >= 4, t.id);
    assert.ok(wf.nodes.every((n) => Array.isArray(n.pos) && n.pos.every(Number.isFinite)), t.id);
  }
});
