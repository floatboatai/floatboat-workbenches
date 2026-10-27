import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { seed, validate } from "../contracts/model";
import { isRecord } from "../contracts/project";
import {
  download,
  useProjects,
  ProjectPicker,
  Notice,
  RenderBoundary,
} from "./workspace";
const ApiDocs = lazy(() =>
  import("./ApiDocs").then((module) => ({ default: module.ApiDocs })),
);
export function App() {
  const project = useProjects(seed, validate, "工作台接口参考");
  const [draft, setDraft] = useState(() => JSON.stringify(seed.spec, null, 2)),
    [edit, setEdit] = useState(false),
    [prompt, setPrompt] = useState(""),
    [ai, setAi] = useState(false),
    [parseError, setParseError] = useState("");
  const file = useRef<HTMLInputElement>(null);
  useEffect(() => {
    setDraft(JSON.stringify(project.data.spec, null, 2));
    setParseError("");
  }, [project.data]);
  const draftChanged = draft !== JSON.stringify(project.data.spec, null, 2);
  useEffect(() => {
    if (!draftChanged) return;
    const before = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", before);
    return () => window.removeEventListener("beforeunload", before);
  }, [draftChanged]);
  function discardDraft() {
    return !draftChanged || confirm("有尚未应用的 JSON 修改，确定放弃吗？");
  }
  const info = isRecord(project.data.spec.info) ? project.data.spec.info : {};
  const paths = isRecord(project.data.spec.paths)
    ? project.data.spec.paths
    : {};
  const operations = Object.values(paths).reduce<number>(
    (count, value) =>
      count +
      (isRecord(value)
        ? Object.keys(value).filter((key) =>
            [
              "get",
              "post",
              "put",
              "patch",
              "delete",
              "head",
              "options",
            ].includes(key),
          ).length
        : 0),
    0,
  );
  function apply() {
    try {
      const value: unknown = JSON.parse(draft);
      project.setData(validate({ spec: value }));
      setParseError("");
    } catch (error) {
      setParseError(error instanceof Error ? error.message : "JSON 格式错误。");
    }
  }
  async function importFile(selected: File) {
    try {
      if (selected.size > 250000)
        throw new Error("文件超过 250 KB，请精简规格。");
      const text = await selected.text();
      validate({ spec: JSON.parse(text) });
      if (!discardDraft()) return;
      setDraft(text);
      setEdit(true);
      setParseError("");
    } catch (error) {
      project.report(error);
    }
  }
  return (
    <main className="api-shell">
      <a className="skip" href="#api-reference">
        跳到接口参考
      </a>
      <header className="masthead">
        <div className="brand">
          API<span>REFERENCE DESK</span>
        </div>
        <ProjectPicker
          items={project.items}
          id={project.current?.id}
          disabled={project.busy}
          onOpen={(id) => {
            if (project.dirty || discardDraft()) void project.open(id);
          }}
        />
        <div className="actions">
          <button
            onClick={() => {
              if (project.dirty || discardDraft()) project.fresh();
            }}
            disabled={project.busy}
          >
            新建规格
          </button>
          <button
            className="primary"
            onClick={() => void project.save()}
            disabled={project.busy || draftChanged}
          >
            {project.busy ? "保存中…" : "保存项目"}
          </button>
        </div>
      </header>
      <section className="intro">
        <div>
          <p className="eyebrow">接口契约 · 可读 · 可验证</p>
          <label className="title-input">
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
          <p className="description">
            把规格整理成清晰的接口目录，查看参数、响应与调用示例。
          </p>
        </div>
        <div className="metadata">
          <span>
            <strong>{String(project.data.spec.openapi)}</strong>OpenAPI
          </span>
          <span>
            <strong>{operations}</strong>个操作
          </span>
          <span>
            <strong>{String(info.version ?? "—")}</strong>接口版本
          </span>
        </div>
      </section>
      <nav className="document-tools" aria-label="规格操作">
        <button
          className={edit ? "selected" : ""}
          aria-expanded={edit}
          onClick={() => setEdit((value) => !value)}
        >
          {edit ? "收起 JSON" : "编辑 JSON"}
        </button>
        <button onClick={() => file.current?.click()}>导入 JSON</button>
        <button
          disabled={draftChanged}
          onClick={() =>
            download(
              new Blob([JSON.stringify(project.data.spec, null, 2)], {
                type: "application/json",
              }),
              project.title + ".json",
            )
          }
        >
          导出 JSON
        </button>
        <button aria-expanded={ai} onClick={() => setAi((value) => !value)}>
          AI 起草规格
        </button>
        <span role="status">
          {draftChanged
            ? "JSON 尚未应用"
            : project.dirty
              ? "有未保存修改"
              : project.current
                ? "已保存"
                : "新项目"}
        </span>
        <button
          className="danger"
          onClick={() => {
            if (discardDraft()) void project.remove();
          }}
          disabled={!project.current || project.busy}
        >
          删除项目
        </button>
      </nav>
      <Notice error={project.error} notice={project.notice} />
      {edit ? (
        <section className="spec-editor">
          <div className="editor-caption">
            <label htmlFor="spec-source">OpenAPI JSON</label>
            <button onClick={apply} className="primary">
              应用 JSON
            </button>
          </div>
          <textarea
            id="spec-source"
            name="openapi"
            autoComplete="off"
            spellCheck={false}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            aria-invalid={!!parseError}
          />
          {parseError ? (
            <p className="parse-error" role="alert">
              规格未采用：{parseError}
            </p>
          ) : (
            <p>编辑后点击「应用 JSON」更新参考文档，再保存到项目。</p>
          )}
        </section>
      ) : null}
      {ai ? (
        <section className="ai-panel">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void project.generate(prompt);
            }}
          >
            <label htmlFor="api-prompt">接口需求</label>
            <input
              id="api-prompt"
              name="prompt"
              autoComplete="off"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              required
              placeholder="例如：查询产品列表与单个产品详情…"
            />
            <button disabled={project.aiBusy}>
              {project.aiBusy ? "正在起草…" : "生成候选规格"}
            </button>
          </form>
          {project.suggestion ? (
            <div>
              <pre>{JSON.stringify(project.suggestion.spec, null, 2)}</pre>
              <button
                onClick={() => {
                  if (discardDraft()) project.applySuggestion();
                }}
                className="primary"
              >
                采用候选规格
              </button>
            </div>
          ) : (
            <p>候选规格需经你确认后才应用。</p>
          )}
        </section>
      ) : null}
      <section className="read-only-note">
        <strong>只读试调</strong>
        <span>
          「Try it out」只发送同源 GET
          请求。外部服务需要单独接入，授权信息不会随项目保存。
        </span>
      </section>
      <section
        id="api-reference"
        className="api-reference"
        aria-label="接口参考文档"
      >
        <h1 className="sr-only">{String(info.title ?? "接口参考")}</h1>
        <RenderBoundary>
          <Suspense
            fallback={
              <p role="status" className="loading">
                正在整理接口文档…
              </p>
            }
          >
            <ApiDocs spec={project.data.spec} />
          </Suspense>
        </RenderBoundary>
      </section>
      <input
        className="sr-only"
        type="file"
        accept=".json,application/json"
        tabIndex={-1}
        ref={file}
        onChange={(e) => {
          const selected = e.target.files?.[0];
          e.target.value = "";
          if (selected) void importFile(selected);
        }}
      />
    </main>
  );
}
