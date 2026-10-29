// ABOUTME: 知识地图工作对象：资料清单、图谱内容地址、社区命名、人工笔记与固定位置。

import { boundedText, isRecord } from "./project.ts";
import { corpusFileValue, type CorpusFile, type SkippedFile } from "./corpus.ts";
import { isHash, sha256 } from "./hash.ts";
import type { CommunityMeta } from "./analysis.ts";
import type { Graph } from "./graph.ts";

export type Point = { x: number; y: number };
export type GraphRef = {
  hash: string;
  nodes: number;
  links: number;
  generator: string;
  builtAt: string;
};
export type MapProject = {
  version: 2;
  corpus: CorpusFile[];
  skipped: SkippedFile[];
  graph: GraphRef;
  communities: CommunityMeta[];
  hidden: number[];
  notes: Record<string, string>;
  pins: Record<string, Point>;
  selected: string;
  from: string;
  to: string;
  ignoreDirection: boolean;
};

export const PROJECT_LIMITS = { corpus: 3000, skipped: 300, notes: 3000, pins: 8000, communities: 500 };

export const EMPTY_GRAPH: Graph = {
  directed: true,
  multigraph: false,
  graph: { schema_version: 1 },
  nodes: [],
  links: [],
  hyperedges: [],
};
export const graphText = (graph: Graph) => JSON.stringify(graph);
export function refFor(graph: Graph, builtAt = ""): GraphRef {
  return {
    hash: sha256(graphText(graph)),
    nodes: graph.nodes.length,
    links: graph.links.length,
    generator: String((graph.graph as Record<string, unknown> | undefined)?.generator ?? "imported"),
    builtAt,
  };
}
export const EMPTY_REF = refFor(EMPTY_GRAPH);

export function emptyProject(): MapProject {
  return {
    version: 2,
    corpus: [],
    skipped: [],
    graph: { ...EMPTY_REF },
    communities: [],
    hidden: [],
    notes: {},
    pins: {},
    selected: "",
    from: "",
    to: "",
    ignoreDirection: false,
  };
}

const idText = (v: unknown) => (v === undefined ? "" : boundedText(v, 300));
function refValue(v: unknown): GraphRef {
  if (!isRecord(v) || !isHash(v.hash) || !Number.isInteger(v.nodes) || !Number.isInteger(v.links))
    throw new Error("图谱引用无效。");
  return {
    hash: v.hash,
    nodes: Number(v.nodes),
    links: Number(v.links),
    generator: boundedText(v.generator ?? "", 200),
    builtAt: boundedText(v.builtAt ?? "", 40),
  };
}
function communityValue(v: unknown): CommunityMeta {
  if (!isRecord(v) || !Number.isInteger(v.id) || Number(v.id) < 0 || !["auto", "host", "manual"].includes(String(v.origin)))
    throw new Error("社区名称格式无效。");
  return {
    id: Number(v.id),
    label: boundedText(v.label, 80),
    summary: boundedText(v.summary ?? "", 600),
    origin: v.origin as CommunityMeta["origin"],
  };
}

export function isLegacyProject(value: unknown): value is Record<string, unknown> & { graph: Record<string, unknown> } {
  return isRecord(value) && value.version === undefined && isRecord(value.graph) && Array.isArray(value.graph.nodes);
}

function decode(value: unknown, working: boolean): MapProject {
  if (!isRecord(value) || value.version !== 2) throw new Error("知识地图格式无效或来自旧版本。");
  const limit = working ? 1_800_000 : 900_000;
  if (new TextEncoder().encode(JSON.stringify(value)).length > limit)
    throw new Error("知识地图工作稿过大（资料清单或笔记过多），请拆分资料集。");
  if (!Array.isArray(value.corpus) || value.corpus.length > PROJECT_LIMITS.corpus) throw new Error("资料清单无效。");
  const corpus = value.corpus.map(corpusFileValue);
  const paths = new Set<string>();
  for (const c of corpus) {
    if (paths.has(c.path)) throw new Error(`资料清单路径重复：${c.path}`);
    paths.add(c.path);
  }
  const skippedRaw = Array.isArray(value.skipped) ? value.skipped.slice(0, PROJECT_LIMITS.skipped) : [];
  const skipped = skippedRaw.map((s) => {
    if (!isRecord(s)) throw new Error("跳过清单格式无效。");
    return { path: boundedText(s.path, 400), reason: boundedText(s.reason, 200) };
  });
  if (!isRecord(value.notes) || Object.keys(value.notes).length > PROJECT_LIMITS.notes) throw new Error("笔记格式无效。");
  const notes: Record<string, string> = {};
  for (const [id, note] of Object.entries(value.notes)) {
    if (!id || id.length > 300 || id === "__proto__") throw new Error("笔记编号无效。");
    notes[id] = boundedText(note, 8000);
  }
  if (!isRecord(value.pins) || Object.keys(value.pins).length > PROJECT_LIMITS.pins) throw new Error("节点位置格式无效。");
  const pins: Record<string, Point> = {};
  for (const [id, p] of Object.entries(value.pins)) {
    if (
      !id || id === "__proto__" || !isRecord(p) ||
      typeof p.x !== "number" || typeof p.y !== "number" ||
      !Number.isFinite(p.x) || !Number.isFinite(p.y) || Math.abs(p.x) > 1e6 || Math.abs(p.y) > 1e6
    )
      throw new Error("节点位置无效。");
    pins[id] = { x: p.x, y: p.y };
  }
  const communitiesRaw = Array.isArray(value.communities) ? value.communities : [];
  if (communitiesRaw.length > PROJECT_LIMITS.communities) throw new Error("社区名称过多。");
  const hidden = Array.isArray(value.hidden) ? value.hidden.filter((x): x is number => Number.isInteger(x) && x >= 0).slice(0, 2000) : [];
  return {
    version: 2,
    corpus,
    skipped,
    graph: refValue(value.graph),
    communities: communitiesRaw.map(communityValue),
    hidden,
    notes,
    pins,
    selected: idText(value.selected),
    from: idText(value.from),
    to: idText(value.to),
    ignoreDirection: value.ignoreDirection === true,
  };
}

export const projectValue = (value: unknown): MapProject => decode(value, false);
export const restoreDraftData = (value: unknown): MapProject => decode(value, true);
