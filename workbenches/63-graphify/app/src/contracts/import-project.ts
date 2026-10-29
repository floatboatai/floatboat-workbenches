// ABOUTME: 导入完整项目、恢复稿、0.5 版旧项目与 Graphify 原生 graph.json；导入总是新建知识地图。

import { isRecord, boundedText } from "./project.ts";
import { graphValue, type Graph } from "./graph.ts";
import { emptyProject, isLegacyProject, refFor, restoreDraftData, type MapProject } from "./map.ts";
import { corpusEntry } from "./corpus.ts";
import { isHash, sha256 } from "./hash.ts";

export const PROJECT_FORMAT = "floatboat.graphify.project";

export type ProjectImport = {
  data: MapProject;
  title: string;
  extra: Record<string, unknown>;
  recovered: boolean;
  /** 需先上传到本机内容库的图谱与原文 */
  graph: Graph | null;
  sources: Map<string, string>;
  kind: "project" | "recovery" | "legacy" | "graph";
};

function sourcesValue(raw: unknown): Map<string, string> {
  const out = new Map<string, string>();
  if (!isRecord(raw)) return out;
  for (const [hash, text] of Object.entries(raw)) {
    if (!isHash(hash) || typeof text !== "string") throw new Error("项目中的原文格式无效。");
    if (sha256(text) !== hash) throw new Error("项目中的原文与内容地址不一致，文件可能已损坏。");
    out.set(hash, text);
  }
  return out;
}

/** 0.5 版：单文件源码＋内嵌图谱＋笔记与坐标。 */
function fromLegacy(data: Record<string, unknown> & { graph: Record<string, unknown> }) {
  const graph = graphValue(data.graph);
  const project = emptyProject();
  const sources = new Map<string, string>();
  const name = typeof data.name === "string" && data.name.trim() ? data.name.trim() : "source.py";
  if (typeof data.source === "string" && data.source.trim()) {
    try {
      const entry = corpusEntry(name, data.source);
      project.corpus = [entry];
      sources.set(entry.hash, data.source);
    } catch {
      /* 不支持的旧文件名：只保留图谱 */
    }
  }
  const ids = new Set(graph.nodes.map((n) => n.id));
  if (isRecord(data.notes))
    for (const [id, note] of Object.entries(data.notes)) if (typeof note === "string" && id !== "__proto__") project.notes[id] = note.slice(0, 8000);
  if (isRecord(data.positions))
    for (const [id, p] of Object.entries(data.positions))
      if (ids.has(id) && isRecord(p) && Number.isFinite(p.x) && Number.isFinite(p.y)) project.pins[id] = { x: Number(p.x), y: Number(p.y) };
  for (const key of ["selected", "from", "to"] as const) if (typeof data[key] === "string" && ids.has(data[key] as string)) project[key] = data[key] as string;
  project.graph = refFor(graph);
  return { project, graph, sources };
}

export function decodeProjectImport(raw: unknown, fallbackTitle = "导入的知识地图"): ProjectImport {
  if (!isRecord(raw)) throw new Error("文件不是 JSON 对象。");
  const recovered = isRecord(raw.snapshot);
  const snapshot = recovered ? (raw.snapshot as Record<string, unknown>) : raw;
  if (!isRecord(snapshot.data)) {
    if (recovered) throw new Error("恢复文件缺少工作稿数据。");
    // Graphify 原生 graph.json
    const graph = graphValue(raw);
    const data = { ...emptyProject(), graph: refFor(graph), selected: graph.nodes[0]?.id ?? "" };
    return { data, title: fallbackTitle, extra: {}, recovered: false, graph, sources: new Map(), kind: "graph" };
  }
  const title = boundedText(snapshot.title ?? fallbackTitle, 120) || fallbackTitle;
  if (snapshot.extra !== undefined && !isRecord(snapshot.extra)) throw new Error("工作稿附加数据格式无效。");
  const extra: Record<string, unknown> = isRecord(snapshot.extra) ? { ...snapshot.extra } : {};
  let data: MapProject, graph: Graph | null = null, sources = sourcesValue(raw.sources);
  let kind: ProjectImport["kind"] = recovered ? "recovery" : "project";
  if (isLegacyProject(snapshot.data)) {
    const legacy = fromLegacy(snapshot.data);
    data = legacy.project;
    graph = legacy.graph;
    for (const [h, t] of legacy.sources) sources.set(h, t);
    delete extra.graphJson;
    delete extra.extracted;
    kind = "legacy";
  } else {
    data = restoreDraftData(snapshot.data);
    if (raw.graph !== undefined) {
      graph = graphValue(raw.graph);
      const ref = refFor(graph);
      if (ref.hash !== data.graph.hash) throw new Error("项目文件中的图谱与工作稿引用不一致。");
    }
  }
  if (recovered || kind === "legacy") {
    const history: Record<string, unknown> = { recovered, legacy: kind === "legacy", importedAt: new Date().toISOString() };
    if (recovered && isRecord(raw.pending))
      history.autosave = { documentId: raw.pending.documentId, projectId: raw.pending.projectId, mutationId: raw.pending.mutationId };
    const prior = extra.importHistory;
    extra.importHistory = Array.isArray(prior) ? [...prior, history] : prior === undefined ? [history] : [{ previousHistory: prior }, history];
  }
  if (new TextEncoder().encode(JSON.stringify({ title, data, extra })).length > 1_850_000)
    throw new Error("完整工作稿超过 1.8MB，请在原项目中拆分资料集后再导出。");
  return { data, title, extra, recovered, graph, sources, kind };
}
