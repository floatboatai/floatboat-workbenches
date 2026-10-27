import { MeasureIndex } from "./MeasureIndex";
import { reviewReport } from "../contracts/report";
import { AnnotationBook } from "./AnnotationBook";
import { lazy, Suspense, useMemo, useRef, useState } from "react";
import { seed } from "../contracts/seed";
import { inspectScore } from "../contracts/musicxml";
import {
  validateScore,
  originalBytes,
  type ScoreProject,
} from "../contracts/domain";
import {
  download,
  Notice,
  ProjectPicker,
  RenderBoundary,
  useProjects,
} from "./workspace";
const ScoreView = lazy(() =>
  import("../score/ScoreView").then((module) => ({
    default: module.ScoreView,
  })),
);
export function App() {
  const p = useProjects<ScoreProject>(seed, validateScore, "晨间练习 · 审校");
  const [importing, setImporting] = useState(false),
    [svg, setSvg] = useState(""),
    [allNotes, setAllNotes] = useState(false),
    [exporting, setExporting] = useState(false);
  const upload = useRef<HTMLInputElement>(null),
    notes = useRef<HTMLElement>(null);
  const info = useMemo(
    () => inspectScore(p.data.source.xml),
    [p.data.source.xml],
  );
  const part =
      info.parts.find((item) => item.id === p.data.focus.partId) ??
      info.parts[0],
    measureIndex = Math.min(
      p.data.focus.measureIndex,
      part.measures.length - 1,
    ),
    locationNotes = p.data.annotations.filter(
      (note) => note.partId === part.id && note.measureIndex === measureIndex,
    );
  const locked = p.busy || p.loading || importing || exporting;
  const fileBase = p.title.replace(/[\\/:*?"<>|]/g, "_") || "乐谱审校";
  async function importFile(file: File) {
    if (file.size > 200000) {
      p.setError("原文件不能超过 200 KB，请导出短谱或分段审阅。");
      return;
    }
    if (p.dirty && !confirm("导入会替换当前未保存的原件与批注，是否继续？"))
      return;
    setImporting(true);
    p.setError("");
    try {
      const [{ importScore }, { trialRender }] = await Promise.all([
        import("../contracts/archive"),
        import("../score/engine"),
      ]);
      const source = await importScore(
        new Uint8Array(await file.arrayBuffer()),
        file.name,
      );
      await trialRender(source.xml);
      const next = validateScore({
        source,
        partId: "",
        layout: "page",
        zoom: 0.85,
        annotations: [],
        focus: {
          partId: inspectScore(source.xml).parts[0].id,
          measureIndex: 0,
        },
      });
      p.setData(next);
      p.setTitle(inspectScore(source.xml).title.slice(0, 120));
      setSvg("");
      setAllNotes(false);
    } catch (error) {
      p.report(error);
    } finally {
      setImporting(false);
    }
  }
  function addNote() {
    if (p.data.annotations.length >= 100) {
      p.setError("最多支持 100 条批注，请整理后继续。");
      return;
    }
    p.setData((data) => ({
      ...data,
      annotations: [
        ...data.annotations,
        {
          id: crypto.randomUUID(),
          partId: part.id,
          measureIndex,
          text: "",
          resolved: false,
        },
      ],
    }));
    setAllNotes(false);
    setTimeout(() => {
      const fields = notes.current?.querySelectorAll("textarea");
      fields?.[fields.length - 1]?.focus();
    }, 0);
  }
  function updateNote(
    id: string,
    patch: { text?: string; resolved?: boolean },
  ) {
    p.setData((data) => ({
      ...data,
      annotations: data.annotations.map((note) =>
        note.id === id ? { ...note, ...patch } : note,
      ),
    }));
  }
  function removeNote(id: string) {
    if (!confirm("删除这条批注？")) return;
    p.setData((data) => ({
      ...data,
      annotations: data.annotations.filter((note) => note.id !== id),
    }));
  }
  async function exportReport() {
    setExporting(true);
    p.setError("");
    try {
      const report = await reviewReport(p.data, p.title);
      download(
        new Blob([JSON.stringify(report, null, 2)], {
          type: "application/json",
        }),
        fileBase + "-review.json",
      );
    } catch (error) {
      p.report(error);
    } finally {
      setExporting(false);
    }
  }
  function selectLocation(partId: string, measureIndex: number) {
    p.setData((data) => ({ ...data, focus: { partId, measureIndex } }));
    setAllNotes(false);
  }
  function newScore() {
    if (p.fresh()) {
      setAllNotes(false);
    }
  }
  return (
    <main className="score-app">
      <a className="skip" href="#score-content">
        跳到乐谱与批注
      </a>
      <header className="masthead">
        <div className="brand">
          <span aria-hidden="true">𝄞</span>
          <div>
            <p>SCORE READING ROOM</p>
            <h1>乐谱审校室</h1>
          </div>
        </div>
        <div className="project-actions">
          <ProjectPicker
            items={p.items}
            id={p.current?.id}
            disabled={locked}
            onOpen={(id) => void p.open(id)}
          />
          <button disabled={locked} onClick={newScore}>
            新建审校
          </button>
          <button
            disabled={locked || !p.current}
            onClick={() => void p.remove()}
          >
            删除项目
          </button>
        </div>
      </header>
      <section className="document-heading">
        <div>
          <label htmlFor="project-title">审校项目</label>
          <input
            id="project-title"
            name="projectTitle"
            autoComplete="off"
            value={p.title}
            maxLength={120}
            disabled={locked}
            onChange={(event) => p.setTitle(event.target.value)}
          />
          <p>
            {info.composer || "未注明作者"} <span aria-hidden="true">/</span>{" "}
            {info.parts.length} 个声部 · 最长 {info.measureCount} 小节
          </p>
        </div>
        <div className="save-area">
          <span role="status">
            {importing
              ? "正在检查并试排…"
              : p.busy
                ? "正在保存…"
                : p.dirty
                  ? "有未保存修改"
                  : p.current
                    ? "已保存"
                    : "原创示例 · 未保存"}
          </span>
          <button
            className="primary"
            disabled={locked}
            onClick={() => void p.save()}
          >
            保存审校
          </button>
        </div>
      </section>
      <Notice error={p.error} notice={p.notice} />
      <section className="file-toolbar" aria-label="乐谱文件操作">
        <div>
          <button disabled={locked} onClick={() => upload.current?.click()}>
            {importing ? "正在导入…" : "导入乐谱"}
          </button>
          <span className="source-name" title={p.data.source.fileName}>
            {p.data.source.fileName}
          </span>
          <small>UTF-8 MusicXML / MXL · 原文件 ≤200 KB</small>
        </div>
        <div>
          <button
            disabled={locked || !svg}
            onClick={() =>
              download(
                new Blob([svg], { type: "image/svg+xml" }),
                fileBase + ".svg",
              )
            }
          >
            导出 SVG
          </button>
          <button
            disabled={locked}
            onClick={() =>
              download(
                new Blob([new Uint8Array(originalBytes(p.data.source))], {
                  type:
                    p.data.source.kind === "mxl"
                      ? "application/vnd.recordare.musicxml"
                      : "application/vnd.recordare.musicxml+xml",
                }),
                p.data.source.fileName,
              )
            }
          >
            导出原文件
          </button>
          {p.data.source.kind === "mxl" ? (
            <button
              disabled={locked}
              onClick={() =>
                download(
                  new Blob([p.data.source.xml], {
                    type: "application/vnd.recordare.musicxml+xml",
                  }),
                  fileBase + ".musicxml",
                )
              }
            >
              展开 MusicXML
            </button>
          ) : null}
          <button disabled={locked} onClick={() => void exportReport()}>
            批注报告
          </button>
        </div>
      </section>
      <section className="view-toolbar" aria-label="显示设置">
        <label>
          显示声部{" "}
          <select
            name="displayPart"
            aria-label="显示声部"
            value={p.data.partId}
            disabled={locked}
            onChange={(event) => {
              setSvg("");
              p.setData((data) => ({ ...data, partId: event.target.value }));
            }}
          >
            <option value="">全谱</option>
            {info.parts.map((part) => (
              <option key={part.id} value={part.id}>
                {part.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          版式{" "}
          <select
            aria-label="乐谱版式"
            name="scoreLayout"
            value={p.data.layout}
            disabled={locked}
            onChange={(event) => {
              setSvg("");
              p.setData((data) => ({
                ...data,
                layout: event.target.value as ScoreProject["layout"],
              }));
            }}
          >
            <option value="page">A4 分页</option>
            <option value="continuous">连续长页</option>
          </select>
        </label>
        <label>
          比例{" "}
          <select
            aria-label="乐谱比例"
            name="scoreZoom"
            value={p.data.zoom}
            disabled={locked}
            onChange={(event) => {
              setSvg("");
              p.setData((data) => ({
                ...data,
                zoom: Number(event.target.value),
              }));
            }}
          >
            {[0.7, 0.85, 1, 1.15, 1.3].map((value) => (
              <option key={value} value={value}>
                {Math.round(value * 100)}%
              </option>
            ))}
          </select>
        </label>
        <p>纸面保留原谱布局，批注单独保存</p>
      </section>
      <div id="score-content" className="reading-layout" tabIndex={-1}>
        <MeasureIndex
          parts={info.parts}
          part={part}
          measureIndex={measureIndex}
          annotations={p.data.annotations}
          allNotes={allNotes}
          locked={locked}
          onSelect={selectLocation}
          onToggleAll={() => setAllNotes(!allNotes)}
        />
        <section className="paper-desk" aria-label="乐谱审阅区">
          <div className="paper-caption">
            <span>{info.title}</span>
            <span>可横向滚动查看完整纸面</span>
          </div>
          <div
            className="paper-scroll"
            tabIndex={0}
            aria-label="乐谱横向滚动区域"
          >
            <RenderBoundary>
              <Suspense
                fallback={
                  <p className="render-state" role="status">
                    正在准备乐谱引擎…
                  </p>
                }
              >
                <ScoreView
                  xml={p.data.source.xml}
                  partId={p.data.partId}
                  layout={p.data.layout}
                  zoom={p.data.zoom}
                  onOutput={setSvg}
                />
              </Suspense>
            </RenderBoundary>
          </div>
        </section>
        <AnnotationBook
          notesRef={notes}
          allNotes={allNotes}
          part={part}
          measureIndex={measureIndex}
          annotations={allNotes ? p.data.annotations : locationNotes}
          parts={info.parts}
          locked={locked}
          addNote={addNote}
          updateNote={updateNote}
          removeNote={removeNote}
          onSelect={selectLocation}
        />
      </div>
      <footer className="app-footer">
        原件与批注保存在当前工作空间 · 示例旋律为本项目原创
      </footer>
      <input
        type="file"
        ref={upload}
        className="sr-only"
        aria-label="选择乐谱文件"
        accept=".musicxml,.xml,.mxl"
        disabled={locked}
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (file) void importFile(file);
        }}
      />
    </main>
  );
}
