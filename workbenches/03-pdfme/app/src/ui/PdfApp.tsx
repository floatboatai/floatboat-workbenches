// ABOUTME: 纸张工坊主界面：模板菜单 + 版式/填写/批量三视图，左侧页面轨、中间纸张、右侧字段或数据栏。
import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import type { Template } from "@pdfme/common";
import { readDesignerDrafts, designerDraftApplied, applyDesignerDrafts, type DesignerDraft } from "../contracts/designer-draft";
import { paperLabel, pdfInput, renameField, restorePdfDraft, validatePdf, type Dataset, type PdfProject } from "../contracts/domain";
import { seed } from "../contracts/samples";
import { fileNameFor, parseDataset, rowInput, uniqueNames, validateInput, validateRows, type Table } from "../contracts/dataset";
import { INLINE_LIMIT } from "../contracts/assets";
import { download, Notice, RenderBoundary, useProjects } from "./workspace";
import { dataUrlText, dehydrate, hydrate, resolveBlob } from "./assets";
import { renderMerged, renderPdf, renderZip } from "./pdf";
import { preloadPdfEngine } from "./browser-engine";
import { PreviewPane, type PageRequest } from "./surface";
import { PageRail } from "./PageRail";
import { TemplateMenu } from "./TemplateMenu";
import { FieldPanel } from "./FieldPanel";
import { DataPanel, type BatchState } from "./DataPanel";
import { DesignerDrafts } from "./DesignerDrafts";
import { fileSafe, PAPERS, useTemplateFiles, type Mode } from "./useTemplateFiles";

const DesignerPane = lazy(() => import("./DesignerPane").then((module) => ({ default: module.DesignerPane })));

const MODES: { id: Mode; label: string }[] = [
  { id: "design", label: "版式" },
  { id: "fill", label: "填写" },
  { id: "data", label: "批量数据" },
];
export function PdfApp() {
  const p = useProjects<PdfProject>(seed, validatePdf, "报价单", { storageKey: "pdfme", restoreDraftData: restorePdfDraft });
  const live = useRef(p);
  live.current = p;
  const [mode, setModeState] = useState<Mode>(() => (window.innerWidth < 700 ? "fill" : "design"));
  const [designerEpoch, setDesignerEpoch] = useState(0);
  const [pageRequest, setPageRequest] = useState<PageRequest | null>(null);
  const [currentPage, setCurrentPage] = useState(0);
  const [working, setWorking] = useState("");
  const [batch, setBatch] = useState<BatchState | null>(null);
  const abort = useRef<AbortController | null>(null);
  const jsonFile = useRef<HTMLInputElement>(null),
    pdfFile = useRef<HTMLInputElement>(null),
    baseFile = useRef<HTMLInputElement>(null),
    dataFile = useRef<HTMLInputElement>(null);
  const busy = p.busy || p.loading || !!working;

  const setMode = useCallback((next: Mode) => {
    setModeState(next);
    if (next === "design") setDesignerEpoch((value) => value + 1);
  }, []);

  /* Persisted data holds references; pdfme needs renderable data. Hydrate template and values separately so typing does not re-create the template. */
  const templateJson = useMemo(() => JSON.stringify(p.data.template), [p.data.template]);
  const valuesJson = useMemo(() => JSON.stringify(p.data.values), [p.data.values]);
  const [hydratedTemplate, setHydratedTemplate] = useState<{ json: string; template: Template } | null>(null);
  const [hydratedValues, setHydratedValues] = useState<{ json: string; values: Record<string, string> }>({ json: "", values: {} });
  useEffect(() => {
    let active = true;
    const data = live.current.data;
    hydrate({ template: data.template, values: {} })
      .then((next) => active && setHydratedTemplate({ json: templateJson, template: next.template }))
      .catch((error) => active && live.current.report(error));
    return () => {
      active = false;
    };
  }, [templateJson]);
  useEffect(() => {
    let active = true;
    const data = live.current.data;
    hydrate({ template: data.template, values: data.values })
      .then((next) => active && setHydratedValues({ json: valuesJson, values: next.values }))
      .catch((error) => active && live.current.report(error));
    return () => {
      active = false;
    };
  }, [valuesJson, templateJson]);
  const ready = hydratedTemplate?.json === templateJson ? hydratedTemplate.template : null;
  const values = hydratedValues.json === valuesJson ? hydratedValues.values : p.data.values;
  const input = useMemo(() => (ready ? pdfInput({ template: ready, values }) : {}), [ready, values]);
  const issues = useMemo(() => (ready ? validateInput(ready, input) : []), [ready, input]);

  /* Dataset: parse the stored CSV/JSON once per source. */
  const dataset = p.data.dataset ?? null;
  const [parsed, setParsed] = useState<{ source: string; table: Table | null; error: string } | null>(null);
  useEffect(() => {
    if (!dataset?.source) return;
    let active = true;
    const { source, format } = dataset;
    resolveBlob(source)
      .then((data) => parseDataset(dataUrlText(data), format))
      .then((table) => active && setParsed({ source, table, error: "" }))
      .catch((error) => active && setParsed({ source, table: null, error: error instanceof Error ? error.message : "数据读取失败。" }));
    return () => {
      active = false;
    };
  }, [dataset?.source, dataset?.format]); // eslint-disable-line react-hooks/exhaustive-deps
  const table = dataset && parsed?.source === dataset.source ? parsed.table : null;
  const tableError = dataset && parsed?.source === dataset.source ? parsed.error : "";
  const mapping = dataset?.mapping ?? {};
  const mappingJson = JSON.stringify(mapping);
  const hydratedProject = useMemo(() => (ready ? { template: ready, values } : null), [ready, values]);
  const reports = useMemo(
    () => (hydratedProject && table ? validateRows(hydratedProject, table, mapping) : []),
    [hydratedProject, table, mappingJson], // eslint-disable-line react-hooks/exhaustive-deps
  );
  const selectedRow = dataset && table ? Math.min(dataset.selected, Math.max(0, table.rows.length - 1)) : 0;
  const rowValues = useMemo(
    () => (hydratedProject && table ? rowInput(hydratedProject, table, mapping, selectedRow) : input),
    [hydratedProject, table, mappingJson, selectedRow, input], // eslint-disable-line react-hooks/exhaustive-deps
  );
  const previewInput = mode === "data" && table ? rowValues : input;

  /* Designer: mount once per entry with the template at that moment; later changes flow out through onChange only. */
  const designerKey = `${p.documentKey}:${designerEpoch}`;
  const designerSeed = useRef<{ key: string; template: Template } | null>(null);
  if (mode === "design" && ready && designerSeed.current?.key !== designerKey) designerSeed.current = { key: designerKey, template: ready };
  const designerInitial = designerSeed.current?.key === designerKey ? designerSeed.current.template : null;
  const pump = useRef<{ latest: Template | null; running: boolean }>({ latest: null, running: false });
  const onDesignerChange = useCallback((template: Template) => {
    pump.current.latest = template;
    if (pump.current.running) return;
    pump.current.running = true;
    const documentKey = live.current.documentKey;
    void (async () => {
      try {
        while (pump.current.latest) {
          const next = pump.current.latest;
          pump.current.latest = null;
          // New large images dropped into the Designer are uploaded before they reach the saved model.
          const stored = await dehydrate({ template: next, values: {} });
          if (live.current.documentKey !== documentKey) return;
          const checked = restorePdfDraft({ template: stored.template, values: {} }).template;
          live.current.setData((data) => ({ ...data, template: checked }));
          live.current.setDraft((draft) => ({
            ...draft,
            designerInputs: readDesignerDrafts(draft.designerInputs).filter((item) => !designerDraftApplied(checked, item)),
          }));
        }
      } catch (error) {
        live.current.report(error);
      } finally {
        pump.current.running = false;
      }
    })();
  }, []);
  const captureDraft = useCallback(
    (item: DesignerDraft, applied: boolean) =>
      live.current.setDraft((draft) => {
        const remaining = readDesignerDrafts(draft.designerInputs).filter((entry) => entry.field !== item.field || entry.property !== item.property);
        return { ...draft, designerInputs: applied ? remaining : [...remaining, item] };
      }),
    [],
  );
  const designerInputs = readDesignerDrafts(p.draft.designerInputs);
  const pendingProperties = designerInputs.length > 0;
  const resetDesignerInputs = () => {
    p.setDraft((draft) => ({ ...draft, designerInputs: [] }));
    setDesignerEpoch((value) => value + 1);
  };

  const onFormInput = useCallback((name: string, value: string) => {
    const documentKey = live.current.documentKey;
    const apply = (stored: string) => {
      if (live.current.documentKey === documentKey) live.current.setData((data) => ({ ...data, values: { ...data.values, [name]: stored } }));
    };
    if (value.startsWith("data:") && value.length > INLINE_LIMIT) {
      setWorking("正在保存图片…");
      dehydrate({ template: live.current.data.template, values: { [name]: value } })
        .then((next) => apply(next.values[name] ?? ""))
        .catch((error) => live.current.report(error))
        .finally(() => setWorking(""));
    } else apply(value);
  }, []);
  const onRename = useCallback((from: string, to: string) => {
    try {
      live.current.setData(renameField(live.current.data, from, to));
      return null;
    } catch (error) {
      return error instanceof Error ? error.message : "无法改名。";
    }
  }, []);
  const onRequired = useCallback((name: string, required: boolean) => {
    live.current.setData((data) => {
      const next = structuredClone(data);
      for (const page of next.template.schemas) for (const field of page) if (field.name === name) field.required = required;
      return next;
    });
  }, []);
  const selectPage = useCallback((page: number) => {
    setCurrentPage(page);
    setPageRequest({ page, nonce: Date.now() });
  }, []);

  const setDataset = (update: (dataset: Dataset) => Dataset) =>
    p.setData((data) => (data.dataset ? { ...data, dataset: update(data.dataset) } : data));

  async function guarded(label: string, work: () => Promise<void>) {
    setWorking(label);
    p.setError("");
    try {
      await work();
    } catch (error) {
      p.report(error);
    } finally {
      setWorking("");
    }
  }
  const files = useTemplateFiles({
    live,
    guarded,
    setWorking,
    opened: (next) => {
      setModeState(next);
      setDesignerEpoch((value) => value + 1);
      setCurrentPage(0);
    },
    remount: () => setDesignerEpoch((value) => value + 1),
    setParsed,
    input,
  });

  async function exportPdf() {
    if (!ready) return;
    const target = mode === "data" && table ? rowValues : input;
    const problems = validateInput(ready, target);
    if (problems.length) {
      p.setError(`还有 ${problems.length} 处需要修正：${problems.slice(0, 3).map((issue) => issue.message).join("；")}`);
      if (mode === "design") setMode("fill");
      return;
    }
    await guarded("正在生成 PDF…", async () => {
      const name = mode === "data" && table ? fileNameFor(table, dataset?.fileColumn ?? "", selectedRow, fileSafe(p.title)) : `${fileSafe(p.title)}.pdf`;
      const bytes = await renderPdf(ready, [target], p.title);
      download(new Blob([bytes as BlobPart], { type: "application/pdf" }), name);
      p.setNotice(`已生成 ${name}`);
    });
  }

  async function runBatch(kind: "merged" | "zip") {
    if (!ready || !table || !dataset || !hydratedProject) return;
    const good = reports.filter((report) => !report.issues.length);
    const skipped = reports.filter((report) => report.issues.length).map((report) => report.index + 1);
    const inputs = good.map((report) => rowInput(hydratedProject, table, mapping, report.index));
    const controller = new AbortController();
    abort.current = controller;
    setBatch({ kind, done: 0, total: inputs.length });
    p.setError("");
    const progress = ({ done, total }: { done: number; total: number }) => setBatch({ kind, done, total });
    try {
      const title = fileSafe(p.title);
      if (kind === "merged") {
        const bytes = await renderMerged(ready, inputs, p.title, progress, controller.signal);
        download(new Blob([bytes as BlobPart], { type: "application/pdf" }), `${title}-${inputs.length}份.pdf`);
      } else {
        const names = uniqueNames(good.map((report) => fileNameFor(table, dataset.fileColumn, report.index, title)));
        const bytes = await renderZip(ready, inputs, names, progress, controller.signal);
        download(new Blob([bytes as BlobPart], { type: "application/zip" }), `${title}-${inputs.length}份.zip`);
      }
      p.setNotice(`已生成 ${inputs.length} 份${skipped.length ? `，跳过有问题的第 ${skipped.slice(0, 8).join("、")}${skipped.length > 8 ? " 等" : ""} 行` : ""}。`);
    } catch (error) {
      if (controller.signal.aborted) p.setNotice("已取消批量生成。");
      else p.report(error);
    } finally {
      abort.current = null;
      setBatch(null);
    }
  }

  const pickFile = (input: { current: HTMLInputElement | null }) => () => input.current?.click();
  const onTabKey = (event: KeyboardEvent<HTMLDivElement>) => {
    const index = MODES.findIndex((entry) => entry.id === mode);
    const next =
      event.key === "ArrowRight" ? (index + 1) % MODES.length : event.key === "ArrowLeft" ? (index - 1 + MODES.length) % MODES.length : event.key === "Home" ? 0 : event.key === "End" ? MODES.length - 1 : -1;
    if (next < 0) return;
    event.preventDefault();
    setMode(MODES[next].id);
    event.currentTarget.querySelectorAll<HTMLButtonElement>("[role=tab]")[next]?.focus();
  };

  const phase = pendingProperties && p.autoState.phase === "saved" ? "draft" : p.autoState.phase;
  const status = pendingProperties && p.autoState.phase === "saved" ? "属性草稿已保存，待应用" : p.autoState.message;
  const isPdfBase = typeof p.data.template.basePdf === "string";
  const blankBase = !isPdfBase ? (p.data.template.basePdf as { width: number; height: number }) : null;
  const paperIndex = blankBase ? PAPERS.findIndex((paper) => paper.width === blankBase.width && paper.height === blankBase.height) : -1;
  const thumbVersion = `${templateJson.length}:${templateJson.slice(-400)}|${mode === "data" ? `${selectedRow}:${mappingJson}:${dataset?.source.length}` : valuesJson}|${ready ? 1 : 0}`;
  const primaryLabel = mode === "data" && table ? "生成本行 PDF" : "生成 PDF";

  return (
    <div className="paper-app">
      <a className="skip" href="#paper-stage">
        跳到纸张
      </a>
      <header className="topbar">
        <TemplateMenu
          items={p.items}
          currentId={p.current?.id}
          disabled={busy || !!batch}
          conflict={p.autoState.phase === "conflict" && !!p.current}
          canDelete={!!p.current}
          onSample={(kind) => void files.createSample(kind)}
          onOpen={(id) => void p.open(id).then((ok) => ok && setDesignerEpoch((value) => value + 1))}
          onImportJson={pickFile(jsonFile)}
          onImportPdf={pickFile(pdfFile)}
          onExportJson={() => void files.exportJson()}
          onExportDraft={p.exportDraft}
          onSave={() => void p.save()}
          onOpenServer={() => p.current && void p.open(p.current.id)}
          onDelete={() => void p.remove()}
          onWarm={preloadPdfEngine}
        />
        <label className="title-field">
          <span className="sr-only">模板名称</span>
          <input
            name="templateTitle"
            autoComplete="off"
            value={p.title}
            maxLength={120}
            disabled={p.loading}
            onChange={(event) => p.setTitle(event.target.value)}
          />
        </label>
        <div className="mode-tabs" role="tablist" aria-label="工作视图" onKeyDown={onTabKey}>
          {MODES.map((entry) => (
            <button
              key={entry.id}
              type="button"
              role="tab"
              id={`tab-${entry.id}`}
              aria-controls="paper-stage"
              aria-selected={mode === entry.id}
              tabIndex={mode === entry.id ? 0 : -1}
              onClick={() => setMode(entry.id)}
            >
              {entry.label}
              {entry.id === "data" && table ? <span className="tab-count">{table.rows.length}</span> : null}
            </button>
          ))}
        </div>
        <p className="save-state" role="status" data-autosave-phase={phase}>
          {working || status}
        </p>
        <button type="button" className="primary" onClick={() => void exportPdf()} onPointerEnter={preloadPdfEngine} disabled={busy || !!batch || pendingProperties || !ready}>
          {primaryLabel}
        </button>
      </header>
      <Notice error={p.error} notice={p.notice} />
      {pendingProperties ? (
        <DesignerDrafts
          inputs={designerInputs}
          onEdit={(index, value) =>
            p.setDraft((draft) => ({
              ...draft,
              designerInputs: readDesignerDrafts(draft.designerInputs).map((entry, i) => (i === index ? { ...entry, value } : entry)),
            }))
          }
          onApply={() => {
            try {
              p.setData(applyDesignerDrafts(p.data, designerInputs));
              resetDesignerInputs();
              p.setError("");
            } catch (error) {
              p.report(error);
            }
          }}
          onDiscard={resetDesignerInputs}
        />
      ) : null}
      <div className={`workspace mode-${mode}`} inert={p.loading || undefined}>
        <PageRail template={ready} input={previewInput} version={thumbVersion} current={currentPage} onSelect={selectPage}>
          {mode === "design" ? (
            <section className="paper-card" aria-label="纸张与底图">
              <p className="paper-kind">{paperLabel(p.data.template)}</p>
              {blankBase ? (
                <label className="paper-size">
                  <span className="sr-only">纸张尺寸</span>
                  <select value={paperIndex} onChange={(event) => files.setPaper(Number(event.target.value))} disabled={busy}>
                    {paperIndex < 0 ? <option value={-1}>自定义 {blankBase.width}×{blankBase.height}</option> : null}
                    {PAPERS.map((paper, index) => (
                      <option key={paper.label} value={index}>
                        {paper.label}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}
              <button type="button" onClick={pickFile(baseFile)} disabled={busy}>
                {isPdfBase ? "更换 PDF 底图…" : "导入 PDF 底图…"}
              </button>
              {isPdfBase ? (
                <button type="button" className="quiet" onClick={() => void files.removeBase()} disabled={busy}>
                  改回空白纸
                </button>
              ) : null}
            </section>
          ) : null}
        </PageRail>
        <main className="stage" id="paper-stage" role="tabpanel" aria-labelledby={`tab-${mode}`} tabIndex={-1}>
          <RenderBoundary key={`${p.documentKey}-${mode}`}>
            {!ready ? (
              <p className="engine-state" role="status">
                正在打开模板…
              </p>
            ) : mode === "design" ? (
              designerInitial ? (
                <Suspense fallback={<p className="engine-state">正在加载设计器…</p>}>
                  <DesignerPane key={designerKey} initial={designerInitial} onChange={onDesignerChange} onDraft={captureDraft} pageRequest={pageRequest} />
                </Suspense>
              ) : null
            ) : mode === "fill" ? (
              <PreviewPane kind="form" label="填写纸张" template={ready} inputs={input} inputsKey={p.documentKey} onInput={onFormInput} pageRequest={pageRequest} />
            ) : (
              <PreviewPane
                kind="viewer"
                label={table ? `第 ${selectedRow + 1} 行预览` : "当前填写预览"}
                template={ready}
                inputs={previewInput}
                inputsKey={`${p.documentKey}|${selectedRow}|${mappingJson}|${dataset?.source.length ?? 0}|${valuesJson.length}`}
                pageRequest={pageRequest}
              />
            )}
          </RenderBoundary>
        </main>
        {mode === "fill" && ready ? (
          <FieldPanel template={ready} issues={issues} onRename={onRename} onRequired={onRequired} onPage={selectPage} />
        ) : null}
        {mode === "data" && ready ? (
          <DataPanel
            template={ready}
            dataset={dataset}
            table={table}
            tableError={tableError}
            reports={reports}
            busy={busy}
            batch={batch}
            onImport={pickFile(dataFile)}
            onTemplateCsv={files.downloadCsvTemplate}
            onClear={() => p.setData((data) => ({ ...data, dataset: null }))}
            onMapping={(field, column) => setDataset((current) => ({ ...current, mapping: { ...current.mapping, [field]: column } }))}
            onFileColumn={(column) => setDataset((current) => ({ ...current, fileColumn: column }))}
            onSelect={(row) => setDataset((current) => ({ ...current, selected: row }))}
            onGenerate={(kind) => void runBatch(kind)}
            onCancel={() => abort.current?.abort()}
          />
        ) : null}
      </div>
      <input hidden ref={jsonFile} type="file" accept="application/json,.json" aria-label="导入模板 JSON" onChange={(event) => { const file = event.target.files?.[0]; event.target.value = ""; if (file) void files.importJson(file); }} />
      <input hidden ref={pdfFile} type="file" accept="application/pdf,.pdf" aria-label="以 PDF 新建模板" onChange={(event) => { const file = event.target.files?.[0]; event.target.value = ""; if (file) void files.newFromPdf(file); }} />
      <input hidden ref={baseFile} type="file" accept="application/pdf,.pdf" aria-label="选择 PDF 底图" onChange={(event) => { const file = event.target.files?.[0]; event.target.value = ""; if (file) void files.replaceBase(file); }} />
      <input hidden ref={dataFile} type="file" accept=".csv,.json,.txt,text/csv,application/json" aria-label="导入批量数据" onChange={(event) => { const file = event.target.files?.[0]; event.target.value = ""; if (file) void files.importData(file); }} />
    </div>
  );
}
