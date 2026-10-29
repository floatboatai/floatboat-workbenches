import { useEffect, useMemo, useRef, useState } from "react";
import { BookOpen, ChevronDown, FileDown, FileJson, Focus, Minus, Plus, Redo2, Undo2 } from "lucide-react";
import { NativeBench, type BenchHandle } from "./NativeBench";
import { useProjects, Notice, download } from "./workspace";
import { Shelf } from "./Shelf";
import { Readouts } from "./Readouts";
import { Inspector, type InspectorTab } from "./Inspector";
import { ExperimentBook, type BookPage } from "./ExperimentBook";
import { traceStore, idleTrace } from "./trace-store";
import { loadOptics } from "./engine";
import { seed, validateOptics, restoreOptics, sceneValue, importOptics, qualityBudgets, viewModes, type Optics, type Quality } from "../contracts/optics";
import type { Example } from "../contracts/examples";
import { isRecord } from "../contracts/project";

const blankScene = JSON.stringify({ version: 5, name: "空白光学平台", objs: [], showGrid: true, gridSize: 20, rayModeDensity: 0.2 }, null, 2);
function fieldDrafts(value: unknown): Record<string, string> {
  if (!isRecord(value) || isRecord(value.values)) return {};
  return Object.fromEntries(Object.entries(value).filter((e): e is [string, string] => typeof e[1] === "string"));
}
const fileName = (title: string, ext: string) => (title.replace(/[\\/:*?"<>|]+/g, " ").trim() || "光路实验") + ext;

/** Upstream JSON older than version 5 is upgraded by the upstream Scene (versionUpdate). */
async function upgradeScene(raw: unknown): Promise<unknown> {
  if (!isRecord(raw) || raw.format === "ray-optics-workbench" || isRecord(raw.snapshot)) return raw;
  if (typeof raw.version === "number" && raw.version >= 5) return raw;
  if (!Array.isArray(raw.objs) && !Array.isArray(raw.obj)) return raw;
  const { Scene } = await loadOptics();
  const scene = new Scene();
  scene.loadJSON(JSON.stringify(raw), () => {});
  if (scene.error) throw Error("无法升级旧版场景：" + scene.error.replace(/<[^>]+>/g, ""));
  return JSON.parse(scene.toJSON());
}

export function App() {
  const p = useProjects(seed, validateOptics, "凸透镜 · 平行光会聚", {
    storageKey: "ray-optics-v07",
    restoreDraftData: restoreOptics,
  });
  const bench = useRef<BenchHandle>(null),
    book = useRef<HTMLDialogElement>(null),
    bookButton = useRef<HTMLButtonElement>(null),
    transitionRef = useRef(false),
    fitNext = useRef(false);
  const [transitioning, setTransitioning] = useState(false),
    [ready, setReady] = useState(false),
    [tick, setTick] = useState(0),
    [bookOpen, setBookOpen] = useState(false),
    [bookPage, setBookPage] = useState<BookPage>("examples"),
    [tab, setTab] = useState<InspectorTab>("element"),
    [advanced, setAdvanced] = useState(false);
  const locked = p.loading || p.busy || transitioning;
  const selected = typeof p.draft.selected === "number" ? p.draft.selected : -1;
  const drafts = fieldDrafts(p.draft.parameters);
  const legacyDraft = isRecord(p.draft.parameters) && isRecord(p.draft.parameters.values);
  const rawDraft = typeof p.draft.raw === "string" ? p.draft.raw : null;
  const { scene, parseError } = useMemo(() => {
    try {
      return { scene: sceneValue(p.data.scene), parseError: "" };
    } catch (e) {
      return { scene: null, parseError: e instanceof Error ? e.message : "场景无效" };
    }
  }, [p.data.scene]);
  // tick/data changes re-read the native element (derived values such as focal lengths move with drags).
  const inspection = useMemo(
    () => (ready && !locked ? (bench.current?.inspect(selected, advanced) ?? null) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [tick, selected, advanced, p.documentKey, ready, locked, p.data.scene],
  );
  useEffect(() => {
    document.title = p.title + " · 光路实验台";
  }, [p.title]);
  useEffect(() => {
    setReady(false);
    traceStore.set(idleTrace);
  }, [p.documentKey]);
  // Examples and imports are framed to the current bench once, like upstream's gallery opening.
  useEffect(() => {
    if (!ready || locked || !fitNext.current) return;
    fitNext.current = false;
    try {
      bench.current?.fit();
    } catch {
      /* the bench re-frames on the next open */
    }
  }, [ready, locked]);

  function act(action: () => void) {
    try {
      if (transitionRef.current) return;
      action();
    } catch (e) {
      p.report(e);
    }
  }
  function setDraftKey(key: string, value: unknown) {
    p.setDraft((extra) => {
      if (extra[key] === value) return extra;
      const next = { ...extra };
      if (value === undefined) delete next[key];
      else next[key] = value;
      return next;
    });
  }
  function setFieldDraft(key: string, value: string | null) {
    p.setDraft((extra) => {
      const current = fieldDrafts(extra.parameters);
      if (value === null ? !(key in current) : current[key] === value) return extra;
      const nextDrafts = { ...current };
      if (value === null) delete nextDrafts[key];
      else nextDrafts[key] = value;
      const next = { ...extra };
      if (Object.keys(nextDrafts).length) next.parameters = nextDrafts;
      else delete next.parameters;
      return next;
    });
  }
  async function transition(action: () => Promise<boolean>) {
    if (transitionRef.current) return false;
    transitionRef.current = true;
    setTransitioning(true);
    const resume = bench.current?.suspend();
    let moved = false;
    try {
      moved = await action();
    } catch (e) {
      p.report(e);
    } finally {
      if (!moved) resume?.();
      transitionRef.current = false;
      setTransitioning(false);
    }
    if (moved) book.current?.close();
    return moved;
  }
  function openBook(page: BookPage) {
    setBookPage(page);
    setBookOpen(true);
    book.current?.showModal();
  }
  function openExample(e: Example) {
    const data: Optics = { scene: JSON.stringify(JSON.parse(e.scene), null, 2), notes: "", original: "", originalName: "", quality: "standard", example: e.id };
    fitNext.current = true;
    void transition(() => p.replace(data, e.title)).then((moved) => {
      if (!moved) fitNext.current = false;
    });
  }
  async function importFile(file: File) {
    await transition(async () => {
      if (file.size > 12 * 1024 * 1024) throw Error("文件超过 12 MiB，请先拆分场景。");
      const content = await file.text();
      try {
        const value = importOptics(await upgradeScene(JSON.parse(content)), file.name);
        fitNext.current = true;
        const moved = await p.replace(value.data, value.title, value.extra);
        if (!moved) fitNext.current = false;
        return moved;
      } catch (error) {
        if (new TextEncoder().encode(content).length <= 850000) {
          setDraftKey("raw", content);
          setTab("scene");
          p.setNotice("文件未能载入，原文已放入“场景 → 原生场景 JSON”，可修改后应用或下载；当前实验未被替换。");
        } else p.setNotice("原文件未导入，请保留本地文件；当前实验未被替换。");
        throw error;
      }
    });
  }
  function exportProject() {
    act(() => {
      const body = { title: p.title, data: p.data, extra: p.draft };
      if (new TextEncoder().encode(JSON.stringify(body)).length > 1950000) throw Error("实验工作稿超过 1.95 MB，请先导出恢复稿并拆分。");
      download(new Blob([JSON.stringify({ format: "ray-optics-workbench", ...body }, null, 2)], { type: "application/json" }), fileName(p.title, ".project.json"));
    });
  }
  async function exportPng() {
    try {
      if (!bench.current) throw Error("光学平台尚未就绪。");
      const { blob, partial } = await bench.current.png();
      download(blob, fileName(p.title, ".png"));
      p.setNotice(partial ? "已导出 PNG；光线达到质量上限或被停止，图像为当前已追踪部分。" : "已导出当前光路 PNG。");
    } catch (e) {
      p.report(e);
    }
  }
  const mode = String(scene?.mode ?? "rays");
  const saveText = transitioning ? "正在保存并切换实验…" : p.loading ? "正在恢复实验…" : p.autoState.message;

  return (
    <main className="app" aria-busy={transitioning}>
      <a className="skip" href="#optical-bench">
        跳到光学平台
      </a>
      <header className="rim">
        <button ref={bookButton} type="button" className="book-trigger" aria-haspopup="dialog" aria-expanded={bookOpen} disabled={transitioning} onClick={() => openBook("examples")}>
          <BookOpen size={17} aria-hidden="true" />
          实验
          <ChevronDown size={13} aria-hidden="true" />
        </button>
        <div className="caption">
          <span>RAY OPTICS</span>
          <input aria-label="实验名称" className="title" name="experimentTitle" autoComplete="off" maxLength={120} value={p.title} disabled={locked} onChange={(e) => p.setTitle(e.target.value)} />
        </div>
        <span className="save-state" role="status" data-phase={p.autoState.phase}>
          {saveText}
        </span>
        {p.autoState.phase === "conflict" && p.current ? (
          <span className="conflict">
            <button type="button" onClick={() => p.exportDraft()}>
              导出恢复稿
            </button>
            <button type="button" onClick={() => void transition(() => p.open(p.current!.id))}>
              打开服务器版本
            </button>
          </span>
        ) : null}
      </header>
      <Notice error={p.error} notice={p.notice} />
      <div className="station">
        <Shelf disabled={locked || !ready} onAdd={(type) => act(() => bench.current?.add(type))} />
        <section className="stage" aria-label="光学平台">
          <div className="stagebar" role="toolbar" aria-label="平台工具">
            <div className="segmented" role="group" aria-label="视图模式">
              {Object.entries(viewModes).map(([id, label]) => (
                <button key={id} type="button" aria-pressed={mode === id} disabled={locked || !ready} onClick={() => act(() => bench.current?.setScene({ mode: id }))}>
                  {label}
                </button>
              ))}
            </div>
            <button
              type="button"
              className="toggle"
              aria-pressed={Boolean(scene?.simulateColors)}
              disabled={locked || !ready}
              title="按波长模拟颜色：色散、光栅和彩色光源"
              onClick={() => act(() => bench.current?.setScene({ simulateColors: !scene?.simulateColors }))}
            >
              <span className="spectrum" aria-hidden="true" />
              波长色彩
            </button>
            <label className="quality" title="质量决定每次重绘最多追踪的光线段数，拖动时始终实时预览">
              <span className="sr-only">追踪质量</span>
              <select value={p.data.quality} disabled={locked} onChange={(e) => p.setData((v) => ({ ...v, quality: e.target.value as Quality }))}>
                {Object.entries(qualityBudgets).map(([id, q]) => (
                  <option key={id} value={id}>
                    质量：{q.label} · {(q.rays / 10000).toLocaleString("zh-CN")} 万段
                  </option>
                ))}
              </select>
            </label>
            <span className="spacer" />
            <div className="tool-group">
              <button type="button" className="icon" aria-label="撤销" title="撤销（Ctrl/⌘+Z）" disabled={locked || !ready} onClick={() => act(() => bench.current?.undo())}>
                <Undo2 size={16} aria-hidden="true" />
              </button>
              <button type="button" className="icon" aria-label="重做" title="重做（Shift+Ctrl/⌘+Z）" disabled={locked || !ready} onClick={() => act(() => bench.current?.redo())}>
                <Redo2 size={16} aria-hidden="true" />
              </button>
              <button type="button" className="icon" aria-label="缩小" title="缩小" disabled={locked || !ready} onClick={() => act(() => bench.current?.zoom(0.8))}>
                <Minus size={16} aria-hidden="true" />
              </button>
              <button type="button" className="icon" aria-label="放大" title="放大" disabled={locked || !ready} onClick={() => act(() => bench.current?.zoom(1.25))}>
                <Plus size={16} aria-hidden="true" />
              </button>
              <button type="button" className="icon" aria-label="适配视图" title="适配视图" disabled={locked || !ready} onClick={() => act(() => bench.current?.fit())}>
                <Focus size={16} aria-hidden="true" />
              </button>
            </div>
            <div className="tool-group">
              <button type="button" disabled={locked || !ready} onClick={() => void exportPng()}>
                <FileDown size={16} aria-hidden="true" />
                PNG
              </button>
              <button
                type="button"
                disabled={locked || Boolean(parseError)}
                title="导出上游兼容的场景 JSON"
                onClick={() => download(new Blob([p.data.scene], { type: "application/json" }), fileName(p.title, ".json"))}
              >
                <FileJson size={16} aria-hidden="true" />
                JSON
              </button>
            </div>
          </div>
          <div className="bench-frame" id="optical-bench">
            {p.loading ? (
              <div className="loading" role="status">
                正在打开实验…
              </div>
            ) : (
              <NativeBench
                ref={bench}
                documentKey={p.documentKey}
                source={p.data.scene}
                quality={p.data.quality}
                disabled={locked}
                selected={selected}
                onScene={(source) => {
                  p.setData((v) => ({ ...v, scene: source }));
                  setTick((t) => t + 1);
                }}
                onSelection={(n) => {
                  setDraftKey("selected", n);
                  setTick((t) => t + 1);
                  if (n >= 0) setTab("element");
                }}
                onChange={() => setTick((t) => t + 1)}
                onTrace={(t) => {
                  traceStore.set(t);
                  if (t.phase !== "loading") setReady(true);
                }}
                onError={p.report}
              />
            )}
          </div>
          {parseError ? (
            <p className="notice error" role="alert">
              {parseError} 请在“场景 → 原生场景 JSON”中修复，或导出恢复稿。
            </p>
          ) : null}
          <Readouts quality={p.data.quality} onSelect={(i) => act(() => bench.current?.select(i))} onStop={() => bench.current?.stop()} />
        </section>
        <Inspector
          bench={bench}
          inspection={inspection}
          scene={scene}
          selected={selected}
          locked={locked || !ready}
          tab={tab}
          setTab={setTab}
          advanced={advanced}
          setAdvanced={setAdvanced}
          drafts={drafts}
          legacyDraft={legacyDraft ? JSON.stringify((p.draft.parameters as Record<string, unknown>).values) : ""}
          setFieldDraft={setFieldDraft}
          clearDrafts={() => setDraftKey("parameters", undefined)}
          act={act}
          raw={rawDraft ?? p.data.scene}
          rawPending={rawDraft !== null && rawDraft !== p.data.scene}
          setRaw={(v) => setDraftKey("raw", v)}
          applyRaw={() =>
            act(() => {
              const source = rawDraft ?? p.data.scene;
              validateOptics({ ...p.data, scene: source });
              p.setData((v) => ({ ...v, scene: source }));
              setDraftKey("raw", undefined);
              p.setNotice("原生场景已应用。");
            })
          }
          downloadRaw={() => download(new Blob([rawDraft ?? p.data.scene], { type: "application/json" }), "原生场景输入.json")}
          notes={p.data.notes}
          setNotes={(v) => p.setData((d) => ({ ...d, notes: v }))}
          original={
            p.data.original
              ? {
                  name: p.data.originalName,
                  download: () => download(new Blob([p.data.original], { type: "application/json" }), p.data.originalName || "导入原件.json"),
                }
              : null
          }
        />
      </div>
      <ExperimentBook
        ref={book}
        page={bookPage}
        setPage={setBookPage}
        open={bookOpen}
        locked={locked}
        items={p.items}
        currentId={p.current?.id}
        currentExample={p.data.example}
        onClose={() => {
          setBookOpen(false);
          bookButton.current?.focus();
        }}
        onExample={openExample}
        onBlank={() =>
          void transition(() => p.replace({ scene: blankScene, notes: "", original: "", originalName: "", quality: "standard", example: "" }, "空白光学平台"))
        }
        onOpen={(id) => void transition(() => p.open(id))}
        onImport={(f) => void importFile(f)}
        onExportProject={exportProject}
        onExportRecovery={() => p.exportDraft()}
        onRetrySave={() => void p.save()}
        onDelete={() => {
          if (confirm("删除这个实验及其保存记录？")) void transition(() => p.remove());
        }}
      />
    </main>
  );
}
