// ABOUTME: promptfooconfig.yaml 的读取、规范化与导出：提示版本、provider、用例（含 defaultTest 与数组变量展开）。
import { parseDocument, stringify } from "yaml";
import { renderTemplate, templateVariables, TemplateError } from "./template.ts";
import { shortHash, stableJson } from "./hash.ts";

export interface Assertion {
  type: string;
  value?: unknown;
  threshold?: number;
  weight?: number;
  metric?: string;
  transform?: string;
  assert?: Assertion[];
  config?: Record<string, unknown>;
}
export interface TestCase {
  description: string;
  vars: Record<string, unknown>;
  assert: Assertion[];
  threshold?: number;
  options: { transform?: string };
  metadata: Record<string, unknown>;
  key: string;
}
export interface PromptDef {
  id: string;
  label: string;
  raw: string;
}
export type ProviderKind = "echo" | "script" | "host" | "replay";
export interface ProviderDef {
  id: string;
  label: string;
  kind: ProviderKind;
  model: string;
  config: Record<string, unknown>;
  prompts: string[] | null;
  /** 回放时查找录制输出所用的 provider 标识。 */
  replayOf: string;
}
export interface Column {
  key: string;
  prompt: PromptDef;
  provider: ProviderDef;
}
export interface Suite {
  description: string;
  prompts: PromptDef[];
  providers: ProviderDef[];
  tests: TestCase[];
  columns: Column[];
  maxConcurrency: number;
  warnings: string[];
}
export class ConfigError extends Error {
  line: number | null;
  constructor(message: string, line: number | null = null) {
    super(line ? `第 ${line} 行：${message}` : message);
    this.line = line;
  }
}

export const LIMITS = {
  configChars: 600_000,
  prompts: 24,
  providers: 24,
  tests: 2000,
  cells: 6000,
  assertsPerTest: 60,
};

/** 本机确定性执行的断言类型（均可加 not- 前缀）。 */
export const LOCAL_ASSERTIONS = [
  "equals",
  "contains",
  "icontains",
  "contains-any",
  "contains-all",
  "icontains-any",
  "icontains-all",
  "regex",
  "starts-with",
  "is-json",
  "contains-json",
  "is-valid-openai-tools-call",
  "is-valid-openai-function-call",
  "javascript",
  "levenshtein",
  "rouge-n",
  "bleu",
  "latency",
  "cost",
  "word-count",
  "finish-reason",
] as const;
/** 需要模型评分、外部脚本或网络的上游断言：保留在配置里，本机标为“未执行”。 */
export const REMOTE_ASSERTIONS = new Set([
  "llm-rubric",
  "model-graded-closedqa",
  "model-graded-factuality",
  "factuality",
  "answer-relevance",
  "context-faithfulness",
  "context-recall",
  "context-relevance",
  "conversation-relevance",
  "g-eval",
  "similar",
  "classifier",
  "moderation",
  "select-best",
  "max-score",
  "python",
  "ruby",
  "webhook",
  "perplexity",
  "perplexity-score",
  "pi",
  "guardrails",
  "is-refusal",
  "rouge-l",
  "rouge-s",
  "gleu",
  "meteor",
  "is-sql",
  "contains-sql",
  "is-html",
  "is-xml",
  "contains-xml",
  "contains-html",
  "search-rubric",
  "agent-rubric",
]);
const localSet = new Set<string>(LOCAL_ASSERTIONS);
export const baseType = (type: string) => (type.startsWith("not-") ? type.slice(4) : type);
export const isLocalAssertion = (type: string) => localSet.has(baseType(type));

const isObj = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);
const str = (v: unknown, what: string, max = 200_000) => {
  if (typeof v !== "string") throw new ConfigError(`${what}需要文本。`);
  if (v.length > max) throw new ConfigError(`${what}超过 ${max} 个字符。`);
  return v;
};
const fileRef = (v: unknown) => typeof v === "string" && /^\s*(file|package|https?):\/\//i.test(v);
const safeKey = (k: string) => !["__proto__", "constructor", "prototype"].includes(k);
const num = (v: unknown, what: string) => {
  if (v === undefined || v === null) return undefined;
  const n = typeof v === "string" && v.trim() ? Number(v) : v;
  if (typeof n !== "number" || !Number.isFinite(n)) throw new ConfigError(`${what}需要数字。`);
  return n;
};
function cloneJson(v: unknown, what: string, depth = 0): unknown {
  if (depth > 24) throw new ConfigError(`${what}层级过深。`);
  if (Array.isArray(v)) return v.map((x) => cloneJson(x, what, depth + 1));
  if (isObj(v)) {
    const out: Record<string, unknown> = {};
    for (const [k, x] of Object.entries(v)) {
      if (!safeKey(k)) throw new ConfigError(`${what}含有保留键“${k}”。`);
      out[k] = cloneJson(x, what, depth + 1);
    }
    return out;
  }
  if (v instanceof Date) return v.toISOString();
  if (typeof v === "number" && !Number.isFinite(v)) return null;
  return v;
}

export function parseConfigText(text: string): unknown {
  if (text.length > LIMITS.configChars) throw new ConfigError(`配置超过 ${LIMITS.configChars} 个字符。`);
  const doc = parseDocument(text, { prettyErrors: true, uniqueKeys: true });
  if (doc.errors.length) {
    const e = doc.errors[0];
    const line = e.linePos?.[0]?.line ?? null;
    throw new ConfigError(e.message.split("\n")[0], line);
  }
  return doc.toJS({ maxAliasCount: 200 });
}

function parsePrompt(v: unknown, i: number): PromptDef {
  if (typeof v === "string") {
    if (fileRef(v))
      throw new ConfigError(`第 ${i + 1} 个提示引用了外部文件（${v.slice(0, 80)}）。请把文件内容粘贴为 raw。`);
    return { id: v, label: v, raw: v };
  }
  if (!isObj(v)) throw new ConfigError(`第 ${i + 1} 个提示格式无效。`);
  if (v.raw === undefined && typeof v.id === "string" && fileRef(v.id))
    throw new ConfigError(`第 ${i + 1} 个提示引用了外部文件（${v.id.slice(0, 80)}）。请把文件内容粘贴为 raw。`);
  const raw =
    typeof v.raw === "string"
      ? v.raw
      : Array.isArray(v.raw) || isObj(v.raw)
        ? JSON.stringify(v.raw)
        : typeof v.id === "string"
          ? v.id
          : "";
  str(raw, `第 ${i + 1} 个提示`, 100_000);
  if (fileRef(raw)) throw new ConfigError(`第 ${i + 1} 个提示引用了外部文件。请把文件内容粘贴为 raw。`);
  const label = typeof v.label === "string" && v.label.trim() ? v.label.trim() : raw;
  return { id: typeof v.id === "string" ? v.id : raw, label: label.slice(0, 2000), raw };
}

export function providerKind(id: string): { kind: ProviderKind; model: string } {
  if (id === "echo") return { kind: "echo", model: "" };
  if (id === "floatboat:script") return { kind: "script", model: "" };
  if (id === "floatboat:replay" || id.startsWith("floatboat:replay:")) return { kind: "replay", model: "" };
  if (id.startsWith("floatboat:host:")) return { kind: "host", model: id.slice(15) };
  if (id.startsWith("floatboat:")) return { kind: "host", model: id.slice(10) };
  return { kind: "replay", model: "" };
}
function parseProvider(v: unknown, i: number): ProviderDef {
  let id: string,
    label: string | undefined,
    config: Record<string, unknown> = {},
    prompts: string[] | null = null;
  if (typeof v === "string") id = v;
  else if (isObj(v)) {
    const keys = Object.keys(v);
    if (typeof v.id !== "string" && keys.length === 1 && isObj(v[keys[0]])) {
      id = keys[0];
      v = { id, ...(v[keys[0]] as Record<string, unknown>) };
    }
    const o = v as Record<string, unknown>;
    if (typeof o.id !== "string") throw new ConfigError(`第 ${i + 1} 个 provider 缺少 id。`);
    id = o.id;
    if (typeof o.label === "string" && o.label.trim()) label = o.label.trim();
    if (o.config !== undefined) {
      if (!isObj(o.config)) throw new ConfigError(`provider ${id} 的 config 需要对象。`);
      config = cloneJson(o.config, `provider ${id} 的 config`) as Record<string, unknown>;
    }
    if (o.prompts !== undefined) {
      if (!Array.isArray(o.prompts) || o.prompts.some((p) => typeof p !== "string"))
        throw new ConfigError(`provider ${id} 的 prompts 需要提示名称列表。`);
      prompts = o.prompts as string[];
    }
  } else throw new ConfigError(`第 ${i + 1} 个 provider 格式无效。`);
  str(id, "provider id", 300);
  const { kind, model } = providerKind(id);
  if (kind === "script" && typeof config.code !== "string")
    throw new ConfigError(`provider ${label ?? id} 需要 config.code（JavaScript 函数体）。`);
  if (kind === "host" && !/^[A-Za-z0-9][A-Za-z0-9._:/-]{0,120}$/.test(model))
    throw new ConfigError(`Floatboat 模型标识“${model}”无效。`);
  const replayOf =
    kind === "replay"
      ? typeof config.replayOf === "string"
        ? config.replayOf
        : id.startsWith("floatboat:replay:")
          ? id.slice(17)
          : id
      : "";
  return { id, label: label ?? id, kind, model, config, prompts, replayOf };
}

function parseAssertion(v: unknown, where: string, depth = 0): Assertion {
  if (!isObj(v) || typeof v.type !== "string") throw new ConfigError(`${where}的断言需要 type。`);
  const type = v.type.trim();
  const base = baseType(type);
  if (!localSet.has(base) && !REMOTE_ASSERTIONS.has(base) && base !== "assert-set" && !base.startsWith("promptfoo:"))
    throw new ConfigError(`${where}使用了未知断言类型“${type}”。`);
  const a: Assertion = { type };
  if (v.value !== undefined) {
    if (fileRef(v.value) || (Array.isArray(v.value) && v.value.some(fileRef)))
      throw new ConfigError(`${where}的 ${type} 断言引用了外部文件；请直接写入断言内容。`);
    a.value = cloneJson(v.value, `${where}的断言值`);
  }
  const threshold = num(v.threshold, `${where}的 threshold`);
  if (threshold !== undefined) a.threshold = threshold;
  const weight = num(v.weight, `${where}的 weight`);
  if (weight !== undefined) {
    if (weight < 0) throw new ConfigError(`${where}的 weight 不能为负数。`);
    a.weight = weight;
  }
  if (typeof v.metric === "string") a.metric = v.metric.slice(0, 200);
  if (v.transform !== undefined) {
    if (typeof v.transform !== "string" || fileRef(v.transform))
      throw new ConfigError(`${where}的 transform 需要内联 JavaScript 表达式。`);
    a.transform = v.transform;
  }
  if (isObj(v.config)) a.config = cloneJson(v.config, `${where}的断言 config`) as Record<string, unknown>;
  if (base === "assert-set") {
    if (depth > 0) throw new ConfigError(`${where}的 assert-set 不能嵌套。`);
    if (!Array.isArray(v.assert) || !v.assert.length) throw new ConfigError(`${where}的 assert-set 需要 assert 列表。`);
    a.assert = v.assert.map((x) => parseAssertion(x, where, depth + 1));
  }
  if (["latency", "cost"].includes(base) && a.threshold === undefined && !(a.metric && a.weight === 0))
    throw new ConfigError(`${where}的 ${type} 断言需要 threshold。`);
  if (["levenshtein", "starts-with", "regex"].includes(base) && typeof a.value !== "string")
    throw new ConfigError(`${where}的 ${type} 断言需要文本 value。`);
  if (base === "regex" && typeof a.value === "string" && !/\{[{%]/.test(a.value))
    try {
      new RegExp(a.value);
    } catch (e) {
      throw new ConfigError(`${where}的正则表达式无效：${e instanceof Error ? e.message : ""}`);
    }
  if (base === "javascript" && typeof a.value !== "string")
    throw new ConfigError(`${where}的 javascript 断言需要内联代码文本。`);
  return a;
}

function expandVars(vars: Record<string, unknown>): Record<string, unknown>[] {
  let combos: Record<string, unknown>[] = [{}];
  for (const [k, v] of Object.entries(vars)) {
    const values = Array.isArray(v) && v.length && v.every((x) => typeof x !== "object" || x === null) ? v : [v];
    const next: Record<string, unknown>[] = [];
    for (const c of combos) for (const x of values) next.push({ ...c, [k]: x });
    combos = next;
    if (combos.length > LIMITS.tests) throw new ConfigError(`数组变量展开后的用例超过 ${LIMITS.tests} 个。`);
  }
  return combos;
}
function parseVars(v: unknown, where: string): Record<string, unknown> {
  if (v === undefined || v === null) return {};
  if (!isObj(v)) throw new ConfigError(`${where}的 vars 需要对象。`);
  const out: Record<string, unknown> = {};
  for (const [k, x] of Object.entries(v)) {
    if (!/^[A-Za-z_][A-Za-z0-9_-]{0,80}$/.test(k) || !safeKey(k)) throw new ConfigError(`${where}的变量名“${k}”无效。`);
    if (fileRef(x)) throw new ConfigError(`${where}的变量 ${k} 引用了外部文件；请直接写入内容。`);
    out[k] = typeof x === "string" ? x.replace(/\n$/, "") : cloneJson(x, `${where}的变量 ${k}`);
  }
  return out;
}

interface RawTest {
  description?: unknown;
  vars?: unknown;
  assert?: unknown;
  threshold?: unknown;
  options?: unknown;
  metadata?: unknown;
}
function parseTests(value: unknown, defaults: RawTest, warnings: string[]): TestCase[] {
  if (value === undefined) return [];
  if (typeof value === "string")
    throw new ConfigError(`tests 引用了外部文件（${value.slice(0, 80)}）。请用“导入用例 CSV”或把用例写入配置。`);
  if (!Array.isArray(value)) throw new ConfigError("tests 需要列表。");
  const defaultVars = parseVars(defaults.vars, "defaultTest");
  const defaultAsserts = Array.isArray(defaults.assert)
    ? defaults.assert.map((a) => parseAssertion(a, "defaultTest"))
    : [];
  const defaultOptions = isObj(defaults.options) ? defaults.options : {};
  const out: TestCase[] = [];
  const seen = new Map<string, number>();
  value.forEach((t, i) => {
    if (typeof t === "string") throw new ConfigError(`第 ${i + 1} 个用例引用了外部文件，请写入配置。`);
    if (!isObj(t)) throw new ConfigError(`第 ${i + 1} 个用例格式无效。`);
    const where = `第 ${i + 1} 个用例`;
    const vars = { ...defaultVars, ...parseVars(t.vars, where) };
    const own = t.assert === undefined ? [] : Array.isArray(t.assert) ? t.assert : null;
    if (!own) throw new ConfigError(`${where}的 assert 需要列表。`);
    const assert = [...defaultAsserts, ...own.map((a) => parseAssertion(a, where))];
    if (assert.length > LIMITS.assertsPerTest) throw new ConfigError(`${where}的断言超过 ${LIMITS.assertsPerTest} 个。`);
    const options = { ...defaultOptions, ...(isObj(t.options) ? t.options : {}) };
    const transform =
      typeof options.transform === "string"
        ? options.transform
        : options.transform === undefined
          ? undefined
          : (() => {
              throw new ConfigError(`${where}的 options.transform 需要内联 JavaScript。`);
            })();
    for (const key of Object.keys(options))
      if (!["transform", "provider", "rubricPrompt", "disableVarExpansion", "disableConversationVar"].includes(key))
        warnings.push(`${where}的 options.${key} 本机不使用。`);
    if (isObj(options.provider)) warnings.push(`${where}指定了评分 provider；本机不执行模型评分。`);
    const threshold = num(t.threshold ?? defaults.threshold, `${where}的 threshold`);
    const description = typeof t.description === "string" ? t.description.slice(0, 1000) : "";
    const metadata = isObj(t.metadata) ? (cloneJson(t.metadata, `${where}的 metadata`) as Record<string, unknown>) : {};
    const combos = options.disableVarExpansion ? [vars] : expandVars(vars);
    for (const c of combos) {
      const base = shortHash(description + "\u0000" + stableJson(c));
      const n = seen.get(base) ?? 0;
      seen.set(base, n + 1);
      out.push({
        description,
        vars: c,
        assert,
        ...(threshold !== undefined ? { threshold } : {}),
        options: transform ? { transform } : {},
        metadata,
        key: n ? `${base}-${n}` : base,
      });
      if (out.length > LIMITS.tests) throw new ConfigError(`用例超过 ${LIMITS.tests} 个。`);
    }
  });
  return out;
}

const knownTop = new Set([
  "description",
  "prompts",
  "providers",
  "targets",
  "tests",
  "defaultTest",
  "evaluateOptions",
  "outputPath",
  "sharing",
  "nunjucksFilters",
  "env",
  "scenarios",
  "derivedMetrics",
  "tags",
  "metadata",
  "commandLineOptions",
  "writeLatestResults",
  "$schema",
]);
export function normalizeConfig(value: unknown): Suite {
  if (!isObj(value)) throw new ConfigError("配置需要 YAML/JSON 对象（description、prompts、providers、tests）。");
  const warnings: string[] = [];
  for (const k of Object.keys(value))
    if (!knownTop.has(k)) warnings.push(`未知的顶层字段 ${k} 已忽略。`);
  for (const k of ["env", "scenarios", "nunjucksFilters", "derivedMetrics"])
    if (value[k] !== undefined) warnings.push(`${k} 本机不执行，已忽略。`);
  const rawPrompts =
    typeof value.prompts === "string"
      ? [value.prompts]
      : Array.isArray(value.prompts)
        ? value.prompts
        : isObj(value.prompts)
          ? Object.entries(value.prompts).map(([raw, label]) => ({ raw, label }))
          : null;
  if (!rawPrompts || !rawPrompts.length) throw new ConfigError("至少需要一个提示版本（prompts）。");
  if (rawPrompts.length > LIMITS.prompts) throw new ConfigError(`提示版本超过 ${LIMITS.prompts} 个。`);
  const prompts = rawPrompts.map(parsePrompt);
  const labels = new Set<string>();
  for (const p of prompts) {
    if (labels.has(p.label)) throw new ConfigError(`提示版本名称“${p.label.slice(0, 40)}”重复。`);
    labels.add(p.label);
    try {
      templateVariables(p.raw);
    } catch (e) {
      throw new ConfigError(`提示“${p.label.slice(0, 40)}”：${e instanceof Error ? e.message : "模板无效"}`);
    }
  }
  const providerList = value.providers ?? value.targets;
  const rawProviders =
    typeof providerList === "string"
      ? [providerList]
      : Array.isArray(providerList)
        ? providerList
        : isObj(providerList)
          ? Object.entries(providerList).map(([id, o]) => ({ id, ...(isObj(o) ? o : {}) }))
          : null;
  if (!rawProviders || !rawProviders.length) throw new ConfigError("至少需要一个 provider。");
  if (rawProviders.length > LIMITS.providers) throw new ConfigError(`provider 超过 ${LIMITS.providers} 个。`);
  const providers = rawProviders.map(parseProvider);
  for (const p of providers)
    if (p.kind === "replay" && !p.id.startsWith("floatboat:"))
      warnings.push(`provider ${p.label} 在本机以“回放录制输出”运行；没有录制的单元格会标为错误。`);
  const plabels = new Set<string>();
  for (const p of providers) {
    if (plabels.has(p.label)) throw new ConfigError(`provider 名称“${p.label}”重复，请设置不同的 label。`);
    plabels.add(p.label);
    if (p.prompts)
      for (const ref of p.prompts)
        if (!prompts.some((x) => matchesPrompt(ref, x)))
          throw new ConfigError(`provider ${p.label} 的 prompts 引用了不存在的提示“${ref}”。`);
  }
  const defaults = isObj(value.defaultTest) ? (value.defaultTest as RawTest) : {};
  if (value.defaultTest !== undefined && !isObj(value.defaultTest)) throw new ConfigError("defaultTest 需要对象。");
  const tests = parseTests(value.tests, defaults, warnings);
  if (!tests.length) throw new ConfigError("至少需要一个用例（tests）。");
  const columns: Column[] = [];
  for (const prompt of prompts)
    for (const provider of providers)
      if (!provider.prompts || provider.prompts.some((ref) => matchesPrompt(ref, prompt)))
        columns.push({ key: columnKey(prompt.label, provider.label), prompt, provider });
  if (!columns.length) throw new ConfigError("没有可运行的提示×provider 组合。");
  if (columns.length * tests.length > LIMITS.cells)
    throw new ConfigError(`一次运行最多 ${LIMITS.cells} 个单元格（当前 ${columns.length * tests.length}）。请拆分用例。`);
  for (const t of tests)
    for (const a of t.assert.flatMap((a) => (a.assert ? a.assert : [a])))
      if (!isLocalAssertion(a.type) && !warnings.some((w) => w.includes(`“${a.type}”`)))
        warnings.push(`断言“${a.type}”需要模型评分或外部脚本，本机标为未执行（不计分）。`);
  const opts = isObj(value.evaluateOptions) ? value.evaluateOptions : {};
  const maxConcurrency = Math.min(8, Math.max(1, Math.trunc(Number(opts.maxConcurrency ?? 4)) || 4));
  return {
    description: typeof value.description === "string" ? value.description.slice(0, 500) : "",
    prompts,
    providers,
    tests,
    columns,
    maxConcurrency,
    warnings,
  };
}
export function matchesPrompt(ref: string, p: PromptDef) {
  if (ref === p.label || ref === p.id) return true;
  if (ref.endsWith("*")) return p.label.startsWith(ref.slice(0, -1));
  return p.label.startsWith(`${ref}:`);
}
export const columnKey = (prompt: string, provider: string) => shortHash(`${prompt}\u0000${provider}`);

export function parseSuite(text: string): Suite {
  return normalizeConfig(parseConfigText(text));
}

/** 用用例变量渲染提示（变量中的 {{其他变量}} 先展开一层，与上游一致）。 */
export function renderPrompt(raw: string, vars: Record<string, unknown>): string {
  const resolved: Record<string, unknown> = { ...vars };
  for (const [k, v] of Object.entries(vars))
    if (typeof v === "string" && /\{\{/.test(v))
      try {
        resolved[k] = renderTemplate(v, vars);
      } catch {
        resolved[k] = v;
      }
  try {
    return renderTemplate(raw, resolved);
  } catch (e) {
    if (e instanceof TemplateError) throw e;
    throw new TemplateError("提示渲染失败。");
  }
}

export function testTitle(t: { description: string; vars: Record<string, unknown> }, index: number) {
  if (t.description) return t.description;
  const first = Object.values(t.vars).find((v) => typeof v === "string") as string | undefined;
  return first ? first.slice(0, 80) : `用例 ${index + 1}`;
}

/** 导出为 promptfooconfig.yaml 文本（保留用户写的原配置时直接用原文）。 */
export function configToYaml(value: unknown) {
  return stringify(value, { lineWidth: 0, blockQuote: "literal" });
}

/** 从 promptfoo CSV 用例表生成 tests（__expected/__description/__threshold 等列）。 */
export function testsFromCsv(text: string): RawTest[] {
  const rows = parseCsv(text.replace(/^﻿/, ""));
  if (rows.length < 2) throw new ConfigError("CSV 需要表头和至少一行用例。");
  const header = rows[0].map((h) => h.trim());
  if (header.some((h) => !h)) throw new ConfigError("CSV 表头存在空列名。");
  if (rows.length - 1 > LIMITS.tests) throw new ConfigError(`CSV 用例超过 ${LIMITS.tests} 行。`);
  return rows.slice(1).flatMap((row, r) => {
    if (row.every((c) => !c.trim())) return [];
    const vars: Record<string, string> = {};
    const assert: Assertion[] = [];
    const test: RawTest & { vars: Record<string, string>; assert: Assertion[] } = { vars, assert };
    header.forEach((h, i) => {
      const cell = row[i] ?? "";
      if (/^__expected\d*$/.test(h)) {
        if (cell.trim()) assert.push(expectedToAssertion(cell.trim(), r + 2));
      } else if (h === "__description") test.description = cell;
      else if (h === "__threshold") test.threshold = cell.trim() ? Number(cell) : undefined;
      else if (h === "__metric") {
        if (cell.trim()) assert.forEach((a) => (a.metric ??= cell.trim()));
      } else if (h.startsWith("__")) return;
      else vars[h] = cell;
    });
    return [test];
  });
}
function expectedToAssertion(cell: string, row: number): Assertion {
  const m = /^(not-)?([a-z][a-z0-9-]*)(?:\(([\d.]+)\))?:\s?([\s\S]*)$/i.exec(cell);
  const aliases: Record<string, string> = { fn: "javascript", eval: "javascript", grade: "llm-rubric", similar: "similar" };
  if (m) {
    const [, not, name, threshold, rest] = m;
    const type = aliases[name.toLowerCase()] ?? name.toLowerCase();
    if (isLocalAssertion(type) || REMOTE_ASSERTIONS.has(type)) {
      const a: Assertion = { type: `${not ?? ""}${type}` };
      const multi = ["contains-any", "contains-all", "icontains-any", "icontains-all"].includes(type);
      if (rest !== "") a.value = multi ? rest.split(",").map((x) => x.trim()) : rest;
      if (threshold) a.threshold = Number(threshold);
      return a;
    }
  }
  if (/^(is-json|contains-json|is-valid-openai-tools-call)$/.test(cell)) return { type: cell };
  if (cell.startsWith("=")) throw new ConfigError(`CSV 第 ${row} 行的 __expected 以“=”开头，可能是表格公式。`);
  return { type: "equals", value: cell };
}
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [],
    cell = "",
    quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i++;
        } else quoted = false;
      } else cell += c;
    } else if (c === '"' && cell === "") quoted = true;
    else if (c === ",") {
      row.push(cell);
      cell = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else cell += c;
  }
  if (cell !== "" || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows;
}

/** 把 CSV 用例追加到配置原文中（保留注释和已有字段）。 */
export function appendTestsToConfig(configText: string, tests: RawTest[]): string {
  const doc = parseDocument(configText);
  const current = doc.get("tests");
  if (current !== undefined && current !== null && !(typeof current === "object" && "items" in (current as object)))
    throw new ConfigError("tests 不是列表，无法追加。");
  for (const t of tests) doc.addIn(["tests"], doc.createNode(t));
  return doc.toString({ lineWidth: 0 });
}
