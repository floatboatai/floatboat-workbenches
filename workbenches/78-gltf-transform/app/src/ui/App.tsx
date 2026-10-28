import { useEffect, useRef, useState, type ChangeEvent } from "react";
import {
  FolderOpen,
  Upload,
  Box,
  Layers,
  Scan,
  Play,
  Pause,
  Palette,
  Boxes,
  Package,
  MessageSquare,
  X,
  PanelRightOpen,
} from "lucide-react";
import { useWorkbenchState } from "./autosave-client";
import { RenderBoundary } from "./workspace";
import { AssetLibrary } from "./AssetLibrary";
import { Inspector } from "./Inspector";
import { request, download } from "./requests";
import {
  seed,
  restoreAsset,
  validateAsset,
  recipeKey,
  importAsset,
  MAX_FILE,
  MAX_PROJECT,
  byteSize,
  type AssetDocument,
  type MaterialEdit,
  type NodeEdit,
} from "../contracts/asset";
import { isRecord } from "../contracts/project";
import type { Inspection } from "../contracts/inspection";
import { upload, response, readBytes, sha256 } from "./files";
import { base64, unbase64 } from "./preview";
import { Viewport } from "./Viewport";
const kb = (v: number) =>
  v >= 1000000
    ? (v / 1000000).toFixed(2) + " MB"
    : (v / 1000).toFixed(1) + " KB";
export function App() {
  const p = useWorkbenchState(seed, validateAsset, "未命名资产", {
      storageKey: "gltf-transform-v1",
      restoreDraftData: restoreAsset,
    }),
    d = p.data;
  const [library, setLibrary] = useState(false),
    [inspectorOpen, setInspectorOpen] = useState(true),
    [inspectorMode, setInspectorMode] = useState<"object" | "notes">("object");
  const inspectorTrigger = useRef<HTMLElement | null>(null),
    libraryTrigger = useRef<HTMLButtonElement>(null),
    inspectorToggle = useRef<HTMLButtonElement>(null);
  const [inspection, setInspection] = useState<Inspection | null>(null),
    [sourceInfo, setSourceInfo] = useState<Inspection | null>(null),
    [pending, setPending] = useState(""),
    [resourceVersion, setResourceVersion] = useState(0),
    [fit, setFit] = useState(0),
    [playing, setPlaying] = useState(false),
    [liveTime, setLiveTime] = useState(0),
    [loaded, setLoaded] = useState({ meshes: 0, textures: 0 }),
    [missing, setMissing] = useState("");
  const file = useRef<HTMLInputElement>(null),
    projectFile = useRef<HTMLInputElement>(null),
    attach = useRef<HTMLInputElement>(null),
    epoch = useRef(0),
    transitioning = useRef(false),
    latest = useRef({ p, d });
  latest.current = { p, d };
  const selectedRef = d.view === "result" ? d.result : d.source,
    currentKey = recipeKey(d),
    stale = Boolean(d.result && d.appliedKey !== currentKey),
    locked = p.loading || p.busy || pending === "切换工程";
  useEffect(() => {
    document.title = "glTF · 资产检查台";
  }, []);
  useEffect(() => {
    epoch.current++;
    setPlaying(false);
    setLibrary(false);
    setInspectorOpen(Boolean(d.source || d.notes));
    setInspectorMode(d.source || !d.notes ? "object" : "notes");
    setPending("");
    setMissing("");
    setSourceInfo(null);
    setInspection(null);
  }, [p.documentKey]);
  useEffect(() => {
    let cancelled = false;
    setInspection(null);
    setMissing("");
    if (!selectedRef) return;
    void request("/api/inspect/" + selectedRef.id)
      .then((v) => {
        if (!cancelled) setInspection(v as Inspection);
      })
      .catch((e) => {
        if (!cancelled)
          setMissing(e instanceof Error ? e.message : "模型资源缺失。");
      });
    return () => {
      cancelled = true;
    };
  }, [selectedRef?.id, p.documentKey, resourceVersion]);
  useEffect(() => {
    let cancelled = false;
    setSourceInfo(null);
    if (!d.source) return;
    void request("/api/inspect/" + d.source.id)
      .then((v) => {
        if (!cancelled) setSourceInfo(v as Inspection);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [d.source?.id, p.documentKey, resourceVersion]);
  function update(patch: Partial<AssetDocument>) {
    if (transitioning.current || latest.current.p.loading) return;
    p.setData((old) => ({ ...old, ...patch }));
  }
  function nodePatch(patch: NodeEdit) {
    if (transitioning.current || latest.current.p.loading) return;
    p.setData((old) => ({
      ...old,
      edits: {
        ...old.edits,
        nodes: {
          ...old.edits.nodes,
          [old.selected]: { ...old.edits.nodes[old.selected], ...patch },
        },
      },
    }));
  }
  function materialPatch(patch: MaterialEdit) {
    if (transitioning.current || latest.current.p.loading) return;
    p.setData((old) => ({
      ...old,
      edits: {
        ...old.edits,
        materials: {
          ...old.edits.materials,
          [old.selected]: { ...old.edits.materials[old.selected], ...patch },
        },
      },
    }));
  }
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
      transitioning.current = false;
    }
  }
  async function loadModel(f?: File) {
    const token = ++epoch.current,
      key = p.documentKey;
    setPending("导入资产");
    p.setError("");
    try {
      if (f && f.size > MAX_FILE)
        throw Error("模型限1.4MB，请在上游工具精简后导入。");
      const loaded = f
        ? await upload(new Uint8Array(await f.arrayBuffer()), f.name)
        : response(await request("/api/sample", { method: "POST" }));
      if (token !== epoch.current || latest.current.p.documentKey !== key)
        return;
      await transition(() =>
        p.replace(
          { ...structuredClone(seed), source: loaded.ref },
          f?.name.replace(/\.glb$/i, "") ?? "陶土与瓷 · 材质研究",
        ),
      );
      p.setNotice("原件已保存；修订将生成独立结果。");
    } catch (e) {
      if (token === epoch.current) p.report(e);
    } finally {
      if (token === epoch.current) setPending("");
    }
  }
  async function generate() {
    const token = ++epoch.current,
      key = p.documentKey,
      input = structuredClone(d),
      revision = recipeKey(input);
    if (!input.source) return;
    setPending("生成修订");
    p.setError("");
    try {
      validateAsset(input);
      const out = response(
        await request("/api/process", {
          method: "POST",
          body: JSON.stringify({ source: input.source, edits: input.edits }),
        }),
      );
      if (token !== epoch.current || latest.current.p.documentKey !== key)
        return;
      if (recipeKey(latest.current.d) !== revision) {
        p.setNotice("处理期间配方已更新。旧结果未应用，请再次生成。");
        return;
      }
      p.setData((old) => ({
        ...old,
        result: out.ref,
        appliedKey: revision,
        view: "result",
      }));
      setInspection(out.inspection);
      p.setNotice("修订已更新，可切换对照或导出 GLB。");
    } catch (e) {
      if (token === epoch.current) p.report(e);
    } finally {
      if (token === epoch.current) setPending("");
    }
  }
  async function exportResult() {
    const token = epoch.current,
      key = p.documentKey,
      snapshot = structuredClone(d);
    if (!snapshot.result || snapshot.appliedKey !== recipeKey(snapshot)) return;
    setPending("导出结果");
    try {
      const bytes = await readBytes(snapshot.result);
      if (
        token !== epoch.current ||
        latest.current.p.documentKey !== key ||
        recipeKey(latest.current.d) !== recipeKey(snapshot)
      )
        return;
      download(
        new Blob([bytes.slice().buffer], { type: "model/gltf-binary" }),
        snapshot.result.name,
      );
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
      const refs = [snapshot.data.source, snapshot.data.result].filter(
          (x) => x !== null,
        ),
        unique = refs.filter(
          (r, i) => refs.findIndex((x) => x.id === r.id) === i,
        ),
        resources = await Promise.all(
          unique.map(async (ref) => ({
            id: ref.id,
            name: ref.name,
            base64: base64(await readBytes(ref)),
          })),
        );
      if (token !== epoch.current || latest.current.p.documentKey !== key)
        return;
      const value = {
        format: "floatboat-gltf-project",
        version: 1,
        ...snapshot,
        resources,
      };
      if (byteSize(value) > MAX_PROJECT) throw Error("完整工程超出12MiB预算。");
      download(
        new Blob([JSON.stringify(value)], { type: "application/json" }),
        (snapshot.title || "asset") + ".gltf-project.json",
      );
      p.setNotice("完整工程包含原件、结果与当前工作稿。");
    } catch (e) {
      if (token === epoch.current) p.report(e);
    } finally {
      if (token === epoch.current) setPending("");
    }
  }
  async function importProject(f: File) {
    const token = ++epoch.current,
      key = p.documentKey;
    setPending("导入工程");
    p.setError("");
    try {
      if (f.size > MAX_PROJECT) throw Error("工程文件超过12MiB。");
      const raw: unknown = JSON.parse(await f.text()),
        value = importAsset(raw);
      if (value.resources.length > 2) throw Error("完整工程最多两个独立模型。");
      const refs = [value.data.source, value.data.result].filter(
        (x) => x !== null,
      );
      for (const r of value.resources) {
        if (
          !isRecord(r) ||
          typeof r.id !== "string" ||
          typeof r.base64 !== "string" ||
          r.base64.length > Math.ceil(MAX_FILE / 3) * 4 ||
          !/^[A-Za-z0-9+/]+={0,2}$/.test(r.base64)
        )
          throw Error("工程资源结构无效。");
        const ref = refs.find((ref) => ref.id === r.id);
        if (!ref) throw Error("工程包含未引用资源。");
        const bytes = unbase64(r.base64);
        if (
          base64(bytes) !== r.base64 ||
          bytes.length !== ref.bytes ||
          (await sha256(bytes)) !== ref.id
        )
          throw Error("工程资源hash不匹配。");
        await upload(bytes, ref.name);
      }
      if (token !== epoch.current || latest.current.p.documentKey !== key)
        return;
      await transition(() => p.replace(value.data, value.title, value.extra));
      setResourceVersion((v) => v + 1);
      p.setNotice("工程工作稿已恢复；缺失资源可用相同文件补齐。");
    } catch (e) {
      if (token === epoch.current) p.report(e);
    } finally {
      if (token === epoch.current) setPending("");
    }
  }
  async function reattach(f: File) {
    const key = p.documentKey,
      token = epoch.current;
    setPending("补齐资源");
    try {
      if (f.size > MAX_FILE) throw Error("资源超过1.4MB。");
      const bytes = new Uint8Array(await f.arrayBuffer()),
        hash = await sha256(bytes);
      if (
        ![d.source, d.result].some(
          (r) => r?.id === hash && r.bytes === bytes.length,
        )
      )
        throw Error("文件与原件或结果的SHA-256不匹配。");
      await upload(bytes, f.name);
      if (token !== epoch.current || latest.current.p.documentKey !== key)
        return;
      setResourceVersion((v) => v + 1);
      await p.save();
      p.setNotice("匹配资源已补齐，预览已重新读取。");
    } catch (e) {
      if (token === epoch.current) p.report(e);
    } finally {
      if (token === epoch.current) setPending("");
    }
  }
  const changed =
    Object.keys(d.edits.nodes).length +
    Object.keys(d.edits.materials).length +
    (d.edits.rootExtras !== null ? 1 : 0);
  const onFile =
    (fn: (f: File) => Promise<void>) => (e: ChangeEvent<HTMLInputElement>) => {
      const f = e.target.files?.[0];
      e.target.value = "";
      if (f) void fn(f);
    };
  function showInspector(mode: "object" | "notes", trigger: HTMLElement) {
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
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !library && inspectorOpen) {
        event.preventDefault();
        hideInspector();
      }
    };
    window.addEventListener("keydown", escape);
    return () => window.removeEventListener("keydown", escape);
  }, [library, inspectorOpen]);
  const actionDisabled = locked || Boolean(pending),
    notesMode = inspectorMode === "notes";
  return (
    <RenderBoundary>
      <main className={"model-room " + (!d.source ? "is-empty" : "")}>
        <h1 className="sr-only">模型检查</h1>
        <a className="skip-link" href="#model-space">
          跳到模型视图
        </a>
        <div id="model-space" tabIndex={-1} className="canvas-layer">
          <Viewport
            key={p.documentKey}
            document={d}
            resourceVersion={resourceVersion}
            playing={playing}
            disabled={locked || library}
            fit={fit}
            onView={(camera, target) =>
              p.setData((old) => ({ ...old, camera, target }))
            }
            onTime={setLiveTime}
            onReady={(meshes, textures) => setLoaded({ meshes, textures })}
          />
        </div>
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
            <div
              className={"save-status " + p.autoState.phase}
              role="status"
              data-testid="save-status"
            >
              <i />
              {p.autoState.message}
            </div>
          </div>
        </div>
        {d.source ? (
          <>
            <fieldset
              className="view-controls"
              disabled={locked}
              aria-label="模型视图"
            >
              <div className="view-switch">
                <button
                  aria-pressed={d.view === "source"}
                  onClick={() => update({ view: "source" })}
                >
                  原件
                </button>
                <button
                  disabled={!d.result}
                  aria-pressed={d.view === "result"}
                  onClick={() => update({ view: "result" })}
                >
                  修订{stale ? <i aria-label="待更新" /> : null}
                </button>
              </div>
              <button
                className="icon-button"
                onClick={() => setFit((v) => v + 1)}
                aria-label="适配模型视图"
              >
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
            <fieldset
              className="context-rail"
              disabled={locked}
              aria-label="模型上下文工具"
            >
              {(
                [
                  { key: "materials", label: "材质", Icon: Palette },
                  { key: "nodes", label: "节点", Icon: Boxes },
                  { key: "resources", label: "资源", Icon: Package },
                ] as const
              ).map(({ key, label, Icon }) => (
                <button
                  key={key}
                  aria-pressed={!notesMode && d.tab === key && inspectorOpen}
                  aria-label={label + "检查"}
                  onClick={(e) => {
                    update({
                      tab: key,
                      selected: d.tab === key ? d.selected : 0,
                    });
                    showInspector("object", e.currentTarget);
                  }}
                >
                  <Icon size={20} />
                  <span>{label}</span>
                </button>
              ))}
              <span className="rail-divider" />
              <button
                aria-pressed={notesMode && inspectorOpen}
                aria-label="检查备注"
                onClick={(e) => showInspector("notes", e.currentTarget)}
              >
                <MessageSquare size={20} />
                <span>备注</span>
              </button>
            </fieldset>
            {d.tab === "nodes" && inspectorOpen && !notesMode ? (
              <fieldset
                className="node-palette"
                disabled={locked}
                aria-label="节点目录"
              >
                <div className="palette-label">
                  节点 <span>{sourceInfo?.nodes.length ?? 0}</span>
                  <button
                    className="icon-button"
                    aria-label="关闭节点目录"
                    onClick={hideInspector}
                  >
                    <X size={14} />
                  </button>
                </div>
                {sourceInfo?.nodes.map((row) => (
                  <button
                    key={row.index}
                    aria-pressed={d.selected === row.index}
                    onClick={(e) => {
                      update({ selected: row.index });
                      showInspector("object", e.currentTarget);
                    }}
                  >
                    <Box size={16} />
                    <span>
                      {(d.edits.nodes[row.index]?.name ?? row.name) ||
                        `节点 ${row.index + 1}`}
                      <small>
                        {row.mesh || "分组"} · {row.children} 子项
                      </small>
                    </span>
                  </button>
                ))}
              </fieldset>
            ) : null}
            {d.tab === "materials" && sourceInfo ? (
              <fieldset
                className={
                  "material-shelf " + (inspectorOpen ? "with-inspector" : "")
                }
                disabled={locked}
                aria-label="模型材质"
              >
                <div className="palette-label">
                  材质 <span>{sourceInfo.materials.length}</span>
                </div>
                <div className="material-strip">
                  {sourceInfo.materials.map((row) => (
                    <button
                      key={row.index}
                      aria-pressed={d.selected === row.index && !notesMode}
                      onClick={(e) => {
                        update({ selected: row.index });
                        showInspector("object", e.currentTarget);
                      }}
                    >
                      <span
                        className="swatch"
                        style={{ background: row.color }}
                      />
                      <span>
                        {(d.edits.materials[row.index]?.name ?? row.name) ||
                          `材质 ${row.index + 1}`}
                      </span>
                      {d.edits.materials[row.index] ? (
                        <i className="change-dot" />
                      ) : null}
                    </button>
                  ))}
                </div>
              </fieldset>
            ) : null}
            <div
              className={
                "asset-readout " + (inspectorOpen ? "with-inspector" : "")
              }
            >
              <span>
                {loaded.meshes
                  ? `${loaded.meshes} 网格 · ${loaded.textures} 图像`
                  : "读取模型…"}
              </span>
              <span>
                {inspection
                  ? `${inspection.instancedVertices.toLocaleString()} 顶点 · ${kb(inspection.bytes)}`
                  : ""}
              </span>
              <span className="source-name">{selectedRef?.name}</span>
            </div>
            {inspection?.animations.length ? (
              <div
                className={
                  "animation-controls " +
                  (inspectorOpen ? "with-inspector" : "")
                }
              >
                <select
                  aria-label="检查动画"
                  value={d.clip || "0"}
                  onChange={(e) => {
                    setPlaying(false);
                    update({ clip: e.target.value, time: 0 });
                  }}
                  disabled={locked}
                >
                  {inspection.animations.map((clip, i) => (
                    <option key={i} value={i}>
                      {clip.name}
                    </option>
                  ))}
                </select>
                <button
                  className="icon-button"
                  disabled={locked}
                  aria-label={playing ? "暂停动画" : "播放动画"}
                  onClick={() => {
                    if (playing)
                      update({
                        time:
                          liveTime %
                          (inspection.animations[Number(d.clip) || 0]
                            ?.duration || 1),
                      });
                    setPlaying((v) => !v);
                  }}
                >
                  {playing ? <Pause size={15} /> : <Play size={15} />}
                </button>
                <input
                  aria-label="动画位置"
                  type="range"
                  min="0"
                  max={
                    inspection.animations[Number(d.clip) || 0]?.duration || 1
                  }
                  step="0.01"
                  value={
                    playing
                      ? liveTime %
                        (inspection.animations[Number(d.clip) || 0]?.duration ||
                          1)
                      : d.time
                  }
                  onChange={(e) => {
                    setPlaying(false);
                    update({ time: Number(e.target.value) });
                  }}
                  disabled={locked}
                />
              </div>
            ) : null}
          </>
        ) : (
          <section className="open-asset">
            <Box size={30} />
            <h1>打开模型</h1>
            <p>检查形状、材质与交付文件。</p>
            <button
              className="primary"
              disabled={actionDisabled}
              onClick={() => file.current?.click()}
            >
              <Upload size={18} />
              选择 GLB 文件
            </button>
            <div>
              <button
                className="text-button"
                disabled={actionDisabled}
                onClick={() => void loadModel()}
              >
                载入材质样例
              </button>
              <span>·</span>
              <button
                className="text-button"
                disabled={actionDisabled}
                onClick={() => projectFile.current?.click()}
              >
                导入工程或恢复稿
              </button>
            </div>
            <small>GLB 2.0 · 最大 1.4 MB · 内嵌 PNG / JPEG</small>
          </section>
        )}
        {d.source || notesMode ? (
          <Inspector
            open={inspectorOpen}
            mode={inspectorMode}
            document={d}
            source={sourceInfo}
            result={inspection}
            locked={locked}
            pending={pending}
            stale={stale}
            changes={changed}
            onClose={hideInspector}
            onMaterial={materialPatch}
            onNode={nodePatch}
            onNotes={(v) => update({ notes: v })}
            onRootExtras={(v) => {
              if (!transitioning.current)
                p.setData((old) => ({
                  ...old,
                  edits: { ...old.edits, rootExtras: v },
                }));
            }}
            onReset={() => {
              if (confirm("清除全部修订配方？原件和检查备注将保留。"))
                update({ edits: structuredClone(seed.edits) });
            }}
            onGenerate={() => void generate()}
            onExport={() => void exportResult()}
            onProject={() => void exportProject()}
            onRecovery={() => p.exportDraft()}
          />
        ) : null}
        {p.error || p.notice || missing || p.autoState.phase === "conflict" ? (
          <div
            className={
              "room-feedback " +
              (inspectorOpen && d.source ? "with-inspector" : "")
            }
          >
            <div
              className={
                p.error || missing
                  ? "feedback-message error"
                  : "feedback-message"
              }
              role={p.error || missing ? "alert" : "status"}
            >
              <span>
                {p.error || missing || p.notice || p.autoState.message}
              </span>
              {missing ? (
                <button
                  disabled={Boolean(pending)}
                  onClick={() => attach.current?.click()}
                >
                  补齐模型文件
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
            if (libraryTrigger.current)
              showInspector("notes", libraryTrigger.current);
          }}
          onRepair={() => {
            setLibrary(false);
            attach.current?.click();
          }}
          onRetry={() => void p.save()}
          saveMessage={p.autoState.message}
          error={p.error}
        />
        <input
          hidden
          ref={file}
          aria-label="导入 GLB 文件"
          type="file"
          accept=".glb"
          onChange={onFile(loadModel)}
        />
        <input
          hidden
          ref={projectFile}
          aria-label="导入工程文件"
          type="file"
          accept=".json"
          onChange={onFile(importProject)}
        />
        <input
          hidden
          ref={attach}
          aria-label="补齐资源文件"
          type="file"
          accept=".glb"
          onChange={onFile(reattach)}
        />
      </main>
    </RenderBoundary>
  );
}
