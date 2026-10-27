import {
  FileJson,
  Play,
  Download,
  Plus,
  Upload,
  GitBranch,
  ChevronDown,
} from "lucide-react";
import { ProjectPicker, Notice } from "./workspace";
import { recordValue } from "../contracts/review";
import { useReviewDesk } from "./useReviewDesk";
import { RecordFields } from "./RecordFields";
import { ReviewPanel } from "./ReviewPanel";
import { formatTime, statusLabels } from "./presentation";
export function App() {
  const desk = useReviewDesk();
  const {
    project,
    runs,
    actionBusy,
    listError,
    model,
    jsonOpen,
    setJsonOpen,
    file,
    selected,
    jsonDraft,
    pending,
    pendingOperation,
    mutable,
    loadRuns,
    modelStatus,
    submitCommand,
    start,
    exportProject,
    importProject,
    running,
    step,
  } = desk;
  return (
    <div className="workbench">
      <a className="skip-link" href="#main">
        跳转到资料与复核
      </a>
      <header className="topbar">
        <div className="brand">
          <GitBranch size={24} aria-hidden="true" />
          <div>
            <strong>交付复核</strong>
            <span>LANGGRAPH / REVIEW DESK</span>
          </div>
        </div>
        <div className="project-control">
          <input
            aria-label="项目名称"
            name="projectTitle"
            autoComplete="off"
            maxLength={120}
            value={project.title}
            onChange={(e) => project.setTitle(e.target.value)}
            disabled={!mutable}
          />
          <ProjectPicker
            items={project.items}
            id={project.current?.id}
            disabled={project.busy || actionBusy}
            onOpen={(id) => {
              void project.open(id);
            }}
          />
        </div>
        <div className="file-actions">
          <button
            onClick={() => {
              void project.fresh();
            }}
            disabled={!mutable || actionBusy}
          >
            <Plus size={16} aria-hidden="true" />
            新建
          </button>
          <button
            onClick={() => file.current?.click()}
            disabled={!mutable || actionBusy}
          >
            <Upload size={16} aria-hidden="true" />
            导入
          </button>
          <button onClick={exportProject}>
            <Download size={16} aria-hidden="true" />
            项目
          </button>
          <input
            ref={file}
            type="file"
            accept="application/json,.json"
            aria-label="导入项目文件"
            className="visually-hidden"
            onChange={(e) => {
              void importProject(e.target.files?.[0]);
            }}
          />
        </div>
      </header>
      <div className="savebar">
        <span className={`save-state ${project.autoState.phase}`} role="status">
          {project.loading ? "正在恢复项目…" : project.autoState.message}
        </span>
        <span>项目与未完成草稿自动保存</span>
        {["offline", "conflict", "draft"].includes(project.autoState.phase) ? (
          <div>
            <button
              onClick={() => {
                void project.save();
              }}
            >
              重试保存
            </button>
            <button onClick={project.exportDraft}>导出恢复草稿</button>
            {project.current ? (
              <button
                onClick={() => {
                  void project.open(project.current!.id);
                }}
              >
                打开服务器版本
              </button>
            ) : null}
          </div>
        ) : null}
      </div>
      <Notice error={project.error} notice={project.notice} />
      {pendingOperation ? (
        <div className="pending-command" role="status">
          <span>
            提交尚待确认。已保留同一操作编号，重试不会创建第二次运行。
          </span>
          <button
            disabled={actionBusy}
            onClick={() => {
              if (pending) void submitCommand(pending);
            }}
          >
            核对并重试提交
          </button>
        </div>
      ) : null}
      <section className="process-strip" aria-label="交付流程">
        <div className="process-intro">
          <span className="eyebrow">固定复核流程</span>
          <h1>先检查，再交付。</h1>
          <p>每次运行保留独立输入，人工确认后生成交付记录。</p>
        </div>
        <ol className="process-steps">
          <li className={step >= 1 ? "done" : ""}>
            <b>01</b>
            <div>
              <strong>整理资料</strong>
              <span>
                {selected?.input.mode === "model" ? "模型整理" : "填写资料"}
              </span>
            </div>
          </li>
          <li className={step === 2 ? "active" : step > 2 ? "done" : ""}>
            <b>02</b>
            <div>
              <strong>人工复核</strong>
              <span>暂停 · 修订 · 决定</span>
            </div>
          </li>
          <li className={step === 3 ? "done" : ""}>
            <b>03</b>
            <div>
              <strong>交付记录</strong>
              <span>确认版本与导出</span>
            </div>
          </li>
        </ol>
      </section>
      <main id="main" tabIndex={-1} className="workspace">
        <section className="input-sheet" aria-labelledby="input-heading">
          <div className="section-heading">
            <div>
              <span className="eyebrow">输入区</span>
              <h2 id="input-heading">待复核资料</h2>
            </div>
            <button
              className="text-button"
              disabled={!mutable}
              aria-expanded={jsonOpen}
              onClick={() => setJsonOpen(!jsonOpen)}
            >
              <FileJson size={16} aria-hidden="true" />
              {jsonOpen ? "返回表单" : "JSON 编辑"}
            </button>
          </div>
          <div className="mode-picker" role="group" aria-label="资料整理方式">
            <button
              className={project.data.mode === "structured" ? "selected" : ""}
              disabled={!mutable}
              aria-pressed={project.data.mode === "structured"}
              onClick={() =>
                project.setData((data) => ({ ...data, mode: "structured" }))
              }
            >
              填写资料
            </button>
            <button
              className={project.data.mode === "model" ? "selected" : ""}
              disabled={!mutable}
              aria-pressed={project.data.mode === "model"}
              onClick={() =>
                project.setData((data) => ({ ...data, mode: "model" }))
              }
            >
              模型整理
            </button>
          </div>
          {project.data.mode === "model" ? (
            <div className="model-source">
              <label htmlFor="source">
                原始资料
                <textarea
                  id="source"
                  name="source"
                  disabled={!mutable}
                  rows={11}
                  maxLength={40000}
                  value={project.data.source}
                  onChange={(e) =>
                    project.setData((data) => ({
                      ...data,
                      source: e.target.value,
                    }))
                  }
                />
              </label>
              <p className="model-status">
                {model.message}{" "}
                <button
                  className="text-button"
                  onClick={() => {
                    void modelStatus();
                  }}
                >
                  重新检查
                </button>
              </p>
            </div>
          ) : jsonOpen ? (
            <div className="json-editor">
              <label htmlFor="input-json">
                资料 JSON 草稿
                <textarea
                  id="input-json"
                  name="inputJson"
                  disabled={!mutable}
                  spellCheck={false}
                  rows={16}
                  maxLength={40000}
                  value={jsonDraft}
                  onChange={(e) =>
                    project.setDraft((extra) => ({
                      ...extra,
                      inputJson: e.target.value,
                    }))
                  }
                />
              </label>
              <p>此处内容独立保存；应用后才改变运行资料。</p>
              <button
                onClick={() => {
                  try {
                    const parsed = recordValue(JSON.parse(jsonDraft));
                    project.setData((data) => ({ ...data, input: parsed }));
                    setJsonOpen(false);
                    project.setNotice("JSON 已应用到填写资料。");
                  } catch (error) {
                    project.report(error);
                  }
                }}
              >
                应用 JSON
              </button>
            </div>
          ) : (
            <RecordFields
              prefix="input-"
              value={project.data.input}
              onChange={(input) =>
                project.setData((data) => ({ ...data, input }))
              }
              disabled={!mutable}
            />
          )}
          {project.data.mode === "structured" ? (
            <details className="source-details">
              <summary>
                原文与背景 <ChevronDown size={15} aria-hidden="true" />
              </summary>
              <textarea
                aria-label="原文与背景"
                name="background"
                disabled={!mutable}
                maxLength={40000}
                rows={4}
                value={project.data.source}
                onChange={(e) =>
                  project.setData((data) => ({
                    ...data,
                    source: e.target.value,
                  }))
                }
              />
            </details>
          ) : null}
          <div className="start-row">
            <p>启动时固定输入快照；之后的编辑用于下一次运行。</p>
            <button
              className="primary"
              disabled={
                !mutable ||
                actionBusy ||
                running ||
                !!pendingOperation ||
                (project.data.mode === "model" && !model.available)
              }
              onClick={() => {
                void start();
              }}
            >
              <Play size={16} aria-hidden="true" />
              {actionBusy ? "正在提交…" : "启动复核流程"}
            </button>
          </div>
        </section>
        <ReviewPanel {...desk} />
      </main>
      <section className="run-ledger" aria-label="运行记录">
        <div className="ledger-heading">
          <h2>运行账本</h2>
          <span>最近 50 次 · 输入与交付分开留存</span>
          <button
            className="text-button"
            onClick={() => {
              void loadRuns();
            }}
          >
            刷新
          </button>
        </div>
        {listError ? <p role="alert">{listError}</p> : null}
        {runs.length ? (
          <div className="run-tabs">
            {runs.map((run) => (
              <button
                key={run.id}
                disabled={!mutable || actionBusy}
                aria-pressed={run.id === selected?.id}
                onClick={() =>
                  project.setData((data) => ({
                    ...data,
                    selectedRunId: run.id,
                  }))
                }
              >
                <span className="mono">{run.id.slice(0, 8).toUpperCase()}</span>
                <strong>{statusLabels[run.status]}</strong>
                <small>{formatTime(run.createdAt)}</small>
              </button>
            ))}
          </div>
        ) : (
          <p className="ledger-empty">
            还没有运行记录。启动一次流程后，进度与结果会保留在这里。
          </p>
        )}
        {selected?.checkpoints.length ? (
          <details className="checkpoint-details">
            <summary>查看保存的检查点（{selected.checkpoints.length}）</summary>
            <ol>
              {selected.checkpoints.map((point) => (
                <li key={point.id}>
                  <span>步骤 {point.step + 2}</span>
                  <time dateTime={point.at}>{formatTime(point.at)}</time>
                  <code>{point.id.slice(0, 18)}</code>
                  <span>{point.next.join(" → ") || "已保存状态"}</span>
                </li>
              ))}
            </ol>
          </details>
        ) : null}
      </section>
      <footer>
        <span>LangGraph · 资料整理 / 人工复核 / 交付记录</span>
        <span>复核记录随项目保留</span>
      </footer>
    </div>
  );
}
