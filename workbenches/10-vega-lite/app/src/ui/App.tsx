// ABOUTME: Vega-Lite 图表实验台主界面：图表舞台为主，右侧规格检查器，下方数据窗；文件生命周期在「文件」菜单。
import { useEffect, useMemo, useRef, useState } from "react";
import { DATASET_ACCEPT, parseDataset, type DatasetColumn } from "../contracts/datasets";
import { isRecord } from "../contracts/project";
import { referencedDatasets } from "../contracts/render-spec";
import { analyzeSpecText, type SpecAnalysis } from "../contracts/spec-analysis";
import { formatSpec, insertEncoding, withDataset } from "../contracts/spec-edit";
import { useChartActions } from "./actions";
import { AiPanel } from "./AiPanel";
import { AutosaveStatus } from "./AutosaveStatus";
import { Chart, type ChartHandle, type ChartState } from "./Chart";
import { datasetText, loadSchemaTools, type SchemaTools } from "./data-client";
import { DataWindow, type Channel, type InlineTable } from "./DataWindow";
import { FileMenu, GalleryGrid, Modal } from "./Dialogs";
import { ExportControl, safeFileName, type Scale } from "./ExportControl";
import { SPEC_ACCEPT } from "./files";
import { Inspector, summarize } from "./Inspector";
import type { EditorHandle } from "./SpecEditor";
import { download, RenderBoundary, useChartFiles } from "./workspace";

type Dialog = "file" | "gallery" | null;
type Pane = "chart" | "spec" | "data";

export function App() {
  const project = useChartFiles();
  const { spec, datasets } = project.data;
  const [dialog, setDialog] = useState<Dialog>(null);
  const [tools, setTools] = useState<SchemaTools | null>(null);
  const [schemaError, setSchemaError] = useState("");
  const [chartState, setChartState] = useState<ChartState>({ phase: "loading", message: "正在加载图表引擎…" });
  const [pane, setPane] = useState<Pane>("chart");
  const fileButton = useRef<HTMLButtonElement>(null);
  const specInput = useRef<HTMLInputElement>(null);
  const dataInput = useRef<HTMLInputElement>(null);
  const recoveryInput = useRef<HTMLInputElement>(null);
  const editor = useRef<EditorHandle>(null);
  const chart = useRef<ChartHandle>(null);

  useEffect(() => {
    let live = true;
    loadSchemaTools().then(
      (value) => live && setTools(value),
      (error: unknown) => live && setSchemaError(error instanceof Error ? error.message : "无法加载 schema。"),
    );
    return () => {
      live = false;
    };
  }, []);

  // —— 规格原文、分析与自动应用 ——
  const canonical = useMemo(() => formatSpec(spec), [spec]);
  const text = typeof project.draft.jsonText === "string" ? project.draft.jsonText : canonical;
  const setText = (next: string) => project.setDraft((old) => ({ ...old, jsonText: next }));
  const [analysis, setAnalysis] = useState<{ text: string; key: string; result: SpecAnalysis } | null>(null);
  const setData = project.setData;
  const analyzedSets = useRef(datasets);
  useEffect(() => {
    // 首次、切换文件或数据集变化时立即分析；连续输入时防抖。
    const fresh = analysis === null || analysis.key !== project.documentKey || analyzedSets.current !== datasets;
    analyzedSets.current = datasets;
    const timer = window.setTimeout(
      () => {
        const result = analyzeSpecText(text, datasets, tools?.check ?? null);
        setAnalysis({ text, key: project.documentKey, result });
        if (result.spec && JSON.stringify(result.spec) !== JSON.stringify(spec)) {
          const next = result.spec;
          setData((old) => ({ ...old, spec: next }));
        }
      },
      fresh ? 0 : 260,
    );
    return () => clearTimeout(timer);
    // spec 变化只由这里写入；不把 spec 作为依赖，避免应用后重复分析。
  }, [text, datasets, tools, project.documentKey]);
  const current = analysis?.text === text && analysis.key === project.documentKey ? analysis.result : null;
  const errors = current?.problems.filter((item) => item.severity === "error") ?? [];
  const settled = !!current && current.schemaChecked && errors.length === 0;

  const saveState =
    errors.length && project.autoState.phase === "saved"
      ? { ...project.autoState, phase: "draft" as const, message: `规格草稿已自动保存，修正 ${errors.length} 处错误后生效。` }
      : project.autoState;

  const actions = useChartActions(project, { closeDialog: () => setDialog(null), showPane: setPane });
  const { switching, importing, navigate } = actions;

  // —— 规格结构化修改（通过编辑器写入，可撤销） ——
  const parsedSpec = current && current.problems.every((item) => item.source !== "JSON" && item.source !== "结构") ? (() => {
    try {
      const value: unknown = JSON.parse(text);
      return isRecord(value) ? value : null;
    } catch {
      return null;
    }
  })() : null;
  function rewrite(next: Record<string, unknown>) {
    const formatted = formatSpec(next);
    if (editor.current) editor.current.replaceAll(formatted);
    else setText(formatted);
  }
  function insertField(column: DatasetColumn, channel: Channel, dataset: string | null) {
    if (!parsedSpec) return;
    rewrite(insertEncoding(parsedSpec, { name: column.name, type: column.type }, channel, dataset));
    project.setNotice(`已把 ${column.name} 放到 ${channel} 通道。`);
  }

  const name = project.title.trim() || "未命名图表";
  const save = project.save;
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "s") {
        event.preventDefault();
        void save();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [save]);

  const ai = project.draft.aiPanel === true;
  const scale: Scale = project.draft.exportScale === 1 || project.draft.exportScale === 3 ? project.draft.exportScale : 2;
  const used = useMemo(() => referencedDatasets(spec, datasets), [spec, datasets]);
  const inline = useMemo((): InlineTable | null => {
    const values = isRecord(spec.data) && Array.isArray(spec.data.values) ? spec.data.values.filter(isRecord) : null;
    if (!values?.length) return null;
    try {
      return parseDataset(JSON.stringify(values.slice(0, 5000)), "json");
    } catch {
      return null;
    }
  }, [spec]);
  const dataTab = typeof project.draft.dataTab === "string" ? project.draft.dataTab : used.values().next().value ?? "";
  const dataOpen = project.draft.dataCollapsed !== true;
  const kinds = useMemo(() => summarize(spec), [spec]);
  const exportReady = chartState.phase === "ready" && settled;
  const exportReason = errors.length
    ? `规格有 ${errors.length} 处错误，修正后才能导出图片。`
    : chartState.phase === "error"
      ? "图表未能绘制，修正后才能导出图片。"
      : "正在绘制最新图表…";
  const focusProblem = (from: number, to: number) => {
    setPane("spec");
    editor.current?.focusAt(from, to);
  };

  return (
    <main
      className="lab"
      inert={switching}
      aria-busy={switching}
      onDragOver={(event) => {
        if (event.dataTransfer.types.includes("Files")) event.preventDefault();
      }}
      onDrop={(event) => {
        const files = [...event.dataTransfer.files];
        if (!files.length) return;
        event.preventDefault();
        void actions.importFiles(files);
      }}
    >
      <a
        className="skip"
        href="#spec"
        onClick={(event) => {
          event.preventDefault();
          setPane("spec");
          editor.current?.focus();
        }}
      >
        跳到规格编辑器
      </a>
      <h1 className="sr-only">Vega-Lite 图表实验台：{name}</h1>
      <header className="topbar">
        <button
          ref={fileButton}
          type="button"
          className="file-button"
          aria-haspopup="dialog"
          aria-expanded={dialog === "file"}
          onClick={() => {
            setDialog("file");
            void project.refresh().catch(() => undefined);
          }}
        >
          <span className="glyph" aria-hidden="true">
            ▦
          </span>
          文件
        </button>
        <label className="title-field">
          <span className="sr-only">图表名称</span>
          <input
            name="title"
            autoComplete="off"
            spellCheck={false}
            value={project.title}
            maxLength={120}
            onChange={(event) => project.setTitle(event.target.value)}
          />
        </label>
        <AutosaveStatus
          state={saveState}
          onRetry={() => void project.save()}
          onExport={project.exportDraft}
          onReload={project.current ? () => void navigate(() => project.open(project.current!.id)) : undefined}
        />
        <div className="topbar-actions">
          <button type="button" onClick={() => setDialog("gallery")}>
            示例库
          </button>
          <button
            type="button"
            className={ai ? "on" : ""}
            aria-expanded={ai}
            aria-controls="ai-panel"
            onClick={() => project.setDraft((old) => ({ ...old, aiPanel: !ai }))}
          >
            AI 拟定
          </button>
        </div>
      </header>
      {project.error ? (
        <p className="notice error" role="alert">
          {project.error}
          <button type="button" className="link-button" onClick={() => project.setError("")}>
            知道了
          </button>
        </p>
      ) : project.notice ? (
        <p className="notice" role="status">
          {project.notice}
        </p>
      ) : null}
      {ai ? <AiPanel project={project} onAdopt={(next) => rewrite(next)} /> : null}
      <div className="pane-tabs" role="tablist" aria-label="视图">
        {(
          [
            ["chart", "图表"],
            ["spec", "规格"],
            ["data", "数据"],
          ] as const
        ).map(([key, label]) => (
          <button key={key} type="button" role="tab" aria-selected={pane === key} onClick={() => setPane(key)}>
            {label}
            {key === "spec" && errors.length ? <span className="dot" aria-label="有错误" /> : null}
          </button>
        ))}
      </div>
      <div className={"lab-grid" + (dataOpen ? "" : " data-collapsed")} data-pane={pane}>
        <section className="chart-pane" aria-labelledby="chart-heading">
          <div className="chart-toolbar">
            <h2 id="chart-heading">图表</h2>
            <span className="kinds" translate="no">
              {kinds.map((kind) => (
                <span key={kind}>{kind}</span>
              ))}
            </span>
            <span className={"render-state " + chartState.phase} role="status">
              {chartState.phase === "loading"
                ? chartState.message
                : chartState.phase === "error"
                  ? "未能绘制"
                  : errors.length
                    ? "显示上一次有效版本"
                    : chartState.log.warnings.length
                      ? `已绘制 · ${chartState.log.warnings.length} 条提示`
                      : "已绘制"}
            </span>
            <ExportControl
              chart={chart}
              ready={exportReady}
              reason={exportReason}
              name={name}
              specText={text}
              scale={scale}
              onScale={(value) => project.setDraft((old) => ({ ...old, exportScale: value }))}
              onBundle={() => void actions.exportBundle()}
              notify={project.setNotice}
              fail={project.setError}
            />
          </div>
          {errors.length ? (
            <div className="banner error" role="alert">
              <span>
                规格第 {errors[0].line} 行：{errors[0].message}
                {errors.length > 1 ? `（共 ${errors.length} 处）` : ""} 图表保持上一次有效版本。
              </span>
              <button type="button" className="link-button" onClick={() => focusProblem(errors[0].from, errors[0].to)}>
                定位
              </button>
            </div>
          ) : chartState.phase === "error" ? (
            <div className="banner error" role="alert">
              <span>{chartState.message}</span>
            </div>
          ) : chartState.phase === "ready" && chartState.log.warnings.length ? (
            <details className="banner warn">
              <summary>Vega-Lite 提示 {chartState.log.warnings.length} 条</summary>
              <ul>
                {chartState.log.warnings.map((line, index) => (
                  <li key={index}>{line}</li>
                ))}
              </ul>
            </details>
          ) : null}
          <RenderBoundary label="图表">
            <Chart spec={spec} datasets={datasets} handle={chart} onState={setChartState} />
          </RenderBoundary>
        </section>

        <Inspector
          text={text}
          resetKey={project.documentKey}
          analysis={current}
          problemSource={analysis?.text ?? ""}
          schema={tools?.schema ?? null}
          schemaError={schemaError}
          datasets={datasets}
          canFormat={!!parsedSpec}
          onFormat={() => {
            if (parsedSpec) rewrite(parsedSpec);
          }}
          onChange={setText}
          onFocusProblem={focusProblem}
          handle={editor}
        />

        <div className="data-pane" id="data">
          <button
            type="button"
            className="data-toggle"
            aria-expanded={dataOpen}
            onClick={() => project.setDraft((old) => ({ ...old, dataCollapsed: dataOpen }))}
          >
            {dataOpen ? "收起数据窗" : "展开数据窗"}
          </button>
          {dataOpen || pane === "data" ? (
            <DataWindow
              datasets={datasets}
              inline={inline}
              selected={dataTab}
              used={used}
              canInsert={!!parsedSpec}
              importing={importing}
              onSelect={(value) => project.setDraft((old) => ({ ...old, dataTab: value }))}
              onImport={() => dataInput.current?.click()}
              onInsert={insertField}
              onUse={(ref) => {
                if (!parsedSpec) return;
                rewrite(withDataset(parsedSpec, ref.name));
                project.setNotice(`规格已改用数据集 ${ref.name}。点字段芯片把字段放到 x、y、color 等通道。`);
              }}
              onRemove={(ref) => {
                if (
                  !confirm(
                    used.has(ref.name)
                      ? `规格正在使用 ${ref.name}，移除后图表将没有数据。确定移除吗？`
                      : `从当前图表移除数据集 ${ref.name}？可以随时重新导入同一文件。`,
                  )
                )
                  return;
                setData((old) => ({ ...old, datasets: old.datasets.filter((item) => item.name !== ref.name) }));
                project.setNotice(`已从图表移除数据集 ${ref.name}。`);
              }}
              onDownload={(ref) =>
                void datasetText(ref.id).then(
                  (content) => download(new Blob([content], { type: "text/plain;charset=utf-8" }), ref.file),
                  project.report,
                )
              }
            />
          ) : null}
        </div>
      </div>

      <Modal open={dialog === "file"} onClose={() => setDialog(null)} fallbackFocus={fileButton} title="图表文件" eyebrow="VEGA-LITE" className="file-sheet">
        <FileMenu
          items={project.items}
          currentId={project.current?.id}
          title={name}
          locked={switching || project.busy}
          onNew={actions.newBlank}
          onGallery={() => setDialog("gallery")}
          onImport={() => specInput.current?.click()}
          onOpen={(id) =>
            void navigate(() => project.open(id)).then((done) => {
              if (done) setDialog(null);
            })
          }
          onExportBundle={() => void actions.exportBundle()}
          onDownloadSpec={() => download(new Blob([text + "\n"], { type: "application/json" }), safeFileName(name, "vl.json"))}
          onRecoveryDownload={project.exportDraft}
          onRecoveryImport={() => recoveryInput.current?.click()}
          onRefresh={() => void project.refresh().catch(project.report)}
          onRemove={() =>
            void navigate(() => project.remove()).then((done) => {
              if (!done) return;
              setDialog(null);
              project.setNotice("已删除图表。");
            })
          }
        />
      </Modal>
      <Modal open={dialog === "gallery"} onClose={() => setDialog(null)} fallbackFocus={fileButton} title="从示例新建" eyebrow="示例库 · 内置演示数据" className="gallery-sheet">
        <GalleryGrid onPick={actions.fromExample} locked={switching} />
      </Modal>
      <input
        ref={specInput}
        hidden
        type="file"
        accept={SPEC_ACCEPT}
        aria-label="导入 Vega-Lite 规格或项目包"
        onChange={(event) => {
          const files = [...(event.target.files ?? [])];
          event.target.value = "";
          if (files.length) void actions.importFiles(files);
        }}
      />
      <input
        ref={dataInput}
        hidden
        type="file"
        multiple
        accept={DATASET_ACCEPT}
        aria-label="导入数据文件"
        onChange={(event) => {
          const files = [...(event.target.files ?? [])];
          event.target.value = "";
          if (files.length) void actions.addDatasets(files);
        }}
      />
      <input
        ref={recoveryInput}
        hidden
        type="file"
        accept=".json,application/json"
        aria-label="导入恢复稿"
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (file) void actions.importRecovery(file);
        }}
      />
    </main>
  );
}
