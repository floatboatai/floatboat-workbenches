import { AutosaveStatus } from "./AutosaveStatus";
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
  const project = useProjects(seed, validate, "本周渠道表现", {
    storageKey: "vega-lite-studio",
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

  const [error, setError] = useState(""),
    [svg, setSvg] = useState(""),
    [status, setStatus] = useState("正在计算图表…");
  const canonical = JSON.stringify(project.data.spec, null, 2);
  const draft =
    typeof project.draft.jsonText === "string"
      ? project.draft.jsonText
      : canonical;
  const applied =
    typeof project.draft.appliedText === "string"
      ? project.draft.appliedText
      : canonical;
  const setDraft = (text: string) =>
    project.setDraft((old) => ({ ...old, jsonText: text }));
  const changed = draft !== applied,
    ready = status === "图表已更新" && !changed;
  useEffect(() => {
    setError("");
  }, [project.documentKey, project.loadEpoch]);
  const saveState =
    changed && project.autoState.phase === "saved"
      ? {
          ...project.autoState,
          phase: "draft" as const,
          message: "规格草稿已自动保存，尚未应用绘图。",
        }
      : project.autoState;
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
      project.setDraft((old) => ({
        ...old,
        jsonText: draft,
        appliedText: draft,
      }));
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
            <small>SPECIFICATION LAB</small>
          </div>
        </div>
        <ProjectPicker
          items={project.items}
          id={project.current?.id}
          disabled={project.busy}
          onOpen={(id) => {
            void project.open(id);
          }}
        />
        <div className="header-actions">
          <button
            onClick={() => {
              void project.fresh();
            }}
            disabled={project.busy}
          >
            新建
          </button>
          <button
            className="accent"
            disabled={project.busy}
            onClick={() => void project.save()}
          >
            {project.busy ? "保存中…" : "立即保存"}
          </button>
        </div>
      </header>
      <section className="experiment-name">
        <div>
          <p>实验文件 / Vega-Lite</p>
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
              void project.remove();
            }}
          >
            删除
          </button>
        </div>
      </section>
      <div className="lab-save">
        <AutosaveStatus
          state={saveState}
          onRetry={() => void project.save()}
          onExport={project.exportDraft}
          onReload={
            project.current
              ? () => void project.open(project.current!.id)
              : undefined
          }
        />
      </div>
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
              maxLength={12000}
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
                  if (discardDraft() && project.suggestion) {
                    const text = JSON.stringify(
                      project.suggestion.spec,
                      null,
                      2,
                    );
                    project.applySuggestion();
                    project.setDraft((old) => ({
                      ...old,
                      jsonText: text,
                      appliedText: text,
                    }));
                  }
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
        <section className="result-panel">
          <header>
            <h1>图表结果</h1>
            <span className="result-state" role="status">
              {ready ? "已同步" : changed ? "规格待应用" : status}
            </span>
          </header>
          <div className="paper">
            <RenderBoundary key={project.documentKey + ":" + project.loadEpoch}>
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
            <h2>
              数据表 <small>预览前15行</small>
            </h2>
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
        <section className="spec-panel">
          <header>
            <h2>JSON 规格</h2>
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
      </div>
    </main>
  );
}
