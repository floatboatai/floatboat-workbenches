import { useEffect, useRef, useState, useMemo } from "react";
import Markdown from "react-markdown";
import {
  BookOpen,
  FileText,
  Check,
  ArrowDownToLine,
  Upload,
  Plus,
  Link2,
  RefreshCw,
  Folder,
  ChevronRight,
} from "lucide-react";
import {
  useProjects,
  ProjectPicker,
  Notice,
  request,
  download,
} from "./workspace";
import {
  seed,
  researchValue,
  restoreResearch,
  nativeValue,
  fromNative,
  lastReport,
  extractSources,
  assertReady,
  exportReport,
  safeUrl,
  threadValue,
  type Research,
  type Source,
} from "../contracts/research";
import { isRecord, boundedText } from "../contracts/project";
type Sync = {
  id: string;
  projectId: string;
  threadId: string;
  status: string;
  native: string;
  error: string;
  createdAt: string;
};
function syncValue(v: unknown): Sync {
  if (!isRecord(v)) throw new Error("同步记录无效。");
  return {
    id: boundedText(v.id, 100),
    projectId: boundedText(v.projectId, 100),
    threadId: boundedText(v.threadId, 100),
    status: boundedText(v.status, 40),
    native: boundedText(v.native, 650000),
    error: boundedText(v.error, 300),
    createdAt: boundedText(v.createdAt, 50),
  };
}
const statuses: Record<string, string> = {
  running: "读取中",
  completed: "快照已就绪",
  failed: "读取失败",
  interrupted: "读取中断",
};
import { ResearchRunner } from "./ResearchRunner";
import { DEFAULT_MODEL } from "../contracts/run";
export function App() {
  const p = useProjects(seed, researchValue, "城市步行导览 / 研究交付", {
    storageKey: "deerflow-review-v1",
    restoreDraftData: restoreResearch,
  });
  const [tab, setTab] = useState("research"),
    [editing, setEditing] = useState(true),
    [busy, setBusy] = useState(false),
    [syncs, setSyncs] = useState<Sync[]>([]),
    [configured, setConfigured] = useState(false),
    [serviceMessage, setServiceMessage] = useState("正在检查上游配置…"),
    [jsonOpen, setJsonOpen] = useState(false);
  const file = useRef<HTMLInputElement>(null),
    epoch = useRef(p.documentKey),
    pollSeq = useRef(0);
  epoch.current = p.documentKey;
  const [transitioning, setTransitioning] = useState(false);
  const transitionRef = useRef(false);
  async function transition(action: () => Promise<unknown>) {
    if (transitionRef.current) return;
    transitionRef.current = true;
    setTransitioning(true);
    try {
      await action();
    } catch (e) {
      p.report(e);
    } finally {
      transitionRef.current = false;
      setTransitioning(false);
    }
  }
  const native = useMemo(
      () => nativeValue(p.data.native).view,
      [p.data.native],
    ),
    mutable = !p.loading && !p.busy && !transitioning;
  const checked = p.data.sources.filter((s) => s.checked).length;
  const dataRef = useRef(p.data);
  dataRef.current = p.data;
  const [syncError, setSyncError] = useState("");
  useEffect(() => {
    let active = true;
    request("/api/service-status")
      .then((v) => {
        if (active && isRecord(v)) {
          setConfigured(v.configured === true);
          setServiceMessage(
            typeof v.message === "string" ? v.message : "配置不可用。",
          );
        }
      })
      .catch(() => {
        if (active) setServiceMessage("无法读取上游配置。");
      });
    return () => {
      active = false;
    };
  }, []);
  useEffect(() => {
    const id = p.current?.id,
      key = p.documentKey;
    if (!id) {
      setSyncs([]);
      return;
    }
    let active = true;
    async function refresh() {
      const seq = ++pollSeq.current;
      try {
        const value = await request("/api/projects/" + id + "/syncs");
        if (!Array.isArray(value)) throw new Error("同步列表格式无效。");
        if (active && epoch.current === key && seq === pollSeq.current) {
          setSyncs(value.map(syncValue));
          setSyncError("");
        }
      } catch {
        if (active && epoch.current === key)
          setSyncError("同步记录暂时无法刷新，原记录仍保留。");
      }
    }
    void refresh();
    const timer = setInterval(() => void refresh(), 2500);
    return () => {
      active = false;
      clearInterval(timer);
      pollSeq.current++;
    };
  }, [p.current?.id, p.documentKey]);
  function change(fn: (data: Research) => Research) {
    p.setData((d) => {
      const next = fn(d);
      return { ...next, stage: d.stage === "ready" ? "reviewing" : next.stage };
    });
  }
  function adopt() {
    const report = lastReport(p.data.native);
    if (!report) {
      p.setError("原生会话没有可采用的助手答复。");
      return;
    }
    if (
      p.data.report.trim() &&
      !confirm("用最新会话答复替换当前报告正文？现有改稿可先导出。")
    )
      return;
    change((d) => ({ ...d, report, stage: "reviewing" }));
    p.setNotice("已复制答复到报告草稿，原始会话仍保留。");
    setTab("report");
  }
  function sourceChange(id: string, patch: Partial<Source>) {
    change((d) => ({
      ...d,
      sources: d.sources.map((s) =>
        s.id === id
          ? { ...s, ...patch, ...("url" in patch ? { checked: false } : {}) }
          : s,
      ),
    }));
  }
  async function sync() {
    let id: string;
    try {
      id = threadValue(p.data.threadId);
    } catch (e) {
      p.report(e);
      return;
    }
    setBusy(true);
    p.setError("");
    const key = epoch.current;
    try {
      const saved = await p.save();
      if (!saved) throw new Error("请先完善并保存当前项目。");
      const runId = crypto.randomUUID();
      p.setDraft((d) => ({ ...d, lastSyncId: runId }));
      const result = syncValue(
        await request("/api/syncs", {
          method: "POST",
          body: JSON.stringify({
            projectId: saved.id,
            id: runId,
            threadId: id,
          }),
        }),
      );
      if (key === epoch.current) {
        setSyncs((v) => [result, ...v.filter((x) => x.id !== result.id)]);
        p.setNotice("正在只读获取上游会话，不会启动新的研究任务。");
      }
    } catch (e) {
      if (key === epoch.current) p.report(e);
    } finally {
      setBusy(false);
    }
  }
  function applyNative(text: string, threadId: string) {
    nativeValue(text);
    p.setError("");
    const d = dataRef.current;
    const incoming = extractSources(text).map((s) => ({
      ...s,
      note: d.sources.find((x) => x.url === s.url)?.note ?? "",
    }));
    const manual = d.sources.filter(
      (s) => s.origin === "手动添加" && !incoming.some((x) => x.url === s.url),
    );
    if (incoming.length + manual.length > 100)
      throw new Error(
        "合并后来源超过100项，请先导出并整理来源；原快照和报告均已保留。",
      );
    change((current) => ({
      ...current,
      native: text,
      sources: [...incoming, ...manual],
      threadId: threadId,
      stage: "reviewing",
    }));
    p.setNotice("已载入新会话快照；人工报告未覆盖，来源需重新核验。");
  }
  async function applySnapshot(id: string) {
    const key = epoch.current;
    setBusy(true);
    p.setError("");
    try {
      const snapshot = syncValue(await request("/api/syncs/" + id));
      if (snapshot.status !== "completed" || !snapshot.native)
        throw new Error("快照尚未完成。");
      nativeValue(snapshot.native);
      if (key !== epoch.current) return;
      applyNative(snapshot.native, snapshot.threadId);
    } catch (e) {
      p.report(e);
    } finally {
      setBusy(false);
    }
  }
  async function importFile(f: File) {
    const key = epoch.current;
    setBusy(true);
    try {
      if (f.size > 1200000) throw new Error("文件最多1.2MB，请按阶段拆分。");
      const originalText = await f.text();
      const raw: unknown = JSON.parse(originalText);
      if (!isRecord(raw)) throw new Error("需要研究项目或原生会话JSON。");
      let data: Research,
        extra: Record<string, unknown> = {},
        title = f.name.replace(/\.json$/i, "");
      const snapshot = isRecord(raw.snapshot) ? raw.snapshot : raw;
      if (isRecord(snapshot.data) && typeof snapshot.data.native === "string") {
        data = restoreResearch(snapshot.data);
        extra = isRecord(snapshot.extra) ? snapshot.extra : {};
        title = typeof snapshot.title === "string" ? snapshot.title : title;
      } else {
        data = fromNative(
          originalText,
          typeof raw.thread_id === "string" ? raw.thread_id : "",
        );
        title = nativeValue(data.native).view.title;
      }
      if (key === epoch.current)
        await p.replace(data, title || "导入的研究", extra);
    } catch (e) {
      p.report(e);
    } finally {
      setBusy(false);
      if (file.current) file.current.value = "";
    }
  }
  const json =
    typeof p.draft.inputJson === "string"
      ? p.draft.inputJson
      : JSON.stringify(
          {
            title: p.title,
            data: p.data,
            extra: { ...p.draft, inputJson: undefined },
          },
          null,
          2,
        );
  async function applyJson() {
    try {
      const raw: unknown = JSON.parse(json);
      if (!isRecord(raw)) throw new Error("JSON应为对象。");
      const s = isRecord(raw.snapshot) ? raw.snapshot : raw;
      const data =
        isRecord(s.data) && typeof s.data.native === "string"
          ? restoreResearch(s.data)
          : fromNative(json);
      await p.replace(
        data,
        typeof s.title === "string" ? s.title : "导入的研究",
        isRecord(s.extra) ? s.extra : {},
      );
    } catch (e) {
      p.report(e);
    }
  }
  function deliver() {
    try {
      assertReady(p.data);
      p.setData((d) => ({ ...d, stage: "ready" }));
      p.setNotice("报告已标记为可交付。后续内容变更会回到复核状态。");
    } catch (e) {
      p.report(e);
    }
  }
  const evidence = (
    <section className="evidence-sheet">
      <div className="sheet-caption">
        <h2>来源复核</h2>
        <span>
          {checked} / {p.data.sources.length} 已核验
        </span>
        <button
          disabled={!mutable || p.data.sources.length >= 100}
          onClick={() =>
            change((d) => ({
              ...d,
              sources: [
                ...d.sources,
                {
                  id: crypto.randomUUID(),
                  url: "",
                  title: "新的来源",
                  excerpt: "",
                  note: "",
                  checked: false,
                  origin: "手动添加",
                },
              ],
            }))
          }
        >
          <Plus size={14} />
          添加
        </button>
      </div>
      {p.data.sources.map((s, index) => (
        <article className="source-row" key={s.id}>
          <div className="source-number">
            {String(index + 1).padStart(2, "0")}
          </div>
          <div className="source-content">
            <input
              aria-label={"来源名称 " + s.id}
              name="sourceTitle"
              autoComplete="off"
              value={s.title}
              disabled={!mutable}
              onChange={(e) => sourceChange(s.id, { title: e.target.value })}
            />
            <div className="source-url">
              <input
                aria-label={"来源网址 " + s.id}
                name="sourceUrl"
                autoComplete="off"
                type="url"
                value={s.url}
                disabled={!mutable}
                onChange={(e) => sourceChange(s.id, { url: e.target.value })}
              />
              {safeUrl(s.url) && (
                <a
                  href={safeUrl(s.url)}
                  target="_blank"
                  rel="noreferrer noopener"
                  aria-label={"打开来源 " + s.title}
                >
                  <Link2 size={14} />
                </a>
              )}
            </div>
            {s.excerpt && <blockquote>{s.excerpt}</blockquote>}
            <textarea
              aria-label={"核验备注 " + s.id}
              placeholder="记录支持结论的段落、限制或待确认事项…"
              value={s.note}
              disabled={!mutable}
              onChange={(e) => sourceChange(s.id, { note: e.target.value })}
            />
            <div className="source-status">
              <small>{s.origin}</small>
              <label>
                <input
                  type="checkbox"
                  aria-label={"已核验 " + s.id}
                  checked={s.checked}
                  disabled={!mutable || !safeUrl(s.url)}
                  onChange={(e) =>
                    sourceChange(s.id, { checked: e.target.checked })
                  }
                />
                已人工核验
              </label>
              <button
                disabled={!mutable}
                onClick={() => {
                  if (confirm("从交付清单移除这个来源？原始会话仍保留。"))
                    change((d) => ({
                      ...d,
                      sources: d.sources.filter((x) => x.id !== s.id),
                    }));
                }}
              >
                移除
              </button>
            </div>
          </div>
        </article>
      ))}
      {!p.data.sources.length && (
        <p className="empty">尚未找到来源链接，可手动添加并核验。</p>
      )}
    </section>
  );
  return (
    <div className="research-app">
      <a className="skip" href="#report">
        跳到研究报告
      </a>
      <header>
        <div className="brand">
          <BookOpen size={23} />
          <div>
            研究交付<small>DEERFLOW / RESEARCH ROOM</small>
          </div>
        </div>
        <input
          aria-label="项目名称"
          name="title"
          autoComplete="off"
          value={p.title}
          disabled={!mutable || busy}
          onChange={(e) => p.setTitle(e.target.value)}
        />
        <ProjectPicker
          items={p.items}
          id={p.current?.id}
          disabled={!mutable || busy}
          onOpen={(id) => void transition(() => p.open(id))}
        />
        <div className="header-actions">
          <button
            disabled={!mutable || busy}
            onClick={() => void transition(() => p.fresh())}
          >
            <Plus size={14} />
            新建
          </button>
          <button
            disabled={!mutable || busy}
            onClick={() => file.current?.click()}
          >
            <Upload size={14} />
            导入会话
          </button>
          <button onClick={p.exportDraft}>完整项目</button>
        </div>
        <input
          hidden
          ref={file}
          type="file"
          accept=".json"
          aria-label="导入研究文件"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void transition(() => importFile(f));
          }}
        />
      </header>
      <Notice error={p.error} notice={p.notice} />
      <div className="project-heading">
        <div>
          <span className="eyebrow">FROM RESEARCH TO DELIVERY</span>
          <h1>{native.title}</h1>
          <p>
            {native.sample
              ? "示例会话 · 用于熟悉复核流程"
              : "原生会话快照 · 保留研究来源与阶段记录"}
          </p>
        </div>
        <div className="delivery-actions">
          <span className={"stage-badge " + p.data.stage}>
            {p.data.stage === "ready"
              ? "可交付"
              : p.data.stage === "reviewing"
                ? "复核中"
                : "待整理"}
          </span>
          <button
            className="deliver"
            disabled={!mutable || busy}
            onClick={deliver}
          >
            <Check size={16} />
            完成复核
          </button>
          <button
            disabled={!p.data.report.trim()}
            onClick={() => {
              try {
                download(
                  new Blob([exportReport(p.data, p.title)], {
                    type: "text/markdown",
                  }),
                  p.title + ".md",
                );
              } catch (e) {
                p.report(e);
              }
            }}
          >
            <ArrowDownToLine size={16} />
            报告
          </button>
        </div>
      </div>
      <section className="task-strip" aria-label="原生研究阶段">
        {native.todos.map((t, i) => (
          <div key={i} className={t.status === "completed" ? "done" : ""}>
            <span>
              {t.status === "completed" ? (
                <Check size={13} />
              ) : (
                String(i + 1).padStart(2, "0")
              )}
            </span>
            <p>{t.content}</p>
            <small>
              {t.status === "completed"
                ? "已完成"
                : t.status === "in_progress"
                  ? "进行中"
                  : "待处理"}
            </small>
          </div>
        ))}
      </section>
      <nav className="view-tabs" aria-label="研究视图">
        {[
          ["research", "发起研究"],
          ["report", "交付稿"],
          ["evidence", "来源证据"],
          ["archive", "会话与产物"],
        ].map(([id, label]) => (
          <button key={id} aria-pressed={tab === id} onClick={() => setTab(id)}>
            {label}
          </button>
        ))}
        <span />
        <button onClick={() => setJsonOpen(!jsonOpen)}>JSON 草稿</button>
        <button
          onClick={() =>
            download(
              new Blob([p.data.native], { type: "application/json" }),
              "deerflow-native-state.json",
            )
          }
        >
          原生快照
        </button>
      </nav>
      <main id="report">
        {tab === "research" && (
          <ResearchRunner
            projectId={p.current?.id ?? null}
            documentKey={p.documentKey}
            brief={p.data.brief}
            model={
              typeof p.draft.researchModel === "string"
                ? p.draft.researchModel
                : DEFAULT_MODEL
            }
            mutable={mutable && !busy}
            configured={configured}
            onBrief={(brief) => change((d) => ({ ...d, brief }))}
            onModel={(researchModel) =>
              p.setDraft((d) => ({ ...d, researchModel }))
            }
            save={() => p.save()}
            onBusy={setBusy}
            onError={p.report}
            onCommand={(lastResearchId) =>
              p.setDraft((d) => ({ ...d, lastResearchId }))
            }
            onApply={(text, threadId) => {
              applyNative(text, threadId);
              setTab("report");
            }}
          />
        )}
        {tab === "report" && (
          <div className="report-layout">
            <section className="report-paper">
              <div className="paper-tools">
                <h2>人工交付稿</h2>
                <button disabled={!mutable || busy} onClick={adopt}>
                  采用最新答复
                  <ChevronRight size={14} />
                </button>
                <button
                  aria-pressed={editing}
                  onClick={() => setEditing(!editing)}
                >
                  {editing ? "预览排版" : "编辑正文"}
                </button>
              </div>
              {editing ? (
                <textarea
                  className="report-editor"
                  aria-label="报告正文"
                  name="report"
                  maxLength={150000}
                  value={p.data.report}
                  disabled={!mutable}
                  onChange={(e) =>
                    change((d) => ({ ...d, report: e.target.value }))
                  }
                  placeholder="采用会话答复，或从交付结论开始写作…"
                />
              ) : (
                <div className="markdown">
                  <Markdown
                    skipHtml
                    components={{
                      a: ({ href, children }) =>
                        safeUrl(href ?? "") ? (
                          <a
                            href={safeUrl(href ?? "")}
                            target="_blank"
                            rel="noreferrer noopener"
                          >
                            {children}
                          </a>
                        ) : (
                          <span>{children}</span>
                        ),
                      img: ({ alt }) => <span>［图片：{alt ?? "附件"}］</span>,
                    }}
                  >
                    {p.data.report || "尚未整理报告。"}
                  </Markdown>
                </div>
              )}
            </section>
            <aside className="brief-margin">
              <div>
                <span className="eyebrow">RESEARCH BRIEF</span>
                <h2>研究范围</h2>
                <textarea
                  aria-label="研究简报"
                  maxLength={30000}
                  value={p.data.brief}
                  disabled={!mutable}
                  onChange={(e) =>
                    change((d) => ({ ...d, brief: e.target.value }))
                  }
                />
              </div>
              <section>
                <h2>交付检查</h2>
                <p>
                  <Check size={14} />
                  报告正文：{p.data.report.trim() ? "已填写" : "待整理"}
                </p>
                <p>
                  <Link2 size={14} />
                  来源：{checked} / {p.data.sources.length} 已核验
                </p>
                <p>
                  <Folder size={14} />
                  原生产物：{native.artifacts.length} 项
                </p>
                <button onClick={() => setTab("evidence")}>
                  逐项复核来源
                  <ChevronRight size={14} />
                </button>
              </section>
            </aside>
          </div>
        )}
        {tab === "evidence" && evidence}
        {tab === "archive" && (
          <div className="archive-layout">
            <section className="native-messages">
              <div className="sheet-caption">
                <h2>原始会话</h2>
                <span>
                  {native.messages.filter((m) => !m.hidden).length} 条可见消息
                </span>
              </div>
              {native.messages
                .filter((m) => !m.hidden)
                .map((m, i) => (
                  <details
                    key={m.id + "-" + i}
                    open={i === native.messages.length - 1}
                  >
                    <summary>
                      <span>
                        {["human", "user"].includes(m.role)
                          ? "研究要求"
                          : m.role === "tool"
                            ? "工具返回"
                            : ["ai", "assistant"].includes(m.role)
                              ? "助手答复"
                              : m.role === "system"
                                ? "系统消息"
                                : "其他消息"}
                      </span>
                      <strong>
                        {m.name || m.text.slice(0, 70) || "结构化消息"}
                      </strong>
                    </summary>
                    <pre>{m.text}</pre>
                  </details>
                ))}
            </section>
            <aside className="sync-panel">
              <h2>上游会话</h2>
              <p className="service-status">{serviceMessage}</p>
              <label htmlFor="thread-id">会话编号</label>
              <input
                id="thread-id"
                aria-label="DeerFlow会话编号"
                name="threadId"
                autoComplete="off"
                value={p.data.threadId}
                disabled={!mutable || busy}
                onChange={(e) =>
                  p.setData((d) => ({ ...d, threadId: e.target.value }))
                }
              />
              <button
                disabled={!configured || !mutable || busy}
                onClick={() => void sync()}
              >
                <RefreshCw size={14} />
                同步已有会话
              </button>
              <div className="sync-ledger">
                {syncError && <p role="status">{syncError}</p>}
                {syncs.map((s) => (
                  <article key={s.id}>
                    <strong>{statuses[s.status] ?? s.status}</strong>
                    <small>{s.threadId}</small>
                    {s.error && <p>{s.error}</p>}
                    {s.status === "completed" && (
                      <button
                        disabled={!mutable || busy}
                        onClick={() => void applySnapshot(s.id)}
                      >
                        载入会话快照
                      </button>
                    )}
                  </article>
                ))}
              </div>
              <section className="artifacts">
                <h2>产物清单</h2>
                {native.artifacts.map((a, i) => (
                  <div key={a + "-" + i}>
                    <FileText size={15} />
                    <code>{a}</code>
                  </div>
                ))}
                <p>快照保留文件路径，原件请从DeerFlow导出。</p>
              </section>
            </aside>
          </div>
        )}
      </main>
      {jsonOpen && (
        <section className="json-panel">
          <label>
            未应用JSON
            <textarea
              aria-label="项目 JSON 草稿"
              value={json}
              disabled={!mutable || busy}
              onChange={(e) =>
                p.setDraft((d) => ({ ...d, inputJson: e.target.value }))
              }
            />
          </label>
          <button
            disabled={!mutable || busy}
            onClick={() => void transition(() => applyJson())}
          >
            作为新项目导入
          </button>
        </section>
      )}
      <footer>
        <span className={"save-state " + p.autoState.phase} role="status">
          {p.autoState.message}
        </span>
        {["offline", "draft", "conflict"].includes(p.autoState.phase) && (
          <>
            <button disabled={!mutable} onClick={() => void p.save()}>
              重试保存
            </button>
            <button onClick={p.exportDraft}>导出恢复稿</button>
            {p.current && (
              <button
                disabled={!mutable}
                onClick={() => void transition(() => p.open(p.current!.id))}
              >
                打开服务器版本
              </button>
            )}
          </>
        )}
        <span>原始会话、人工报告与草稿分别保留</span>
      </footer>
    </div>
  );
}
