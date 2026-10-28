import { useEffect, useRef, useState } from "react";
import { useProjects, request, download } from "./workspace.tsx";
import { isRecord } from "../contracts/project.ts";
import {
  seed,
  graphValue,
  projectValue,
  label,
  field,
  shortestPath,
  fromGraph,
} from "../contracts/graph.ts";
export function useGraphDesk() {
  const p = useProjects(seed, projectValue, "目录服务 · 关系审阅", {
    storageKey: "graphify-map-v1",
  });
  const [query, setQuery] = useState(""),
    [zoom, setZoom] = useState(0.8),
    [sourceOpen, setSourceOpen] = useState(false),
    [jsonOpen, setJsonOpen] = useState(false),
    [extracting, setExtracting] = useState(false),
    [engine, setEngine] = useState({
      available: false,
      engine: "正在检查提取服务…",
    });
  const epoch = useRef(p.documentKey);
  epoch.current = p.documentKey;
  const file = useRef<HTMLInputElement>(null);
  const graph = p.data.graph,
    selected = graph.nodes.find((n) => n.id === p.data.selected),
    path = shortestPath(graph, p.data.from, p.data.to),
    matches = graph.nodes.filter((n) =>
      (label(n) + " " + field(n, "source_file"))
        .toLowerCase()
        .includes(query.toLowerCase()),
    );
  const mutable = !p.loading && !p.busy;
  const pending = isRecord(p.draft.extracted) ? p.draft.extracted : null;
  const rawJson =
    typeof p.draft.graphJson === "string"
      ? p.draft.graphJson
      : JSON.stringify(graph, null, 2);
  async function checkEngine() {
    try {
      const raw = await request("/api/engine");
      if (
        !isRecord(raw) ||
        typeof raw.available !== "boolean" ||
        typeof raw.engine !== "string"
      )
        throw new Error("状态响应无效");
      setEngine({ available: raw.available, engine: raw.engine });
    } catch {
      setEngine({ available: false, engine: "无法连接提取服务，请重试" });
    }
  }
  useEffect(() => {
    void checkEngine();
  }, []);
  function exportProject() {
    download(
      new Blob(
        [
          JSON.stringify(
            {
              format: "floatboat.graphify.project",
              version: 1,
              title: p.title,
              data: p.data,
              extra: p.draft,
            },
            null,
            2,
          ),
        ],
        { type: "application/json" },
      ),
      "knowledge-map.project.json",
    );
  }
  async function importFile(f: File) {
    try {
      if (f.size > 1500000) throw new Error("文件超过1.5MB，请拆分后导入。");
      const raw: unknown = JSON.parse(await f.text());
      if (isRecord(raw) && isRecord(raw.data)) {
        const data = projectValue(raw.data);
        const extra = isRecord(raw.extra) ? raw.extra : {};
        if (new TextEncoder().encode(JSON.stringify(extra)).length > 900000)
          throw new Error("工作稿超过容量限制。");
        await p.replace(
          data,
          typeof raw.title === "string" ? raw.title : "导入的知识地图",
          extra,
        );
      } else
        await p.replace(
          fromGraph(graphValue(raw)),
          f.name.replace(/\.json$/i, ""),
        );
    } catch (e) {
      p.report(e);
    }
  }
  async function extract() {
    const key = epoch.current;
    const source = { name: p.data.name, code: p.data.source };
    setExtracting(true);
    p.setError("");
    try {
      const raw = await request("/api/extract", {
        method: "POST",
        body: JSON.stringify(source),
      });
      if (!isRecord(raw)) throw new Error("提取结果格式无效");
      graphValue(raw.graph);
      if (epoch.current === key) p.setDraft((d) => ({ ...d, extracted: raw }));
    } catch (e) {
      if (epoch.current === key) p.report(e);
    } finally {
      setExtracting(false);
    }
  }
  function acceptGraph(value: unknown) {
    try {
      const next = graphValue(value);
      p.setData((d) => ({
        ...d,
        graph: next,
        notes: {},
        positions: {},
        selected: next.nodes[0]?.id ?? "",
        from: "",
        to: "",
      }));
      p.setDraft((d) => {
        const n = { ...d };
        delete n.extracted;
        delete n.graphJson;
        return n;
      });
      p.setNotice("图谱已更新。");
    } catch (e) {
      p.report(e);
    }
  }
  function adoptPending() {
    if (!pending) return;
    if (
      Object.keys(p.data.notes).length &&
      !confirm(
        "采用新图谱会替换当前图谱并清空其笔记与布局。继续？可先导出完整项目。",
      )
    )
      return;
    acceptGraph(pending.graph);
  }
  function applyJson() {
    try {
      if (
        Object.keys(p.data.notes).length &&
        !confirm("应用JSON会替换图谱并清空当前笔记和布局，继续？")
      )
        return;
      acceptGraph(JSON.parse(rawJson));
    } catch (e) {
      p.report(e);
    }
  }
  return {
    p,
    query,
    setQuery,
    zoom,
    setZoom,
    sourceOpen,
    setSourceOpen,
    jsonOpen,
    setJsonOpen,
    extracting,
    engine,
    file,
    graph,
    selected,
    path,
    matches,
    mutable,
    pending,
    rawJson,
    checkEngine,
    exportProject,
    importFile,
    extract,
    adoptPending,
    applyJson,
  };
}
