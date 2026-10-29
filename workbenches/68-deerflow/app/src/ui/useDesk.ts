// ABOUTME: 研究台的业务状态：计划编辑与确认、逐步检索、来源与引用、报告底稿、模型建议、文件导入导出。
import { useEffect, useRef, useState } from "react";
import { useProjects, request, download } from "./workspace";
import {
  researchValue,
  restoreResearch,
  emptyResearch,
  fromNative,
  mergeNativeSources,
  citationsIn,
  nextCite,
  nativeValue,
  assertReady,
  type Research,
  type Source,
  type Step,
  type StepKind,
} from "../contracts/research";
import { compactNative, lastReport } from "../contracts/native";
import { definitionChanged, newStep, planFromModel, planProblems, templatePlan } from "../contracts/plan";
import { compileReport, exportMarkdown, reportMaterial } from "../contracts/report";
import { failureText, mergeStepResults, requestForStep, retrieveResultValue } from "../contracts/retrieval";
import { sampleResearch, SAMPLE_TITLE } from "../contracts/sample";
import { isRecord } from "../contracts/project";

export type Stage = "plan" | "execute" | "report";
export type HostState = { llm: string; message: string; checking: boolean };
type PlanDraft = { steps: Step[]; model: string; at: string };
type ReportDraft = { text: string; model: string; at: string; unknown: number[] };

const fileName = (title: string, ext: string) => (title.trim() || "研究报告").replace(/[\\/:*?"<>|]+/g, "-").slice(0, 80) + ext;
function planDraftOf(v: unknown): PlanDraft | null {
  if (!isRecord(v) || typeof v.model !== "string" || typeof v.at !== "string") return null;
  try {
    return { steps: planFromModel(v), model: v.model, at: v.at };
  } catch {
    return null;
  }
}
function reportDraftOf(v: unknown): ReportDraft | null {
  if (!isRecord(v) || typeof v.text !== "string" || typeof v.model !== "string") return null;
  return {
    text: v.text.slice(0, 200000),
    model: v.model,
    at: typeof v.at === "string" ? v.at : "",
    unknown: Array.isArray(v.unknown) ? v.unknown.filter((n): n is number => typeof n === "number") : [],
  };
}
function initialStage(d: Research): Stage {
  if (!d.plan.confirmed) return "plan";
  if (d.report.trim()) return "report";
  return "execute";
}

export function useDesk() {
  const p = useProjects(sampleResearch, researchValue, SAMPLE_TITLE, { storageKey: "deerflow-review-v1", restoreDraftData: restoreResearch });
  const [stage, setStage] = useState<Stage>(() => initialStage(p.data));
  const [transitioning, setTransitioning] = useState(false);
  const [running, setRunning] = useState<string | null>(null);
  const [host, setHost] = useState<HostState>({ llm: "unknown", message: "尚未检查 Floatboat 模型。", checking: false });
  const [hostBusy, setHostBusy] = useState<"" | "plan" | "report">("");
  const [focusCite, setFocusCite] = useState<{ n: number; at: number } | null>(null);
  const [lastRuns, setLastRuns] = useState<Record<string, string[]>>({});
  const lock = useRef(false),
    abort = useRef<AbortController | null>(null),
    epoch = useRef(p.documentKey),
    dataRef = useRef(p.data);
  epoch.current = p.documentKey;
  dataRef.current = p.data;
  const mutable = !p.loading && !p.busy && !transitioning;

  // A document transition: pick the natural stage and repair steps interrupted by a reload.
  useEffect(() => {
    abort.current?.abort();
    setRunning(null);
    setLastRuns({});
    setStage(initialStage(dataRef.current));
    if (dataRef.current.plan.steps.some((s) => s.status === "running"))
      p.setData((d) => ({
        ...d,
        plan: { ...d.plan, steps: d.plan.steps.map((s) => (s.status === "running" ? { ...s, status: "failed", error: "上次执行被中断，可重新执行本步。" } : s)) },
      }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [p.documentKey]);

  async function transition(action: () => Promise<unknown>) {
    if (lock.current) return false;
    lock.current = true;
    setTransitioning(true);
    try {
      return Boolean(await action());
    } catch (e) {
      p.report(e);
      return false;
    } finally {
      lock.current = false;
      setTransitioning(false);
    }
  }
  /** Content edits move a delivered report back to review. */
  function change(fn: (d: Research) => Research) {
    p.setData((d) => {
      const next = fn(d);
      return { ...next, stage: d.stage === "ready" && next.stage === "ready" ? "reviewing" : next.stage };
    });
  }

  // ── Plan ───────────────────────────────────────────────────────────────
  function editPlan(fn: (steps: Step[]) => Step[], reconfirm = true) {
    change((d) => ({ ...d, plan: { ...d.plan, steps: fn(d.plan.steps), confirmed: reconfirm ? false : d.plan.confirmed } }));
  }
  function updateStep(id: string, patch: Partial<Step>) {
    change((d) => {
      const steps = d.plan.steps.map((s) => (s.id === id ? { ...s, ...patch } : s));
      const before = d.plan.steps.find((s) => s.id === id),
        after = steps.find((s) => s.id === id);
      const redefine = Boolean(before && after && definitionChanged(before, after));
      return { ...d, plan: { ...d.plan, steps, confirmed: d.plan.confirmed && !redefine } };
    });
  }
  const addStep = (kind: StepKind) => editPlan((steps) => (steps.length >= 12 ? steps : [...steps, newStep(kind)]));
  const removeStep = (id: string) => editPlan((steps) => steps.filter((s) => s.id !== id));
  const moveStep = (id: string, delta: number) =>
    editPlan((steps) => {
      const i = steps.findIndex((s) => s.id === id),
        j = i + delta;
      if (i < 0 || j < 0 || j >= steps.length) return steps;
      const next = [...steps];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  function applyTemplate() {
    const d = dataRef.current;
    if (d.plan.steps.length && !confirm("用模板计划替换当前步骤？已收集的来源会保留。")) return;
    change((x) => ({ ...x, plan: { steps: templatePlan(x.question, x.scope), confirmed: false, confirmedAt: "", origin: "template" } }));
    p.setNotice("已按模板生成计划。请逐步修改检索词与网址，然后确认计划。");
  }
  function confirmPlan() {
    const problems = planProblems(dataRef.current.plan.steps);
    if (!dataRef.current.question.trim()) problems.unshift("请先写下研究问题。");
    if (problems.length) {
      p.setError(problems.slice(0, 3).join(" "));
      return;
    }
    change((d) => ({ ...d, plan: { ...d.plan, confirmed: true, confirmedAt: new Date().toISOString() } }));
    if (["新研究", ""].includes(p.title.trim())) p.setTitle(dataRef.current.question.trim().replace(/[？?。]+$/, "").slice(0, 60));
    p.setNotice("计划已确认。可以逐步执行检索，或交给 DeerFlow。");
    setStage("execute");
  }

  // ── Host model (optional) ──────────────────────────────────────────────
  async function checkHost() {
    setHost((h) => ({ ...h, checking: true }));
    try {
      const v = await request("/api/host/status");
      if (isRecord(v) && typeof v.llm === "string") setHost({ llm: v.llm, message: String(v.message ?? ""), checking: false });
      else throw new Error("状态格式无效");
    } catch {
      setHost({ llm: "unavailable", message: "无法读取 Floatboat 模型状态。", checking: false });
    }
  }
  useEffect(() => {
    void checkHost();
  }, []);
  const planDraft = planDraftOf(p.draft.planDraft),
    reportDraft = reportDraftOf(p.draft.reportDraft);
  function clearDraft(key: string) {
    p.setDraft((x) => {
      const next = { ...x };
      delete next[key];
      return next;
    });
  }
  async function hostPlan() {
    const key = epoch.current,
      d = dataRef.current;
    if (!d.question.trim()) return p.setError("请先写下研究问题。");
    setHostBusy("plan");
    try {
      const v = await request("/api/assist/plan", { method: "POST", body: JSON.stringify({ question: d.question, scope: d.scope }) });
      if (!isRecord(v) || !Array.isArray(v.steps)) throw new Error("模型计划格式无效。");
      if (key !== epoch.current) return;
      p.setDraft((x) => ({ ...x, planDraft: { steps: v.steps, model: String(v.model ?? ""), at: new Date().toISOString() } }));
      p.setNotice("模型已给出计划建议，确认采用前不会改动当前计划。");
    } catch (e) {
      if (key === epoch.current) p.report(e);
      void checkHost();
    } finally {
      setHostBusy("");
    }
  }
  function adoptPlanDraft() {
    if (!planDraft) return;
    change((d) => ({ ...d, plan: { steps: planDraft.steps, confirmed: false, confirmedAt: "", origin: "host" } }));
    clearDraft("planDraft");
    p.setNotice("已采用模型计划，请检查后确认。");
  }
  async function hostReport() {
    const key = epoch.current,
      d = dataRef.current;
    if (!d.sources.length) return p.setError("先执行检索或添加来源，再请模型起草。");
    setHostBusy("report");
    try {
      const v = await request("/api/assist/report", { method: "POST", body: JSON.stringify(reportMaterial(d)) });
      if (!isRecord(v) || typeof v.text !== "string") throw new Error("模型草稿格式无效。");
      if (key !== epoch.current) return;
      p.setDraft((x) => ({ ...x, reportDraft: { text: v.text, model: String(v.model ?? ""), at: new Date().toISOString(), unknown: Array.isArray(v.unknownCitations) ? v.unknownCitations : [] } }));
      p.setNotice("模型草稿已放在报告旁，可替换正文或追加到末尾。");
    } catch (e) {
      if (key === epoch.current) p.report(e);
      void checkHost();
    } finally {
      setHostBusy("");
    }
  }
  function adoptReportDraft(mode: "replace" | "append") {
    if (!reportDraft) return;
    if (mode === "replace" && dataRef.current.report.trim() && !confirm("用模型草稿替换当前报告正文？")) return;
    change((d) => ({ ...d, report: mode === "replace" ? reportDraft.text : d.report.trimEnd() + "\n\n" + reportDraft.text, stage: "reviewing" }));
    clearDraft("reportDraft");
  }

  // ── Local execution ────────────────────────────────────────────────────
  function patchStep(id: string, patch: Partial<Step>) {
    change((d) => ({ ...d, plan: { ...d.plan, steps: d.plan.steps.map((s) => (s.id === id ? { ...s, ...patch } : s)) } }));
  }
  async function runSteps(ids: string[]) {
    if (running || !dataRef.current.plan.confirmed) return;
    const key = epoch.current,
      controller = new AbortController();
    abort.current = controller;
    try {
      for (const id of ids) {
        const step = dataRef.current.plan.steps.find((s) => s.id === id);
        if (!step || step.kind === "analyze" || controller.signal.aborted || key !== epoch.current) continue;
        setRunning(id);
        patchStep(id, { status: "running", error: "" });
        try {
          const result = retrieveResultValue(
            await request("/api/retrieve", { method: "POST", body: JSON.stringify(requestForStep(step)), signal: controller.signal }),
          );
          if (key !== epoch.current) return;
          const at = new Date().toISOString();
          const failed = !result.items.length && result.failures.length > 0;
          change((d) => {
            const s = d.plan.steps.find((x) => x.id === id);
            if (!s) return d;
            const sources = mergeStepResults(d, s, result.items, citationsIn(d.report), at);
            return {
              ...d,
              sources,
              plan: {
                ...d.plan,
                steps: d.plan.steps.map((x) =>
                  x.id === id ? { ...x, status: failed ? "failed" : "done", error: result.failures.map(failureText).join("\n").slice(0, 600), ranAt: at } : x,
                ),
              },
            };
          });
          setLastRuns((r) => ({ ...r, [id]: [`取得 ${result.items.length} 项`, ...result.failures.map(failureText)] }));
        } catch (e) {
          if (key !== epoch.current) return;
          const cancelled = controller.signal.aborted;
          patchStep(id, { status: cancelled ? "todo" : "failed", error: cancelled ? "已停止，可重新执行。" : e instanceof Error ? e.message.slice(0, 600) : "检索失败" });
        }
      }
    } finally {
      if (key === epoch.current) setRunning(null);
      abort.current = null;
    }
  }
  const runAll = () => runSteps(dataRef.current.plan.steps.filter((s) => s.kind !== "analyze" && s.status !== "done").map((s) => s.id));
  const stop = () => abort.current?.abort();

  // ── Sources ────────────────────────────────────────────────────────────
  function updateSource(id: string, patch: Partial<Source>) {
    change((d) => ({ ...d, sources: d.sources.map((s) => (s.id === id ? { ...s, ...patch, ...("url" in patch ? { checked: false } : {}) } : s)) }));
  }
  function addSource(stepId = "") {
    if (dataRef.current.sources.length >= 150) return p.setError("来源最多150项。");
    change((d) => ({
      ...d,
      sources: [...d.sources, { id: crypto.randomUUID(), cite: nextCite(d.sources), url: "", title: "新的来源", excerpt: "", text: "", note: "", checked: false, origin: "manual", stepId, fetchedAt: "" }],
    }));
  }
  function removeSource(id: string) {
    const s = dataRef.current.sources.find((x) => x.id === id);
    if (!s) return;
    const cited = citationsIn(dataRef.current.report).includes(s.cite);
    if (!confirm(cited ? `报告正文引用了 [${s.cite}]，移除后该引用会失效。仍然移除？` : `从来源列表移除 [${s.cite}] ${s.title}？`)) return;
    change((d) => ({ ...d, sources: d.sources.filter((x) => x.id !== id) }));
  }
  const jumpToCite = (n: number) => setFocusCite({ n, at: Date.now() });

  // ── Report ─────────────────────────────────────────────────────────────
  function compileDraft() {
    const d = dataRef.current;
    if (d.report.trim() && !confirm("用本地底稿替换当前报告正文？可先导出现有报告。")) return;
    change((x) => ({ ...x, report: compileReport(x, p.title), stage: "reviewing" }));
    p.setNotice("已按计划与来源汇编底稿，请改写结论并核验引用。");
  }
  function deliver() {
    try {
      assertReady(dataRef.current);
      p.setData((d) => ({ ...d, stage: "ready" }));
      p.setNotice("报告已标记为可交付。之后修改内容会回到复核状态。");
    } catch (e) {
      p.report(e);
    }
  }
  function exportMd() {
    try {
      download(new Blob([exportMarkdown(dataRef.current)], { type: "text/markdown;charset=utf-8" }), fileName(p.title, ".md"));
    } catch (e) {
      p.report(e);
    }
  }
  async function exportHtml() {
    try {
      const { renderReportHtml } = await import("./exportHtml");
      download(new Blob([renderReportHtml(p.title, dataRef.current)], { type: "text/html;charset=utf-8" }), fileName(p.title, ".html"));
    } catch (e) {
      p.report(e);
    }
  }

  // ── DeerFlow results and files ─────────────────────────────────────────
  function applyNative(text: string, threadId: string) {
    const native = compactNative(text);
    nativeValue(native);
    change((d) => ({ ...d, native, threadId, sources: mergeNativeSources(d, native), stage: d.stage === "draft" ? "draft" : "reviewing" }));
    p.setNotice("已载入DeerFlow会话：来源已并入列表（待核验），报告未被覆盖。");
  }
  function adoptNativeReport() {
    const text = lastReport(dataRef.current.native);
    if (!text) return p.setError("会话里没有可采用的完整答复。");
    if (dataRef.current.report.trim() && !confirm("用DeerFlow的最新答复替换当前报告正文？")) return;
    change((d) => ({ ...d, report: text, stage: "reviewing" }));
    setStage("report");
  }
  const newResearch = () =>
    transition(async () => {
      const ok = await p.replace(emptyResearch(), "新研究", {});
      if (ok) {
        setStage("plan");
        p.setNotice("已新建研究。写下问题后生成计划。");
      }
      return ok;
    });
  const openSample = () =>
    transition(async () => {
      const ok = await p.replace(structuredClone(sampleResearch), SAMPLE_TITLE, {});
      if (ok) p.setNotice("已打开示例研究的新副本。");
      return ok;
    });
  const openProject = (id: string) => transition(() => p.open(id));
  async function importText(raw: string, name: string) {
    let value: unknown;
    try {
      value = JSON.parse(raw);
    } catch (e) {
      throw new Error("JSON 语法有误：" + (e instanceof Error ? e.message.slice(0, 120) : "无法解析") + "。");
    }
    if (!isRecord(value)) throw new Error("需要研究项目、恢复稿或DeerFlow原生会话JSON。");
    const snapshot = isRecord(value.snapshot) ? value.snapshot : value;
    if (isRecord(snapshot.data) && (typeof snapshot.data.native === "string" || snapshot.data.version === 2)) {
      const data = restoreResearch(snapshot.data);
      const extra = isRecord(snapshot.extra) ? snapshot.extra : {};
      return p.replace(data, typeof snapshot.title === "string" && snapshot.title.trim() ? snapshot.title : name, extra);
    }
    const data = fromNative(raw, typeof value.thread_id === "string" ? value.thread_id : "");
    return p.replace(data, nativeValue(data.native).view.title || name, {});
  }
  const importFile = (f: File) =>
    transition(async () => {
      if (f.size > 8 * 1048576) throw new Error("文件超过8MB；请在DeerFlow按阶段导出会话。");
      const ok = await importText(await f.text(), f.name.replace(/\.json$/i, ""));
      if (ok) p.setNotice("已导入为新研究，原研究保持不变。");
      return ok;
    });
  const importJson = (raw: string) =>
    transition(async () => {
      const ok = await importText(raw, "导入的研究");
      if (ok) clearDraft("inputJson");
      return ok;
    });
  function exportNative() {
    if (!dataRef.current.native) return p.setError("当前研究没有DeerFlow会话快照。");
    download(new Blob([dataRef.current.native], { type: "application/json" }), "deerflow-native-state.json");
  }

  return {
    p,
    mutable,
    stage,
    setStage,
    change,
    // plan
    updateStep,
    addStep,
    removeStep,
    moveStep,
    applyTemplate,
    confirmPlan,
    reopenPlan: () => change((d) => ({ ...d, plan: { ...d.plan, confirmed: false } })),
    // host
    host,
    hostBusy,
    checkHost,
    hostPlan,
    planDraft,
    adoptPlanDraft,
    discardPlanDraft: () => clearDraft("planDraft"),
    hostReport,
    reportDraft,
    adoptReportDraft,
    discardReportDraft: () => clearDraft("reportDraft"),
    // execution
    running,
    runSteps,
    runAll,
    stop,
    patchStep,
    lastRuns,
    // sources
    updateSource,
    addSource,
    removeSource,
    focusCite,
    jumpToCite,
    // report
    compileDraft,
    deliver,
    exportMd,
    exportHtml,
    // deerflow + files
    applyNative,
    adoptNativeReport,
    newResearch,
    openSample,
    openProject,
    importFile,
    importJson,
    exportNative,
    transition,
  };
}
export type Desk = ReturnType<typeof useDesk>;
