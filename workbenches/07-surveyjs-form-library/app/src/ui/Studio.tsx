import { AutoStatus, AutoFeedback } from "./AutosaveStatus";
import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  Check,
  Code2,
  Download,
  FileQuestion,
  Plus,
  Save,
  Sparkles,
  Trash2,
} from "lucide-react";
import {
  seed,
  responseValue,
  validateForm,
  restoreFormDraft,
  readFillDraft,
  partialAnswers,
  type FillDraft,
  type Question,
  type QuestionType,
  type ResponseRecord,
} from "../contracts/form";
import {
  download,
  Notice,
  ProjectPicker,
  RenderBoundary,
  request,
  useProjects,
} from "./workspace";
const SurveyRunner = lazy(() =>
  import("./SurveyRunner").then((module) => ({ default: module.SurveyRunner })),
);
const typeNames: Record<QuestionType, string> = {
  text: "简答",
  comment: "长文本",
  radiogroup: "单选",
  checkbox: "多选",
  dropdown: "下拉选择",
  boolean: "是 / 否",
  rating: "评分",
};
const choicesType = (type: QuestionType) =>
  ["radiogroup", "checkbox", "dropdown"].includes(type);
export function Studio() {
  const p = useProjects(seed, validateForm, "产品需求调研", {
    storageKey: "surveyjs-form-library",
    restoreDraftData: restoreFormDraft,
  });
  const jsonOpen = p.draft.jsonOpen === true,
    json =
      typeof p.draft.json === "string" && p.draft.json.length < 900000
        ? p.draft.json
        : "",
    jsonBase = typeof p.draft.jsonBase === "string" ? p.draft.jsonBase : "";
  const jsonDirty = jsonOpen && json !== jsonBase;
  const setJsonOpen = (value: boolean) =>
    p.setDraft((previous) => ({ ...previous, jsonOpen: value }));
  const setJson = (value: string) =>
    p.setDraft((previous) => ({ ...previous, json: value }));
  const setJsonBase = (value: string) =>
    p.setDraft((previous) => ({ ...previous, jsonBase: value }));
  let valid = true;
  try {
    validateForm(p.data);
  } catch {
    valid = false;
  }
  const tab: "design" | "fill" | "responses" =
    p.draft.tab === "responses"
      ? "responses"
      : p.draft.tab === "fill" && valid
        ? "fill"
        : "design";
  const setTab = (value: "design" | "fill" | "responses") =>
    p.setDraft((previous) => ({ ...previous, tab: value }));
  const selected =
    typeof p.draft.selected === "number" && Number.isInteger(p.draft.selected)
      ? Math.max(
          0,
          Math.min(p.draft.selected, p.data.schema.elements.length - 1),
        )
      : 0;
  const setSelected = (value: number) =>
    p.setDraft((previous) => ({ ...previous, selected: value }));
  const [newType, setNewType] = useState<QuestionType>("text"),
    [showAi, setShowAi] = useState(false);
  const prompt =
    typeof p.draft.prompt === "string" && p.draft.prompt.length <= 12000
      ? p.draft.prompt
      : "";
  const setPrompt = (value: string) =>
    p.setDraft((previous) => ({ ...previous, prompt: value }));
  const responseRequest = useRef(0);
  const [responses, setResponses] = useState<ResponseRecord[]>([]),
    [fetching, setFetching] = useState(false),
    [cycle, setCycle] = useState(0);
  const locked = p.busy || p.aiBusy,
    managementLocked = locked || tab === "fill";
  const question =
    p.data.schema.elements[selected] || p.data.schema.elements[0];
  let fillDraft: FillDraft | null = null,
    fillError = "";
  try {
    fillDraft = readFillDraft(p.draft.fill);
  } catch (error) {
    fillError = error instanceof Error ? error.message : "填写草稿无法读取。";
  }
  const fillingSchema = fillDraft?.schema ?? p.data.schema;
  const sameSchema =
    JSON.stringify(fillingSchema) === JSON.stringify(p.data.schema);
  useEffect(() => {
    setResponses([]);
    setShowAi(!!p.draft.__aiSuggestion || !!p.draft.prompt);
  }, [p.loadEpoch]);
  const loadResponses = useCallback(async () => {
    const token = ++responseRequest.current;
    if (!p.current) {
      setResponses([]);
      setFetching(false);
      return;
    }
    setFetching(true);
    try {
      const result = await request(`/api/projects/${p.current.id}/responses`);
      if (!Array.isArray(result)) throw new Error("答卷列表无效。");
      if (token === responseRequest.current)
        setResponses(result.map(responseValue));
    } catch (error) {
      if (token === responseRequest.current) p.report(error);
    } finally {
      if (token === responseRequest.current) setFetching(false);
    }
  }, [p.current?.id]);
  useEffect(() => {
    if (tab === "responses") void loadResponses();
    return () => {
      responseRequest.current++;
    };
  }, [tab, loadResponses]);
  function toggleJson() {
    if (jsonOpen) {
      if (jsonDirty && !confirm("JSON 草稿已保留。确定放弃这份未应用草稿吗？"))
        return;
      p.setDraft((previous) => ({
        ...previous,
        jsonOpen: false,
        json: "",
        jsonBase: "",
      }));
    } else {
      const text = JSON.stringify(p.data.schema, null, 2);
      p.setDraft((previous) => ({
        ...previous,
        jsonOpen: true,
        json: text,
        jsonBase: text,
      }));
    }
  }
  async function changeTab(next: typeof tab) {
    if (next === tab) return;
    if (next === "fill") {
      if (jsonDirty) {
        p.report(new Error("请先应用或放弃 JSON 草稿，再填写问卷。"));
        return;
      }
      try {
        validateForm(p.data);
      } catch (error) {
        p.report(error);
        return;
      }
      const saved = await p.save();
      if (!saved) return;
      const existing = fillDraft;
      if (!existing)
        p.setDraft((previous) => ({
          ...previous,
          tab: "fill",
          fill: {
            schema: saved.data.schema,
            answers: {},
            id: crypto.randomUUID(),
            revision: saved.revision,
            submitted: false,
          },
        }));
      else
        p.setDraft((previous) => ({
          ...previous,
          tab: "fill",
          fill: {
            ...existing,
            revision:
              JSON.stringify(existing.schema) ===
              JSON.stringify(saved.data.schema)
                ? saved.revision
                : existing.revision,
          },
        }));
      setCycle((value) => value + 1);
    } else setTab(next);
  }
  function captureAnswers(answers: unknown, id: string) {
    try {
      const clean = partialAnswers(fillingSchema, answers);
      p.setDraft((previous) => ({
        ...previous,
        fill: {
          schema: fillingSchema,
          answers: clean,
          id,
          revision: fillDraft?.revision ?? p.current?.revision ?? 1,
          submitted: false,
        },
      }));
    } catch (error) {
      p.report(error);
    }
  }
  async function submit(answers: unknown, id: string) {
    if (!sameSchema)
      throw new Error(
        "问卷定义已修改，原答案草稿已保留。请导出恢复草稿或重新填写当前版本。",
      );
    const clean = partialAnswers(fillingSchema, answers);
    p.setDraft((previous) => ({
      ...previous,
      fill: {
        schema: fillingSchema,
        answers: clean,
        id,
        revision: fillDraft?.revision ?? p.current?.revision ?? 1,
        submitted: false,
      },
    }));
    const saved = await p.save();
    if (!saved) throw new Error("填写草稿尚未同步，请恢复连接后重试提交。");
    const result = await request(`/api/projects/${saved.id}/responses`, {
      method: "POST",
      body: JSON.stringify({ id, revision: saved.revision, answers: clean }),
    });
    responseValue(result);
    p.setDraft((previous) => ({
      ...previous,
      fill: {
        schema: fillingSchema,
        answers: clean,
        id,
        revision: saved.revision,
        submitted: true,
      },
    }));
  }
  function again() {
    if (
      fillDraft &&
      !fillDraft.submitted &&
      Object.keys(fillDraft.answers).length &&
      !confirm("确定放弃当前未提交答案并开始新答卷吗？")
    )
      return;
    p.setDraft((previous) => ({
      ...previous,
      fill: {
        schema: p.data.schema,
        answers: {},
        id: crypto.randomUUID(),
        revision: p.current?.revision ?? 1,
        submitted: false,
      },
    }));
    setCycle((value) => value + 1);
  }
  function updateQuestion(patch: Partial<Question>) {
    p.setData({
      schema: {
        ...p.data.schema,
        elements: p.data.schema.elements.map((value, index) =>
          index === selected ? { ...value, ...patch } : value,
        ),
      },
    });
  }
  function addQuestion() {
    const next: Question = {
      name: "q_" + crypto.randomUUID().replaceAll("-", "").slice(0, 10),
      type: newType,
      title: "新的问题",
      isRequired: false,
      ...(choicesType(newType) ? { choices: ["选项一", "选项二"] } : {}),
    };
    setSelected(p.data.schema.elements.length);
    p.setData({
      schema: { ...p.data.schema, elements: [...p.data.schema.elements, next] },
    });
  }
  function removeQuestion() {
    const elements = p.data.schema.elements.filter(
      (_, index) => index !== selected,
    );
    setSelected(Math.max(0, selected - 1));
    p.setData({ schema: { ...p.data.schema, elements } });
  }
  function applyJson() {
    try {
      const value: unknown = JSON.parse(json);
      p.setData(validateForm({ schema: value }));
      setSelected(0);
      p.setDraft((previous) => ({
        ...previous,
        jsonOpen: false,
        json: "",
        jsonBase: "",
      }));
    } catch (error) {
      p.report(error);
    }
  }
  const safeName = p.title.replace(/[\\/:*?"<>|]/g, "_") || "问卷";
  return (
    <main className="form-studio">
      <a href="#form-content" className="skip-link">
        跳到问卷内容
      </a>
      <header className="form-header">
        <div className="form-brand">
          <FileQuestion aria-hidden="true" size={25} />
          <span>问卷工作台</span>
        </div>
        <div className="header-actions">
          <ProjectPicker
            items={p.items}
            id={p.current?.id}
            disabled={managementLocked}
            onOpen={(id) => void p.open(id)}
          />
          <button onClick={() => void p.fresh()} disabled={managementLocked}>
            <Plus aria-hidden="true" size={15} />
            新建
          </button>
          <button
            className="primary"
            onClick={() => void p.save()}
            disabled={managementLocked || jsonDirty}
          >
            <Save aria-hidden="true" size={15} />
            {p.busy ? "保存中…" : "立即保存"}
          </button>
          <button
            disabled={jsonDirty}
            title={jsonDirty ? "请先应用或放弃 JSON 草稿" : "导出当前问卷定义"}
            onClick={() =>
              download(
                new Blob([JSON.stringify(p.data.schema, null, 2)], {
                  type: "application/json",
                }),
                safeName + ".json",
              )
            }
          >
            <Download aria-hidden="true" size={15} />
            定义
          </button>
        </div>
      </header>
      <section className="form-heading">
        <h1 className="sr-only">问卷设计、填写与答卷</h1>
        <div className="project-meta">
          <label htmlFor="title">项目名称</label>
          <input
            id="title"
            name="title"
            autoComplete="off"
            maxLength={120}
            value={p.title}
            disabled={managementLocked}
            onChange={(event) => p.setTitle(event.target.value)}
          />
          <p>
            <AutoStatus state={p.autoState} loading={p.loading} />
            {jsonDirty ? " · JSON 草稿尚未应用" : ""} ·{" "}
            {p.data.schema.elements.length} 道题
          </p>
        </div>
      </section>
      <nav className="view-tabs" aria-label="问卷视图">
        <button
          aria-current={tab === "design" ? "page" : undefined}
          onClick={() => void changeTab("design")}
          disabled={locked}
        >
          01 设计问卷
        </button>
        <button
          aria-current={tab === "fill" ? "page" : undefined}
          onClick={() => void changeTab("fill")}
          disabled={locked}
        >
          02 填写问卷
        </button>
        <button
          aria-current={tab === "responses" ? "page" : undefined}
          onClick={() => void changeTab("responses")}
          disabled={locked}
        >
          03 查看答卷
        </button>
      </nav>
      <Notice error={p.error || fillError} notice={p.notice} />
      <AutoFeedback
        state={p.autoState}
        onRetry={() => void p.save()}
        onExport={p.exportDraft}
        onReload={p.current ? () => void p.open(p.current!.id) : undefined}
      />
      <div id="form-content">
        {tab === "design" ? (
          <>
            <div className="design-tools">
              <span>先定义问题，再填写收集。答案保存在当前工作空间。</span>
              <button
                onClick={toggleJson}
                disabled={locked}
                aria-expanded={jsonOpen}
              >
                <Code2 aria-hidden="true" size={15} />
                JSON 定义
              </button>
              <button
                onClick={() => setShowAi((value) => !value)}
                aria-expanded={showAi}
              >
                <Sparkles aria-hidden="true" size={15} />
                生成问卷
              </button>
              <button
                className="danger"
                onClick={() => void p.remove()}
                disabled={locked || !p.current}
                aria-label="删除问卷项目"
              >
                <Trash2 aria-hidden="true" size={15} />
              </button>
            </div>
            {jsonOpen ? (
              <section className="json-panel">
                <label htmlFor="schema-json">JSON 问卷定义</label>
                <textarea
                  id="schema-json"
                  disabled={locked}
                  name="schema"
                  autoComplete="off"
                  spellCheck={false}
                  value={json}
                  onChange={(event) => setJson(event.target.value)}
                />
                <button
                  className="primary"
                  disabled={locked}
                  onClick={applyJson}
                >
                  应用 JSON
                </button>
                <p>
                  仅支持纯文字和标准题型。应用后再保存；关闭编辑器可放弃草稿。
                </p>
              </section>
            ) : null}
            {showAi ? (
              <section className="form-ai">
                <form
                  onSubmit={(event) => {
                    event.preventDefault();
                    void p.generate(prompt);
                  }}
                >
                  <label htmlFor="prompt">这份问卷想了解什么？</label>
                  <textarea
                    id="prompt"
                    name="prompt"
                    autoComplete="off"
                    required
                    maxLength={12000}
                    value={prompt}
                    onChange={(event) => setPrompt(event.target.value)}
                    placeholder="例如：为一次产品内测设计 5 道反馈题…"
                  />
                  <button className="primary" disabled={locked}>
                    {p.aiBusy ? "正在生成…" : "生成建议"}
                  </button>
                </form>
                {p.suggestion ? (
                  <div>
                    <h2>{p.suggestion.schema.title}</h2>
                    <ol>
                      {p.suggestion.schema.elements.map((value) => (
                        <li key={value.name}>
                          {value.title} <small>{typeNames[value.type]}</small>
                        </li>
                      ))}
                    </ol>
                    <button
                      className="primary"
                      disabled={jsonOpen}
                      onClick={() => {
                        p.applySuggestion();
                        setSelected(0);
                      }}
                    >
                      采用问卷
                    </button>
                    <button onClick={p.discardSuggestion}>放弃建议</button>
                  </div>
                ) : null}
              </section>
            ) : null}
            <fieldset className="schema-fields" disabled={jsonOpen || locked}>
              <section className="schema-meta">
                <label>
                  问卷标题
                  <input
                    name="formTitle"
                    autoComplete="off"
                    value={p.data.schema.title}
                    maxLength={200}
                    onChange={(event) =>
                      p.setData({
                        schema: { ...p.data.schema, title: event.target.value },
                      })
                    }
                  />
                </label>
                <label>
                  开场说明
                  <textarea
                    name="description"
                    autoComplete="off"
                    maxLength={3000}
                    value={p.data.schema.description}
                    onChange={(event) =>
                      p.setData({
                        schema: {
                          ...p.data.schema,
                          description: event.target.value,
                        },
                      })
                    }
                  />
                </label>
              </section>
              <div className="question-layout">
                <section className="question-list" aria-label="题目列表">
                  {p.data.schema.elements.map((value, index) => (
                    <button
                      className={index === selected ? "selected" : ""}
                      key={index}
                      aria-pressed={index === selected}
                      onClick={() => setSelected(index)}
                    >
                      <span className="question-number">
                        {String(index + 1).padStart(2, "0")}
                      </span>
                      <span>
                        <strong>{value.title || "未命名问题"}</strong>
                        <small>
                          {typeNames[value.type]}
                          {value.isRequired ? " · 必答" : ""}
                        </small>
                      </span>
                    </button>
                  ))}
                  <div className="add-question">
                    <label className="sr-only" htmlFor="new-type">
                      新题型
                    </label>
                    <select
                      id="new-type"
                      value={newType}
                      onChange={(event) =>
                        setNewType(event.target.value as QuestionType)
                      }
                    >
                      {Object.entries(typeNames).map(([type, label]) => (
                        <option key={type} value={type}>
                          {label}
                        </option>
                      ))}
                    </select>
                    <button
                      onClick={addQuestion}
                      disabled={p.data.schema.elements.length >= 50}
                    >
                      <Plus aria-hidden="true" size={16} />
                      添加题目
                    </button>
                  </div>
                </section>
                <section className="question-editor">
                  <div className="editor-heading">
                    <span>问题 {selected + 1}</span>
                    <button
                      className="danger"
                      onClick={removeQuestion}
                      disabled={p.data.schema.elements.length <= 1}
                      aria-label="删除当前题目"
                    >
                      <Trash2 aria-hidden="true" size={15} />
                    </button>
                  </div>
                  <label htmlFor="question-title">你想问什么？</label>
                  <input
                    id="question-title"
                    name="questionTitle"
                    autoComplete="off"
                    maxLength={200}
                    value={question.title}
                    onChange={(event) =>
                      updateQuestion({ title: event.target.value })
                    }
                  />
                  <div className="question-settings">
                    <label>
                      题型
                      <select
                        value={question.type}
                        onChange={(event) => {
                          const type = event.target.value as QuestionType;
                          updateQuestion({
                            type,
                            choices: choicesType(type)
                              ? (question.choices ?? ["选项一", "选项二"])
                              : undefined,
                          });
                        }}
                      >
                        {Object.entries(typeNames).map(([type, label]) => (
                          <option key={type} value={type}>
                            {label}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      数据字段名
                      <input
                        name="fieldName"
                        autoComplete="off"
                        spellCheck={false}
                        maxLength={50}
                        value={question.name}
                        onChange={(event) =>
                          updateQuestion({ name: event.target.value })
                        }
                      />
                    </label>
                  </div>
                  <label className="required-toggle">
                    <input
                      type="checkbox"
                      checked={question.isRequired}
                      onChange={(event) =>
                        updateQuestion({ isRequired: event.target.checked })
                      }
                    />
                    这道题必须回答
                  </label>
                  {choicesType(question.type) ? (
                    <div className="choice-editor">
                      <h2>回答选项</h2>
                      {question.choices?.map((choice, index) => (
                        <div key={index}>
                          <label
                            className="sr-only"
                            htmlFor={"choice-" + index}
                          >
                            选项 {index + 1}
                          </label>
                          <input
                            id={"choice-" + index}
                            name={"choice" + index}
                            autoComplete="off"
                            maxLength={150}
                            value={choice}
                            onChange={(event) =>
                              updateQuestion({
                                choices: question.choices?.map((value, i) =>
                                  i === index ? event.target.value : value,
                                ),
                              })
                            }
                          />
                          <button
                            aria-label={"删除选项 " + (index + 1)}
                            disabled={(question.choices?.length ?? 0) <= 2}
                            onClick={() =>
                              updateQuestion({
                                choices: question.choices?.filter(
                                  (_, i) => i !== index,
                                ),
                              })
                            }
                          >
                            ×
                          </button>
                        </div>
                      ))}
                      <button
                        onClick={() =>
                          updateQuestion({
                            choices: [...(question.choices ?? []), "新选项"],
                          })
                        }
                        disabled={(question.choices?.length ?? 0) >= 20}
                      >
                        添加选项
                      </button>
                    </div>
                  ) : (
                    <div className="answer-placeholder">
                      {question.type === "rating"
                        ? "1　2　3　4　5"
                        : question.type === "boolean"
                          ? "是　/　否"
                          : "填写者将在这里输入回答…"}
                    </div>
                  )}
                </section>
              </div>
            </fieldset>
          </>
        ) : tab === "fill" ? (
          <section className="fill-view">
            <div className="fill-caption">
              <Check aria-hidden="true" size={16} />
              {sameSchema
                ? "填写内容自动保留，提交后进入答卷列表。"
                : "问卷定义已改变，当前保留旧版本答案草稿。"}
              <button onClick={again}>开始新答卷</button>
            </div>
            <RenderBoundary>
              <Suspense fallback={<p role="status">正在准备问卷…</p>}>
                <SurveyRunner
                  key={`${p.documentKey}-${cycle}`}
                  schema={fillingSchema}
                  initialAnswers={fillDraft?.answers}
                  initialId={fillDraft?.id}
                  initialSubmitted={fillDraft?.submitted}
                  onSubmit={submit}
                  onDraft={captureAnswers}
                  onAgain={again}
                />
              </Suspense>
            </RenderBoundary>
          </section>
        ) : (
          <section className="response-view">
            <header>
              <div>
                <h2>收集到的回答</h2>
                <p>
                  {p.current
                    ? `${responses.length} 份答卷`
                    : "先保存一份问卷，然后进入填写页收集回答。"}
                </p>
              </div>
              <button
                onClick={() => void loadResponses()}
                disabled={fetching || !p.current}
              >
                {fetching ? "刷新中…" : "刷新答卷"}
              </button>
              <button
                disabled={!responses.length}
                onClick={() =>
                  download(
                    new Blob([JSON.stringify(responses, null, 2)], {
                      type: "application/json",
                    }),
                    safeName + "-答卷.json",
                  )
                }
              >
                <Download aria-hidden="true" size={15} />
                导出答卷
              </button>
            </header>
            {fetching ? (
              <p role="status">正在读取答卷…</p>
            ) : responses.length ? (
              responses.map((response, index) => (
                <details className="response-row" key={response.id}>
                  <summary>
                    <span className="response-index">
                      {String(responses.length - index).padStart(2, "0")}
                    </span>
                    <strong>{response.schema.title}</strong>
                    <time>{new Date(response.createdAt).toLocaleString()}</time>
                    <span>{Object.keys(response.answers).length} 项回答</span>
                  </summary>
                  <dl>
                    {response.schema.elements
                      .filter(
                        (question) =>
                          response.answers[question.name] !== undefined,
                      )
                      .map((question) => (
                        <div key={question.name}>
                          <dt>{question.title}</dt>
                          <dd>
                            {Array.isArray(response.answers[question.name])
                              ? (
                                  response.answers[question.name] as string[]
                                ).join("、")
                              : String(response.answers[question.name])}
                          </dd>
                        </div>
                      ))}
                  </dl>
                </details>
              ))
            ) : (
              <div className="empty-responses">
                <FileQuestion aria-hidden="true" size={36} />
                <h3>第一份回答，正在路上</h3>
                <p>进入「填写问卷」，完成一次提交即可看到结果。</p>
                <button
                  onClick={() => void changeTab("fill")}
                  disabled={!p.current}
                >
                  去填写问卷
                </button>
              </div>
            )}
          </section>
        )}
      </div>
    </main>
  );
}
