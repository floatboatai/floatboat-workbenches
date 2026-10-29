import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type DragEvent,
} from "react";
import {
  FolderOpen,
  Upload,
  Box,
  Scan,
  Palette,
  ListTree,
  Image as ImageIcon,
  Film,
  FileChartColumn,
  WandSparkles,
  MessageSquare,
  X,
  PanelRightOpen,
} from "lucide-react";
import { useWorkbenchState } from "./autosave-client";
import { RenderBoundary } from "./workspace";
import { AssetLibrary } from "./AssetLibrary";
import { Inspector, type InspectorMode } from "./Inspector";
import { Pipeline } from "./Pipeline";
import { AnimationBar, MaterialShelf, NodePalette, StageStrip } from "./overlays";
import { request, download } from "./requests";
import {
  seed,
  restoreAsset,
  validateAsset,
  recipeKey,
  validStages,
  stagesValue,
  documentRefs,
  nodeTransform,
  decimal,
  type AssetDocument,
  type Compression,
  type FileRef,
  type MaterialEdit,
  type NodeEdit,
  type Tab,
} from "../contracts/asset";
import { isRecord } from "../contracts/project";
import {
  PASS_BY_KIND,
  passValue,
  formatBytes,
  type PassKind,
  type PassOptions,
} from "../contracts/pipeline";
import type { Inspection } from "../contracts/inspection";
import { eulerToQuat } from "../contracts/transform";
import {
  exportModel,
  fromBytes,
  fromFile,
  importModel,
  readBytes,
  response,
  sha256,
  uploadResource,
  type Loaded,
} from "./files";
import { packProject, restoreResources, unpackProject, zipHasProject } from "./project-files";
import { Viewport, type Pose } from "./Viewport";

const TOOLS: { key: Tab; label: string; Icon: typeof Palette }[] = [
  { key: "optimize", label: "优化", Icon: WandSparkles },
  { key: "materials", label: "材质", Icon: Palette },
  { key: "nodes", label: "节点", Icon: ListTree },
  { key: "textures", label: "贴图", Icon: ImageIcon },
  { key: "animations", label: "动画", Icon: Film },
  { key: "resources", label: "报告", Icon: FileChartColumn },
];
const MODEL_ACCEPT =
  ".glb,.gltf,.bin,.zip,.png,.jpg,.jpeg,.webp,.ktx2,.avif,model/gltf-binary,model/gltf+json";
const randomId = () =>
  Array.from(crypto.getRandomValues(new Uint8Array(8)), (b) =>
    b.toString(16).padStart(2, "0"),
  ).join("");
/** Initial three-quarter view framing the model's bounds. */
function framing(bounds: Inspection["bounds"]) {
  if (!bounds) return { camera: seed.camera, target: seed.target };
  const c = bounds.min.map((v, i) => (v + bounds.max[i]) / 2),
    size = Math.hypot(...bounds.max.map((v, i) => v - bounds.min[i])) || 1,
    dir = [1, 0.62, 1.3],
    len = Math.hypot(...dir),
    camera = c.map((v, i) => v + (dir[i] / len) * size * 1.6);
  const clamp = (v: number) => Math.max(-1e7, Math.min(1e7, v));
  return {
    camera: camera.map(clamp) as [number, number, number],
    target: c.map(clamp) as [number, number, number],
  };
}
/** Adopts the newest stages when they complete the current recipe. */
function settle(d: AssetDocument): AssetDocument {
  const n = validStages(d);
  if (n !== d.passes.length + 1) return d;
  return { ...d, result: d.stages[n - 1].ref, appliedKey: recipeKey(d) };
}

export function App() {
  const p = useWorkbenchState(seed, validateAsset, "未命名资产", {
      storageKey: "gltf-transform-v1",
      restoreDraftData: restoreAsset,
    }),
    d = p.data;
  const [library, setLibrary] = useState(false),
    [inspectorOpen, setInspectorOpen] = useState(true),
    [inspectorMode, setInspectorMode] = useState<InspectorMode>("object");
  const inspectorTrigger = useRef<HTMLElement | null>(null),
    libraryTrigger = useRef<HTMLButtonElement>(null),
    inspectorToggle = useRef<HTMLButtonElement>(null);
  const [infos, setInfos] = useState<Record<string, Inspection>>({}),
    [pending, setPending] = useState(""),
    [running, setRunning] = useState<PassKind | "pipeline" | null>(null),
    [progress, setProgress] = useState(""),
    [resourceVersion, setResourceVersion] = useState(0),
    [fit, setFit] = useState(0),
    [playing, setPlaying] = useState(false),
    [liveTime, setLiveTime] = useState(0),
    [missing, setMissing] = useState(""),
    [dragging, setDragging] = useState(false);
  const file = useRef<HTMLInputElement>(null),
    projectFile = useRef<HTMLInputElement>(null),
    attach = useRef<HTMLInputElement>(null),
    textureFile = useRef<HTMLInputElement>(null),
    textureTarget = useRef(-1),
    epoch = useRef(0),
    transitioning = useRef(false),
    latest = useRef({ p, d });
  latest.current = { p, d };

  const valid = validStages(d),
    changes =
      Object.keys(d.edits.nodes).length +
      Object.keys(d.edits.materials).length +
      Object.keys(d.edits.textures).length +
      (d.edits.rootExtras !== null ? 1 : 0),
    hasRecipe = changes > 0 || d.passes.length > 0,
    legacyReady =
      !d.stages.length &&
      !d.passes.length &&
      Boolean(d.result) &&
      d.appliedKey === recipeKey(d),
    ready = !hasRecipe || valid === d.passes.length + 1 || legacyReady,
    stale = Boolean(d.source) && !ready,
    finalRef: FileRef | null = !d.source
      ? null
      : !hasRecipe
        ? d.source
        : legacyReady
          ? d.result
          : ready
            ? d.stages[d.passes.length].ref
            : null;
  const viewIndex =
    d.view === "source" ? -2 : d.stage < 0 ? d.passes.length : d.stage;
  const viewStage = viewIndex >= 0 && viewIndex < valid ? d.stages[viewIndex] : null;
  const viewRef: FileRef | null =
    !d.source || viewIndex === -2
      ? d.source
      : (viewStage?.ref ??
        (legacyReady ? d.result : (d.stages[Math.min(valid, d.passes.length + 1) - 1]?.ref ?? d.source)));
  const viewLabel =
    viewRef?.id === d.source?.id
      ? "原件"
      : viewStage
        ? viewIndex === 0
          ? "修订"
          : `第 ${viewIndex} 步`
        : "结果";
  const sourceInfo = d.source ? (infos[d.source.id] ?? null) : null,
    viewInfo = viewRef ? (infos[viewRef.id] ?? null) : null,
    locked = p.loading || p.busy || pending === "切换工程",
    busy = locked || Boolean(pending);

  useEffect(() => {
    document.title = "glTF · 模型优化台";
  }, []);
  // Document changes are guarded by documentKey checks; operations started after a
  // transition must not be cancelled by this effect running late.
  useEffect(() => {
    setPlaying(false);
    setLibrary(false);
    setInspectorOpen(Boolean(latest.current.d.source || latest.current.d.notes));
    setInspectorMode(
      latest.current.d.source || !latest.current.d.notes ? "object" : "notes",
    );
    setMissing("");
  }, [p.documentKey]);
  // Inspections are cached by content hash; refs are immutable.
  useEffect(() => {
    let cancelled = false;
    setMissing("");
    for (const ref of [d.source, viewRef]) {
      if (!ref || infos[ref.id]) continue;
      void request("/api/inspect/" + ref.id)
        .then((v) => {
          if (!cancelled)
            setInfos((old) => ({ ...old, [ref.id]: v as Inspection }));
        })
        .catch((e) => {
          if (!cancelled)
            setMissing(e instanceof Error ? e.message : "模型资源缺失。");
        });
    }
    return () => {
      cancelled = true;
    };
  }, [d.source?.id, viewRef?.id, resourceVersion]);

  const update = useCallback((patch: Partial<AssetDocument>) => {
    if (transitioning.current || latest.current.p.loading) return;
    latest.current.p.setData((old) => ({ ...old, ...patch }));
  }, []);
  const editNode = useCallback((patch: NodeEdit) => {
    if (transitioning.current || latest.current.p.loading) return;
    latest.current.p.setData((old) => ({
      ...old,
      edits: {
        ...old.edits,
        nodes: {
          ...old.edits.nodes,
          [old.selected]: { ...old.edits.nodes[old.selected], ...patch },
        },
      },
    }));
  }, []);
  const editMaterial = useCallback((patch: MaterialEdit) => {
    if (transitioning.current || latest.current.p.loading) return;
    latest.current.p.setData((old) => ({
      ...old,
      edits: {
        ...old.edits,
        materials: {
          ...old.edits.materials,
          [old.selected]: { ...old.edits.materials[old.selected], ...patch },
        },
      },
    }));
  }, []);

  async function transition(action: () => Promise<unknown>) {
    if (transitioning.current) return false;
    transitioning.current = true;
    epoch.current++;
    setPlaying(false);
    setPending("切换工程");
    try {
      const result = await action();
      return result !== false;
    } catch (e) {
      p.report(e);
      return false;
    } finally {
      setPending("");
      setProgress("");
      setRunning(null);
      transitioning.current = false;
    }
  }
  const showProgress = (label: string) => (sent: number, total: number) =>
    setProgress(`${label} ${formatBytes(sent)} / ${formatBytes(total)}`);

  async function openModel(files?: File[]) {
    const token = ++epoch.current,
      key = p.documentKey;
    setPending("导入资产");
    p.setError("");
    try {
      let loaded: Loaded;
      if (files) {
        const total = files.reduce((s, f) => s + f.size, 0);
        if (total > 64 * 1024 * 1024)
          throw Error(`所选文件合计 ${formatBytes(total)}，超过 64 MB 导入上限。`);
        loaded = await importModel(files.map(fromFile), showProgress("上传"));
        setProgress("服务端解析、解码与校验…");
      } else loaded = response(await request("/api/sample", { method: "POST" }));
      if (token !== epoch.current || latest.current.p.documentKey !== key) return;
      setInfos((old) => ({ ...old, [loaded.ref.id]: loaded.inspection }));
      const title = files
        ? loaded.ref.name.replace(/\.glb$/i, "")
        : "海上风机 T-07 · 交付优化";
      const done = await transition(() =>
        p.replace(
          { ...structuredClone(seed), source: loaded.ref, ...framing(loaded.inspection.bounds) },
          title,
        ),
      );
      if (done) {
        p.setNotice(
          [
            files ? `已导入 ${formatBytes(loaded.ref.bytes)} 规范 GLB` : "样例已载入：选择左侧优化步骤运行",
            ...loaded.notes,
          ].join("；"),
        );
      }
    } catch (e) {
      if (token === epoch.current) p.report(e);
    } finally {
      if (token === epoch.current) {
        setPending("");
        setProgress("");
      }
    }
  }
  async function openFiles(list: File[]) {
    if (!list.length) return;
    if (list.length === 1 && /\.json$/i.test(list[0].name))
      return importProject(list[0]);
    if (list.length === 1 && /\.zip$/i.test(list[0].name)) {
      const head = new Uint8Array(await list[0].arrayBuffer());
      if (zipHasProject(head)) return importProject(list[0]);
    }
    return openModel(list);
  }

  /** Runs (or resumes) the pipeline on the server, reusing still-valid stages. */
  async function process(
    next: AssetDocument,
    label: PassKind | "pipeline",
    added?: string,
  ) {
    if (!next.source) return;
    const token = ++epoch.current,
      key = p.documentKey;
    setPending("处理");
    setRunning(label);
    p.setError("");
    try {
      validateAsset(next);
      const out = await request("/api/process", {
        method: "POST",
        body: JSON.stringify({
          source: next.source,
          edits: next.edits,
          passes: next.passes,
          stages: next.stages.slice(0, validStages(next)),
        }),
      });
      if (!isRecord(out)) throw Error("处理响应无效。");
      const stages = stagesValue(out.stages);
      if (token !== epoch.current || latest.current.p.documentKey !== key) return;
      const current = latest.current.d;
      p.setData((old) =>
        settle({
          ...old,
          stages,
          view: old.passes.length || Object.keys(old.edits.nodes).length ? "result" : old.view,
          stage: -1,
        }),
      );
      if (recipeKey(current) !== recipeKey(next))
        p.setNotice("处理期间配方已更新；有效阶段已保留，请再次应用。");
      else if (label !== "pipeline") {
        const last = stages[stages.length - 1],
          prev = stages[stages.length - 2];
        p.setNotice(
          `${PASS_BY_KIND[label].label}完成：${prev ? formatBytes(prev.report.bytes) + " → " : ""}${formatBytes(last.report.bytes)} · ${last.report.drawCalls} 绘制调用${last.note ? "；" + last.note : ""}`,
        );
      } else p.setNotice("结果已更新，可在右上阶段条逐步对照。");
    } catch (e) {
      if (token === epoch.current) {
        p.report(e);
        // A failed one-click pass is not kept as a broken step.
        if (added && latest.current.p.documentKey === key)
          p.setData((old) => ({
            ...old,
            passes: old.passes.filter((s) => s.id !== added),
          }));
      }
    } finally {
      if (token === epoch.current) {
        setPending("");
        setRunning(null);
      }
    }
  }
  function draftOptions(kind: PassKind): PassOptions {
    const draft = d.passDrafts[kind] ?? {},
      options: PassOptions = {};
    for (const o of PASS_BY_KIND[kind].options) {
      const raw = draft[o.key];
      if (raw === undefined) continue;
      options[o.key] =
        o.type === "number" && typeof raw === "string"
          ? decimal(raw, PASS_BY_KIND[kind].label + o.label)
          : raw;
    }
    return options;
  }
  function runPass(kind: PassKind) {
    if (!d.source || busy) return;
    try {
      const step = passValue({ id: randomId(), kind, options: draftOptions(kind) });
      const next = { ...d, passes: [...d.passes, step] };
      p.setData((old) => ({ ...old, passes: [...old.passes, step] }));
      void process(next, kind, step.id);
    } catch (e) {
      p.report(e);
    }
  }
  function undo() {
    if (!d.passes.length || busy) return;
    const next = settle({ ...d, passes: d.passes.slice(0, -1), stage: -1 });
    p.setData((old) =>
      settle({ ...old, passes: old.passes.slice(0, -1), stage: -1 }),
    );
    p.setNotice(`已撤销${PASS_BY_KIND[d.passes[d.passes.length - 1].kind].label}。`);
    if (validStages(next) !== next.passes.length + 1 && (next.passes.length || changes))
      void process(next, "pipeline");
  }
  function removeStep(index: number) {
    if (busy) return;
    const passes = d.passes.filter((_, i) => i !== index),
      next = settle({ ...d, passes, stage: -1 });
    p.setData((old) =>
      settle({ ...old, passes: old.passes.filter((_, i) => i !== index), stage: -1 }),
    );
    if (validStages(next) !== passes.length + 1 && (passes.length || changes))
      void process(next, "pipeline");
  }
  function preview(stage: number) {
    if (stage === -2) update({ view: "source" });
    else update({ view: "result", stage: stage === d.passes.length ? -1 : stage });
  }
  const setDraft = useCallback(
    (kind: PassKind, key: string, value: string | boolean) =>
      update({
        passDrafts: {
          ...latest.current.d.passDrafts,
          [kind]: { ...latest.current.d.passDrafts[kind], [key]: value },
        },
      }),
    [update],
  );

  async function exportResult() {
    const token = epoch.current,
      key = p.documentKey,
      ref = finalRef,
      compression = d.compression;
    if (!ref || stale) return;
    setPending("导出结果");
    try {
      const bytes = await exportModel(ref, compression);
      if (token !== epoch.current || latest.current.p.documentKey !== key) return;
      const base = (p.title || ref.name.replace(/\.glb$/i, "")).replace(/[\\/:*?"<>|]+/g, "-");
      download(
        new Blob([bytes.slice().buffer], { type: "model/gltf-binary" }),
        base + (compression === "none" ? "" : "-" + compression) + ".glb",
      );
      p.setNotice(`已导出 ${formatBytes(bytes.length)}${compression === "none" ? "" : "（" + compression + " 压缩，已回读校验）"}。`);
    } catch (e) {
      if (token === epoch.current) p.report(e);
    } finally {
      if (token === epoch.current) setPending("");
    }
  }
  async function exportProject() {
    const token = epoch.current,
      key = p.documentKey,
      snapshot = {
        title: p.title,
        data: structuredClone(d),
        extra: structuredClone(p.draft),
      };
    setPending("导出工程");
    try {
      const packed = await packProject(snapshot, setProgress);
      if (token !== epoch.current || latest.current.p.documentKey !== key) return;
      download(packed.blob, (snapshot.title || "asset") + ".gltf-project.zip");
      p.setNotice(`完整工程包含 ${packed.count} 个资源与当前工作稿。`);
    } catch (e) {
      if (token === epoch.current) p.report(e);
    } finally {
      if (token === epoch.current) {
        setPending("");
        setProgress("");
      }
    }
  }
  async function importProject(f: File) {
    const token = ++epoch.current,
      key = p.documentKey;
    setPending("导入工程");
    p.setError("");
    try {
      const { value, entries } = await unpackProject(f),
        { restored, unresolved } = await restoreResources(value.data, entries, setProgress);
      if (token !== epoch.current || latest.current.p.documentKey !== key) return;
      const done = await transition(() => p.replace(value.data, value.title, value.extra));
      if (!done) return;
      setResourceVersion((v) => v + 1);
      p.setNotice(
        unresolved
          ? `工作稿已恢复为新文档；${unresolved} 个资源缺失，可用同一文件补齐。`
          : `工程已恢复为新文档${restored ? `，上传了 ${restored} 个资源` : ""}。`,
      );
    } catch (e) {
      if (token === epoch.current) p.report(e);
    } finally {
      if (token === epoch.current) {
        setPending("");
        setProgress("");
      }
    }
  }
  async function reattach(list: File[]) {
    const key = p.documentKey,
      token = epoch.current,
      refs = documentRefs(d);
    setPending("补齐资源");
    try {
      let matched = 0;
      for (const f of list) {
        const bytes = new Uint8Array(await f.arrayBuffer()),
          hash = await sha256(bytes),
          hit = refs.find((r) => r.ref.id === hash && r.ref.bytes === bytes.length);
        if (!hit) continue;
        if (hit.kind === "image") await uploadResource(fromBytes(f.name, bytes), "image");
        else await uploadResource(fromBytes(f.name, bytes), "model");
        matched++;
      }
      if (!matched) throw Error("所选文件与工程引用的 SHA-256 都不匹配。");
      if (token !== epoch.current || latest.current.p.documentKey !== key) return;
      setInfos({});
      setResourceVersion((v) => v + 1);
      await p.save();
      p.setNotice(`已补齐 ${matched} 个资源，预览已重新读取。`);
    } catch (e) {
      if (token === epoch.current) p.report(e);
    } finally {
      if (token === epoch.current) setPending("");
    }
  }
  async function replaceTexture(f: File) {
    const index = textureTarget.current,
      key = p.documentKey,
      token = epoch.current;
    if (index < 0) return;
    setPending("上传贴图");
    try {
      const ref = await uploadResource(fromFile(f), "image", showProgress("上传贴图"));
      if (token !== epoch.current || latest.current.p.documentKey !== key) return;
      p.setData((old) => ({
        ...old,
        edits: { ...old.edits, textures: { ...old.edits.textures, [index]: ref } },
      }));
      p.setNotice(`贴图 ${index + 1} 将替换为 ${ref.name}（${ref.width}×${ref.height}），应用修订后生效。`);
    } catch (e) {
      if (token === epoch.current) p.report(e);
    } finally {
      if (token === epoch.current) {
        setPending("");
        setProgress("");
      }
    }
  }

  const onFiles =
    (fn: (f: File[]) => Promise<void> | void) => (e: ChangeEvent<HTMLInputElement>) => {
      const list = Array.from(e.target.files ?? []);
      e.target.value = "";
      if (list.length) void fn(list);
    };
  function showInspector(mode: InspectorMode, trigger: HTMLElement) {
    inspectorTrigger.current = trigger;
    setInspectorMode(mode);
    setInspectorOpen(true);
  }
  function hideInspector() {
    setInspectorOpen(false);
    requestAnimationFrame(() => {
      const target = inspectorTrigger.current;
      if (target?.getClientRects().length) target.focus();
      else inspectorToggle.current?.focus();
    });
  }
  useEffect(() => {
    const key = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !library && inspectorOpen) {
        event.preventDefault();
        hideInspector();
      }
      const target = event.target as HTMLElement | null;
      if (
        (event.metaKey || event.ctrlKey) &&
        !event.shiftKey &&
        event.key.toLowerCase() === "z" &&
        !library &&
        !target?.closest("input,textarea,select,[contenteditable]")
      ) {
        event.preventDefault();
        undo();
      }
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  });
  const poses = useMemo(() => {
    const out: Record<number, Pose> = {};
    for (const [k, e] of Object.entries(d.edits.nodes)) {
      try {
        const t = nodeTransform(e);
        if (!t.translation && !t.rotation && !t.scale) continue;
        out[Number(k)] = {
          translation: t.translation,
          quaternion: t.rotation ? eulerToQuat(t.rotation) : undefined,
          scale: t.scale,
        };
      } catch {
        /* unfinished input keeps the previous pose */
      }
    }
    return out;
  }, [d.edits.nodes]);
  const livePoses = viewRef?.id === d.source?.id ? poses : NO_POSES;
  const clipInfo = viewInfo?.animations[Number(d.clip) || 0];
  const notesMode = inspectorMode === "notes";
  const report = viewStage?.report ?? viewInfo?.report ?? null;
  const edited = Boolean(d.stages[0] && d.source && d.stages[0].ref.id !== d.source.id);

  const pipeline = (
    <Pipeline
      document={d}
      sourceReport={sourceInfo?.report ?? null}
      viewReport={report}
      viewLabel={viewLabel}
      valid={valid}
      running={running}
      disabled={busy}
      onDraft={setDraft}
      onRun={runPass}
      onUndo={undo}
      onRemove={removeStep}
      onPreview={preview}
    />
  );
  return (
    <RenderBoundary>
      <main
        className={"model-room " + (!d.source ? "is-empty" : "")}
        onDragOver={(e: DragEvent) => {
          if (e.dataTransfer.types.includes("Files") && !busy) {
            e.preventDefault();
            setDragging(true);
          }
        }}
        onDragLeave={(e) => {
          if (e.currentTarget === e.target) setDragging(false);
        }}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          if (!busy) void openFiles(Array.from(e.dataTransfer.files));
        }}
      >
        <h1 className="sr-only">模型优化</h1>
        <a className="skip-link" href="#model-space">
          跳到模型视图
        </a>
        <div id="model-space" tabIndex={-1} className="canvas-layer">
          <Viewport
            key={p.documentKey}
            document={d}
            model={viewRef}
            poses={livePoses}
            resourceVersion={resourceVersion}
            playing={playing}
            disabled={locked || library}
            fit={fit}
            onView={(camera, target) =>
              p.setData((old) => ({ ...old, camera, target }))
            }
            onTime={setLiveTime}
            onReady={() => {}}
          />
        </div>
        {dragging ? (
          <div className="drop-hint" aria-hidden="true">
            松开以导入 GLB / glTF / ZIP 或工程
          </div>
        ) : null}
        <div className="asset-corner">
          <button
            className="library-trigger"
            ref={libraryTrigger}
            aria-label="打开资产库"
            aria-haspopup="dialog"
            aria-expanded={library}
            disabled={locked}
            onClick={() => {
              setLibrary(true);
              p.setError("");
              void p.refresh().catch(p.report);
            }}
          >
            <FolderOpen size={18} />
            <span>资产库</span>
          </button>
          <div className="current-file">
            <label>
              <span className="sr-only">资产名称</span>
              <input
                aria-label="资产名称"
                name="asset-title"
                autoComplete="off"
                value={p.title}
                maxLength={120}
                onChange={(e) => p.setTitle(e.target.value)}
                disabled={locked}
              />
            </label>
            <div className={"save-status " + p.autoState.phase} role="status" data-testid="save-status">
              <i />
              {progress || p.autoState.message}
            </div>
          </div>
        </div>
        {d.source ? (
          <>
            <fieldset className="view-controls" disabled={locked} aria-label="模型视图">
              <StageStrip
                document={d}
                valid={valid}
                viewIndex={viewIndex}
                edited={edited || Boolean(changes)}
                sourceBytes={sourceInfo?.report.bytes}
                onPreview={preview}
              />
              <button className="icon-button" onClick={() => setFit((v) => v + 1)} aria-label="适配模型视图">
                <Scan size={19} />
              </button>
              {!inspectorOpen ? (
                <button
                  className="icon-button"
                  aria-label="展开检查器"
                  ref={inspectorToggle}
                  onClick={(e) => showInspector("object", e.currentTarget)}
                >
                  <PanelRightOpen size={18} />
                </button>
              ) : null}
            </fieldset>
            <fieldset className="context-rail" disabled={locked} aria-label="模型上下文工具">
              {TOOLS.map(({ key, label, Icon }) => (
                <button
                  key={key}
                  aria-pressed={!notesMode && d.tab === key && inspectorOpen}
                  aria-label={label + "检查"}
                  onClick={(e) => {
                    update({
                      tab: key,
                      selected:
                        d.tab === key || (key !== "materials" && key !== "nodes") ? d.selected : 0,
                    });
                    showInspector("object", e.currentTarget);
                  }}
                >
                  <Icon size={19} />
                  <span>{label}</span>
                </button>
              ))}
              <span className="rail-divider" />
              <button
                aria-pressed={notesMode && inspectorOpen}
                aria-label="检查备注"
                onClick={(e) => showInspector("notes", e.currentTarget)}
              >
                <MessageSquare size={19} />
                <span>备注</span>
              </button>
            </fieldset>
            {d.tab === "nodes" && inspectorOpen && !notesMode ? (
              <NodePalette
                document={d}
                source={sourceInfo}
                locked={locked}
                onSelect={(index) => update({ selected: index })}
                onClose={hideInspector}
              />
            ) : null}
            {d.tab === "materials" && sourceInfo ? (
              <MaterialShelf
                document={d}
                source={sourceInfo}
                locked={locked}
                withInspector={inspectorOpen}
                notesMode={notesMode}
                onSelect={(index, trigger) => {
                  update({ selected: index });
                  showInspector("object", trigger);
                }}
              />
            ) : null}
            <div className={"asset-readout " + (inspectorOpen ? "with-inspector" : "")}>
              <span>{viewLabel}</span>
              <span>
                {report
                  ? `${report.drawCalls.toLocaleString()} 绘制 · ${report.triangles.toLocaleString()} 面 · ${report.textures} 贴图 · ${formatBytes(report.bytes)}`
                  : "读取模型…"}
              </span>
              <span className="source-name">{viewRef?.name}</span>
            </div>
            {viewInfo?.animations.length ? (
              <AnimationBar
                document={d}
                view={viewInfo}
                playing={playing}
                liveTime={liveTime}
                locked={locked}
                withInspector={inspectorOpen}
                onClip={(clip) => {
                  setPlaying(false);
                  update({ clip, time: 0 });
                }}
                onToggle={() => {
                  if (playing) update({ time: liveTime % (clipInfo?.duration || 1) });
                  setPlaying((v) => !v);
                }}
                onSeek={(time) => {
                  setPlaying(false);
                  update({ time });
                }}
              />
            ) : null}
          </>
        ) : (
          <section className="open-asset">
            <Box size={30} />
            <h1>打开模型</h1>
            <p>看清绘制调用、面数与贴图显存，逐步优化后导出。</p>
            <button className="primary" disabled={busy} onClick={() => file.current?.click()}>
              <Upload size={18} />
              {pending === "导入资产" ? progress || "正在导入…" : "选择模型文件"}
            </button>
            <div>
              <button className="text-button" disabled={busy} onClick={() => void openModel()}>
                载入风机样例
              </button>
              <span>·</span>
              <button className="text-button" disabled={busy} onClick={() => projectFile.current?.click()}>
                导入工程或恢复稿
              </button>
            </div>
            <small>GLB · glTF + .bin + 贴图（可多选）· ZIP · 拖入画布 · 合计 ≤ 64 MB</small>
            <small>支持 KHR 材质扩展、纹理变换、量化、GPU 实例；Draco / Meshopt 导入时解码</small>
          </section>
        )}
        {d.source || notesMode ? (
          <Inspector
            open={inspectorOpen}
            mode={inspectorMode}
            document={d}
            source={sourceInfo}
            view={viewInfo}
            viewLabel={viewLabel}
            sourceReport={sourceInfo?.report ?? null}
            pipeline={pipeline}
            locked={locked}
            pending={pending}
            stale={stale}
            changes={changes}
            playing={playing}
            onClose={hideInspector}
            onMaterial={editMaterial}
            onNode={editNode}
            onResetNode={() =>
              p.setData((old) => {
                const nodes = { ...old.edits.nodes };
                delete nodes[old.selected];
                return { ...old, edits: { ...old.edits, nodes } };
              })
            }
            onNotes={(v) => update({ notes: v })}
            onRootExtras={(v) => {
              if (!transitioning.current)
                p.setData((old) => ({ ...old, edits: { ...old.edits, rootExtras: v } }));
            }}
            onReplaceTexture={(index) => {
              textureTarget.current = index;
              textureFile.current?.click();
            }}
            onRevertTexture={(index) =>
              p.setData((old) => {
                const textures = { ...old.edits.textures };
                delete textures[index];
                return { ...old, edits: { ...old.edits, textures } };
              })
            }
            onClip={(index, play) => {
              if (String(index) !== String(Number(d.clip) || 0)) update({ clip: String(index), time: 0 });
              else if (!play) update({ time: liveTime % (clipInfo?.duration || 1) });
              setPlaying(play);
            }}
            onReset={() => {
              if (confirm("清除全部修订配方？优化步骤、原件和检查备注将保留。"))
                p.setData((old) => settle({ ...old, edits: structuredClone(seed.edits) }));
            }}
            onApply={() => void process(d, "pipeline")}
            onCompression={(c: Compression) => update({ compression: c })}
            onExport={() => void exportResult()}
            onProject={() => void exportProject()}
            onRecovery={() => p.exportDraft()}
          />
        ) : null}
        {p.error || p.notice || missing || p.autoState.phase === "conflict" ? (
          <div className={"room-feedback " + (inspectorOpen && d.source ? "with-inspector" : "")}>
            <div
              className={p.error || missing ? "feedback-message error" : "feedback-message"}
              role={p.error || missing ? "alert" : "status"}
            >
              <span>{p.error || missing || p.notice || p.autoState.message}</span>
              {missing ? (
                <button disabled={Boolean(pending)} onClick={() => attach.current?.click()}>
                  补齐资源文件
                </button>
              ) : null}
              {!missing ? (
                <button
                  className="icon-button"
                  aria-label="关闭提示"
                  onClick={() => {
                    p.setError("");
                    p.setNotice("");
                  }}
                >
                  <X size={14} />
                </button>
              ) : null}
            </div>
            {p.autoState.phase === "conflict" ? (
              <div className="conflict-actions">
                <button onClick={() => p.exportDraft()}>下载冲突工作稿</button>
                <button
                  disabled={!p.current || locked}
                  onClick={() => void transition(() => p.open(p.current!.id))}
                >
                  打开服务器版本
                </button>
              </div>
            ) : null}
          </div>
        ) : null}
        <AssetLibrary
          open={library}
          busy={locked}
          items={p.items}
          currentId={p.current?.id}
          currentTitle={p.title}
          onClose={() => setLibrary(false)}
          onOpen={(id) => void transition(() => p.open(id))}
          onNew={() => void transition(() => p.fresh())}
          onModel={() => {
            setLibrary(false);
            file.current?.click();
          }}
          onProject={() => {
            setLibrary(false);
            projectFile.current?.click();
          }}
          onDelete={() => void transition(() => p.remove())}
          onRecovery={() => p.exportDraft()}
          onNotes={() => {
            setLibrary(false);
            if (libraryTrigger.current) showInspector("notes", libraryTrigger.current);
          }}
          onRepair={() => {
            setLibrary(false);
            attach.current?.click();
          }}
          onRetry={() => void p.save()}
          saveMessage={p.autoState.message}
          error={p.error}
        />
        <input hidden ref={file} aria-label="导入模型文件" type="file" multiple accept={MODEL_ACCEPT} onChange={onFiles(openFiles)} />
        <input hidden ref={projectFile} aria-label="导入工程文件" type="file" accept=".zip,.json" onChange={onFiles((l) => importProject(l[0]))} />
        <input hidden ref={attach} aria-label="补齐资源文件" type="file" multiple accept=".glb,.png,.jpg,.jpeg,.webp" onChange={onFiles(reattach)} />
        <input hidden ref={textureFile} aria-label="替换贴图文件" type="file" accept=".png,.jpg,.jpeg,.webp,image/png,image/jpeg,image/webp" onChange={onFiles((l) => replaceTexture(l[0]))} />
      </main>
    </RenderBoundary>
  );
}
const NO_POSES: Record<number, Pose> = {};
