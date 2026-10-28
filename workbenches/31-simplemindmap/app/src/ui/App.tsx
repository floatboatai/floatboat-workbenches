import { useEffect, useRef, useState } from "react";
import {
  GitBranch,
  FolderOpen,
  Download,
  Plus,
  Minus,
  Maximize2,
  ChevronRight,
  ListTree,
  Undo2,
  Redo2,
  Settings2,
} from "lucide-react";
import {
  seed,
  validateMap,
  restoreMap,
  parseMapImport,
  flatBranches,
  layouts,
  themes,
  type Branch,
  type Layout,
  type Theme,
} from "../contracts/mindmap";
import { isRecord } from "../contracts/project";
import { useProjects, ProjectPicker, Notice, download } from "./workspace";
import { MindCanvas, type MapHandle } from "./MindCanvas";
export function App() {
  const p = useProjects(seed, validateMap, "周末社区花园", {
    storageKey: "simplemindmap-v1",
    restoreDraftData: restoreMap,
  });
  const [files, setFiles] = useState(false),
    [outline, setOutline] = useState(false),
    [settings, setSettings] = useState(false),
    [selected, setSelected] = useState("garden-root"),
    [transitioning, setTransitioning] = useState(false),
    [exporting, setExporting] = useState(false);
  const transitionRef = useRef(false),
    exportRef = useRef(false),
    activeKey = useRef(p.documentKey),
    map = useRef<MapHandle | null>(null),
    file = useRef<HTMLInputElement>(null);
  activeKey.current = p.documentKey;
  const locked = transitioning || exporting || p.loading || p.busy;
  useEffect(() => {
    const native = p.draft.nativeEditing;
    const texts = p.draft.nodeTexts;
    const uid =
      isRecord(native) && typeof native.uid === "string"
        ? native.uid
        : isRecord(texts)
          ? Object.keys(texts)[0]
          : undefined;
    if (uid) setSelected(uid);
  }, [p.documentKey]);
  const branches = flatBranches(p.data.tree),
    current = branches.find((b) => b.uid === selected) || branches[0];
  const textDrafts = isRecord(p.draft.nodeTexts) ? p.draft.nodeTexts : {},
    nativeDraft =
      isRecord(p.draft.nativeEditing) &&
      typeof p.draft.nativeEditing.uid === "string" &&
      typeof p.draft.nativeEditing.text === "string"
        ? p.draft.nativeEditing
        : null;
  const text =
    typeof textDrafts[current.uid] === "string"
      ? (textDrafts[current.uid] as string)
      : nativeDraft?.uid === current.uid
        ? (nativeDraft.text as string)
        : current.text;
  const json = typeof p.draft.json === "string" ? p.draft.json : "";
  let renderable = true;
  try {
    validateMap(p.data);
  } catch {
    renderable = false;
  }
  function treeChanged(tree: Branch) {
    if (
      !transitionRef.current &&
      JSON.stringify(tree) !== JSON.stringify(p.data.tree)
    )
      p.setData((data) => ({ ...data, tree }));
  }
  function nativeChanged(uid: string, value: string) {
    if (transitionRef.current) return;
    setSelected(uid);
    p.setDraft((d) => ({ ...d, nativeEditing: { uid, text: value } }));
  }
  function nativeEnded() {
    p.setDraft((d) => {
      const next = { ...d };
      delete next.nativeEditing;
      return next;
    });
  }
  async function transition(action: () => Promise<boolean>) {
    if (transitionRef.current || exportRef.current) return;
    map.current?.flush();
    transitionRef.current = true;
    setTransitioning(true);
    try {
      if (await action()) setSelected("");
    } catch (e) {
      p.report(e);
    } finally {
      transitionRef.current = false;
      setTransitioning(false);
    }
  }
  function command(name: string) {
    if (transitionRef.current) return;
    if (
      name === "REMOVE_NODE" &&
      !confirm("删除「" + current.text + "」及其子节点？")
    )
      return;
    map.current?.command(name, current.uid);
  }
  function applyText() {
    if (transitionRef.current) return;
    if (text.length > 4000) {
      p.setError("节点文字超过 4000 字符，输入已作为草稿保留。");
      return;
    }
    map.current?.command("SET_NODE_TEXT", current.uid, text);
    p.setDraft((d) => {
      const texts = { ...(isRecord(d.nodeTexts) ? d.nodeTexts : {}) };
      delete texts[current.uid];
      const next: Record<string, unknown> = { ...d, nodeTexts: texts };
      if (
        isRecord(next.nativeEditing) &&
        next.nativeEditing.uid === current.uid
      )
        delete next.nativeEditing;
      return next;
    });
    p.setError("");
  }
  async function importFile(f: File) {
    await transition(async () => {
      if (f.size > 1800000) throw new Error("导图文件最多 1.8 MB。");
      const raw = await f.text();
      let value: ReturnType<typeof parseMapImport>;
      try {
        value = parseMapImport(JSON.parse(raw));
      } catch (error) {
        p.setDraft((d) => ({ ...d, json: raw }));
        throw error;
      }
      return p.replace(value.data, value.title, value.extra);
    });
  }
  async function exportFile(kind: "svg" | "tree" | "project") {
    if (exportRef.current || transitionRef.current) return;
    const key = p.documentKey;
    try {
      map.current?.flush();
      if (kind === "svg") {
        exportRef.current = true;
        setExporting(true);
        const source = await map.current?.svg();
        if (activeKey.current !== key) return;
        if (!source) throw new Error("请先修正导图再导出 SVG。");
        download(new Blob([source], { type: "image/svg+xml" }), "mind-map.svg");
      } else if (kind === "tree") {
        download(
          new Blob(
            [JSON.stringify(map.current?.tree() ?? p.data.tree, null, 2)],
            { type: "application/json" },
          ),
          "mind-map.nodes.json",
        );
      } else {
        download(
          new Blob(
            [
              JSON.stringify(
                {
                  format: "simplemindmap-workbench/v1",
                  title: p.title,
                  data: { ...p.data, tree: map.current?.tree() ?? p.data.tree },
                  extra: p.draft,
                },
                null,
                2,
              ),
            ],
            { type: "application/json" },
          ),
          "mind-map.project.json",
        );
      }
    } catch (e) {
      if (activeKey.current === key) p.report(e);
    } finally {
      exportRef.current = false;
      setExporting(false);
    }
  }
  function focus(uid: string) {
    setSelected(uid);
    map.current?.focus(uid);
    setOutline(false);
  }
  return (
    <div className="app-shell">
      <a className="skip" href="#mindspace">
        跳到导图
      </a>
      <header>
        <div className="brand">
          <GitBranch size={23} />
          <h1>思绪地图</h1>
        </div>
        <span className="divider" />
        <input
          className="title"
          aria-label="导图名称"
          maxLength={120}
          autoComplete="off"
          value={p.title}
          disabled={locked}
          onChange={(e) => {
            if (!transitionRef.current) p.setTitle(e.target.value);
          }}
        />
        <span className={"save " + p.autoState.phase} role="status">
          {p.autoState.message}
        </span>
        <button
          aria-label="文件与导出"
          aria-expanded={files}
          onClick={() => setFiles(!files)}
        >
          <FolderOpen size={17} />
        </button>
        <button
          className="primary"
          disabled={locked || !renderable}
          onClick={() => exportFile("svg")}
        >
          <Download size={16} />
          SVG
        </button>
      </header>
      <Notice error={p.error} notice={p.notice} />
      {files && (
        <section className="file-drawer" aria-label="文件与导出">
          <div className="file-row">
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
              新建导图
            </button>
            <button disabled={locked} onClick={() => file.current?.click()}>
              导入 JSON / 恢复稿
            </button>
            <button disabled={locked} onClick={() => exportFile("project")}>
              导出完整工程
            </button>
            <button disabled={locked} onClick={() => exportFile("tree")}>
              导出节点 JSON
            </button>
            <button onClick={p.exportDraft}>导出恢复稿</button>
            <button disabled={locked} onClick={() => void p.save()}>
              重试保存
            </button>
            {p.current && (
              <button
                disabled={locked}
                onClick={() => void transition(() => p.open(p.current!.id))}
              >
                打开服务器版本
              </button>
            )}
          </div>
          <input
            ref={file}
            type="file"
            accept=".json,application/json"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void importFile(f);
              e.target.value = "";
            }}
          />
          <details>
            <summary>导图 JSON 草稿</summary>
            <textarea
              aria-label="导图 JSON 草稿"
              value={json}
              disabled={locked}
              spellCheck={false}
              onChange={(e) =>
                p.setDraft((d) => ({ ...d, json: e.target.value }))
              }
              placeholder="粘贴原生节点树或完整工程…"
            />
            <button
              disabled={locked}
              onClick={() => {
                try {
                  const value = parseMapImport(JSON.parse(json));
                  p.setData(validateMap(value.data));
                  p.setError("");
                  p.setNotice("导图数据已应用。");
                } catch (e) {
                  p.report(e);
                }
              }}
            >
              应用 JSON
            </button>
            <button
              disabled={locked}
              onClick={() =>
                p.setDraft((d) => ({
                  ...d,
                  json: JSON.stringify(
                    { title: p.title, data: p.data, extra: {} },
                    null,
                    2,
                  ),
                }))
              }
            >
              载入当前数据
            </button>
          </details>
        </section>
      )}
      <main id="mindspace">
        <nav className="map-bar" aria-label="导图导航">
          <button aria-expanded={outline} onClick={() => setOutline(!outline)}>
            <ListTree size={16} />
            分支
          </button>
          <div className="breadcrumb">
            <span>{p.data.tree.data.text}</span>
            <ChevronRight size={13} />
            <strong>{current.text || "空节点"}</strong>
          </div>
          <span className="node-count">{branches.length} 个想法</span>
          <button
            aria-label="结构与主题"
            aria-expanded={settings}
            onClick={() => setSettings(!settings)}
          >
            <Settings2 size={16} />
          </button>
        </nav>
        {outline && (
          <section className="outline" aria-label="分支导航">
            <h2>导航到分支</h2>
            {branches.map((b, index) => (
              <button
                key={b.uid || index}
                style={{ paddingLeft: 12 + b.depth * 16 }}
                disabled={locked || !b.uid}
                className={b.uid === current.uid ? "active" : ""}
                onClick={() => focus(b.uid)}
              >
                <span>{b.text || "空节点"}</span>
              </button>
            ))}
          </section>
        )}
        {settings && (
          <section className="settings" aria-label="结构与主题">
            <label>
              结构
              <select
                aria-label="导图结构"
                value={p.data.layout}
                disabled={locked}
                onChange={(e) =>
                  p.setData((d) => ({ ...d, layout: e.target.value as Layout }))
                }
              >
                {Object.entries(layouts).map(([key, label]) => (
                  <option key={key} value={key}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              主题
              <select
                aria-label="导图主题"
                value={p.data.theme}
                disabled={locked}
                onChange={(e) =>
                  p.setData((d) => ({ ...d, theme: e.target.value as Theme }))
                }
              >
                {Object.entries(themes).map(([key, label]) => (
                  <option key={key} value={key}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
          </section>
        )}
        <div className="map-stage">
          {renderable && !p.loading ? (
            <MindCanvas
              key={p.documentKey}
              project={p.data}
              disabled={locked}
              handle={map}
              onChange={treeChanged}
              onSelect={setSelected}
              onDraft={nativeChanged}
              onEnd={nativeEnded}
              onError={p.report}
            />
          ) : (
            <div className="invalid" role="alert">
              {p.loading
                ? "正在恢复导图…"
                : "导图包含未支持的结构或未完成值。原稿已保留，请打开 JSON 草稿修正。"}
            </div>
          )}
          <div className="zoom" aria-label="画布视图">
            <button aria-label="缩小" onClick={() => map.current?.zoom(-1)}>
              <Minus size={16} />
            </button>
            <button onClick={() => map.current?.fit()}>
              <Maximize2 size={15} />
              适应
            </button>
            <button aria-label="放大" onClick={() => map.current?.zoom(1)}>
              <Plus size={16} />
            </button>
          </div>
          <p className="map-hint">
            双击节点编辑 · Tab 添加子节点 · 拖动画布探索
          </p>
        </div>
        <section className="node-dock" aria-label="节点工具">
          <div className="node-editor">
            <label htmlFor="node-text">
              {current.parent ? "当前想法" : "中心主题"}
              {text !== current.text ? " · 未应用" : ""}
            </label>
            <textarea
              id="node-text"
              aria-label="节点文字"
              rows={2}
              value={text}
              disabled={locked || !renderable}
              onChange={(e) =>
                p.setDraft((d) => ({
                  ...d,
                  nodeTexts: {
                    ...(isRecord(d.nodeTexts) ? d.nodeTexts : {}),
                    [current.uid]: e.target.value,
                  },
                }))
              }
            />
          </div>
          <div className="dock-actions">
            <button
              className="primary"
              disabled={locked || !renderable}
              onClick={applyText}
            >
              应用文字
            </button>
            <button
              disabled={locked || !renderable}
              onClick={() => command("INSERT_CHILD_NODE")}
            >
              <Plus size={15} />
              子节点
            </button>
            <button
              disabled={locked || !renderable || !current.parent}
              onClick={() => command("INSERT_NODE")}
            >
              同级节点
            </button>
            <button
              disabled={locked || !renderable}
              onClick={() => command("SET_NODE_EXPAND")}
            >
              展开 / 收起
            </button>
            <button
              disabled={locked || !renderable || !current.parent}
              onClick={() => command("REMOVE_NODE")}
            >
              删除分支
            </button>
            <button
              aria-label="撤销"
              disabled={locked || !renderable}
              onClick={() => command("BACK")}
            >
              <Undo2 size={16} />
            </button>
            <button
              aria-label="重做"
              disabled={locked || !renderable}
              onClick={() => command("FORWARD")}
            >
              <Redo2 size={16} />
            </button>
          </div>
        </section>
      </main>
      <footer>
        <span>SIMPLE MIND MAP</span>
        <span>让想法生长成计划</span>
      </footer>
    </div>
  );
}
