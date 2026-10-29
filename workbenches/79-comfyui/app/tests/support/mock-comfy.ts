// ABOUTME: 按 ComfyUI 官方 API 行为编写的模拟服务（HTTP + WebSocket），用于测试与验收；输出生成的占位 PNG。

import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { createHash, randomUUID } from "node:crypto";
import { deflateSync } from "node:zlib";
import type { Duplex } from "node:stream";
import { crc32, embedPngText, asciiJson } from "../../src/contracts/png.ts";

type Json = Record<string, unknown>;
const isRec = (v: unknown): v is Json => typeof v === "object" && v !== null && !Array.isArray(v);

export interface MockOptions {
  port?: number;
  /** Raw /object_info body (as returned by ComfyUI). */
  objectInfo: Json;
  /** Milliseconds per sampler step. */
  stepMs?: number;
  /** Require this header on every request. */
  auth?: { header: string; value: string };
  /** Empty every combo whose options look like model files (like a fresh install). */
  emptyModels?: boolean;
  /** Serve the full model lists in /object_info but validate against empty ones (a stale client view). */
  staleModels?: boolean;
  /** Add a custom node to /object_info. */
  customNode?: boolean;
  /** Reject requests that carry a foreign Origin, like ComfyUI without --enable-cors-header. */
  enforceOrigin?: boolean;
  /** Raise a runtime error when this class_type executes. */
  failClass?: string;
}

export interface MockServer {
  url: string;
  port: number;
  prompts: Json[];
  uploads: { name: string; bytes: number }[];
  close(): Promise<void>;
}

// ---- PNG placeholders ------------------------------------------------------------------------
function chunk(type: string, data: Buffer): Buffer {
  const head = Buffer.alloc(8);
  head.writeUInt32BE(data.length, 0);
  head.write(type, 4, "ascii");
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([head.subarray(4), data])), 0);
  return Buffer.concat([head, data, crc]);
}
export function encodePng(width: number, height: number, rgb: (x: number, y: number) => [number, number, number]): Buffer {
  const raw = Buffer.alloc((width * 3 + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (width * 3 + 1)] = 0;
    for (let x = 0; x < width; x++) {
      const [r, g, b] = rgb(x, y);
      const o = y * (width * 3 + 1) + 1 + x * 3;
      raw[o] = r; raw[o + 1] = g; raw[o + 2] = b;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; ihdr[9] = 2;
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk("IHDR", ihdr), chunk("IDAT", deflateSync(raw)), chunk("IEND", Buffer.alloc(0))]);
}
function hash32(text: string): number {
  return createHash("sha1").update(text).digest().readUInt32BE(0);
}
/** Deterministic dusk-like gradient that varies with the sampling parameters. */
function placeholder(width: number, height: number, key: string): Buffer {
  const h = hash32(key);
  const hue = h % 360, hue2 = (hue + 40 + (h >>> 9) % 80) % 360;
  const hsl = (hh: number, s: number, l: number): [number, number, number] => {
    const a = s * Math.min(l, 1 - l);
    const f = (n: number) => { const k = (n + hh / 30) % 12; return Math.round(255 * (l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1)))); };
    return [f(0), f(8), f(4)];
  };
  const cx = ((h >>> 3) % 100) / 100, cy = 0.3 + (((h >>> 11) % 40) / 100);
  return encodePng(width, height, (x, y) => {
    const u = x / width, v = y / height;
    const d = Math.hypot(u - cx, v - cy);
    const mix = Math.min(1, d * 1.4);
    const a = hsl(hue, 0.55, 0.55 - 0.25 * v), b = hsl(hue2, 0.5, 0.12 + 0.1 * (1 - v));
    const stripe = ((x + y * 0.3 + (h % 17)) % 64) < 2 ? 14 : 0;
    return [0, 1, 2].map((i) => Math.max(0, Math.min(255, Math.round(a[i] * (1 - mix) + b[i] * mix) + stripe))) as [number, number, number];
  });
}

// ---- WebSocket framing (RFC 6455, server side) -----------------------------------------------
function frame(opcode: number, payload: Buffer): Buffer {
  const n = payload.length;
  const head = n < 126 ? Buffer.from([0x80 | opcode, n]) : n < 65536 ? Buffer.from([0x80 | opcode, 126, n >> 8, n & 255]) : (() => { const b = Buffer.alloc(10); b[0] = 0x80 | opcode; b[1] = 127; b.writeBigUInt64BE(BigInt(n), 2); return b; })();
  return Buffer.concat([head, payload]);
}
function readFrames(buffer: Buffer): { frames: { opcode: number; payload: Buffer }[]; rest: Buffer } {
  const frames: { opcode: number; payload: Buffer }[] = [];
  let at = 0;
  while (buffer.length - at >= 2) {
    const opcode = buffer[at] & 15;
    const masked = (buffer[at + 1] & 128) !== 0;
    let len = buffer[at + 1] & 127, off = at + 2;
    if (len === 126) { if (buffer.length - off < 2) break; len = buffer.readUInt16BE(off); off += 2; }
    else if (len === 127) { if (buffer.length - off < 8) break; len = Number(buffer.readBigUInt64BE(off)); off += 8; }
    const mask = masked ? buffer.subarray(off, off + 4) : null;
    if (masked) off += 4;
    if (buffer.length - off < len) break;
    const payload = Buffer.from(buffer.subarray(off, off + len));
    if (mask) for (let i = 0; i < payload.length; i++) payload[i] ^= mask[i & 3];
    frames.push({ opcode, payload });
    at = off + len;
  }
  return { frames, rest: buffer.subarray(at) };
}

// ---- server -------------------------------------------------------------------------------------
interface Job { number: number; id: string; prompt: Record<string, Json>; extra: Json; outputs: string[]; clientId: string }

export async function startMock(options: MockOptions): Promise<MockServer> {
  const objectInfo: Json = structuredClone(options.objectInfo);
  const emptyModelLists = (info: Json) => {
    for (const def of Object.values(info)) {
      const input = isRec(def) && isRec(def.input) ? def.input : {};
      for (const group of ["required", "optional"]) {
        const specs = isRec(input[group]) ? (input[group] as Json) : {};
        for (const spec of Object.values(specs))
          if (Array.isArray(spec) && Array.isArray(spec[0]) && spec[0].some((o) => typeof o === "string" && /\.(safetensors|ckpt|pth|pt)$/.test(o))) spec[0] = [];
      }
    }
  };
  if (options.emptyModels) emptyModelLists(objectInfo);
  const validationInfo: Json = options.staleModels ? structuredClone(objectInfo) : objectInfo;
  if (options.staleModels) emptyModelLists(validationInfo);
  if (options.customNode)
    objectInfo.FloatboatMockStamp = {
      input: { required: { image: ["IMAGE", {}], label: ["STRING", { default: "mock", multiline: false }] } },
      input_order: { required: ["image", "label"] },
      output: ["IMAGE"], output_is_list: [false], output_name: ["IMAGE"], name: "FloatboatMockStamp",
      display_name: "Mock Stamp (custom)", description: "Test-only custom node.", python_module: "custom_nodes.floatboat_mock",
      category: "mock/custom", output_node: false,
    };
  const defOf = (cls: string): Json | null => (isRec(validationInfo[cls]) ? (validationInfo[cls] as Json) : null);
  const files = new Map<string, Buffer>();
  const history = new Map<string, Json>();
  const queue: Job[] = [];
  let running: Job | null = null;
  let interrupted = false;
  let counter = 0, number = 0, saved = 0;
  const cache = new Map<string, unknown>();
  const sockets = new Map<string, Duplex>();
  const prompts: Json[] = [];
  const uploads: { name: string; bytes: number }[] = [];

  const send = (clientId: string | null, type: string, data: Json) => {
    const payload = Buffer.from(JSON.stringify({ type, data }));
    for (const [id, s] of sockets) if (!clientId || id === clientId || type === "status") if (!s.destroyed) s.write(frame(1, payload));
  };
  const broadcastStatus = () => send(null, "status", { status: { exec_info: { queue_remaining: queue.length + (running ? 1 : 0) } } });

  // validation, following execution.validate_inputs / validate_prompt
  function validate(prompt: Record<string, Json>): { ok: boolean; error?: Json; nodeErrors: Json; outputs: string[] } {
    const outputs: string[] = [];
    for (const [id, node] of Object.entries(prompt)) {
      if (!isRec(node) || typeof node.class_type !== "string") {
        const title = isRec(node) && isRec(node._meta) ? node._meta.title : undefined;
        return { ok: false, nodeErrors: {}, outputs, error: { type: "missing_node_type", message: `Node '${title || `ID #${id}`}' has no class_type. The workflow may be corrupted or a custom node is missing.`, details: `Node ID '#${id}'`, extra_info: { node_id: id, class_type: null, node_title: title ?? null } } };
      }
      const def = defOf(node.class_type);
      if (!def) {
        const title = isRec(node._meta) && typeof node._meta.title === "string" ? node._meta.title : node.class_type;
        return { ok: false, nodeErrors: {}, outputs, error: { type: "missing_node_type", message: `Node '${title}' not found. The custom node may not be installed.`, details: `Node ID '#${id}'`, extra_info: { node_id: id, class_type: node.class_type, node_title: title } } };
      }
      if (def.output_node === true) outputs.push(id);
    }
    if (!outputs.length) return { ok: false, nodeErrors: {}, outputs, error: { type: "prompt_no_outputs", message: "Prompt has no outputs", details: "", extra_info: {} } };
    const validated = new Map<string, Json[]>();
    const visiting: string[] = [];
    const check = (id: string): Json[] => {
      const known = validated.get(id);
      if (known) return known;
      if (visiting.includes(id)) return [{ type: "dependency_cycle", message: "Dependency cycle detected", details: visiting.join(" -> "), extra_info: { node_id: id } }];
      const node = prompt[id];
      const def = defOf(String(node.class_type))!;
      const inputs = isRec(node.inputs) ? node.inputs : {};
      const input = isRec(def.input) ? def.input : {};
      const errors: Json[] = [];
      visiting.push(id);
      for (const group of ["required", "optional"] as const) {
        const specs = isRec(input[group]) ? (input[group] as Json) : {};
        for (const [name, spec] of Object.entries(specs)) {
          const kind = Array.isArray(spec) ? spec[0] : null;
          const cfg = Array.isArray(spec) && isRec(spec[1]) ? spec[1] : {};
          const info = [kind, cfg];
          if (!(name in inputs)) {
            if (group === "required") errors.push({ type: "required_input_missing", message: "Required input is missing", details: name, extra_info: { input_name: name } });
            continue;
          }
          const val = inputs[name];
          if (Array.isArray(val)) {
            if (val.length !== 2) { errors.push({ type: "bad_linked_input", message: "Bad linked input, must be a length-2 list of [node_id, slot_index]", details: name, extra_info: { input_name: name, input_config: info, received_value: val } }); continue; }
            const source = prompt[String(val[0])];
            const sdef = source ? defOf(String(source.class_type)) : null;
            const outs = sdef && Array.isArray(sdef.output) ? sdef.output : [];
            const received = Array.isArray(outs[Number(val[1])]) ? "COMBO" : outs[Number(val[1])];
            if (!source || received === undefined) { errors.push({ type: "bad_linked_input", message: "Bad linked input, must be a length-2 list of [node_id, slot_index]", details: name, extra_info: { input_name: name, input_config: info, received_value: val } }); continue; }
            const want = Array.isArray(kind) ? "COMBO" : String(kind);
            if (received !== "*" && want !== "*" && !String(want).split(",").some((t) => String(received).split(",").includes(t))) {
              errors.push({ type: "return_type_mismatch", message: "Return type mismatch between linked nodes", details: `${name}, received_type(${received}) mismatch input_type(${want})`, extra_info: { input_name: name, input_config: info, received_type: received, linked_node: val } });
              continue;
            }
            const upstream = check(String(val[0]));
            if (upstream.length) continue;
          } else {
            let v: unknown = val;
            try {
              if (kind === "INT") { if (Number.isNaN(Number(v)) || (typeof v === "string" && !/^\s*-?\d+\s*$/.test(v)) || (typeof v === "number" && !Number.isInteger(Math.trunc(v)))) throw new Error(`invalid literal for int() with base 10: '${String(v)}'`); v = Math.trunc(Number(v)); inputs[name] = v; }
              if (kind === "FLOAT") { if (Number.isNaN(Number(v))) throw new Error(`could not convert string to float: '${String(v)}'`); v = Number(v); inputs[name] = v; }
              if (kind === "STRING") { v = String(v); inputs[name] = v; }
              if (kind === "BOOLEAN") { v = Boolean(v); inputs[name] = v; }
            } catch (ex) {
              errors.push({ type: "invalid_input_type", message: `Failed to convert an input value to a ${String(kind)} value`, details: `${name}, ${String(val)}, ${(ex as Error).message}`, extra_info: { input_name: name, input_config: info, received_value: val, exception_message: (ex as Error).message } });
              continue;
            }
            if (typeof cfg.min === "number" && typeof v === "number" && v < cfg.min) { errors.push({ type: "value_smaller_than_min", message: `Value ${v} smaller than min of ${cfg.min}`, details: name, extra_info: { input_name: name, input_config: info, received_value: v } }); continue; }
            if (typeof cfg.max === "number" && typeof v === "number" && v > cfg.max) { errors.push({ type: "value_bigger_than_max", message: `Value ${v} bigger than max of ${cfg.max}`, details: name, extra_info: { input_name: name, input_config: info, received_value: v } }); continue; }
            if (Array.isArray(kind) && !kind.includes(v)) {
              const list = kind.length > 20 ? `(list of length ${kind.length})` : `[${kind.map((o) => `'${String(o)}'`).join(", ")}]`;
              errors.push({ type: "value_not_in_list", message: "Value not in list", details: `${name}: '${String(v)}' not in ${list}`, extra_info: { input_name: name, input_config: kind.length > 20 ? null : info, received_value: v } });
            }
          }
        }
      }
      visiting.pop();
      validated.set(id, errors);
      return errors;
    };
    const good: string[] = [];
    const nodeErrors: Json = {};
    const reasons: string[] = [];
    for (const out of outputs) {
      const errs = check(out);
      // an upstream failure leaves the output invalid even if the output node itself has none
      const failed = [...validated.entries()].filter(([, e]) => e.length);
      const reaches = (id: string, target: string, seen = new Set<string>()): boolean => {
        if (id === target) return true;
        if (seen.has(id)) return false;
        seen.add(id);
        const ins = isRec(prompt[id]?.inputs) ? (prompt[id].inputs as Json) : {};
        return Object.values(ins).some((v) => Array.isArray(v) && v.length === 2 && reaches(String(v[0]), target, seen));
      };
      const bad = errs.length > 0 || failed.some(([id]) => reaches(out, id));
      if (!bad) good.push(out);
      else {
        for (const [id, e] of failed) {
          if (!e.length || !reaches(out, id)) continue;
          const entry = (nodeErrors[id] ??= { errors: e, dependent_outputs: [], class_type: prompt[id].class_type }) as Json;
          (entry.dependent_outputs as string[]).push(out);
        }
        for (const x of errs) reasons.push(`${String(x.message)}: ${String(x.details)}`);
      }
    }
    if (!good.length) return { ok: false, nodeErrors, outputs, error: { type: "prompt_outputs_failed_validation", message: "Prompt outputs failed validation", details: reasons.join("\n"), extra_info: {} } };
    return { ok: true, nodeErrors, outputs: good };
  }

  // execution
  const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
  async function execute(job: Job): Promise<void> {
    const { prompt, id } = job;
    const needed = new Set<string>();
    const order: string[] = [];
    const visit = (nid: string) => {
      if (needed.has(nid)) return;
      needed.add(nid);
      const ins = isRec(prompt[nid].inputs) ? (prompt[nid].inputs as Json) : {};
      for (const v of Object.values(ins)) if (Array.isArray(v) && v.length === 2) visit(String(v[0]));
      order.push(nid);
    };
    for (const o of job.outputs) visit(o);
    const sig = new Map<string, string>();
    const signature = (nid: string): string => {
      if (sig.has(nid)) return sig.get(nid)!;
      const node = prompt[nid];
      const ins = isRec(node.inputs) ? (node.inputs as Json) : {};
      const parts = Object.keys(ins).sort().map((k) => { const v = ins[k]; return `${k}=${Array.isArray(v) && v.length === 2 ? `${signature(String(v[0]))}#${String(v[1])}` : JSON.stringify(v)}`; });
      const s = createHash("sha1").update(`${String(node.class_type)}|${parts.join("|")}`).digest("hex");
      sig.set(nid, s);
      return s;
    };
    const isOutput = (nid: string) => defOf(String(prompt[nid].class_type))?.output_node === true;
    const cached = order.filter((nid) => cache.has(signature(nid)));
    const states: Record<string, Json> = {};
    const emitStates = (nid: string, value: number, max: number, state: "running" | "finished") => {
      states[nid] = { value, max, state, node_id: nid, prompt_id: id, display_node_id: nid, parent_node_id: null, real_node_id: nid };
      send(job.clientId, "progress_state", { prompt_id: id, nodes: states });
    };
    send(job.clientId, "execution_start", { prompt_id: id, timestamp: Date.now() });
    send(job.clientId, "execution_cached", { nodes: cached, prompt_id: id, timestamp: Date.now() });
    const messages: unknown[] = [["execution_start", { prompt_id: id, timestamp: Date.now() }], ["execution_cached", { nodes: cached, prompt_id: id, timestamp: Date.now() }]];
    const outputs: Json = {};
    const values = new Map<string, Json>();
    for (const nid of order) {
      const node = prompt[nid];
      const ins = isRec(node.inputs) ? (node.inputs as Json) : {};
      const cls = String(node.class_type);
      const fromCache = cached.includes(nid);
      if (fromCache) {
        const hit = cache.get(signature(nid)) as Json;
        values.set(nid, hit);
        if (isOutput(nid) && isRec(hit.ui)) {
          outputs[nid] = hit.ui;
          send(job.clientId, "executed", { node: nid, display_node: nid, output: hit.ui, prompt_id: id });
          messages.push(["executed", { node: nid, display_node: nid, output: hit.ui, prompt_id: id }]);
        }
        continue;
      }
      send(job.clientId, "executing", { node: nid, display_node: nid, prompt_id: id });
      emitStates(nid, 0, 1, "running");
      if (interrupted) throw Object.assign(new Error("interrupted"), { interrupted: true, node: nid });
      if (options.failClass && cls === options.failClass) {
        const err = { prompt_id: id, node_id: nid, node_type: cls, executed: [...values.keys()], exception_message: "Mock failure: out of memory while executing " + cls, exception_type: "torch.OutOfMemoryError", traceback: ["Traceback (most recent call last):\n  mock\n"], current_inputs: {}, current_outputs: [] };
        send(job.clientId, "execution_error", { ...err, timestamp: Date.now() });
        throw Object.assign(new Error("failed"), { reported: true, err });
      }
      const resolve = (v: unknown): unknown => (Array.isArray(v) && v.length === 2 ? (values.get(String(v[0])) ?? {}) : v);
      const out: Json = { class_type: cls };
      const gather = (n: string): Json => ({ ...(values.get(n) ?? {}) });
      if (cls === "EmptyLatentImage") Object.assign(out, { width: Number(ins.width), height: Number(ins.height) });
      else if (cls === "KSampler" || cls === "KSamplerAdvanced") {
        const steps = Math.max(1, Number(ins.steps ?? 1));
        for (let s = 1; s <= steps; s++) {
          if (interrupted) throw Object.assign(new Error("interrupted"), { interrupted: true, node: nid });
          await sleep(options.stepMs ?? 5);
          send(job.clientId, "progress", { value: s, max: steps, prompt_id: id, node: nid });
          emitStates(nid, s, steps, "running");
        }
        const latent = resolve(ins.latent_image) as Json;
        const pos = resolve(ins.positive) as Json;
        Object.assign(out, { width: latent.width ?? 512, height: latent.height ?? 512, key: `${String(ins.seed ?? ins.noise_seed)}|${steps}|${String(ins.cfg)}|${String(ins.sampler_name)}|${String(ins.denoise)}|${String(pos.text ?? "")}` });
      } else if (cls === "CLIPTextEncode") Object.assign(out, { text: String(ins.text ?? "") });
      else if (cls === "VAEDecode") Object.assign(out, gather(String(Array.isArray(ins.samples) ? ins.samples[0] : "")));
      else if (cls === "LoadImage") Object.assign(out, { width: 512, height: 512, key: `load:${String(ins.image)}` });
      else if (Array.isArray(ins.images) || Array.isArray(ins.image)) Object.assign(out, gather(String((ins.images ?? ins.image as unknown[])[0] as string)));
      values.set(nid, out);
      if (!isOutput(nid)) cache.set(signature(nid), out);
      emitStates(nid, 1, 1, "finished");
      if (isOutput(nid)) {
        const src = (Array.isArray(ins.images) ? values.get(String(ins.images[0])) : undefined) ?? out;
        const w = Math.min(Number(src.width ?? 512), 512), h = Math.min(Number(src.height ?? 512), 512);
        const scale = Math.min(1, 512 / Math.max(Number(src.width ?? 512), Number(src.height ?? 512)));
        let png = placeholder(Math.max(16, Math.round(Number(src.width ?? 512) * scale)), Math.max(16, Math.round(Number(src.height ?? 512) * scale)), String(src.key ?? nid));
        void w; void h;
        const kind = cls === "PreviewImage" ? "temp" : "output";
        if (kind === "output") {
          const extraInfo = isRec(job.extra.extra_pnginfo) ? job.extra.extra_pnginfo : {};
          png = Buffer.from(embedPngText(png, { prompt: asciiJson(prompt), ...(extraInfo.workflow ? { workflow: asciiJson(extraInfo.workflow) } : {}) }));
        }
        const prefix = String(ins.filename_prefix ?? "ComfyUI").replace(/[^\w-]/g, "_");
        const filename = kind === "temp" ? `ComfyUI_temp_${randomUUID().slice(0, 5)}_${String(++saved).padStart(5, "0")}_.png` : `${prefix}_${String(++counter).padStart(5, "0")}_.png`;
        files.set(`${kind}//${filename}`, png);
        const images = [{ filename, subfolder: "", type: kind, metadata: { kind: "image", width: Math.max(16, Math.round(Number(src.width ?? 512) * scale)), height: Math.max(16, Math.round(Number(src.height ?? 512) * scale)) } }];
        outputs[nid] = { images };
        cache.set(signature(nid), { ...out, ui: { images } });
        send(job.clientId, "executed", { node: nid, display_node: nid, output: { images }, prompt_id: id });
        messages.push(["executed", { node: nid, display_node: nid, output: { images }, prompt_id: id }]);
      }
    }
    history.set(id, { prompt: [job.number, id, prompt, job.extra, job.outputs], outputs, status: { status_str: "success", completed: true, messages: [...messages, ["execution_success", { prompt_id: id, timestamp: Date.now() }]] }, meta: Object.fromEntries(Object.keys(outputs).map((n) => [n, { node_id: n, display_node: n, parent_node: null, real_node_id: n }])) });
    send(job.clientId, "execution_success", { prompt_id: id, timestamp: Date.now() });
  }

  let pumping = false;
  async function pump() {
    if (pumping) return;
    pumping = true;
    try {
      while (queue.length) {
        const job = queue.shift()!;
        running = job;
        interrupted = false;
        broadcastStatus();
        try {
          await execute(job);
        } catch (e) {
          const info = e as { interrupted?: boolean; reported?: boolean; node?: string; err?: Json };
          if (info.interrupted) {
            send(job.clientId, "execution_interrupted", { prompt_id: job.id, node_id: info.node ?? null, node_type: info.node ? job.prompt[info.node].class_type : null, executed: [], timestamp: Date.now() });
            history.set(job.id, { prompt: [job.number, job.id, job.prompt, job.extra, job.outputs], outputs: {}, status: { status_str: "error", completed: false, messages: [["execution_interrupted", { prompt_id: job.id }]] }, meta: {} });
          } else if (info.reported) {
            history.set(job.id, { prompt: [job.number, job.id, job.prompt, job.extra, job.outputs], outputs: {}, status: { status_str: "error", completed: false, messages: [["execution_error", info.err ?? {}]] }, meta: {} });
          } else throw e;
        }
        running = null;
        broadcastStatus();
      }
    } finally {
      pumping = false;
    }
  }

  // ---- HTTP ------------------------------------------------------------------------------------
  const json = (res: ServerResponse, body: unknown, status = 200) => {
    const data = Buffer.from(JSON.stringify(body));
    res.writeHead(status, { "content-type": "application/json; charset=utf-8", "content-length": data.length });
    res.end(data);
  };
  const readBody = (req: IncomingMessage): Promise<Buffer> => new Promise((resolve) => { const parts: Buffer[] = []; req.on("data", (c: Buffer) => parts.push(c)); req.on("end", () => resolve(Buffer.concat(parts))); });
  function forbidden(req: IncomingMessage): boolean {
    if (options.auth && req.headers[options.auth.header.toLowerCase()] !== options.auth.value) return true;
    return false;
  }
  function originBlocked(req: IncomingMessage): boolean {
    if (options.enforceOrigin === false) return false;
    const origin = req.headers.origin, host = req.headers.host;
    if (!origin || !host) return false;
    try { return new URL(origin).host !== host; } catch { return true; }
  }

  const server = createServer(async (req, res) => {
    const url = new URL(req.url ?? "/", "http://mock");
    const path = url.pathname.replace(/^\/api(?=\/)/, "");
    if (originBlocked(req)) return json(res, { error: "forbidden origin" }, 403);
    if (forbidden(req)) return json(res, { error: "unauthorized" }, 401);
    const method = req.method ?? "GET";
    if (method === "GET" && path === "/system_stats")
      return json(res, { system: { os: "posix", ram_total: 17179869184, ram_free: 8589934592, comfyui_version: "mock-0.43.0", python_version: "3.12.0", pytorch_version: "2.x", embedded_python: false, argv: ["main.py", "--cpu"] }, devices: [{ name: "cpu", type: "cpu", index: 0, vram_total: 17179869184, vram_free: 8589934592, torch_vram_total: 0, torch_vram_free: 0 }] });
    if (method === "GET" && path === "/object_info") return json(res, objectInfo);
    const single = /^\/object_info\/([^/]+)$/.exec(path);
    if (method === "GET" && single) { const d = defOf(decodeURIComponent(single[1])); return json(res, d ? { [decodeURIComponent(single[1])]: d } : {}); }
    if (method === "GET" && path === "/queue")
      return json(res, { queue_running: running ? [[running.number, running.id, running.prompt, running.extra, running.outputs]] : [], queue_pending: queue.map((j) => [j.number, j.id, j.prompt, j.extra, j.outputs]) });
    if (method === "POST" && path === "/queue") {
      const body = JSON.parse((await readBody(req)).toString() || "{}") as Json;
      if (body.clear) queue.length = 0;
      if (Array.isArray(body.delete)) for (const id of body.delete) { const i = queue.findIndex((j) => j.id === id); if (i >= 0) queue.splice(i, 1); }
      broadcastStatus();
      res.writeHead(200); return res.end();
    }
    if (method === "POST" && path === "/interrupt") { if (running) interrupted = true; res.writeHead(200); return res.end(); }
    if (method === "GET" && path === "/history") {
      const max = Number(url.searchParams.get("max_items") ?? "0") || Infinity;
      return json(res, Object.fromEntries([...history.entries()].slice(-max)));
    }
    const hist = /^\/history\/([^/]+)$/.exec(path);
    if (method === "GET" && hist) return json(res, history.has(hist[1]) ? { [hist[1]]: history.get(hist[1]) } : {});
    if (method === "GET" && path === "/view") {
      const filename = url.searchParams.get("filename") ?? "", type = url.searchParams.get("type") ?? "output", sub = url.searchParams.get("subfolder") ?? "";
      const data = files.get(`${type}/${sub}/${filename}`);
      if (!data) { res.writeHead(404); return res.end(); }
      res.writeHead(200, { "content-type": "image/png", "content-length": data.length });
      return res.end(data);
    }
    if (method === "POST" && path === "/upload/image") {
      const body = await readBody(req);
      const type = String(req.headers["content-type"] ?? "");
      const boundary = /boundary=(.+)$/.exec(type)?.[1];
      if (!boundary) return json(res, { error: "bad multipart" }, 400);
      const text = body.toString("latin1");
      const nameMatch = /name="image"; filename="([^"]+)"/.exec(text);
      if (!nameMatch) return json(res, { error: "no image" }, 400);
      const start = body.indexOf("\r\n\r\n", body.indexOf(nameMatch[0])) + 4;
      const end = body.indexOf("\r\n--" + boundary, start);
      const data = body.subarray(start, end);
      files.set(`input//${nameMatch[1]}`, Buffer.from(data));
      uploads.push({ name: nameMatch[1], bytes: data.length });
      return json(res, { name: nameMatch[1], subfolder: "", type: "input" });
    }
    if (method === "POST" && path === "/prompt") {
      let body: Json;
      try { body = JSON.parse((await readBody(req)).toString()) as Json; } catch { return json(res, { error: { type: "invalid_json", message: "Invalid JSON", details: "", extra_info: {} }, node_errors: {} }, 400); }
      prompts.push(body);
      if (!isRec(body.prompt)) return json(res, { error: { type: "no_prompt", message: "No prompt provided", details: "No prompt provided", extra_info: {} }, node_errors: {} }, 400);
      const prompt = body.prompt as Record<string, Json>;
      const result = validate(prompt);
      if (!result.ok) return json(res, { error: result.error, node_errors: result.nodeErrors }, 400);
      const id = randomUUID();
      const extra: Json = isRec(body.extra_data) ? { ...body.extra_data } : {};
      if (typeof body.client_id === "string") extra.client_id = body.client_id;
      queue.push({ number: number++, id, prompt, extra, outputs: result.outputs, clientId: typeof body.client_id === "string" ? body.client_id : "" });
      broadcastStatus();
      void pump();
      return json(res, { prompt_id: id, number: number - 1, node_errors: result.nodeErrors });
    }
    res.writeHead(404); res.end();
  });
  server.on("upgrade", (req, socket) => {
    const url = new URL(req.url ?? "/", "http://mock");
    if (!/^(\/api)?\/ws$/.test(url.pathname) || originBlocked(req) || forbidden(req)) { socket.write("HTTP/1.1 403 Forbidden\r\n\r\n"); socket.destroy(); return; }
    const key = req.headers["sec-websocket-key"];
    if (typeof key !== "string") { socket.destroy(); return; }
    const accept = createHash("sha1").update(key + "258EAFA5-E914-47DA-95CA-C5AB0DC85B11").digest("base64");
    socket.write(`HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: ${accept}\r\n\r\n`);
    const clientId = url.searchParams.get("clientId") ?? randomUUID();
    sockets.set(clientId, socket);
    socket.write(frame(1, Buffer.from(JSON.stringify({ type: "status", data: { status: { exec_info: { queue_remaining: queue.length + (running ? 1 : 0) } }, sid: clientId } }))));
    let pending: Buffer = Buffer.alloc(0);
    socket.on("data", (data: Buffer) => {
      pending = Buffer.concat([pending, data]);
      const parsed = readFrames(pending);
      pending = Buffer.from(parsed.rest);
      for (const f of parsed.frames) {
        if (f.opcode === 8) { socket.end(frame(8, Buffer.alloc(0))); }
        else if (f.opcode === 9) socket.write(frame(10, f.payload));
      }
    });
    socket.on("close", () => { if (sockets.get(clientId) === socket) sockets.delete(clientId); });
    socket.on("error", () => {});
  });

  await new Promise<void>((resolve) => server.listen(options.port ?? 0, "127.0.0.1", resolve));
  const address = server.address();
  const port = typeof address === "object" && address ? address.port : 0;
  return {
    url: `http://127.0.0.1:${port}`,
    port,
    prompts,
    uploads,
    close: () => new Promise<void>((resolve) => { for (const s of sockets.values()) s.destroy(); server.close(() => resolve()); server.closeAllConnections?.(); }),
  };
}
