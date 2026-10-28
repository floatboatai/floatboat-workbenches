import { useEffect, useRef, useState } from "react";
import LogicFlow, { ElementState } from "@logicflow/core";
import { Snapshot } from "@logicflow/extension";
import { isRecord } from "../contracts/project";
import {
  nativeTextDrafts,
  recordNativeText,
  acknowledgeNativeText,
  graphText,
  type NativeTextDraft,
} from "../contracts/native-text";
import "@logicflow/core/lib/style/index.css";
import { download, Notice, ProjectPicker, useProjects } from "./workspace";
import {
  graphValue,
  importFlow,
  mergeNative,
  label,
  paths,
  restoreFlow,
  review,
  seed,
  validateFlow,
  type Graph,
} from "../contracts/flow";

export function App() {
  const p = useProjects(seed, validateFlow, "采购申请 · 审批 SOP", {
    storageKey: "logicflow-v06",
    restoreDraftData: restoreFlow,
  });
  const host = useRef<HTMLDivElement>(null),
    lf = useRef<LogicFlow | null>(null),
    transitionRef = useRef(false),
    latest = useRef(p),
    rendering = useRef(false),
    engineKey = useRef<string | null>(null),
    synchronizedGraph = useRef<{
      engine: LogicFlow;
      key: string;
      graph: string;
    } | null>(null);
  latest.current = p;
  const [transitioning, setTransitioning] = useState(false),
    [selected, setSelected] = useState(""),
    [readyKey, setReadyKey] = useState<string | null>(null),
    [inspector, setInspector] = useState(true);
  let graph: Graph = { nodes: [], edges: [] },
    parseError = "";
  try {
    graph = graphValue(p.data.graph);
  } catch (e) {
    parseError = e instanceof Error ? e.message : "图纸格式无效";
  }
  const selection =
    graph.nodes.find((n) => n.id === selected) ??
    graph.edges.find((e) => e.id === selected);
  const warnings = parseError ? [parseError] : review(graph),
    pathList = parseError ? [] : paths(graph);
  const ready =
    readyKey === p.documentKey && engineKey.current === p.documentKey;
  const locked = transitioning || p.loading || p.busy;
  const nativeLocked = locked || !ready;
  const textDrafts = nativeTextDrafts(p.draft);
  const raw = typeof p.draft.raw === "string" ? p.draft.raw : p.data.graph;
  const source =
    typeof p.draft.source === "string"
      ? p.draft.source
      : (graph.nodes[0]?.id ?? "");
  const target =
    typeof p.draft.target === "string"
      ? p.draft.target
      : (graph.nodes[1]?.id ?? "");
  function suspendEngine() {
    const engine = lf.current,
      key = engineKey.current;
    engineKey.current = null;
    setReadyKey(null);
    return () => {
      if (key && lf.current === engine && latest.current.documentKey === key) {
        engineKey.current = key;
        setReadyKey(key);
      }
    };
  }
  async function transition(action: () => Promise<boolean>) {
    if (transitionRef.current) return;
    transitionRef.current = true;
    const resume = suspendEngine();
    let moved = false;
    setTransitioning(true);
    try {
      moved = await action();
      if (moved) setSelected("");
    } finally {
      transitionRef.current = false;
      if (!moved) resume();
      setTransitioning(false);
    }
  }
  useEffect(() => {
    if (!host.current || p.loading) return;
    const container = host.current,
      documentKey = p.documentKey;
    let alive = true,
      initialized = false;
    const entered = new Map<string, NativeTextDraft>();
    const engine = new LogicFlow({
      container,
      grid: { size: 20, visible: true },
      background: { backgroundColor: "#faf9f5" },
      keyboard: { enabled: false },
      plugins: [Snapshot],
      stopScrollGraph: true,
    });
    lf.current = engine;
    engineKey.current = documentKey;
    const current = () =>
      alive &&
      initialized &&
      latest.current.documentKey === documentKey &&
      engineKey.current === documentKey &&
      lf.current === engine &&
      !transitionRef.current;
    engine.setTheme({
      rect: { radius: 8, stroke: "#263b51", fill: "#fffefb" },
      circle: { stroke: "#263b51", fill: "#e7eee9" },
      diamond: { stroke: "#a17b36", fill: "#fff4d7" },
      polyline: { stroke: "#52677b" },
      nodeText: { color: "#243648", fontSize: 14 },
      edgeText: { color: "#5d6873", fontSize: 12, textWidth: 100 },
    });
    const publish = () => {
      if (!current() || rendering.current) return false;
      const synchronized = synchronizedGraph.current;
      if (
        synchronized?.engine === engine &&
        synchronized.graph !== latest.current.data.graph
      )
        return false;
      try {
        const data = engine.getGraphRawData() as unknown as Graph;
        latest.current.setData((v) => {
          const next = restoreFlow({
            ...v,
            graph: JSON.stringify(
              mergeNative(graphValue(v.graph), data),
              null,
              2,
            ),
          });
          synchronizedGraph.current = {
            engine,
            key: documentKey,
            graph: next.graph,
          };
          return next;
        });
        return true;
      } catch (error) {
        if (current()) latest.current.report(error);
        return false;
      }
    };
    const input = (event: Event) => {
      if (
        !current() ||
        rendering.current ||
        !(event.target instanceof HTMLElement)
      )
        return;
      const editable = event.target.closest<HTMLElement>(
        '.lf-text-input[contenteditable="true"]',
      );
      const model = engine.graphModel.textEditElement;
      if (!editable || !container.contains(editable) || !model) return;
      const edit = { id: model.id, text: editable.innerText };
      entered.set(edit.id, edit);
      latest.current.setDraft((extra) => recordNativeText(extra, edit));
    };
    const textUpdated = ({ data }: { data?: unknown }) => {
      if (!current() || !isRecord(data) || typeof data.id !== "string") return;
      const edit = entered.get(data.id);
      if (!publish() || !edit) return;
      const actual = graphText(
        engine.getGraphRawData() as unknown as Graph,
        edit.id,
      );
      latest.current.setDraft((extra) =>
        acknowledgeNativeText(extra, edit, actual),
      );
      if (
        actual === edit.text ||
        actual === edit.text.replace(/(\r\n)+$|(\n)+$/, "")
      )
        entered.delete(edit.id);
    };
    const select = ({ data }: { data: { id: string } }) => {
      if (current()) setSelected(data.id);
    };
    engine.on("history:change", publish);
    engine.on("text:update", textUpdated);
    engine.on("node:click,edge:click", select);
    container.addEventListener("input", input, true);
    const resize = new ResizeObserver(() => {
      if (current()) engine.resize();
    });
    resize.observe(container);
    try {
      renderGraph(engine, p.data.graph);
    } catch {
      /* The original invalid JSON stays in the working copy. */
    }
    initialized = true;
    setReadyKey(documentKey);
    return () => {
      alive = false;
      initialized = false;
      container.removeEventListener("input", input, true);
      resize.disconnect();
      if (lf.current === engine) {
        lf.current = null;
        engineKey.current = null;
      }
      if (synchronizedGraph.current?.engine === engine)
        synchronizedGraph.current = null;
      engine.destroy();
      setReadyKey((key) => (key === documentKey ? null : key));
    };
  }, [p.loading, p.documentKey]);
  function renderGraph(engine: LogicFlow, source: string) {
    const key = engineKey.current;
    if (
      !key ||
      (synchronizedGraph.current?.engine === engine &&
        synchronizedGraph.current.key === key &&
        synchronizedGraph.current.graph === source)
    )
      return;
    const g = graphValue(source),
      ids = new Set(g.nodes.map((n) => n.id));
    const displayed = {
      ...g,
      edges: g.edges.filter(
        (e) => ids.has(e.sourceNodeId) && ids.has(e.targetNodeId),
      ),
    };
    rendering.current = true;
    try {
      engine.render(displayed as unknown as Parameters<LogicFlow["render"]>[0]);
      synchronizedGraph.current = { engine, key, graph: source };
    } finally {
      rendering.current = false;
    }
  }
  useEffect(() => {
    const engine = currentEngine();
    if (!engine) return;
    try {
      renderGraph(engine, p.data.graph);
    } catch {
      /* Keep invalid raw input recoverable without touching the canvas. */
    }
  }, [p.data.graph, readyKey, p.documentKey]);
  function currentEngine(): LogicFlow | null {
    return !transitionRef.current &&
      !latest.current.loading &&
      !latest.current.busy &&
      latest.current.documentKey === p.documentKey &&
      readyKey === p.documentKey &&
      engineKey.current === p.documentKey
      ? lf.current
      : null;
  }
  function native(action: (engine: LogicFlow) => void): boolean {
    const engine = currentEngine();
    if (!engine) return false;
    try {
      action(engine);
      if (currentEngine() !== engine) return false;
      const data = engine.getGraphRawData() as unknown as Graph;
      p.setData((v) => {
        const next = restoreFlow({
          ...v,
          graph: JSON.stringify(
            mergeNative(graphValue(v.graph), data),
            null,
            2,
          ),
        });
        synchronizedGraph.current = {
          engine,
          key: p.documentKey,
          graph: next.graph,
        };
        return next;
      });
      return true;
    } catch (error) {
      if (currentEngine() === engine) p.report(error);
      return false;
    }
  }
  async function applyTextDraft(edit: NativeTextDraft) {
    const engine = currentEngine(),
      documentKey = p.documentKey;
    if (!engine) return;
    // Exit an active upstream editor first so its queued __prevText cannot
    // overwrite this explicit application. Never enter/replay it on restore.
    const active = engine.graphModel.textEditElement;
    if (active) {
      engine.graphModel.setElementStateById(active.id, ElementState.DEFAULT);
      await new Promise<void>((resolve) =>
        requestAnimationFrame(() => resolve()),
      );
    }
    if (
      latest.current.documentKey !== documentKey ||
      currentEngine() !== engine
    )
      return;
    if (
      graphText(engine.getGraphRawData() as unknown as Graph, edit.id) ===
      undefined
    ) {
      p.setError("原对象已不存在，文字草稿仍保留。");
      return;
    }
    if (native((l) => l.updateText(edit.id, edit.text))) {
      const actual = graphText(
        engine.getGraphRawData() as unknown as Graph,
        edit.id,
      );
      p.setDraft((extra) => acknowledgeNativeText(extra, edit, actual));
      p.setNotice("恢复文字已应用到图纸。");
    }
  }
  function add(type: string, role: string) {
    native((e) => {
      const n = e.addNode({
        type,
        x: 200 + (graph.nodes.length % 4) * 180,
        y: 430 + Math.floor(graph.nodes.length / 4) * 80,
        text: role === "decision" ? "判断条件" : "新步骤",
        properties: { role },
      });
      setSelected(n.id);
    });
  }
  async function importFile(file: File) {
    if (transitionRef.current) return;
    transitionRef.current = true;
    const resume = suspendEngine();
    let moved = false;
    setTransitioning(true);
    try {
      if (file.size > 1800000) throw new Error("导入文件超过 1.8 MB。");
      const imported = importFlow(JSON.parse(await file.text()));
      moved = await p.replace(imported.data, imported.title, imported.extra);
      if (moved) setSelected("");
    } catch (e) {
      p.report(e);
    } finally {
      transitionRef.current = false;
      if (!moved) resume();
      setTransitioning(false);
    }
  }
  return (
    <main>
      <a className="skip" href="#drawing">
        跳到图纸
      </a>
      <header>
        <div className="brand">
          <span className="mark">LF</span>
          <div>
            <h1>流程图纸</h1>
            <small>LogicFlow · SOP / APPROVAL</small>
          </div>
        </div>
        <input
          aria-label="图纸名称"
          name="projectTitle"
          autoComplete="off"
          maxLength={120}
          className="title"
          value={p.title}
          onChange={(e) => p.setTitle(e.target.value)}
          disabled={locked}
        />
        <span className={"save " + p.autoState.phase} role="status">
          {p.autoState.message}
        </span>
        <button
          onClick={() => setInspector((v) => !v)}
          aria-expanded={inspector}
        >
          审阅栏
        </button>
      </header>
      <nav aria-label="文件操作">
        <ProjectPicker
          items={p.items}
          id={p.current?.id}
          disabled={locked}
          onOpen={(id) => void transition(() => p.open(id))}
        />
        <button disabled={locked} onClick={() => void transition(p.fresh)}>
          新建图纸
        </button>
        <label className="file-button">
          导入图纸
          <input
            aria-label="导入图纸"
            type="file"
            accept=".json"
            disabled={locked}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void importFile(f);
              e.target.value = "";
            }}
          />
        </label>
        <button
          onClick={() =>
            download(
              new Blob([p.data.graph], { type: "application/json" }),
              "flow.logicflow.json",
            )
          }
        >
          原生 JSON
        </button>
        <button
          onClick={() =>
            download(
              new Blob(
                [
                  JSON.stringify(
                    {
                      format: "logicflow-workbench",
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
              "flow.project.json",
            )
          }
        >
          完整工程
        </button>
        <button
          disabled={nativeLocked || Boolean(parseError)}
          onClick={() => {
            const engine = currentEngine(),
              documentKey = p.documentKey;
            if (!engine) return;
            void (engine.extension.snapshot as unknown as Snapshot)
              .getSnapshot("流程图纸", {
                fileType: "png",
                backgroundColor: "#faf9f5",
              })
              .catch((error) => {
                if (
                  latest.current.documentKey === documentKey &&
                  currentEngine() === engine
                )
                  p.report(error);
              });
          }}
        >
          PNG 图纸
        </button>
        <button onClick={p.exportDraft}>恢复稿</button>
        <button disabled={locked} onClick={() => void p.save()}>
          重试保存
        </button>
        {p.autoState.phase === "conflict" && p.current ? (
          <button onClick={() => void transition(() => p.open(p.current!.id))}>
            打开服务器版本
          </button>
        ) : null}
      </nav>
      <Notice error={p.error} notice={p.notice} />
      {textDrafts.length ? (
        <section className="text-drafts" aria-label="画布文字草稿">
          <h2>画布文字草稿</h2>
          <p>
            未退出编辑的文字也会自动保存。恢复后请确认内容，再明确应用到原对象。
          </p>
          {textDrafts.map((edit) => (
            <div key={edit.id}>
              <label>
                对象 {edit.id}
                <textarea
                  aria-label={"恢复文字 " + edit.id}
                  value={edit.text}
                  disabled={locked}
                  onChange={(event) =>
                    p.setDraft((extra) =>
                      recordNativeText(extra, {
                        id: edit.id,
                        text: event.target.value,
                      }),
                    )
                  }
                />
              </label>
              <button
                disabled={nativeLocked || Boolean(parseError)}
                onClick={() => void applyTextDraft(edit)}
              >
                应用恢复文字
              </button>
              {graphText(graph, edit.id) === undefined ? (
                <span role="status">原对象不存在；草稿仍保留。</span>
              ) : null}
            </div>
          ))}
        </section>
      ) : null}
      <div className={"workspace " + (!inspector ? "wide" : "")}>
        <section id="drawing" aria-label="流程图纸">
          <div className="tools">
            <span>添加步骤</span>
            <button
              disabled={nativeLocked || Boolean(parseError)}
              onClick={() => add("rect", "task")}
            >
              ▭ 任务
            </button>
            <button
              disabled={nativeLocked || Boolean(parseError)}
              onClick={() => add("diamond", "decision")}
            >
              ◇ 判断
            </button>
            <button
              disabled={nativeLocked || Boolean(parseError)}
              onClick={() => add("circle", "start")}
            >
              ○ 入口
            </button>
            <button
              disabled={nativeLocked || Boolean(parseError)}
              onClick={() => add("circle", "end")}
            >
              ◎ 终点
            </button>
            <button
              disabled={nativeLocked}
              onClick={() => currentEngine()?.fitView(40, 40)}
            >
              适配图纸
            </button>
          </div>
          <div
            inert={nativeLocked || Boolean(parseError)}
            className={
              "canvas-wrap " + (nativeLocked || parseError ? "locked" : "")
            }
          >
            <div
              ref={host}
              className="canvas"
              aria-label="原生 LogicFlow 画布"
            />
            {parseError ? (
              <div className="canvas-error" role="alert">
                {parseError}。工作稿已保留，请修正原生 JSON。
              </div>
            ) : null}
          </div>
          <footer>
            <span>
              {graph.nodes.length} 个步骤 · {graph.edges.length} 条连线
            </span>
            <span>拖动节点锚点连接 · 双击标签编辑 · 滚轮保持页面滚动</span>
          </footer>
        </section>
        {inspector ? (
          <aside>
            <h2>
              检查与审阅 <span>{warnings.length}</span>
            </h2>
            <p className="muted">入口 / 终点为业务标记；循环需要人工核对。</p>
            <div className="warnings">
              {warnings.length ? (
                warnings.map((w, i) => <p key={i}>△ {w}</p>)
              ) : (
                <p>结构检查通过。</p>
              )}
            </div>
            <details open>
              <summary>步骤与连线属性</summary>
              <fieldset disabled={nativeLocked}>
                <label>
                  选择对象
                  <select
                    aria-label="选择对象"
                    value={selected}
                    onChange={(e) => setSelected(e.target.value)}
                  >
                    <option value="">选择一个对象…</option>
                    {[...graph.nodes, ...graph.edges].map((n) => (
                      <option value={n.id} key={n.id}>
                        {label(n)}
                      </option>
                    ))}
                  </select>
                </label>
                {selection ? (
                  <>
                    <label>
                      标签
                      <input
                        value={label(selection)}
                        onChange={(e) =>
                          native((l) => l.updateText(selected, e.target.value))
                        }
                      />
                    </label>
                    {"sourceNodeId" in selection ? (
                      <label>
                        分支条件
                        <input
                          value={String(selection.properties?.condition ?? "")}
                          onChange={(e) =>
                            native((l) =>
                              l.setProperties(selected, {
                                condition: e.target.value,
                              }),
                            )
                          }
                        />
                      </label>
                    ) : (
                      <>
                        <label>
                          业务角色
                          <select
                            value={String(selection.properties?.role ?? "task")}
                            onChange={(e) =>
                              native((l) =>
                                l.setProperties(selected, {
                                  role: e.target.value,
                                }),
                              )
                            }
                          >
                            <option value="task">任务</option>
                            <option value="decision">判断</option>
                            <option value="start">入口</option>
                            <option value="end">终点</option>
                          </select>
                        </label>
                        <div className="coordinates">
                          {(["x", "y"] as const).map((axis) => (
                            <label key={axis}>
                              {axis.toUpperCase()}
                              <input
                                aria-label={"坐标 " + axis.toUpperCase()}
                                inputMode="decimal"
                                value={
                                  typeof p.draft[
                                    `coord-${selected}-${axis}`
                                  ] === "string"
                                    ? String(
                                        p.draft[`coord-${selected}-${axis}`],
                                      )
                                    : String(selection[axis])
                                }
                                onChange={(e) =>
                                  p.setDraft((v) => ({
                                    ...v,
                                    [`coord-${selected}-${axis}`]:
                                      e.target.value,
                                  }))
                                }
                              />
                            </label>
                          ))}
                        </div>
                        <button
                          onClick={() => {
                            const x =
                                p.draft[`coord-${selected}-x`] ?? selection.x,
                              y = p.draft[`coord-${selected}-y`] ?? selection.y;
                            if (
                              String(x).trim() === "" ||
                              String(y).trim() === "" ||
                              !Number.isFinite(Number(x)) ||
                              !Number.isFinite(Number(y))
                            ) {
                              p.setError(
                                "坐标需要完整数字，未完成输入已保留。",
                              );
                              return;
                            }
                            native((l) =>
                              l.graphModel.moveNode2Coordinate(
                                selected,
                                Number(x),
                                Number(y),
                              ),
                            );
                            p.setDraft((v) => {
                              const next = { ...v };
                              delete next[`coord-${selected}-x`];
                              delete next[`coord-${selected}-y`];
                              return next;
                            });
                          }}
                        >
                          应用坐标
                        </button>
                      </>
                    )}
                    <button
                      onClick={() => {
                        if (
                          confirm(
                            "删除选中对象及其关联连线？建议先导出恢复稿。",
                          )
                        )
                          native((l) => {
                            if ("sourceNodeId" in selection)
                              l.deleteEdge(selected);
                            else l.deleteNode(selected);
                            setSelected("");
                          });
                      }}
                    >
                      删除对象
                    </button>
                  </>
                ) : (
                  <p className="muted">单击图纸或从列表选择。</p>
                )}
              </fieldset>
            </details>
            <details>
              <summary>连接两个步骤</summary>
              <fieldset disabled={nativeLocked || Boolean(parseError)}>
                <label>
                  起点
                  <select
                    aria-label="连线起点"
                    value={source}
                    onChange={(e) =>
                      p.setDraft((v) => ({ ...v, source: e.target.value }))
                    }
                  >
                    {graph.nodes.map((n) => (
                      <option key={n.id} value={n.id}>
                        {label(n)}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  终点
                  <select
                    aria-label="连线终点"
                    value={target}
                    onChange={(e) =>
                      p.setDraft((v) => ({ ...v, target: e.target.value }))
                    }
                  >
                    {graph.nodes.map((n) => (
                      <option key={n.id} value={n.id}>
                        {label(n)}
                      </option>
                    ))}
                  </select>
                </label>
                <button
                  onClick={() =>
                    native((l) =>
                      l.addEdge({
                        type: "polyline",
                        sourceNodeId: source,
                        targetNodeId: target,
                      }),
                    )
                  }
                >
                  添加连线
                </button>
              </fieldset>
            </details>
            <details>
              <summary>路径审阅（最多 30 条）</summary>
              {pathList.map((s, i) => (
                <p key={i} className="path">
                  {i + 1}. {s}
                </p>
              ))}
              {!pathList.length ? <p>请先标记入口。</p> : null}
            </details>
            <label>
              审阅记录
              <textarea
                aria-label="审阅记录"
                name="reviewNotes"
                autoComplete="off"
                maxLength={40000}
                value={p.data.notes}
                disabled={locked}
                onChange={(e) =>
                  p.setData((v) => ({ ...v, notes: e.target.value }))
                }
              />
            </label>
          </aside>
        ) : null}
      </div>
      <details className="raw">
        <summary>原生 JSON · 未应用编辑也会自动保存</summary>
        <textarea
          aria-label="原生 JSON 编辑器"
          spellCheck={false}
          value={raw}
          disabled={locked}
          onChange={(e) => p.setDraft((v) => ({ ...v, raw: e.target.value }))}
        />
        <button
          disabled={locked}
          onClick={() => {
            try {
              const next = validateFlow({ ...p.data, graph: raw });
              p.setData(next);
              p.setDraft((v) => {
                const n = { ...v };
                delete n.raw;
                return n;
              });
              p.setError("");
            } catch (e) {
              p.report(e);
            }
          }}
        >
          应用到图纸
        </button>
      </details>
    </main>
  );
}
