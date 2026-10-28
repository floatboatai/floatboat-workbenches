import { useEffect, useRef, useState } from "react";
import { useWorkbenchState } from "./autosave-client";
import { ProjectPicker, Notice, download } from "./workspace";
import {
  seed,
  validateModel,
  restoreModel,
  bindingKey,
  importModel,
  MAX_PROJECT,
  type ModelRef,
} from "../contracts/model";
import { inspectGlb } from "../contracts/glb";
import { isRecord } from "../contracts/project";
import { base64, unbase64 } from "./native";
import { readBytes, readSource, sha256, upload } from "./files";
import { bindSnapshot, exportSnapshot } from "./jobs";
import { Viewport, type NativeInfo } from "./Viewport";
const emptyInfo: NativeInfo = {
  joints: [],
  clips: [],
  vertices: 0,
  meshes: 0,
  textures: 0,
};
export function App() {
  const p = useWorkbenchState(seed, validateModel, "旅人 · 动作样片", {
      storageKey: "mesh2motion-v07",
      restoreDraftData: restoreModel,
    }),
    latest = useRef(p);
  latest.current = p;
  const transitionRef = useRef(false),
    operationId = useRef(0),
    activeKey = useRef<string | null>(p.documentKey);
  const [transitioning, setTransitioning] = useState(false),
    [operation, setOperation] = useState(""),
    [playing, setPlaying] = useState(false),
    [progress, setProgress] = useState(0),
    [info, setInfo] = useState<NativeInfo>(emptyInfo),
    [viewRevision, setViewRevision] = useState(0);
  const d = p.data,
    key = p.documentKey,
    locked = transitioning || p.loading || p.busy,
    boundReady = Boolean(d.bound && d.bindingKey === bindingKey(d)),
    clip = info.clips.find((c) => c.name === d.clip),
    invalid = Object.entries(p.draft).some(
      ([k, v]) =>
        k.startsWith("num:") &&
        typeof v === "string" &&
        (!v.trim() ||
          !Number.isFinite(Number(v)) ||
          Number(v) < (k === "num:scale" ? 0.5 : -1) ||
          Number(v) > (k === "num:scale" ? 2 : 1)),
    );
  useEffect(() => {
    operationId.current++;
    activeKey.current = key;
    setPlaying(false);
    setProgress(0);
    setInfo(emptyInfo);
    setOperation("");
  }, [key]);
  const current = (k: string) =>
    latest.current.documentKey === k &&
    activeKey.current === k &&
    !transitionRef.current;
  async function transition(action: () => Promise<boolean>) {
    if (transitionRef.current) return;
    transitionRef.current = true;
    activeKey.current = null;
    let moved = false;
    operationId.current++;
    setPlaying(false);
    setTransitioning(true);
    try {
      moved = await action();
    } catch (e) {
      p.report(e);
    } finally {
      transitionRef.current = false;
      if (!moved && latest.current.documentKey === key) activeKey.current = key;
      setTransitioning(false);
      setOperation("");
    }
  }
  async function job(
    kind: string,
    action: (active: () => boolean) => Promise<void>,
  ) {
    if (locked || operation) return;
    const k = key,
      id = ++operationId.current;
    setOperation(kind);
    p.setError("");
    try {
      await action(() => current(k) && operationId.current === id);
    } catch (e) {
      if (current(k) && operationId.current === id) p.report(e);
    } finally {
      if (current(k) && operationId.current === id) setOperation("");
    }
  }
  async function importSource(file?: File) {
    await transition(async () => {
      const bytes = file
        ? new Uint8Array(await file.arrayBuffer())
        : await readBytes("/api/assets/mannequin.glb");
      inspectGlb(bytes);
      const ref = await upload(bytes, file?.name ?? "mannequin.glb", "source");
      return p.replace(
        { ...structuredClone(seed), source: ref },
        file
          ? file.name.replace(/\.glb$/i, "").slice(0, 120)
          : "旅人 · 动作样片",
      );
    });
  }
  async function importProject(file: File) {
    await transition(async () => {
      if (file.size > MAX_PROJECT) throw Error("完整工程需小于8MB。");
      const v = importModel(JSON.parse(await file.text())),
        refs = [v.data.source, v.data.bound].filter(
          (x): x is ModelRef => x !== null,
        );
      if (v.resources.length > 2) throw Error("工程包含过多资源。");
      for (const a of v.resources) {
        if (
          !isRecord(a) ||
          typeof a.id !== "string" ||
          typeof a.base64 !== "string"
        )
          throw Error("工程资源格式无效。");
        const ref = refs.find((r) => r.id === a.id);
        if (!ref) throw Error("工程包含未引用资源。");
        const bytes = unbase64(a.base64);
        if (bytes.length !== ref.bytes || (await sha256(bytes)) !== ref.id)
          throw Error("工程资源校验失败。");
        await upload(bytes, ref.name, ref.kind);
      }
      return p.replace(v.data, v.title || "导入角色", v.extra);
    });
  }
  async function attach(file: File) {
    await job("attach", async (active) => {
      const bytes = new Uint8Array(await file.arrayBuffer()),
        id = await sha256(bytes),
        ref = [d.source, d.bound].find((r) => r?.id === id);
      if (!ref) throw Error("文件与当前工程的原件或绑定结果不匹配。");
      await upload(bytes, ref.name, ref.kind);
      if (active()) {
        await p.save();
        if (active()) {
          setViewRevision((v) => v + 1);
          p.setNotice("模型文件已补齐。若绑定结果仍缺失，可重新绑定模型。");
        }
      }
    });
  }
  async function bind() {
    const snapshot = structuredClone(d),
      fingerprint = bindingKey(snapshot);
    await job("bind", async (active) => {
      setPlaying(false);
      await new Promise<void>((r) => requestAnimationFrame(() => r()));
      const result = await bindSnapshot(snapshot);
      if (active() && bindingKey(latest.current.data) === fingerprint) {
        p.setData((v) => ({
          ...v,
          bound: result.ref,
          bindingKey: fingerprint,
          time: 0,
        }));
        setViewRevision((v) => v + 1);
        p.setNotice(
          "绑定完成：" +
            result.vertices.toLocaleString() +
            " 个顶点，" +
            result.influenced +
            " 根骨骼参与变形。",
        );
      } else if (active())
        p.setNotice("参数已变动，保留当前输入，请重新绑定。");
    });
  }
  async function exportAnimation() {
    if (!boundReady) return;
    const snapshot = structuredClone(d),
      title = p.title;
    await job("export", async (active) => {
      const bytes = await exportSnapshot(snapshot);
      if (active()) {
        download(
          new Blob([bytes.slice().buffer], { type: "model/gltf-binary" }),
          title + "-" + snapshot.clip + ".glb",
        );
        p.setNotice("动画GLB已导出。");
      }
    });
  }
  async function exportProject() {
    const snapshot = {
      title: p.title,
      data: structuredClone(d),
      extra: structuredClone(p.draft),
    };
    await job("project", async (active) => {
      const refs = [snapshot.data.source, snapshot.data.bound].filter(
          (x): x is ModelRef => x !== null,
        ),
        resources = await Promise.all(
          refs.map(async (ref) => {
            const bytes = await readSource(ref);
            if (bytes.length !== ref.bytes || (await sha256(bytes)) !== ref.id)
              throw Error("资源校验失败。");
            return { id: ref.id, base64: base64(bytes) };
          }),
        );
      const text = JSON.stringify({
        format: "mesh2motion-workbench",
        version: 1,
        ...snapshot,
        resources,
      });
      if (new TextEncoder().encode(text).length > MAX_PROJECT)
        throw Error("完整工程超过8MB。");
      if (active())
        download(
          new Blob([text], { type: "application/json" }),
          snapshot.title + "-完整工程.json",
        );
    });
  }
  function numeric(
    k: string,
    value: number,
    min: number,
    max: number,
    apply: (v: number) => void,
  ) {
    const raw =
      typeof p.draft[k] === "string" ? (p.draft[k] as string) : String(value);
    return {
      value: raw,
      bad:
        !raw.trim() ||
        !Number.isFinite(Number(raw)) ||
        Number(raw) < min ||
        Number(raw) > max,
      change: (next: string) => {
        p.setDraft((e) => ({ ...e, [k]: next }));
        if (
          next.trim() &&
          Number.isFinite(Number(next)) &&
          Number(next) >= min &&
          Number(next) <= max
        ) {
          apply(Number(next));
          setPlaying(false);
        }
      },
    };
  }
  const offset = d.offsets[d.selectedJoint] ?? { x: 0, y: 0, z: 0 },
    scale = numeric("num:scale", d.scale, 0.5, 2, (v) =>
      p.setData((old) => ({ ...old, scale: v })),
    ),
    search = typeof p.draft.jointSearch === "string" ? p.draft.jointSearch : "";
  return (
    <main>
      <a className="skip" href="#stage">
        跳到角色视图
      </a>
      <header>
        <div className="brand">
          <span className="brand-mark" aria-hidden="true">
            M²
          </span>
          <div>
            <h1>角色动作工坊</h1>
            <small>Mesh2Motion / CHARACTER STUDIO</small>
          </div>
        </div>
        <input
          aria-label="工程名称"
          name="projectTitle"
          autoComplete="off"
          value={p.title}
          maxLength={120}
          onChange={(e) => p.setTitle(e.target.value)}
          disabled={locked}
        />
        <span className={"save " + p.autoState.phase} role="status">
          {invalid && p.autoState.phase === "saved"
            ? "输入草稿已保存 · 尚未应用"
            : p.autoState.message}
        </span>
      </header>
      <nav className="filebar" aria-label="工程操作">
        <details>
          <summary>工程文件</summary>
          <div className="file-menu">
            <ProjectPicker
              items={p.items}
              id={p.current?.id}
              disabled={locked}
              onOpen={(id) => void transition(() => p.open(id))}
            />
            <button
              disabled={locked}
              onClick={() => void transition(() => p.fresh())}
            >
              新建工程
            </button>
            <label className="file-button">
              导入完整工程
              <input
                type="file"
                aria-label="导入完整工程"
                accept=".json"
                disabled={locked}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void importProject(f);
                  e.target.value = "";
                }}
              />
            </label>
            <button disabled={locked} onClick={p.exportDraft}>
              下载恢复稿
            </button>
            <label className="file-button">
              补齐模型文件
              <input
                type="file"
                aria-label="补齐模型文件"
                accept=".glb"
                disabled={locked || Boolean(operation)}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void attach(f);
                  e.target.value = "";
                }}
              />
            </label>
            <button disabled={locked} onClick={() => void p.save()}>
              重试保存
            </button>
            {p.autoState.phase === "conflict" && p.current ? (
              <button
                disabled={locked}
                onClick={() => void transition(() => p.open(p.current!.id))}
              >
                打开服务端版本
              </button>
            ) : null}
            <button
              disabled={locked || !p.current}
              onClick={() => {
                if (confirm("删除当前工程记录？模型原件仍保留。"))
                  void transition(() => p.remove());
              }}
            >
              删除工程
            </button>
          </div>
        </details>
        <div className="step-track">
          <span className={d.source ? "done" : ""}>01 模型</span>
          <i>›</i>
          <span className={d.source ? "done" : ""}>02 关节</span>
          <i>›</i>
          <span className={boundReady ? "done" : ""}>03 动作</span>
        </div>
        <button
          className="quiet"
          disabled={locked || Boolean(operation)}
          onClick={() => void exportProject()}
        >
          完整工程
        </button>
        <button
          className="primary"
          disabled={locked || Boolean(operation) || !boundReady}
          onClick={() => void exportAnimation()}
        >
          {operation === "export" ? "正在导出…" : "导出动画 GLB"}
        </button>
      </nav>
      <Notice error={p.error} notice={p.notice} />
      <div className="workspace">
        <aside className="assets">
          <section>
            <h2>角色资源</h2>
            <div className="asset-tile">
              <div className="asset-glyph" aria-hidden="true">
                ◇
              </div>
              <strong>{d.source?.name ?? "尚未载入模型"}</strong>
              <small>
                {d.source
                  ? Math.round(d.source.bytes / 1000) +
                    " KB · " +
                    info.vertices.toLocaleString() +
                    " 顶点"
                  : "静态人形 / 自包含 GLB"}
              </small>
            </div>
            <label className="file-button import-button">
              导入模型
              <input
                aria-label="导入模型"
                type="file"
                accept=".glb"
                disabled={locked}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void importSource(f);
                  e.target.value = "";
                }}
              />
            </label>
            <button
              className="quiet full"
              disabled={locked}
              onClick={() => void importSource()}
            >
              载入人形样例
            </button>
            <p className="hint">
              原件 ≤ 1 MB · 最多 16,000 顶点。贴图使用嵌入的 PNG / JPEG。
            </p>
          </section>
          <section className="joint-section">
            <h2>
              人形骨架 <span>{info.joints.length}</span>
            </h2>
            <input
              name="jointSearch"
              autoComplete="off"
              aria-label="查找关节"
              placeholder="查找关节…"
              value={search}
              disabled={locked}
              onChange={(e) =>
                p.setDraft((v) => ({ ...v, jointSearch: e.target.value }))
              }
            />
            <div className="joint-list" role="group" aria-label="骨架关节">
              {info.joints
                .filter((x) => x.toLowerCase().includes(search.toLowerCase()))
                .map((name, i) => (
                  <button
                    key={name}
                    className={d.selectedJoint === name ? "selected" : ""}
                    disabled={locked || operation === "bind"}
                    onClick={() =>
                      p.setData((v) => ({ ...v, selectedJoint: name }))
                    }
                  >
                    <span aria-hidden="true">{i === 0 ? "◇" : "↳"}</span>
                    {name}
                  </button>
                ))}
            </div>
          </section>
        </aside>
        <section className="stage" id="stage" aria-label="角色制作">
          <div className="stage-toolbar">
            <span className="stage-status">
              {boundReady ? "● 已绑定" : d.source ? "○ 关节对齐" : "○ 载入模型"}
            </span>
            <label>
              <input
                type="checkbox"
                checked={d.showSkeleton}
                disabled={locked}
                onChange={(e) =>
                  p.setData((v) => ({ ...v, showSkeleton: e.target.checked }))
                }
              />
              显示骨架
            </label>
            <button
              disabled={locked}
              onClick={() =>
                p.setData((v) => ({
                  ...v,
                  camera: [2.7, 1.9, 3.8],
                  target: [0, 0.95, 0],
                }))
              }
            >
              重置视角
            </button>
          </div>
          {p.loading ? (
            <div className="viewport" role="status">
              正在恢复工程…
            </div>
          ) : (
            <Viewport
              key={key + ":" + viewRevision}
              document={d}
              playing={playing}
              disabled={locked}
              onView={(camera, target) => {
                if (current(key)) p.setData((v) => ({ ...v, camera, target }));
              }}
              onProgress={(t) => {
                if (current(key)) setProgress(t);
              }}
              onInfo={(v) => {
                if (current(key)) setInfo(v);
              }}
              onError={(e) => {
                if (current(key)) p.report(e);
              }}
            />
          )}
          <div className="transport">
            <button
              className="play"
              aria-label={playing ? "暂停动作" : "播放动作"}
              disabled={locked || !boundReady || !clip}
              onClick={() => {
                if (playing) {
                  p.setData((v) => ({ ...v, time: progress }));
                  setPlaying(false);
                } else {
                  setProgress(d.time);
                  setPlaying(true);
                }
              }}
            >
              {playing ? "Ⅱ" : "▶"}
            </button>
            <div className="timeline">
              <label htmlFor="seek">
                {clip?.name ?? "动作预览"}
                <span>
                  {(playing ? progress : d.time).toFixed(2)} s /{" "}
                  {clip?.duration.toFixed(2) ?? "0.00"} s
                </span>
              </label>
              <input
                id="seek"
                aria-label="动作位置"
                type="range"
                min="0"
                max={clip?.duration ?? 1}
                step="0.01"
                value={Math.min(
                  playing ? progress : d.time,
                  clip?.duration ?? 1,
                )}
                disabled={locked || !boundReady}
                onChange={(e) => {
                  setPlaying(false);
                  p.setData((v) => ({ ...v, time: Number(e.target.value) }));
                }}
              />
            </div>
            <label className="speed">
              速度
              <select
                aria-label="播放速度"
                value={d.speed}
                disabled={locked}
                onChange={(e) =>
                  p.setData((v) => ({ ...v, speed: Number(e.target.value) }))
                }
              >
                {[0.25, 0.5, 1, 1.5, 2].map((v) => (
                  <option key={v} value={v}>
                    {v}×
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="clip-bar">
            <label>
              动作库
              <select
                aria-label="选择动作"
                value={d.clip}
                disabled={locked || !info.clips.length}
                onChange={(e) => {
                  setPlaying(false);
                  p.setData((v) => ({ ...v, clip: e.target.value, time: 0 }));
                }}
              >
                {info.clips.length ? (
                  info.clips.map((c) => (
                    <option key={c.name} value={c.name}>
                      {c.name}
                    </option>
                  ))
                ) : (
                  <option value={d.clip}>{d.clip}</option>
                )}
              </select>
            </label>
            <span>{info.clips.length} 个动作 · 人形骨架</span>
          </div>
        </section>
        <aside className="inspector">
          <section>
            <div className="eyebrow">JOINT ALIGNMENT</div>
            <h2>关节对齐</h2>
            <p className="joint-name">{d.selectedJoint}</p>
            <fieldset disabled={locked || !d.source || operation === "bind"}>
              <legend>关节局部偏移（米）</legend>
              <div className="coordinates">
                {(["x", "y", "z"] as const).map((axis) => {
                  const field = numeric(
                    "num:" + d.selectedJoint + ":" + axis,
                    offset[axis],
                    -1,
                    1,
                    (n) =>
                      p.setData((v) => ({
                        ...v,
                        offsets: {
                          ...v.offsets,
                          [v.selectedJoint]: {
                            ...(v.offsets[v.selectedJoint] ?? {
                              x: 0,
                              y: 0,
                              z: 0,
                            }),
                            [axis]: n,
                          },
                        },
                      })),
                  );
                  return (
                    <label key={d.selectedJoint + axis}>
                      {axis.toUpperCase()}
                      <input
                        name={"offset-" + axis}
                        autoComplete="off"
                        aria-label={"关节偏移 " + axis.toUpperCase()}
                        inputMode="decimal"
                        aria-invalid={field.bad}
                        value={field.value}
                        onChange={(e) => field.change(e.target.value)}
                      />
                    </label>
                  );
                })}
              </div>
              <label className="scale-field">
                整体骨架比例
                <input
                  aria-label="骨架比例"
                  name="rigScale"
                  autoComplete="off"
                  inputMode="decimal"
                  aria-invalid={scale.bad}
                  value={scale.value}
                  onChange={(e) => scale.change(e.target.value)}
                />
              </label>
              <p className="hint">偏移范围 −1 到 1；比例 0.5 到 2。</p>
              {invalid ? (
                <p className="field-error" role="status">
                  未完成的数值保留为输入草稿；图形沿用最近有效值。
                </p>
              ) : null}
              <button
                className="quiet full"
                onClick={() => {
                  p.setData((v) => ({
                    ...v,
                    offsets: {
                      ...v.offsets,
                      [v.selectedJoint]: { x: 0, y: 0, z: 0 },
                    },
                  }));
                  p.setDraft((e) => {
                    const copy = { ...e };
                    for (const a of ["x", "y", "z"])
                      delete copy["num:" + d.selectedJoint + ":" + a];
                    return copy;
                  });
                }}
              >
                重置当前关节
              </button>
            </fieldset>
            <button
              className="primary full bind"
              disabled={locked || Boolean(operation) || !d.source || invalid}
              onClick={() => void bind()}
            >
              {operation === "bind"
                ? "正在计算绑定…"
                : boundReady
                  ? "重新计算绑定"
                  : "绑定模型"}
            </button>
            <p className="hint">
              {d.bound && !boundReady
                ? "关节已调整，重新绑定后可预览和导出。"
                : boundReady
                  ? "动作将应用于当前绑定结果。"
                  : "将静态模型连接到人形骨架。"}
            </p>
          </section>
          <section>
            <h2>制作便笺</h2>
            <textarea
              aria-label="制作便笺"
              name="productionNotes"
              autoComplete="off"
              rows={7}
              maxLength={40000}
              placeholder="记录关节调整和交付要求…"
              value={d.notes}
              disabled={locked}
              onChange={(e) =>
                p.setData((v) => ({ ...v, notes: e.target.value }))
              }
            />
          </section>
          <footer>
            <span>Mesh2Motion 核心</span>
            <span>本地工程 · 原件保留</span>
          </footer>
        </aside>
      </div>
    </main>
  );
}
