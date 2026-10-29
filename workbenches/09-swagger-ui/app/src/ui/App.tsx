import { useEffect, useEffectEvent, useRef, useState } from "react";
import { analyzeModel, blank, seed, validate } from "../contracts/model";
import {
  analyzeSpec,
  convertSource,
  type OperationEntry,
  type SpecFormat,
} from "../contracts/openapi";
import { isAppInfo } from "../contracts/app";
import { AutosaveStatus } from "./AutosaveStatus";
import { ApiDocs, type DocsHandle, type TryCall } from "./ApiDocs";
import { Directory } from "./Directory";
import type { EditorHandle } from "./SourceEditor";
import { SourcePane } from "./SourcePane";
import { FileBar, missingMessage, PaneTabs, TryAlert, type Pane, type Sheet } from "./Chrome";
import {
  DraftPanel,
  FileMenu,
  TrySettings,
  type HostState,
  type ImportProblem,
} from "./Panels";
import { readWorkingCopy } from "./recovery";
import { request, useProjects, Notice } from "./workspace";
import { exportSpec, fileName, placeholder, readSpecFile } from "./files";

const BLOCKING = new Set(
  "BLOCKED_PRIVATE BLOCKED_SELF RELATIVE DNS CONNECT TIMEOUT OFFLINE TOO_LARGE BUSY".split(" "),
);
const narrow = () => window.matchMedia("(max-width: 760px)").matches;
export function App() {
  const project = useProjects(seed, validate, "社区图书馆借阅 API", {
    storageKey: "swagger-ui-studio",
  });
  const format = project.data.format;
  const extra = project.draft;
  // 0.3.0 把未应用 JSON 存在 openapiText/appliedText 中。
  const legacyDraft =
    typeof extra.openapiText === "string" && extra.openapiText !== extra.appliedText
      ? extra.openapiText
      : null;
  const editorDraft = typeof extra.editorText === "string" ? extra.editorText : legacyDraft;
  const text = editorDraft ?? project.data.source;
  const [checked, setChecked] = useState(text);
  const checkedAnalysis = analyzeSpec(checked, format);
  const applied = analyzeModel(project.data);

  const [sheet, setSheet] = useState<Sheet>(null);
  const [split, setSplit] = useState(editorDraft !== null);
  const [pane, setPane] = useState<Pane>("docs");
  const [switching, setSwitching] = useState(false);
  const [importProblem, setImportProblem] = useState<ImportProblem | null>(null);
  const [allowPrivate, setAllowPrivate] = useState(false);
  const [calls, setCalls] = useState<TryCall[]>([]);
  const [tryAlert, setTryAlert] = useState<TryCall | null>(null);
  const [host, setHost] = useState<HostState>("checking");
  const [activeOp, setActiveOp] = useState("");
  const docs = useRef<DocsHandle>(null);
  const editor = useRef<EditorHandle>(null);
  const specFile = useRef<HTMLInputElement>(null);
  const recoveryFile = useRef<HTMLInputElement>(null);
  const navigation = useRef(false);
  const sourceOpen = split || pane === "source";

  const clearEditorDraft = (value?: string) =>
    project.setDraft((old) => {
      if (value !== undefined && typeof old.editorText === "string" && old.editorText !== value)
        return old;
      if (!("editorText" in old) && !("openapiText" in old) && !("appliedText" in old)) return old;
      const next = { ...old };
      delete next.editorText;
      delete next.openapiText;
      delete next.appliedText;
      return next;
    });

  /** 停止输入后解析；无错误则作为已应用模型保存，否则保持为源码草稿。 */
  const check = useEffectEvent((value: string) => {
    setChecked(value);
    const result = analyzeSpec(value, format);
    if (!result.spec) return;
    if (value !== project.data.source) {
      if (
        result.title &&
        result.title !== applied.title &&
        project.title.trim() === applied.title
      )
        project.setTitle(result.title.slice(0, 120));
      project.setData({ format, source: value });
    }
    if (editorDraft !== null) clearEditorDraft(value);
  });
  useEffect(() => {
    if (text === checked) return;
    const timer = setTimeout(() => check(text), 400);
    return () => clearTimeout(timer);
  }, [text, checked]);
  const loaded = useEffectEvent(() => {
    check(text);
    setImportProblem(null);
    if (editorDraft !== null) setSplit(true);
  });
  useEffect(() => loaded(), [project.documentKey]);

  function edit(value: string) {
    project.setDraft((old) => {
      const next: Record<string, unknown> = { ...old, editorText: value };
      delete next.openapiText;
      delete next.appliedText;
      return next;
    });
  }

  async function navigate(action: () => Promise<boolean>) {
    if (navigation.current) return false;
    navigation.current = true;
    setSwitching(true);
    try {
      return await action();
    } catch (error) {
      project.report(error);
      return false;
    } finally {
      navigation.current = false;
      setSwitching(false);
    }
  }
  async function openDocument(action: () => Promise<boolean>, message: string) {
    if (await navigate(action)) {
      setSheet(null);
      setPane("docs");
      project.setNotice(message);
      return true;
    }
    return false;
  }

  async function importFile(file: File) {
    try {
      const result = await readSpecFile(file);
      if (!result.ok) return setImportProblem(result.problem);
      setImportProblem(null);
      await openDocument(
        () => project.replace(result.model, result.title, {}),
        `已导入「${file.name}」为新规格（${result.model.format.toUpperCase()} 原文），原规格保留在最近列表中。`,
      );
    } catch (error) {
      project.report(error);
    }
  }
  async function importAsDraft() {
    const problem = importProblem;
    if (!problem || !problem.text) return;
    const title = problem.name.replace(/\.[^.]+$/, "").slice(0, 120) || "导入的规格";
    if (
      await openDocument(
        () => project.replace(placeholder(title, problem.format), title, { editorText: problem.text }),
        `已把「${problem.name}」作为源码草稿打开，修正诊断中的错误后自动更新文档。`,
      )
    ) {
      setImportProblem(null);
      setSplit(true);
      setPane("source");
    }
  }
  async function importRecovery(file: File) {
    await openDocument(async () => {
      const copy = await readWorkingCopy(file, validate);
      return project.replace(copy.data, copy.title, copy.extra);
    }, "已从恢复稿另建规格。");
  }
  function exportSource(target: SpecFormat) {
    if (!applied.spec) return;
    exportSpec(project.data, applied.spec, target, project.title);
    project.setNotice(
      target === format
        ? "已导出原文。"
        : `已另存为 ${target.toUpperCase()}${format === "yaml" ? "（YAML 注释不会保留）" : ""}。`,
    );
  }
  function convertDocument() {
    const target: SpecFormat = format === "yaml" ? "json" : "yaml";
    if (!applied.spec || editorDraft !== null) return;
    if (
      format === "yaml" &&
      /(^|\s)#/.test(project.data.source) &&
      !confirm("转换为 JSON 会丢失 YAML 注释，确定转换吗？")
    )
      return;
    project.setData({ format: target, source: convertSource(applied.spec, target) });
    project.setNotice(`源码已转换为 ${target.toUpperCase()}。`);
  }

  function goTo(operation: OperationEntry) {
    setActiveOp(operation.method + " " + operation.path);
    const mobile = narrow();
    docs.current?.focus(operation.path, operation.method, operation.tags, !sourceOpen || mobile);
    if (mobile) setPane("docs");
    else if (sourceOpen) {
      const target =
        checkedAnalysis.operations.find(
          (item) => item.method === operation.method && item.path === operation.path,
        ) ?? operation;
      if (target.line) editor.current?.jump(target.line);
    }
  }
  function onCall(call: TryCall) {
    setCalls((list) => [call, ...list].slice(0, 12));
    setTryAlert(call.code && BLOCKING.has(call.code) ? call : null);
  }

  const checkHost = useEffectEvent(async () => {
    setHost("checking");
    try {
      const info = await request("/api/app");
      setHost(isAppInfo(info) ? info.platform : "unavailable");
    } catch {
      setHost("unavailable");
    }
  });
  useEffect(() => {
    if (sheet === "draft") void checkHost();
  }, [sheet]);

  useEffect(() => {
    if (!project.notice) return;
    const timer = setTimeout(() => project.setNotice(""), 4500);
    return () => clearTimeout(timer);
  }, [project.notice]);

  const prompt = typeof extra.aiPrompt === "string" ? extra.aiPrompt : "";
  const errors = checkedAnalysis.diagnostics.filter((item) => item.severity === "error").length;
  const checking = text !== checked;
  const saveState =
    editorDraft !== null && project.autoState.phase === "saved"
      ? {
          ...project.autoState,
          phase: "draft" as const,
          message: errors
            ? `源码有 ${errors} 处错误，已作为草稿保存；文档保持上次有效版本。`
            : "源码草稿已保存，正在检查…",
        }
      : project.autoState;
  const versionLabel =
    applied.version === "2.0" ? "Swagger 2.0" : applied.version ? "OAS " + applied.version : "";

  return (
    <main
      className="api-shell"
      inert={switching}
      aria-busy={switching}
      data-pane={pane}
      data-split={sourceOpen ? "true" : "false"}
    >
      <a className="skip" href="#api-reference">
        跳到接口文档
      </a>
      <FileBar
        title={applied.title || project.title}
        apiVersion={applied.apiVersion}
        versionLabel={versionLabel}
        format={format}
        saveStatus={
          <AutosaveStatus
            state={saveState}
            onRetry={() => void project.save()}
            onExport={project.exportDraft}
            onReload={project.current ? () => void project.open(project.current!.id) : undefined}
          />
        }
        sheet={sheet}
        split={split}
        setSplit={setSplit}
        draftErrors={editorDraft !== null ? errors : 0}
        allowPrivate={allowPrivate}
        onSheet={(next) => {
          setSheet(next);
          if (next === "file") void project.refresh().catch(() => {});
        }}
      />
      <PaneTabs
        pane={pane}
        setPane={setPane}
        operations={applied.operations.length}
        draftErrors={editorDraft !== null ? errors : 0}
      />
      <div className="workspace">
        <aside className="directory-pane">
          <Directory
            analysis={applied}
            active={activeOp}
            onOperation={goTo}
            onModels={() => {
              if (narrow()) setPane("docs");
              docs.current?.section("models");
            }}
            onAuthorize={() => {
              if (narrow()) setPane("docs");
              docs.current?.section("authorize");
            }}
          />
        </aside>
        {sourceOpen ? (
          <SourcePane
            editorRef={editor}
            fileLabel={`${fileName(project.title)}.${format === "yaml" ? "yaml" : "json"}`}
            format={format}
            text={text}
            onChange={edit}
            diagnostics={checkedAnalysis.diagnostics}
            checking={checking}
            canConvert={editorDraft === null}
            onConvert={convertDocument}
            onClose={() => {
              setSplit(false);
              if (pane === "source") setPane("docs");
            }}
          />
        ) : null}
        <section id="api-reference" className="docs-pane" aria-label="接口参考文档" tabIndex={-1}>
          <ApiDocs
            ref={docs}
            spec={applied.spec}
            allowPrivate={allowPrivate}
            onCall={onCall}
            onMissing={(what) => project.setError(missingMessage(what))}
          />
          {tryAlert ? (
            <TryAlert
              call={tryAlert}
              onClose={() => setTryAlert(null)}
              onAllow={() => {
                setAllowPrivate(true);
                setTryAlert(null);
                project.setNotice("已允许本机与内网目标（仅本次会话），请再次点击 Execute。");
              }}
              onEditServers={() => {
                setSplit(true);
                setPane("source");
                setTryAlert(null);
              }}
            />
          ) : null}
        </section>
      </div>
      <div className="toast-zone">
        <Notice error={project.error} notice={project.notice} />
      </div>
      <FileMenu
        open={sheet === "file"}
        onClose={() => setSheet(null)}
        locked={switching || project.busy}
        items={project.items}
        currentId={project.current?.id}
        title={project.title}
        onRename={project.setTitle}
        format={format}
        sourceLength={project.data.source.length}
        hasDraft={editorDraft !== null}
        importProblem={importProblem}
        onNew={() => {
          void openDocument(() => project.replace(blank, "新接口规格", {}), "已新建空白规格。").then(
            (done) => {
              if (done) {
                setSplit(true);
                if (narrow()) setPane("source");
              }
            },
          );
        }}
        onSample={() =>
          void openDocument(
            () => project.replace(seed, "社区图书馆借阅 API", {}),
            "已打开图书馆示例，可直接试调内置示例服务。",
          )
        }
        onImport={() => specFile.current?.click()}
        onImportDraft={() => void importAsDraft()}
        onExport={() => exportSource(format)}
        onExportOther={() => exportSource(format === "yaml" ? "json" : "yaml")}
        onOpen={(id) => void openDocument(() => project.open(id), "已打开规格。")}
        onRefresh={() => void project.refresh().catch(project.report)}
        onRecoveryDownload={project.exportDraft}
        onRecoveryImport={() => recoveryFile.current?.click()}
        onRemove={() =>
          void openDocument(() => project.remove(), "已删除规格，回到图书馆示例。")
        }
      />
      <TrySettings
        open={sheet === "try"}
        onClose={() => setSheet(null)}
        allowPrivate={allowPrivate}
        setAllowPrivate={setAllowPrivate}
        calls={calls}
      />
      <DraftPanel
        open={sheet === "draft"}
        onClose={() => setSheet(null)}
        host={host}
        onRecheck={() => void checkHost()}
        prompt={prompt}
        setPrompt={(value) => project.setDraft((old) => ({ ...old, aiPrompt: value }))}
        busy={project.aiBusy}
        onGenerate={() => void project.generate(prompt)}
        suggestion={project.suggestion?.source ?? null}
        onApply={() => {
          const suggestion = project.suggestion;
          if (!suggestion) return;
          if (editorDraft !== null && !confirm("当前源码草稿尚未通过检查，采用候选会替换它。继续吗？"))
            return;
          const title = analyzeModel(suggestion).title;
          if (title && project.title.trim() === applied.title) project.setTitle(title.slice(0, 120));
          project.setData(suggestion);
          clearEditorDraft();
          project.discardSuggestion();
          setSheet(null);
          project.setNotice("已采用候选规格，可在源码中继续修改。");
        }}
        onDiscard={project.discardSuggestion}
      />
      <input
        ref={specFile}
        className="sr-only"
        type="file"
        tabIndex={-1}
        aria-label="选择 OpenAPI 或 Swagger 文件"
        accept=".yaml,.yml,.json,application/json,application/yaml,text/yaml"
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (file) void importFile(file);
        }}
      />
      <input
        ref={recoveryFile}
        className="sr-only"
        type="file"
        tabIndex={-1}
        aria-label="选择恢复稿"
        accept=".json,application/json"
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (file) void importRecovery(file);
        }}
      />
    </main>
  );
}
