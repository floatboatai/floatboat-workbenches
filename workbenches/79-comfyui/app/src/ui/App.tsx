// ABOUTME: 工作台外壳：画布为主体，左侧节点库、右侧检查器/运行面板、底部印样带；协调自动保存与运行。

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { IWidget, LGraphNode } from "@comfyorg/litegraph";
import {
  CircleAlert, ListTree, Play, Plug, Redo2, Settings2, Undo2, Loader2, PanelLeftOpen, PanelRightClose,
} from "lucide-react";
import { validateDoc, restoreDoc, docOf, type ComfyDoc } from "../contracts/document";
import { coreDefs } from "../contracts/core-nodes";
import { buildTemplate } from "../contracts/templates";
import { emptyWorkflow, type UiWorkflow } from "../contracts/workflow";
import { toApiPrompt } from "../contracts/convert";
import { problemsByNode, problemsFromServer, validateWorkflow, type Problem } from "../contracts/validate";
import { exportApiJson, exportUiJson, parseImport, parseImportText, workflowTooLarge } from "../contracts/importer";
import { isFinished, type ConnectionConfig, type ConnectionStatus, type QueueEntry, type RunDetail, type RunLive, type RunSummary } from "../contracts/run";
import type { NodeDefs } from "../contracts/comfy";
import { api, blobToDataUrl } from "./api";
import { useWorkbenchState } from "./autosave-client";
import { CanvasView, type CanvasApi } from "./CanvasView";
import { Gallery, outputUrl } from "./Gallery";
import { Inspector } from "./Inspector";
import { Library } from "./Library";
import { ConnectionForm, ProblemList, QueueList, RunProgress, type ConnectionDraft } from "./RunPanel";
import { WorkflowMenu } from "./WorkflowMenu";
import { buildLibrary } from "./search";
import { Notice, download } from "./workspace";
import type { NodeVisual } from "./graph/nodes";

const STORAGE_KEY = "floatboat-comfyui-workbench";
const hostOf = (url: string) => {
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
};

export function App() {
  const snapshot = useMemo(() => coreDefs(), []);
  const seed = useMemo(() => docOf(buildTemplate("txt2img", snapshot)), [snapshot]);
  const project = useWorkbenchState<ComfyDoc>(seed, validateDoc, "SDXL 文生图", {
    storageKey: STORAGE_KEY,
    restoreDraftData: restoreDoc,
  });
  const [server, setServer] = useState<{ defs: NodeDefs; status: ConnectionStatus } | null>(null);
  const defs = server?.defs ?? snapshot;
  const entries = useMemo(() => buildLibrary(defs), [defs]);
  const [canvas, setCanvas] = useState<CanvasApi | null>(null);
  const editor = canvas?.editor ?? null;
  const [selected, setSelected] = useState<string[]>([]);
  const [tick, setTick] = useState(0);
  const [libraryOpen, setLibraryOpen] = useState(true);
  const [side, setSide] = useState<"inspector" | "run" | null>("inspector");
  const [tab, setTab] = useState<"canvas" | "run" | "gallery">("canvas");
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [config, setConfig] = useState<ConnectionConfig | null>(null);
  const [connError, setConnError] = useState("");
  const [connBusy, setConnBusy] = useState(false);
  const [queue, setQueue] = useState<QueueEntry[] | null>(null);
  const [serverProblems, setServerProblems] = useState<Problem[]>([]);
  const [runs, setRuns] = useState<RunSummary[]>([]);
  const [lives, setLives] = useState<RunLive[]>([]);
  const [lastLive, setLastLive] = useState<RunLive | null>(null);
  const [runBusy, setRunBusy] = useState(false);
  const [problemsOpen, setProblemsOpen] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const uploadInput = useRef<HTMLInputElement>(null);
  const uploadTarget = useRef<{ node: LGraphNode; widget: IWidget } | null>(null);
  const inputImages = useRef(new Map<string, HTMLImageElement | "loading">());

  const projectId = project.current?.id ?? project.documentKey.slice(0, 36);
  const workflow = project.data.workflow;
  const authoritative = server !== null;

  // ---- document <-> canvas ------------------------------------------------------------------
  useEffect(() => {
    if (!editor || project.loading) return;
    editor.load(project.data.workflow, defs);
    setSelected([]);
    setServerProblems([]);
    setLastLive(null);
    inputImages.current.clear();
  }, [editor, project.documentKey, project.loading]);

  const loadedDefs = useRef(defs);
  useEffect(() => {
    if (!editor || loadedDefs.current === defs) return;
    loadedDefs.current = defs;
    editor.setDefs(defs, project.data.workflow);
  }, [editor, defs]);

  const onChange = useCallback(
    (wf: UiWorkflow) => {
      project.setData((prev) => ({ ...prev, workflow: wf }));
      setTick((t) => t + 1);
    },
    [project.setData],
  );

  // ---- validation ---------------------------------------------------------------------------
  const localProblems = useMemo(
    () => validateWorkflow(workflow, defs, { authoritativeCombos: authoritative }),
    [workflow, defs, authoritative],
  );
  const problems = useMemo(() => [...serverProblems, ...localProblems.filter((p) => p.code !== "empty")], [serverProblems, localProblems]);
  const errors = problems.filter((p) => p.severity === "error");
  const blocking = localProblems.filter((p) => p.severity === "error");
  useEffect(() => {
    if (!editor) return;
    const counts = new Map<string, number>();
    for (const [id, list] of problemsByNode(problems)) {
      const n = list.filter((p) => p.severity === "error").length;
      if (n) counts.set(id, n);
    }
    editor.setErrorCounts(counts);
  }, [editor, problems]);

  // ---- run state ----------------------------------------------------------------------------
  const refreshRuns = useCallback(async () => {
    try {
      setRuns(await api.runs(projectId));
    } catch {
      /* gallery stays as is */
    }
  }, [projectId]);
  const activeRef = useRef(false);
  /** After submitting, poll quickly for a while: a cached run can finish between two slow polls. */
  const burstUntil = useRef(0);
  const kick = useRef<() => void>(() => {});
  const previousLives = useRef<RunLive[]>([]);
  useEffect(() => {
    setRuns([]);
    void refreshRuns();
    let stop = false,
      timer = 0;
    const loop = async () => {
      try {
        const state = await api.state(projectId);
        if (stop) return;
        const was = previousLives.current;
        previousLives.current = state.runs;
        setLives(state.runs);
        const active = state.runs.some((r) => !isFinished(r.status));
        activeRef.current = active || Date.now() < burstUntil.current;
        const finishedNow = was.filter((w) => !isFinished(w.status) && !state.runs.some((r) => r.runId === w.runId && !isFinished(r.status)));
        if (activeRef.current || finishedNow.length) await refreshRuns();
        for (const f of finishedNow) {
          const last = state.runs.find((r) => r.runId === f.runId) ?? f;
          setLastLive(last);
          void api.queue().then(setQueue).catch(() => {});
        }
        if (state.runs.length) {
          const finished = state.runs.filter((r) => isFinished(r.status)).at(-1);
          if (finished && !active) setLastLive((prev) => prev ?? finished);
        }
      } catch {
        /* server busy; retry */
      }
      if (!stop) timer = window.setTimeout(loop, activeRef.current ? 600 : 3000);
    };
    kick.current = () => {
      window.clearTimeout(timer);
      void loop();
    };
    void loop();
    return () => {
      stop = true;
      window.clearTimeout(timer);
    };
  }, [projectId, refreshRuns]);

  const activeLive = lives.find((l) => !isFinished(l.status)) ?? null;
  useEffect(() => {
    if (!editor) return;
    const map = new Map<string, NodeVisual>();
    const live = activeLive ?? lastLive;
    if (live) {
      for (const id of live.cached) map.set(id, { state: "cached" });
      for (const id of live.executed) map.set(id, { state: "done" });
      if (activeLive?.currentNode)
        map.set(activeLive.currentNode, { state: "running", progress: activeLive.progress ? activeLive.progress.value / Math.max(1, activeLive.progress.max) : undefined });
      if (live.error?.nodeId) map.set(live.error.nodeId, { state: "error" });
    }
    editor.setVisuals(map);
  }, [editor, activeLive, lastLive]);

  // images produced by the newest finished run are drawn inside their output nodes
  const newest = runs.find((r) => r.status === "success" && r.outputs.length) ?? null;
  useEffect(() => {
    if (!editor) return;
    if (!newest) return editor.setImages(new Map());
    let cancelled = false;
    void (async () => {
      const map = new Map<string, HTMLImageElement[]>();
      for (const o of newest.outputs.filter((x) => x.mime.startsWith("image/"))) {
        try {
          const img = new Image();
          img.src = await outputUrl(o.id);
          await img.decode().catch(() => {});
          map.set(o.nodeId, [...(map.get(o.nodeId) ?? []), img]);
        } catch {
          /* skip unreadable output */
        }
      }
      if (!cancelled) editor.setImages(map);
    })();
    return () => {
      cancelled = true;
    };
  }, [editor, newest?.id]);

  // ---- connection ---------------------------------------------------------------------------
  useEffect(() => {
    void api.config().then(setConfig).catch(() => {});
  }, []);
  async function connect(draft: ConnectionDraft) {
    setConnBusy(true);
    setConnError("");
    try {
      setConfig(
        await api.setConfig({
          baseUrl: draft.baseUrl,
          headerName: draft.headerName,
          token: draft.token || undefined,
          remember: draft.remember,
        }),
      );
      const result = await api.connect();
      setServer(result);
      setServerProblems([]);
      void api.queue().then(setQueue).catch(() => {});
      project.setNotice(`已连接，载入了 ${result.status.nodeCount} 个节点定义。`);
    } catch (e) {
      setConnError(e instanceof Error ? e.message : "连接失败。");
    } finally {
      setConnBusy(false);
    }
  }

  // ---- run ----------------------------------------------------------------------------------
  async function run() {
    if (!editor || runBusy) return;
    setSide("run");
    setTab("run");
    if (!server) {
      setConnError("还没有连接 ComfyUI。请先在下方填写地址并检查连接。");
      return;
    }
    if (blocking.length) {
      setProblemsOpen(true);
      project.setError(`还有 ${blocking.length} 个问题需要先处理，才能提交运行。`);
      return;
    }
    setRunBusy(true);
    project.setError("");
    try {
      const saved = await project.save();
      const id = saved?.id ?? projectId;
      const wf = editor.serialize();
      const { prompt } = toApiPrompt(wf, defs);
      const result = await api.run({ projectId: id, title: project.title || "未命名工作流", prompt, workflow: wf });
      if (!result.ok) {
        const mapped = problemsFromServer({ error: result.error, node_errors: result.node_errors });
        setServerProblems(mapped.length ? mapped : [{ id: "server:reject", severity: "error", code: "rejected", nodeId: null, input: null, message: result.message, source: "server" }]);
        setProblemsOpen(true);
        project.setError(`服务器没有接受这次运行：${result.message}`);
        return;
      }
      setServerProblems([]);
      setLastLive(null);
      editor.advanceSeeds();
      burstUntil.current = Date.now() + 8000;
      kick.current();
      project.setNotice("已提交到队列。");
      void refreshRuns();
      void api.queue().then(setQueue).catch(() => {});
    } catch (e) {
      project.setError(e instanceof Error ? e.message : "提交失败。");
    } finally {
      setRunBusy(false);
    }
  }
  const runRef = useRef(run);
  runRef.current = run;

  async function interrupt() {
    try {
      await api.interrupt();
      project.setNotice("已请求中断。");
    } catch (e) {
      project.setError(e instanceof Error ? e.message : "中断失败。");
    }
  }
  async function cancelRun(runId: string) {
    try {
      await api.cancel(runId);
      void refreshRuns();
      void api.queue().then(setQueue).catch(() => {});
    } catch (e) {
      project.setError(e instanceof Error ? e.message : "取消失败。");
    }
  }

  // ---- files --------------------------------------------------------------------------------
  const adopt = useCallback(
    async (workflowNext: UiWorkflow, title: string, notes: string[] = []) => {
      if (workflowTooLarge(workflowNext)) {
        project.setError("这个工作流超过 880 KB，无法作为一个文稿保存。");
        return;
      }
      if (await project.replace(docOf(workflowNext), title)) {
        project.setNotice(notes.length ? `已导入为新文稿。${notes.join(" ")}` : "已导入为新文稿。");
      }
    },
    [project.replace, project.setError, project.setNotice],
  );
  async function importFile(file: File) {
    try {
      const result = await parseImport({ name: file.name, bytes: new Uint8Array(await file.arrayBuffer()) }, defs);
      await adopt(result.workflow, result.title, result.notes);
    } catch (e) {
      project.setError(e instanceof Error ? e.message : "导入失败。");
    }
  }
  const importText = typeof project.draft.importText === "string" ? project.draft.importText : "";
  const importOpen = project.draft.importOpen === true;
  async function importFromText() {
    try {
      const result = await parseImportText(importText, defs);
      project.setDraft((d) => ({ ...d, importOpen: false, importText: "" }));
      await adopt(result.workflow, result.title, result.notes);
    } catch (e) {
      project.setError(e instanceof Error ? e.message : "导入失败。");
    }
  }
  const stem = (project.title || "workflow").replace(/[^\w一-龥.-]+/g, "_");
  function exportUi() {
    if (!editor) return;
    download(new Blob([exportUiJson(editor.serialize())], { type: "application/json" }), `${stem}.json`);
  }
  function exportApi() {
    if (!editor) return;
    const { text, notes } = exportApiJson(editor.serialize(), defs);
    download(new Blob([text], { type: "application/json" }), `${stem}_api.json`);
    project.setNotice(notes.length ? `已导出 API 提示词。注意：${notes.join(" ")}` : "已导出 API 提示词（可直接 POST 到 /prompt）。");
  }
  async function newFromTemplate(id: string) {
    const wf = buildTemplate(id, defs, authoritative);
    await adopt(wf, id === "txt2img" ? "SDXL 文生图" : id, []);
  }
  async function loadRun(detail: RunDetail) {
    const when = new Date(detail.createdAt).toLocaleString("zh-CN", { hour12: false });
    await adopt(detail.workflow, `${detail.title} · 复现 ${when}`);
    project.setNotice("已把这次运行的工作流载入为新文稿（含当时的种子与参数）。");
  }
  async function deleteRun(run: RunSummary) {
    try {
      await api.deleteRun(run.id);
      void refreshRuns();
    } catch (e) {
      project.setError(e instanceof Error ? e.message : "删除失败。");
    }
  }

  // ---- uploads and previews of input images -----------------------------------------------------
  const onUpload = useCallback((node: LGraphNode, widget: IWidget) => {
    uploadTarget.current = { node, widget };
    uploadInput.current?.click();
  }, []);
  async function onUploadPicked(file: File) {
    const target = uploadTarget.current;
    if (!target || !editor) return;
    if (!server) {
      project.setError("上传图片需要先连接 ComfyUI。");
      return;
    }
    try {
      project.setNotice(`正在上传 ${file.name}…`);
      const sent = await api.upload(file);
      const combo = target.node.widgets?.find((w) => w.type === "combo" && Array.isArray((w.options as { values?: unknown }).values));
      if (combo) {
        const values = (combo.options as { values: string[] }).values;
        const name = sent.subfolder ? `${sent.subfolder}/${sent.name}` : sent.name;
        if (!values.includes(name)) values.push(name);
        combo.value = name as never;
      }
      editor.touch();
      setTick((t) => t + 1);
      project.setNotice(`已上传为 ${sent.name}。`);
    } catch (e) {
      project.setError(e instanceof Error ? e.message : "上传失败。");
    }
  }
  const inputImage = useCallback(
    (file: string) => {
      const cached = inputImages.current.get(file);
      if (cached && cached !== "loading") return cached;
      if (cached === "loading" || !server) return null;
      inputImages.current.set(file, "loading");
      const slash = file.lastIndexOf("/");
      void api
        .inputBlob(slash >= 0 ? file.slice(slash + 1) : file, slash >= 0 ? file.slice(0, slash) : "")
        .then(async (blob) => {
          const img = new Image();
          img.src = await blobToDataUrl(blob);
          await img.decode().catch(() => {});
          inputImages.current.set(file, img);
          editor?.redraw();
        })
        .catch(() => inputImages.current.set(file, new Image()));
      return null;
    },
    [server, editor],
  );

  const titleOf = (nodeId: string) => {
    const n = workflow.nodes.find((x) => String(x.id) === nodeId);
    return n ? n.title || defs[n.type]?.display_name || n.type : `节点 ${nodeId}`;
  };
  const addDef = (def: { name: string }) => {
    editor?.add(def.name);
    setTab("canvas");
    editor?.focus();
  };
  const emptyCanvas = workflow.nodes.length === 0;
  const runLabel = activeLive ? (activeLive.status === "queued" ? "排队中" : "运行中") : "运行";

  return (
    <div
      className="app"
      data-tab={tab}
      data-side={side ?? "none"}
      data-library={libraryOpen ? "open" : "closed"}
      onKeyDown={(e) => {
        if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
          e.preventDefault();
          void runRef.current();
        }
      }}
    >
      <h1 className="sr-only">ComfyUI 工作台</h1>
      <header className="topbar">
        <WorkflowMenu
          title={project.title}
          setTitle={project.setTitle}
          items={project.items}
          currentId={project.current?.id ?? null}
          canDelete={Boolean(project.current)}
          onOpen={(id) => void project.open(id)}
          onNew={() => void adopt(emptyWorkflow(), "未命名工作流")}
          onTemplate={(id) => void newFromTemplate(id)}
          onImportFile={() => fileInput.current?.click()}
          onImportText={() => project.setDraft((d) => ({ ...d, importOpen: true }))}
          onExportUi={exportUi}
          onExportApi={exportApi}
          onDelete={() => {
            if (confirm("删除这个工作流及其运行记录？此操作无法撤销。")) void project.remove();
          }}
        />
        <div className="tool-group" role="group" aria-label="编辑">
          <button type="button" className="icon-btn" disabled={!editor?.canUndo} onClick={() => { editor?.undo(); setTick((t) => t + 1); }} aria-label="撤销" title="撤销 (Ctrl+Z)">
            <Undo2 size={16} aria-hidden="true" />
          </button>
          <button type="button" className="icon-btn" disabled={!editor?.canRedo} onClick={() => { editor?.redo(); setTick((t) => t + 1); }} aria-label="重做" title="重做 (Ctrl+Shift+Z)">
            <Redo2 size={16} aria-hidden="true" />
          </button>
          <button type="button" className="icon-btn" onClick={() => canvas?.openSearch()} aria-label="搜索并添加节点" title="搜索并添加节点（双击画布）">
            <ListTree size={16} aria-hidden="true" />
          </button>
        </div>
        <button
          type="button"
          className={"chip problems-chip " + (errors.length ? "bad" : problems.length ? "warn" : "ok")}
          onClick={() => { setProblemsOpen((v) => !v); setSide("run"); setTab("run"); }}
          aria-expanded={problemsOpen}
          aria-label={`问题 ${problems.length} 个`}
        >
          <CircleAlert size={14} aria-hidden="true" />
          <span className="txt">{errors.length ? `${errors.length} 个错误` : problems.length ? `${problems.length} 个提示` : "校验通过"}</span>
          <span className="num">{errors.length || problems.length || ""}</span>
        </button>
        <span className="spacer" />
        <span className="save-state" role="status" data-phase={project.autoState.phase}>{project.autoState.message}</span>
        <button
          type="button"
          className={"chip conn " + (server ? "ok" : "off")}
          onClick={() => { setSide("run"); setTab("run"); }}
          title={server ? config?.baseUrl : "点击连接 ComfyUI"}
        >
          <Plug size={14} aria-hidden="true" />
          {server ? hostOf(config?.baseUrl ?? "") : "未连接"}
        </button>
        <button type="button" className="run-btn" onClick={() => void run()} disabled={runBusy || Boolean(activeLive)} aria-label="运行工作流" title="运行 (Ctrl+Enter)">
          {runBusy || activeLive ? <Loader2 size={15} className="spin" aria-hidden="true" /> : <Play size={15} aria-hidden="true" />}
          {runLabel}
        </button>
        <button type="button" className="icon-btn side-toggle" onClick={() => setSide(side ? null : "inspector")} aria-label={side ? "收起右侧面板" : "展开右侧面板"} title={side ? "收起右侧面板" : "展开右侧面板"}>
          {side ? <PanelRightClose size={16} aria-hidden="true" /> : <Settings2 size={16} aria-hidden="true" />}
        </button>
      </header>
      <Notice error={project.error} notice={project.notice} />
      <div className="stage">
        <aside className="library" aria-label="节点库" hidden={!libraryOpen}>
          <Library entries={entries} source={server ? "server" : "snapshot"} nodeCount={Object.keys(defs).length} onAdd={addDef} onCollapse={() => setLibraryOpen(false)} />
        </aside>
        {!libraryOpen && (
          <button type="button" className="library-rail" onClick={() => setLibraryOpen(true)} aria-label="展开节点库" title="展开节点库">
            <PanelLeftOpen size={16} aria-hidden="true" />
          </button>
        )}
        <main className="canvas-area">
          <CanvasView
            entries={entries}
            onReady={setCanvas}
            onChange={onChange}
            onSelection={(ids) => { setSelected(ids); if (ids.length && side !== "run") setSide("inspector"); }}
            onUpload={onUpload}
            inputImage={inputImage}
            onDropFile={(f) => void importFile(f)}
            empty={emptyCanvas}
          />
          {activeLive && (
            <div className="run-overlay">
              <RunProgress live={activeLive} title={titleOf} onInterrupt={() => void interrupt()} onCancel={() => void cancelRun(activeLive.runId)} />
            </div>
          )}
        </main>
        <aside className="side" aria-label="检查器与运行" hidden={!side}>
          <div className="side-tabs" role="tablist">
            <button type="button" role="tab" aria-selected={side === "inspector"} onClick={() => setSide("inspector")}>检查器</button>
            <button type="button" role="tab" aria-selected={side === "run"} onClick={() => setSide("run")}>运行{errors.length ? ` · ${errors.length}` : ""}</button>
          </div>
          {side === "inspector" ? (
            <Inspector editor={editor} selectedIds={selected} problems={problems} defs={defs} onUpload={onUpload} onChanged={() => setTick((t) => t + 1)} onRun={() => setSide("run")} key={tick < 0 ? 0 : selected.join(",")} />
          ) : (
            <div className="run-panel">
              <ConnectionForm
                key={config?.baseUrl ?? "new"}
                config={config}
                status={server?.status ?? null}
                error={connError}
                busy={connBusy}
                onConnect={(d) => void connect(d)}
                onForgetToken={() => void api.setConfig({ baseUrl: config?.baseUrl ?? "", headerName: config?.headerName ?? "", clearToken: true, remember: false }).then(setConfig).catch((e) => setConnError(String(e.message ?? e)))}
              />
              {activeLive && <RunProgress live={activeLive} title={titleOf} onInterrupt={() => void interrupt()} onCancel={() => void cancelRun(activeLive.runId)} />}
              {lastLive?.error && (
                <p className="bad run-error" role="alert"><CircleAlert size={14} aria-hidden="true" />{lastLive.error.nodeType ? `${lastLive.error.nodeType} #${lastLive.error.nodeId}：` : ""}{lastLive.error.message}</p>
              )}
              <section aria-label="问题" className="problem-section" data-open={problemsOpen || errors.length > 0}>
                <h4>问题 <span className="count">{problems.length}</span></h4>
                <ProblemList problems={problems} onFocus={(id) => { editor?.focusNode(id); setTab("canvas"); setSide("inspector"); }} />
              </section>
              {server && (
                <>
                  <QueueList entries={queue} onInterrupt={() => void interrupt()} onDelete={(e) => void api.deleteQueued(e.promptId).then(() => api.queue()).then(setQueue).catch(() => {})} />
                  <button type="button" className="link" onClick={() => void api.queue().then(setQueue).catch(() => {})}>刷新队列</button>
                </>
              )}
            </div>
          )}
        </aside>
        <Gallery runs={runs} lives={lives} expanded={galleryOpen} setExpanded={setGalleryOpen} onLoadWorkflow={(d) => void loadRun(d)} onDeleteRun={(r) => void deleteRun(r)} onError={project.setError} />
      </div>
      <nav className="tabs" aria-label="视图">
        {([["canvas", "画布"], ["run", "运行"], ["gallery", "图库"]] as const).map(([k, text]) => (
          <button type="button" key={k} aria-current={tab === k} onClick={() => { setTab(k); if (k === "run") setSide("run"); if (k === "gallery") setGalleryOpen(true); }}>{text}</button>
        ))}
      </nav>
      {importOpen && (
        <div className="scrim" onPointerDown={() => project.setDraft((d) => ({ ...d, importOpen: false }))}>
          <div
            className="dialog"
            role="dialog"
            aria-modal="true"
            aria-label="粘贴 JSON 导入"
            onPointerDown={(e) => e.stopPropagation()}
            onKeyDown={(e) => {
              if (e.key === "Escape") project.setDraft((d) => ({ ...d, importOpen: false }));
            }}
          >
            <h3>粘贴 JSON 导入</h3>
            <p className="muted">支持 ComfyUI 界面工作流或 API 提示词 JSON。导入会新建一个文稿，当前文稿保持不变。未完成的内容会保留。</p>
            <textarea
              autoFocus
              value={importText}
              onChange={(e) => project.setDraft((d) => ({ ...d, importText: e.target.value }))}
              aria-label="JSON 内容"
              spellCheck={false}
              rows={12}
            />
            <div className="dialog-actions">
              <button type="button" className="ghost" onClick={() => project.setDraft((d) => ({ ...d, importOpen: false }))}>关闭</button>
              <button type="button" className="primary-soft" disabled={!importText.trim()} onClick={() => void importFromText()}>导入为新文稿</button>
            </div>
          </div>
        </div>
      )}
      <input ref={fileInput} type="file" accept=".json,.png,application/json,image/png" hidden onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) void importFile(f); }} />
      <input ref={uploadInput} type="file" accept="image/png,image/jpeg,image/webp,image/gif,image/bmp" hidden onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) void onUploadPicked(f); }} />
    </div>
  );
}
