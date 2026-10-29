// ABOUTME: 乐谱审校台：宽幅谱面（光标、回放、批注标记）与右侧批注账本，文件生命周期在乐谱库菜单中。
import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useWorkbenchState } from "./autosave-client";
import { download, Notice, RenderBoundary } from "./workspace";
import { FileMenu } from "./FileMenu";
import { Ledger, locationLabel, type LedgerFilter, type NumberedAnnotation } from "./Ledger";
import { ScoreToolbar, type ExportKind } from "./ScoreToolbar";
import { formatBytes, loadMusicXml, loadOriginal, MissingSourceError, uploadSource } from "./sources";
import {
  ANNOTATION_KINDS,
  defaultView,
  MAX_ANNOTATIONS,
  newProject,
  orderAnnotations,
  restoreScoreDraft,
  validateScore,
  type Annotation,
  type Beat,
  type Focus,
  type ScoreProject,
  type ViewSettings,
} from "../contracts/domain";
import { reviewReport } from "../contracts/report";
import { sampleProject, seedProject, type Sample } from "../contracts/samples";
import type { ScoreHandle, RenderState } from "../score/ScoreView";
import type { Hit, OverlayModel } from "../score/engine";

const ScoreView = lazy(() => import("../score/ScoreView").then((module) => ({ default: module.ScoreView })));
const SEED = seedProject();
const SEED_TITLE = "小步舞曲 G 大调 · 排练前校对";

interface LoadedScore {
  id: string;
  xml?: string;
  error?: string;
  missing?: boolean;
}

export function App() {
  const p = useWorkbenchState<ScoreProject>(SEED, validateScore, SEED_TITLE, { storageKey: "opensheetmusicdisplay", restoreDraftData: restoreScoreDraft });
  const { data } = p;
  const { index } = data;
  const [score, setScore] = useState<LoadedScore>({ id: "" });
  const [reload, setReload] = useState(0);
  const [render, setRender] = useState<RenderState>({ phase: "loading", message: "正在读取乐谱原件…", pages: 0 });
  const [playhead, setPlayhead] = useState<{ measureIndex: number; beat: Beat } | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [filter, setFilter] = useState<LedgerFilter>("all");
  const [working, setWorking] = useState("");
  const [exporting, setExporting] = useState("");
  const upload = useRef<HTMLInputElement>(null);
  const view = useRef<ScoreHandle>(null);
  const list = useRef<HTMLOListElement>(null);
  const paper = useRef<HTMLDivElement>(null);

  const locked = p.busy || p.loading || !!working;
  const fileBase = (p.title.trim() || index.title).replace(/[\\/:*?"<>|]/g, "_").slice(0, 80) || "乐谱审校";

  // 原件：按内容标识读取 MusicXML 文本。
  useEffect(() => {
    let active = true;
    const id = data.source.id;
    setScore({ id });
    setRender({ phase: "loading", message: "正在读取乐谱原件…", pages: 0 });
    loadMusicXml(id).then(
      (xml) => active && setScore({ id, xml }),
      (error: unknown) =>
        active && setScore({ id, error: error instanceof Error ? error.message : "读取乐谱原件失败。", missing: error instanceof MissingSourceError }),
    );
    return () => {
      active = false;
    };
  }, [data.source.id, reload]);
  useEffect(() => {
    setSelectedId(null);
    setPlayhead(null);
  }, [p.documentKey]);

  const numbered = useMemo<NumberedAnnotation[]>(() => orderAnnotations(data).map((note, i) => ({ ...note, number: i + 1 })), [data.annotations, data.index]); // eslint-disable-line react-hooks/exhaustive-deps
  const overlay = useMemo<OverlayModel>(
    () => ({
      focus: data.focus,
      selectedId,
      markers: numbered.map((note) => ({
        id: note.id,
        number: note.number,
        partId: note.partId,
        measureIndex: note.measureIndex,
        beat: note.beat,
        resolved: note.resolved,
        label: `批注 ${note.number}（${ANNOTATION_KINDS[note.kind]}${note.resolved ? "，已核对" : ""}）${locationLabel(index, note.partId, note.measureIndex, note.beat)}：${note.text.slice(0, 80) || "空白"}`,
      })),
    }),
    [data.focus, numbered, selectedId, index],
  );

  const setView = useCallback((patch: Partial<ViewSettings>) => p.setData((value) => ({ ...value, view: { ...value.view, ...patch } })), [p.setData]); // eslint-disable-line react-hooks/exhaustive-deps
  const setFocus = useCallback(
    (focus: Focus) => p.setData((value) => (JSON.stringify(value.focus) === JSON.stringify(focus) ? value : { ...value, focus })),
    [p.setData], // eslint-disable-line react-hooks/exhaustive-deps
  );
  const visiblePart = (partId: string) =>
    data.view.hiddenParts.includes(partId) ? (index.parts.find((part) => !data.view.hiddenParts.includes(part.id))?.id ?? partId) : partId;

  const onPick = useCallback(
    (hit: Hit) => {
      setSelectedId(null);
      setFocus({ partId: hit.partId, measureIndex: hit.measureIndex, beat: hit.nearNote ? hit.beat : null });
    },
    [setFocus],
  );
  const select = useCallback(
    (id: string) => {
      const note = data.annotations.find((item) => item.id === id);
      if (!note) return;
      setSelectedId(id);
      setFocus({ partId: note.partId, measureIndex: note.measureIndex, beat: note.beat });
      requestAnimationFrame(() => view.current?.revealFocus());
    },
    [data.annotations, setFocus],
  );
  const onMarker = useCallback(
    (id: string) => {
      if (filter !== "all" && !numbered.find((note) => note.id === id && (filter === "open" ? !note.resolved : note.measureIndex === data.focus.measureIndex)))
        setFilter("all");
      select(id);
      requestAnimationFrame(() => list.current?.querySelector(`[data-entry="${id}"]`)?.scrollIntoView({ block: "nearest" }));
    },
    [filter, numbered, data.focus.measureIndex, select],
  );
  const onCursor = useCallback(
    (position: { measureIndex: number; beat: Beat }) => setFocus({ partId: visiblePart(data.focus.partId), ...position }),
    [setFocus, data.focus.partId, data.view.hiddenParts], // eslint-disable-line react-hooks/exhaustive-deps
  );

  function addNote() {
    if (data.annotations.length >= MAX_ANNOTATIONS) {
      p.setError(`最多 ${MAX_ANNOTATIONS} 条批注，请先整理已核对的记录。`);
      return;
    }
    const note: Annotation = {
      id: crypto.randomUUID(),
      partId: data.focus.partId,
      measureIndex: data.focus.measureIndex,
      beat: data.focus.beat,
      kind: "other",
      text: "",
      resolved: false,
      createdAt: new Date().toISOString(),
    };
    p.setData((value) => ({ ...value, annotations: [...value.annotations, note] }));
    setSelectedId(note.id);
    setTimeout(() => document.getElementById(`note-${note.id}`)?.focus(), 0);
  }
  const updateNote = useCallback(
    (id: string, patch: Partial<Pick<Annotation, "text" | "resolved" | "kind">>) =>
      p.setData((value) => ({ ...value, annotations: value.annotations.map((note) => (note.id === id ? { ...note, ...patch } : note)) })),
    [p.setData], // eslint-disable-line react-hooks/exhaustive-deps
  );
  const removeNote = useCallback(
    (id: string) => {
      p.setData((value) => ({ ...value, annotations: value.annotations.filter((note) => note.id !== id) }));
      setSelectedId((current) => (current === id ? null : current));
    },
    [p.setData], // eslint-disable-line react-hooks/exhaustive-deps
  );

  async function importFile(file: File) {
    setWorking("正在读取文件…");
    p.setError("");
    try {
      const { source, index: imported } = await uploadSource(file, setWorking);
      if (score.missing && source.id === data.source.id) {
        setReload((value) => value + 1);
        p.setNotice("已找回原件，审校与批注保持不变。");
        void p.save();
        return;
      }
      setWorking("正在试排前几小节…");
      const xml = await loadMusicXml(source.id);
      const { renderOffscreen } = await import("../score/engine");
      await renderOffscreen(xml, defaultView(), (container) => {
        if (!container.querySelector("svg path")) throw new Error("乐谱没有可显示的音符。");
      }, 8);
      const title = imported.title === "未命名乐谱" ? file.name.replace(/\.[^.]+$/, "") : imported.title;
      if (await p.replace(newProject(source, imported), `${title} · 审校`.slice(0, 120))) {
        setFilter("all");
        p.setNotice(
          `已导入 ${file.name}（${formatBytes(source.size)}，${imported.parts.length} 个声部、${imported.measures.length} 小节、${imported.notes.toLocaleString("zh-CN")} 个音符）${imported.warnings.length ? "；" + imported.warnings.join("，") : ""}。`,
        );
      }
    } catch (error) {
      p.report(error);
    } finally {
      setWorking("");
    }
  }
  async function openSample(sample: Sample) {
    const project = sampleProject(sample);
    if (await p.replace(project, `${project.index.title} · 审校`)) setFilter("all");
  }

  async function exportFile(kind: ExportKind) {
    setExporting("正在导出…");
    p.setError("");
    try {
      if (kind === "json") {
        download(new Blob([JSON.stringify(reviewReport(data, p.title), null, 2)], { type: "application/json" }), `${fileBase}-批注.json`);
      } else if (kind === "original") {
        download(await loadOriginal(data.source.id), data.source.fileName);
      } else if (kind === "musicxml") {
        download(new Blob([await loadMusicXml(data.source.id)], { type: "application/vnd.recordare.musicxml+xml" }), `${fileBase}.musicxml`);
      } else {
        const handle = view.current;
        if (!handle) throw new Error("请等待乐谱渲染完成。");
        const engine = await import("../score/engine");
        const exporter = await import("../score/exporter");
        if (kind === "svg") download(new Blob([engine.stackSvg(handle.snapshot())], { type: "image/svg+xml" }), `${fileBase}.svg`);
        else if (kind === "png") {
          const pages = handle.snapshot();
          const page = Math.min(handle.currentPage(), pages.length - 1);
          download(await exporter.pagePng(pages[page]), `${fileBase}${pages.length > 1 ? `-第${page + 1}页` : ""}.png`);
        } else {
          const report = reviewReport(data, p.title);
          let pages;
          if (data.view.layout === "page" || data.view.layout === "landscape") pages = handle.snapshot();
          else {
            setExporting("正在按 A4 分页排版…");
            const xml = await loadMusicXml(data.source.id);
            pages = await engine.renderOffscreen(xml, { ...data.view, layout: "page" }, (container, instance) => {
              engine.drawOverlay(container, instance, { ...overlay, selectedId: null });
              return engine.snapshotPages(container);
            });
          }
          download(await exporter.scorePdf(pages, report, setExporting), `${fileBase}-校样.pdf`);
        }
      }
    } catch (error) {
      p.report(error instanceof Error && /批注不能为空/.test(error.message) ? new Error("有空白批注：请填写内容或删除后再导出。") : error);
    } finally {
      setExporting("");
    }
  }

  function fitWidth() {
    const page = paper.current?.querySelector("svg");
    const width = paper.current?.clientWidth;
    if (!page || !width) return;
    const base = page.getBoundingClientRect().width / data.view.zoom;
    setView({ zoom: Math.round(Math.min(3, Math.max(0.3, (width - 40) / base)) * 20) / 20 });
  }

  function paperKeys(event: React.KeyboardEvent<HTMLDivElement>) {
    if ((event.target as Element).closest("input, textarea, select, button, .fb-mark")) return;
    const handle = view.current;
    if (!handle) return;
    if (event.key === "ArrowRight" || event.key === "ArrowLeft") {
      event.preventDefault();
      const direction = event.key === "ArrowRight" ? 1 : -1;
      if (event.shiftKey) handle.stepMeasure(direction);
      else handle.step(direction);
    } else if (event.key === " ") {
      event.preventDefault();
      void handle.togglePlay();
    } else if (event.key === "n" || event.key === "N") {
      event.preventDefault();
      addNote();
    }
  }
  useEffect(() => {
    const save = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "s") {
        event.preventDefault();
        void p.save();
      }
    };
    window.addEventListener("keydown", save);
    return () => window.removeEventListener("keydown", save);
  }, [p.save]); // eslint-disable-line react-hooks/exhaustive-deps

  const phase = p.autoState.phase;
  const credits = [index.composer, index.arranger].filter(Boolean).join(" · ");
  return (
    <main className="score-app">
      <a className="skip" href="#paper">
        跳到谱面
      </a>
      <header className="masthead">
        <div className="brand" aria-hidden="true">
          <span>𝄞</span>
          <b>谱校</b>
        </div>
        <FileMenu
          items={p.items}
          currentId={p.current?.id}
          locked={locked}
          conflict={phase === "conflict" && !!p.current}
          onImport={() => upload.current?.click()}
          onSample={(sample) => void openSample(sample)}
          onOpen={(id) => void p.open(id)}
          onOpenServer={() => p.current && void p.open(p.current.id)}
          onExportDraft={p.exportDraft}
          onDelete={() => void p.remove()}
        />
        <div className="document">
          <label className="sr-only" htmlFor="review-title">
            审校名称
          </label>
          <input id="review-title" name="reviewTitle" autoComplete="off" maxLength={120} value={p.title} disabled={p.loading} onChange={(event) => p.setTitle(event.target.value)} />
          <p className="meta">
            <span translate="no">{index.title}</span>
            {index.subtitle ? <span translate="no"> · {index.subtitle}</span> : null}
            {credits ? <span translate="no"> · {credits}</span> : null}
            <span>
              {" "}
              · {index.parts.length} 声部 · {index.measures.length} 小节 · {data.source.kind === "mxl" ? "MXL" : "MusicXML"} {formatBytes(data.source.size)}
            </span>
          </p>
        </div>
        <div className="save-state">
          <span role="status" data-autosave-phase={phase}>
            {working || p.autoState.message}
          </span>
          {phase === "offline" || phase === "conflict" ? (
            <button type="button" className="quiet" onClick={() => void p.save()}>
              重试保存
            </button>
          ) : null}
        </div>
      </header>
      <Notice
        error={p.error}
        notice={p.notice}
        onDismiss={() => {
          p.setError("");
          p.setNotice("");
        }}
      />
      <div className="desk">
        <section className="paper-desk" aria-label="谱面">
          <ScoreToolbar
            view={data.view}
            parts={index.parts}
            ready={render.phase === "ready" && !!score.xml}
            playing={!!playhead}
            canPlay={typeof window.AudioContext === "function"}
            exporting={exporting}
            mxl={data.source.kind === "mxl"}
            onView={setView}
            onStep={(direction) => view.current?.step(direction)}
            onMeasure={(direction) => view.current?.stepMeasure(direction)}
            onPlay={() => void view.current?.togglePlay()}
            onFit={fitWidth}
            onExport={(kind) => void exportFile(kind)}
          />
          <div id="paper" className="paper-scroll" ref={paper} tabIndex={0} aria-label="谱面：点击定位，方向键移动光标，空格回放" onKeyDown={paperKeys}>
            {score.error ? (
              <div className="paper-state error" role="alert">
                <p>{score.error}</p>
                {score.missing ? (
                  <>
                    <small>选择原文件 {data.source.fileName} 即可找回；批注与设置保持不变。</small>
                    <button type="button" className="primary" onClick={() => upload.current?.click()}>
                      选择原文件…
                    </button>
                  </>
                ) : (
                  <button type="button" onClick={() => setReload((value) => value + 1)}>
                    重新读取
                  </button>
                )}
              </div>
            ) : render.phase !== "ready" || !score.xml ? (
              <p className={`paper-state ${render.phase === "error" ? "error" : ""}`} role={render.phase === "error" ? "alert" : "status"}>
                {score.xml ? render.message : "正在读取乐谱原件…"}
              </p>
            ) : null}
            {score.xml && score.id === data.source.id ? (
              <RenderBoundary>
                <Suspense fallback={null}>
                  <ScoreView
                    key={p.documentKey + score.id}
                    ref={view}
                    xml={score.xml}
                    view={data.view}
                    overlay={overlay}
                    onPick={onPick}
                    onMarker={onMarker}
                    onCursor={onCursor}
                    onPlayhead={setPlayhead}
                    onRender={setRender}
                  />
                </Suspense>
              </RenderBoundary>
            ) : null}
          </div>
          <footer className="paper-foot">
            <span>
              {render.pages ? `${render.pages} 页 · ` : ""}
              {index.notes.toLocaleString("zh-CN")} 个音符
              {data.view.transpose ? ` · 已移调 ${data.view.transpose > 0 ? "+" : ""}${data.view.transpose}` : ""}
            </span>
            {index.rights ? <span translate="no">{index.rights}</span> : null}
          </footer>
        </section>
        <Ledger
          index={index}
          annotations={numbered}
          focus={data.focus}
          playhead={playhead}
          selectedId={selectedId}
          filter={filter}
          locked={locked}
          listRef={list}
          onFocus={(focus) => {
            setSelectedId(null);
            setFocus(focus);
            requestAnimationFrame(() => view.current?.revealFocus());
          }}
          onAdd={addNote}
          onSelect={select}
          onUpdate={updateNote}
          onRemove={removeNote}
          onFilter={setFilter}
        />
      </div>
      <input
        type="file"
        ref={upload}
        className="sr-only"
        tabIndex={-1}
        aria-label="选择乐谱文件"
        accept=".musicxml,.xml,.mxl,application/vnd.recordare.musicxml,application/vnd.recordare.musicxml+xml"
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (file) void importFile(file);
        }}
      />
    </main>
  );
}
