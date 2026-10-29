import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Activity,
  BarChart3,
  BookOpen,
  ChevronDown,
  FileText,
  Play,
  Plus,
  Settings2,
  Wand2,
} from "lucide-react";
import {
  restoreProjectDraft,
  parseWorkingImport,
  serializeWorkingCopy,
  PORTABLE_FILE_BYTES,
  rawJsonl,
  reviewedJsonl,
  reviewCsv,
  runInput,
  serviceInput,
  importedDocuments,
  validateJob,
  pendingRunValue,
  textDocuments,
  manualRecord,
  removeRecord,
  realignDocument,
  finalClass,
  isStale,
  recordSpan,
  LIMITS,
  type EvidenceDocument,
  type EvidenceProject,
  type Job,
  type PendingRun,
  type Review,
  type ReviewStatus,
} from "../contracts/evidence";
import { alignExtraction } from "../contracts/align";
import { exampleWarnings } from "../contracts/prompting";
import { validateHostRun, type HostRun } from "../contracts/host-run";
import { blankProject, sampleProject, sampleTitle } from "../contracts/samples";
import { classColor, visualizationHtml } from "../contracts/visualize";
import { Notice, download, request } from "./workspace";
import { useEvidenceProjects } from "./evidence-state";
import { useRuns } from "./useRuns";
import { SourceText, type Selection } from "./SourcePaper";
import { RecordList, ReviewCard, statusName } from "./Ledger";
import { RecipeView } from "./RecipeView";
import { StatsView } from "./StatsView";
import { RunsView } from "./RunsView";
import { RunPanel, type Channel, type Scope } from "./RunPanel";
import { Popover } from "./Popover";

type Tab = "review" | "recipe" | "stats" | "runs";
const TABS: { id: Tab; name: string; icon: typeof FileText }[] = [
  { id: "review", name: "复核", icon: FileText },
  { id: "recipe", name: "类别与示例", icon: Settings2 },
  { id: "stats", name: "统计", icon: BarChart3 },
  { id: "runs", name: "任务", icon: Activity },
];
const initialTab = (): Tab => {
  const h = location.hash.slice(1);
  return h === "config" ? "recipe" : h === "jobs" ? "runs" : TABS.some((t) => t.id === h) ? (h as Tab) : "review";
};
const stringDraft = (v: unknown, fallback = "") => (typeof v === "string" ? v : fallback);
const filename = (title: string) => title.replace(/[\\/:*?"<>|]/g, "-").slice(0, 80) || "证据批次";
const nf = new Intl.NumberFormat("zh-CN");
const TEXT_FILE = /\.(txt|md|markdown|text|csv|log)$/i;

export function App() {
  const p = useEvidenceProjects();
  const report = useCallback((e: unknown) => p.report(e), [p.report]);
  const runs = useRuns(report);
  const [tab, setTab] = useState<Tab>(initialTab),
    [docIndex, setDocIndex] = useState(0),
    [recordIndex, setRecordIndex] = useState(0),
    [statusFilter, setStatusFilter] = useState("all"),
    [classFilter, setClassFilter] = useState("all"),
    [editing, setEditing] = useState(false),
    [selection, setSelection] = useState<Selection | null>(null),
    [sending, setSending] = useState(false),
    [confirmDelete, setConfirmDelete] = useState(false);
  const generation = useRef(0),
    paper = useRef<HTMLElement>(null),
    importDialog = useRef<HTMLDialogElement>(null),
    openInput = useRef<HTMLInputElement>(null),
    addInput = useRef<HTMLInputElement>(null);
  const di = Math.min(docIndex, p.data.documents.length - 1),
    doc = p.data.documents[di];
  const index = Math.min(recordIndex, Math.max(0, doc.extractions.length - 1)),
    hasRecord = !!doc.extractions[index],
    stale = isStale(doc);
  const palette = useMemo(() => {
    const map = new Map<string, string>();
    const color = (name: string) => {
      let c = map.get(name);
      if (!c) map.set(name, (c = classColor(p.data, name)));
      return c;
    };
    return color;
  }, [p.data]);
  const noHidden = useMemo(() => new Set<string>(), []);
  useEffect(() => {
    generation.current++;
    setDocIndex(0);
    setRecordIndex(0);
    setEditing(false);
    setStatusFilter("all");
    setClassFilter("all");
    setSelection(null);
  }, [p.documentKey]);
  useEffect(() => {
    history.replaceState(null, "", "#" + tab);
  }, [tab]);
  const rows = useMemo(
    () =>
      doc.extractions
        .map((_, i) => i)
        .filter(
          (i) =>
            (statusFilter === "all" ||
              (statusFilter === "unaligned" ? !recordSpan(doc, i) : doc.reviews[i].status === statusFilter)) &&
            (classFilter === "all" || finalClass(doc, i) === classFilter),
        ),
    [doc, statusFilter, classFilter],
  );
  const classes = useMemo(
    () => [...new Set([...p.data.fields.map((f) => f.name).filter(Boolean), ...p.data.documents.flatMap((d) => d.extractions.map((_, i) => finalClass(d, i)))])],
    [p.data],
  );
  const warnings = useMemo(() => exampleWarnings(p.data.examples), [p.data.examples]);
  const pending: PendingRun | null = useMemo(() => {
    try {
      return p.draft.pendingRun ? pendingRunValue(p.draft.pendingRun) : null;
    } catch {
      return null;
    }
  }, [p.draft.pendingRun]);

  const updateDoc = (change: (d: EvidenceDocument) => EvidenceDocument) =>
    p.setData((old) => ({
      ...old,
      documents: old.documents.map((d, i) => (i === Math.min(docIndex, old.documents.length - 1) ? change(d) : d)),
    }));
  const updateReview = (patch: Partial<Review>, at = index) =>
    updateDoc((d) => ({ ...d, reviews: d.reviews.map((r, i) => (i === at ? { ...r, ...patch } : r)) }));
  function selectRecord(i: number) {
    setRecordIndex(i);
    requestAnimationFrame(() => {
      paper.current?.querySelector("mark.current")?.scrollIntoView({ block: "nearest" });
      document.querySelector(`[data-record="${i}"]`)?.scrollIntoView({ block: "nearest" });
    });
  }
  function setStatus(status: ReviewStatus) {
    if (!hasRecord) return;
    const review = doc.reviews[index];
    if (stale && (status === "accepted" || status === "corrected")) {
      p.setError("原文已变更，请恢复原文后再确认。");
      return;
    }
    if (status === "corrected" && !review.correctedText.trim()) {
      p.setError("请先填写修订值。");
      return;
    }
    if (updateReview({ status })) {
      p.setError("");
      // Move to the next pending record after a decision, like a review queue.
      if (status !== "pending") {
        const next = rows.find((i) => i > index && doc.reviews[i].status === "pending");
        if (next !== undefined) selectRecord(next);
      }
    }
  }
  function annotate(cls: string) {
    if (!selection) return;
    try {
      const next = manualRecord(doc, cls, selection);
      if (updateDoc(() => next)) {
        const at = next.extractions.findIndex(
          (e, i) => next.reviews[i].source === "manual" && e.char_interval?.start_pos === selection.start && e.char_interval?.end_pos === selection.end && e.extraction_class === cls,
        );
        setStatusFilter("all");
        setClassFilter("all");
        setRecordIndex(Math.max(0, at));
        setSelection(null);
        window.getSelection()?.removeAllRanges();
        p.setNotice(`已标注为“${cls}”。`);
      }
    } catch (e) {
      p.report(e);
    }
  }
  function anchorToSelection() {
    if (!selection || !hasRecord) return;
    if (updateReview({ span: { start: selection.start, end: selection.end } })) {
      setSelection(null);
      window.getSelection()?.removeAllRanges();
      p.setNotice("记录已定位到选区。");
    }
  }
  function findInSource() {
    const hit = alignExtraction(doc.originalText, doc.extractions[index].extraction_text);
    if (!hit) return p.setError("原文中找不到相近片段。请在原文中选中对应文字后点“定位到选区”。");
    if (updateReview({ span: { start: hit.start, end: hit.end } }))
      p.setNotice(hit.status === "match_exact" ? "已在原文中精确找到。" : `已模糊对齐（相似度 ${Math.round(hit.ratio * 100)}%），请核对。`);
  }
  function realignAll() {
    const { doc: next, aligned } = realignDocument(doc);
    if (!aligned) return p.setNotice("没有可自动对齐的未定位记录。");
    if (updateDoc(() => next)) p.setNotice(`已对齐 ${aligned} 条未定位记录，请逐条核对。`);
  }

  // Keyboard review: j/k move, a accept, x reject.
  const keys = useRef<(e: KeyboardEvent) => void>(() => {});
  keys.current = (e) => {
    if (tab !== "review" || e.metaKey || e.ctrlKey || e.altKey) return;
    const t = e.target as HTMLElement;
    if (t.closest("input, textarea, select, [contenteditable], dialog, .popover-panel")) return;
    const pos = rows.indexOf(index);
    if (e.key === "j" && rows.length) selectRecord(rows[Math.min(rows.length - 1, pos + 1)]);
    else if (e.key === "k" && rows.length) selectRecord(rows[Math.max(0, pos - 1)]);
    else if (e.key === "a") setStatus("accepted");
    else if (e.key === "x") setStatus("rejected");
    else return;
    e.preventDefault();
  };
  useEffect(() => {
    const on = (e: KeyboardEvent) => keys.current(e);
    document.addEventListener("keydown", on);
    return () => document.removeEventListener("keydown", on);
  }, []);

  async function importText(raw: string, name = "导入资料") {
    try {
      const copy = parseWorkingImport(raw, name.replace(/\.[^.]+$/, "").slice(0, 120) || "导入资料");
      if (await p.replace(copy.data, copy.title, copy.extra)) {
        setTab("review");
        p.setNotice("已导入为新批次，原批次保留在档案中。");
        return true;
      }
    } catch (e) {
      p.report(e);
    }
    return false;
  }
  async function openFiles(files: FileList | null) {
    const file = files?.[0];
    if (!file) return;
    try {
      if (file.size > PORTABLE_FILE_BYTES) throw Error("文件超过8MB，请拆分后导入。");
      if (TEXT_FILE.test(file.name)) {
        const docs = textDocuments([{ name: file.name, text: await file.text() }]);
        await p.replace({ ...blankProject(), origin: "manual", documents: docs }, file.name.replace(/\.[^.]+$/, "").slice(0, 120));
        setTab("review");
        return;
      }
      await importText(await file.text(), file.name);
    } catch (e) {
      p.report(e);
    }
  }
  async function addFiles(files: FileList | null) {
    if (!files?.length) return;
    try {
      const list = [...files];
      if (p.data.documents.length + list.length > LIMITS.documents) throw Error(`一个批次最多${LIMITS.documents}份资料，请新建批次。`);
      const texts = await Promise.all(list.map(async (f) => ({ name: f.name, text: await f.text() })));
      const ids = p.data.documents.map((d) => d.id);
      const added = textDocuments(texts, ids);
      const blankOnly = p.data.documents.length === 1 && !doc.text && !doc.extractions.length;
      if (
        p.setData((old) => ({
          ...old,
          documents: blankOnly ? added : [...old.documents, ...added],
        }))
      ) {
        setDocIndex(blankOnly ? 0 : p.data.documents.length);
        setRecordIndex(0);
        setTab("review");
        p.setNotice(`已添加 ${added.length} 份资料。`);
      }
    } catch (e) {
      p.report(e);
    }
  }
  function addBlankDoc() {
    try {
      if (p.data.documents.length >= LIMITS.documents) throw Error(`一个批次最多${LIMITS.documents}份资料。`);
      const [d] = textDocuments([{ name: `资料-${String(p.data.documents.length + 1).padStart(2, "0")}`, text: "" }], p.data.documents.map((x) => x.id));
      if (p.setData((old) => ({ ...old, documents: [...old.documents, d] }))) {
        setDocIndex(p.data.documents.length);
        setEditing(true);
        setTab("review");
      }
    } catch (e) {
      p.report(e);
    }
  }
  function removeDoc() {
    if (p.data.documents.length <= 1) return p.setError("批次至少保留一份资料。");
    if (p.setData((old) => ({ ...old, documents: old.documents.filter((_, i) => i !== di) }))) {
      setDocIndex(Math.max(0, di - 1));
      p.setNotice("已从批次移除该资料。");
    }
  }
  function renameDoc(name: string) {
    const id = name.slice(0, 120);
    if (!id.trim()) return p.setError("资料名称不能为空。");
    if (p.data.documents.some((d, i) => i !== di && d.id === id)) return p.setError("批次中已有同名资料。");
    p.setError("");
    updateDoc((d) => ({ ...d, id }));
  }
  function editText(value: string) {
    // A document without records has nothing to invalidate: its original follows the edit.
    updateDoc((d) => (d.extractions.length ? { ...d, text: value } : { ...d, text: value, originalText: value }));
  }

  async function startRun(channel: Channel, scope: Scope, retry?: PendingRun) {
    if (sending) return;
    setSending(true);
    const epoch = generation.current;
    try {
      let run: PendingRun;
      if (retry) run = retry;
      else {
        const docs = (scope === "batch" ? p.data.documents : [doc]).filter((d) => d.text.trim());
        if (!docs.length) throw Error("没有可抽取的原文。先在资料中填写或添加文本文件。");
        const input = runInput({
          documents: docs.map((d) => ({ id: d.id, text: d.text })),
          fields: p.data.fields.filter((f) => f.name.trim()),
          prompt: p.data.prompt,
          examples: p.data.examples,
        });
        run = { id: crypto.randomUUID(), channel, model: p.data.model, input: channel === "service" ? serviceInput(input) : input };
      }
      if (!p.setDraft((old) => ({ ...old, pendingRun: run }))) return;
      const saved = await p.save();
      if (!saved) throw Error("请先解决保存问题或版本冲突，再提交抽取。");
      const body = JSON.stringify({ id: run.id, projectId: saved.id, model: run.model, input: run.input });
      let label: string;
      if (run.channel === "host") {
        const r = validateHostRun(await request("/api/host-runs", { method: "POST", body }));
        runs.putHostRun(r);
        label = `已开始用 ${r.model} 抽取 ${r.input.documents.length} 份资料（共 ${r.progress.total} 段）。`;
      } else {
        const j = validateJob(await request("/api/jobs", { method: "POST", body }));
        runs.putJob(j);
        label = "任务已提交到 Python 服务。";
      }
      if (epoch === generation.current) {
        p.setDraft((old) => {
          const next = { ...old };
          delete next.pendingRun;
          return next;
        });
        setTab("runs");
        p.setNotice(label + " 结果将另开为新批次，不覆盖当前修订。");
      }
    } catch (e) {
      if (epoch === generation.current) p.report(e);
    } finally {
      setSending(false);
    }
  }
  async function openResult(result: unknown[], input: { prompt: string; fields: EvidenceProject["fields"]; examples: EvidenceProject["examples"] }, origin: "host" | "service", label: string, model = p.data.model) {
    try {
      const data = importedDocuments(result, origin);
      data.prompt = input.prompt;
      data.fields = input.fields;
      data.examples = input.examples;
      data.model = model;
      if (await p.replace(data, label.slice(0, 120))) {
        setTab("review");
        p.setNotice("已另开结果批次，所有记录待复核。");
      }
    } catch (e) {
      p.report(e);
    }
  }
  async function cancelJob(job: Job) {
    if (!confirm("停止接收这个任务的结果？已发出的模型请求可能仍在运行。")) return;
    try {
      runs.putJob(validateJob(await request("/api/jobs/" + job.id + "/cancel", { method: "POST", body: "{}" })));
    } catch (e) {
      p.report(e);
    }
  }
  function exportFile(kind: "reviewed" | "raw" | "csv" | "html" | "project") {
    try {
      const data = restoreProjectDraft(p.data);
      const out = {
        reviewed: [reviewedJsonl(data), "application/x-ndjson", ".reviewed.jsonl"],
        raw: [rawJsonl(data), "application/x-ndjson", ".original.jsonl"],
        csv: [reviewCsv(data), "text/csv;charset=utf-8", ".review.csv"],
        html: [visualizationHtml(data, p.title), "text/html;charset=utf-8", ".review.html"],
        project: [serializeWorkingCopy({ title: p.title, data, extra: p.draft }), "application/json", ".evidence.json"],
      }[kind];
      download(new Blob([out[0]], { type: out[1] }), filename(p.title) + out[2]);
    } catch (e) {
      p.report(e);
    }
  }

  const reviewed = doc.reviews.filter((r) => r.status !== "pending").length;
  const batchRecords = p.data.documents.reduce((n, d) => n + d.extractions.length, 0),
    batchReviewed = p.data.documents.reduce((n, d) => n + d.reviews.filter((r) => r.status !== "pending").length, 0),
    batchChars = p.data.documents.reduce((n, d) => n + Array.from(d.text).length, 0);
  const channelReady = runs.host.available || runs.service.available;
  const showSave = ["draft", "offline", "conflict"].includes(p.autoState.phase);

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
      <header className="desk-bar">
        <div className="brand" translate="no">
          <BookOpen size={20} aria-hidden="true" />
          <span>证据书桌</span>
        </div>
        <Popover
          role="menu"
          className="file-menu"
          buttonClass="menu-button"
          label={
            <>
              档案 <ChevronDown size={14} aria-hidden="true" />
            </>
          }
        >
          {(close) => (
            <div className="menu" onClick={(e) => (e.target as HTMLElement).closest("[role=menuitem]") && close()}>
              <p className="menu-label">批次</p>
              <button role="menuitem" disabled={p.busy} onClick={() => void p.replace(blankProject(), "未命名批次").then((ok) => ok && setEditing(true))}>
                新建空白批次
              </button>
              <button role="menuitem" disabled={p.busy} onClick={() => void p.replace(sampleProject(), sampleTitle)}>
                打开示例批次（5 份采购资料）
              </button>
              <button role="menuitem" onClick={() => openInput.current?.click()}>
                打开文件…<small>LangExtract JSONL · 工作稿 · 文本</small>
              </button>
              <button role="menuitem" onClick={() => importDialog.current?.showModal()}>
                粘贴 JSONL 导入…
              </button>
              <button role="menuitem" onClick={() => addInput.current?.click()}>
                添加文本到本批次…<small>.txt / .md，可多选</small>
              </button>
              <p className="menu-label">导出</p>
              <button role="menuitem" onClick={() => exportFile("reviewed")}>
                审定结果 JSONL<small>已接受与修订，LangExtract 格式</small>
              </button>
              <button role="menuitem" onClick={() => exportFile("html")}>
                可视化审校页 HTML
              </button>
              <button role="menuitem" onClick={() => exportFile("csv")}>
                审校表 CSV
              </button>
              <button role="menuitem" onClick={() => exportFile("raw")}>
                原始抽取 JSONL<small>模型原样输出，不含人工标注</small>
              </button>
              <button role="menuitem" onClick={() => exportFile("project")}>
                完整工作稿 JSON<small>含修订与未应用草稿</small>
              </button>
              {p.items.length > 0 && (
                <>
                  <p className="menu-label">最近批次</p>
                  <div className="recent">
                    {p.items.slice(0, 14).map((item) => (
                      <button
                        role="menuitem"
                        key={item.id}
                        disabled={p.busy}
                        aria-current={item.id === p.current?.id ? "true" : undefined}
                        onClick={() => void p.open(item.id)}
                      >
                        {item.title}
                        <small>{item.id.startsWith("local:") ? "本机未同步" : new Intl.DateTimeFormat("zh-CN", { dateStyle: "short", timeStyle: "short" }).format(new Date(item.updatedAt))}</small>
                      </button>
                    ))}
                  </div>
                </>
              )}
              {p.current && (
                <>
                  <p className="menu-label">危险操作</p>
                  {confirmDelete ? (
                    <button
                      role="menuitem"
                      className="danger"
                      onClick={() => {
                        setConfirmDelete(false);
                        void p.remove().then((ok) => ok && p.setNotice("批次已删除。"));
                      }}
                    >
                      确认删除“{p.title}”
                    </button>
                  ) : (
                    <button className="danger" onClick={() => setConfirmDelete(true)}>
                      删除此批次…
                    </button>
                  )}
                </>
              )}
            </div>
          )}
        </Popover>
        <input
          type="file"
          ref={openInput}
          hidden
          accept=".jsonl,.ndjson,.json,.txt,.md,.markdown"
          aria-label="打开 JSONL、工作稿或文本文件"
          onChange={(e) => {
            void openFiles(e.target.files);
            e.target.value = "";
          }}
        />
        <input
          type="file"
          ref={addInput}
          hidden
          multiple
          accept=".txt,.md,.markdown,.text,.log,.csv"
          aria-label="添加文本资料"
          onChange={(e) => {
            void addFiles(e.target.files);
            e.target.value = "";
          }}
        />
        <label className="title-field">
          <span className="sr-only">批次名称</span>
          <input aria-label="批次名称" name="project-title" autoComplete="off" value={p.title} maxLength={120} onChange={(e) => p.setTitle(e.target.value)} />
        </label>
        <span className={"save-state " + p.autoState.phase} role="status">
          {p.autoState.message}
        </span>
        {showSave && (
          <button className="text-button" onClick={() => void p.save()}>
            立即保存
          </button>
        )}
        <div className="bar-spacer" />
        <span className={"channel-chip " + (runs.host.available ? "ok" : runs.service.available ? "ok" : "off")} title={runs.host.message}>
          <span className="dot" aria-hidden="true" />
          {runs.host.available ? "Floatboat 模型" : runs.service.available ? "Python 服务" : "离线 · 手工标注"}
        </span>
        <Popover
          align="end"
          className="run-popover"
          buttonClass="primary run-button"
          label={
            <>
              <Play size={15} aria-hidden="true" />
              抽取
              {pending ? " · 待确认" : ""}
            </>
          }
        >
          {(close) => (
            <RunPanel
              host={runs.host}
              service={runs.service}
              model={p.data.model}
              setModel={(v) => p.setData((old) => ({ ...old, model: v.trim() ? v.trim().slice(0, 120) : old.model }))}
              docCount={p.data.documents.filter((d) => d.text.trim()).length}
              currentDoc={doc.id}
              currentEmpty={!doc.text.trim()}
              batchChars={batchChars}
              warnings={warnings}
              pending={pending}
              sending={sending}
              onStart={(c, s) => {
                close();
                void startRun(c, s);
              }}
              onRetry={() => {
                if (pending) {
                  close();
                  void startRun(pending.channel, "batch", pending);
                }
              }}
              onDiscard={() =>
                p.setDraft((old) => {
                  const next = { ...old };
                  delete next.pendingRun;
                  return next;
                })
              }
              onCheck={() => {
                void runs.checkHost();
                void runs.checkService();
              }}
            />
          )}
        </Popover>
      </header>
      <nav className="section-nav" aria-label="工作区域">
        {TABS.map((t) => (
          <button key={t.id} aria-pressed={tab === t.id} onClick={() => setTab(t.id)}>
            <t.icon size={16} aria-hidden="true" />
            {t.name}
            {t.id === "runs" && runs.activeCount > 0 && <span className="count">{runs.activeCount}</span>}
          </button>
        ))}
        <span className="batch-summary">
          {p.data.documents.length} 份资料 · 已复核 {batchReviewed}/{batchRecords}
        </span>
      </nav>
      <Notice error={p.error} notice={p.notice} />
      {p.autoState.phase === "conflict" && (
        <div className="recovery">
          <button onClick={() => exportFile("project")}>导出本机草稿</button>
          {p.current && <button onClick={() => void p.open(p.current!.id)}>打开服务器版本</button>}
        </div>
      )}
      <dialog ref={importDialog} className="import-dialog" aria-label="粘贴导入">
        <form
          method="dialog"
          onSubmit={(e) => {
            e.preventDefault();
            void importText(stringDraft(p.draft.importText), p.title + " · 导入").then((ok) => {
              if (ok) importDialog.current?.close();
            });
          }}
        >
          <h2>粘贴 LangExtract JSONL</h2>
          <p>每行一份 AnnotatedDocument（document_id、text、extractions），或 JSON 数组、完整工作稿。导入会新建批次，原批次保留。</p>
          <label>
            待导入内容
            <textarea
              aria-label="待导入 JSONL"
              name="import-jsonl"
              spellCheck={false}
              autoComplete="off"
              value={stringDraft(p.draft.importText)}
              onChange={(e) => p.setDraft((old) => ({ ...old, importText: e.target.value }))}
              placeholder='{"document_id":"资料-01","text":"…","extractions":[]}'
            />
          </label>
          <div className="row">
            <button type="submit" className="primary" disabled={p.busy}>
              导入为新批次
            </button>
            <button type="button" onClick={() => importDialog.current?.close()}>
              取消
            </button>
          </div>
        </form>
      </dialog>
      <main id="evidence-main">
        {tab === "review" ? (
          <>
            <div className="document-strip">
              <div className="doc-tabs" role="list" aria-label="批次中的资料">
                {p.data.documents.map((d, i) => {
                  const done = d.reviews.filter((r) => r.status !== "pending").length;
                  return (
                    <button
                      role="listitem"
                      key={d.id + i}
                      aria-current={i === di ? "true" : undefined}
                      onClick={() => {
                        setDocIndex(i);
                        setRecordIndex(0);
                        setEditing(false);
                        setSelection(null);
                      }}
                    >
                      <span className="doc-name">{d.id}</span>
                      <span className="doc-progress">
                        {isStale(d) ? "原文已改" : d.extractions.length ? `${done}/${d.extractions.length}` : "无记录"}
                      </span>
                    </button>
                  );
                })}
              </div>
              <Popover
                role="menu"
                className="add-doc"
                buttonClass="text-button"
                align="end"
                label={
                  <>
                    <Plus size={15} aria-hidden="true" />
                    资料
                  </>
                }
              >
                {(close) => (
                  <div className="menu" onClick={(e) => (e.target as HTMLElement).closest("[role=menuitem]") && close()}>
                    <button role="menuitem" onClick={addBlankDoc}>
                      空白资料（粘贴原文）
                    </button>
                    <button role="menuitem" onClick={() => addInput.current?.click()}>
                      从文本文件添加…
                    </button>
                  </div>
                )}
              </Popover>
            </div>
            <div className="review-desk">
              <section className="source-pane" aria-label="原文与证据">
                <div className="paper-controls">
                  <span className="origin-tag">
                    {p.data.origin === "example"
                      ? "示例资料 · 人工编制，非模型输出"
                      : p.data.origin === "host"
                        ? "Floatboat 模型结果 · 待复核"
                        : p.data.origin === "service"
                          ? "LangExtract 服务结果 · 待复核"
                          : p.data.origin === "import"
                            ? "导入的 LangExtract 结果"
                            : "手工资料"}
                  </span>
                  <div className="row">
                    {!stale && doc.extractions.some((_, i) => !recordSpan(doc, i)) && (
                      <button className="text-button" onClick={realignAll}>
                        <Wand2 size={14} aria-hidden="true" />
                        对齐未定位记录
                      </button>
                    )}
                    <button className="text-button" onClick={() => setEditing((v) => !v)}>
                      {editing ? "返回阅读" : "编辑原文"}
                    </button>
                  </div>
                </div>
                {stale && (
                  <div className="source-warning" role="status">
                    原文已修改，旧证据区间暂停使用，接受与修订已禁用。
                    <button
                      onClick={() => {
                        if (confirm("恢复抽取时的原文？当前原文修改将被替换。")) updateDoc((d) => ({ ...d, text: d.originalText }));
                      }}
                    >
                      恢复抽取时原文
                    </button>
                  </div>
                )}
                {selection && !editing && !stale && (
                  <div className="annotate-bar" role="toolbar" aria-label="标注选中文字">
                    <span className="picked">
                      已选「{selection.quote.length > 24 ? selection.quote.slice(0, 24) + "…" : selection.quote}」{selection.start}–{selection.end}
                    </span>
                    <span className="label">标注为</span>
                    {classes.map((c) => (
                      <button key={c} className="chip" onClick={() => annotate(c)}>
                        <span className="swatch" style={{ background: palette(c) }} aria-hidden="true" />
                        {c}
                      </button>
                    ))}
                    <button className="text-button" onClick={() => setSelection(null)}>
                      取消
                    </button>
                  </div>
                )}
                <article className="paper" ref={paper}>
                  <div className="paper-heading">
                    <p className="eyebrow">
                      资料 {String(di + 1).padStart(2, "0")} / {String(p.data.documents.length).padStart(2, "0")}
                    </p>
                    <input
                      className="doc-title"
                      aria-label="资料名称"
                      value={doc.id}
                      maxLength={120}
                      onChange={(e) => renameDoc(e.target.value)}
                    />
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
                        maxLength={LIMITS.documentChars}
                        value={doc.text}
                        placeholder="粘贴合同、纪要、访谈或邮件原文…"
                        onChange={(e) => editText(e.target.value)}
                      />
                    </label>
                  ) : !doc.text ? (
                    <div className="source-copy empty-paper">
                      <p>这份资料还没有原文。</p>
                      <div className="row">
                        <button onClick={() => setEditing(true)}>粘贴原文</button>
                        <button onClick={() => addInput.current?.click()}>添加文本文件</button>
                        <button onClick={() => openInput.current?.click()}>打开 LangExtract JSONL</button>
                      </div>
                    </div>
                  ) : (
                    <SourceText
                      doc={doc}
                      selected={hasRecord ? index : -1}
                      colorOf={palette}
                      hiddenClasses={noHidden}
                      onPick={(i) => selectRecord(i)}
                      onSelect={setSelection}
                    />
                  )}
                  <footer className="paper-footer">
                    <span>{nf.format(Array.from(doc.text).length)} 字符</span>
                    <span>
                      {stale
                        ? "原文已变更"
                        : hasRecord && recordSpan(doc, index)
                          ? `证据区间 ${recordSpan(doc, index)!.start}–${recordSpan(doc, index)!.end}`
                          : "选中文字即可标注"}
                    </span>
                  </footer>
                </article>
                <details className="paper-more">
                  <summary>资料操作</summary>
                  <div className="row">
                    <button className="text-button danger" disabled={p.data.documents.length <= 1} onClick={removeDoc}>
                      从批次移除此资料
                    </button>
                  </div>
                </details>
              </section>
              <section className="ledger" aria-label="抽取记录账本">
                <header className="ledger-heading">
                  <div>
                    <span className="eyebrow">EXTRACTION LEDGER</span>
                    <h2>
                      逐条复核{" "}
                      <span>
                        {reviewed} / {doc.extractions.length}
                      </span>
                    </h2>
                  </div>
                  <div className="filters">
                    <label>
                      <span className="sr-only">筛选复核状态</span>
                      <select aria-label="筛选复核状态" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                        <option value="all">全部状态</option>
                        {Object.entries(statusName).map(([key, name]) => (
                          <option key={key} value={key}>
                            {name}
                          </option>
                        ))}
                        <option value="unaligned">未定位</option>
                      </select>
                    </label>
                    <label>
                      <span className="sr-only">筛选类别</span>
                      <select aria-label="筛选类别" value={classFilter} onChange={(e) => setClassFilter(e.target.value)}>
                        <option value="all">全部类别</option>
                        {classes.map((c) => (
                          <option key={c} value={c}>
                            {c}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                </header>
                <RecordList doc={doc} rows={rows} selected={hasRecord ? index : -1} colorOf={palette} onSelect={selectRecord} />
                {hasRecord && (
                  <ReviewCard
                    doc={doc}
                    index={index}
                    fields={p.data.fields}
                    selection={selection}
                    colorOf={palette}
                    onReview={(patch) => updateReview(patch)}
                    onStatus={setStatus}
                    onAnchor={anchorToSelection}
                    onFind={findInSource}
                    onRemove={() => {
                      try {
                        if (updateDoc((d) => removeRecord(d, index))) p.setNotice("已删除人工标注。");
                      } catch (e) {
                        p.report(e);
                      }
                    }}
                  />
                )}
                <p className="hint keys">快捷键：J / K 上下条，A 接受，X 驳回。</p>
              </section>
            </div>
          </>
        ) : tab === "recipe" ? (
          <RecipeView
            data={p.data}
            docText={doc.text}
            colorOf={palette}
            setData={(fn) => p.setData(fn)}
            examplesDraft={typeof p.draft.examplesEditor === "string" ? p.draft.examplesEditor : null}
            setExamplesDraft={(v) =>
              p.setDraft((old) => {
                const next = { ...old };
                if (v === null) delete next.examplesEditor;
                else next.examplesEditor = v;
                return next;
              })
            }
            report={p.report}
            notice={(m) => {
              p.setError("");
              p.setNotice(m);
            }}
          />
        ) : tab === "stats" ? (
          <StatsView
            data={p.data}
            colorOf={palette}
            openClass={(c) => {
              setTab("review");
              setStatusFilter("all");
              setClassFilter(c);
              const first = p.data.documents.findIndex((d) => d.extractions.some((_, i) => finalClass(d, i) === c));
              if (first >= 0) {
                setDocIndex(first);
                setRecordIndex(p.data.documents[first].extractions.findIndex((_, i) => finalClass(p.data.documents[first], i) === c));
              }
            }}
            openDoc={(i) => {
              setTab("review");
              setDocIndex(i);
              setRecordIndex(0);
            }}
          />
        ) : (
          <RunsView
            hostRuns={runs.hostRuns}
            jobs={runs.jobs}
            onRefresh={() => {
              void runs.refreshRuns();
              void runs.checkHost();
              void runs.checkService();
            }}
            onOpenHost={(r: HostRun) => r.result && void openResult(r.result, r.input, "host", `模型结果 · ${p.title}`.slice(0, 120), r.model)}
            onOpenJob={(j: Job) => j.result && void openResult(j.result, j.input, "service", `服务结果 · ${j.id.slice(0, 8)}`)}
            onQueryJob={(j) =>
              void request("/api/jobs/" + j.id)
                .then(validateJob)
                .then(runs.putJob)
                .catch(p.report)
            }
            onCancelJob={(j) => void cancelJob(j)}
          />
        )}
      </main>
      <footer className="desk-footer">
        <span>{channelReady ? "模型输出、人工修订分层保存" : "无模型通道：可手工标注、导入 JSONL、复核与导出"}</span>
        <span>原始 JSONL 保留模型原样输出；审定 JSONL、CSV 与 HTML 使用复核结果。</span>
      </footer>
    </div>
  );
}
