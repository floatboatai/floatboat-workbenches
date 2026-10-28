import {
  Network,
  Upload,
  Download,
  Plus,
  Code2,
  Search,
  ArrowRight,
  Route,
  RefreshCw,
} from "lucide-react";
import { ProjectPicker, Notice, download } from "./workspace.tsx";
import { label, field } from "../contracts/graph.ts";
import { GraphCanvas } from "./GraphCanvas.tsx";
import { useGraphDesk } from "./useGraphDesk.ts";
export function App() {
  const {
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
  } = useGraphDesk();
  if (p.loading)
    return (
      <main className="loading" role="status">
        正在恢复知识地图…
      </main>
    );
  return (
    <>
      <a className="skip" href="#map-main">
        跳到知识地图
      </a>
      <header className="topbar">
        <div className="brand">
          <Network aria-hidden="true" />
          <strong>知识地图</strong>
          <span>GRAPHIFY</span>
        </div>
        <input
          aria-label="项目名称"
          name="title"
          autoComplete="off"
          value={p.title}
          maxLength={120}
          disabled={!mutable}
          onChange={(e) => p.setTitle(e.target.value)}
        />
        <ProjectPicker
          items={p.items}
          id={p.current?.id}
          disabled={!mutable}
          onOpen={(id) => {
            void p.open(id);
          }}
        />
        <div className="file-actions">
          <button
            disabled={!mutable}
            onClick={() => {
              void p.fresh();
            }}
          >
            <Plus aria-hidden="true" size={16} />
            新建
          </button>
          <button disabled={!mutable} onClick={() => file.current?.click()}>
            <Upload aria-hidden="true" size={16} />
            导入
          </button>
          <button onClick={exportProject}>
            <Download aria-hidden="true" size={16} />
            项目
          </button>
        </div>
        <input
          ref={file}
          type="file"
          accept=".json"
          hidden
          aria-label="导入图谱或项目文件"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void importFile(f);
            e.target.value = "";
          }}
        />
      </header>
      <div className="savebar">
        <span role="status" className={`save-state ${p.autoState.phase}`}>
          {p.autoState.message}
        </span>
        <span>图谱、布局与审阅笔记</span>
        {["offline", "conflict", "draft"].includes(p.autoState.phase) ? (
          <>
            <button
              onClick={() => {
                void p.save();
              }}
            >
              重试保存
            </button>
            <button onClick={p.exportDraft}>导出工作稿</button>
            {p.current ? (
              <button
                onClick={() => {
                  void p.open(p.current!.id);
                }}
              >
                读取服务器版本
              </button>
            ) : null}
          </>
        ) : null}
      </div>
      <Notice error={p.error} notice={p.notice} />
      <main id="map-main" className="workspace" inert={!mutable}>
        <aside className="directory">
          <div className="panel-title">
            <span>对象目录</span>
            <b>{graph.nodes.length}</b>
          </div>
          <label className="search">
            <Search aria-hidden="true" size={15} />
            <input
              aria-label="筛选节点"
              name="search"
              autoComplete="off"
              placeholder="搜索符号或文件…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </label>
          <nav aria-label="图谱节点">
            {matches.map((n) => (
              <button
                key={n.id}
                className={n.id === p.data.selected ? "active" : ""}
                onClick={() => p.setData((d) => ({ ...d, selected: n.id }))}
              >
                <span>{n._callable_class ? "C" : n._callable ? "ƒ" : "◇"}</span>
                <div>
                  <strong>{label(n)}</strong>
                  <small>{field(n, "source_file") || "外部对象"}</small>
                </div>
              </button>
            ))}
            {!matches.length ? <p className="quiet">没有匹配的节点</p> : null}
          </nav>
          <div className="directory-footer">
            <b>{graph.links.length}</b> 条关系 ·{" "}
            {graph.directed ? "有向图" : "无向图"}
          </div>
        </aside>
        <section className="map-panel">
          <div className="map-toolbar">
            <div>
              <h1>关系与路径</h1>
              <span>选中对象，沿来源追溯</span>
            </div>
            <div className="map-controls">
              <label>
                缩放
                <input
                  aria-label="地图缩放"
                  type="range"
                  min="0.4"
                  max="1.4"
                  step="0.1"
                  value={zoom}
                  onChange={(e) => setZoom(Number(e.target.value))}
                />
              </label>
              <button
                onClick={() => p.setData((d) => ({ ...d, positions: {} }))}
              >
                整理布局
              </button>
            </div>
          </div>
          <GraphCanvas
            graph={graph}
            positions={p.data.positions}
            selected={p.data.selected}
            path={path}
            query={query}
            zoom={zoom}
            onSelect={(id) => p.setData((d) => ({ ...d, selected: id }))}
            onMove={(id, point) =>
              p.setData((d) => ({
                ...d,
                positions: { ...d.positions, [id]: point },
              }))
            }
          />
          <div className="path-tool">
            <Route size={18} aria-hidden="true" />
            <label>
              起点
              <select
                aria-label="路径起点"
                value={p.data.from}
                onChange={(e) =>
                  p.setData((d) => ({ ...d, from: e.target.value }))
                }
              >
                <option value="">选择对象</option>
                {graph.nodes.map((n) => (
                  <option key={n.id} value={n.id}>
                    {label(n)}
                  </option>
                ))}
              </select>
            </label>
            <ArrowRight aria-hidden="true" size={16} />
            <label>
              终点
              <select
                aria-label="路径终点"
                value={p.data.to}
                onChange={(e) =>
                  p.setData((d) => ({ ...d, to: e.target.value }))
                }
              >
                <option value="">选择对象</option>
                {graph.nodes.map((n) => (
                  <option key={n.id} value={n.id}>
                    {label(n)}
                  </option>
                ))}
              </select>
            </label>
            <span role="status">
              {p.data.from && p.data.to
                ? path.length
                  ? `${path.length - 1} 步相连`
                  : "未找到可达路径"
                : "选择起点与终点"}
            </span>
          </div>
          <div className="map-footer">
            <span id="map-keys">
              <i className="dot extracted" />
              原文关系 <i className="dot path" />
              选中路径 · Alt＋方向键移动节点
            </span>
            <button
              onClick={() =>
                download(
                  new Blob([JSON.stringify(graph, null, 2)], {
                    type: "application/json",
                  }),
                  "graph.json",
                )
              }
            >
              导出原生图谱
            </button>
          </div>
        </section>
        <aside className="inspector">
          <div className="panel-title">
            对象审阅<span>{selected ? "已选中" : "未选择"}</span>
          </div>
          {selected ? (
            <>
              <div className="object-title">
                <span>
                  {selected._callable_class
                    ? "CLASS"
                    : selected._callable
                      ? "FUNCTION"
                      : "OBJECT"}
                </span>
                <h2>{label(selected)}</h2>
              </div>
              <dl>
                <dt>来源文件</dt>
                <dd>{field(selected, "source_file") || "未提供"}</dd>
                <dt>位置</dt>
                <dd>{field(selected, "source_location") || "未提供"}</dd>
                <dt>提取来源</dt>
                <dd>{field(selected, "_origin") || "导入图谱"}</dd>
              </dl>
              <label className="note-label">
                审阅笔记
                <textarea
                  id="node-note"
                  name="note"
                  maxLength={5000}
                  value={p.data.notes[selected.id] ?? ""}
                  placeholder="记录这个对象的职责、疑问和下一步…"
                  onChange={(e) => {
                    const value = e.target.value;
                    p.setData((d) => ({
                      ...d,
                      notes: { ...d.notes, [selected.id]: value },
                    }));
                  }}
                />
              </label>
              <div className="relations">
                <h3>相关关系</h3>
                {graph.links
                  .filter(
                    (l) => l.source === selected.id || l.target === selected.id,
                  )
                  .map((l, i) => (
                    <button
                      key={i}
                      onClick={() =>
                        p.setData((d) => ({
                          ...d,
                          selected:
                            l.source === selected.id ? l.target : l.source,
                        }))
                      }
                    >
                      <small>
                        {field(l, "relation") || "关联"} ·{" "}
                        {field(l, "confidence") || "未标注"}
                      </small>
                      <strong>
                        {label(
                          graph.nodes.find(
                            (n) =>
                              n.id ===
                              (l.source === selected.id ? l.target : l.source),
                          )!,
                        )}
                      </strong>
                    </button>
                  ))}
              </div>
            </>
          ) : (
            <p className="quiet">选择节点查看来源并添加笔记。</p>
          )}
        </aside>
      </main>
      <section className="source-drawer" inert={!mutable}>
        <div className="drawer-tabs">
          <button
            aria-expanded={sourceOpen}
            onClick={() => setSourceOpen((v) => !v)}
          >
            <Code2 aria-hidden="true" size={17} />
            源码提取
          </button>
          <button
            aria-expanded={jsonOpen}
            onClick={() => setJsonOpen((v) => !v)}
          >
            图谱 JSON
          </button>
          <span className={engine.available ? "connected" : ""}>
            {engine.engine}
          </span>
          <button
            aria-label="重新检查提取服务"
            onClick={() => {
              void checkEngine();
            }}
          >
            <RefreshCw aria-hidden="true" size={14} />
          </button>
        </div>
        {sourceOpen ? (
          <div className="source-content">
            <div>
              <label>
                源码文件名
                <input
                  id="source-name"
                  name="sourceName"
                  autoComplete="off"
                  value={p.data.name}
                  maxLength={100}
                  onChange={(e) =>
                    p.setData((d) => ({ ...d, name: e.target.value }))
                  }
                />
              </label>
              <p>
                Python、JavaScript、TypeScript。选择的源码只发送到配置的提取服务。
              </p>
              <button
                className="primary"
                disabled={!mutable || extracting || !engine.available}
                onClick={() => {
                  void extract();
                }}
              >
                {extracting ? "正在提取…" : "提取关系"}
              </button>
            </div>
            <label className="code-label">
              源码
              <textarea
                id="source-code"
                name="sourceCode"
                spellCheck={false}
                maxLength={80000}
                value={p.data.source}
                onChange={(e) =>
                  p.setData((d) => ({ ...d, source: e.target.value }))
                }
              />
            </label>
          </div>
        ) : null}
        {pending ? (
          <div className="pending-result" role="status">
            <span>
              提取结果已保留：{String(pending.name)} · 等待采用
              {pending.code !== p.data.source || pending.name !== p.data.name
                ? "（源码已改变，此结果来自上一次输入）"
                : ""}
            </span>
            <button disabled={!mutable} onClick={adoptPending}>
              采用提取结果
            </button>
            <button
              onClick={() =>
                p.setDraft((d) => {
                  const n = { ...d };
                  delete n.extracted;
                  return n;
                })
              }
            >
              丢弃结果
            </button>
          </div>
        ) : null}
        {jsonOpen ? (
          <div className="json-editor">
            <label>
              原生图谱 JSON
              <textarea
                id="graph-json"
                name="graphJson"
                spellCheck={false}
                value={rawJson}
                maxLength={350000}
                onChange={(e) =>
                  p.setDraft((d) => ({ ...d, graphJson: e.target.value }))
                }
              />
            </label>
            <button disabled={!mutable} onClick={applyJson}>
              应用 JSON
            </button>
            <span>未应用的编辑也会作为工作稿保存</span>
          </div>
        ) : null}
      </section>
    </>
  );
}
