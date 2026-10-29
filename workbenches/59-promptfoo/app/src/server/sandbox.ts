// ABOUTME: javascript 断言、transform 与脚本 provider 的隔离执行：独立 worker + 无宿主对象的 vm 上下文。
// 上下文由 DONT_CONTEXTIFY 新建，禁止 eval/Function 字符串编译与 WebAssembly；输入以 JSON 文本传入、结果以 JSON 文本取回，
// 没有 require、process、文件或网络；同步死循环由 vm 超时终止，其余由主线程看门狗终止并重建 worker。
import { Worker } from "node:worker_threads";

export interface SandboxResult {
  ok: boolean;
  value?: unknown;
  error?: string;
}
export interface Sandbox {
  run(body: string, params: [string, string], args: [unknown, unknown], timeoutMs?: number): Promise<SandboxResult>;
  close(): Promise<void>;
}

const workerSource = String.raw`
const vm = require("node:vm");
const { parentPort } = require("node:worker_threads");
parentPort.on("message", (m) => {
  let reply;
  try {
    const ctx = vm.createContext(vm.constants.DONT_CONTEXTIFY, {
      codeGeneration: { strings: false, wasm: false },
      microtaskMode: "afterEvaluate",
    });
    const prelude = '"use strict";const console={log(){},info(){},warn(){},error(){},debug(){}};' +
      'const __in=JSON.parse(' + JSON.stringify(m.input) + ');' +
      'const __done=(v)=>{try{globalThis.__out=JSON.stringify({v:v===undefined?null:v,t:typeof v});}catch(e){globalThis.__out=JSON.stringify({e:"结果无法序列化："+String(e&&e.message||e)});}};' +
      'const __fail=(e)=>{globalThis.__out=JSON.stringify({e:String(e&&e.stack?String(e.stack).split("\\n").slice(0,3).join("\\n"):e)});};';
    const call = '(function(' + m.params.join(",") + '){\n' + m.body + '\n})(__in.a,__in.b)';
    const src = prelude + 'try{const __r=' + call + ';if(__r&&typeof __r.then==="function")__r.then(__done,__fail);else __done(__r);}catch(e){__fail(e);}';
    new vm.Script(src, { filename: "assertion.js" }).runInContext(ctx, { timeout: m.timeout, breakOnSigint: false });
    const d = Object.getOwnPropertyDescriptor(ctx, "__out");
    if (!d || !("value" in d) || typeof d.value !== "string") reply = { e: "函数没有在时限内返回结果（异步结果需在本轮微任务内完成）。" };
    else reply = JSON.parse(d.value);
  } catch (e) {
    const msg = String(e && e.message || e);
    reply = { e: /timed out/i.test(msg) ? "执行超时（" + m.timeout + " ms）。" : msg };
  }
  parentPort.postMessage({ id: m.id, reply });
});
`;

/** 与上游 buildFunctionBody 一致：单行表达式自动 return；多行按函数体执行。 */
export function functionBody(code: string): string {
  const trimmed = code.trimEnd();
  if (trimmed.includes("\n")) return trimmed;
  const t = trimmed.trim().replace(/;+\s*$/, "");
  if (/^(const|let|var)\s/.test(t)) {
    const last = lastStatementSemicolon(t);
    if (last !== -1 && t.slice(last + 1).trim()) return `${t.slice(0, last + 1)} return ${t.slice(last + 1).trim()}`;
    return t;
  }
  return `return ${t}`;
}
function lastStatementSemicolon(s: string) {
  let quote = "",
    depth = 0,
    last = -1;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (quote) {
      if (c === "\\") i++;
      else if (c === quote) quote = "";
    } else if (c === '"' || c === "'" || c === "`") quote = c;
    else if ("([{".includes(c)) depth++;
    else if (")]}".includes(c)) depth--;
    else if (c === ";" && depth === 0) last = i;
  }
  return last;
}

export function createSandbox(): Sandbox {
  let worker: Worker | null = null;
  let seq = 0;
  const pending = new Map<number, { resolve: (r: SandboxResult) => void; timer: ReturnType<typeof setTimeout> }>();
  let chain: Promise<unknown> = Promise.resolve();
  const spawn = () => {
    const w = new Worker(workerSource, {
      eval: true,
      env: {},
      argv: [],
      execArgv: [],
      stdout: true,
      stderr: true,
      resourceLimits: { maxOldGenerationSizeMb: 96, maxYoungGenerationSizeMb: 16, stackSizeMb: 4 },
    });
    w.unref();
    w.on("message", (m: { id: number; reply: { v?: unknown; t?: string; e?: string } }) => {
      const p = pending.get(m.id);
      if (!p) return;
      clearTimeout(p.timer);
      pending.delete(m.id);
      p.resolve(m.reply.e !== undefined ? { ok: false, error: m.reply.e } : { ok: true, value: m.reply.t === "undefined" ? undefined : m.reply.v });
    });
    const fail = (message: string) => {
      for (const [id, p] of pending) {
        clearTimeout(p.timer);
        p.resolve({ ok: false, error: message });
        pending.delete(id);
      }
      if (worker === w) worker = null;
    };
    w.on("error", (e) => fail(`沙箱已终止：${e instanceof Error ? e.message : String(e)}`));
    w.on("exit", () => fail("沙箱已终止（内存或时间超限）。"));
    return w;
  };
  function exec(body: string, params: [string, string], args: [unknown, unknown], timeoutMs: number) {
    return new Promise<SandboxResult>((resolve) => {
      let input: string;
      try {
        input = JSON.stringify({ a: args[0] ?? null, b: args[1] ?? null });
      } catch {
        resolve({ ok: false, error: "输入无法序列化。" });
        return;
      }
      if (input.length > 8_000_000) {
        resolve({ ok: false, error: "沙箱输入超过 8MB。" });
        return;
      }
      worker ??= spawn();
      const w = worker;
      const id = ++seq;
      const timer = setTimeout(() => {
        pending.delete(id);
        resolve({ ok: false, error: `执行超时（${timeoutMs} ms），沙箱已重建。` });
        if (worker === w) worker = null;
        void w.terminate();
      }, timeoutMs + 1500);
      pending.set(id, { resolve, timer });
      w.postMessage({ id, body, params, input, timeout: timeoutMs });
    });
  }
  return {
    run(body, params, args, timeoutMs = 1500) {
      const next = chain.then(() => exec(body, params, args, Math.min(10_000, Math.max(20, timeoutMs))));
      chain = next.catch(() => undefined);
      return next;
    },
    async close() {
      const w = worker;
      worker = null;
      if (w) await w.terminate();
    },
  };
}
