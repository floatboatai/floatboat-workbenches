import { useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import {
  Check,
  FileInput,
  FlaskConical,
  Play,
  Settings2,
  X,
  Download,
  Plus,
  ArrowRight,
} from "lucide-react";
import {
  useProjects,
  ProjectPicker,
  Notice,
  request,
  download,
} from "./workspace";
import { isRecord } from "../contracts/project";
import {
  emptyProject,
  parseEvaluation,
  reviewCsv,
  reviewKey,
  validateProject,
  restoreProjectDraft,
  validateSuite,
  type Cell,
  type Decision,
  type Report,
} from "../contracts/evaluation";
interface Job {
  id: string;
  state: string;
  error: string;
  report: string | null;
}
function jobValue(v: unknown): Job {
  if (
    !isRecord(v) ||
    typeof v.id !== "string" ||
    typeof v.state !== "string" ||
    typeof v.error !== "string" ||
    !(v.report === null || typeof v.report === "string")
  )
    throw new Error("任务响应无效。");
  return { id: v.id, state: v.state, error: v.error, report: v.report };
}
const phases: Record<string, string> = {
  submitting: "提交中",
  uncertain: "等待确认",
  queued: "排队中",
  running: "评测中",
  completed: "已完成",
  failed: "执行失败",
  interrupted: "执行已中断",
  "not-submitted": "尚未提交",
};
const formatNumber = (v: number | null, suffix = "") =>
  v === null
    ? "—"
    : new Intl.NumberFormat("zh-CN", { maximumFractionDigits: 3 }).format(v) +
      suffix;
export function App() {
  const p = useProjects(emptyProject, validateProject, "发布评测", {
    storageKey: "promptfoo-evaluation-v1",
    restoreDraftData: restoreProjectDraft,
  });
  const [selected, setSelected] = useState(""),
    [filter, setFilter] = useState("all"),
    [mobileColumn, setMobileColumn] = useState(0),
    [configOpen, setConfigOpen] = useState(false),
    [working, setWorking] = useState(false),
    [job, setJob] = useState<Job | null>(null),
    [connection, setConnection] = useState({
      connected: false,
      modelConfigured: false,
      message: "正在检查执行器…",
    });
  const importRef = useRef<HTMLInputElement>(null),
    projectRef = useRef<HTMLInputElement>(null);
  const submittingDocument = useRef<string | null>(null);
  const epoch = useRef(p.documentKey);
  epoch.current = p.documentKey;
  const report = p.data.reports.find((r) => r.id === p.data.activeId) ?? null;
  const evaluation = useMemo(
    () => (report ? parseEvaluation(report.raw) : null),
    [report],
  );
  const cell =
    evaluation?.cells.find((c) => c.key === selected) ??
    evaluation?.cells[0] ??
    null;
  const baseline =
    evaluation?.cells.find(
      (c) => c.test === cell?.test && c.column === p.data.baseline,
    ) ?? null;
  const review =
    report && cell
      ? (p.data.reviews[reviewKey(report.id, cell)] ?? {
          decision: "pending" as Decision,
          note: "",
        })
      : null;
  const suiteDraft =
    typeof p.draft.suite === "string" ? p.draft.suite : p.data.suite;
  const jobId = typeof p.draft.jobId === "string" ? p.draft.jobId : "";
  const tests =
    evaluation?.tests.filter(
      (t) =>
        filter !== "fail" ||
        evaluation.cells.some((c) => c.test === t && !c.pass),
    ) ?? [];
  async function health() {
    try {
      const v = await request("/api/runner");
      if (!isRecord(v) || typeof v.message !== "string")
        throw new Error("执行器状态无效。");
      setConnection({
        connected: v.connected === true,
        modelConfigured: v.modelConfigured === true,
        message: v.message,
      });
    } catch {
      setConnection({
        connected: false,
        modelConfigured: false,
        message: "执行器暂不可达；可以继续导入和复核。",
      });
    }
  }
  useEffect(() => {
    void health();
  }, []);
  useEffect(() => {
    setSelected("");
    setJob(null);
    setWorking(false);
  }, [p.documentKey]);
  useEffect(() => {
    if (!jobId) return;
    let active = true,
      timer: ReturnType<typeof setTimeout> | undefined;
    const key = p.documentKey;
    const poll = async () => {
      try {
        const next = jobValue(await request(`/api/jobs/${jobId}`));
        if (!active || epoch.current !== key) return;
        setJob(next);
        if (next.state === "completed" && next.report) {
          try {
            const candidate: Report = {
              id: next.id,
              name: `评测 ${new Date().toLocaleTimeString("zh-CN")}`,
              raw: next.report,
            };
            const parsed = parseEvaluation(candidate.raw);
            p.setData((previous) =>
              previous.reports.some((r) => r.id === candidate.id)
                ? previous
                : validateProject({
                    ...previous,
                    reports: [...previous.reports, candidate],
                    activeId: candidate.id,
                    baseline: parsed.columns[0].index,
                  }),
            );
          } catch (e) {
            p.report(e);
          }
        } else if (!["failed", "interrupted"].includes(next.state))
          timer = setTimeout(poll, 1800);
      } catch (e) {
        if (active) {
          if (isRecord(e) && e.status === 404)
            setJob({
              id: jobId,
              state: "not-submitted",
              report: null,
              error: "提交尚未确认，可重试原任务。",
            });
          else p.report(e);
          timer = setTimeout(poll, 6000);
        }
      }
    };
    timer = setTimeout(poll, 1800);
    return () => {
      active = false;
      if (timer) clearTimeout(timer);
    };
  }, [jobId, p.documentKey]);
  function mark(decision: Decision, note = review?.note ?? "") {
    if (!report || !cell) return;
    const key = reviewKey(report.id, cell);
    try {
      p.setData((previous) =>
        restoreProjectDraft({
          ...previous,
          reviews: { ...previous.reviews, [key]: { decision, note } },
        }),
      );
    } catch (e) {
      p.report(e);
    }
  }
  async function addReport(raw: string, name: string) {
    const parsed = parseEvaluation(raw);
    const r = { id: crypto.randomUUID(), name: name.slice(0, 120), raw };
    p.setData((previous) =>
      validateProject({
        ...previous,
        reports: [...previous.reports, r],
        activeId: r.id,
        baseline: parsed.columns[0].index,
      }),
    );
    setSelected("");
    p.setNotice("评测报告已加入，复核记录会自动保存。");
  }
  async function importResult(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const key = p.documentKey;
    try {
      if (file.size > 600000) throw new Error("单份报告不能超过600KB。");
      const raw = await file.text();
      if (epoch.current === key)
        await addReport(raw, file.name.replace(/\.json$/i, ""));
    } catch (err) {
      p.report(err);
    }
  }
  async function example() {
    const key = p.documentKey;
    try {
      const raw = await request("/api/example");
      if (epoch.current === key)
        await addReport(JSON.stringify(raw), "回显评测示例");
    } catch (e) {
      p.report(e);
    }
  }
  async function importProject(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const key = p.documentKey;
    try {
      if (file.size > 1800000) throw new Error("项目文件过大。");
      const v: unknown = JSON.parse(await file.text());
      if (!isRecord(v) || v.kind !== "promptfoo-workbench" || v.version !== 1)
        throw new Error("需要评测台导出的项目文件。");
      const data = restoreProjectDraft(v.data);
      if (
        isRecord(v.draft) &&
        typeof v.draft.suite === "string" &&
        v.draft.suite.length > 60000
      )
        throw new Error("配置草稿超过容量。");
      if (epoch.current !== key) return;
      await p.replace(
        data,
        typeof v.title === "string" ? v.title : "导入的评测项目",
        isRecord(v.draft)
          ? {
              suite:
                typeof v.draft.suite === "string" ? v.draft.suite : data.suite,
            }
          : {},
      );
    } catch (err) {
      p.report(err);
    }
  }
  function exportProject() {
    download(
      new Blob(
        [
          JSON.stringify(
            {
              kind: "promptfoo-workbench",
              version: 1,
              title: p.title,
              data: p.data,
              draft: { suite: suiteDraft },
            },
            null,
            2,
          ),
        ],
        { type: "application/json" },
      ),
      "evaluation-project.json",
    );
  }
  function applySuite() {
    try {
      validateSuite(JSON.parse(suiteDraft));
      p.setData((previous) => ({ ...previous, suite: suiteDraft }));
      p.setNotice("测试配置已应用。");
    } catch (e) {
      p.report(e);
    }
  }
  async function start(retry = false) {
    if (
      working ||
      submittingDocument.current === p.documentKey ||
      (!retry && running)
    )
      return;
    let suite: unknown;
    try {
      suite = validateSuite(
        JSON.parse(
          retry && typeof p.draft.jobSuite === "string"
            ? p.draft.jobSuite
            : suiteDraft,
        ),
      );
    } catch (e) {
      p.report(e);
      return;
    }
    if (
      isRecord(suite) &&
      suite.mode === "model" &&
      !connection.modelConfigured
    ) {
      p.report(
        new Error("执行器尚未配置模型，请先配置服务或选择 echo 模板检查。"),
      );
      return;
    }
    const key = p.documentKey,
      id = retry && jobId ? jobId : `eval-${crypto.randomUUID()}`;
    submittingDocument.current = key;
    setWorking(true);
    setJob({ id, state: "submitting", error: "", report: null });
    p.setError("");
    p.setDraft((previous) => ({
      ...previous,
      jobId: id,
      jobSuite: JSON.stringify(suite),
    }));
    try {
      const saved = await p.save();
      if (!saved) throw new Error("请先解决保存状态，再开始评测。");
      const next = jobValue(
        await request("/api/jobs", {
          method: "POST",
          body: JSON.stringify({ id, suite }),
        }),
      );
      if (epoch.current === key) setJob(next);
    } catch (e) {
      if (epoch.current === key) p.report(e);
    } finally {
      if (submittingDocument.current === key) submittingDocument.current = null;
      if (epoch.current === key) setWorking(false);
    }
  }
  const running =
    working ||
    Boolean(
      jobId &&
        (!job ||
          job.id !== jobId ||
          !["completed", "failed", "interrupted"].includes(job.state)),
    );
  return (
    <div className="evaluation-app">
      <a className="skip" href="#main">
        跳至评测结果
      </a>
      <header className="masthead">
        <div className="brand">
          <FlaskConical size={23} aria-hidden="true" />
          <div>
            <strong>Promptfoo</strong>
            <span>评测与发布复核</span>
          </div>
        </div>
        <label className="project-title">
          <span className="sr-only">项目名称</span>
          <input
            aria-label="项目名称"
            name="project-name"
            autoComplete="off"
            value={p.title}
            onChange={(e) => p.setTitle(e.target.value)}
            maxLength={120}
          />
        </label>
        <span className={`save-state ${p.autoState.phase}`} role="status">
          {p.autoState.message}
        </span>
        <ProjectPicker
          items={p.items}
          id={p.current?.id}
          disabled={p.busy}
          onOpen={(id) => void p.open(id)}
        />
        <button
          className="icon-button"
          aria-label="新建评测项目"
          onClick={() => void p.fresh()}
          disabled={p.busy}
        >
          <Plus size={19} aria-hidden="true" />
        </button>
      </header>
      <nav className="toolbar" aria-label="评测操作">
        <div className="report-select">
          <label htmlFor="report">报告</label>
          <select
            id="report"
            name="report"
            value={report?.id ?? ""}
            onChange={(e) => {
              p.setData((previous) => ({
                ...previous,
                activeId: e.target.value,
                baseline: parseEvaluation(
                  previous.reports.find((r) => r.id === e.target.value)!.raw,
                ).columns[0].index,
              }));
              setSelected("");
            }}
          >
            <option value="" disabled>
              选择一份评测结果
            </option>
            {p.data.reports.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
        </div>
        <button onClick={() => importRef.current?.click()}>
          <FileInput size={16} aria-hidden="true" />
          导入报告
        </button>
        <button
          onClick={() => setConfigOpen((v) => !v)}
          aria-expanded={configOpen}
        >
          <Settings2 size={16} aria-hidden="true" />
          测试配置
        </button>
        <button
          className="primary"
          onClick={() => void start()}
          disabled={!connection.connected || running}
        >
          <Play size={15} aria-hidden="true" />
          {running ? "评测进行中…" : "运行套件"}
        </button>
        <div className="spacer" />
        <button onClick={() => projectRef.current?.click()}>导入项目</button>
        <button onClick={exportProject}>
          <Download size={16} aria-hidden="true" />
          导出项目
        </button>
      </nav>
      <input
        ref={importRef}
        className="sr-only"
        type="file"
        accept="application/json,.json"
        aria-label="导入评测结果 JSON"
        onChange={(e) => void importResult(e)}
      />
      <input
        ref={projectRef}
        className="sr-only"
        type="file"
        accept="application/json,.json"
        aria-label="导入评测项目 JSON"
        onChange={(e) => void importProject(e)}
      />
      <Notice error={p.error} notice={p.notice} />
      {(p.autoState.phase === "conflict" ||
        p.autoState.phase === "offline" ||
        p.autoState.phase === "draft") && (
        <div className="recovery">
          <button onClick={() => void p.save()}>重试保存</button>
          <button onClick={p.exportDraft}>导出工作草稿</button>
          {p.current && (
            <button onClick={() => void p.open(p.current!.id)}>
              打开服务器版本
            </button>
          )}
        </div>
      )}
      <div className="connection">
        <span className={connection.connected ? "dot connected" : "dot"} />
        <span>{connection.message}</span>
        <button onClick={() => void health()}>重新检查</button>
        {job && (
          <span className="job-state" role="status">
            任务 {job.id.slice(-8)} · {phases[job.state] ?? job.state}
            {job.error ? ` · ${job.error}` : ""}
          </span>
        )}
        {job?.state === "completed" && job.report && (
          <button
            onClick={() =>
              download(
                new Blob([job.report!], { type: "application/json" }),
                "completed-evaluation.json",
              )
            }
          >
            下载本次结果
          </button>
        )}
        {job && ["uncertain", "not-submitted"].includes(job.state) && (
          <button onClick={() => void start(true)} disabled={working}>
            重试原任务提交
          </button>
        )}
      </div>
      {configOpen && (
        <section
          className="configuration"
          aria-label="测试配置"
          onKeyDown={(e) => {
            if (e.key === "Escape") setConfigOpen(false);
          }}
        >
          <div className="config-heading">
            <h2>测试套件</h2>
            <span>echo 检查模板与断言；model 使用执行器已配置的模型。</span>
            <button
              aria-label="关闭测试配置"
              onClick={() => setConfigOpen(false)}
            >
              <X size={16} aria-hidden="true" />
            </button>
          </div>
          <label htmlFor="suite">JSON 配置（未应用的输入也会保存）</label>
          <textarea
            id="suite"
            name="suite"
            autoComplete="off"
            maxLength={60000}
            spellCheck={false}
            value={suiteDraft}
            onChange={(e) =>
              p.setDraft((previous) => ({ ...previous, suite: e.target.value }))
            }
          />
          <div className="config-footer">
            <p>
              支持 contains、not-contains、equals、is-json；最多 25 用例 × 4
              版本。
            </p>
            <button onClick={applySuite}>检查并应用配置</button>
            <button
              onClick={() => void start()}
              disabled={!connection.connected || running}
            >
              运行此配置
            </button>
          </div>
        </section>
      )}
      <main id="main">
        {!evaluation ? (
          <section className="empty">
            <div className="empty-grid" aria-hidden="true">
              <span />
              <span />
              <span />
              <span />
              <span />
              <span />
            </div>
            <p className="eyebrow">EVALUATION DESK</p>
            <h1>让每次改动都有依据。</h1>
            <p>
              导入 Promptfoo
              的真实评测结果，逐个比较提示版本、失败断言与实际输出，再记录发布判断。
            </p>
            <div>
              <button
                className="primary"
                onClick={() => importRef.current?.click()}
              >
                导入评测 JSON
              </button>
              <button onClick={() => void example()}>查看回显评测示例</button>
            </div>
            <small>
              示例由 Promptfoo 0.125.1 的回显提供者运行，不含模型调用。
            </small>
          </section>
        ) : (
          <>
            <section className="matrix-heading">
              <div>
                <p className="eyebrow">RESULTS / {report?.name}</p>
                <h1>
                  {evaluation.cells.filter((c) => c.pass).length}
                  <span> / {evaluation.cells.length} 项通过</span>
                </h1>
              </div>
              <div className="matrix-controls">
                <label>
                  显示
                  <select
                    aria-label="显示"
                    name="filter"
                    value={filter}
                    onChange={(e) => setFilter(e.target.value)}
                  >
                    <option value="all">全部用例</option>
                    <option value="fail">有失败的用例</option>
                  </select>
                </label>
                <label>
                  比较基线
                  <select
                    aria-label="比较基线"
                    name="baseline"
                    value={p.data.baseline}
                    onChange={(e) =>
                      p.setData((previous) => ({
                        ...previous,
                        baseline: Number(e.target.value),
                      }))
                    }
                  >
                    {evaluation.columns.map((c) => (
                      <option key={c.index} value={c.index}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                </label>
                <button
                  onClick={() => {
                    if (report)
                      download(
                        new Blob([reviewCsv(report, p.data.reviews)], {
                          type: "text/csv;charset=utf-8",
                        }),
                        "evaluation-review.csv",
                      );
                  }}
                >
                  导出审阅 CSV
                </button>
                <button
                  onClick={() => {
                    if (report)
                      download(
                        new Blob([report.raw], { type: "application/json" }),
                        "promptfoo-results.json",
                      );
                  }}
                >
                  原始结果
                </button>
              </div>
            </section>
            <div className="matrix-scroll">
              <table className="matrix">
                <thead>
                  <tr>
                    <th scope="col">测试用例</th>
                    {evaluation.columns.map((c) => (
                      <th key={c.index} scope="col">
                        <strong>{c.label}</strong>
                        <small>{c.provider}</small>
                        {c.index === p.data.baseline && (
                          <span className="baseline-label">基线</span>
                        )}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {tests.map((t) => (
                    <tr key={t}>
                      <th scope="row">
                        <span>CASE {String(t + 1).padStart(2, "0")}</span>
                        <pre>
                          {evaluation.cells.find((c) => c.test === t)?.input}
                        </pre>
                      </th>
                      {evaluation.columns.map((column) => {
                        const c = evaluation.cells.find(
                          (c) => c.test === t && c.column === column.index,
                        );
                        return (
                          <td key={column.index}>
                            {c ? (
                              <button
                                className={`result-cell ${c.pass ? "pass" : "fail"} ${cell?.key === c.key ? "selected" : ""}`}
                                aria-label={`用例 ${t + 1}，${column.label}，${c.pass ? "通过" : "失败"}`}
                                aria-pressed={cell?.key === c.key}
                                onClick={() => setSelected(c.key)}
                              >
                                <strong>
                                  {c.pass ? (
                                    <Check size={16} aria-hidden="true" />
                                  ) : (
                                    <X size={16} aria-hidden="true" />
                                  )}{" "}
                                  {c.pass ? "通过" : "失败"}
                                </strong>
                                <span>
                                  {c.output.slice(0, 160) || "无输出"}
                                </span>
                                <small>
                                  {formatNumber(c.score)} 分 ·{" "}
                                  {formatNumber(c.latency, " ms")}
                                </small>
                              </button>
                            ) : (
                              <span>未返回</span>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mobile-results">
              <label>
                提示版本
                <select
                  aria-label="提示版本"
                  name="version"
                  value={
                    evaluation.columns.some((c) => c.index === mobileColumn)
                      ? mobileColumn
                      : evaluation.columns[0]?.index
                  }
                  onChange={(e) => setMobileColumn(Number(e.target.value))}
                >
                  {evaluation.columns.map((c) => (
                    <option key={c.index} value={c.index}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </label>
              {tests.map((t) => {
                const c = evaluation.cells.find(
                  (c) =>
                    c.test === t &&
                    c.column ===
                      (evaluation.columns.some(
                        (col) => col.index === mobileColumn,
                      )
                        ? mobileColumn
                        : evaluation.columns[0]?.index),
                );
                return c ? (
                  <button
                    key={c.key}
                    className={`result-cell ${c.pass ? "pass" : "fail"}`}
                    onClick={() => setSelected(c.key)}
                  >
                    <strong>
                      CASE {t + 1} · {c.pass ? "通过" : "失败"}
                    </strong>
                    <span>{c.output.slice(0, 180)}</span>
                  </button>
                ) : null;
              })}
            </div>
            {!tests.length && (
              <p className="no-results" role="status">
                当前筛选没有用例。
              </p>
            )}
            {cell && report && review && (
              <section className="detail" aria-label="单元格详情">
                <div className="detail-title">
                  <h2>
                    CASE {String(cell.test + 1).padStart(2, "0")}{" "}
                    <ArrowRight size={15} aria-hidden="true" /> {cell.label}
                  </h2>
                  <span className={cell.pass ? "pass-text" : "fail-text"}>
                    {cell.pass ? "断言通过" : "需要检查"} ·{" "}
                    {formatNumber(cell.latency, " ms")}
                  </span>
                </div>
                <div className="comparison">
                  <article>
                    <h3>基线 · {baseline?.label ?? "未返回"}</h3>
                    <pre>{baseline?.output ?? "此用例没有基线结果。"}</pre>
                  </article>
                  <article>
                    <h3>当前 · {cell.label}</h3>
                    <pre>{cell.output || "无输出"}</pre>
                  </article>
                  <aside>
                    <h3>复核决定</h3>
                    <label>
                      人工判断
                      <select
                        aria-label="人工判断"
                        name="decision"
                        value={review.decision}
                        onChange={(e) => mark(e.target.value as Decision)}
                      >
                        <option value="pending">待复核</option>
                        <option value="accept">接受此结果</option>
                        <option value="reject">需要修改</option>
                      </select>
                    </label>
                    <label>
                      复核意见
                      <textarea
                        aria-label="复核意见"
                        name="review-note"
                        autoComplete="off"
                        value={review.note}
                        onChange={(e) => mark(review.decision, e.target.value)}
                        maxLength={6000}
                        placeholder="记录原因或下一步修改…"
                      />
                    </label>
                  </aside>
                </div>
                <details>
                  <summary>输入、断言与评分理由</summary>
                  <div className="raw-details">
                    <article>
                      <h3>实际提示</h3>
                      <pre>{cell.prompt}</pre>
                    </article>
                    <article>
                      <h3>评分理由</h3>
                      <pre>{cell.reason}</pre>
                      <h3>断言明细</h3>
                      <pre>{cell.assertions}</pre>
                    </article>
                  </div>
                </details>
              </section>
            )}
          </>
        )}
      </main>
      <footer>
        报告与复核记录保存在当前项目。
        <span>Promptfoo · Evaluation workbench</span>
      </footer>
    </div>
  );
}
