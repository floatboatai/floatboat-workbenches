import { lazy, Suspense, useEffect, useState } from "react";
import { seed, validate } from "../contracts/model";
import { isRecord } from "../contracts/project";
import {
  download,
  useProjects,
  ProjectPicker,
  Notice,
  RenderBoundary,
} from "./workspace";
const Chart = lazy(() =>
  import("./Chart").then((module) => ({ default: module.Chart })),
);
export function App() {
  const project = useProjects(seed, validate, "本周渠道表现");
  const [draft, setDraft] = useState(() => JSON.stringify(seed.spec, null, 2)),
    [error, setError] = useState(""),
    [svg, setSvg] = useState(""),
    [status, setStatus] = useState("正在计算图表…"),
    [prompt, setPrompt] = useState(""),
    [ai, setAi] = useState(false);
  useEffect(() => {
    setDraft(JSON.stringify(project.data.spec, null, 2));
    setError("");
  }, [project.data]);
  const changed = draft !== JSON.stringify(project.data.spec, null, 2),
    ready = status === "图表已更新" && !changed;
  useEffect(() => {
    if (!changed) return;
    const before = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", before);
    return () => window.removeEventListener("beforeunload", before);
  }, [changed]);
  function discardDraft() {
    return !changed || confirm("有尚未应用的 JSON 修改，确定放弃吗？");
  }
  const data =
    isRecord(project.data.spec.data) &&
    Array.isArray(project.data.spec.data.values)
      ? project.data.spec.data.values.filter(isRecord)
      : [];
  const columns = data.length ? Object.keys(data[0]) : [];
  function apply() {
    try {
      const spec: unknown = JSON.parse(draft);
      project.setData(validate({ spec }));
      setError("");
    } catch (value) {
      setError(value instanceof Error ? value.message : "规格格式无效。");
    }
  }
  return (
    <main className="lab">
      <a className="skip" href="#chart-spec">
        跳到规格编辑器
      </a>
      <header className="lab-header">
        <div className="identity">
          <span>VL</span>
          <div>
            <strong>图表规格实验台</strong>
            <small>DATA · ENCODING · VIEW</small>
          </div>
        </div>
        <ProjectPicker
          items={project.items}
          id={project.current?.id}
          disabled={project.busy}
          onOpen={(id) => {
            if (project.dirty || discardDraft()) void project.open(id);
          }}
        />
        <div className="header-actions">
          <button
            onClick={() => {
              if (project.dirty || discardDraft()) project.fresh();
            }}
            disabled={project.busy}
          >
            新建
          </button>
          <button
            className="accent"
            disabled={project.busy || changed}
            onClick={() => void project.save()}
          >
            {project.busy ? "保存中…" : "保存实验"}
          </button>
        </div>
      </header>
      <section className="experiment-name">
        <div>
          <p>可复现的图表，从一个明确的规格开始</p>
          <label>
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
        </div>
        <div className="experiment-tools">
          <button onClick={() => setAi((value) => !value)} aria-expanded={ai}>
            AI 拟定规格
          </button>
          <button
            disabled={changed}
            onClick={() =>
              download(
                new Blob([JSON.stringify(project.data.spec, null, 2)], {
                  type: "application/json",
                }),
                project.title + ".vl.json",
              )
            }
          >
            导出规格
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
            className="danger"
            disabled={!project.current || project.busy}
            onClick={() => {
              if (discardDraft()) void project.remove();
            }}
          >
            删除
          </button>
        </div>
      </section>
      <Notice error={project.error} notice={project.notice} />
      {ai ? (
        <section className="ai-strip">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void project.generate(prompt);
            }}
          >
            <label htmlFor="prompt">图表目标</label>
            <input
              id="prompt"
              name="prompt"
              required
              autoComplete="off"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="例如：比较四个渠道本周的有效线索…"
            />
            <button disabled={project.aiBusy}>
              {project.aiBusy ? "正在生成…" : "生成候选规格"}
            </button>
          </form>
          {project.suggestion ? (
            <div className="proposal">
              <pre>{JSON.stringify(project.suggestion.spec, null, 2)}</pre>
              <button
                className="accent"
                onClick={() => {
                  if (discardDraft()) project.applySuggestion();
                }}
              >
                采用候选规格
              </button>
            </div>
          ) : (
            <p>确认数据与字段后再采用生成稿。</p>
          )}
        </section>
      ) : null}
      <div className="lab-grid">
        <section className="spec-panel">
          <header>
            <h1>
              <span>01</span>规格
            </h1>
            <button onClick={apply} className="accent">
              应用并绘图
            </button>
          </header>
          <label className="sr-only" htmlFor="chart-spec">
            Vega-Lite JSON 规格
          </label>
          <textarea
            id="chart-spec"
            name="chartSpec"
            autoComplete="off"
            spellCheck={false}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            aria-invalid={!!error}
          />
          <p role={error ? "alert" : "status"} className={error ? "error" : ""}>
            {error
              ? "规格未采用：" + error
              : changed
                ? "有尚未应用的规格修改"
                : "当前规格已应用"}
          </p>
        </section>
        <section className="result-panel">
          <header>
            <h2>
              <span>02</span>结果
            </h2>
            <span className="result-state" role="status">
              {ready ? "已同步" : changed ? "规格待应用" : status}
            </span>
          </header>
          <div className="paper">
            <RenderBoundary key={project.current?.id ?? "new"}>
              <Suspense fallback={<p role="status">正在加载图表引擎…</p>}>
                <Chart
                  spec={project.data.spec}
                  onSvg={setSvg}
                  onStatus={setStatus}
                />
              </Suspense>
            </RenderBoundary>
          </div>
          {status.startsWith("图表未更新") ? (
            <p className="error" role="alert">
              {status}
            </p>
          ) : null}
          <div className="data-caption">
            <h3>数据依据</h3>
            <span>
              {data.length} 行 · {columns.length} 列
            </span>
          </div>
          <div className="data-scroll">
            <table>
              <thead>
                <tr>
                  {columns.map((column) => (
                    <th key={column}>{column}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.slice(0, 15).map((row, index) => (
                  <tr key={index}>
                    {columns.map((column) => (
                      <td key={column}>{String(row[column] ?? "—")}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="footnote">仅使用规格内嵌的数据。画布随窗口宽度调整。</p>
        </section>
      </div>
    </main>
  );
}
