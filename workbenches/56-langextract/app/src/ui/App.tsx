import { useEffect, useMemo, useRef, useState } from "react";
import {
  FileText,
  Check,
  X,
  ArrowUpRight,
  Download,
  Upload,
  Plus,
  RotateCcw,
  Play,
  BookOpen,
  Settings2,
  Activity,
  CheckCheck,
} from "lucide-react";
import { isRecord } from "../contracts/project";
import {
  seed,
  restoreProjectDraft,
  parseWorkingImport,
  serializeWorkingCopy,
  PORTABLE_FILE_BYTES,
  evidenceSpan,
  rawJsonl,
  reviewCsv,
  examples,
  runInput,
  importedDocuments,
  validateJob,
  type EvidenceDocument,
  type EvidenceProject,
  type Job,
  type ReviewStatus,
} from "../contracts/evidence";
import { ProjectPicker, Notice, download, request } from "./workspace";
import { useEvidenceProjects } from "./evidence-state";
const statusName: Record<ReviewStatus, string> = {
  pending: "待复核",
  accepted: "已接受",
  rejected: "已驳回",
  corrected: "已修订",
};
const jobName: Record<Job["status"], string> = {
  submitting: "提交中",
  unknown: "待确认",
  queued: "排队中",
  running: "抽取中",
  succeeded: "待查看",
  failed: "失败",
  interrupted: "已中断",
  cancelled: "已停止接收",
};
const parseService = (value: unknown) => {
  if (
    !isRecord(value) ||
    typeof value.connected !== "boolean" ||
    typeof value.message !== "string"
  )
    throw Error("连接状态响应无效。");
  return {
    connected: value.connected,
    ready: value.ready === true,
    message: value.message,
  };
};
const stringDraft = (v: unknown, fallback = "") =>
  typeof v === "string" ? v : fallback;
function filename(title: string) {
  return title.replace(/[\\/:*?"<>|]/g, "-").slice(0, 80) || "证据项目";
}
export function App() {
  const p = useEvidenceProjects();
  const [tab, setTab] = useState<"review" | "config" | "jobs">(() =>
      location.hash === "#config"
        ? "config"
        : location.hash === "#jobs"
          ? "jobs"
          : "review",
    ),
    [docIndex, setDocIndex] = useState(0),
    [recordIndex, setRecordIndex] = useState(0),
    [filter, setFilter] = useState("all"),
    [editing, setEditing] = useState(false),
    [jobs, setJobs] = useState<Job[]>([]),
    [service, setService] = useState({
      connected: false,
      ready: false,
      message: "正在检查抽取服务…",
    }),
    [sending, setSending] = useState(false);
  const generation = useRef(0),
    paper = useRef<HTMLElement>(null);
  const doc = p.data.documents[Math.min(docIndex, p.data.documents.length - 1)];
  const index = Math.min(recordIndex, Math.max(0, doc.extractions.length - 1)),
    item = doc.extractions[index],
    review = doc.reviews[index],
    span = item ? evidenceSpan(doc, item) : null,
    stale = doc.text !== doc.originalText;
  useEffect(() => {
    generation.current++;
    setDocIndex(0);
    setRecordIndex(0);
    setEditing(false);
    setFilter("all");
  }, [p.documentKey]);
  const rows = useMemo(
    () =>
      doc.extractions
        .map((e, i) => ({ e, i, r: doc.reviews[i] }))
        .filter((x) => filter === "all" || x.r.status === filter),
    [doc, filter],
  );
  async function refreshJobs() {
    try {
      const value = await request("/api/jobs");
      if (!Array.isArray(value)) throw Error("任务列表无效。");
      setJobs(value.map(validateJob));
    } catch (e) {
      p.report(e);
    }
  }
  async function refreshService() {
    try {
      setService(parseService(await request("/api/service")));
    } catch {
      setService({
        connected: false,
        ready: false,
        message: "连接状态暂不可用，可继续复核已有资料。",
      });
    }
  }
  useEffect(() => {
    void refreshService();
    void refreshJobs();
  }, []);
  const pendingIds = jobs
    .filter((j) =>
      ["submitting", "queued", "running", "unknown"].includes(j.status),
    )
    .map((j) => j.id)
    .join(",");
  useEffect(() => {
    if (!pendingIds) return;
    let active = true;
    const timer = setInterval(() => {
      void Promise.all(
        pendingIds
          .split(",")
          .map((id) => request("/api/jobs/" + id).then(validateJob)),
      )
        .then((updated) => {
          if (active)
            setJobs((old) =>
              old.map((j) => updated.find((x) => x.id === j.id) ?? j),
            );
        })
        .catch(() => {});
    }, 3500);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [pendingIds]);
  const updateDoc = (change: (d: EvidenceDocument) => EvidenceDocument) =>
    p.setData((old) => ({
      ...old,
      documents: old.documents.map((d, i) =>
        i === Math.min(docIndex, old.documents.length - 1) ? change(d) : d,
      ),
    }));
  const updateReview = (patch: Partial<EvidenceDocument["reviews"][number]>) =>
    updateDoc((d) => ({
      ...d,
      reviews: d.reviews.map((r, i) => (i === index ? { ...r, ...patch } : r)),
    }));
  function selectRecord(i: number) {
    setRecordIndex(i);
    setEditing(false);
    requestAnimationFrame(() =>
      paper.current
        ?.querySelector("mark")
        ?.scrollIntoView({ block: "nearest", behavior: "auto" }),
    );
  }
  function setStatus(status: ReviewStatus) {
    if (stale && (status === "accepted" || status === "corrected")) {
      p.setError("原文已变更，请重新抽取或恢复原文后确认。");
      return;
    }
    if (status === "corrected" && !review.correctedText.trim()) {
      p.setError("请先填写修订值。");
      return;
    }
    if (updateReview({ status })) p.setError("");
  }
  async function importText(raw: string) {
    try {
      const copy = parseWorkingImport(raw, (p.title + " · 导入").slice(0, 120));
      if (await p.replace(copy.data, copy.title, copy.extra)) {
        setTab("review");
        p.setNotice("已导入为新项目，原项目保留。");
      }
    } catch (e) {
      p.report(e);
    }
  }
  async function readFile(file: File | undefined) {
    if (!file) return;
    try {
      if (file.size > PORTABLE_FILE_BYTES)
        throw Error("文件超过6MB，请拆分资料。");
      // Large portable files are decoded directly, never duplicated in editor extra.
      await importText(await file.text());
    } catch (e) {
      p.report(e);
    }
  }
  async function startRun() {
    if (sending) return;
    setSending(true);
    const epoch = generation.current;
    try {
      const prior = p.draft.pendingRun;
      const pending =
        isRecord(prior) && typeof prior.id === "string"
          ? { id: prior.id, input: runInput(prior.input) }
          : {
              id: crypto.randomUUID(),
              input: runInput({
                documents: p.data.documents.map((d) => ({
                  id: d.id,
                  text: d.text,
                })),
                fields: p.data.fields,
                prompt: p.data.prompt,
                examples: p.data.examples,
              }),
            };
      if (!p.setDraft((old) => ({ ...old, pendingRun: pending }))) return;
      const saved = await p.save();
      if (!saved) throw Error("请先解决草稿保存或版本冲突，再提交抽取。");
      const result = validateJob(
        await request("/api/jobs", {
          method: "POST",
          body: JSON.stringify({
            id: pending.id,
            input: pending.input,
            projectId: saved.id,
          }),
        }),
      );
      if (epoch === generation.current) {
        p.setDraft((old) => {
          const next = { ...old };
          delete next.pendingRun;
          return next;
        });
        setJobs((old) => [result, ...old.filter((j) => j.id !== result.id)]);
        setTab("jobs");
        p.setNotice("任务已记录。结果将另开为新项目，不覆盖当前修订。");
      }
    } catch (e) {
      if (epoch === generation.current) p.report(e);
    } finally {
      setSending(false);
    }
  }
  async function openResult(job: Job) {
    try {
      if (!job.result) throw Error("结果尚不可用。");
      const data = importedDocuments(job.result, "service");
      data.prompt = job.input.prompt;
      data.fields = job.input.fields;
      data.examples = job.input.examples;
      if (await p.replace(data, "抽取结果 · " + job.id.slice(0, 8))) {
        setTab("review");
        p.setNotice("已另开结果项目，等待人工复核。");
      }
    } catch (e) {
      p.report(e);
    }
  }
  async function cancel(job: Job) {
    if (!confirm("停止接收这个任务的结果？已发出的模型请求可能仍在运行。"))
      return;
    try {
      const result = validateJob(
        await request("/api/jobs/" + job.id + "/cancel", {
          method: "POST",
          body: "{}",
        }),
      );
      setJobs((old) => old.map((x) => (x.id === result.id ? result : x)));
    } catch (e) {
      p.report(e);
    }
  }
  function exportFile(kind: "project" | "csv" | "jsonl") {
    try {
      const data = restoreProjectDraft(p.data);
      const body =
        kind === "project"
          ? serializeWorkingCopy({ title: p.title, data, extra: p.draft })
          : kind === "csv"
            ? reviewCsv(data)
            : rawJsonl(data);
      download(
        new Blob([body], {
          type:
            kind === "csv"
              ? "text/csv;charset=utf-8"
              : kind === "jsonl"
                ? "application/x-ndjson"
                : "application/json",
        }),
        filename(p.title) +
          (kind === "project"
            ? ".evidence.json"
            : kind === "csv"
              ? ".review.csv"
              : ".original.jsonl"),
      );
    } catch (e) {
      p.report(e);
    }
  }
  const completed = doc.reviews.filter((r) => r.status !== "pending").length;
  useEffect(() => {
    history.replaceState(null, "", "#" + tab);
  }, [tab]);
  if (p.loading)
    return (
      <main className="loading-desk" role="status">
        正在打开证据档案…
      </main>
    );
  return (
    <div className="app-shell">
      <a href="#evidence-main" className="skip-link">
        跳到复核资料
      </a>
      <header className="masthead">
        <div className="brand">
          <BookOpen size={25} aria-hidden="true" />
          <div>
            <span className="eyebrow" translate="no">
              LANGEXTRACT / RESEARCH DESK
            </span>
            <h1>证据书桌</h1>
          </div>
        </div>
        <div className="connection">
          <span
            className={
              service.ready ? "connection-dot ready" : "connection-dot"
            }
          />
          <span>{service.ready ? "抽取服务可用" : "离线审校"}</span>
          <button
            type="button"
            className="text-button"
            onClick={() => void refreshService()}
            aria-label="刷新服务状态"
          >
            <RotateCcw size={15} aria-hidden="true" />
          </button>
        </div>
      </header>
      <section className="archive-bar" aria-label="项目与保存">
        <label className="title-label">
          <span>档案名称</span>
          <input
            aria-label="项目名称"
            name="project-title"
            autoComplete="off"
            value={p.title}
            maxLength={120}
            onChange={(e) => p.setTitle(e.target.value)}
          />
        </label>
        <ProjectPicker
          items={p.items}
          id={p.current?.id}
          disabled={p.busy}
          onOpen={(id) => void p.open(id)}
        />
        <button
          type="button"
          onClick={() =>
            void p.replace(
              {
                ...structuredClone(seed),
                origin: "manual",
                documents: [
                  {
                    id: "资料-01",
                    text: "",
                    originalText: "",
                    extractions: [],
                    reviews: [],
                  },
                ],
              },
              "未命名资料",
            )
          }
          disabled={p.busy}
        >
          <Plus size={15} aria-hidden="true" />
          新建
        </button>
        <details className="export-menu">
          <summary>
            <Download size={15} aria-hidden="true" />
            导出
          </summary>
          <div>
            <button onClick={() => exportFile("csv")}>审校表 CSV</button>
            <button onClick={() => exportFile("jsonl")}>原始抽取 JSONL</button>
            <button onClick={() => exportFile("project")}>完整项目 JSON</button>
            <button onClick={() => exportFile("project")}>恢复草稿</button>
          </div>
        </details>
        <span className={"save-state " + p.autoState.phase} role="status">
          {p.autoState.message}
        </span>
        <button
          className="text-button"
          onClick={() => void p.save()}
          aria-label="立即保存或重试"
        >
          <CheckCheck size={17} aria-hidden="true" />
        </button>
      </section>
      <nav className="section-nav" aria-label="工作区域">
        <button
          aria-pressed={tab === "review"}
          onClick={() => setTab("review")}
        >
          <FileText size={16} aria-hidden="true" />
          资料复核
        </button>
        <button
          aria-pressed={tab === "config"}
          onClick={() => setTab("config")}
        >
          <Settings2 size={16} aria-hidden="true" />
          抽取配置
        </button>
        <button aria-pressed={tab === "jobs"} onClick={() => setTab("jobs")}>
          <Activity size={16} aria-hidden="true" />
          任务记录
        </button>
        <div className="nav-spacer" />
        <button
          className="primary"
          disabled={!service.ready || sending || p.busy}
          onClick={() => void startRun()}
        >
          <Play size={15} aria-hidden="true" />
          {sending
            ? "正在提交…"
            : isRecord(p.draft.pendingRun)
              ? "重试原任务提交"
              : "开始抽取"}
        </button>
      </nav>
      <Notice error={p.error} notice={p.notice} />
      {p.autoState.phase === "conflict" && (
        <div className="recovery">
          <button onClick={() => exportFile("project")}>导出本机草稿</button>
          {p.current && (
            <button onClick={() => void p.open(p.current!.id)}>
              打开服务器版本
            </button>
          )}
        </div>
      )}
      <main id="evidence-main">
        {tab === "review" ? (
          <>
            <div className="document-strip">
              <div className="doc-tabs">
                {p.data.documents.map((d, i) => (
                  <button
                    key={d.id}
                    aria-pressed={
                      i === Math.min(docIndex, p.data.documents.length - 1)
                    }
                    onClick={() => {
                      setDocIndex(i);
                      setRecordIndex(0);
                      setEditing(false);
                    }}
                  >
                    {String(i + 1).padStart(2, "0")} · {d.id}
                  </button>
                ))}
              </div>
              <span className="origin-tag">
                {p.data.origin === "example"
                  ? "示例资料 · 人工编制"
                  : p.data.origin === "service"
                    ? "LangExtract 服务结果"
                    : p.data.origin === "import"
                      ? "导入资料"
                      : "手工资料"}
              </span>
            </div>
            <div className="review-desk">
              <section className="source-pane" aria-label="原文与证据">
                <div className="paper-controls">
                  <span className="eyebrow">SOURCE DOCUMENT</span>
                  <button
                    className="text-button"
                    onClick={() => setEditing((v) => !v)}
                  >
                    {editing ? "返回阅读" : "编辑原文"}
                  </button>
                </div>
                {stale && (
                  <div className="source-warning" role="status">
                    原文已修改，旧证据区间暂不可用。
                    <button
                      onClick={() => {
                        if (confirm("恢复抽取时的原文？当前原文修改将被替换。"))
                          updateDoc((d) => ({ ...d, text: d.originalText }));
                      }}
                    >
                      恢复抽取时原文
                    </button>
                  </div>
                )}
                <article className="paper" ref={paper}>
                  <div className="paper-heading">
                    <p className="eyebrow">
                      资料 {String(docIndex + 1).padStart(2, "0")}
                    </p>
                    <h2>{doc.id}</h2>
                    <div className="paper-rule" />
                  </div>
                  {editing ? (
                    <label className="source-editor">
                      <span className="sr-only">资料原文</span>
                      <textarea
                        aria-label="资料原文"
                        name="source-text"
                        autoComplete="off"
                        spellCheck={false}
                        maxLength={30000}
                        value={doc.text}
                        onChange={(e) =>
                          updateDoc((d) => ({ ...d, text: e.target.value }))
                        }
                      />
                    </label>
                  ) : (
                    <div className="source-copy">
                      {!doc.text ? (
                        <p className="muted">
                          点击“编辑原文”添加资料，或导入已有抽取结果。
                        </p>
                      ) : span ? (
                        <>
                          {span.before}
                          <mark data-testid="evidence-highlight">
                            {span.quote}
                          </mark>
                          {span.after}
                        </>
                      ) : (
                        doc.text
                      )}
                    </div>
                  )}
                  <footer className="paper-footer">
                    <span>
                      {new Intl.NumberFormat("zh-CN").format(
                        Array.from(doc.text).length,
                      )}{" "}
                      字符
                    </span>
                    <span>
                      {span
                        ? `证据区间 ${span.start}–${span.end}`
                        : stale
                          ? "原文已变更"
                          : "选择右侧记录查看依据"}
                    </span>
                  </footer>
                </article>
                <details className="import-panel">
                  <summary>
                    <Upload size={16} aria-hidden="true" />
                    导入 JSONL / 项目
                  </summary>
                  <p>
                    每行一份 LangExtract
                    文档；完整项目包含人工修订和未应用草稿。选择文件会直接导入为新项目。
                  </p>
                  <label className="file-input">
                    从文件直接导入新项目
                    <input
                      type="file"
                      name="evidence-file"
                      accept=".json,.jsonl,.ndjson"
                      aria-label="选择 JSONL 或项目文件"
                      onChange={(e) => {
                        void readFile(e.target.files?.[0]);
                        e.target.value = "";
                      }}
                    />
                  </label>
                  <label>
                    待导入内容
                    <textarea
                      aria-label="待导入 JSONL"
                      name="import-jsonl"
                      spellCheck={false}
                      autoComplete="off"
                      value={stringDraft(p.draft.importText)}
                      onChange={(e) =>
                        p.setDraft((old) => ({
                          ...old,
                          importText: e.target.value,
                        }))
                      }
                      placeholder={
                        '{"document_id":"资料-01","text":"…","extractions":[]}'
                      }
                    />
                  </label>
                  <button
                    onClick={() =>
                      void importText(stringDraft(p.draft.importText))
                    }
                    disabled={p.busy}
                  >
                    导入为新项目
                  </button>
                </details>
              </section>
              <section className="ledger" aria-label="抽取记录账本">
                <header className="ledger-heading">
                  <div>
                    <span className="eyebrow">EXTRACTION LEDGER</span>
                    <h2>
                      逐条复核{" "}
                      <span>
                        {completed} / {doc.extractions.length}
                      </span>
                    </h2>
                  </div>
                  <label>
                    <span className="sr-only">筛选复核状态</span>
                    <select
                      aria-label="筛选复核状态"
                      value={filter}
                      onChange={(e) => setFilter(e.target.value)}
                    >
                      <option value="all">全部记录</option>
                      {Object.entries(statusName).map(([key, name]) => (
                        <option key={key} value={key}>
                          {name}
                        </option>
                      ))}
                    </select>
                  </label>
                </header>
                <div
                  className={
                    rows.length > 50 ? "record-list long-list" : "record-list"
                  }
                >
                  {rows.length ? (
                    rows.map(({ e, i, r }) => (
                      <button
                        key={i}
                        className={"record " + (i === index ? "selected" : "")}
                        onClick={() => selectRecord(i)}
                        aria-pressed={i === index}
                      >
                        <span className="record-number">
                          {String(i + 1).padStart(2, "0")}
                        </span>
                        <span className="record-body">
                          <span className="record-class">
                            {e.extraction_class}
                          </span>
                          <strong>
                            {r.status === "corrected"
                              ? r.correctedText
                              : e.extraction_text || "空值"}
                          </strong>
                          <span className="record-location">
                            {stale
                              ? "原文已变更"
                              : evidenceSpan(doc, e)
                                ? `原文 ${e.char_interval?.start_pos}–${e.char_interval?.end_pos}`
                                : "未定位 · 需人工核对"}
                          </span>
                        </span>
                        <span className={"status-tag " + r.status}>
                          {statusName[r.status]}
                        </span>
                      </button>
                    ))
                  ) : (
                    <p className="empty">
                      {doc.extractions.length
                        ? "没有符合筛选条件的记录。"
                        : "还没有抽取记录。可导入 JSONL，或配置服务后抽取。"}
                    </p>
                  )}
                </div>
                {item && review ? (
                  <section className="review-card" aria-label="当前记录复核">
                    <div className="review-card-title">
                      <span>记录 {String(index + 1).padStart(2, "0")}</span>
                      <span>
                        {item.alignment_status === "match_exact"
                          ? "精确定位"
                          : item.alignment_status
                            ? "上游模糊定位"
                            : "无定位信息"}
                      </span>
                    </div>
                    <h3>{item.extraction_class}</h3>
                    <p className="original-value">
                      原始值：{item.extraction_text}
                    </p>
                    {item.attributes &&
                    Object.keys(item.attributes).length > 0 ? (
                      <dl className="attributes">
                        {Object.entries(item.attributes).map(([key, val]) => (
                          <div key={key}>
                            <dt>{key}</dt>
                            <dd>{Array.isArray(val) ? val.join("、") : val}</dd>
                          </div>
                        ))}
                      </dl>
                    ) : null}
                    {item.description && (
                      <p className="muted">{item.description}</p>
                    )}
                    <label>
                      修订值
                      <input
                        aria-label="修订值"
                        name="corrected-value"
                        autoComplete="off"
                        value={review.correctedText}
                        onChange={(e) =>
                          updateReview({ correctedText: e.target.value })
                        }
                        placeholder="仅在需要修改时填写…"
                        maxLength={10000}
                      />
                    </label>
                    <label>
                      复核笔记
                      <textarea
                        aria-label="复核笔记"
                        name="review-note"
                        autoComplete="off"
                        value={review.note}
                        onChange={(e) => updateReview({ note: e.target.value })}
                        placeholder="记录核对依据或待确认事项…"
                        maxLength={4000}
                      />
                    </label>
                    <div className="decision-buttons">
                      <button
                        className="accept"
                        disabled={stale}
                        onClick={() => setStatus("accepted")}
                      >
                        <Check size={16} aria-hidden="true" />
                        接受
                      </button>
                      <button onClick={() => setStatus("rejected")}>
                        <X size={16} aria-hidden="true" />
                        驳回
                      </button>
                      <button
                        disabled={stale}
                        onClick={() => setStatus("corrected")}
                      >
                        采用修订
                      </button>
                      <button
                        className="text-button"
                        onClick={() => setStatus("pending")}
                      >
                        重置状态
                      </button>
                    </div>
                  </section>
                ) : null}
              </section>
            </div>
          </>
        ) : tab === "config" ? (
          <section className="configuration">
            <div className="config-heading">
              <span className="eyebrow">EXTRACTION RECIPE</span>
              <h2>定义要寻找的证据</h2>
              <p>
                字段定义与示例决定抽取目标。这里只提取资料中明确出现的信息。
              </p>
            </div>
            <label>
              抽取要求
              <textarea
                aria-label="抽取要求"
                name="extraction-prompt"
                autoComplete="off"
                value={p.data.prompt}
                onChange={(e) =>
                  p.setData((old) => ({ ...old, prompt: e.target.value }))
                }
                maxLength={12000}
              />
            </label>
            <div className="field-heading">
              <h3>字段定义</h3>
              <button
                disabled={p.data.fields.length >= 24}
                onClick={() =>
                  p.setData((old) => ({
                    ...old,
                    fields: [...old.fields, { name: "", description: "" }],
                  }))
                }
              >
                <Plus size={15} aria-hidden="true" />
                添加字段
              </button>
            </div>
            {p.data.fields.map((field, i) => (
              <div className="field-row" key={i}>
                <label>
                  字段名称
                  <input
                    aria-label={`字段${i + 1}名称`}
                    name={`field-${i}-name`}
                    autoComplete="off"
                    value={field.name}
                    maxLength={100}
                    onChange={(e) =>
                      p.setData((old) => ({
                        ...old,
                        fields: old.fields.map((f, j) =>
                          i === j ? { ...f, name: e.target.value } : f,
                        ),
                      }))
                    }
                  />
                </label>
                <label>
                  含义
                  <input
                    aria-label={`字段${i + 1}含义`}
                    name={`field-${i}-description`}
                    autoComplete="off"
                    value={field.description}
                    maxLength={1000}
                    onChange={(e) =>
                      p.setData((old) => ({
                        ...old,
                        fields: old.fields.map((f, j) =>
                          i === j ? { ...f, description: e.target.value } : f,
                        ),
                      }))
                    }
                  />
                </label>
                <button
                  aria-label={`移除字段${i + 1}`}
                  onClick={() => {
                    if (confirm("移除这个字段定义？已有抽取记录会保留。"))
                      p.setData((old) => ({
                        ...old,
                        fields: old.fields.filter((_, j) => i !== j),
                      }));
                  }}
                >
                  <X size={16} aria-hidden="true" />
                </button>
              </div>
            ))}
            <label>
              抽取示例 JSON
              <textarea
                className="code-editor"
                aria-label="抽取示例 JSON"
                name="examples-json"
                spellCheck={false}
                autoComplete="off"
                value={stringDraft(
                  p.draft.examplesEditor,
                  JSON.stringify(p.data.examples, null, 2),
                )}
                onChange={(e) =>
                  p.setDraft((old) => ({
                    ...old,
                    examplesEditor: e.target.value,
                  }))
                }
              />
            </label>
            <div className="apply-row">
              <button
                onClick={() => {
                  try {
                    const next = examples(
                      JSON.parse(
                        stringDraft(
                          p.draft.examplesEditor,
                          JSON.stringify(p.data.examples),
                        ),
                      ),
                    );
                    if (p.setData((old) => ({ ...old, examples: next }))) {
                      p.setNotice("示例已应用。");
                      p.setError("");
                    }
                  } catch (e) {
                    p.report(e);
                  }
                }}
              >
                应用示例
              </button>
              <span>
                编辑中的 JSON 会保存为草稿；抽取使用上次已应用的示例。
              </span>
            </div>
          </section>
        ) : (
          <section className="jobs-panel">
            <header>
              <div>
                <span className="eyebrow">RUN LOG</span>
                <h2>抽取任务记录</h2>
                <p>{service.message}</p>
              </div>
              <button
                onClick={() => {
                  void refreshJobs();
                  void refreshService();
                }}
              >
                <RotateCcw size={15} aria-hidden="true" />
                刷新状态
              </button>
            </header>
            {isRecord(p.draft.pendingRun) && (
              <div className="source-warning">
                有一份待确认提交。重试将保留原任务标识与输入快照。
                <button
                  disabled={!service.ready || sending}
                  onClick={() => void startRun()}
                >
                  重试原任务提交
                </button>
                <button
                  onClick={() => {
                    if (
                      confirm(
                        "放弃这份本机待提交记录？请先核对任务列表，避免重复抽取。",
                      )
                    )
                      p.setDraft((old) => {
                        const next = { ...old };
                        delete next.pendingRun;
                        return next;
                      });
                  }}
                >
                  放弃待提交记录
                </button>
              </div>
            )}
            {jobs.length ? (
              jobs.map((job) => (
                <article className="job" key={job.id}>
                  <div>
                    <span className={"job-status " + job.status}>
                      {jobName[job.status]}
                    </span>
                    <h3>{job.input.documents.map((d) => d.id).join("、")}</h3>
                    <p>{job.message || "任务已记录。"}</p>
                    <small>
                      {new Intl.DateTimeFormat("zh-CN", {
                        dateStyle: "medium",
                        timeStyle: "short",
                      }).format(new Date(job.createdAt))}{" "}
                      · {job.id.slice(0, 8)}
                    </small>
                  </div>
                  <div className="job-actions">
                    {job.status === "succeeded" ? (
                      <button onClick={() => void openResult(job)}>
                        <ArrowUpRight size={16} aria-hidden="true" />
                        另开结果项目
                      </button>
                    ) : ["queued", "running", "unknown", "submitting"].includes(
                        job.status,
                      ) ? (
                      <>
                        <button
                          onClick={() =>
                            void request("/api/jobs/" + job.id)
                              .then(validateJob)
                              .then((r) =>
                                setJobs((old) =>
                                  old.map((x) => (x.id === r.id ? r : x)),
                                ),
                              )
                              .catch(p.report)
                          }
                        >
                          查询原任务
                        </button>
                        <button onClick={() => void cancel(job)}>
                          停止接收结果
                        </button>
                      </>
                    ) : null}
                    <details>
                      <summary>输入快照</summary>
                      <pre>{JSON.stringify(job.input, null, 2)}</pre>
                    </details>
                  </div>
                </article>
              ))
            ) : (
              <div className="empty jobs-empty">
                <Activity size={30} aria-hidden="true" />
                <h3>还没有抽取任务</h3>
                <p>
                  连接服务并配置示例后，即可提交资料。已有 JSONL
                  可直接导入复核。
                </p>
              </div>
            )}
          </section>
        )}
      </main>
      <footer className="desk-footer">
        <span>LangExtract · 证据与修订分开保留</span>
        <span>原始 JSONL 保留抽取时原文，审校结果见 CSV / 完整项目。</span>
      </footer>
    </div>
  );
}
