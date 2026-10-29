// ABOUTME: Mermaid 图形工坊主界面：源码 IDE 与图形预览双窗，文件菜单、模板库、导入导出与 AI 起草。
import { useEffect, useRef, useState } from "react";
import { blankSource, restoreDraftData, type Model } from "../contracts/model";
import { templates, type DiagramTemplate } from "../contracts/templates";
import { AiPanel } from "./AiPanel";
import { AutosaveStatus } from "./AutosaveStatus";
import { BlockChooser, FileMenu, Modal, TemplateGallery } from "./Dialogs";
import { diagramLabel } from "./engine";
import { ExportControl, downloadSource } from "./ExportControl";
import { IMPORT_ACCEPT, readDiagramFile, type ImportCandidate } from "./files";
import { AppearanceControls } from "./AppearanceControls";
import { Preview, type PreviewHandle } from "./Preview";
import { readWorkingCopy } from "./recovery";
import { ErrorBanner, StatusBar } from "./RenderStatus";
import { SourceEditor, type EditorHandle } from "./SourceEditor";
import { useDiagramRender } from "./useRender";
import { RenderBoundary, useDiagramFiles } from "./workspace";

type Dialog = "file" | "templates" | "chooser" | null;
export function App() {
  const project = useDiagramFiles();
  const { source, theme, look } = project.data;
  const [dialog, setDialog] = useState<Dialog>(null);
  const [candidates, setCandidates] = useState<ImportCandidate[]>([]);
  const [switching, setSwitching] = useState(false);
  const navigation = useRef(false);
  const [pane, setPane] = useState<"source" | "preview">("preview");
  const [zoom, setZoom] = useState(1);
  const fileButton = useRef<HTMLButtonElement>(null);
  const importInput = useRef<HTMLInputElement>(null);
  const recoveryInput = useRef<HTMLInputElement>(null);
  const editor = useRef<EditorHandle>(null);
  const preview = useRef<PreviewHandle>(null);

  const {
    rendered,
    failure,
    ready,
    pending,
    problems,
    problemSource,
    external,
  } = useDiagramRender(source, theme, look, project.documentKey);

  // ---- 文件生命周期 ----
  async function navigate(action: () => Promise<boolean>): Promise<boolean> {
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
  const closeDialog = () => setDialog(null);
  async function createFrom(model: Model, title: string, notice: string) {
    if (await navigate(() => project.replace(model, title, {}))) {
      setDialog(null);
      setPane("preview");
      project.setNotice(notice);
    }
  }
  const newBlank = () =>
    void createFrom(
      { source: blankSource, theme: "default", look: "classic" },
      "未命名图形",
      "已新建空白图形，编辑后自动保存。",
    );
  const fromTemplate = (template: DiagramTemplate) =>
    void createFrom(
      {
        source: template.source,
        theme: template.theme ?? "default",
        look: template.look ?? "classic",
      },
      template.title,
      `已从「${template.kind}」模板新建，编辑后自动保存。`,
    );
  const importCandidate = (candidate: ImportCandidate) =>
    void createFrom(
      { source: candidate.source, theme: "default", look: "classic" },
      candidate.title,
      `已导入为新图形「${candidate.title}」。`,
    );
  async function importFile(file: File) {
    try {
      const found = await readDiagramFile(file);
      if (found.length === 1) importCandidate(found[0]);
      else {
        setCandidates(found);
        setDialog("chooser");
      }
    } catch (error) {
      project.report(error);
    }
  }
  async function importRecovery(file: File) {
    await navigate(async () => {
      const copy = await readWorkingCopy(file, restoreDraftData);
      const done = await project.replace(copy.data, copy.title, copy.extra);
      if (done) {
        setDialog(null);
        project.setNotice(`已把恢复稿导入为新图形「${copy.title}」。`);
      }
      return done;
    });
  }

  const name = project.title.trim() || "未命名图形";

  // ⌘/Ctrl+S 立即保存
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
  const setAi = (value: boolean) =>
    project.setDraft((old) => ({ ...old, aiPanel: value }));

  const directiveTheme = /%%\{[\s\S]*?theme[\s\S]*?\}%%|^\s*theme\s*:/m.test(
    source,
  );
  const locate = (line: number, column: number) => {
    setPane("source");
    editor.current?.focusLine(line, column);
  };

  return (
    <main
      className="studio"
      inert={switching}
      aria-busy={switching}
      onDragOver={(event) => {
        if (event.dataTransfer.types.includes("Files")) event.preventDefault();
      }}
      onDrop={(event) => {
        const file = event.dataTransfer.files[0];
        if (!file) return;
        event.preventDefault();
        void importFile(file);
      }}
    >
      <a
        className="skip"
        href="#source"
        onClick={(event) => {
          event.preventDefault();
          setPane("source");
          editor.current?.focus();
        }}
      >
        跳到源码
      </a>
      <h1 className="sr-only">Mermaid 图形工坊：{name}</h1>
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
            ◇
          </span>
          文件
        </button>
        <label className="title-field">
          <span className="sr-only">图形名称</span>
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
          state={project.autoState}
          onRetry={() => void project.save()}
          onExport={project.exportDraft}
          onReload={
            project.current
              ? () => void navigate(() => project.open(project.current!.id))
              : undefined
          }
        />
        <div className="topbar-actions">
          <button type="button" onClick={() => setDialog("templates")}>
            模板库
          </button>
          <button
            type="button"
            className={ai ? "on" : ""}
            aria-expanded={ai}
            aria-controls="ai-panel"
            onClick={() => setAi(!ai)}
          >
            AI 起草
          </button>
        </div>
      </header>
      {project.error ? (
        <p className="notice error" role="alert">
          {project.error}
          <button
            type="button"
            className="link-button"
            onClick={() => project.setError("")}
          >
            知道了
          </button>
        </p>
      ) : project.notice ? (
        <p className="notice" role="status">
          {project.notice}
        </p>
      ) : null}
      {ai ? <AiPanel project={project} /> : null}
      <div className="pane-tabs" role="tablist" aria-label="视图">
        <button
          type="button"
          role="tab"
          aria-selected={pane === "source"}
          aria-controls="source"
          onClick={() => setPane("source")}
        >
          源码
          {failure ? <span className="dot" aria-label="有错误" /> : null}
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={pane === "preview"}
          aria-controls="preview"
          onClick={() => setPane("preview")}
        >
          图形
        </button>
      </div>
      <div className="workspace" data-pane={pane}>
        <section
          className="source-pane"
          aria-labelledby="source-heading"
          id="source"
        >
          <div className="pane-head">
            <h2 id="source-heading">源码</h2>
            <span className="lang" translate="no">
              Mermaid
            </span>
          </div>
          <RenderBoundary label="源码编辑器">
            <SourceEditor
              value={source}
              resetKey={project.documentKey}
              problems={problems}
              problemSource={problemSource}
              onChange={(value) =>
                project.setData((old) => ({ ...old, source: value }))
              }
              handle={editor}
              label="Mermaid 源码"
            />
          </RenderBoundary>
          <StatusBar
            source={source}
            pending={pending}
            failure={failure}
            external={external}
            onLocate={locate}
          />
        </section>
        <section
          className="preview-pane"
          id="preview"
          aria-labelledby="preview-heading"
        >
          <div className="preview-toolbar">
            <h2 id="preview-heading" className="sr-only">
              图形预览
            </h2>
            <AppearanceControls
              type={rendered ? diagramLabel(rendered.diagramType) : "图形"}
              theme={theme}
              look={look}
              directiveTheme={directiveTheme}
              zoom={zoom}
              onTheme={(value) =>
                project.setData((old) => ({ ...old, theme: value }))
              }
              onLook={(value) =>
                project.setData((old) => ({ ...old, look: value }))
              }
              preview={preview}
            />
            <ExportControl
              rendered={rendered}
              ready={ready}
              failure={failure}
              source={source}
              name={name}
              draft={project.draft}
              setDraft={project.setDraft}
              notify={project.setNotice}
              fail={project.setError}
            />
          </div>
          {failure ? (
            <ErrorBanner
              failure={failure}
              hasPrevious={rendered !== null}
              onLocate={locate}
            />
          ) : null}
          <RenderBoundary label="图形预览">
            <Preview
              rendered={rendered}
              stale={!!failure}
              fitKey={project.documentKey}
              handle={preview}
              onScale={setZoom}
            />
          </RenderBoundary>
          {!rendered && !failure ? (
            <p className="stage-loading" role="status">
              正在加载图形引擎…
            </p>
          ) : null}
        </section>
      </div>

      <Modal
        open={dialog === "file"}
        onClose={closeDialog}
        fallbackFocus={fileButton}
        title="图形文件"
        eyebrow="MERMAID"
        className="file-sheet"
      >
        <FileMenu
          items={project.items}
          currentId={project.current?.id}
          title={name}
          locked={switching || project.busy}
          onNew={newBlank}
          onTemplates={() => setDialog("templates")}
          onImport={() => importInput.current?.click()}
          onOpen={(id) =>
            void navigate(() => project.open(id)).then((done) => {
              if (done) setDialog(null);
            })
          }
          onDownloadSource={() => downloadSource(source, name)}
          onRecoveryDownload={project.exportDraft}
          onRecoveryImport={() => recoveryInput.current?.click()}
          onRefresh={() => void project.refresh().catch(project.report)}
          onRemove={() =>
            void navigate(() => project.remove()).then((done) => {
              if (!done) return;
              setDialog(null);
              project.setNotice("已删除图形。");
            })
          }
        />
      </Modal>
      <Modal
        open={dialog === "templates"}
        onClose={closeDialog}
        fallbackFocus={fileButton}
        title="从模板新建"
        eyebrow={`${templates.length} 个模板`}
        className="template-sheet"
      >
        <TemplateGallery onPick={fromTemplate} locked={switching} />
      </Modal>
      <Modal
        open={dialog === "chooser"}
        onClose={closeDialog}
        fallbackFocus={fileButton}
        title="选择要导入的图形"
        className="chooser-sheet"
      >
        <BlockChooser candidates={candidates} onPick={importCandidate} />
      </Modal>
      <input
        ref={importInput}
        hidden
        type="file"
        accept={IMPORT_ACCEPT}
        aria-label="导入 Mermaid 或 Markdown 文件"
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (file) void importFile(file);
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
          if (file) void importRecovery(file);
        }}
      />
    </main>
  );
}
