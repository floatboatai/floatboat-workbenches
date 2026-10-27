import { useEffect, useMemo, useRef, useState } from "react";
import {
  FileText,
  Upload,
  Download,
  Check,
  ArrowUp,
  ArrowDown,
  PanelRight,
  Plus,
  ChevronRight,
  Table2,
  Settings2,
} from "lucide-react";
import {
  useProjects,
  ProjectPicker,
  Notice,
  download,
  request,
} from "./workspace";
import {
  empty,
  fromDocument,
  validateReview,
  restoreReviewDraft,
  assertWorkingCopyCapacity,
  exportReview,
  WORKING_COPY_BYTES,
  type Review,
  importReview,
  items,
  corrected,
  markdown,
  tableCsv,
  moveSibling,
  type Correction,
  type Item,
} from "../contracts/document";
import { example } from "../contracts/example";
import { jobValue, type Job } from "../contracts/jobs";
import { isRecord } from "../contracts/project";
const seed = fromDocument(
  example,
  "示例 · Docling 2.140.0 实际转换的原创 HTML",
);
const labels: Record<string, string> = {
  title: "标题",
  section_header: "章节",
  text: "正文",
  table: "表格",
  list_item: "列表",
  caption: "图注",
  footnote: "脚注",
  picture: "图片",
  unspecified: "分组",
};
const states: Record<string, string> = {
  preparing: "保存输入",
  submitting: "提交中",
  uncertain: "提交待核对",
  pending: "排队中",
  running: "转换中",
  success: "可采用",
  failure: "失败",
  paused: "已暂停跟踪",
};
function label(n: Item) {
  return labels[n.label] ?? n.label;
}
function TablePreview({ node }: { node: Item }) {
  const data = node.data;
  if (!data) return null;
  return (
    <div className="table-scroll">
      <table>
        <tbody>
          {Array.from({ length: data.num_rows }, (_, r) => (
            <tr key={r}>
              {data.table_cells
                .filter((cell) => cell.start_row_offset_idx === r)
                .sort((a, b) => a.start_col_offset_idx - b.start_col_offset_idx)
                .map((cell) =>
                  cell.column_header ? (
                    <th
                      key={cell.start_col_offset_idx}
                      rowSpan={cell.row_span}
                      colSpan={cell.col_span}
                      scope="col"
                    >
                      {cell.text}
                    </th>
                  ) : (
                    <td
                      key={cell.start_col_offset_idx}
                      rowSpan={cell.row_span}
                      colSpan={cell.col_span}
                    >
                      {cell.text}
                    </td>
                  ),
                )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function App() {
  const p = useProjects(seed, validateReview, "示例 · 现场试验记录", {
    storageKey: "docling-review-v1",
    restoreDraftData: restoreReviewDraft,
  });
  const working = useRef({ title: p.title, data: p.data, extra: p.draft });
  working.current = { title: p.title, data: p.data, extra: p.draft };
  function changeData(value: Review) {
    try {
      const data = restoreReviewDraft(value);
      assertWorkingCopyCapacity(
        working.current.title,
        data,
        working.current.extra,
      );
      working.current = { ...working.current, data };
      p.setData(data);
    } catch (error) {
      p.report(error);
    }
  }
  function changeDraft(
    update: (extra: Record<string, unknown>) => Record<string, unknown>,
  ): boolean {
    try {
      const extra = update(working.current.extra);
      assertWorkingCopyCapacity(
        working.current.title,
        working.current.data,
        extra,
      );
      working.current = { ...working.current, extra };
      p.setDraft(extra);
      return true;
    } catch (error) {
      p.report(error);
      return false;
    }
  }
  function changeTitle(title: string) {
    try {
      assertWorkingCopyCapacity(
        title,
        working.current.data,
        working.current.extra,
      );
      working.current = { ...working.current, title };
      p.setTitle(title);
    } catch (error) {
      p.report(error);
    }
  }
  async function replaceReview(
    value: Review,
    title: string,
    extra: Record<string, unknown> = {},
  ): Promise<boolean> {
    try {
      const data = restoreReviewDraft(value);
      assertWorkingCopyCapacity(title, data, extra);
      return await p.replace(data, title, extra);
    } catch (error) {
      p.report(error);
      return false;
    }
  }
  const [selected, setSelected] = useState("#/tables/0"),
    [query, setQuery] = useState(""),
    [drawer, setDrawer] = useState<"import" | "service" | null>(null),
    [view, setView] = useState<"review" | "source">("review");
  const [jobs, setJobs] = useState<Job[]>([]),
    [health, setHealth] = useState({
      configured: false,
      reachable: false,
      message: "检查转换服务…",
    }),
    [runBusy, setRunBusy] = useState(false),
    [jobId, setJobId] = useState("");
  const epoch = useRef(p.documentKey);
  epoch.current = p.documentKey;
  const original = p.data.original,
    doc = useMemo(() => corrected(p.data), [p.data]);
  const rows = useMemo(
    () => (original ? items(original, p.data.order) : []),
    [original, p.data.order],
  );
  const effective = useMemo(
    () => new Map(doc ? items(doc).map((x) => [x.item.self_ref, x.item]) : []),
    [doc],
  );
  const active =
      rows.find((x) => x.item.self_ref === selected)?.item ?? rows[0]?.item,
    activeRef = active?.self_ref ?? "",
    edited = effective.get(activeRef),
    correction = p.data.corrections[activeRef];
  const currentJob = jobs.find((x) => x.id === jobId) ?? jobs[0];
  const raw = typeof p.draft.raw === "string" ? p.draft.raw : "";
  const html = typeof p.draft.html === "string" ? p.draft.html : "";
  const filename =
    typeof p.draft.filename === "string" ? p.draft.filename : "document.html";
  const taskId = typeof p.draft.taskId === "string" ? p.draft.taskId : "";
  async function loadJobs() {
    const v = await request("/api/docling/jobs");
    if (!Array.isArray(v)) throw new Error("任务列表无效。");
    setJobs(v.map(jobValue));
  }
  async function healthCheck() {
    const v = await request("/api/docling");
    if (
      !isRecord(v) ||
      typeof v.configured !== "boolean" ||
      typeof v.reachable !== "boolean" ||
      typeof v.message !== "string"
    )
      throw new Error("服务状态无效。");
    setHealth({
      configured: v.configured,
      reachable: v.reachable,
      message: v.message,
    });
  }
  useEffect(() => {
    void Promise.all([loadJobs(), healthCheck()]).catch(p.report);
  }, []);
  const pollingKey = jobs
    .filter((j) => ["pending", "running"].includes(j.state))
    .map((j) => j.id)
    .join(",");
  useEffect(() => {
    if (!pollingKey) return;
    let stopped = false;
    const timer = setInterval(() => {
      void Promise.all(
        pollingKey.split(",").map((id) =>
          request("/api/docling/jobs/" + id + "/refresh", {
            method: "POST",
            body: "{}",
          }),
        ),
      )
        .then((values) => {
          if (!stopped)
            setJobs((old) =>
              old.map(
                (j) => values.map(jobValue).find((v) => v.id === j.id) ?? j,
              ),
            );
        })
        .catch(p.report);
    }, 4000);
    return () => {
      stopped = true;
      clearInterval(timer);
    };
  }, [pollingKey]);
  function patch(value: Partial<Correction>) {
    if (!active) return;
    changeData({
      ...p.data,
      corrections: {
        ...p.data.corrections,
        [activeRef]: {
          ...(correction ?? { reviewed: false, note: "" }),
          ...value,
        },
      },
    });
  }
  function exportFile(
    content: string,
    name: string,
    type = "application/json",
  ) {
    download(new Blob([content], { type }), name);
  }
  async function importContent(text: string) {
    const parsed: unknown = JSON.parse(text);
    const snapshot =
      isRecord(parsed) && isRecord(parsed.snapshot) ? parsed.snapshot : null;
    const data = snapshot
      ? restoreReviewDraft(snapshot.data)
      : importReview(text);
    const extra = snapshot && isRecord(snapshot.extra) ? snapshot.extra : {};
    if (
      await replaceReview(
        data,
        snapshot && typeof snapshot.title === "string"
          ? snapshot.title
          : data.original?.name || "导入文档",
        extra,
      )
    ) {
      setSelected("");
      setDrawer(null);
      p.setNotice("已作为新项目导入。");
    }
  }
  async function importRaw() {
    try {
      await importContent(raw);
    } catch (error) {
      p.report(error);
    }
  }
  async function readImport(file: File | undefined) {
    if (!file) return;
    if (file.size > WORKING_COPY_BYTES) {
      p.setError("导入文件不能超过 1.85 MB。");
      return;
    }
    const key = epoch.current;
    try {
      const text = await file.text();
      if (key !== epoch.current) return;
      // Valid files are decoded before transition, without duplicating a large project in raw input.
      try {
        await importContent(text);
      } catch (error) {
        changeDraft((d) => ({ ...d, raw: text }));
        setDrawer("import");
        p.report(error);
      }
    } catch (error) {
      p.report(error);
    }
  }
  async function submit() {
    setRunBusy(true);
    p.setError("");
    const id = crypto.randomUUID();
    changeDraft((d) => ({ ...d, lastOperation: id }));
    try {
      const job = jobValue(
        await request("/api/docling/jobs", {
          method: "POST",
          body: JSON.stringify({ id, filename, html }),
        }),
      );
      setJobId(job.id);
      await loadJobs();
    } catch (e) {
      p.report(e);
      await loadJobs().catch(() => {});
    } finally {
      setRunBusy(false);
    }
  }
  async function jobAction(action: string) {
    if (!currentJob) return;
    setRunBusy(true);
    try {
      await request("/api/docling/jobs/" + currentJob.id + "/" + action, {
        method: "POST",
        body: JSON.stringify(action === "attach" ? { taskId } : {}),
      });
      await loadJobs();
    } catch (e) {
      p.report(e);
    } finally {
      setRunBusy(false);
    }
  }
  async function accept() {
    if (!currentJob) return;
    const key = epoch.current;
    setRunBusy(true);
    try {
      const v = await request("/api/docling/jobs/" + currentJob.id + "/result");
      if (key !== epoch.current) return;
      const data = fromDocument(
        v,
        "Docling Serve · " +
          currentJob.filename +
          " · task " +
          currentJob.taskId,
      );
      if (await replaceReview(data, data.original?.name ?? "转换结果")) {
        setDrawer(null);
        setSelected("");
        p.setNotice("转换结果已作为新项目打开。");
      }
    } catch (e) {
      p.report(e);
    } finally {
      setRunBusy(false);
    }
  }
  const reviewed = Object.values(p.data.corrections).filter(
    (c) => c.reviewed,
  ).length;
  return (
    <div className="studio">
      <a className="skip" href="#document">
        跳到文稿
      </a>
      <header className="masthead">
        <div className="brand">
          <span className="brand-symbol">
            <FileText size={23} aria-hidden="true" />
          </span>
          <div>
            <h1>
              Docling <span>校对台</span>
            </h1>
            <small>DOCUMENT REVIEW</small>
          </div>
        </div>
        <div className="file-heading">
          <input
            aria-label="项目名称"
            value={p.title}
            onChange={(e) => changeTitle(e.target.value)}
            autoComplete="off"
          />
          <span className={"save-state " + p.autoState.phase} role="status">
            {p.autoState.phase === "saved" && raw.trim()
              ? "工作副本已保存 · 导入草稿未应用"
              : p.autoState.message}
          </span>
        </div>
        <button
          onClick={() => setDrawer(drawer === "service" ? null : "service")}
          className="service-button"
        >
          <span className={health.reachable ? "dot online" : "dot"} />
          <span>转换服务</span>
          <Settings2 size={15} aria-hidden="true" />
        </button>
      </header>
      <nav className="filebar" aria-label="文件操作">
        <ProjectPicker
          items={p.items}
          id={p.current?.id}
          disabled={p.busy}
          onOpen={(id) => {
            void p.open(id);
          }}
        />
        <button
          onClick={() => {
            void replaceReview({ ...empty }, "未命名文档");
          }}
        >
          <Plus size={15} aria-hidden="true" />
          新建
        </button>
        <button
          onClick={() => setDrawer(drawer === "import" ? null : "import")}
        >
          <Upload size={15} aria-hidden="true" />
          导入 JSON
        </button>
        <details className="export-menu">
          <summary>
            <Download size={15} aria-hidden="true" />
            导出
          </summary>
          <div>
            <button
              disabled={!doc}
              onClick={() =>
                exportFile(markdown(p.data), p.title + ".md", "text/markdown")
              }
            >
              Markdown 文稿
            </button>
            <button
              disabled={!doc}
              onClick={() =>
                exportFile(
                  JSON.stringify(doc, null, 2),
                  p.title + ".docling.json",
                )
              }
            >
              校订 Docling JSON
            </button>
            <button
              onClick={() =>
                exportFile(exportReview(p.data), p.title + ".review.json")
              }
            >
              可移植校对项目
            </button>
            <button onClick={p.exportDraft}>恢复用工作副本</button>
          </div>
        </details>
        <span className="spacer" />
        <button
          className="quiet"
          onClick={() => {
            void p.save();
          }}
        >
          立即保存
        </button>
        <button
          className="quiet"
          disabled={!p.current}
          onClick={() => {
            void p.remove();
          }}
        >
          删除项目
        </button>
      </nav>
      <Notice error={p.error} notice={p.notice} />
      {p.autoState.phase === "conflict" && (
        <div className="conflict" role="alert">
          其他窗口已更新此项目。请先导出工作副本，再读取服务器版本。
          <button onClick={p.exportDraft}>导出工作副本</button>
          <button
            onClick={() => {
              if (p.current && confirm("读取服务器版本？本窗口内容请先导出。"))
                void p.open(p.current.id);
            }}
          >
            读取服务器版本
          </button>
        </div>
      )}
      {drawer === "import" && (
        <section className="drawer" aria-label="导入文档">
          <div className="drawer-title">
            <h2>导入结构化文档</h2>
            <button onClick={() => setDrawer(null)}>收起</button>
          </div>
          <p>
            选择 DoclingDocument JSON
            或校对项目。每次导入都会创建新项目；未应用的输入也会保存。
          </p>
          <label className="file-input">
            选择 JSON 文件
            <input
              type="file"
              accept=".json,application/json"
              onChange={(e) => {
                void readImport(e.target.files?.[0]);
                e.target.value = "";
              }}
            />
          </label>
          <label>
            JSON 内容
            <textarea
              aria-label="JSON 内容"
              className="raw"
              spellCheck={false}
              value={raw}
              onChange={(e) =>
                changeDraft((d) => ({ ...d, raw: e.target.value }))
              }
            />
          </label>
          <div className="actions">
            <button
              className="primary"
              onClick={() => {
                void importRaw();
              }}
            >
              校验并导入为新项目
            </button>
            <button
              onClick={() => {
                void p
                  .replace(structuredClone(seed), "示例 · 现场试验记录")
                  .then((ok) => {
                    if (ok) setDrawer(null);
                  });
              }}
            >
              打开示例文档
            </button>
          </div>
        </section>
      )}
      {drawer === "service" && (
        <section className="drawer service" aria-label="转换服务">
          <div className="drawer-title">
            <h2>从 HTML 创建文档结构</h2>
            <button onClick={() => setDrawer(null)}>收起</button>
          </div>
          <p role="status">{health.message}</p>
          <div className="service-columns">
            <div>
              <label>
                HTML 文件（≤ 400 KB）
                <input
                  type="file"
                  accept=".html,.htm,text/html"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) {
                      if (f.size > 400000)
                        p.setError("HTML 文件不能超过 400 KB。");
                      else
                        void f
                          .text()
                          .then((text) =>
                            changeDraft((d) => ({
                              ...d,
                              html: text,
                              filename: f.name,
                            })),
                          )
                          .catch(p.report);
                    }
                    e.target.value = "";
                  }}
                />
              </label>
              <label>
                文件名
                <input
                  value={filename}
                  onChange={(e) =>
                    changeDraft((d) => ({ ...d, filename: e.target.value }))
                  }
                />
              </label>
              <label>
                源 HTML
                <textarea
                  aria-label="源 HTML"
                  spellCheck={false}
                  value={html}
                  onChange={(e) =>
                    changeDraft((d) => ({ ...d, html: e.target.value }))
                  }
                />
              </label>
              <div className="actions">
                <button
                  className="primary"
                  disabled={runBusy || !html.trim() || !health.reachable}
                  onClick={() => {
                    void submit();
                  }}
                >
                  {runBusy ? "正在处理…" : "提交转换"}
                </button>
                <button
                  onClick={() => {
                    void healthCheck().catch(p.report);
                  }}
                >
                  检查连接
                </button>
              </div>
              <p className="hint">
                源文件将发送到已配置的 Docling
                Serve。提交后可继续校对；结果将作为新项目打开。
              </p>
            </div>
            <div className="job-panel">
              <h3>转换记录</h3>
              {jobs.length === 0 ? (
                <p className="hint">尚无转换记录。已导入的文档可直接校对。</p>
              ) : (
                <>
                  <label>
                    选择转换
                    <select
                      value={currentJob?.id ?? ""}
                      onChange={(e) => setJobId(e.target.value)}
                    >
                      {jobs.map((j) => (
                        <option key={j.id} value={j.id}>
                          {j.filename} · {states[j.state]}
                        </option>
                      ))}
                    </select>
                  </label>
                  {currentJob && (
                    <>
                      <strong className="job-state">
                        {states[currentJob.state]}
                      </strong>
                      <p role="status">{currentJob.message}</p>
                      <dl>
                        <dt>本地操作</dt>
                        <dd>{currentJob.id}</dd>
                        <dt>上游任务</dt>
                        <dd>{currentJob.taskId ?? "尚未取得"}</dd>
                        <dt>输入 SHA-256</dt>
                        <dd>{currentJob.inputHash}</dd>
                      </dl>
                      <div className="actions">
                        <button
                          disabled={runBusy}
                          onClick={() => {
                            void jobAction("refresh");
                          }}
                        >
                          刷新状态
                        </button>
                        {["running", "pending"].includes(currentJob.state) && (
                          <button
                            disabled={runBusy}
                            onClick={() => {
                              void jobAction("pause");
                            }}
                          >
                            暂停跟踪
                          </button>
                        )}
                        {currentJob.state === "paused" && (
                          <button
                            onClick={() => {
                              void jobAction("resume");
                            }}
                          >
                            恢复跟踪
                          </button>
                        )}
                        {currentJob.state === "success" && (
                          <button
                            className="primary"
                            onClick={() => {
                              void accept();
                            }}
                          >
                            结果作为新项目打开
                          </button>
                        )}
                      </div>
                      {currentJob.state === "uncertain" && (
                        <>
                          <label>
                            从服务日志取得的任务 ID
                            <input
                              value={taskId}
                              onChange={(e) =>
                                changeDraft((d) => ({
                                  ...d,
                                  taskId: e.target.value,
                                }))
                              }
                            />
                          </label>
                          <button
                            disabled={runBusy || !taskId.trim()}
                            onClick={() => {
                              void jobAction("attach");
                            }}
                          >
                            关联已有任务
                          </button>
                        </>
                      )}
                    </>
                  )}
                </>
              )}
            </div>
          </div>
        </section>
      )}
      <div className="review-layout">
        <aside className="structure">
          <div className="panel-label">
            <span>文档结构</span>
            <span>{rows.length} 项</span>
          </div>
          <input
            className="search"
            aria-label="搜索文档结构"
            placeholder="查找文本或类型…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <ol>
            {rows
              .filter(({ item: n }) =>
                ((n.text ?? "") + " " + label(n))
                  .toLowerCase()
                  .includes(query.toLowerCase()),
              )
              .map(({ item: n, depth }, i) => (
                <li key={n.self_ref}>
                  <button
                    className={n.self_ref === activeRef ? "selected" : ""}
                    onClick={() => setSelected(n.self_ref)}
                    style={{ paddingLeft: Math.min(depth, 3) * 12 + 12 }}
                    aria-current={n.self_ref === activeRef ? "true" : undefined}
                  >
                    <span className="ordinal">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <span className="structure-text">
                      <small>{label(n)}</small>
                      <span>
                        {n.text ||
                          (n.data
                            ? `${n.data.num_rows} 行 × ${n.data.num_cols} 列`
                            : "结构项")}
                      </span>
                    </span>
                    {p.data.corrections[n.self_ref]?.reviewed ? (
                      <Check size={13} aria-label="已复核" />
                    ) : (
                      <ChevronRight size={13} aria-hidden="true" />
                    )}
                  </button>
                </li>
              ))}
          </ol>
          {query &&
            !rows.some(({ item: n }) =>
              ((n.text ?? "") + " " + label(n))
                .toLowerCase()
                .includes(query.toLowerCase()),
            ) && <p className="hint no-results">没有匹配的结构项。</p>}
          <div className="structure-footer">
            <span>
              {reviewed} / {rows.length} 已复核
            </span>
            <div className="progress">
              <i
                style={{
                  width:
                    (rows.length ? (reviewed / rows.length) * 100 : 0) + "%",
                }}
              />
            </div>
            <p>{p.data.source || "导入文档以开始校对"}</p>
          </div>
        </aside>
        <main id="document" className="document-desk">
          <div className="document-tools">
            <div className="segmented" aria-label="文稿视图">
              <button
                aria-pressed={view === "review"}
                onClick={() => setView("review")}
              >
                校订文稿
              </button>
              <button
                aria-pressed={view === "source"}
                onClick={() => setView("source")}
              >
                源文本
              </button>
            </div>
            <span>{Object.keys(p.data.corrections).length} 项校订记录</span>
          </div>
          {original ? (
            <article className="paper">
              <div className="paper-meta">
                <span>STRUCTURE PROOF</span>
                <span>{original.version as string}</span>
              </div>
              {rows.map(({ item: n }) => {
                const shown =
                  view === "source" ? n : (effective.get(n.self_ref) ?? n);
                return (
                  <section
                    className={
                      "paper-block " +
                      (n.content_layer === "furniture" ? "furniture " : "") +
                      (activeRef === n.self_ref ? "active" : "")
                    }
                    key={n.self_ref}
                  >
                    <button
                      className="block-select"
                      aria-label={"选择 " + (n.text ?? label(n))}
                      onClick={() => setSelected(n.self_ref)}
                    >
                      <span className="block-marker">
                        {n.content_layer === "furniture"
                          ? "页眉 / 页脚 · "
                          : ""}
                        {label(n)}
                      </span>
                      {shown.data ? (
                        <span className="table-heading">
                          <Table2 size={15} aria-hidden="true" />
                          Table {original.tables.indexOf(n) + 1}
                        </span>
                      ) : (
                        <span className={"body-text " + shown.label}>
                          {shown.text || "［空结构项］"}
                        </span>
                      )}
                    </button>
                    {shown.data && <TablePreview node={shown} />}
                  </section>
                );
              })}
              <footer className="paper-end">— END OF DOCUMENT —</footer>
            </article>
          ) : (
            <div className="empty">
              <FileText size={40} aria-hidden="true" />
              <h2>打开一份结构化文档</h2>
              <p>导入 Docling JSON，核对文字、阅读次序与表格。</p>
              <button className="primary" onClick={() => setDrawer("import")}>
                导入文档
              </button>
            </div>
          )}
        </main>
        <aside className="inspector" aria-label="校订面板">
          <div className="panel-label">
            <span>
              <PanelRight size={15} aria-hidden="true" />
              校订面板
            </span>
            <span>{active ? label(active) : "未选择"}</span>
          </div>
          {active ? (
            <>
              <div className="ref-tag">{activeRef}</div>
              <div className="inspector-section">
                <label className="review-check">
                  <input
                    type="checkbox"
                    checked={correction?.reviewed ?? false}
                    onChange={(e) => patch({ reviewed: e.target.checked })}
                  />
                  <span>此项已复核</span>
                </label>
                <label>
                  结构类型
                  <select
                    disabled={
                      Boolean(active.data) || active.label === "picture"
                    }
                    value={correction?.label ?? active.label}
                    onChange={(e) => patch({ label: e.target.value })}
                  >
                    {Array.from(
                      new Set([
                        active.label,
                        ...Object.keys(labels).filter(
                          (x) =>
                            !["table", "picture", "unspecified"].includes(x),
                        ),
                      ]),
                    ).map((x) => (
                      <option value={x} key={x}>
                        {labels[x] ?? x}
                      </option>
                    ))}
                  </select>
                </label>
                {active.text !== undefined && (
                  <>
                    <label>
                      校订文本
                      <textarea
                        aria-label="校订文本"
                        value={correction?.text ?? active.text}
                        onChange={(e) =>
                          patch({ text: e.target.value, reviewed: false })
                        }
                      />
                    </label>
                    <details className="source-compare" open>
                      <summary>原始文本</summary>
                      <p>{active.text || "（空）"}</p>
                    </details>
                  </>
                )}
                {active.data && (
                  <div className="cell-editor">
                    <div className="section-heading">
                      <h3>表格单元格</h3>
                      <button
                        className="quiet"
                        onClick={() => {
                          if (edited)
                            exportFile(
                              tableCsv(edited),
                              "table.csv",
                              "text/csv;charset=utf-8",
                            );
                        }}
                      >
                        导出 CSV
                      </button>
                    </div>
                    <p className="hint">保留原表合并范围；逐格修订文本。</p>
                    {active.data.table_cells.map((cell, i) => (
                      <label key={i}>
                        <span>
                          R{cell.start_row_offset_idx + 1} · C
                          {cell.start_col_offset_idx + 1}
                          {cell.row_span > 1 || cell.col_span > 1
                            ? ` (${cell.row_span}×${cell.col_span})`
                            : ""}
                        </span>
                        <input
                          aria-label={`R${cell.start_row_offset_idx + 1} C${cell.start_col_offset_idx + 1}`}
                          value={correction?.cells?.[String(i)] ?? cell.text}
                          onChange={(e) =>
                            patch({
                              cells: {
                                ...correction?.cells,
                                [String(i)]: e.target.value,
                              },
                              reviewed: false,
                            })
                          }
                        />
                      </label>
                    ))}
                  </div>
                )}
              </div>
              <div className="inspector-section">
                <h3>阅读次序</h3>
                <div className="actions">
                  <button
                    onClick={() =>
                      changeData(moveSibling(p.data, activeRef, -1))
                    }
                  >
                    <ArrowUp size={14} aria-hidden="true" />
                    同级上移
                  </button>
                  <button
                    onClick={() =>
                      changeData(moveSibling(p.data, activeRef, 1))
                    }
                  >
                    <ArrowDown size={14} aria-hidden="true" />
                    同级下移
                  </button>
                </div>
                <p className="hint">在同一父级下调整，保留结构引用。</p>
                {isRecord(active.parent) &&
                  typeof active.parent.$ref === "string" && (
                    <p className="hint">
                      父级引用：<code>{active.parent.$ref}</code>
                    </p>
                  )}
                {active.children.length > 0 && (
                  <div className="references">
                    子项{" "}
                    {active.children.map((c) => (
                      <button key={c.$ref} onClick={() => setSelected(c.$ref)}>
                        {c.$ref}
                      </button>
                    ))}
                  </div>
                )}
                {Array.isArray(active.prov) && active.prov.length > 0 && (
                  <p className="hint">
                    来源页码：
                    {active.prov
                      .filter(isRecord)
                      .map((v) => String(v.page_no))
                      .join("、")}
                  </p>
                )}
                <label>
                  复核备注
                  <textarea
                    className="notes"
                    aria-label="复核备注"
                    value={correction?.note ?? ""}
                    onChange={(e) => patch({ note: e.target.value })}
                    placeholder="记录歧义或需要回查的内容…"
                  />
                </label>
                <button
                  className="quiet"
                  disabled={!correction}
                  onClick={() => {
                    if (confirm("移除此项的校订与复核记录？"))
                      changeData({
                        ...p.data,
                        corrections: Object.fromEntries(
                          Object.entries(p.data.corrections).filter(
                            ([k]) => k !== activeRef,
                          ),
                        ),
                      });
                  }}
                >
                  撤销此项校订
                </button>
              </div>
            </>
          ) : (
            <p className="hint">在文稿或结构目录中选择一项。</p>
          )}
        </aside>
      </div>
    </div>
  );
}
