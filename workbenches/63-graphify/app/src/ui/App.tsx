// ABOUTME: 知识地图外壳：细文件条与检索，左社区/资料，中央力导向地图与路径条，右检查器；窄屏三段切换。

import { useRef, useState } from "react";
import { Menu, Download, Search, Maximize2, ZoomIn, ZoomOut, Shuffle, X, ArrowRight, ArrowLeftRight, FolderOpen, FilePlus2 } from "lucide-react";
import { useGraphDesk, type Desk, type MobileView } from "./useGraphDesk.ts";
import { Notice } from "./workspace.tsx";
import { GraphCanvas, type CanvasHandle } from "./GraphCanvas.tsx";
import { Sidebar } from "./Sidebar.tsx";
import { Inspector } from "./Inspector.tsx";
import { FileMenu, ExportMenu, JsonDialog, HostDialog } from "./FileMenu.tsx";
import { colorOf } from "../contracts/analysis.ts";
import { communityOf, field, label, RELATION_NAMES } from "../contracts/graph.ts";
import { readDrop, readFileList } from "./files.ts";

const VIEWS: Array<[MobileView, string]> = [
  ["map", "地图"],
  ["side", "社区 · 资料"],
  ["detail", "详情"],
];

export function App() {
  const d = useGraphDesk(),
    { p, mutable } = d;
  const [menu, setMenu] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [hostOpen, setHostOpen] = useState(false);
  const canvas = useRef<CanvasHandle>(null);
  if (p.loading)
    return (
      <main className="loading" role="status">
        正在恢复知识地图…
      </main>
    );
  const attention = ["offline", "conflict", "draft"].includes(p.autoState.phase);
  const pick = (id: string) => {
    d.select(id);
    canvas.current?.focus(id);
    d.setInspect((s) => ({ ...s, tab: "detail" }));
  };
  return (
    <div className="desk" data-view={d.mobile}>
      <a className="skip" href="#map">
        跳到知识地图
      </a>
      <header className="filebar">
        <button className="menu-button" aria-haspopup="dialog" aria-expanded={menu} onClick={() => setMenu(true)}>
          <Menu size={16} aria-hidden="true" />
          图谱
        </button>
        <label className="title-field">
          <span className="sr-only">知识地图名称</span>
          <input name="title" autoComplete="off" value={p.title} maxLength={120} disabled={!mutable} onChange={(e) => p.setTitle(e.target.value)} />
        </label>
        <span role="status" className={`save-state ${p.autoState.phase}`}>
          {p.autoState.message}
        </span>
        {attention ? (
          <span className="save-actions">
            <button onClick={() => void p.save()}>重试保存</button>
            <button onClick={p.exportDraft}>下载恢复稿</button>
            {p.current ? <button onClick={() => void p.open(p.current!.id)}>读取服务器版本</button> : null}
          </span>
        ) : null}
        <SearchBox d={d} onPick={pick} />
        <button className="export-button" disabled={!d.graph || !d.shown.nodes.length} onClick={() => setExporting(true)}>
          <Download size={15} aria-hidden="true" />
          导出
        </button>
        <input
          ref={d.file}
          type="file"
          accept=".json,application/json"
          hidden
          aria-label="导入图谱或项目文件"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void d.importFile(f);
            e.target.value = "";
          }}
        />
      </header>
      <Notice error={p.error} notice={p.notice} />
      <nav className="mobile-tabs" aria-label="视图">
        {VIEWS.map(([v, name]) => (
          <button key={v} aria-pressed={d.mobile === v} onClick={() => d.setMobile(v)}>
            {name}
          </button>
        ))}
      </nav>
      <main className="workspace" inert={!mutable}>
        <Sidebar d={d} onHost={() => setHostOpen(true)} />
        <section className="map-panel" id="map" aria-label="知识地图">
          <MapToolbar d={d} canvas={canvas} />
          <div className="map-stage">
            {d.graphError ? (
              <div className="map-message" role="alert">
                <p>{d.graphError}</p>
              </div>
            ) : !d.graph ? (
              <div className="map-message" role="status">
                <p>正在读取图谱…</p>
              </div>
            ) : !d.shown.nodes.length ? (
              <EmptyMap d={d} />
            ) : (
              <GraphCanvas
                graph={d.shown}
                layout={d.layout}
                hidden={d.hidden}
                selected={p.data.selected}
                pathNodes={d.pathNodes}
                pathLinks={d.pathLinks}
                matches={d.matchSet}
                onSelect={(id) => {
                  d.select(id);
                  d.setInspect((s) => ({ ...s, tab: "detail" }));
                }}
                onOpen={(id) => d.openSource(d.byId.get(id))}
                onMove={(id, pt) => p.setData((x) => ({ ...x, pins: { ...x.pins, [id]: pt } }))}
                handle={canvas}
                ariaLabel={`知识地图：${d.shown.nodes.length} 个节点、${d.shown.links.length} 条关系、${d.communities.length} 个社区。方向键在相邻节点间移动，Enter 打开原文。`}
              />
            )}
            {d.shown.nodes.length && !d.layoutDone ? (
              <span className="layout-state" role="status">
                正在布局…
              </span>
            ) : null}
          </div>
          <PathBar d={d} onPick={pick} />
          <div className="map-footer">
            <span id="map-keys">
              <i className="key shape-file" /> 文件 <i className="key shape-symbol" /> 符号 <i className="key shape-section" /> 章节 <i className="key shape-concept" /> 术语 · 虚线为推断关系 · 拖动节点可固定，Alt＋方向键微调
            </span>
            <span>
              {d.shown.nodes.length} 节点 · {d.shown.links.length} 关系 · {d.communities.length} 社区
            </span>
          </div>
        </section>
        <Inspector d={d} />
      </main>
      <FileMenu d={d} open={menu} onClose={() => setMenu(false)} />
      <ExportMenu d={d} open={exporting} onClose={() => setExporting(false)} />
      <JsonDialog d={d} />
      <HostDialog d={d} open={hostOpen} onClose={() => setHostOpen(false)} />
    </div>
  );
}

function SearchBox({ d, onPick }: { d: Desk; onPick: (id: string) => void }) {
  const [open, setOpen] = useState(false);
  const results = d.matches?.slice(0, 40) ?? [];
  return (
    <div className="search" onBlur={(e) => !e.currentTarget.contains(e.relatedTarget) && setOpen(false)}>
      <label>
        <Search size={15} aria-hidden="true" />
        <span className="sr-only">搜索节点</span>
        <input
          type="search"
          name="search"
          disabled={!d.mutable}
          autoComplete="off"
          spellCheck={false}
          placeholder="搜索符号、章节、术语或文件…"
          value={d.query}
          aria-expanded={open && !!d.query}
          aria-controls="search-results"
          onFocus={() => setOpen(true)}
          onChange={(e) => {
            d.setQuery(e.target.value);
            d.setTextHits(null);
            setOpen(true);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && results[0]) {
              onPick(results[0].id);
              setOpen(false);
            } else if (e.key === "Escape") {
              if (d.query) d.setQuery("");
              setOpen(false);
            }
          }}
        />
      </label>
      {open && d.query.trim() ? (
        <div className="search-results" id="search-results">
          <p className="muted">
            {d.matches?.length ?? 0} 个节点匹配{d.matches && d.matches.length > 40 ? "，显示前 40 个" : ""}
          </p>
          <ul>
            {results.map((n) => (
              <li key={n.id}>
                <button
                  onClick={() => {
                    onPick(n.id);
                    setOpen(false);
                  }}
                >
                  <span className="swatch" style={{ background: colorOf(communityOf(n)) }} aria-hidden="true" />
                  <span>{label(n)}</span>
                  <small>{field(n, "source_file") || "外部"}</small>
                </button>
              </li>
            ))}
          </ul>
          <button className="ghost full" disabled={!d.mutable || !d.p.data.corpus.length} onClick={() => void d.searchText()}>
            在 {d.p.data.corpus.length} 份原文中搜索“{d.query.trim()}”
          </button>
          {d.textHits && d.textHits.query === d.query.trim() ? (
            <>
              <p className="muted">
                原文中 {d.textHits.total} 处{d.textHits.total > d.textHits.hits.length ? `，显示前 ${d.textHits.hits.length} 处` : ""}
              </p>
              <ul className="text-hits">
                {d.textHits.hits.map((h, i) => (
                  <li key={i}>
                    <button
                      onClick={() => {
                        d.openFileAt(h.path, h.line);
                        setOpen(false);
                      }}
                    >
                      <code>
                        {h.path}:{h.line}
                      </code>
                      <span>{h.text}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function MapToolbar({ d, canvas }: { d: Desk; canvas: React.RefObject<CanvasHandle | null> }) {
  const hiddenCount = d.p.data.hidden.length;
  return (
    <div className="map-toolbar">
      <div className="map-title">
        <h1>{d.p.title || "知识地图"}</h1>
        <span>
          {hiddenCount ? `已隐藏 ${hiddenCount} 个社区 · ` : ""}
          {d.matches ? `${d.matches.length} 个检索结果高亮 · ` : ""}
          {d.p.data.corpus.length} 份资料
        </span>
      </div>
      <div className="map-controls" role="group" aria-label="地图视图">
        <button className="icon" aria-label="放大" onClick={() => canvas.current?.zoomBy(1.25)}>
          <ZoomIn size={16} aria-hidden="true" />
        </button>
        <button className="icon" aria-label="缩小" onClick={() => canvas.current?.zoomBy(0.8)}>
          <ZoomOut size={16} aria-hidden="true" />
        </button>
        <button className="icon" aria-label="适配视野" onClick={() => canvas.current?.fit()}>
          <Maximize2 size={16} aria-hidden="true" />
        </button>
        <button onClick={d.relayout} disabled={!d.shown.nodes.length} title="清除固定位置并重新计算力导向布局">
          <Shuffle size={14} aria-hidden="true" />
          重新布局
        </button>
      </div>
    </div>
  );
}

function PathBar({ d, onPick }: { d: Desk; onPick: (id: string) => void }) {
  const { from, to } = d.p.data;
  const set = (patch: Partial<typeof d.p.data>) => d.p.setData((x) => ({ ...x, ...patch }));
  return (
    <div className="path-bar" aria-label="路径查找" role="group">
      <span className="path-end">
        起点
        {from && d.byId.get(from) ? (
          <button className="chip" onClick={() => onPick(from)}>
            {label(d.byId.get(from))}
          </button>
        ) : (
          <em>在详情中“设为起点”</em>
        )}
        {from ? (
          <button className="icon" aria-label="清除起点" onClick={() => set({ from: "" })}>
            <X size={12} aria-hidden="true" />
          </button>
        ) : null}
      </span>
      <button className="icon" aria-label="交换起点与终点" disabled={!from && !to} onClick={() => set({ from: to, to: from })}>
        <ArrowLeftRight size={14} aria-hidden="true" />
      </button>
      <span className="path-end">
        终点
        {to && d.byId.get(to) ? (
          <button className="chip" onClick={() => onPick(to)}>
            {label(d.byId.get(to))}
          </button>
        ) : (
          <em>“设为终点”</em>
        )}
        {to ? (
          <button className="icon" aria-label="清除终点" onClick={() => set({ to: "" })}>
            <X size={12} aria-hidden="true" />
          </button>
        ) : null}
      </span>
      <label className="check">
        <input type="checkbox" name="ignoreDirection" checked={d.p.data.ignoreDirection} onChange={(e) => set({ ignoreDirection: e.target.checked })} />
        忽略方向
      </label>
      <span className="path-result" role="status">
        {from && to && d.byId.get(from) && d.byId.get(to) ? (
          d.path.length ? (
            <>
              <b>{d.path.length - 1} 步</b>
              <span className="steps">
                {d.path.map((s, i) => (
                  <span key={s.id + i} className="step">
                    {s.via ? (
                      <small>
                        {s.reversed ? "←" : ""}
                        {RELATION_NAMES[String(s.via.relation)] ?? String(s.via.relation ?? "")}
                        {s.reversed ? "" : "→"}
                      </small>
                    ) : null}
                    <button onClick={() => onPick(s.id)}>{label(d.byId.get(s.id))}</button>
                  </span>
                ))}
              </span>
            </>
          ) : (
            <>
              未找到可达路径
              {!d.p.data.ignoreDirection ? "，可勾选“忽略方向”" : ""}
            </>
          )
        ) : (
          <span className="muted">
            选两个节点查看它们之间的最短关系链 <ArrowRight size={12} aria-hidden="true" />
          </span>
        )}
      </span>
    </div>
  );
}

function EmptyMap({ d }: { d: Desk }) {
  const [over, setOver] = useState(false);
  const busy = !!d.progress || !d.mutable;
  return (
    <div
      className={`empty-map${over ? " over" : ""}`}
      onDragOver={(e) => {
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={async (e) => {
        e.preventDefault();
        setOver(false);
        if (!busy) void d.addFiles(await readDrop(e.dataTransfer));
      }}
    >
      <h2>把资料拖到这里</h2>
      <p>一个代码仓库或文档文件夹，或者几份 Markdown、文本与源码。在本机抽取符号、引用、标题、链接与术语，再按社区着色。</p>
      <div className="drop-actions">
        <label className={`button primary${busy ? " disabled" : ""}`}>
          <FolderOpen size={16} aria-hidden="true" />
          选择文件夹…
          <input
            type="file"
            className="sr-only"
            multiple
            disabled={busy}
            {...({ webkitdirectory: "" } as Record<string, string>)}
            onChange={async (e) => {
              const list = e.target.files;
              if (list?.length) void d.addFiles(await readFileList(list));
              e.target.value = "";
            }}
          />
        </label>
        <label className={`button${busy ? " disabled" : ""}`}>
          <FilePlus2 size={16} aria-hidden="true" />
          选择文件…
          <input
            type="file"
            className="sr-only"
            multiple
            disabled={busy}
            onChange={async (e) => {
              const list = e.target.files;
              if (list?.length) void d.addFiles(await readFileList(list));
              e.target.value = "";
            }}
          />
        </label>
        <button disabled={busy} onClick={() => void d.openSample()}>
          打开示例资料集
        </button>
        <button disabled={busy} onClick={() => d.file.current?.click()}>
          导入 graph.json…
        </button>
      </div>
      {d.progress ? (
        <p className="progress" role="status">
          {d.progress.phase}… {d.progress.total > 1 ? `${d.progress.done}/${d.progress.total}` : ""}
        </p>
      ) : null}
    </div>
  );
}
