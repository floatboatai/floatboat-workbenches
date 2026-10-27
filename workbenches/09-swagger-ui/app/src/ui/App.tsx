import { AutosaveStatus } from "./AutosaveStatus";
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
  const project = useProjects(seed, validate, "工作台接口参考", {
    storageKey: "swagger-ui-studio",
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

  const [edit, setEdit] = useState(false),
    [parseError, setParseError] = useState("");
  const file = useRef<HTMLInputElement>(null);
  const canonical = JSON.stringify(project.data.spec, null, 2);
  const draft =
    typeof project.draft.openapiText === "string"
      ? project.draft.openapiText
      : canonical;
  const applied =
    typeof project.draft.appliedText === "string"
      ? project.draft.appliedText
      : canonical;
  const setDraft = (text: string) =>
    project.setDraft((old) => ({ ...old, openapiText: text }));
  const draftChanged = draft !== applied;
  useEffect(() => {
    setEdit(typeof project.draft.openapiText === "string");
    setParseError("");
  }, [project.documentKey, project.loadEpoch]);
  const saveState =
    draftChanged && project.autoState.phase === "saved"
      ? {
          ...project.autoState,
          phase: "draft" as const,
          message: "编辑草稿已自动保存，尚未应用到接口文档。",
        }
      : project.autoState;
  function discardDraft() {
    return !draftChanged || confirm("有尚未应用的 JSON 修改，确定放弃吗？");
  }
  const info = isRecord(project.data.spec.info) ? project.data.spec.info : {};
  const paths = isRecord(project.data.spec.paths)
    ? project.data.spec.paths
    : {};
  const operationList = Object.entries(paths).flatMap(([path, value]) =>
    isRecord(value)
      ? Object.keys(value)
          .filter((method) =>
            [
              "get",
              "post",
              "put",
              "patch",
              "delete",
              "head",
              "options",
              "trace",
            ].includes(method),
          )
          .map((method) => ({ path, method }))
      : [],
  );
  function focusOperation(path: string, method: string) {
    const frame = document.querySelector<HTMLIFrameElement>(
      'iframe[title="Swagger 接口参考"]',
    );
    const block = Array.from(
      frame?.contentDocument?.querySelectorAll(".opblock") ?? [],
    ).find(
      (item) =>
        item.classList.contains("opblock-" + method) &&
        item.querySelector("[data-path]")?.getAttribute("data-path") === path,
    );
    if (!block) {
      project.setError("接口文档仍在加载，请稍后重试。");
      return;
    }
    if (!block.classList.contains("is-open"))
      block
        .querySelector<HTMLButtonElement>(".opblock-summary-control")
        ?.click();
    block.scrollIntoView({ block: "start", behavior: "auto" });
  }
  function apply() {
    try {
      const value: unknown = JSON.parse(draft);
      project.setData(validate({ spec: value }));
      project.setDraft((old) => ({
        ...old,
        openapiText: draft,
        appliedText: draft,
      }));
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
      const data = validate({ spec: JSON.parse(text) });
      const info = isRecord(data.spec.info) ? data.spec.info : {};
      const title =
        (typeof info.title === "string" ? info.title : selected.name)
          .trim()
          .slice(0, 120) || "导入接口";
      if (
        await project.replace(data, title, {
          openapiText: text,
          appliedText: text,
        })
      ) {
        setEdit(true);
        setParseError("");
      }
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
          <span aria-hidden="true">{"{ }"}</span>
          <strong>Swagger</strong>
          <small>接口参考台</small>
        </div>
        <ProjectPicker
          items={project.items}
          id={project.current?.id}
          disabled={project.busy}
          onOpen={(id) => {
            void project.open(id);
          }}
        />
        <div className="actions">
          <button
            onClick={() => {
              void project.fresh();
            }}
            disabled={project.busy}
          >
            新建规格
          </button>
          <button
            className="primary"
            onClick={() => void project.save()}
            disabled={project.busy}
          >
            {project.busy ? "保存中…" : "立即保存"}
          </button>
          <button aria-expanded={ai} onClick={() => setAi((value) => !value)}>
            AI 起草规格
          </button>
        </div>
      </header>
      <div className="api-workspace">
        <aside className="api-sidebar">
          <label className="title-input">
            <span>当前文档</span>
            <input
              aria-label="项目名称"
              name="title"
              autoComplete="off"
              value={project.title}
              maxLength={120}
              onChange={(e) => project.setTitle(e.target.value)}
            />
          </label>
          <p className="api-version">
            OpenAPI {String(project.data.spec.openapi)} · v
            {String(info.version ?? "—")}
          </p>
          <div className="sidebar-tools">
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
          </div>
          <nav className="operation-nav" aria-label="端点目录">
            <h2>
              端点目录 <span>{operationList.length}</span>
            </h2>
            {operationList.length ? (
              operationList.map((operation) => (
                <button
                  key={operation.method + operation.path}
                  onClick={() =>
                    focusOperation(operation.path, operation.method)
                  }
                >
                  <span className={"method " + operation.method}>
                    {operation.method.toUpperCase()}
                  </span>
                  <code>{operation.path}</code>
                </button>
              ))
            ) : (
              <p>应用规格后在这里浏览端点。</p>
            )}
          </nav>
          <div className="sidebar-bottom">
            <p>支持同源 GET 试调。外部服务需单独接入，凭据不随项目保存。</p>
            <button
              className="danger"
              onClick={() => {
                void project.remove();
              }}
              disabled={!project.current || project.busy}
            >
              删除项目
            </button>
          </div>
        </aside>
        <div className="api-content">
          <div className="document-state">
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
            <span>
              {draftChanged ? "JSON尚未应用 · " : ""}只读试调 · 同源 GET
            </span>
          </div>
          <Notice error={project.error} notice={project.notice} />
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
                  maxLength={12000}
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
                      if (discardDraft() && project.suggestion) {
                        const text = JSON.stringify(
                          project.suggestion.spec,
                          null,
                          2,
                        );
                        project.applySuggestion();
                        project.setDraft((old) => ({
                          ...old,
                          openapiText: text,
                          appliedText: text,
                        }));
                      }
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
          <div className={"spec-and-docs " + (edit ? "editing" : "")}>
            {edit ? (
              <section className="spec-editor">
                <div className="editor-caption">
                  <span>openapi.json</span>
                  <button onClick={apply} className="primary">
                    应用 JSON
                  </button>
                </div>
                <label className="sr-only" htmlFor="spec-source">
                  OpenAPI JSON
                </label>
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
                  <p>应用后更新右侧参考文档。</p>
                )}
              </section>
            ) : null}
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
          </div>
        </div>
      </div>
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
