import { useEffect, useRef, useState, type ChangeEvent } from "react";
import {
  Box,
  ArrowUpRight,
  ArrowDownToLine,
  FolderOpen,
  Plus,
  Check,
  Layers,
  Scan,
  RotateCcw,
  Play,
  Pause,
  FileJson,
  ChevronRight,
} from "lucide-react";
import { useWorkbenchState } from "./autosave-client";
import { ProjectPicker, Notice, RenderBoundary } from "./workspace";
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
    if (transitioning.current) return;
    transitioning.current = true;
    epoch.current++;
    setPlaying(false);
    setPending("切换工程");
    try {
      await action();
    } catch (e) {
      p.report(e);
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
      p.setNotice("修订已回读校验；几何、图像、骨架与动画保全检查通过。");
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
      (d.edits.rootExtras !== null ? 1 : 0),
    material = sourceInfo?.materials[d.selected],
    node = sourceInfo?.nodes[d.selected],
    m = { ...material, ...d.edits.materials[d.selected] },
    n = { ...node, ...d.edits.nodes[d.selected] };
  const onFile =
    (fn: (f: File) => Promise<void>) => (e: ChangeEvent<HTMLInputElement>) => {
      const f = e.target.files?.[0];
      e.target.value = "";
      if (f) void fn(f);
    };
  const fields = (
    label: string,
    value: string | undefined,
    onChange: (v: string) => void,
    limit = 160,
  ) => (
    <label className="field">
      <span>{label}</span>
      <input
        value={value ?? ""}
        maxLength={limit}
        onChange={(e) => onChange(e.target.value)}
        autoComplete="off"
        spellCheck={false}
      />
    </label>
  );
  return (
    <RenderBoundary>
      <div className="desk">
        <header className="topbar">
          <div className="brand">
            <Box size={24} />
            <div>
              <h1>
                glTF <span>资产检查台</span>
              </h1>
              <p>ASSET INSPECTION · 078</p>
            </div>
          </div>
          <div className="project-tools">
            <ProjectPicker
              items={p.items}
              id={p.current?.id}
              disabled={locked}
              onOpen={(id) => void transition(() => p.open(id))}
            />
            <button
              className="icon-btn"
              aria-label="新建工程"
              disabled={locked}
              onClick={() => void transition(() => p.fresh())}
            >
              <Plus size={18} />
            </button>
            <button
              disabled={locked || Boolean(pending)}
              onClick={() => projectFile.current?.click()}
            >
              <FolderOpen size={15} />
              打开工程
            </button>
          </div>
          <div
            className={"save-status " + p.autoState.phase}
            role="status"
            data-testid="save-status"
          >
            <i />
            {p.autoState.message}
          </div>
        </header>
        <div className="project-line">
          <div className="project-title">
            <span className="kicker">INSPECTION FILE</span>
            <input
              aria-label="工程名称"
              value={p.title}
              maxLength={120}
              onChange={(e) => p.setTitle(e.target.value)}
              disabled={locked}
            />
          </div>
          <div className="actions">
            <button
              disabled={locked || Boolean(pending)}
              onClick={() => file.current?.click()}
            >
              <ArrowUpRight size={16} />
              导入 GLB
            </button>
            <button
              disabled={locked || Boolean(pending)}
              onClick={() => void loadModel()}
            >
              载入材质样例
            </button>
            <button
              className="primary"
              disabled={locked || Boolean(pending) || !d.source || !sourceInfo}
              onClick={() => void generate()}
            >
              <Check size={16} />
              {pending === "生成修订" ? "正在回读校验…" : "生成修订"}
            </button>
          </div>
        </div>
        <div className="feedback">
          <Notice error={p.error} notice={p.notice} />
          {missing && (
            <p role="alert" className="missing">
              {missing}{" "}
              <button
                onClick={() => attach.current?.click()}
                disabled={Boolean(pending)}
              >
                补齐模型文件
              </button>
            </p>
          )}
          {p.autoState.phase === "conflict" && (
            <div className="conflict">
              <button onClick={() => p.exportDraft()}>导出冲突工作稿</button>
              <button
                disabled={!p.current}
                onClick={() => void transition(() => p.open(p.current!.id))}
              >
                打开服务器版本
              </button>
            </div>
          )}
        </div>
        <fieldset
          className="work-area"
          aria-label="资产编辑区"
          disabled={locked}
        >
          <aside className="inventory">
            <div className="section-head">
              <span>资产目录</span>
              <span className="mono">
                {sourceInfo
                  ? String(sourceInfo.nodes.length).padStart(2, "0")
                  : "00"}
              </span>
            </div>
            <div className="tabs" role="tablist" aria-label="资产类别">
              {[
                ["nodes", "节点"],
                ["materials", "材质"],
                ["resources", "资源"],
              ].map(([key, label]) => (
                <button
                  key={key}
                  role="tab"
                  aria-selected={d.tab === key}
                  onClick={() =>
                    update({ tab: key as AssetDocument["tab"], selected: 0 })
                  }
                >
                  {label}
                </button>
              ))}
            </div>
            <div className="item-list">
              {d.tab === "materials" ? (
                sourceInfo?.materials.map((row) => (
                  <button
                    key={row.index}
                    className={
                      "asset-row " +
                      (d.selected === row.index ? "selected" : "")
                    }
                    onClick={() => update({ selected: row.index })}
                  >
                    <span
                      className="swatch"
                      style={{ background: row.color }}
                    />
                    <span>
                      <b>
                        {(d.edits.materials[row.index]?.name ?? row.name) ||
                          `材质 ${row.index + 1}`}
                      </b>
                      <small>METALLIC / ROUGHNESS</small>
                    </span>
                    {d.edits.materials[row.index] && (
                      <i className="change-dot" />
                    )}
                  </button>
                ))
              ) : d.tab === "nodes" ? (
                sourceInfo?.nodes.map((row) => (
                  <button
                    key={row.index}
                    className={
                      "asset-row " +
                      (d.selected === row.index ? "selected" : "")
                    }
                    onClick={() => update({ selected: row.index })}
                  >
                    <Box size={19} />
                    <span>
                      <b>
                        {(d.edits.nodes[row.index]?.name ?? row.name) ||
                          `节点 ${row.index + 1}`}
                      </b>
                      <small>
                        {row.mesh || "GROUP"} · {row.children} 子项
                      </small>
                    </span>
                    {d.edits.nodes[row.index] && <i className="change-dot" />}
                  </button>
                ))
              ) : (
                <div className="resource-list">
                  {sourceInfo?.images.map((img, i) => (
                    <div key={i}>
                      <Layers size={18} />
                      <b>{img.name}</b>
                      <small>
                        {img.mime} · {kb(img.bytes)}
                      </small>
                      <code>{img.hash.slice(0, 12)}…</code>
                    </div>
                  ))}
                  {sourceInfo && !sourceInfo.images.length && (
                    <p>此资产没有内嵌图像。</p>
                  )}
                </div>
              )}
              {!sourceInfo && (
                <p className="muted empty-list">
                  导入资产后，节点与材质将列在这里。
                </p>
              )}
            </div>
            <div className="inventory-footer">
              <span className="change-dot" />
              {changed} 项修订配方
              <button
                aria-label="重置全部修订"
                disabled={!changed || Boolean(pending)}
                onClick={() => {
                  if (confirm("清除全部修订配方？原件和检查备注将保留。"))
                    update({ edits: structuredClone(seed.edits) });
                }}
              >
                <RotateCcw size={14} />
              </button>
            </div>
          </aside>
          <section className="inspection-stage" aria-label="资产视图">
            <div className="stage-toolbar">
              <div className="view-tabs">
                <button
                  className={d.view === "source" ? "active" : ""}
                  onClick={() => update({ view: "source" })}
                >
                  原件
                </button>
                <button
                  disabled={!d.result}
                  className={d.view === "result" ? "active" : ""}
                  onClick={() => update({ view: "result" })}
                >
                  修订结果{stale ? " · 配方已更新" : ""}
                </button>
              </div>
              <button
                onClick={() => setFit((v) => v + 1)}
                disabled={!selectedRef}
                aria-label="适配模型视图"
              >
                <Scan size={16} />
                适配
              </button>
            </div>
            <Viewport
              key={p.documentKey}
              document={d}
              resourceVersion={resourceVersion}
              playing={playing}
              disabled={locked}
              fit={fit}
              onView={(camera, target) =>
                p.setData((old) => ({ ...old, camera, target }))
              }
              onTime={setLiveTime}
              onReady={(meshes, textures) => setLoaded({ meshes, textures })}
            />
            <div className="stage-caption">
              <span>
                <i />
                {loaded.meshes
                  ? `${loaded.meshes} 网格 / ${loaded.textures} 图像已载入`
                  : "LOCAL ASSET VIEW"}
              </span>
              <span className="mono">{selectedRef?.name ?? "—"}</span>
            </div>
            {Boolean(inspection?.animations.length) && (
              <div className="animation-strip">
                <select
                  aria-label="检查动画"
                  value={d.clip || "0"}
                  onChange={(e) => {
                    setPlaying(false);
                    update({ clip: e.target.value, time: 0 });
                  }}
                >
                  {inspection?.animations.map((c, i) => (
                    <option key={i} value={i}>
                      {c.name}
                    </option>
                  ))}
                </select>
                <button
                  onClick={() => {
                    if (playing)
                      update({
                        time:
                          liveTime %
                          (inspection?.animations[Number(d.clip) || 0]
                            ?.duration || 1),
                      });
                    setPlaying((v) => !v);
                  }}
                  aria-label={playing ? "暂停动画" : "播放动画"}
                >
                  {playing ? <Pause size={14} /> : <Play size={14} />}
                </button>
                <input
                  aria-label="动画位置"
                  type="range"
                  min="0"
                  max={
                    inspection?.animations[Number(d.clip) || 0]?.duration || 1
                  }
                  step="0.01"
                  value={
                    playing
                      ? liveTime %
                        (inspection?.animations[Number(d.clip) || 0]
                          ?.duration || 1)
                      : d.time
                  }
                  onChange={(e) => {
                    setPlaying(false);
                    update({ time: Number(e.target.value) });
                  }}
                />
                <small>动画原样保留</small>
              </div>
            )}
            <div className="metrics">
              <div>
                <small>文件体积</small>
                <b>{inspection ? kb(inspection.bytes) : "—"}</b>
              </div>
              <div>
                <small>实例顶点</small>
                <b>{inspection?.instancedVertices.toLocaleString() ?? "—"}</b>
              </div>
              <div>
                <small>材质 / 图像</small>
                <b>
                  {inspection
                    ? `${inspection.materials.length} / ${inspection.images.length}`
                    : "—"}
                </b>
              </div>
              <div>
                <small>骨架 / 动画</small>
                <b>
                  {inspection
                    ? `${inspection.skins} / ${inspection.animations.length}`
                    : "—"}
                </b>
              </div>
            </div>
          </section>
          <aside className="properties">
            <div className="section-head">
              <span>
                {d.tab === "materials"
                  ? "材质修订"
                  : d.tab === "nodes"
                    ? "节点修订"
                    : "资源交付"}
              </span>
              <span className="kicker">EDIT RECIPE</span>
            </div>
            {d.tab === "materials" && material ? (
              <>
                <div className="material-heading">
                  <span
                    className="large-swatch"
                    style={{
                      background: /^#[\da-f]{6}$/i.test(m.color ?? "")
                        ? m.color
                        : material.color,
                    }}
                  />
                  <div>
                    <small>PBR MATERIAL</small>
                    <h2>{m.name || "未命名材质"}</h2>
                  </div>
                </div>
                {fields("材质名称", m.name, (v) => materialPatch({ name: v }))}
                {fields(
                  "底色 · sRGB HEX",
                  m.color,
                  (v) => materialPatch({ color: v }),
                  32,
                )}
                <div className="pair">
                  {fields(
                    "金属度 · 0–1",
                    m.metallic,
                    (v) => materialPatch({ metallic: v }),
                    32,
                  )}
                  {fields(
                    "粗糙度 · 0–1",
                    m.roughness,
                    (v) => materialPatch({ roughness: v }),
                    32,
                  )}
                </div>
                {fields(
                  "不透明度 · 0–1",
                  m.opacity,
                  (v) => materialPatch({ opacity: v }),
                  32,
                )}
                <label className="field">
                  <span>透明模式</span>
                  <select
                    value={m.alphaMode}
                    onChange={(e) =>
                      materialPatch({
                        alphaMode: e.target.value as MaterialEdit["alphaMode"],
                      })
                    }
                  >
                    <option>OPAQUE</option>
                    <option>MASK</option>
                    <option>BLEND</option>
                  </select>
                </label>
                <label className="check">
                  <input
                    type="checkbox"
                    checked={m.doubleSided ?? false}
                    onChange={(e) =>
                      materialPatch({ doubleSided: e.target.checked })
                    }
                  />
                  双面渲染
                </label>
                <p className="texture-note">
                  <Layers size={14} />
                  {material.texture}
                </p>
                <label className="field">
                  <span>材质附加信息 · JSON</span>
                  <textarea
                    value={m.extras ?? "{}"}
                    maxLength={60000}
                    rows={4}
                    spellCheck={false}
                    onChange={(e) => materialPatch({ extras: e.target.value })}
                  />
                </label>
                {d.view === "result" && inspection?.materials[d.selected] && (
                  <p className="verified">
                    结果值：粗糙度 {inspection.materials[d.selected].roughness}{" "}
                    / 金属度 {inspection.materials[d.selected].metallic}
                  </p>
                )}
              </>
            ) : d.tab === "nodes" && node ? (
              <>
                {fields("节点名称", n.name, (v) => nodePatch({ name: v }))}
                <dl className="node-detail">
                  <dt>网格</dt>
                  <dd>{node.mesh || "无"}</dd>
                  <dt>平移 XYZ</dt>
                  <dd>
                    {node.translation.map((v) => v.toFixed(3)).join(" / ")}
                  </dd>
                  <dt>子节点</dt>
                  <dd>{node.children}</dd>
                </dl>
                <label className="field">
                  <span>节点附加信息 · JSON</span>
                  <textarea
                    value={n.extras ?? "{}"}
                    rows={10}
                    maxLength={60000}
                    spellCheck={false}
                    onChange={(e) => nodePatch({ extras: e.target.value })}
                  />
                </label>
              </>
            ) : d.tab === "resources" && sourceInfo ? (
              <>
                <div className="resource-facts">
                  <p>原件与结果独立保留，按 SHA-256 校验。</p>
                  <b>场景 · {sourceInfo.scenes.length}</b>
                  <span>{sourceInfo.scenes.join(" / ")}</span>
                  <span>几何访问器 {kb(sourceInfo.geometryBytes)} · 图像 {sourceInfo.pixels.toLocaleString()} 像素</span>
                  <b>原件</b>
                  <code>{d.source?.id}</code>
                  <b>修订结果</b>
                  <code>{d.result?.id ?? "尚未生成"}</code>
                </div>
                <label className="field">
                  <span>资产附加信息 · JSON</span>
                  <textarea
                    value={d.edits.rootExtras ?? sourceInfo.rootExtras}
                    rows={7}
                    maxLength={60000}
                    spellCheck={false}
                    onChange={(e) =>
                      p.setData((old) => ({
                        ...old,
                        edits: { ...old.edits, rootExtras: e.target.value },
                      }))
                    }
                  />
                </label>
              </>
            ) : (
              <div className="property-empty">
                <ChevronRight size={24} />
                <p>
                  选择一个节点或材质
                  <br />
                  建立交付修订配方。
                </p>
              </div>
            )}
            <div className="property-foot">
              输入自动保留。生成修订后，预览与导出使用新的结果文件。
            </div>
          </aside>
        </fieldset>
        <fieldset className="handoff" aria-label="交付检查" disabled={locked}>
          <div className="review-notes">
            <label htmlFor="notes">
              检查备注 <span>REVIEW NOTES</span>
            </label>
            <textarea
              id="notes"
              placeholder="记录贴图、命名与交付事项…"
              value={d.notes}
              maxLength={40000}
              onChange={(e) => update({ notes: e.target.value })}
              rows={3}
            />
          </div>
          <div className="delivery">
            <div>
              <small>交付包</small>
              <b>
                {d.result
                  ? stale
                    ? "配方已修改，请重新生成"
                    : "修订结果已通过回读"
                  : "完成检查后生成修订"}
              </b>
            </div>
            <div className="delivery-buttons">
              <button
                disabled={!d.result || stale || Boolean(pending)}
                onClick={() => void exportResult()}
              >
                <ArrowDownToLine size={16} />
                导出结果 GLB
              </button>
              <button
                disabled={!d.source || Boolean(pending)}
                onClick={() => void exportProject()}
              >
                <FileJson size={16} />
                完整工程
              </button>
              <button onClick={() => p.exportDraft()}>恢复工作稿</button>
            </div>
          </div>
        </fieldset>
        <footer>
          <span>glTF Transform 4.5.1 · 原生资产读写</span>
          <div>
            <button
              disabled={Boolean(pending)}
              onClick={() => attach.current?.click()}
            >
              补齐资源
            </button>
            <button
              onClick={() => void p.save()}
              disabled={p.loading || p.busy}
            >
              重试保存
            </button>
            <button
              disabled={!p.current || Boolean(pending)}
              onClick={() => void transition(() => p.remove())}
            >
              删除工程
            </button>
          </div>
          <span>GLB 2.0 / ≤ 1.4 MB / 无扩展</span>
        </footer>
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
      </div>
    </RenderBoundary>
  );
}
