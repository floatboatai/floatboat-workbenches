import { lazy, Suspense, useMemo, useRef, useState } from "react";
import { seed, validate, rowsFrom, type Model } from "../contracts/model";
import {
  download,
  useProjects,
  ProjectPicker,
  Notice,
  RenderBoundary,
} from "./workspace";
const PlotView = lazy(() =>
  import("./PlotView").then((module) => ({ default: module.PlotView })),
);
export function App() {
  const project = useProjects(seed, validate, "本周访问趋势");
  const [svg, setSvg] = useState(""),
    [renderError, setRenderError] = useState(""),
    [prompt, setPrompt] = useState(""),
    [ai, setAi] = useState(false),
    [tab, setTab] = useState<"source" | "table">("table");
  const file = useRef<HTMLInputElement>(null);
  const latestProject = useRef(project);
  latestProject.current = project;
  const parsed = useMemo(() => {
    try {
      return { rows: rowsFrom(project.data), error: "" };
    } catch (error) {
      return {
        rows: [],
        error: error instanceof Error ? error.message : "数据格式无效。",
      };
    }
  }, [project.data.format, project.data.source]);
  const columns = parsed.rows.length ? Object.keys(parsed.rows[0]) : [];
  const valid = useMemo(() => {
    try {
      return { model: validate(project.data), error: "" };
    } catch (error) {
      return {
        model: null,
        error: error instanceof Error ? error.message : "图表配置无效。",
      };
    }
  }, [project.data]);
  function update<K extends keyof Model>(key: K, value: Model[K]) {
    project.setData((old) => ({ ...old, [key]: value }));
  }
  async function importFile(selected: File) {
    try {
      if (selected.size > 500000)
        throw new Error("文件超过 500 KB，请缩小数据范围。");
      const source = await selected.text();
      const format = selected.name.toLowerCase().endsWith(".json")
        ? "json"
        : "csv";
      const rows = rowsFrom({ source, format });
      const keys = Object.keys(rows[0]);
      const y =
        keys.find((key) =>
          rows.every(
            (row) =>
              row[key] !== "" &&
              row[key] !== null &&
              Number.isFinite(Number(row[key])),
          ),
        ) ??
        keys[1] ??
        keys[0];
      const current = latestProject.current;
      const imported = validate({
        ...current.data,
        source,
        format,
        x: keys[0],
        y,
      });
      if (
        current.dirty &&
        !confirm("有未保存的修改，确定导入并替换当前数据和字段映射吗？")
      )
        return;
      current.setData(imported);
      current.setError("");
      setTab("table");
    } catch (error) {
      project.report(error);
    }
  }
  return (
    <main className="observatory">
      <a className="skip" href="#data-source">
        跳到数据输入
      </a>
      <header className="journal-header">
        <div className="journal-brand">
          <span>◌</span>
          <strong>数据观察室</strong>
          <small>OBSERVABLE PLOT</small>
        </div>
        <div className="project-nav">
          <ProjectPicker
            items={project.items}
            id={project.current?.id}
            disabled={project.busy}
            onOpen={(id) => void project.open(id)}
          />
          <button onClick={project.fresh} disabled={project.busy}>
            新建观察
          </button>
        </div>
      </header>
      <section className="title-row">
        <div>
          <p className="eyebrow">让数据呈现它的形状</p>
          <label>
            <span className="sr-only">项目名称</span>
            <input
              aria-label="项目名称"
              name="title"
              autoComplete="off"
              maxLength={120}
              value={project.title}
              onChange={(e) => project.setTitle(e.target.value)}
            />
          </label>
        </div>
        <div className="primary-actions">
          <span role="status">
            {project.dirty ? "尚未保存" : project.current ? "已保存" : "新项目"}
          </span>
          <button
            className="primary"
            onClick={() => void project.save()}
            disabled={project.busy || !!valid.error}
          >
            {project.busy ? "保存中…" : "保存观察"}
          </button>
          <button
            disabled={!svg || !!valid.error || !!renderError}
            onClick={() =>
              download(
                new Blob([svg], { type: "image/svg+xml" }),
                project.title + ".svg",
              )
            }
          >
            导出 SVG
          </button>
        </div>
      </section>
      <Notice error={project.error} notice={project.notice} />
      <section className="plot-controls" aria-label="图表设置">
        <div className="mark-switch" role="group" aria-label="图形类型">
          {(
            [
              ["line", "趋势线"],
              ["bar", "柱状图"],
              ["dot", "散点图"],
            ] as const
          ).map(([kind, label]) => (
            <button
              key={kind}
              aria-pressed={project.data.kind === kind}
              onClick={() => update("kind", kind)}
            >
              {label}
            </button>
          ))}
        </div>
        <label>
          横轴
          <select
            name="xField"
            aria-label="横轴字段"
            value={project.data.x}
            onChange={(e) => update("x", e.target.value)}
          >
            {!columns.includes(project.data.x) ? (
              <option value={project.data.x}>{project.data.x}（不可用）</option>
            ) : null}
            {columns.map((column) => (
              <option key={column}>{column}</option>
            ))}
          </select>
        </label>
        <label>
          数值
          <select
            name="yField"
            aria-label="数值字段"
            value={project.data.y}
            onChange={(e) => update("y", e.target.value)}
          >
            {!columns.includes(project.data.y) ? (
              <option value={project.data.y}>{project.data.y}（不可用）</option>
            ) : null}
            {columns.map((column) => (
              <option key={column}>{column}</option>
            ))}
          </select>
        </label>
        <button
          className="ai-toggle"
          aria-expanded={ai}
          onClick={() => setAi((value) => !value)}
        >
          AI 准备数据
        </button>
      </section>
      {ai ? (
        <section className="ai-panel">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void project.generate(prompt);
            }}
          >
            <label htmlFor="prompt">观察目标</label>
            <input
              id="prompt"
              name="prompt"
              autoComplete="off"
              required
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="例如：用五天的示例数据展示访问趋势…"
            />
            <button disabled={project.aiBusy}>
              {project.aiBusy ? "正在生成…" : "生成候选数据"}
            </button>
          </form>
          {project.suggestion ? (
            <div>
              <pre>{project.suggestion.source}</pre>
              <button className="primary" onClick={project.applySuggestion}>
                采用候选数据
              </button>
              <p>模型数据仅为候选，请核对来源与数值后保存。</p>
            </div>
          ) : null}
        </section>
      ) : null}
      <section className="chart-paper" aria-label="图表结果">
        {valid.model ? (
          <RenderBoundary>
            <Suspense fallback={<p role="status">正在加载绘图引擎…</p>}>
              <PlotView
                model={valid.model}
                onSvg={setSvg}
                onError={setRenderError}
              />
            </Suspense>
          </RenderBoundary>
        ) : (
          <div className="empty-chart">
            <strong>图表等待有效数据</strong>
            <p role="alert">{valid.error}</p>
          </div>
        )}
        {renderError ? (
          <p role="alert" className="error">
            {renderError}
          </p>
        ) : null}
        <footer>
          <span>{parsed.rows.length} 行数据</span>
          <span>悬停或点击数据点查看数值</span>
        </footer>
      </section>
      <section className="data-section">
        <header>
          <h1>观察数据</h1>
          <div className="data-tabs">
            <button
              aria-pressed={tab === "table"}
              onClick={() => setTab("table")}
            >
              数据表
            </button>
            <button
              aria-pressed={tab === "source"}
              onClick={() => setTab("source")}
            >
              编辑数据
            </button>
          </div>
          <div className="data-actions">
            <button onClick={() => file.current?.click()}>
              导入 CSV / JSON
            </button>
            <button
              onClick={() =>
                download(
                  new Blob([project.data.source], {
                    type:
                      project.data.format === "csv"
                        ? "text/csv"
                        : "application/json",
                  }),
                  project.title + "." + project.data.format,
                )
              }
            >
              导出数据
            </button>
            <button
              className="danger"
              disabled={!project.current || project.busy}
              onClick={() => void project.remove()}
            >
              删除观察
            </button>
          </div>
        </header>
        <div hidden={tab !== "source"} className="source-editor">
          <label htmlFor="data-format">
            数据格式
            <select
              id="data-format"
              name="format"
              value={project.data.format}
              onChange={(e) =>
                update("format", e.target.value as Model["format"])
              }
            >
              <option value="csv">CSV</option>
              <option value="json">JSON 对象数组</option>
            </select>
          </label>
          <label htmlFor="data-source">数据内容</label>
          <textarea
            id="data-source"
            name="source"
            autoComplete="off"
            spellCheck={false}
            value={project.data.source}
            onChange={(e) => update("source", e.target.value)}
            aria-invalid={!!parsed.error}
          />
          {parsed.error ? (
            <p className="error" role="alert">
              {parsed.error}
            </p>
          ) : null}
        </div>
        <div hidden={tab !== "table"} className="table-scroll">
          {parsed.error ? (
            <p className="error" role="alert">
              {parsed.error}
            </p>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>#</th>
                  {columns.map((column) => (
                    <th key={column}>{column}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {parsed.rows.slice(0, 100).map((row, index) => (
                  <tr key={index}>
                    <td>{index + 1}</td>
                    {columns.map((column) => (
                      <td key={column}>{String(row[column] ?? "—")}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {parsed.rows.length > 100 ? (
            <p>预览前 100 行，图表使用全部 {parsed.rows.length} 行。</p>
          ) : null}
        </div>
      </section>
      <input
        className="sr-only"
        type="file"
        accept=".csv,.json,text/csv,application/json"
        ref={file}
        tabIndex={-1}
        onChange={(e) => {
          const selected = e.target.files?.[0];
          e.target.value = "";
          if (selected) void importFile(selected);
        }}
      />
    </main>
  );
}
