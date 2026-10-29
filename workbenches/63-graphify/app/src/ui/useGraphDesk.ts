// ABOUTME: 知识地图业务状态：工作对象、图谱加载与布局、资料抽取、导入导出、路径、检索与可选模型命名。

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigation } from "./navigation.ts";
import { useProjects, request, download } from "./workspace.tsx";
import { isRecord } from "../contracts/project.ts";
import { communityOf, field, label, lineOf, shortestPath, graphValue, type Graph, type Node } from "../contracts/graph.ts";
import { carryCommunityNames, summarizeCommunities, type CommunityMeta } from "../contracts/analysis.ts";
import { corpusEntry, type CorpusFile, type SkippedFile } from "../contracts/corpus.ts";
import { emptyProject, EMPTY_REF, graphText, projectValue, restoreDraftData, type GraphRef, type MapProject, type Point } from "../contracts/map.ts";
import { sample, SAMPLE_NAME } from "../contracts/sample/index.ts";
import { sha256 } from "../contracts/hash.ts";
import { decodeProjectImport, PROJECT_FORMAT } from "../contracts/import-project.ts";
import { exportGraphJson, exportGraphML, exportHtmlReport, exportMarkdownReport } from "../contracts/exporters.ts";
import { buildEnhanceRequest } from "../contracts/enhance.ts";
import { cachedGraph, loadGraph, loadText, rememberGraph, uploadTexts, type UploadItem } from "./data.ts";
import { startLayout, type Layout } from "./layout.ts";
import type { Picked, Selection } from "./files.ts";

export type Panel = "communities" | "sources";
export type MobileView = "map" | "side" | "detail";
export type Engine = { builtin: boolean; graphify: { available: boolean; engine: string; message: string; start: string[] } | null; checking: boolean };
export type HostState = { llm: "checking" | "available" | "unavailable" | "not-connected"; message: string };
export type Progress = { phase: string; done: number; total: number } | null;
type Inspect = { tab: "detail" | "source"; file: string; line: number; end: number };

const NEW_TITLE = "未命名知识地图";
const JSON_EDIT_LIMIT = 600_000;

export function useGraphDesk() {
  const demo = useMemo(() => sample(), []);
  const base = useProjects(demo.project, projectValue, SAMPLE_NAME, { storageKey: "graphify-map-v2", restoreDraftData });
  const navigation = useNavigation();
  const p = {
    ...base,
    busy: base.busy || navigation.transitioning,
    open: (id: string) => navigation.run(() => base.open(id)),
    setData: (value: Parameters<typeof base.setData>[0]) => {
      if (!navigation.active.current) base.setData(value);
    },
    setDraft: (value: Parameters<typeof base.setDraft>[0]) => {
      if (!navigation.active.current) base.setDraft(value);
    },
    setTitle: (value: string) => {
      if (!navigation.active.current) base.setTitle(value);
    },
    save: () => (navigation.active.current ? Promise.resolve(null) : base.save()),
    remove: () => navigation.run(() => base.remove()),
  };
  const mutable = !p.loading && !p.busy;
  const epoch = useRef(p.documentKey);
  epoch.current = p.documentKey;
  const d = p.data;
  const latest = useRef({ data: d, draft: p.draft });
  latest.current = { data: d, draft: p.draft };

  // ---------- 图谱 ----------
  const [graphState, setGraphState] = useState<{ hash: string; graph: Graph | null; error: string }>(() => ({
    hash: d.graph.hash,
    graph: cachedGraph(d.graph.hash),
    error: "",
  }));
  useEffect(() => {
    const hash = d.graph.hash;
    const hit = cachedGraph(hash);
    if (hit) {
      setGraphState({ hash, graph: hit, error: "" });
      return;
    }
    let live = true;
    setGraphState({ hash, graph: null, error: "" });
    loadGraph(hash).then(
      (graph) => live && setGraphState({ hash, graph, error: "" }),
      (e) => live && setGraphState({ hash, graph: null, error: e instanceof Error ? e.message : "图谱读取失败" }),
    );
    return () => {
      live = false;
    };
  }, [d.graph.hash]);
  const graph = graphState.hash === d.graph.hash && graphState.graph ? graphState.graph : null;
  const shown: Graph = graph ?? (cachedGraph(EMPTY_REF.hash) as Graph);
  const byId = useMemo(() => new Map(shown.nodes.map((n) => [n.id, n])), [shown]);
  const communities = useMemo(() => summarizeCommunities(shown, d.communities), [shown, d.communities]);
  const hidden = useMemo(() => new Set(d.hidden), [d.hidden]);

  // ---------- 布局 ----------
  const [layout, setLayout] = useState<Layout | null>(null);
  const [layoutDone, setLayoutDone] = useState(false);
  const [layoutEpoch, setLayoutEpoch] = useState(0);
  const pinsRef = useRef(d.pins);
  pinsRef.current = d.pins;
  useEffect(() => {
    if (!graph) {
      setLayout(null);
      return;
    }
    setLayoutDone(false);
    return startLayout(graph, pinsRef.current, (l, done) => {
      setLayout({ ...l });
      if (done) setLayoutDone(true);
    });
  }, [graph, layoutEpoch, p.documentKey]);
  const relayout = () => {
    p.setData((x) => ({ ...x, pins: {} }));
    pinsRef.current = {};
    setLayoutEpoch((n) => n + 1);
  };

  // ---------- 选择、检索、路径 ----------
  const selected = byId.get(d.selected);
  const [query, setQuery] = useState("");
  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return null;
    const hits = shown.nodes.filter((n) =>
      [label(n), n.id, field(n, "source_file"), field(n, "summary")].some((s) => s.toLowerCase().includes(q)),
    );
    return hits;
  }, [query, shown]);
  const matchSet = useMemo(() => (matches ? new Set(matches.map((n) => n.id)) : null), [matches]);
  const path = useMemo(() => (d.from && d.to ? shortestPath(shown, d.from, d.to, d.ignoreDirection) : []), [shown, d.from, d.to, d.ignoreDirection]);
  const pathNodes = useMemo(() => new Set(path.map((s) => s.id)), [path]);
  const pathLinks = useMemo(() => {
    const set = new Set<number>();
    const index = new Map(shown.links.map((l, i) => [l, i]));
    for (const s of path) if (s.via) set.add(index.get(s.via)!);
    return set;
  }, [path, shown]);
  const select = useCallback(
    (id: string) => {
      p.setData((x) => (x.selected === id ? x : { ...x, selected: id }));
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );
  const orphanNotes = useMemo(() => Object.keys(d.notes).filter((id) => !byId.has(id) && d.notes[id].trim()), [d.notes, byId]);

  // ---------- 原文 ----------
  const [inspect, setInspect] = useState<Inspect>({ tab: "detail", file: "", line: 0, end: 0 });
  const [mobile, setMobile] = useState<MobileView>("map");
  const [panel, setPanel] = useState<Panel>("communities");
  useEffect(() => {
    setInspect({ tab: "detail", file: "", line: 0, end: 0 });
    setQuery("");
  }, [p.documentKey]);
  function openSource(node: Node | undefined) {
    const file = field(node, "source_file");
    if (!file) return;
    const lines = lineOf(node) ?? [1, 1];
    setInspect({ tab: "source", file, line: lines[0], end: lines[1] });
    setMobile("detail");
  }
  function openFileAt(file: string, line: number) {
    setInspect({ tab: "source", file, line, end: line });
    setMobile("detail");
  }

  // ---------- 引擎状态 ----------
  const [engine, setEngine] = useState<Engine>({ builtin: true, graphify: null, checking: true });
  const checkEngine = useCallback(async () => {
    setEngine((e) => ({ ...e, checking: true }));
    try {
      const raw = await request("/api/engine");
      const g = isRecord(raw) && isRecord(raw.graphify) ? raw.graphify : null;
      setEngine({
        builtin: true,
        checking: false,
        graphify: g
          ? { available: g.available === true, engine: String(g.engine ?? ""), message: String(g.message ?? ""), start: Array.isArray(g.start) ? g.start.map(String) : [] }
          : null,
      });
    } catch {
      setEngine({ builtin: true, checking: false, graphify: { available: false, engine: "Graphify Python 服务", message: "无法检查服务状态，请重试。", start: [] } });
    }
  }, []);
  const [useService, setUseService] = useState(false);
  const [host, setHost] = useState<HostState>({ llm: "checking", message: "正在检查 Floatboat 连接…" });
  const checkHost = useCallback(async () => {
    setHost({ llm: "checking", message: "正在检查 Floatboat 连接…" });
    try {
      const raw = await request("/api/host/status");
      if (!isRecord(raw) || typeof raw.llm !== "string") throw new Error();
      setHost({ llm: raw.llm as HostState["llm"], message: String(raw.message ?? "") });
    } catch {
      setHost({ llm: "unavailable", message: "无法检查 Floatboat 连接，请重试。" });
    }
  }, []);
  useEffect(() => {
    void checkEngine();
    void checkHost();
  }, [checkEngine, checkHost]);
  useEffect(() => {
    if (!engine.checking && !engine.graphify?.available) setUseService(false);
  }, [engine]);

  // ---------- 抽取 ----------
  const [progress, setProgress] = useState<Progress>(null);
  const [lastRun, setLastRun] = useState<{ files: number; skipped: SkippedFile[]; engine: string; nodes: number; links: number; communities: number } | null>(null);
  useEffect(() => {
    setProgress(null);
    setLastRun(null);
    setJsonOpen(false);
  }, [p.documentKey]);
  const applyGraph = useCallback(
    (ref: GraphRef, next: Graph, corpus: CorpusFile[] | null, skipped: SkippedFile[] | null) => {
      rememberGraph(ref.hash, next);
      const previous = graph;
      p.setData((x) => {
        const ids = new Set(next.nodes.map((n) => n.id));
        const pins: Record<string, Point> = {};
        for (const [id, pt] of Object.entries(x.pins)) if (ids.has(id)) pins[id] = pt;
        const firstImportant = next.nodes.find((n) => n.kind === "class" || n.kind === "concept") ?? next.nodes[0];
        return {
          ...x,
          graph: ref,
          corpus: corpus ?? x.corpus,
          skipped: skipped ?? x.skipped,
          pins,
          hidden: [],
          communities: previous ? carryCommunityNames(previous, next, x.communities) : [],
          selected: ids.has(x.selected) ? x.selected : firstImportant?.id ?? "",
          from: ids.has(x.from) ? x.from : "",
          to: ids.has(x.to) ? x.to : "",
        };
      });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [graph],
  );
  async function extract(corpus: CorpusFile[], skippedBefore: SkippedFile[] = []) {
    const key = epoch.current;
    if (!corpus.length) {
      applyGraph({ ...EMPTY_REF }, cachedGraph(EMPTY_REF.hash)!, [], skippedBefore);
      return true;
    }
    setProgress({ phase: "正在抽取", done: 0, total: corpus.length });
    try {
      const raw = await request("/api/extract", {
        method: "POST",
        body: JSON.stringify({ files: corpus.map((f) => ({ path: f.path, hash: f.hash })), engine: useService ? "graphify" : "node" }),
      });
      if (epoch.current !== key) return false;
      if (!isRecord(raw) || !isRecord(raw.ref) || !Array.isArray(raw.corpus) || !isRecord(raw.stats)) throw new Error("抽取结果格式无效");
      const next = graphValue(raw.graph);
      const ref = raw.ref as GraphRef;
      const skipped = [...skippedBefore, ...((raw.stats.skipped as SkippedFile[]) ?? [])].slice(0, 300);
      applyGraph(ref, next, raw.corpus as CorpusFile[], skipped);
      setLastRun({
        files: (raw.corpus as unknown[]).length,
        skipped,
        engine: String(raw.engine ?? ""),
        nodes: next.nodes.length,
        links: next.links.length,
        communities: Number(raw.stats.communities ?? 0),
      });
      p.setError("");
      const via = raw.engine && raw.engine !== "内置抽取" ? `（代码由 Graphify ${String(raw.engine)} 抽取）` : "";
      p.setNotice(`已从 ${(raw.corpus as unknown[]).length} 份资料抽取 ${next.nodes.length} 个节点、${next.links.length} 条关系，${raw.stats.communities} 个社区${via}。`);
      return true;
    } catch (e) {
      if (epoch.current === key) p.report(e);
      return false;
    } finally {
      if (epoch.current === key) setProgress(null);
    }
  }
  /** 新文件按路径并入资料集（同路径替换），上传缺少的原文后重新抽取。 */
  async function addFiles(selection: Selection) {
    const key = epoch.current;
    if (!selection.files.length) {
      p.setError(selection.skipped.length ? `没有可抽取的文件：${selection.skipped.slice(0, 3).map((s) => `${s.path}（${s.reason}）`).join("；")}` : "没有选择文件。");
      return false;
    }
    try {
      const entries = selection.files.map((f) => ({ entry: corpusEntry(f.path, f.text), text: f.text }));
      setProgress({ phase: "正在上传原文", done: 0, total: entries.length });
      await uploadTexts(entries.map((e) => ({ hash: e.entry.hash, text: e.text, kind: "source" })), (done, total) =>
        epoch.current === key && setProgress({ phase: "正在上传原文", done, total }),
      );
      if (epoch.current !== key) return false;
      const byPath = new Map(d.corpus.map((c) => [c.path, c]));
      for (const e of entries) byPath.set(e.entry.path, e.entry);
      const ok = await extract([...byPath.values()].sort((a, b) => a.path.localeCompare(b.path)), selection.skipped);
      if (ok && !d.corpus.length) setPanel("communities");
      return ok;
    } catch (e) {
      if (epoch.current === key) {
        p.report(e);
        setProgress(null);
      }
      return false;
    }
  }
  const reextract = () => extract(d.corpus);
  const removeFile = (path: string) => extract(d.corpus.filter((c) => c.path !== path));
  async function addPasted() {
    const key = epoch.current;
    const originalName = p.draft.pasteName;
    const name = typeof p.draft.pasteName === "string" ? p.draft.pasteName.trim() : "";
    const text = typeof p.draft.pasteText === "string" ? p.draft.pasteText : "";
    if (!text.trim()) {
      p.setError("请先粘贴要加入的文字。");
      return false;
    }
    const path = /\.[a-z0-9]+$/i.test(name) ? name : `${name || "粘贴的笔记"}.md`;
    const ok = await addFiles({ files: [{ path, text }], skipped: [] });
    if (ok && epoch.current === key)
      p.setDraft((x) => {
        // A completed extraction consumes only the input it actually read.
        if (x.pasteName !== originalName || x.pasteText !== text) return x;
        const n = { ...x };
        delete n.pasteName;
        delete n.pasteText;
        return n;
      });
    return ok;
  }

  // ---------- 新建 / 示例 / 导入 ----------
  const newMap = () =>
    navigation.run(async () => {
      const ok = await base.replace(emptyProject(), NEW_TITLE, {});
      if (ok) {
        base.setNotice("已新建空白知识地图。拖入文件夹或选择文件开始抽取。");
        setPanel("sources");
      }
      return ok;
    });
  const openSample = () =>
    navigation.run(async () => {
      const ok = await base.replace(structuredClone(demo.project), SAMPLE_NAME, {});
      if (ok) base.setNotice("已打开示例资料集的新副本。");
      return ok;
    });
  async function importFile(f: File) {
    await navigation.run(async () => {
      try {
        if (f.size > 96 * 1024 * 1024) throw new Error("文件超过 96 MB。");
        const text = await f.text();
        let raw: unknown;
        try {
          raw = JSON.parse(text);
        } catch {
          throw new Error("文件不是有效的 JSON。可导入 graph.json、完整项目或恢复稿。");
        }
        const title = f.name.replace(/(\.project)?\.json$/i, "") || "导入的知识地图";
        const isNativeGraph = isRecord(raw) && !isRecord(raw.data) && !isRecord(raw.snapshot);
        if (isNativeGraph) {
          // 原生 graph.json 交给服务端：校验、缺社区时补齐、规范化存入内容库
          const hash = sha256(text);
          setProgress({ phase: "正在上传图谱", done: 0, total: 1 });
          await uploadTexts([{ hash, text, kind: "upload" }]);
          const res = await request("/api/graphs", { method: "POST", body: JSON.stringify({ upload: hash }) });
          if (!isRecord(res) || !isRecord(res.ref)) throw new Error("图谱导入失败");
          const g = graphValue(res.graph);
          const ref = res.ref as GraphRef;
          rememberGraph(ref.hash, g);
          const data: MapProject = { ...emptyProject(), graph: ref, selected: g.nodes[0]?.id ?? "" };
          const ok = await base.replace(data, title, {});
          if (ok) base.setNotice(`已导入 ${g.nodes.length} 个节点的 Graphify 图谱为新知识地图${res.detected ? "，社区由本地 Louvain 检测" : ""}。`);
          return ok;
        }
        const imported = decodeProjectImport(raw, title);
        setProgress({ phase: "正在恢复资料", done: 0, total: imported.sources.size + 1 });
        const uploads: UploadItem[] = [...imported.sources].map(([hash, t]) => ({ hash, text: t, kind: "source" }));
        if (imported.graph) {
          const gt = graphText(imported.graph);
          const gh = sha256(gt);
          uploads.push({ hash: gh, text: gt, kind: "upload" });
        }
        if (uploads.length) await uploadTexts(uploads);
        if (imported.graph) {
          const res = await request("/api/graphs", { method: "POST", body: JSON.stringify({ upload: sha256(graphText(imported.graph)) }) });
          if (!isRecord(res) || !isRecord(res.ref)) throw new Error("图谱导入失败");
          const g = graphValue(res.graph);
          rememberGraph(String(res.ref.hash), g);
          imported.data.graph = { ...imported.data.graph, ...(res.ref as GraphRef) };
        }
        const ok = await base.replace(imported.data, imported.title, imported.extra);
        if (ok)
          base.setNotice(
            imported.kind === "recovery"
              ? "工作稿已恢复为新知识地图；原保存操作只保留为历史记录。"
              : imported.kind === "legacy"
                ? "已把 0.5 版项目转换为新知识地图（源码成为资料集的一份文件）。"
                : "已导入为新知识地图。",
          );
        return ok;
      } catch (e) {
        base.report(e);
        return false;
      } finally {
        setProgress(null);
      }
    });
  }

  // ---------- 导出 ----------
  const safeName = (p.title || "knowledge-map").replace(/[\\/:*?"<>|]+/g, "-").slice(0, 80);
  const positions = () => new Map((layout?.nodes ?? []).map((n) => [n.id, { x: n.x ?? 0, y: n.y ?? 0 }]));
  const exportAs = (kind: "json" | "graphml" | "html" | "md") => {
    if (!graph) return;
    const now = new Intl.DateTimeFormat("zh-CN", { dateStyle: "medium", timeStyle: "short" }).format(new Date());
    const files = {
      json: [() => exportGraphJson(graph, communities), "application/json", "graph.json"],
      graphml: [() => exportGraphML(graph, communities), "application/graphml+xml", `${safeName}.graphml`],
      html: [() => exportHtmlReport(p.title, graph, d.communities, d.corpus, positions(), now), "text/html", `${safeName}.report.html`],
      md: [() => exportMarkdownReport(p.title, graph, d.communities, d.corpus), "text/markdown", "GRAPH_REPORT.md"],
    } as const;
    const [body, type, name] = files[kind];
    download(new Blob([body()], { type: `${type};charset=utf-8` }), name);
  };
  async function exportProject() {
    try {
      const sources: Record<string, string> = {};
      setProgress({ phase: "正在打包原文", done: 0, total: d.corpus.length });
      for (const c of d.corpus) sources[c.hash] = await loadText(c.hash);
      download(
        new Blob([JSON.stringify({ format: PROJECT_FORMAT, version: 2, title: p.title, data: d, extra: p.draft, graph, sources }, null, 1)], { type: "application/json" }),
        `${safeName}.project.json`,
      );
    } catch (e) {
      p.report(e);
    } finally {
      setProgress(null);
    }
  }

  // ---------- 图谱 JSON 工作稿 ----------
  const [jsonOpen, setJsonOpen] = useState(false);
  const [applyingJson, setApplyingJson] = useState(false);
  const graphJsonTooLarge = !!graph && graphText(graph).length > JSON_EDIT_LIMIT;
  const rawJson = typeof p.draft.graphJson === "string" ? p.draft.graphJson : graph && !graphJsonTooLarge ? JSON.stringify(graph, null, 2) : "";
  async function applyJson() {
    if (applyingJson) return false;
    const key = epoch.current;
    setApplyingJson(true);
    try {
      let raw: unknown;
      try {
        raw = JSON.parse(rawJson);
      } catch (e) {
        throw new Error(`JSON 语法有误：${e instanceof Error ? e.message : ""}`);
      }
      const checked = graphValue(raw);
      const text = graphText(checked);
      const hash = sha256(text);
      await uploadTexts([{ hash, text, kind: "upload" }]);
      const res = await request("/api/graphs", { method: "POST", body: JSON.stringify({ upload: hash }) });
      if (epoch.current !== key || latest.current.data.graph.hash !== d.graph.hash || !isRecord(res) || !isRecord(res.ref)) return false;
      applyGraph(res.ref as GraphRef, graphValue(res.graph), null, null);
      const unchanged = latest.current.draft.graphJson === p.draft.graphJson;
      p.setDraft((x) => {
        if (x.graphJson !== p.draft.graphJson) return x;
        const n = { ...x };
        delete n.graphJson;
        return n;
      });
      p.setError("");
      p.setNotice(unchanged ? "图谱 JSON 已应用。" : "提交的图谱 JSON 已应用；后续编辑已保留在工作稿中。");
      return unchanged;
    } catch (e) {
      if (epoch.current === key) p.report(e);
      return false;
    } finally {
      setApplyingJson(false);
    }
  }

  // ---------- 社区 ----------
  const toggleCommunity = (id: number) =>
    p.setData((x) => ({ ...x, hidden: x.hidden.includes(id) ? x.hidden.filter((h) => h !== id) : [...x.hidden, id] }));
  const soloCommunity = (id: number) =>
    p.setData((x) => {
      const all = communities.map((c) => c.id);
      const onlyThis = x.hidden.length === all.length - 1 && !x.hidden.includes(id);
      return { ...x, hidden: onlyThis ? [] : all.filter((c) => c !== id) };
    });
  const showAll = () => p.setData((x) => ({ ...x, hidden: [] }));
  const renameCommunity = (id: number, name: string) =>
    p.setData((x) => {
      const others = x.communities.filter((c) => c.id !== id);
      const prior = x.communities.find((c) => c.id === id);
      if (!name.trim()) return { ...x, communities: others };
      return { ...x, communities: [...others, { id, label: name.slice(0, 80), summary: prior?.summary ?? "", origin: "manual" as const }].sort((a, b) => a.id - b.id) };
    });
  const [naming, setNaming] = useState(false);
  async function nameWithHost() {
    if (!graph) return false;
    const key = epoch.current;
    const hash = d.graph.hash;
    setNaming(true);
    try {
      const req = buildEnhanceRequest(p.title, graph, communities);
      const raw = await request("/api/enhance", { method: "POST", body: JSON.stringify(req) });
      if (epoch.current !== key || latest.current.data.graph.hash !== hash) return false;
      if (!isRecord(raw) || !Array.isArray(raw.communities)) throw new Error("模型返回格式无效");
      const named = raw.communities as { id: number; label: string; summary: string }[];
      p.setData((x) => {
        const keep = x.communities.filter((c) => c.origin === "manual" || !named.some((n) => n.id === c.id));
        const add: CommunityMeta[] = named.filter((n) => !keep.some((k) => k.id === n.id)).map((n) => ({ ...n, origin: "host" }));
        return { ...x, communities: [...keep, ...add].sort((a, b) => a.id - b.id) };
      });
      p.setNotice(`Floatboat 模型（${String(raw.model ?? "")}）已为 ${named.length} 个社区命名；人工改过的名称保持不变。`);
      return true;
    } catch (e) {
      if (epoch.current === key) p.report(e);
      return false;
    } finally {
      setNaming(false);
    }
  }

  // ---------- 原文全文检索 ----------
  const [textHits, setTextHits] = useState<{ query: string; hits: { path: string; line: number; text: string }[]; total: number } | null>(null);
  const searchSequence = useRef(0);
  async function searchText() {
    const q = query.trim();
    if (!q || !d.corpus.length) return;
    const key = epoch.current;
    const sequence = ++searchSequence.current;
    try {
      const raw = await request("/api/search", { method: "POST", body: JSON.stringify({ query: q, files: d.corpus.map((c) => ({ path: c.path, hash: c.hash })) }) });
      if (epoch.current !== key || sequence !== searchSequence.current) return;
      if (!isRecord(raw) || !Array.isArray(raw.hits)) throw new Error("检索结果格式无效");
      setTextHits({ query: q, hits: raw.hits as { path: string; line: number; text: string }[], total: Number(raw.total ?? 0) });
    } catch (e) {
      if (epoch.current === key && sequence === searchSequence.current) p.report(e);
    }
  }
  useEffect(() => setTextHits(null), [p.documentKey]);

  const file = useRef<HTMLInputElement>(null);
  const counts = useMemo(() => {
    const m = new Map<string, number>();
    for (const n of shown.nodes) {
      const f = field(n, "source_file");
      if (f) m.set(f, (m.get(f) ?? 0) + 1);
    }
    return m;
  }, [shown]);
  const communityName = (c: number | null) => (c === null ? "未分组" : communities.find((x) => x.id === c)?.label ?? `社区 ${c}`);

  return {
    p, mutable, graph, shown, graphError: graphState.error, byId, communities, communityName, hidden, layout, layoutDone, relayout,
    selected, select, query, setQuery, matches, matchSet, path, pathNodes, pathLinks, orphanNotes,
    inspect, setInspect, openSource, openFileAt, mobile, setMobile, panel, setPanel,
    engine, checkEngine, useService, setUseService, host, checkHost, progress, lastRun,
    addFiles, reextract, removeFile, addPasted, newMap, openSample, importFile, exportAs, exportProject,
    rawJson, graphJsonTooLarge, applyJson, applyingJson, jsonOpen, setJsonOpen, toggleCommunity, soloCommunity, showAll, renameCommunity, naming, nameWithHost,
    textHits, setTextHits, searchText, file, counts, communityOf,
  };
}
export type Desk = ReturnType<typeof useGraphDesk>;
export type { Picked };
