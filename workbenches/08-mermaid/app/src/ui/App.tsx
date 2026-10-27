import { lazy, Suspense, useState } from "react";
import { seed, validate } from "../contracts/model";
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
  const project = useProjects(seed, validate, "需求处理流程");
  const [svg, setSvg] = useState(""),
    [status, setStatus] = useState("正在渲染…"),
    [prompt, setPrompt] = useState(""),
    [ai, setAi] = useState(false);
  const ready = status === "预览已更新";
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
            {project.busy ? "保存中…" : "保存草稿"}
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
        <span className="save-status">
          {project.dirty
            ? "有未保存修改"
            : project.current
              ? "已保存"
              : "新草稿"}
        </span>
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
            <h1>图形源码</h1>
            <span>{project.data.source.split("\n").length} 行</span>
          </div>
          <label className="sr-only" htmlFor="source">
            Mermaid 源码
          </label>
          <textarea
            id="source"
            name="mermaidSource"
            spellCheck={false}
            autoComplete="off"
            wrap="off"
            value={project.data.source}
            onChange={(e) => project.setData({ source: e.target.value })}
          />
          <footer>Flowchart · Sequence · Class · State</footer>
        </section>
        <section className="preview-panel">
          <div className="panel-heading">
            <h2>画布预览</h2>
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
          <footer>修改左侧文字，图形在这里更新。</footer>
        </section>
      </div>
    </main>
  );
}
