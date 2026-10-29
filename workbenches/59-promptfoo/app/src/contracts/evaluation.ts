// ABOUTME: 评测项目（工作副本）的结构与校验：配置原文、运行列表、基线、逐项复核与发布判断。
import { isRecord, boundedText } from "./project.ts";
import type { Baseline, Gate } from "./compare.ts";
import { defaultGate } from "./compare.ts";
import type { RunStats } from "./results.ts";

export type Decision = "pending" | "accept" | "reject";
export type ReleaseDecision = "pending" | "ship" | "hold" | "block";
export interface Review {
  decision: Decision;
  note: string;
}
export interface Release {
  decision: ReleaseDecision;
  note: string;
}
export type RunOrigin = "local" | "import" | "sample" | "official";
export interface RunRef {
  id: string;
  name: string;
  createdAt: string;
  origin: RunOrigin;
  stats: RunStats;
}
export interface EvalProject {
  version: 2;
  config: string;
  runs: RunRef[];
  current: string;
  baseline: Baseline;
  reviews: Record<string, Review>;
  releases: Record<string, Release>;
  gate: Gate;
}

export const PROJECT_LIMIT = 880_000;
export const DRAFT_LIMIT = 1_500_000;
export const CONFIG_LIMIT = 600_000;
export const MAX_RUNS = 60;
export const runIdPattern = /^[A-Za-z0-9_-]{6,80}$/;

export const blankConfig = `# promptfooconfig.yaml
description: 新的评测
prompts:
  - label: 版本 A
    raw: |
      请用一句话回答：{{question}}
providers:
  - id: echo
    label: 回显（模板检查）
tests:
  - description: 示例用例
    vars:
      question: 退货需要几天到账？
    assert:
      - type: icontains
        value: 退货
`;
export const emptyProject: EvalProject = {
  version: 2,
  config: blankConfig,
  runs: [],
  current: "",
  baseline: { kind: "none" },
  reviews: {},
  releases: {},
  gate: defaultGate,
};

const text = (v: unknown, max: number) => boundedText(v, max);
function stats(v: unknown): RunStats {
  if (!isRecord(v)) throw new Error("运行统计无效。");
  const out = {} as RunStats;
  for (const k of ["total", "pass", "fail", "error", "columns", "tests"] as const) {
    const x = v[k];
    if (typeof x !== "number" || !Number.isSafeInteger(x) || x < 0) throw new Error("运行统计无效。");
    out[k] = x;
  }
  return out;
}
function baselineValue(v: unknown): Baseline {
  if (!isRecord(v)) return { kind: "none" };
  if (v.kind === "prompt" && typeof v.prompt === "string" && v.prompt.length <= 2000) return { kind: "prompt", prompt: v.prompt };
  if (v.kind === "run" && typeof v.runId === "string" && runIdPattern.test(v.runId)) return { kind: "run", runId: v.runId };
  if (v.kind === "none") return { kind: "none" };
  throw new Error("对照基线无效。");
}
function gateValue(v: unknown): Gate {
  if (v === undefined) return defaultGate;
  if (!isRecord(v)) throw new Error("发布门槛无效。");
  const rate = Number(v.minPassRate),
    reg = Number(v.maxRegressions);
  if (!Number.isFinite(rate) || rate < 0 || rate > 1) throw new Error("通过率门槛需在 0–100% 之间。");
  if (!Number.isSafeInteger(reg) || reg < 0 || reg > 100000) throw new Error("允许退步数无效。");
  return { minPassRate: rate, maxRegressions: reg, allowErrors: v.allowErrors === true };
}
function keyed<T>(v: unknown, decode: (x: Record<string, unknown>) => T, max: number, what: string): Record<string, T> {
  if (v === undefined) return {};
  if (!isRecord(v)) throw new Error(`${what}无效。`);
  const out: Record<string, T> = {};
  const entries = Object.entries(v);
  if (entries.length > max) throw new Error(`${what}超过 ${max} 条。`);
  for (const [k, x] of entries) {
    if (["__proto__", "constructor", "prototype"].includes(k) || k.length > 300 || !isRecord(x)) throw new Error(`${what}无效。`);
    out[k] = decode(x);
  }
  return out;
}

function decode(v: unknown, max: number): EvalProject {
  if (!isRecord(v)) throw new Error("项目结构无效。");
  if (v.version !== 2) return legacy(v, max);
  if (!Array.isArray(v.runs) || v.runs.length > MAX_RUNS) throw new Error(`运行记录需为列表，最多 ${MAX_RUNS} 次。`);
  const runs = v.runs.map((r: unknown): RunRef => {
    if (!isRecord(r) || typeof r.id !== "string" || !runIdPattern.test(r.id)) throw new Error("运行记录无效。");
    if (!["local", "import", "sample", "official"].includes(String(r.origin))) throw new Error("运行来源无效。");
    return {
      id: r.id,
      name: text(r.name, 200),
      createdAt: text(r.createdAt, 40),
      origin: r.origin as RunOrigin,
      stats: stats(r.stats),
    };
  });
  if (new Set(runs.map((r) => r.id)).size !== runs.length) throw new Error("运行 ID 重复。");
  const current = text(v.current ?? "", 80);
  if (current && !runs.some((r) => r.id === current)) throw new Error("当前运行不存在。");
  const result: EvalProject = {
    version: 2,
    config: text(v.config, CONFIG_LIMIT),
    runs,
    current,
    baseline: baselineValue(v.baseline),
    reviews: keyed(
      v.reviews,
      (x) => {
        if (!["pending", "accept", "reject"].includes(String(x.decision))) throw new Error("复核记录无效。");
        return { decision: x.decision as Decision, note: text(x.note ?? "", 6000) };
      },
      20000,
      "复核记录",
    ),
    releases: keyed(
      v.releases,
      (x) => {
        if (!["pending", "ship", "hold", "block"].includes(String(x.decision))) throw new Error("发布判断无效。");
        return { decision: x.decision as ReleaseDecision, note: text(x.note ?? "", 6000) };
      },
      2000,
      "发布判断",
    ),
    gate: gateValue(v.gate),
  };
  if (new TextEncoder().encode(JSON.stringify(result)).length > max)
    throw new Error(
      max === PROJECT_LIMIT
        ? "项目超过 880KB（多为复核意见或配置过长），当前输入保留为草稿；请导出后拆分。"
        : "工作草稿已达到 1.5MB 容量，请先导出并拆分。",
    );
  return result;
}
/** 0.4 项目（reports 内嵌原始 JSON、suite 为 JSON 套件）只保留配置与复核；报告由服务端迁移进运行表。 */
function legacy(v: Record<string, unknown>, max: number): EvalProject {
  if (!Array.isArray(v.reports) || typeof v.suite !== "string") throw new Error("项目结构无效。");
  return decode({ ...emptyProject, config: legacySuiteToYaml(v.suite) }, max);
}
export function legacySuiteToYaml(suite: string): string {
  try {
    const s: unknown = JSON.parse(suite);
    if (!isRecord(s) || !Array.isArray(s.prompts) || !Array.isArray(s.tests)) return blankConfig;
    const lines = [`# 由 0.4 的 JSON 套件转换`, `description: ${JSON.stringify(String(s.description ?? "评测套件"))}`, "prompts:"];
    for (const p of s.prompts)
      if (isRecord(p)) lines.push(`  - label: ${JSON.stringify(String(p.label ?? "版本"))}`, `    raw: ${JSON.stringify(String(p.raw ?? ""))}`);
    lines.push("providers:", "  - id: echo", "    label: 回显（模板检查）", "tests:");
    for (const t of s.tests)
      if (isRecord(t)) lines.push(`  - vars: ${JSON.stringify(t.vars ?? {})}`, `    assert: ${JSON.stringify(t.assert ?? [])}`);
    return lines.join("\n") + "\n";
  } catch {
    return blankConfig;
  }
}

export function validateProject(v: unknown): EvalProject {
  return decode(v, PROJECT_LIMIT);
}
export function restoreProjectDraft(v: unknown): EvalProject {
  return decode(v, DRAFT_LIMIT);
}
export const reviewKey = (runId: string, cellKey: string) => `${runId}:${cellKey}`;
export const releaseKey = (runId: string, colKey: string) => `${runId}:${colKey}`;
