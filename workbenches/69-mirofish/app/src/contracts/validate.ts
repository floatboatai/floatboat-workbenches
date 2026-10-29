// ABOUTME: 推演工作对象的校验：严格模式供运行/保存使用，草稿模式恢复未完成的工作副本，并迁移 0.5 复核工程。
import { isRecord } from "./project.ts";
import { actionValue } from "./simulation.ts";
import {
  ENTITY_TYPES,
  LIMITS,
  RELATION_TYPES,
  blankScenario,
  type Agent,
  type Aspect,
  type Entity,
  type Params,
  type Relation,
  type Robustness,
  type RunRecord,
  type RunSummary,
  type Scenario,
  type SeedDoc,
  type SimEvent,
  type SimInput,
} from "./scenario.ts";

const ID = /^[A-Za-z0-9_:.-]{1,80}$/;
type Mode = "strict" | "draft";
const fail = (message: string): never => {
  throw new Error(message);
};
function text(v: unknown, max: number, label: string) {
  if (typeof v !== "string") fail(`${label}必须是文本`);
  if ((v as string).length > max) fail(`${label}不能超过${max}个字符`);
  return v as string;
}
function name(v: unknown, max: number, label: string, mode: Mode) {
  const s = text(v, max, label);
  if (mode === "strict" && !s.trim()) fail(`${label}不能为空`);
  return s;
}
function num(
  v: unknown,
  min: number,
  max: number,
  label: string,
  mode: Mode,
  integer = false,
) {
  if (typeof v !== "number" || !Number.isFinite(v)) fail(`${label}必须是数字`);
  const n = v as number;
  if (mode === "strict" && (n < min || n > max || (integer && !Number.isInteger(n))))
    fail(`${label}须在${min}–${max}之间${integer ? "的整数" : ""}`);
  if (Math.abs(n) > 1e9) fail(`${label}超出范围`);
  return n;
}
function id(v: unknown, label: string) {
  if (typeof v !== "string" || !ID.test(v)) fail(`${label}编号无效`);
  return v as string;
}
function oneOf<T extends string>(v: unknown, list: readonly T[], label: string): T {
  if (!list.includes(v as T)) fail(`${label}无效`);
  return v as T;
}
function list(v: unknown, max: number, label: string) {
  if (!Array.isArray(v)) fail(`${label}必须是列表`);
  if ((v as unknown[]).length > max) fail(`${label}最多${max}项`);
  return v as unknown[];
}

export function entityValue(v: unknown, mode: Mode = "strict"): Entity {
  if (!isRecord(v)) fail("实体必须是对象");
  const e = v as Record<string, unknown>;
  return {
    id: id(e.id, "实体"),
    name: name(e.name, 60, "实体名称", mode),
    type: oneOf(e.type, ENTITY_TYPES, "实体类型"),
    summary: text(e.summary ?? "", 2000, "实体说明"),
    stance: num(e.stance ?? 0, -1, 1, "初始立场", mode),
    mentions: num(e.mentions ?? 0, 0, 100000, "提及次数", "draft"),
    x: num(e.x ?? 0, -1e6, 1e6, "坐标", "draft"),
    y: num(e.y ?? 0, -1e6, 1e6, "坐标", "draft"),
    source: oneOf(e.source ?? "manual", ["rule", "manual", "host"] as const, "实体来源"),
  };
}
export function relationValue(v: unknown, mode: Mode = "strict"): Relation {
  if (!isRecord(v)) fail("关系必须是对象");
  const r = v as Record<string, unknown>;
  const out: Relation = {
    id: id(r.id, "关系"),
    source: id(r.source, "关系起点"),
    target: id(r.target, "关系终点"),
    type: oneOf(r.type, RELATION_TYPES, "关系类型"),
    evidence: text(r.evidence ?? "", 600, "关系依据"),
    source_kind: oneOf(r.source_kind ?? "manual", ["rule", "manual"] as const, "关系来源"),
  };
  if (mode === "strict" && out.source === out.target) fail("关系两端不能是同一实体");
  return out;
}
export function agentValue(v: unknown, mode: Mode = "strict"): Agent {
  if (!isRecord(v)) fail("智能体必须是对象");
  const a = v as Record<string, unknown>;
  const hours = list(a.activeHours ?? [], 24, "活跃时段").map((h) =>
    num(h, 0, 23, "活跃时段", "strict", true),
  );
  return {
    id: num(a.id, 0, 100000, "智能体编号", "strict", true),
    entityId: id(a.entityId, "来源实体"),
    name: name(a.name, 60, "智能体名称", mode),
    handle: text(a.handle ?? "", 40, "账号"),
    type: oneOf(a.type, ENTITY_TYPES, "智能体类型"),
    profession: text(a.profession ?? "", 80, "职业"),
    bio: text(a.bio ?? "", 600, "简介"),
    persona: text(a.persona ?? "", 3000, "人设"),
    stance: num(a.stance, -1, 1, "立场", mode),
    activity: num(a.activity, 0, 1, "活跃度", mode),
    influence: num(a.influence, 0.1, 5, "影响力", mode),
    stubbornness: num(a.stubbornness, 0, 1, "坚持度", mode),
    platform: oneOf(a.platform, ["twitter", "reddit", "both"] as const, "平台"),
    activeHours: hours,
    topics: list(a.topics ?? [], 8, "关注议题").map((t) => text(t, 40, "关注议题")),
    source: oneOf(a.source ?? "manual", ["rule", "host", "manual"] as const, "人设来源"),
  };
}
export function aspectValue(v: unknown, mode: Mode = "strict"): Aspect {
  if (!isRecord(v)) fail("议题要点必须是对象");
  const a = v as Record<string, unknown>;
  return {
    id: id(a.id, "议题要点"),
    label: name(a.label, 30, "议题要点", mode),
    lean: a.lean === -1 ? -1 : a.lean === 1 ? 1 : fail("议题要点倾向无效"),
  };
}
export function paramsValue(v: unknown, mode: Mode = "strict"): Params {
  if (!isRecord(v)) fail("推演参数无效");
  const p = v as Record<string, unknown>;
  const start = text(p.start, 16, "开始时间");
  if (mode === "strict" && !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(start))
    fail("开始时间格式应为 YYYY-MM-DDTHH:mm");
  return {
    seed: name(p.seed, 60, "随机种子", mode),
    rounds: num(p.rounds, 1, LIMITS.rounds, "轮次", mode, true),
    minutesPerRound: num(p.minutesPerRound, 10, 1440, "每轮分钟", mode, true),
    start,
    platform: oneOf(p.platform, ["parallel", "twitter", "reddit"] as const, "平台"),
    confidence: num(p.confidence, 0.05, 2, "信任阈值", mode),
    influenceRate: num(p.influenceRate, 0.01, 0.6, "影响速率", mode),
    echoChamber: num(p.echoChamber, 0, 1, "回音室强度", mode),
    backfire: num(p.backfire, 0, 1, "逆火强度", mode),
    noise: num(p.noise, 0, 0.3, "随机扰动", mode),
    feedSize: num(p.feedSize, 1, 12, "每轮阅读条数", mode, true),
  };
}
export function eventValue(v: unknown, mode: Mode = "strict"): SimEvent {
  if (!isRecord(v)) fail("事件必须是对象");
  const e = v as Record<string, unknown>;
  const target = text(e.target ?? "all", 100, "事件对象");
  if (
    target !== "all" &&
    !/^type:/.test(target) &&
    !/^entity:[A-Za-z0-9_:.-]{1,80}$/.test(target)
  )
    fail("事件对象无效");
  return {
    id: id(e.id, "事件"),
    round: num(e.round, 0, LIMITS.rounds, "事件轮次", mode, true),
    title: name(e.title, 80, "事件标题", mode),
    text: text(e.text ?? "", 1000, "事件内容"),
    push: num(e.push, -1, 1, "事件推力", mode),
    target,
    reach: num(e.reach, 0, 1, "触达比例", mode),
    author:
      e.author === null || e.author === undefined
        ? null
        : num(e.author, 0, 100000, "发布者", "strict", true),
  };
}
function summaryValue(v: unknown): RunSummary {
  if (!isRecord(v)) fail("运行摘要无效");
  const s = v as Record<string, unknown>;
  const n = (k: string, min = -1e9, max = 1e9) => num(s[k], min, max, "运行摘要", "strict");
  return {
    rounds: n("rounds", 0),
    agents: n("agents", 0),
    actions: n("actions", 0),
    posts: n("posts", 0),
    startMean: n("startMean", -1, 1),
    endMean: n("endMean", -1, 1),
    endSupport: n("endSupport", 0, 1),
    endNeutral: n("endNeutral", 0, 1),
    endOppose: n("endOppose", 0, 1),
    polarization: n("polarization", 0, 10),
    stanceKind: oneOf(s.stanceKind, ["model", "lexicon"] as const, "立场来源"),
  };
}
function robustnessValue(v: unknown): Robustness | null {
  if (v === null || v === undefined) return null;
  if (!isRecord(v)) fail("稳健性记录无效");
  const r = v as Record<string, unknown>;
  const nums = (k: string) =>
    list(r[k], 20, "稳健性").map((x) => num(x, -1, 1, "稳健性", "strict"));
  return {
    seeds: list(r.seeds, 20, "稳健性").map((x) => text(x, 80, "种子")),
    endSupport: nums("endSupport"),
    endOppose: nums("endOppose"),
    endMean: nums("endMean"),
  };
}
export function simInputValue(v: unknown, mode: Mode = "strict"): SimInput {
  if (!isRecord(v)) fail("推演输入无效");
  const s = v as Record<string, unknown>;
  const agents = list(s.agents, LIMITS.agents, "智能体").map((a) => agentValue(a, mode));
  const ids = new Set(agents.map((a) => a.id));
  if (ids.size !== agents.length) fail("智能体编号重复");
  const edges = list(s.edges, 60000, "关注关系").map((e) => {
    if (!Array.isArray(e) || e.length !== 2) fail("关注关系无效");
    const [a, b] = e as unknown[];
    if (!ids.has(a as number) || !ids.has(b as number)) fail("关注关系指向不存在的智能体");
    return [a, b] as [number, number];
  });
  return {
    question: text(s.question, 500, "推演问题"),
    topic: text(s.topic, 40, "话题"),
    agents,
    edges,
    aspects: list(s.aspects, LIMITS.aspects, "议题要点").map((a) => aspectValue(a, mode)),
    params: paramsValue(s.params, mode),
    events: list(s.events, LIMITS.events, "事件").map((e) => eventValue(e, mode)),
  };
}
function runValue(v: unknown): RunRecord {
  if (!isRecord(v)) fail("运行记录无效");
  const r = v as Record<string, unknown>;
  const engine = oneOf(r.engine, ["local", "mirofish", "import"] as const, "运行引擎");
  const legacy =
    r.legacyActions === null || r.legacyActions === undefined
      ? null
      : list(r.legacyActions, 500, "旧版动作").map((a) => actionValue(a));
  const resultId = text(r.resultId ?? "", 80, "结果编号");
  if (!legacy && !ID.test(resultId)) fail("运行结果编号无效");
  return {
    id: id(r.id, "运行"),
    label: text(r.label, 80, "运行名称"),
    engine,
    createdAt: text(r.createdAt, 40, "运行时间"),
    resultId,
    fingerprint: text(r.fingerprint ?? "", 40, "结果指纹"),
    sourceName: text(r.sourceName ?? "", 200, "来源"),
    summary: summaryValue(r.summary),
    robustness: robustnessValue(r.robustness),
    input: engine === "local" ? simInputValue(r.input) : null,
    legacyActions: legacy,
  };
}

function scenarioWith(v: unknown, mode: Mode): Scenario {
  if (isRecord(v) && v.version === undefined && Array.isArray(v.actions)) return fromLegacyReview(v);
  if (!isRecord(v) || v.version !== 2) fail("推演文件格式无效");
  const s = v as Record<string, unknown>;
  const seeds = list(s.seeds, LIMITS.seedDocs, "种子资料").map((d): SeedDoc => {
    if (!isRecord(d)) return fail("种子资料无效");
    return {
      id: id(d.id, "资料"),
      name: text(d.name, 200, "资料名称"),
      text: text(d.text, LIMITS.seedChars, "资料正文"),
    };
  });
  if (seeds.reduce((n, d) => n + d.text.length, 0) > LIMITS.seedChars)
    fail(`种子资料合计不能超过${LIMITS.seedChars}字`);
  const entities = list(s.entities, LIMITS.entities, "实体").map((e) => entityValue(e, mode));
  const entityIds = new Set(entities.map((e) => e.id));
  if (entityIds.size !== entities.length) fail("实体编号重复");
  const relations = list(s.relations, LIMITS.relations, "关系").map((r) => relationValue(r, mode));
  for (const r of relations)
    if (!entityIds.has(r.source) || !entityIds.has(r.target)) fail("关系指向不存在的实体");
  const agents = list(s.agents, LIMITS.agents, "智能体").map((a) => agentValue(a, mode));
  const agentIds = new Set(agents.map((a) => a.id));
  if (agentIds.size !== agents.length) fail("智能体编号重复");
  if (mode === "strict")
    for (const a of agents) if (!entityIds.has(a.entityId)) fail(`智能体“${a.name}”的来源实体已删除`);
  const events = list(s.events, LIMITS.events, "事件").map((e) => eventValue(e, mode));
  if (mode === "strict")
    for (const e of events) {
      if (e.author !== null && !agentIds.has(e.author)) fail(`事件“${e.title}”的发布者不存在`);
      if (e.target.startsWith("entity:") && !entityIds.has(e.target.slice(7)))
        fail(`事件“${e.title}”的对象实体不存在`);
    }
  const runs = list(s.runs, LIMITS.runs, "运行记录").map(runValue);
  const report = isRecord(s.report) ? s.report : fail("报告无效");
  return {
    version: 2,
    question: text(s.question, 500, "推演问题"),
    topic: text(s.topic, 40, "话题"),
    origin: oneOf(s.origin, ["example", "blank", "import"] as const, "来源"),
    seeds,
    entities,
    relations,
    agents,
    aspects: list(s.aspects, LIMITS.aspects, "议题要点").map((a) => aspectValue(a, mode)),
    params: paramsValue(s.params, mode),
    events,
    runs,
    activeRun: text(s.activeRun ?? "", 80, "当前运行"),
    report: {
      runId: text(report.runId ?? "", 80, "报告运行"),
      markdown: text(report.markdown ?? "", 200_000, "报告正文"),
      source: oneOf(report.source ?? "manual", ["rule", "host", "manual"] as const, "报告来源"),
      updatedAt: text(report.updatedAt ?? "", 40, "报告时间"),
    },
    notes: text(s.notes ?? "", 20_000, "备注"),
  };
}
/** Strict model validation: what a run, export or saved project may rely on. */
export const scenarioValue = (v: unknown) => scenarioWith(v, "strict");
/** Working-copy restoration: structure and sizes enforced, unfinished business values allowed. */
export const restoreScenario = (v: unknown) => scenarioWith(v, "draft");

/** First validation problem of the working copy, or "" when it can be run and saved. */
export function scenarioProblem(v: Scenario): string {
  try {
    scenarioValue(v);
    return "";
  } catch (e) {
    return e instanceof Error ? e.message : "推演内容无效";
  }
}

/** 0.5 review projects stored native actions inline; keep them as a read-only imported run. */
function fromLegacyReview(v: Record<string, unknown>): Scenario {
  const actions = list(v.actions, 500, "旧版动作").map((a) => actionValue(a));
  const base = blankScenario();
  const run: RunRecord = {
    id: "legacy",
    label: "0.5 复核导入",
    engine: v.origin === "service" ? "mirofish" : "import",
    createdAt: "",
    resultId: "",
    fingerprint: "",
    sourceName: text(v.sourceName ?? "", 200, "来源"),
    summary: {
      rounds: new Set(actions.map((a) => a.round_num)).size,
      agents: new Set(actions.map((a) => a.platform + a.agent_id)).size,
      actions: actions.length,
      posts: actions.filter((a) => /POST|COMMENT/.test(a.action_type)).length,
      startMean: 0,
      endMean: 0,
      endSupport: 0,
      endNeutral: 1,
      endOppose: 0,
      polarization: 0,
      stanceKind: "lexicon",
    },
    robustness: null,
    input: null,
    legacyActions: actions,
  };
  const notes = [v.background, v.assumptions, v.conclusion]
    .filter((x) => typeof x === "string" && x.trim())
    .join("\n\n");
  return {
    ...base,
    origin: "import",
    question: text(v.simulationId ?? "", 500, "推演问题"),
    runs: [run],
    activeRun: run.id,
    notes: notes.slice(0, 20_000),
  };
}
