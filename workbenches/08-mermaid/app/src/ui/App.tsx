import { AutosaveStatus } from "./AutosaveStatus";
import { lazy, Suspense, useState, useRef } from "react";
import { seed, validate, restoreDraftData } from "../contracts/model";
import {
  download,
  useProjects,
  ProjectPicker,
  Notice,
  RenderBoundary,
} from "./workspace";
const Diagram = lazy(() =>
  import("./Diagram").then((module) => ({ default: module.Diagram })),
);
export function App() {
  const project = useProjects(seed, validate, "需求处理流程", {
    storageKey: "mermaid-studio",
    restoreDraftData,
  });
  const prompt =
    typeof project.draft.aiPrompt === "string" ? project.draft.aiPrompt : "";
  const setPrompt = (text: string) =>
    project.setDraft((old) => ({ ...old, aiPrompt: text }));
  const ai = project.draft.aiPanel === true;
  const setAi = (value: boolean | ((current: boolean) => boolean)) =>
    project.setDraft((old) => ({
      ...old,
      aiPanel:
        typeof value === "function" ? value(old.aiPanel === true) : value,
    }));

  const [svg, setSvg] = useState(""),
    [status, setStatus] = useState("正在渲染…");
  const ready = status === "预览已更新";
  const gutter = useRef<HTMLPreElement>(null);
  const lines = project.data.source.split("\n").length;
  return (
    <main className="mermaid-shell">
      <a className="skip" href="#source">
        跳到源码
      </a>
      <header className="topbar">
        <a className="wordmark" href="#source" translate="no">
          MERMAID<span>图形工坊</span>
        </a>
        <ProjectPicker
          items={project.items}
          id={project.current?.id}
          disabled={project.busy}
          onOpen={(id) => void project.open(id)}
        />
        <div className="actions">
          <button onClick={project.fresh} disabled={project.busy}>
            新建
          </button>
          <button
            className="accent"
            onClick={() => void project.save()}
            disabled={project.busy}
          >
            {project.busy ? "保存中…" : "立即保存"}
          </button>
          <button onClick={() => setAi((value) => !value)} aria-expanded={ai}>
            AI 起草
          </button>
        </div>
      </header>
      <section className="document-strip">
        <label className="title-field">
          <span className="sr-only">项目名称</span>
          <input
            aria-label="项目名称"
            name="title"
            autoComplete="off"
            value={project.title}
            maxLength={120}
            onChange={(e) => project.setTitle(e.target.value)}
          />
        </label>
        <AutosaveStatus
          state={project.autoState}
          onRetry={() => void project.save()}
          onExport={project.exportDraft}
          onReload={
            project.current
              ? () => void project.open(project.current!.id)
              : undefined
          }
        />
        <div className="exports">
          <button
            onClick={() =>
              download(
                new Blob([project.data.source], { type: "text/plain" }),
                project.title + ".mmd",
              )
            }
          >
            导出源码
          </button>
          <button
            disabled={!ready || !svg}
            onClick={() =>
              download(
                new Blob([svg], { type: "image/svg+xml" }),
                project.title + ".svg",
              )
            }
          >
            导出 SVG
          </button>
          <button
            className="delete"
            disabled={!project.current || project.busy}
            onClick={() => void project.remove()}
          >
            删除
          </button>
        </div>
      </section>
      <Notice error={project.error} notice={project.notice} />
      {ai ? (
        <section className="ai-drawer">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void project.generate(prompt);
            }}
          >
            <label htmlFor="prompt">想画什么？</label>
            <input
              id="prompt"
              name="prompt"
              maxLength={12000}
              autoComplete="off"
              required
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="例如：客户反馈的分派与处理流程…"
            />
            <button disabled={project.aiBusy}>
              {project.aiBusy ? "正在起草…" : "生成候选稿"}
            </button>
          </form>
          {project.suggestion ? (
            <div className="candidate">
              <pre>{project.suggestion.source}</pre>
              <button onClick={project.applySuggestion}>采用生成稿</button>
              <p>采用后会替换当前源码，保存前仍可继续编辑。</p>
            </div>
          ) : (
            <p>生成内容会先显示为候选稿，不会自动覆盖当前源码。</p>
          )}
        </section>
      ) : null}
      <div className="editor-grid">
        <section className="source-panel">
          <div className="panel-heading">
            <h1 title={project.title + ".mmd"}>
              {project.title || "untitled"}.mmd
            </h1>
            <span>{project.data.source.split("\n").length} 行</span>
          </div>
          <label className="sr-only" htmlFor="source">
            Mermaid 源码
          </label>
          <div className="code-editor">
            <pre ref={gutter} className="line-numbers" aria-hidden="true">
              {Array.from({ length: lines }, (_, i) => i + 1).join("\n")}
            </pre>
            <textarea
              id="source"
              name="mermaidSource"
              spellCheck={false}
              autoComplete="off"
              wrap="off"
              onScroll={(event) => {
                if (gutter.current)
                  gutter.current.scrollTop = event.currentTarget.scrollTop;
              }}
              value={project.data.source}
              onChange={(e) => project.setData({ source: e.target.value })}
            />
          </div>
          <footer>
            <span>Mermaid · UTF-8</span>
            <span>
              {lines} 行 / {project.data.source.length} 字符
            </span>
          </footer>
        </section>
        <section className="preview-panel">
          <div className="panel-heading">
            <h2>图形预览</h2>
            <span className={ready ? "ready" : "pending"} role="status">
              {ready ? "已同步" : "待更新"}
            </span>
          </div>
          <p
            className={
              "render-status " +
              (status.startsWith("预览未更新") ? "error" : "")
            }
            role={status.startsWith("预览未更新") ? "alert" : "status"}
          >
            {status}
          </p>
          <RenderBoundary>
            <Suspense fallback={<p role="status">正在加载图形引擎…</p>}>
              <Diagram
                source={project.data.source}
                onSvg={setSvg}
                onStatus={setStatus}
              />
            </Suspense>
          </RenderBoundary>
          <footer>源码编辑后自动更新预览 · 错误时保留上一版图形</footer>
        </section>
      </div>
    </main>
  );
}
