// ABOUTME: Docling 校对台：原页框选对照、结构目录、校样文稿与校订面板；转换（本地/Docling Serve）、文档菜单与导出。
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, Download, FileText, FolderOpen, Upload } from "lucide-react";
import { useProjects, Notice, download, request } from "./workspace";
import { allItems, items, pageSizes, boxes, type Document } from "../contracts/docling";
import {
  assertMatches,
  assertWorkingCopyCapacity,
  corrected,
  moveSibling,
  restoreReviewDraft,
  summary,
  validateReview,
  empty,
  type Correction,
  type Review,
} from "../contracts/review";
import { html, markdown, tableCsv, tablesCsv } from "../contracts/exports";
import { ENGINES, formatOf } from "../contracts/convert/index";
import { EXAMPLES, type Example } from "../contracts/examples";
import { defaultOptions, jobValue, serveOptions, type Job, type ServeOptions } from "../contracts/jobs";
import { isRecord } from "../contracts/project";
import { loadDocument, loadSource } from "./library";
import { convertLocally, exportPackage, importJson, importPackage, reviewFor, settleLegacy, storeDocument, storeSource, type Imported } from "./convert";
import { ConvertSheet, type Health } from "./ConvertSheet";
import { DocumentMenu, ExportMenu } from "./DocumentMenu";
import { PageView, marksFor } from "./PageView";
import { SourceView } from "./SourceView";
import { Inspector, ProofView, StructureRail, labelOf } from "./ReviewParts";
const first = EXAMPLES[0]!;
const seed: Review = { ...empty, document: first.document, source: "示例 · " + first.title };
type Pane = "structure" | "page" | "proof" | "inspector";
type Center = "split" | "page" | "proof";
const wide = () => typeof window !== "undefined" && window.innerWidth >= 1360;
const safeName = (s: string) => (s.trim() || "document").replace(/[\\/:*?"<>|]+/g, "_").slice(0, 120);
export function App() {
  const p = useProjects(seed, validateReview, "示例 · " + first.title, {
    storageKey: "docling-review-v1",
    restoreDraftData: restoreReviewDraft,
  });
  const working = useRef({ title: p.title, data: p.data, extra: p.draft });
  working.current = { title: p.title, data: p.data, extra: p.draft };
  const epoch = useRef(p.documentKey);
  epoch.current = p.documentKey;
  function changeData(value: Review) {
    try {
      const data = restoreReviewDraft(value);
      assertWorkingCopyCapacity(working.current.title, data, working.current.extra);
      working.current = { ...working.current, data };
      p.setData(data);
    } catch (error) {
      p.report(error);
    }
  }
  function changeDraft(update: (extra: Record<string, unknown>) => Record<string, unknown>) {
    try {
      const extra = update(working.current.extra);
      assertWorkingCopyCapacity(working.current.title, working.current.data, extra);
      working.current = { ...working.current, extra };
      p.setDraft(extra);
    } catch (error) {
      p.report(error);
    }
  }
  function changeTitle(title: string) {
    try {
      assertWorkingCopyCapacity(title, working.current.data, working.current.extra);
      working.current = { ...working.current, title };
      p.setTitle(title);
    } catch (error) {
      p.report(error);
    }
  }
  async function replaceReview(value: Review, title: string, extra: Record<string, unknown> = {}): Promise<boolean> {
    try {
      const data = restoreReviewDraft(value);
      const name = title.trim().slice(0, 120) || "未命名文档";
      assertWorkingCopyCapacity(name, data, extra);
      return await p.replace(data, name, extra);
    } catch (error) {
      p.report(error);
      return false;
    }
  }
  // Document loading: the project references a stored DoclingDocument by content hash.
  const docId = p.data.document?.id ?? "";
  const [loaded, setLoaded] = useState<{ id: string; doc: Document } | null>(null),
    [docError, setDocError] = useState("");
  useEffect(() => {
    if (!docId) return;
    let live = true;
    setDocError("");
    loadDocument(docId)
      .then((doc) => live && setLoaded({ id: docId, doc }))
      .catch((e: unknown) => live && setDocError(e instanceof Error ? e.message : "结构文档暂时不可用。"));
    return () => {
      live = false;
    };
  }, [docId]);
  // 0.4 projects embedded the document; move it to storage once, keeping corrections.
  const migrating = useRef("");
  useEffect(() => {
    if (!p.data.original || p.data.document || migrating.current === p.documentKey) return;
    migrating.current = p.documentKey;
    const key = p.documentKey;
    settleLegacy(p.data, () => undefined)
      .then((next) => {
        if (key === epoch.current) changeData(next);
      })
      .catch(p.report);
  }, [p.documentKey, p.data]);
  const original = p.data.original ?? (loaded && loaded.id === docId ? loaded.doc : null);
  const mismatch = useMemo(() => {
    if (!original) return "";
    try {
      assertMatches(p.data, original);
      return "";
    } catch (e) {
      return e instanceof Error ? e.message : "校订与文档不一致。";
    }
  }, [original, p.data]);
  const rows = useMemo(() => (original ? items(original, p.data.order) : []), [original, p.data.order]);
  const doc = useMemo(() => corrected(p.data, original), [p.data, original]);
  const effective = useMemo(() => new Map(doc ? allItems(doc).map((x) => [x.self_ref, x]) : []), [doc]);
  const [selected, setSelected] = useState(""),
    [view, setView] = useState<"review" | "source">("review"),
    [center, setCenter] = useState<Center>(() => (wide() ? "split" : "page")),
    [pane, setPane] = useState<Pane>("page"),
    [showAll, setShowAll] = useState(true);
  const active = rows.find((x) => x.item.self_ref === selected)?.item ?? rows.find((x) => !x.item.self_ref.startsWith("#/groups"))?.item,
    activeRef = active?.self_ref ?? "",
    correction = p.data.corrections[activeRef];
  const marks = useMemo(() => (original ? marksFor(original, rows, labelOf, p.data.corrections) : new Map()), [original, rows, p.data.corrections]);
  const source = p.data.document?.source ?? null;
  const hasPages = source?.format === "pdf";
  // Service, jobs and conversion state.
  const [health, setHealth] = useState<Health>({ configured: false, reachable: false, defaulted: true, base: "", version: "", message: "正在检查 Docling Serve…", checkedAt: 0 }),
    [checking, setChecking] = useState(false),
    [jobs, setJobs] = useState<Job[]>([]),
    [sheet, setSheet] = useState(false),
    [menu, setMenu] = useState<"doc" | "export" | null>(null),
    [file, setFile] = useState<File | null>(null),
    [busy, setBusy] = useState(false),
    [progress, setProgress] = useState("");
  const docButton = useRef<HTMLButtonElement>(null),
    exportButton = useRef<HTMLButtonElement>(null),
    convertButton = useRef<HTMLButtonElement>(null);
  const engine = p.draft.engine === "serve" ? "serve" : "local";
  const options = useMemo<ServeOptions>(() => {
    try {
      return serveOptions(p.draft.serveOptions ?? defaultOptions);
    } catch {
      return defaultOptions;
    }
  }, [p.draft.serveOptions]);
  const raw = typeof p.draft.raw === "string" ? p.draft.raw : "";
  const taskId = typeof p.draft.taskId === "string" ? p.draft.taskId : "";
  const loadJobs = useCallback(async () => {
    const v = await request("/api/docling/jobs");
    if (!Array.isArray(v)) throw new Error("任务列表无效。");
    setJobs(v.map(jobValue));
  }, []);
  const recheck = useCallback(async () => {
    setChecking(true);
    try {
      const v = await request("/api/docling");
      if (!isRecord(v) || typeof v.reachable !== "boolean" || typeof v.message !== "string") throw new Error("服务状态无效。");
      setHealth({
        configured: v.configured === true,
        reachable: v.reachable,
        defaulted: v.defaulted === true,
        base: typeof v.base === "string" ? v.base : "",
        version: typeof v.version === "string" ? v.version : "",
        message: v.message,
        checkedAt: Date.now(),
      });
    } catch (e) {
      setHealth((h) => ({ ...h, reachable: false, message: "无法读取服务状态：" + (e instanceof Error ? e.message : "请重试。"), checkedAt: Date.now() }));
    } finally {
      setChecking(false);
    }
  }, []);
  useEffect(() => {
    void recheck();
    loadJobs().catch(p.report);
  }, []);
  const pollingKey = jobs.filter((j) => ["pending", "running"].includes(j.state)).map((j) => j.id).join(",");
  useEffect(() => {
    if (!pollingKey) return;
    let stopped = false;
    const timer = setInterval(() => {
      void Promise.all(pollingKey.split(",").map((id) => request("/api/docling/jobs/" + id + "/refresh", { method: "POST", body: "{}" })))
        .then((values) => {
          if (!stopped) setJobs((old) => old.map((j) => values.map(jobValue).find((v) => v.id === j.id) ?? j));
        })
        .catch(p.report);
    }, 4000);
    return () => {
      stopped = true;
      clearInterval(timer);
    };
  }, [pollingKey]);
  function select(ref: string, from: "structure" | "page" | "proof" = "page") {
    setSelected(ref);
    if (from === "structure" && pane === "structure") setPane(hasPages || source ? "page" : "proof");
  }
  function patch(value: Partial<Correction>) {
    if (!active) return;
    changeData({
      ...p.data,
      corrections: { ...p.data.corrections, [activeRef]: { ...(correction ?? { reviewed: false, note: "" }), ...value } },
    });
  }
  async function openImported(result: Imported, notice: string) {
    if (await replaceReview(result.review, result.title, result.extra)) {
      setSelected("");
      setSheet(false);
      setFile(null);
      p.setNotice(notice);
    }
  }
  async function withBusy(run: () => Promise<void>) {
    setBusy(true);
    p.setError("");
    try {
      await run();
    } catch (e) {
      p.report(e);
    } finally {
      setBusy(false);
      setProgress("");
    }
  }
  async function importFile(f: File) {
    await withBusy(async () => {
      if (/\.zip$/i.test(f.name)) {
        const result = await importPackage(new Uint8Array(await f.arrayBuffer()), setProgress);
        await openImported(result, "已导入校对包为新文档。");
        return;
      }
      if (f.size > 48 * 1024 * 1024) throw new Error("JSON 需在 48 MB 以内。");
      const text = await f.text();
      try {
        await openImported(await importJson(text, f.name, setProgress), "已导入为新文档。");
      } catch (e) {
        // Keep an invalid but small input as an unapplied draft for correction.
        if (text.length < 600000) changeDraft((d) => ({ ...d, raw: text }));
        throw e;
      }
    });
  }
  async function convert() {
    if (!file) return;
    const format = formatOf(file.name);
    if (format === "json" || /\.zip$/i.test(file.name)) return importFile(file);
    const key = epoch.current;
    await withBusy(async () => {
      const { ref: src, bytes } = await storeSource(file, setProgress);
      if (engine === "local") {
        const result = await convertLocally(src, bytes, setProgress);
        const ref = await storeDocument(result.doc, ENGINES[src.format as "pdf"], src, setProgress);
        if (key !== epoch.current) return;
        await openImported(
          { review: reviewFor(ref, "本地解析 · " + file.name), title: result.doc.name || file.name },
          `已转换为新文档：${ref.items} 个结构项${ref.pages ? "，" + ref.pages + " 页" : ""}。` + (result.warnings.length ? " " + result.warnings.join(" ") : ""),
        );
      } else {
        setProgress("正在提交到 Docling Serve…");
        const id = crypto.randomUUID();
        const job = jobValue(await request("/api/docling/jobs", { method: "POST", body: JSON.stringify({ id, sourceId: src.id, filename: file.name, options }) }));
        await loadJobs();
        p.setNotice(job.state === "failure" || job.state === "uncertain" ? job.message : "已提交到 Docling Serve；可继续校对，完成后在转换面板打开结果。");
      }
    });
  }
  async function jobAction(job: Job, action: "refresh" | "pause" | "resume" | "attach" | "open") {
    await withBusy(async () => {
      if (action !== "open") {
        await request(`/api/docling/jobs/${job.id}/${action}`, { method: "POST", body: JSON.stringify(action === "attach" ? { taskId } : {}) });
        await loadJobs();
        return;
      }
      const key = epoch.current;
      const r = await request(`/api/docling/jobs/${job.id}/result`);
      if (!isRecord(r) || typeof r.documentId !== "string") throw new Error("转换结果无效。");
      const result = await loadDocument(r.documentId);
      if (key !== epoch.current) return;
      const src = typeof r.sourceId === "string" ? { id: r.sourceId, name: job.filename, format: formatOf(job.filename), bytes: Number(r.sourceBytes) || 0 } : null;
      const ref = summary(result, r.documentId, Number(r.documentBytes) || 0, "Docling Serve" + (health.version ? " " + health.version : ""), src);
      await openImported({ review: reviewFor(ref, `Docling Serve · ${job.filename} · 任务 ${job.taskId ?? ""}`), title: result.name || job.filename }, "Docling Serve 结果已作为新文档打开。");
    });
  }
  async function openExample(e: Example) {
    await openImported({ review: reviewFor(e.document, "示例 · " + e.title), title: "示例 · " + e.title }, "已打开示例：" + e.title + "。");
  }
  async function exportAs(kind: "json" | "md" | "html" | "csv" | "csv-all" | "package") {
    if (!doc || !original) return;
    const name = safeName(p.title);
    try {
      if (kind === "json") download(new Blob([JSON.stringify(doc, null, 2)], { type: "application/json" }), name + ".docling.json");
      else if (kind === "md") download(new Blob([markdown(doc)], { type: "text/markdown;charset=utf-8" }), name + ".md");
      else if (kind === "html") download(new Blob([html(doc, p.title)], { type: "text/html;charset=utf-8" }), name + ".html");
      else if (kind === "csv") {
        const node = active && effective.get(active.self_ref);
        if (node?.data) download(new Blob(["\uFEFF" + tableCsv(node)], { type: "text/csv;charset=utf-8" }), name + "-table.csv");
      } else if (kind === "csv-all") download(new Blob(["\uFEFF" + tablesCsv(doc)], { type: "text/csv;charset=utf-8" }), name + "-tables.csv");
      else {
        const bytes = source ? await loadSource(source.id).catch(() => null) : null;
        download(exportPackage(p.data, original, bytes && source ? { name: source.name, bytes } : null), name + ".docling-review.zip");
        if (source && !bytes) p.setNotice("原文件不在当前工作台，校对包未包含原文件。");
      }
    } catch (e) {
      p.report(e);
    }
  }
  const correctionCount = Object.keys(p.data.corrections).length;
  const tables = doc ? doc.tables.length : 0;
  const saveText = p.autoState.phase === "saved" && raw.trim() ? "已保存 · 粘贴的 JSON 未应用" : p.autoState.message;
  const pagesCount = original ? pageSizes(original).size : 0;
  const located = useMemo(() => rows.filter((r) => boxes(r.item).length).length, [rows]);
  return (
    <div className="studio" data-pane={pane} data-center={center}>
      <a className="skip" href="#document">跳到文稿</a>
      <header className="masthead">
        <div className="brand">
          <span className="brand-symbol" aria-hidden="true">
            <FileText size={18} />
          </span>
          <strong>Docling</strong>
        </div>
        <div className="menu-anchor">
          <button ref={docButton} type="button" className="menu-button" aria-expanded={menu === "doc"} aria-haspopup="dialog" onClick={() => setMenu(menu === "doc" ? null : "doc")}>
            <FolderOpen size={15} aria-hidden="true" />
            文档
            <ChevronDown size={13} aria-hidden="true" />
          </button>
          <DocumentMenu
            open={menu === "doc"}
            close={() => setMenu(null)}
            trigger={docButton}
            locked={p.busy || busy}
            items={p.items}
            currentId={p.current?.id}
            conflict={p.autoState.phase === "conflict"}
            onConvert={() => setSheet(true)}
            onOpen={(id) => void p.open(id).then((ok) => ok && setSelected(""))}
            onExportDraft={p.exportDraft}
            onRetrySave={() => void p.save()}
            onServerVersion={() => p.current && void p.open(p.current.id)}
            onDelete={() => void p.remove()}
          />
        </div>
        <div className="file-heading">
          <input aria-label="文档名称" name="title" value={p.title} autoComplete="off" onChange={(e) => changeTitle(e.target.value)} />
          <span className={"save-state " + p.autoState.phase} role="status">
            {saveText}
          </span>
        </div>
        <span className="engine-tag" title={p.data.source}>
          {p.data.document?.engine ?? (p.data.original ? "导入 DoclingDocument JSON" : "")}
        </span>
        <button ref={convertButton} type="button" className="primary convert-button" onClick={() => setSheet(true)}>
          <Upload size={15} aria-hidden="true" />
          转换文档
          <span className={"dot" + (health.reachable ? " online" : "")} aria-hidden="true" />
        </button>
        <div className="menu-anchor">
          <button ref={exportButton} type="button" className="menu-button" aria-expanded={menu === "export"} aria-haspopup="dialog" disabled={!doc} onClick={() => setMenu(menu === "export" ? null : "export")}>
            <Download size={15} aria-hidden="true" />
            导出
            <ChevronDown size={13} aria-hidden="true" />
          </button>
          <ExportMenu open={menu === "export"} close={() => setMenu(null)} trigger={exportButton} ready={!!doc} hasTable={!!active?.data} tableCount={tables} onExport={(k) => void exportAs(k)} />
        </div>
      </header>
      <Notice error={p.error || mismatch} notice={p.notice} />
      {p.autoState.phase === "conflict" ? (
        <div className="conflict" role="alert">
          其他窗口已更新此文档。请先导出工作副本，再读取服务器版本。
          <button type="button" onClick={p.exportDraft}>导出工作副本</button>
          <button type="button" onClick={() => p.current && void p.open(p.current.id)}>读取服务器版本</button>
        </div>
      ) : null}
      <nav className="pane-tabs" aria-label="视图">
        {(
          [
            ["structure", "结构"],
            ["page", hasPages ? "原页" : "原文"],
            ["proof", "文稿"],
            ["inspector", "校订"],
          ] as const
        ).map(([k, v]) => (
          <button key={k} type="button" aria-pressed={pane === k} onClick={() => setPane(k)}>
            {v}
          </button>
        ))}
      </nav>
      <ConvertSheet
        open={sheet}
        close={() => setSheet(false)}
        trigger={convertButton}
        busy={busy}
        progress={progress}
        file={file}
        onFile={setFile}
        engine={engine}
        onEngine={(e) => changeDraft((d) => ({ ...d, engine: e }))}
        options={options}
        onOptions={(o) => changeDraft((d) => ({ ...d, serveOptions: o }))}
        health={health}
        checking={checking}
        onRecheck={() => void recheck()}
        onConvert={() => void convert()}
        jobs={jobs}
        taskId={taskId}
        onTaskId={(v) => changeDraft((d) => ({ ...d, taskId: v }))}
        onJob={(j, a) => void jobAction(j, a)}
        examples={EXAMPLES}
        onExample={(e) => void openExample(e)}
        onImport={(f) => void importFile(f)}
        raw={raw}
        onRaw={(v) => changeDraft((d) => ({ ...d, raw: v }))}
        onImportRaw={() =>
          void withBusy(async () => {
            const result = await importJson(raw, "粘贴的 JSON", setProgress);
            await openImported(result, "已导入为新文档。");
          })
        }
      />
      {!p.data.document && !p.data.original ? (
        <main className="empty-desk" id="document">
          <FileText size={40} aria-hidden="true" />
          <h1>把文档转换成可校订的结构</h1>
          <p>PDF、Word、HTML、Markdown 可直接在本页解析；连接 Docling Serve 可使用官方版面模型、表格结构与 OCR。</p>
          <div className="actions">
            <button type="button" className="primary" onClick={() => setSheet(true)}>选择文件转换…</button>
            <button type="button" onClick={() => void openExample(first)}>打开示例报告</button>
          </div>
        </main>
      ) : (
        <div className="desk">
          <StructureRail rows={rows} active={activeRef} corrections={p.data.corrections} onSelect={(r) => select(r, "structure")} source={p.data.source} />
          <section className="center" aria-label="对照">
            <div className="center-tabs" role="group" aria-label="对照方式">
              {(
                [
                  ["page", hasPages ? "原页" : "原文"],
                  ["split", "对照"],
                  ["proof", "文稿"],
                ] as const
              ).map(([k, v]) => (
                <button key={k} type="button" aria-pressed={center === k} onClick={() => setCenter(k)}>
                  {v}
                </button>
              ))}
              <span className="hint">
                {original ? `${rows.length} 项${pagesCount ? ` · ${pagesCount} 页 · ${located} 项有原页坐标` : ""}` : ""}
              </span>
            </div>
            <div className="center-body">
              <div className="pane-page">
                {docError ? (
                  <div className="page-missing" role="alert">
                    <p>{docError}</p>
                    <button type="button" onClick={() => setSheet(true)}>重新转换原文件</button>
                  </div>
                ) : !original ? (
                  <p className="page-loading" role="status">正在读取结构文档…</p>
                ) : source && hasPages ? (
                  <PageView sourceId={source.id} doc={original} marks={marks} active={activeRef} onSelect={(r) => select(r)} showAll={showAll} onShowAll={setShowAll} />
                ) : source ? (
                  <SourceView source={source} doc={original} active={activeRef} onSelect={(r) => select(r)} />
                ) : (
                  <div className="page-missing">
                    <p>此文档由 JSON 导入，没有关联原文件，无法显示原页对照。</p>
                    <button type="button" onClick={() => setSheet(true)}>转换原文件以获得对照</button>
                  </div>
                )}
              </div>
              <div className="pane-proof">
                {original ? (
                  <ProofView rows={rows} effective={effective} active={activeRef} view={view} onView={setView} onSelect={(r) => select(r, "proof")} version={String(original.version)} corrections={correctionCount} />
                ) : null}
              </div>
            </div>
          </section>
          <Inspector
            active={active}
            correction={correction}
            onPatch={patch}
            onMove={(d) => original && changeData(moveSibling(p.data, original, activeRef, d))}
            onRevert={() =>
              changeData({ ...p.data, corrections: Object.fromEntries(Object.entries(p.data.corrections).filter(([k]) => k !== activeRef)) })
            }
            onSelect={(r) => select(r)}
            onCsv={() => void exportAs("csv")}
          />
        </div>
      )}
    </div>
  );
}
