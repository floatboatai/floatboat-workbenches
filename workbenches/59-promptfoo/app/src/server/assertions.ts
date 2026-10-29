// ABOUTME: Promptfoo 确定性断言在 Node 内的实现（语义按 promptfoo 0.125.1 逐项移植）与加权聚合。
import { isDeepStrictEqual } from "node:util";
import AjvModule from "ajv";
import formatsModule from "ajv-formats";
import { distance } from "fastest-levenshtein";
import { treeBankTokenize, nGram, fMeasure } from "js-rouge";
import { parse as parseYaml } from "yaml";
import { baseType, isLocalAssertion, type Assertion, type ProviderDef, type TestCase } from "../contracts/config.ts";
import { renderTemplate } from "../contracts/template.ts";
import { functionBody, type Sandbox } from "./sandbox.ts";

export interface GradingResult {
  pass: boolean;
  score: number;
  reason: string;
  assertion?: Assertion;
  metadata?: Record<string, unknown>;
  componentResults?: GradingResult[];
  namedScores?: Record<string, number>;
}
export interface AssertContext {
  prompt: string;
  promptLabel: string;
  vars: Record<string, unknown>;
  test: TestCase;
  provider: ProviderDef;
  latencyMs?: number;
  cost?: number;
  finishReason?: string;
  sandbox: Sandbox;
  timeoutMs?: number;
}
export class AssertionConfigError extends Error {}
export class TransformError extends Error {}
function invariant(cond: unknown, message: string): asserts cond {
  if (!cond) throw new AssertionConfigError(message);
}

type AjvCtor = new (o: Record<string, unknown>) => {
  compile(s: unknown): ((d: unknown) => boolean) & { errors?: unknown };
  errorsText(e: unknown): string;
  addKeyword(k: unknown): void;
};
const Ajv = ((AjvModule as unknown as { default?: AjvCtor }).default ?? AjvModule) as unknown as AjvCtor;
const addFormats = ((formatsModule as unknown as { default?: (a: unknown) => void }).default ?? formatsModule) as unknown as (a: unknown) => void;
let ajvInstance: InstanceType<AjvCtor> | null = null;
function ajv() {
  if (!ajvInstance) {
    ajvInstance = new Ajv({ strictSchema: true });
    addFormats(ajvInstance);
    ajvInstance.addKeyword({ keyword: ["property_ordering", "propertyOrdering"], valid: true });
  }
  return ajvInstance;
}
const schemaCache = new Map<string, ReturnType<InstanceType<AjvCtor>["compile"]>>();
function compileSchema(schema: unknown) {
  const key = JSON.stringify(schema);
  let v = schemaCache.get(key);
  if (!v) {
    try {
      v = ajv().compile(schema);
    } catch (e) {
      throw new AssertionConfigError(`JSON Schema 无效：${e instanceof Error ? e.message : String(e)}`);
    }
    if (schemaCache.size > 200) schemaCache.clear();
    schemaCache.set(key, v);
  }
  return v;
}

export const coerceString = (v: unknown) => (typeof v === "string" ? v : JSON.stringify(v) ?? "");

export function parseCommaSeparatedValues(value: string): string[] {
  const results: string[] = [];
  let i = 0;
  while (i < value.length) {
    while (i < value.length) {
      while (i < value.length && /\s/.test(value[i])) i++;
      if (value[i] !== ",") break;
      i++;
    }
    if (i >= value.length) break;
    const quoted = value[i] === '"';
    let field = "";
    if (quoted) {
      i++;
      let terminated = false;
      while (i < value.length)
        if (value[i] === "\\" && i + 1 < value.length && ['"', "\\"].includes(value[i + 1])) {
          field += value[i + 1];
          i += 2;
        } else if (value[i] === '"' && value[i + 1] === '"') {
          field += '"';
          i += 2;
        } else if (value[i] === '"') {
          i++;
          terminated = true;
          break;
        } else field += value[i++];
      invariant(terminated, "contains 断言值中的引号没有闭合。");
    } else {
      const start = i,
        comma = value.indexOf(",", i);
      i = comma === -1 ? value.length : comma;
      field = value.substring(start, i).trim();
    }
    results.push(field);
    while (i < value.length && /\s/.test(value[i])) i++;
    invariant(!(quoted && i < value.length && value[i] !== ","), "contains 断言值中引号字段后需要逗号。");
  }
  return results;
}

/** 在文本中找出 JSON 对象（与上游一致：整体解析优先，再按大括号逐段尝试，宽松段落用 YAML/JSON 兼容解析）。 */
export function extractJsonObjects(str: string): unknown[] {
  const out: unknown[] = [];
  if (str.length <= 100_000)
    try {
      const v = JSON.parse(str);
      if (v !== null && typeof v === "object" && !Array.isArray(v)) return [v];
    } catch {
      /* 继续逐段 */
    }
  const lenient = (text: string): unknown => {
    const v = parseYaml(text.replace(/(^|[^:"'\w])\/\/[^\n]*/g, "$1"), { strict: false, uniqueKeys: false });
    return v !== null && typeof v === "object" ? v : undefined;
  };
  for (let i = 0; i < str.length; i++) {
    if (str[i] !== "{") continue;
    const end = balancedEnd(str, i);
    if (end > i)
      try {
        out.push(JSON.parse(str.slice(i, end)));
        i = end - 1;
        continue;
      } catch {
        /* 退回宽松解析 */
      }
    // 上游的宽松路径：逐字符数括号，缺少的右括号补齐后按 YAML/JSON 兼容方式解析
    let open = 1,
      close = 0,
      j = i + 1;
    const limit = Math.min(i + 100_000, str.length);
    while (j < limit && open > close) {
      if (str[j] === "{") open++;
      if (str[j] === "}") close++;
      j++;
      if (open === close || j === str.length || j === i + 100_000) {
        try {
          const v = lenient(str.slice(i, j) + "}".repeat(Math.max(0, open - close)));
          if (v !== undefined) {
            out.push(v);
            i = j - 1;
            break;
          }
        } catch {
          if (open === close) break;
        }
      }
    }
  }
  return out;
}
function balancedEnd(s: string, start: number) {
  let depth = 0,
    quote = "";
  for (let i = start; i < s.length && i - start < 100_000; i++) {
    const c = s[i];
    if (quote) {
      if (c === "\\") i++;
      else if (c === quote) quote = "";
    } else if (c === '"') quote = c;
    else if (c === "{") depth++;
    else if (c === "}") {
      depth--;
      if (depth === 0) return i + 1;
    }
  }
  return -1;
}

function bleu(candidate: string, references: string[]) {
  const tokenize = (t: string) => t.toLowerCase().trim().split(/\s+/);
  const grams = (w: string[], n: number) => {
    if (n <= 0 || n > w.length) return [];
    const g: string[] = [];
    for (let i = 0; i <= w.length - n; i++) g.push(w.slice(i, i + n).join(" "));
    return g;
  };
  const count = (g: string[]) => {
    const m = new Map<string, number>();
    for (const x of g) m.set(x, (m.get(x) ?? 0) + 1);
    return m;
  };
  if (candidate.trim() === "") return 0;
  const cw = tokenize(candidate);
  const refs = references.filter((r) => r.trim() !== "").map(tokenize);
  if (!refs.length) return 0;
  const closest = refs
    .map((w) => w.length)
    .reduce((prev, cur) => {
      const dc = Math.abs(cur - cw.length),
        dp = Math.abs(prev - cw.length);
      return dc < dp || (dc === dp && cur < prev) ? cur : prev;
    });
  const orders: { precision: number; weight: number }[] = [];
  for (let n = 1; n <= 4; n++) {
    const cg = grams(cw, n);
    if (!cg.length) continue;
    const cc = count(cg);
    let best = 0;
    for (const rw of refs) {
      const rc = count(grams(rw, n));
      let clipped = 0;
      for (const [g, c] of cc) clipped += Math.min(c, rc.get(g) ?? 0);
      best = Math.max(best, clipped);
    }
    orders.push({ precision: best / cg.length, weight: 0.25 });
  }
  const bp = cw.length > closest ? 1 : Math.exp(1 - closest / cw.length);
  const ws = orders.reduce((a, o) => a + o.weight, 0);
  if (ws === 0) return 0;
  return bp * Math.exp(orders.reduce((a, o) => a + (o.weight / ws) * Math.log(o.precision === 0 ? 1e-7 : o.precision), 0));
}
function rougeN(candidate: string, reference: string, n = 1) {
  const ct = treeBankTokenize(candidate),
    rt = treeBankTokenize(reference);
  if (ct.length < n || rt.length < n) return 0;
  const cg = nGram(ct, n),
    rg = nGram(rt, n);
  const rc = new Map<string, number>();
  for (const g of rg) rc.set(g, (rc.get(g) ?? 0) + 1);
  const cc = new Map<string, number>();
  for (const g of cg) cc.set(g, (cc.get(g) ?? 0) + 1);
  let overlap = 0;
  for (const [g, c] of cc) overlap += Math.min(c, rc.get(g) ?? 0);
  if (!overlap) return 0;
  return fMeasure(overlap / cg.length, overlap / rg.length, 1);
}

function toolVerdict(a: Assertion, inverse: boolean, valid: boolean, reason: string, label: string): GradingResult {
  const pass = inverse ? !valid : valid;
  return { pass, score: pass ? 1 : 0, reason: inverse ? (pass ? "Assertion passed" : `Expected output to not be a valid ${label}`) : reason, assertion: a };
}
function validateFunctionCall(call: unknown, functions: unknown[]): string | null {
  const fc = call as { name?: unknown; arguments?: unknown } | null;
  if (!fc || typeof fc !== "object" || typeof fc.name !== "string" || typeof fc.arguments !== "string")
    return `OpenAI did not return a valid-looking function call: ${JSON.stringify(call)}`;
  let args: unknown;
  try {
    args = JSON.parse(fc.arguments);
  } catch (e) {
    return e instanceof Error ? e.message : "arguments 不是 JSON";
  }
  const def = functions.find((f) => (f as { name?: unknown })?.name === fc.name) as { parameters?: unknown } | undefined;
  if (!def) return `Called "${fc.name}", but there is no function with that name`;
  const v = compileSchema(def.parameters ?? { type: "object", properties: {}, additionalProperties: false });
  if (!v(args)) return `Call to "${fc.name}" does not match schema: ${JSON.stringify(v.errors)}`;
  return null;
}

async function runScript(code: string, output: unknown, context: Record<string, unknown>, ctx: AssertContext) {
  const r = await ctx.sandbox.run(functionBody(code), ["output", "context"], [output, context], ctx.timeoutMs ?? 1500);
  if (!r.ok) throw new Error(r.error ?? "脚本执行失败");
  return r.value;
}
function scriptResult(a: Assertion, result: unknown, inverse: boolean): GradingResult {
  if (typeof result === "boolean") {
    const pass = result !== inverse;
    return { pass, score: pass ? 1 : 0, reason: pass ? "Assertion passed" : `Custom function returned ${result}`, assertion: a };
  }
  if (typeof result === "number" && Number.isFinite(result)) {
    const raw = a.threshold === undefined ? result > 0 : result >= a.threshold;
    const pass = raw !== inverse;
    return { pass, score: result, reason: pass ? "Assertion passed" : `Custom function returned ${raw}`, assertion: a };
  }
  if (result && typeof result === "object" && typeof (result as GradingResult).pass === "boolean") {
    const g = result as GradingResult;
    const score = typeof g.score === "number" && Number.isFinite(g.score) ? g.score : g.pass ? 1 : 0;
    const pass = g.pass !== inverse;
    return {
      pass,
      score,
      reason: inverse ? (pass ? "Assertion passed" : g.reason || "Custom function returned true") : String(g.reason ?? ""),
      assertion: a,
    };
  }
  throw new Error(`Custom function must return a boolean, a finite number, or a GradingResult object. Got type ${typeof result}.`);
}

function renderValue(v: unknown, vars: Record<string, unknown>): unknown {
  if (typeof v === "string") return renderTemplate(v, vars);
  if (Array.isArray(v)) return v.map((x) => (typeof x === "string" ? renderTemplate(x, vars) : x));
  return v;
}

/** 单个断言。配置错误抛出 AssertionConfigError（整格记为错误，与上游一致）。 */
export async function runAssertion(a: Assertion, providerOutput: unknown, ctx: AssertContext): Promise<GradingResult> {
  const type = baseType(a.type);
  const inverse = a.type.startsWith("not-");
  if (!isLocalAssertion(a.type))
    return {
      pass: true,
      score: 0,
      reason: `未执行：${a.type} 需要模型评分或外部脚本，可交给官方 promptfoo 执行器。`,
      assertion: a,
      metadata: { skipped: true },
    };
  let output = providerOutput;
  const scriptContext = {
    prompt: ctx.prompt,
    vars: ctx.vars,
    test: { description: ctx.test.description, vars: ctx.test.vars, metadata: ctx.test.metadata },
    provider: { id: ctx.provider.id, label: ctx.provider.label },
    ...(a.config ? { config: a.config } : {}),
  };
  if (a.transform) {
    // 与上游一致：transform 抛错或返回 null/undefined 时整格记为错误
    let next: unknown;
    try {
      next = await runScript(a.transform, output, { vars: ctx.vars, prompt: { label: ctx.promptLabel } }, ctx);
    } catch (e) {
      throw new TransformError(`Transform failed (${a.transform.replace(/\s+/g, " ").slice(0, 80)}): ${e instanceof Error ? e.message : String(e)}`);
    }
    if (next === null || next === undefined)
      throw new TransformError(`Transform function did not return a value（${a.transform.replace(/\s+/g, " ").slice(0, 80)}）`);
    output = next;
  }
  const outputString = coerceString(output);
  const value = renderValue(a.value, ctx.vars);
  const done = (pass: boolean, reason: string, score = pass ? 1 : 0): GradingResult => ({
    pass,
    score,
    reason: pass ? "Assertion passed" : reason,
    assertion: a,
  });
  let result: GradingResult;
  switch (type) {
    case "equals": {
      if (value !== null && typeof value === "object") {
        let ok: boolean;
        try {
          ok = isDeepStrictEqual(value, JSON.parse(outputString)) !== inverse;
        } catch {
          ok = inverse;
        }
        result = done(ok, `Expected output "${outputString}" to ${inverse ? "not " : ""}equal "${JSON.stringify(value)}"`);
      } else {
        const ok = (String(value) === outputString) !== inverse;
        result = done(ok, `Expected output "${outputString}" to ${inverse ? "not " : ""}equal "${String(value)}"`);
      }
      break;
    }
    case "contains":
    case "icontains":
    case "contains-any":
    case "icontains-any":
    case "contains-all":
    case "icontains-all": {
      const ignore = type.startsWith("i");
      const mode = type.endsWith("-any") ? "any" : type.endsWith("-all") ? "all" : "single";
      const includes = (item: unknown) =>
        ignore ? outputString.toLowerCase().includes(String(item).toLowerCase()) : outputString.includes(String(item));
      if (mode === "single") {
        invariant(
          (typeof value === "string" && value !== "") || (typeof value === "number" && !Number.isNaN(value)),
          `"${type}" 断言需要文本或数字 value`,
        );
        const ok = includes(value) !== inverse;
        result = done(ok, `Expected output to ${inverse ? "not " : ""}contain "${String(value)}"`);
      } else {
        invariant(value, `"${type}" 断言需要 value`);
        const list = typeof value === "string" ? parseCommaSeparatedValues(value) : value;
        invariant(Array.isArray(list), `"${type}" 断言需要列表 value`);
        if (mode === "any") {
          const ok = list.some(includes) !== inverse;
          result = done(ok, `Expected output to ${inverse ? "not " : ""}contain one of "${list.join(", ")}"`);
        } else {
          const missing = list.filter((x) => !includes(x));
          const ok = (missing.length === 0) !== inverse;
          result = done(ok, `Expected output to ${inverse ? "not " : ""}contain all of [${list.join(", ")}]. Missing: [${missing.join(", ")}]`);
        }
      }
      break;
    }
    case "regex": {
      invariant(typeof value === "string" && value, '"regex" 断言需要文本 value');
      let re: RegExp;
      try {
        re = new RegExp(value);
      } catch (e) {
        result = { pass: false, score: 0, reason: `Invalid regex pattern: ${e instanceof Error ? e.message : "unknown error"}`, assertion: a };
        break;
      }
      result = done(re.test(outputString) !== inverse, `Expected output to ${inverse ? "not " : ""}match regex "${value}"`);
      break;
    }
    case "starts-with":
      invariant(typeof value === "string" && value, '"starts-with" 断言需要文本 value');
      result = done(outputString.startsWith(value) !== inverse, `Expected output to ${inverse ? "not " : ""}start with "${value}"`);
      break;
    case "is-json": {
      let parsed: unknown,
        pass: boolean;
      try {
        parsed = JSON.parse(outputString);
        pass = !inverse;
      } catch {
        pass = inverse;
      }
      if (parsed !== undefined && value) {
        const schema = typeof value === "string" ? parseYaml(value) : value;
        invariant(schema && typeof schema === "object", "is-json 的 value 需要 JSON Schema");
        const v = compileSchema(schema);
        const valid = v(parsed);
        pass = inverse ? !valid : valid;
        if (!pass) {
          result = {
            pass,
            score: 0,
            reason: inverse ? "Output is JSON that conforms to the provided schema" : `JSON does not conform to the provided schema. Errors: ${ajv().errorsText(v.errors)}`,
            assertion: a,
          };
          break;
        }
      }
      result = done(pass, `Expected output to ${inverse ? "not " : ""}be valid JSON`);
      break;
    }
    case "contains-json": {
      let reason = `Expected output to ${inverse ? "not " : ""}contain valid JSON`;
      const objects = extractJsonObjects(outputString);
      let pass = inverse ? objects.length === 0 : objects.length > 0;
      if (value) {
        const schema = typeof value === "string" ? parseYaml(value) : value;
        invariant(schema && typeof schema === "object", "contains-json 的 value 需要 JSON Schema");
        const v = compileSchema(schema);
        for (const o of objects) {
          const valid = v(o);
          pass = inverse ? !valid : valid;
          if (valid) {
            if (inverse) reason = "Output contains JSON conforming to the provided schema";
            break;
          } else reason = `JSON does not conform to the provided schema. Errors: ${ajv().errorsText(v.errors)}`;
        }
      }
      result = done(pass, reason);
      break;
    }
    case "is-valid-openai-tools-call": {
      let calls: unknown = output;
      if (calls && typeof calls === "object" && !Array.isArray(calls) && "tool_calls" in calls) calls = (calls as { tool_calls: unknown }).tool_calls;
      if (
        !Array.isArray(calls) ||
        !calls.length ||
        calls.some((c) => typeof c?.function?.name !== "string" || typeof c?.function?.arguments !== "string")
      ) {
        result = toolVerdict(a, inverse, false, `OpenAI did not return a valid-looking tools response: ${JSON.stringify(calls)}`, "OpenAI tools call");
        break;
      }
      const tools = ctx.provider.config.tools;
      if (!tools) {
        result = { pass: false, score: 0, reason: "No tools configured in provider, but output contains tool calls", assertion: a };
        break;
      }
      if (!Array.isArray(tools) || tools.some((t) => !t || typeof t !== "object" || typeof t.type !== "string" || (t.type === "function" && !("function" in t)))) {
        result = { pass: false, score: 0, reason: "Expected tools to be an array of tool definitions", assertion: a };
        break;
      }
      const fns = tools.filter((t) => t.type === "function").map((t) => t.function);
      const problem = calls.map((c) => validateFunctionCall(c.function, fns)).find((x) => x);
      result = toolVerdict(a, inverse, !problem, problem ?? "Assertion passed", "OpenAI tools call");
      break;
    }
    case "is-valid-openai-function-call": {
      const fns = ctx.provider.config.functions;
      if (!Array.isArray(fns)) {
        result = { pass: false, score: 0, reason: "Provider does not have functionality for checking function call.", assertion: a };
        break;
      }
      let call: unknown = output;
      if (call && typeof call === "object" && "function_call" in call) call = (call as { function_call: unknown }).function_call;
      const problem = validateFunctionCall(call, fns);
      result = toolVerdict(a, inverse, !problem, problem ?? "Assertion passed", "function call");
      break;
    }
    case "javascript": {
      invariant(typeof value === "string", "javascript 断言需要代码文本");
      try {
        result = scriptResult(a, await runScript(value.trimEnd(), output, scriptContext, ctx), inverse);
      } catch (e) {
        result = { pass: false, score: 0, reason: `Custom function threw error: ${e instanceof Error ? e.message : String(e)}`, assertion: a };
      }
      break;
    }
    case "levenshtein": {
      invariant(typeof value === "string", '"levenshtein" 断言需要文本 value');
      const d = distance(outputString, value);
      const threshold = a.threshold ?? 5;
      result = done((d <= threshold) !== inverse, `Levenshtein distance ${d} is ${inverse ? "less than or equal to" : "greater than"} threshold ${threshold}`);
      break;
    }
    case "rouge-n": {
      invariant(typeof value === "string", '"rouge" 断言需要文本 value');
      let score = 0;
      if (!/^[\s\u0085]*$/u.test(outputString) && !/^[\s\u0085]*$/u.test(value)) score = rougeN(outputString.toLowerCase(), value.toLowerCase());
      const threshold = a.threshold ?? 0.75;
      result = {
        pass: score >= threshold !== inverse,
        score: inverse ? 1 - score : score,
        reason: `ROUGE-N score ${score.toFixed(2)} is ${score >= threshold ? "greater than or equal to" : "less than"} threshold ${threshold}`,
        assertion: a,
      };
      break;
    }
    case "bleu": {
      invariant(typeof value === "string" || (Array.isArray(value) && value.every((v) => typeof v === "string")), '"bleu" 断言需要文本或文本列表 value');
      const threshold = a.threshold ?? 0.5;
      const score = bleu(outputString, Array.isArray(value) ? (value as string[]) : [value]);
      const pass = score >= threshold !== inverse;
      result = {
        pass,
        score: inverse ? 1 - score : score,
        reason: pass ? "Assertion passed" : `BLEU score ${score.toFixed(4)} is ${inverse ? "greater" : "less"} than threshold ${threshold}`,
        assertion: a,
      };
      break;
    }
    case "latency": {
      invariant(a.threshold !== undefined, "latency 断言需要以毫秒为单位的 threshold");
      invariant(ctx.latencyMs !== undefined, "此输出没有耗时记录，latency 断言无法判断");
      result = done((ctx.latencyMs <= a.threshold) !== inverse, `Latency ${ctx.latencyMs}ms is ${inverse ? "less than or equal to" : "greater than"} threshold ${a.threshold}ms`);
      break;
    }
    case "cost": {
      if (a.threshold === undefined) {
        invariant(a.metric && a.weight === 0 && !inverse, "cost 断言需要 threshold");
        invariant(ctx.cost !== undefined && Number.isFinite(ctx.cost) && ctx.cost >= 0, "Cost metric requires a finite, non-negative provider cost");
        result = { pass: true, score: ctx.cost, reason: `Cost: $${ctx.cost}`, assertion: a };
        break;
      }
      invariant(ctx.cost !== undefined, "此 provider 没有返回成本，cost 断言无法判断");
      result = done((ctx.cost <= a.threshold) !== inverse, `Cost ${ctx.cost.toPrecision(2)} is ${inverse ? "less than or equal to" : "greater than"} threshold ${a.threshold}`);
      break;
    }
    case "word-count": {
      invariant(value !== undefined && value !== null, '"word-count" 断言需要 value');
      const count = outputString.trim().match(/\S+/g)?.length ?? 0;
      if (typeof value === "object" && !Array.isArray(value)) {
        const { min, max } = value as { min?: number; max?: number };
        invariant(min !== undefined || max !== undefined, '"word-count" 需要 min 或 max');
        const ok = (min === undefined || count >= min) && (max === undefined || count <= max);
        result = done(ok !== inverse, `Word count ${count} is outside ${min ?? "-∞"}–${max ?? "∞"}`);
      } else {
        const expected = Number(value);
        invariant(Number.isFinite(expected), '"word-count" 需要数字 value');
        result = done((count === expected) !== inverse, `Word count ${count} does not equal expected ${expected}`);
      }
      break;
    }
    case "finish-reason": {
      invariant(typeof value === "string", '"finish-reason" 断言需要文本 value');
      if (!ctx.finishReason) {
        result = { pass: inverse, score: inverse ? 1 : 0, reason: inverse ? "Assertion passed" : "Provider did not supply stop/finish reason", assertion: a };
        break;
      }
      result = done(
        (value.toLowerCase() === ctx.finishReason.toLowerCase()) !== inverse,
        `Expected finish reason ${inverse ? "not " : ""}"${value}" but got "${ctx.finishReason}"`,
      );
      break;
    }
    default:
      throw new AssertionConfigError(`未知断言类型：${a.type}`);
  }
  if (typeof value === "string" && value !== a.value) result.metadata = { ...result.metadata, renderedAssertionValue: value };
  if (a.weight === 0) return { ...result, pass: true };
  return result;
}

class Aggregate {
  totalScore = 0;
  totalWeight = 0;
  failedReason: string | undefined;
  components: GradingResult[] = [];
  named: Record<string, number> = Object.create(null);
  namedWeight: Record<string, number> = Object.create(null);
  threshold: number | undefined;
  constructor(threshold?: number) {
    this.threshold = threshold;
  }
  add(index: number, r: GradingResult, metric: string | undefined, weight = 1) {
    if (r.metadata?.skipped) weight = 0;
    this.totalScore += r.score * weight;
    this.totalWeight += weight;
    this.components[index] = r;
    const mw = weight === 0 ? 1 : weight;
    if (metric && !r.metadata?.skipped) {
      this.named[metric] = (this.named[metric] ?? 0) + r.score * mw;
      this.namedWeight[metric] = (this.namedWeight[metric] ?? 0) + mw;
    }
    if (!r.pass) this.failedReason = r.reason;
  }
  result(): GradingResult {
    const score = this.totalWeight > 0 ? this.totalScore / this.totalWeight : 0;
    let pass = this.failedReason === undefined,
      reason = this.failedReason ?? "All assertions passed";
    if (typeof this.threshold === "number" && !Number.isNaN(this.threshold)) {
      pass = score >= this.threshold;
      reason = `Aggregate score ${score.toFixed(2)} ${pass ? "≥" : "<"} ${this.threshold} threshold`;
    }
    const components = this.components.filter(Boolean).flatMap((r) =>
      r.componentResults ? [r, ...r.componentResults.map((s) => ({ ...s, assertion: s.assertion ?? r.assertion }))] : [r],
    );
    return {
      pass,
      score,
      reason,
      namedScores: Object.fromEntries(Object.entries(this.named).map(([k, v]) => [k, this.namedWeight[k] ? v / this.namedWeight[k] : 0])),
      componentResults: components,
    };
  }
}

export async function runAssertions(test: TestCase, output: unknown, ctx: AssertContext): Promise<GradingResult> {
  if (!test.assert.length) return { pass: true, score: 1, reason: "No assertions", componentResults: [], namedScores: {} };
  const main = new Aggregate(test.threshold);
  for (let i = 0; i < test.assert.length; i++) {
    const a = test.assert[i];
    if (baseType(a.type) === "assert-set") {
      const sub = new Aggregate(a.threshold);
      for (let j = 0; j < (a.assert ?? []).length; j++) {
        const s = a.assert![j];
        const r = await runAssertion(s, output, ctx);
        sub.add(j, r, s.metric ? renderTemplate(s.metric, ctx.vars) : undefined, s.weight);
      }
      const sr = sub.result();
      main.add(i, { ...sr, assertion: a, metadata: { assertionSet: true } }, a.metric ? renderTemplate(a.metric, ctx.vars) : undefined, a.weight);
      continue;
    }
    const r = await runAssertion(a, output, ctx);
    main.add(i, r, a.metric ? renderTemplate(a.metric, ctx.vars) : undefined, a.weight);
  }
  return main.result();
}
