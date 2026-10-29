// ABOUTME: 数据流水线工作台主界面：顶栏（文件/名称/运行）、节点架、画布、检查器与运行控制台的组合与快捷键。
import { useReactFlow, type Connection } from "@xyflow/react";
import { ChevronDown, LayoutGrid, Play, Plus, Sparkles, Workflow } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { nodeSignatures, toRunRecord } from "../contracts/engine";
import { emptyFlow, type FlowDocument } from "../contracts/flow";
import type { OpKind } from "../contracts/ops";
import type { PipelineTemplate } from "../contracts/templates";
import { AutoFeedback, AutoStatus } from "./AutosaveStatus";
import { AiDraft, FileMenu, Modal, TemplateGallery } from "./Dialogs";
import { downloadValue, exportPipeline, pickFile, readDataFile, readPipelineFile } from "./files";
import { addNode, autoLayout, connect, copySelection, createNode, disconnect, pasteClip, removeElements, type Clip } from "./graph-edit";
import { Inspector, type InspectorTab } from "./Inspector";
import { Palette } from "./Palette";
import { PipelineCanvas, type Selection } from "./PipelineCanvas";
import { RunConsole } from "./RunConsole";
import { CancelledRun, runInWorker } from "./runner";
import { useHistory } from "./useHistory";
import { ActionsContext, nodeView, shownValue, type LiveRun, type NodeView } from "./view";
import { Notice, RenderBoundary, usePipelineFiles } from "./workspace";

type Dialog = null | "file" | "templates" | "ai";
type Progress = { running: boolean; current: string | null; results: LiveRun["results"] };
const AUTO_KEY = "react-flow:auto-run";
const readAuto = () => {
  try {
    return localStorage.getItem(AUTO_KEY) !== "off";
  } catch {
    return true;
  }
};

export function Studio() {
  const p = usePipelineFiles();
  const flow = useReactFlow();
  const dataRef = useRef(p.data);
  dataRef.current = p.data;
  const setDataRef = useRef(p.setData);
  setDataRef.current = p.setData;
  const get = useCallback(() => dataRef.current, []);
  const set = useCallback((next: FlowDocument) => {
    dataRef.current = next;
    setDataRef.current(next);
  }, []);
  const history = useHistory(get, set, p.documentKey);
  const commit = history.commit;

  const [selection, setSelection] = useState<Selection>({ nodes: [], edges: [] });
  const [tab, setTab] = useState<InspectorTab>("config");
  const [sizes, setSizes] = useState<Record<string, { width: number; height: number }>>({});
  const [live, setLive] = useState<LiveRun | null>(null);
  const [progress, setProgress] = useState<Progress | null>(null);
  const [autoRun, setAutoRun] = useState(readAuto);
  const [consoleOpen, setConsoleOpen] = useState(false);
  const [dialog, setDialog] = useState<Dialog>(null);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [flash, setFlash] = useState("");
  const clip = useRef<Clip | null>(null);

  useEffect(() => {
    setSelection({ nodes: [], edges: [] });
    setLive(null);
    setProgress(null);
  }, [p.documentKey]);
  useEffect(() => {
    if (!flash) return;
    const timer = setTimeout(() => setFlash(""), 4500);
    return () => clearTimeout(timer);
  }, [flash]);

  const doc = p.data;
  const sigs = useMemo(() => nodeSignatures(doc), [doc.nodes, doc.edges]);
  const views = useMemo(() => {
    const out: Record<string, NodeView> = {};
    for (const node of doc.nodes) out[node.id] = nodeView(node.id, sigs[node.id], live, progress, doc.lastRun?.nodes[node.id]);
    return out;
  }, [doc.nodes, doc.lastRun, sigs, live, progress]);

  const fail = useCallback((error: unknown) => setFlash(error instanceof Error ? error.message : String(error)), []);

  const run = useCallback(
    async (record: boolean) => {
      const snapshot = dataRef.current;
      setProgress({ running: true, current: null, results: {} });
      try {
        const report = await runInWorker(snapshot, (step) => setProgress({ running: true, ...step }));
        setLive({ at: report.at, ms: report.ms, results: report.results, sigs: report.sigs, order: report.order });
        setProgress(null);
        if (record) setDataRef.current((current) => ({ ...current, lastRun: toRunRecord(report) }));
      } catch (error) {
        if (error instanceof CancelledRun) return;
        setProgress(null);
        fail(error);
      }
    },
    [fail],
  );

  const hasLive = useRef(false);
  hasLive.current = live !== null;
  // 自动运行：结构或配置变化 400ms 后在 Worker 中重算（不写入运行记录）。
  const graphKey = useMemo(() => p.documentKey + "|" + Object.entries(sigs).map(([id, sig]) => id + sig).join(","), [p.documentKey, sigs]);
  useEffect(() => {
    if (!autoRun || p.loading) return;
    // 首次打开立即计算，之后的编辑去抖。
    const timer = setTimeout(() => void run(false), hasLive.current ? 400 : 0);
    return () => clearTimeout(timer);
  }, [graphKey, autoRun, p.loading, run]);

  const primary = selection.nodes.length ? doc.nodes.find((node) => node.id === selection.nodes.at(-1)) ?? null : null;

  function focusNode(id: string, output = false) {
    setSelection({ nodes: [id], edges: [] });
    if (output) setTab("output");
    void flow.fitView({ nodes: [{ id }], maxZoom: 1, duration: 250, padding: 0.4 });
  }
  function placeAtCenter(): { x: number; y: number } {
    const rect = document.querySelector(".pipeline-canvas")?.getBoundingClientRect();
    const jitter = (doc.nodes.length % 5) * 24;
    return rect
      ? flow.screenToFlowPosition({ x: rect.left + rect.width / 2 - 112 + jitter, y: rect.top + rect.height / 2 - 70 + jitter })
      : { x: jitter, y: jitter };
  }
  function add(op: OpKind, position = placeAtCenter(), config: Record<string, unknown> = {}, label?: string) {
    try {
      const node = createNode(op, position, config, label);
      commit(addNode(get(), node));
      setSelection({ nodes: [node.id], edges: [] });
      setTab("config");
      setPaletteOpen(false);
    } catch (error) {
      fail(error);
    }
  }
  async function dropFile(file: File, position: { x: number; y: number }) {
    try {
      const data = await readDataFile(file);
      add(data.op, position, data.config, data.label);
    } catch (error) {
      fail(error);
    }
  }
  function duplicate(ids: string[]) {
    const copied = copySelection(get(), ids);
    if (!copied) return;
    try {
      const pasted = pasteClip(get(), copied);
      commit(pasted.doc);
      setSelection({ nodes: pasted.ids, edges: [] });
    } catch (error) {
      fail(error);
    }
  }
  function remove(nodes: string[], edges: string[]) {
    if (!nodes.length && !edges.length) return;
    commit(removeElements(get(), nodes, edges));
    setSelection({ nodes: [], edges: [] });
  }
  function onConnect(c: Connection) {
    try {
      commit(connect(get(), c));
    } catch (error) {
      fail(error);
    }
  }
  function updateNode(id: string, change: (node: FlowDocument["nodes"][number]) => FlowDocument["nodes"][number], key: string) {
    const current = get();
    commit({ ...current, nodes: current.nodes.map((node) => (node.id === id ? change(node) : node)) }, key);
  }
  async function loadInto(id: string) {
    const node = get().nodes.find((item) => item.id === id);
    if (!node) return;
    const accept = node.data.op === "csvInput" ? ".csv,.tsv,text/csv" : node.data.op === "jsonInput" ? ".json,application/json" : ".txt,.log,.md,.csv,text/plain";
    const file = await pickFile(accept);
    if (!file) return;
    try {
      const data = await readDataFile(file);
      const field = node.data.op === "csvInput" ? "csv" : node.data.op === "jsonInput" ? "json" : "text";
      const content = String(data.config.csv ?? data.config.json ?? data.config.text ?? "");
      updateNode(id, (n) => ({ ...n, data: { ...n.data, config: { ...n.data.config, [field]: content, fileName: file.name.slice(0, 200) } } }), "file:" + id);
      setFlash(`已载入 ${file.name}`);
    } catch (error) {
      fail(error);
    }
  }
  function downloadNode(id: string) {
    const node = get().nodes.find((item) => item.id === id);
    const result = views[id]?.live;
    const value = result && shownValue(result);
    if (!node || !value) return fail(new Error("请先运行流水线。"));
    try {
      const format = node.data.op === "fileOutput" ? (node.data.config.format as "csv" | "json" | "txt") : value.type === "table" ? "csv" : "txt";
      downloadValue(value, format, String(node.data.config.fileName || node.data.label));
    } catch (error) {
      fail(error);
    }
  }
  function layout() {
    commit({ ...get(), nodes: autoLayout(get(), sizes) });
    requestAnimationFrame(() => void flow.fitView({ padding: 0.12, maxZoom: 1.1, duration: 250 }));
  }
  async function applyTemplate(template: PipelineTemplate) {
    if (await p.replace(structuredClone(template.doc), template.title)) setDialog(null);
  }
  async function importPipeline() {
    const file = await pickFile(".json,application/json");
    if (!file) return;
    try {
      const imported = await readPipelineFile(file);
      if (await p.replace(imported.doc, imported.title)) {
        setDialog(null);
        setFlash(imported.draft ? `已导入为新流水线「${imported.title}」（有待完善的内容，保存为草稿）` : `已导入为新流水线「${imported.title}」`);
      }
    } catch (error) {
      fail(error);
    }
  }

  const keys = useRef<(event: KeyboardEvent) => void>(() => {});
  keys.current = (event) => {
    const mod = event.metaKey || event.ctrlKey;
    const target = event.target as HTMLElement | null;
    const editable = !!target?.closest("input, textarea, select, [contenteditable=true]");
    if (mod && event.key.toLowerCase() === "s") {
      event.preventDefault();
      void p.save();
    } else if (mod && event.key === "Enter") {
      event.preventDefault();
      void run(true);
    }
    if (editable || dialog || !mod) return;
    const key = event.key.toLowerCase();
    if (key === "z" && !event.shiftKey) history.undo();
    else if ((key === "z" && event.shiftKey) || key === "y") history.redo();
    else if (key === "c" && selection.nodes.length) {
      clip.current = copySelection(get(), selection.nodes);
      setFlash(`已复制 ${selection.nodes.length} 个节点`);
    } else if (key === "v" && clip.current) {
      try {
        const pasted = pasteClip(get(), clip.current);
        commit(pasted.doc);
        setSelection({ nodes: pasted.ids, edges: [] });
      } catch (error) {
        fail(error);
      }
    } else if (key === "d" && selection.nodes.length) duplicate(selection.nodes);
    else if (key === "a") setSelection({ nodes: get().nodes.map((node) => node.id), edges: [] });
    else return;
    event.preventDefault();
  };
  useEffect(() => {
    const listener = (event: KeyboardEvent) => keys.current(event);
    window.addEventListener("keydown", listener);
    return () => window.removeEventListener("keydown", listener);
  }, []);

  const running = !!progress?.running;
  const locked = p.busy || p.loading;
  const actions = useMemo(
    () => ({ select: (id: string) => focusNode(id), duplicate: (id: string) => duplicate([id]), remove: (id: string) => remove([id], []), showOutput: (id: string) => focusNode(id, true), download: downloadNode }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [views, doc],
  );

  return (
    <main className="studio" data-palette={paletteOpen || undefined}>
      <a className="skip-link" href="#inspector">
        跳到检查器
      </a>
      <header className="topbar">
        <button type="button" className="file-button" aria-haspopup="dialog" onClick={() => setDialog("file")}>
          <Workflow aria-hidden="true" size={16} />
          文件
          <ChevronDown aria-hidden="true" size={13} />
        </button>
        <label className="sr-only" htmlFor="pipeline-title">
          流水线名称
        </label>
        <input id="pipeline-title" className="title-input" value={p.title} maxLength={120} autoComplete="off" onChange={(event) => p.setTitle(event.target.value)} />
        <AutoStatus state={p.autoState} loading={p.loading} />
        <span className="spacer" />
        <button type="button" className="mobile-only" aria-expanded={paletteOpen} aria-controls="palette" onClick={() => setPaletteOpen((open) => !open)}>
          <Plus aria-hidden="true" size={14} />
          节点
        </button>
        <button type="button" className="desktop-label" aria-label="模板库" title="模板库" onClick={() => setDialog("templates")}>
          <LayoutGrid aria-hidden="true" size={14} />
          <span>模板库</span>
        </button>
        <button type="button" className="desktop-label" aria-label="AI 起草" title="AI 起草" onClick={() => setDialog("ai")}>
          <Sparkles aria-hidden="true" size={14} />
          <span>AI 起草</span>
        </button>
        <label className="auto-toggle" title="改动后自动在本机重新计算">
          <input
            type="checkbox"
            checked={autoRun}
            onChange={(event) => {
              setAutoRun(event.target.checked);
              try {
                localStorage.setItem(AUTO_KEY, event.target.checked ? "on" : "off");
              } catch {
                /* 仅是偏好 */
              }
            }}
          />
          <span>自动运行</span>
        </label>
        <button type="button" className="run-button" onClick={() => void run(true)} disabled={!doc.nodes.length} title="运行并把结果记录到流水线（⌘/Ctrl+Enter）">
          <Play aria-hidden="true" size={14} />
          {running ? "运行中…" : "运行"}
        </button>
      </header>
      <AutoFeedback state={p.autoState} onRetry={() => void p.save()} onExport={p.exportDraft} onReload={p.current ? () => void p.open(p.current!.id) : undefined} />
      <Notice error={p.error} notice={flash || p.notice} onDismiss={() => (p.error ? p.setError("") : flash ? setFlash("") : p.setNotice(""))} />
      <div className="workspace">
        <aside id="palette" className="palette-region">
          <Palette onAdd={(op) => add(op)} disabled={locked} />
        </aside>
        <section className="canvas-region" aria-label="流水线画布">
          <RenderBoundary>
            <ActionsProvider value={actions}>
              <PipelineCanvas
                key={p.documentKey}
                doc={doc}
                views={views}
                selection={selection}
                onSelection={setSelection}
                onMove={(positions) => commit({ ...get(), nodes: get().nodes.map((node) => (positions[node.id] ? { ...node, position: { x: Math.round(positions[node.id].x), y: Math.round(positions[node.id].y) } } : node)) })}
                onConnect={onConnect}
                onDelete={remove}
                onDropOp={(op, position) => add(op, position)}
                onDropFile={(file, position) => void dropFile(file, position)}
                onLayout={layout}
                onReject={(reason) => setFlash(reason)}
                undo={{ run: history.undo, enabled: history.canUndo }}
                redo={{ run: history.redo, enabled: history.canRedo }}
                sizes={sizes}
                onSizes={setSizes}
              />
            </ActionsProvider>
          </RenderBoundary>
        </section>
        <aside id="inspector" className="inspector" tabIndex={-1} aria-label="检查器">
          <Inspector
            doc={doc}
            node={primary}
            views={views}
            tab={tab}
            onTab={setTab}
            onLabel={(label) => primary && updateNode(primary.id, (n) => ({ ...n, data: { ...n.data, label } }), "label:" + primary.id)}
            onConfig={(key, value) => primary && updateNode(primary.id, (n) => ({ ...n, data: { ...n.data, config: { ...n.data.config, [key]: value } } }), `config:${primary.id}:${key}`)}
            onConnect={(port, source, handle) => primary && onConnect({ source, sourceHandle: handle, target: primary.id, targetHandle: port })}
            onDisconnect={(port) => primary && commit(disconnect(get(), primary.id, port))}
            onLoadFile={() => primary && void loadInto(primary.id)}
            onDuplicate={() => primary && duplicate([primary.id])}
            onRemove={() => primary && remove([primary.id], [])}
            onSelect={(id) => focusNode(id)}
          />
        </aside>
      </div>
      <RunConsole
        doc={doc}
        views={views}
        order={live?.order ?? []}
        open={consoleOpen}
        onToggle={() => setConsoleOpen((open) => !open)}
        running={running}
        savedAt={doc.lastRun?.at}
        totalMs={live?.ms ?? doc.lastRun?.ms}
        onSelect={(id) => focusNode(id)}
      />
      <Modal open={dialog === "file"} onClose={() => setDialog(null)} title="文件" className="file-sheet">
        <FileMenu
          items={p.items}
          currentId={p.current?.id}
          title={p.title}
          locked={locked}
          onNew={() => void p.replace(emptyFlow(), "未命名流水线").then((ok) => ok && setDialog(null))}
          onTemplates={() => setDialog("templates")}
          onImport={() => void importPipeline()}
          onOpen={(id) => void p.open(id).then((ok) => ok && setDialog(null))}
          onExport={() => exportPipeline(doc, p.title)}
          onRecoveryDownload={p.exportDraft}
          onRefresh={() => void p.refresh()}
          onRemove={() => void p.remove().then((ok) => ok && setDialog(null))}
        />
      </Modal>
      <Modal open={dialog === "templates"} onClose={() => setDialog(null)} title="模板库" className="template-sheet">
        <TemplateGallery locked={locked} onPick={(template) => void applyTemplate(template)} />
      </Modal>
      <Modal open={dialog === "ai"} onClose={() => setDialog(null)} title="AI 起草流水线">
        <AiDraft
          prompt={typeof p.draft.aiPrompt === "string" ? p.draft.aiPrompt : ""}
          onPrompt={(value) => p.setDraft((extra) => ({ ...extra, aiPrompt: value }))}
          busy={p.aiBusy}
          error={p.aiError}
          suggestion={p.suggestion}
          onGenerate={() => void p.generate(typeof p.draft.aiPrompt === "string" ? p.draft.aiPrompt : "")}
          onApply={() => {
            if (!p.suggestion) return;
            commit({ version: 2, nodes: p.suggestion.nodes, edges: p.suggestion.edges });
            p.discardSuggestion();
            setDialog(null);
            requestAnimationFrame(() => void flow.fitView({ padding: 0.12, maxZoom: 1.1 }));
          }}
          onDiscard={p.discardSuggestion}
        />
      </Modal>
      <span className="sr-only" role="status">
        {running ? `正在运行${progress?.current ? "：" + (doc.nodes.find((n) => n.id === progress.current)?.data.label ?? "") : ""}` : ""}
      </span>
    </main>
  );
}

const ActionsProvider = ActionsContext.Provider;
