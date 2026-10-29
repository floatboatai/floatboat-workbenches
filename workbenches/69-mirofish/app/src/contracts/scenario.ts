// ABOUTME: 推演工作对象：种子资料、实体关系图谱、智能体人设、推演参数、事件注入、运行记录与报告。
import type { Action } from "./simulation.ts";

export const ENTITY_TYPES = [
  "政府机构",
  "企业",
  "媒体",
  "社会组织",
  "学术机构",
  "群体",
  "个人",
  "议题",
] as const;
export type EntityType = (typeof ENTITY_TYPES)[number];
export const RELATION_TYPES = [
  "支持",
  "反对",
  "质疑",
  "监管",
  "合作",
  "报道",
  "隶属",
  "竞争",
  "关联",
] as const;
export type RelationType = (typeof RELATION_TYPES)[number];
/** Types that cannot speak on a platform and therefore never become agents. */
export const SILENT_TYPES: readonly EntityType[] = ["议题"];

export const LIMITS = {
  seedDocs: 12,
  seedChars: 200_000,
  entities: 160,
  relations: 600,
  agents: 200,
  rounds: 240,
  events: 40,
  aspects: 16,
  runs: 8,
};

export type SeedDoc = { id: string; name: string; text: string };
export type Entity = {
  id: string;
  name: string;
  type: EntityType;
  summary: string;
  /** Initial stance on the scenario question, -1 opposing … +1 supportive. */
  stance: number;
  mentions: number;
  x: number;
  y: number;
  source: "rule" | "manual" | "host";
};
export type Relation = {
  id: string;
  source: string;
  target: string;
  type: RelationType;
  evidence: string;
  source_kind: "rule" | "manual";
};
export type Platform = "twitter" | "reddit";
export type Agent = {
  id: number;
  entityId: string;
  name: string;
  handle: string;
  type: EntityType;
  profession: string;
  bio: string;
  persona: string;
  stance: number;
  activity: number;
  influence: number;
  stubbornness: number;
  platform: Platform | "both";
  activeHours: number[];
  topics: string[];
  source: "rule" | "host" | "manual";
};
export type Aspect = { id: string; label: string; lean: 1 | -1 };
export type Params = {
  seed: string;
  rounds: number;
  minutesPerRound: number;
  start: string;
  platform: "parallel" | Platform;
  confidence: number;
  influenceRate: number;
  echoChamber: number;
  backfire: number;
  noise: number;
  feedSize: number;
};
export type SimEvent = {
  id: string;
  round: number;
  title: string;
  text: string;
  push: number;
  target: string;
  reach: number;
  author: number | null;
};
export type RunSummary = {
  rounds: number;
  agents: number;
  actions: number;
  posts: number;
  startMean: number;
  endMean: number;
  endSupport: number;
  endNeutral: number;
  endOppose: number;
  polarization: number;
  stanceKind: "model" | "lexicon";
};
export type Robustness = {
  seeds: string[];
  endSupport: number[];
  endOppose: number[];
  endMean: number[];
};
export type RunRecord = {
  id: string;
  label: string;
  engine: "local" | "mirofish" | "import";
  createdAt: string;
  resultId: string;
  fingerprint: string;
  sourceName: string;
  summary: RunSummary;
  robustness: Robustness | null;
  /** Local runs keep the complete deterministic input so results can be regenerated. */
  input: SimInput | null;
  /** Only legacy 0.5 review projects carry inline native actions until uploaded. */
  legacyActions: Action[] | null;
};
export type Report = {
  runId: string;
  markdown: string;
  source: "rule" | "host" | "manual";
  updatedAt: string;
};
export type Scenario = {
  version: 2;
  question: string;
  topic: string;
  origin: "example" | "blank" | "import";
  seeds: SeedDoc[];
  entities: Entity[];
  relations: Relation[];
  agents: Agent[];
  aspects: Aspect[];
  params: Params;
  events: SimEvent[];
  runs: RunRecord[];
  activeRun: string;
  report: Report;
  notes: string;
};
export type SimInput = {
  question: string;
  topic: string;
  agents: Agent[];
  edges: Array<[number, number]>;
  aspects: Aspect[];
  params: Params;
  events: SimEvent[];
};

export const defaultParams = (): Params => ({
  seed: "mirofish-2027",
  rounds: 36,
  minutesPerRound: 60,
  start: "2027-03-01T08:00",
  platform: "parallel",
  confidence: 0.7,
  influenceRate: 0.18,
  echoChamber: 0.5,
  backfire: 0.15,
  noise: 0.02,
  feedSize: 5,
});

export function blankScenario(): Scenario {
  return {
    version: 2,
    question: "",
    topic: "",
    origin: "blank",
    seeds: [],
    entities: [],
    relations: [],
    agents: [],
    aspects: [],
    params: defaultParams(),
    events: [],
    runs: [],
    activeRun: "",
    report: { runId: "", markdown: "", source: "rule", updatedAt: "" },
    notes: "",
  };
}

export const clamp = (v: number, min = -1, max = 1) => Math.min(max, Math.max(min, v));
export function stanceLabel(s: number) {
  return s > 0.5 ? "强烈支持" : s > 0.2 ? "倾向支持" : s >= -0.2 ? "中立观望" : s >= -0.5 ? "倾向反对" : "强烈反对";
}
export function newId(prefix: string) {
  const r =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID().slice(0, 8)
      : Math.random().toString(16).slice(2, 10);
  return `${prefix}-${r}`;
}

/** Follow graph between agents derived from entity relations; deterministic for a given scenario. */
export function deriveEdges(s: Pick<Scenario, "agents" | "relations">): Array<[number, number]> {
  const byEntity = new Map<string, number[]>();
  for (const a of s.agents) byEntity.set(a.entityId, [...(byEntity.get(a.entityId) ?? []), a.id]);
  const out = new Set<string>();
  const add = (a: number, b: number) => {
    if (a !== b) out.add(a + ">" + b);
  };
  for (const ids of byEntity.values()) for (const a of ids) for (const b of ids) add(a, b);
  for (const r of s.relations) {
    const from = byEntity.get(r.source) ?? [],
      to = byEntity.get(r.target) ?? [];
    for (const a of from)
      for (const b of to) {
        add(a, b);
        // Opponents and regulators watch each other; cooperation and coverage are mutual too.
        if (r.type !== "隶属") add(b, a);
      }
  }
  // Everyone follows the most influential voices of public institutions and the press.
  const loud = [...s.agents]
    .filter((a) => a.type === "媒体" || a.type === "政府机构")
    .sort((a, b) => b.influence - a.influence || a.id - b.id)
    .slice(0, 3);
  for (const a of s.agents) for (const b of loud) add(a.id, b.id);
  return [...out]
    .map((k) => k.split(">").map(Number) as [number, number])
    .sort((a, b) => a[0] - b[0] || a[1] - b[1]);
}

/** Detached snapshot: later edits to the scenario never change a recorded run's input. */
export function simInput(s: Scenario): SimInput {
  return JSON.parse(JSON.stringify({
    question: s.question,
    topic: s.topic,
    agents: s.agents,
    edges: deriveEdges(s),
    aspects: s.aspects,
    params: s.params,
    events: s.events,
  }));
}
