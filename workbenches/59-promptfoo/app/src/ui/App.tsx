import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState, type ChangeEvent, type DragEvent } from "react";
import { FlaskConical, Play, Square, Settings2, ChevronDown, FileText, Gauge, Server, Search } from "lucide-react";
import { useProjects, Notice, request, download } from "./workspace";
import { isRecord } from "../contracts/project";
import {
  blankConfig,
  emptyProject,
  validateProject,
  restoreProjectDraft,
  reviewKey,
  releaseKey,
  type EvalProject,
  type RunRef,
  type Review,
  type ReleaseDecision,
} from "../contracts/evaluation";
import { ConfigError, parseSuite, testsFromCsv, appendTestsToConfig, configToYaml, type Suite } from "../contracts/config";
import { columnStats, defaultGate, pct, type Baseline } from "../contracts/compare";
import type { RunView } from "../contracts/results";
import { reportCsv, reportHtml } from "../contracts/reports";
import { Matrix, visibleTests, type Filter } from "./Matrix";
import { Inspector } from "./Inspector";
import { ConfigPanel } from "./ConfigPanel";
import { FileMenu } from "./FileMenu";
import { cachedRun, exportProject, importProject, loadRun, MAX_IMPORT_BYTES, newProjectFromConfig, safeName, sniff, uploadResult } from "./files";
import { useEnvironment, useTask } from "./useEvaluation";
import { usePopover } from "./usePopover";

type Pending = { id: string; kind: "local" | "official"; name: string; input?: Record<string, unknown> };
function pendingOf(v: unknown): Pending | null {
  return isRecord(v) && typeof v.id === "string" && (v.kind === "local" || v.kind === "official") && typeof v.name === "string"
    ? { id: v.id, kind: v.kind, name: v.name, ...(isRecord(v.input) ? { input: v.input } : {}) } : null;
}
function suiteOf(text: string): { suite: Suite | null; error: string; line: number | null } {
  try {
    return { suite: parseSuite(text), error: "", line: null };
  } catch (e) {
    return { suite: null, error: e instanceof Error ? e.message : "配置无效。", line: e instanceof ConfigError ? e.line : null };
  }
}
const phaseText: Record<string, string> = {
  queued: "排队中",
  running: "评测中",
  submitting: "提交中",
  uncertain: "回执未确认",
  completed: "已完成",
  failed: "失败",
  cancelled: "已停止",
  interrupted: "已中断",
  "not-submitted": "未提交",
};
const SAMPLE_BASELINE = "v1 现网";

export function App() {
  const p = useProjects(emptyProject, validateProject, "发布评测", {
    storageKey: "promptfoo-evaluation-v2",
    restoreDraftData: restoreProjectDraft,
  });
  const env = useEnvironment();
  const [selected, setSelected] = useState("");
  const [side, setSide] = useState<"inspector" | "config" | null>("inspector");
  const [filter, setFilter] = useState<Filter>("all");
  const [search, setSearch] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const [envOpen, setEnvOpen] = useState(false);
  const [gateOpen, setGateOpen] = useState(false);
  const [confirmHost, setConfirmHost] = useState<{ calls: number; labels: string[] } | null>(null);
  const [busyText, setBusyText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [views, setViews] = useState<Record<string, RunView>>({});
  const [missing, setMissing] = useState<Record<string, string>>({});
  const menuButton = useRef<HTMLButtonElement>(null);
  const configButton = useRef<HTMLButtonElement>(null);
  const submittingRef = useRef(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const csvInput = useRef<HTMLInputElement>(null);
  const epoch = useRef(p.documentKey);
  epoch.current = p.documentKey;
  const sampleTried = useRef(false);
  const envWrap = useRef<HTMLDivElement>(null);
  const gateWrap = useRef<HTMLDivElement>(null);
  const closeEnv = useCallback(() => setEnvOpen(false), []);
  const closeGate = useCallback(() => setGateOpen(false), []);
  usePopover(envOpen, closeEnv, envWrap);
  usePopover(gateOpen, closeGate, gateWrap);

  const data = p.data;
  const configText = typeof p.draft.config === "string" ? p.draft.config : data.config;
  const deferredConfig = useDeferredValue(configText);
  const draftCheck = useMemo(() => suiteOf(deferredConfig), [deferredConfig]);
  const applied = useMemo(() => suiteOf(data.config), [data.config]);
  const suite = applied.suite;
  const pending = pendingOf(p.draft.task);

  // 编辑中的配置一旦能通过检查就生效；无效输入只作为草稿保存
  useEffect(() => {
    if (draftCheck.suite && deferredConfig !== data.config) p.setData((prev) => ({ ...prev, config: deferredConfig }));
    if (draftCheck.suite && typeof p.draft.config === "string" && p.draft.config === deferredConfig)
      p.setDraft((prev) => {
        if (prev.config !== deferredConfig) return prev;
        const next = { ...prev };
        delete next.config;
        return next;
      });
  }, [draftCheck.suite, deferredConfig]);

  const runRef = data.runs.find((r) => r.id === data.current) ?? null;
  const run = runRef ? (views[runRef.id] ?? cachedRun(runRef.id)?.view ?? null) : null;
  const baselineRunId = data.baseline.kind === "run" ? data.baseline.runId : "";
  const baselineRun = baselineRunId ? (views[baselineRunId] ?? cachedRun(baselineRunId)?.view ?? null) : null;

  useEffect(() => {
    for (const id of [data.current, baselineRunId])
      if (id && !views[id] && !missing[id])
        loadRun(id)
          .then((e) => setViews((v) => ({ ...v, [id]: e.view })))
          .catch((e) => setMissing((m) => ({ ...m, [id]: e instanceof Error ? e.message : "运行结果无法读取。" })));
  }, [data.current, baselineRunId, views, missing]);

  const stats = useMemo(() => (run ? columnStats(run, data.baseline, baselineRun) : []), [run, data.baseline, baselineRun]);
  useEffect(() => {
    if (!run) return;
    p.setData((prev) => {
      if (prev.current !== runRef?.id) return prev;
      const b = prev.baseline;
      if ((b.kind === "prompt" && !run.columns.some((c) => c.prompt === b.prompt)) || (b.kind === "run" && b.runId === prev.current))
        return { ...prev, baseline: { kind: "none" } };
      return prev;
    });
  }, [run, runRef?.id]);

  // 新运行载入后选中第一处退步或失败，详情栏首屏就有内容
  useEffect(() => {
    if (!run || (selected && run.byKey.has(selected))) return;
    const firstBad = run.cells.find((c) => !c.pass && run.columns[c.column]?.prompt !== (data.baseline.kind === "prompt" ? data.baseline.prompt : "")) ?? run.cells.find((c) => !c.pass) ?? run.cells[0];
    if (firstBad) setSelected(firstBad.key);
  }, [run]);
  useEffect(() => {
    setSelected("");
    setConfirmHost(null);
    setSearch("");
  }, [p.documentKey]);

  const loadSample = useCallback(async () => {
    const key = epoch.current;
    setBusyText("正在载入示例评测…");
    try {
      const res = await request("/api/sample", { method: "POST", body: JSON.stringify({ runId: `smp-${crypto.randomUUID()}` }) });
      if (!isRecord(res) || typeof res.config !== "string" || !isRecord(res.run)) throw new Error("示例响应无效。");
      if (epoch.current !== key) return;
      const ref = res.run as unknown as RunRef;
      const replaced = await p.replace(
        { ...structuredClone(emptyProject), config: res.config, runs: [ref], current: ref.id, baseline: { kind: "prompt", prompt: SAMPLE_BASELINE } },
        "售后助手发布评测",
        {},
      );
      if (!replaced) return;
      p.setNotice("已载入示例：36 个售后工单 × 3 个提示版本。回放录制输出与规则脚本都在本机运行，点“运行评测”重新评分。");
    } catch (e) {
      p.report(e);
    } finally {
      setBusyText("");
    }
  }, [p]);
  useEffect(() => {
    if (p.loading || sampleTried.current) return;
    sampleTried.current = true;
    if (!p.items.length && !p.current && !data.runs.length && data.config === blankConfig && typeof p.draft.config !== "string") void loadSample();
  }, [p.loading]);

  const addRun = useCallback(
    (ref: RunRef, kind: "local" | "official" | "import") => {
      p.setData((prev): EvalProject => {
        if (prev.runs.some((r) => r.id === ref.id)) return { ...prev, current: ref.id };
        const previous = prev.current;
        const runs = [ref, ...prev.runs].slice(0, 60);
        const view = cachedRun(ref.id)?.view;
        let baseline: Baseline = prev.baseline;
        if (kind === "official" && previous) baseline = { kind: "run", runId: previous };
        else if (baseline.kind === "none" && view?.columns.length) baseline = { kind: "prompt", prompt: view.columns[0].prompt };
        else if (baseline.kind === "run" && !runs.some((r) => r.id === (baseline as { runId: string }).runId)) baseline = { kind: "none" };
        return { ...prev, runs, current: ref.id, baseline };
      });
    },
    [p],
  );
  const clearTask = useCallback(() => p.setDraft((prev) => {
    const next = { ...prev };
    delete next.task;
    return next;
  }), [p]);
  const task = useTask({
    pending,
    documentKey: p.documentKey,
    onDone(ref, kind) {
      addRun(ref, kind);
      clearTask();
      p.setNotice(
        kind === "official"
          ? "官方 promptfoo 0.125.1 核对完成：已与上一次运行对照，退步/修复列显示两者差异（本机脚本与模型列不参与）。"
          : `运行完成：${ref.stats.pass}/${ref.stats.total} 通过${ref.stats.error ? `，${ref.stats.error} 格执行错误` : ""}。`,
      );
    },
    onEnd(message) {
      clearTask();
      p.setError(message);
    },
  });
  const running = Boolean(pending) || submitting;

  async function submitTask(next: Pending) {
    if (submittingRef.current || !next.input) return;
    submittingRef.current = true;
    setSubmitting(true);
    const key = epoch.current;
    p.setDraft((prev) => ({ ...prev, task: next }));
    try {
      // Persist the immutable request before sending it. A retry uses this ID and input.
      if (!(await p.save())) {
        if (epoch.current === key) {
          clearTask();
          p.setError("任务尚未提交：请先恢复自动保存，再运行评测。");
        }
        return;
      }
      if (epoch.current !== key) return;
      await request(next.kind === "local" ? "/api/evaluations" : "/api/official-jobs", {
        method: "POST",
        body: JSON.stringify(next.input),
      });
    } catch (e) {
      if (epoch.current !== key) return;
      if (isRecord(e) && typeof e.status === "number" && e.status >= 400 && e.status < 500) {
        clearTask();
        p.report(e);
      } else {
        p.setError("提交回执未确认，正在按原任务编号查询；可重试原任务，不会新建运行。");
      }
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  }

  async function startRun(allowHost = false) {
    if (running) return;
    const check = suiteOf(configText);
    if (!check.suite) {
      setSide("config");
      p.setError(`配置未生效，无法运行：${check.error}`);
      return;
    }
    const host = check.suite.columns.filter((c) => c.provider.kind === "host");
    if (host.length && !allowHost) {
      setConfirmHost({ calls: host.length * check.suite.tests.length, labels: [...new Set(host.map((c) => c.provider.label))] });
      return;
    }
    setConfirmHost(null);
    const id = crypto.randomUUID();
    const name = `运行 ${data.runs.filter((r) => r.origin === "local").length + 1} · ${new Date().toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" })}`;
    p.setError("");
    await submitTask({ id, kind: "local", name, input: { id, config: configText, sources: data.runs.map((r) => r.id), allowHost, name } });
  }
  async function startOfficial() {
    if (running) return;
    setEnvOpen(false);
    const id = `eval-${crypto.randomUUID()}`;
    await submitTask({ id, kind: "official", name: "官方核对", input: { id, config: data.config, sources: data.runs.map((x) => x.id) } });
  }
  async function stopRun() {
    if (!pending) return;
    if (pending.kind === "local") await request(`/api/evaluations/${pending.id}/cancel`, { method: "POST", body: "{}" }).catch(p.report);
  }

  async function importFile(file: File) {
    const key = epoch.current;
    if (file.size > MAX_IMPORT_BYTES) {
      p.setError("文件超过 40MB，请分批导出。");
      return;
    }
    try {
      const text = await file.text();
      const s = sniff(file.name, text);
      if (epoch.current !== key) return;
      if (s.kind === "csv") return appendCsv(text);
      if (s.kind === "draft") {
        if (await p.replace(s.data, s.title, s.extra)) {
          setSide("config");
          p.setNotice("工作草稿已恢复为新的评测。运行结果引用仍指向原本机资料。");
        }
        return;
      }
      if (s.kind === "config") {
        const check = suiteOf(s.text);
        if (!(await p.replace(newProjectFromConfig(s.text), check.suite?.description.slice(0, 80) || s.title, {}))) return;
        if (!check.suite) {
          setSide("config");
          p.setError(`配置已导入为新评测，但还不能运行：${check.error}`);
        } else p.setNotice(`已导入配置：${check.suite.tests.length} 个用例 × ${check.suite.columns.length} 列。录制输出可从 Promptfoo 结果 JSON 导入。`);
        return;
      }
      if (s.kind === "project") {
        setBusyText("正在导入评测项目…");
        const res = await importProject(s.value, setBusyText);
        if (epoch.current !== key) return;
        if (!(await p.replace(res.data, res.title, res.draft !== undefined ? { config: res.draft } : {}))) return;
        p.setNotice("评测项目已导入为新的评测，原评测保持不变。");
        return;
      }
      setBusyText("正在上传结果…");
      const ref = await uploadResult(s.text, s.title, (d, t) => setBusyText(`正在上传结果 ${d}/${t}…`));
      await loadRun(ref.id);
      if (epoch.current !== key) return;
      const adoptConfig = data.config === blankConfig && !data.runs.length && s.config && typeof s.config === "object";
      addRun(ref, "import");
      if (adoptConfig) {
        const yaml = configToYaml(s.config);
        if (suiteOf(yaml).suite) p.setData((prev) => ({ ...prev, config: yaml }));
      }
      p.setNotice(`已加入运行“${ref.name}”：${ref.stats.pass}/${ref.stats.total} 通过。其中的输出可作为录制供回放 provider 使用。`);
    } catch (e) {
      p.report(e);
    } finally {
      setBusyText("");
    }
  }
  async function appendCsv(text: string) {
    try {
      const tests = testsFromCsv(text);
      const next = appendTestsToConfig(configText, tests);
      p.setDraft((prev) => ({ ...prev, config: next }));
      setSide("config");
      p.setNotice(`已追加 ${tests.length} 个用例到配置。`);
    } catch (e) {
      p.report(e);
    }
  }
  const onFile = (e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (f) void importFile(f);
  };
  const onCsv = async (e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (f) {
      if (f.size > MAX_IMPORT_BYTES) return p.setError("文件超过 40MB，请分批导出。");
      const key = epoch.current;
      const text = await f.text();
      if (epoch.current === key) await appendCsv(text);
    }
  };
  const onDrop = (e: DragEvent) => {
    const f = e.dataTransfer.files?.[0];
    if (!f) return;
    e.preventDefault();
    void importFile(f);
  };

  const baselineLabel =
    data.baseline.kind === "prompt" ? data.baseline.prompt : data.baseline.kind === "run" ? (data.runs.find((r) => r.id === baselineRunId)?.name ?? "另一运行") : "无";
  const reportInput = () =>
    run && runRef
      ? {
          title: p.title,
          runId: runRef.id,
          runName: runRef.name,
          run,
          baseline: data.baseline,
          baselineRun,
          baselineName: baselineLabel,
          reviews: data.reviews,
          releases: data.releases,
          gate: data.gate,
        }
      : null;
  const exportHtml = () => {
    const i = reportInput();
    if (i) download(new Blob([reportHtml(i)], { type: "text/html;charset=utf-8" }), `${safeName(p.title)}-报告.html`);
  };
  const exportCsv = () => {
    const i = reportInput();
    if (i) download(new Blob([reportCsv(i)], { type: "text/csv;charset=utf-8" }), `${safeName(p.title)}-明细.csv`);
  };
  const exportResults = async () => {
    if (!runRef) return;
    try {
      const raw = (await loadRun(runRef.id)).raw;
      download(new Blob([JSON.stringify(raw, null, 2)], { type: "application/json" }), `${safeName(runRef.name)}.results.json`);
    } catch (e) {
      p.report(e);
    }
  };
  const addHostColumn = () => {
    const model = env.host.model || "gemini-3.8-flash";
    const label = `Floatboat · ${model}`;
    if (configText.includes(`floatboat:${model}`)) {
      p.setNotice("配置中已有这个 Floatboat 模型列。");
      return;
    }
    const next = configText.replace(/^providers:\s*\n/m, `providers:\n  - id: floatboat:${model}\n    label: ${label}\n    config:\n      temperature: 0\n`);
    if (next === configText) {
      p.setError("没有找到 providers 列表，请手动添加：- id: floatboat:" + model);
      return;
    }
    p.setDraft((prev) => ({ ...prev, config: next }));
    p.setNotice(`已添加列 ${label}。运行前会提示将发起的真实模型调用次数。`);
  };
  const setReview = (key: string, r: Review) =>
    p.setData((prev) => {
      try {
        return restoreProjectDraft({ ...prev, reviews: { ...prev.reviews, [key]: r } });
      } catch (e) {
        p.report(e);
        return prev;
      }
    });
  const setRelease = (colKey: string, decision: ReleaseDecision) =>
    runRef &&
    p.setData((prev) => ({
      ...prev,
      releases: { ...prev.releases, [releaseKey(runRef.id, colKey)]: { decision, note: prev.releases[releaseKey(runRef.id, colKey)]?.note ?? "" } },
    }));
  const removeRun = () => {
    if (!runRef || !confirm(`从当前评测移除“${runRef.name}”？本机原始结果仍会保留。`)) return;
    p.setData((prev) => {
      const runs = prev.runs.filter((r) => r.id !== runRef.id);
      return {
        ...prev,
        runs,
        current: runs[0]?.id ?? "",
        baseline: prev.baseline.kind === "run" && prev.baseline.runId === runRef.id ? { kind: "none" } : prev.baseline,
      };
    });
    p.setNotice(`已从项目移除“${runRef.name}”。`);
  };

  const cell = run?.byKey.get(selected) ?? null;
  const shown = run ? visibleTests(run, filter, search, data.baseline, baselineRun, data.reviews, runRef?.id ?? "") : [];
  const totals = run ? { pass: run.cells.filter((c) => c.pass).length, total: run.cells.length } : null;
  const conflict = p.autoState.phase === "conflict";
  const progress = task && task.total ? Math.round((task.done / task.total) * 100) : 0;

  return (
    <div className={`app side-${side ?? "none"}`} onDragOver={(e) => e.preventDefault()} onDrop={onDrop}>
      <a className="skip" href="#matrix">
        跳到评测矩阵
      </a>
      <header className="topbar">
        <div className="brand" aria-label="Promptfoo 评测台">
          <FlaskConical size={20} aria-hidden="true" />
          <h1>Promptfoo</h1>
        </div>
        <div className="menu-wrap">
          <button ref={menuButton} className="menu-button" aria-expanded={menuOpen} aria-haspopup="dialog" onClick={() => setMenuOpen((v) => !v)}>
            评测 <ChevronDown size={14} aria-hidden="true" />
          </button>
          <FileMenu
            open={menuOpen}
            close={() => setMenuOpen(false)}
            trigger={menuButton}
            locked={p.busy || Boolean(busyText) || running}
            items={p.items}
            currentId={p.current?.id}
            hasRun={Boolean(run)}
            conflict={conflict}
            onNew={() => void p.replace(structuredClone(emptyProject), "新的评测", {})}
            onSample={() => void loadSample()}
            onOpen={(id) => void p.open(id)}
            onImport={() => fileInput.current?.click()}
            onExportYaml={() => download(new Blob([data.config], { type: "text/yaml;charset=utf-8" }), "promptfooconfig.yaml")}
            onExportResults={() => void exportResults()}
            onExportCsv={exportCsv}
            onExportHtml={exportHtml}
            onExportProject={() => void exportProject(p.title, data, configText).catch(p.report)}
            onRemoveRun={removeRun}
            onExportDraft={p.exportDraft}
            onRetrySave={() => void p.save()}
            onServerVersion={() => p.current && void p.open(p.current.id)}
          />
        </div>
        <label className="title">
          <span className="sr-only">评测名称</span>
          <input name="title" autoComplete="off" maxLength={120} value={p.title} onChange={(e) => p.setTitle(e.target.value)} />
        </label>
        <span className={`save s-${p.autoState.phase}`} role="status">
          {p.autoState.message || "已自动保存"}
        </span>
      </header>

      <nav className="runbar" aria-label="运行与对照">
        <div className="run-main">
          {running ? (
            <button className="primary" onClick={() => void stopRun()} disabled={submitting || pending?.kind === "official" || task?.state === "not-submitted"}>
              <Square size={14} aria-hidden="true" /> {pending?.kind === "official" ? "官方核对中…" : "停止"}
            </button>
          ) : (
            <button className="primary" onClick={() => void startRun()}>
              <Play size={15} aria-hidden="true" /> 运行评测
            </button>
          )}
          {pending?.input && !submitting && (task?.state === "uncertain" || task?.state === "not-submitted") ? (
            <button onClick={() => void submitTask(pending)}>重试原任务</button>
          ) : null}
          <div className="env-wrap" ref={envWrap}>
            <button className="env-button" aria-expanded={envOpen} onClick={() => setEnvOpen((v) => !v)}>
              <span className="dot ok" aria-hidden="true" />
              <span className={`dot ${env.host.available ? "ok" : "off"}`} aria-hidden="true" />
              <span className={`dot ${env.runner.connected ? "ok" : "off"}`} aria-hidden="true" />
              执行环境
            </button>
            {envOpen ? (
              <div className="env-pop" role="dialog" aria-label="执行环境">
                <section>
                  <h3>
                    <span className="dot ok" /> 本机评测引擎 · 就绪
                  </h3>
                  <p>断言、录制回放、echo 与脚本 provider 在工作台 Node 进程内执行，不需要外部服务。</p>
                </section>
                <section>
                  <h3>
                    <span className={`dot ${env.host.available ? "ok" : "off"}`} /> Floatboat 模型
                  </h3>
                  <p>{env.host.message}</p>
                  <button className="small" disabled={env.host.checking} onClick={() => void env.checkHost()}>
                    {env.host.checking ? "检查中…" : "重新检查"}
                  </button>
                </section>
                <section>
                  <h3>
                    <Server size={14} aria-hidden="true" /> 官方 promptfoo 0.125.1（可选）
                  </h3>
                  <p>{env.runner.message}</p>
                  {!env.runner.connected ? (
                    <>
                      <p className="muted small">在仓库根目录启动执行器，并让工作台带 PROMPTFOO_RUNNER_URL 启动：</p>
                      <pre className="cmd">{`cd workbenches/59-promptfoo/service\npnpm install --frozen-lockfile --ignore-scripts\nPROMPTFOO_RUNNER_ALLOW_JS=1 pnpm start\n# 另一终端\nPROMPTFOO_RUNNER_URL=http://127.0.0.1:8770 pnpm workbench dev promptfoo`}</pre>
                    </>
                  ) : null}
                  <div className="row">
                    <button className="small" disabled={env.runner.checking} onClick={() => void env.checkRunner()}>
                      {env.runner.checking ? "检查中…" : "重新检查"}
                    </button>
                    {env.runner.connected ? (
                      <button className="small" disabled={running} onClick={() => void startOfficial()}>
                        用官方 promptfoo 交叉核对
                      </button>
                    ) : null}
                  </div>
                </section>
              </div>
            ) : null}
          </div>
          <span className="task" role="status">
            {busyText ||
              (task
                ? `${phaseText[task.state] ?? task.state}${task.total ? ` ${task.done}/${task.total}` : ""}${task.hostCalls ? ` · 含 ${task.hostCalls} 次模型调用` : ""}`
                : running
                  ? "提交中…"
                  : totals
                    ? `${totals.pass}/${totals.total} 通过 · ${pct(totals.total ? totals.pass / totals.total : 0)}`
                    : suite
                      ? `尚未运行 · ${suite.tests.length} 用例 × ${suite.columns.length} 列`
                      : "配置未生效")}
            {task && task.total ? <progress max={100} value={progress} aria-label="评测进度" /> : null}
          </span>
        </div>
        <div className="run-tools">
          <label className="field inline">
            <span>运行</span>
            <select name="run" value={data.current} onChange={(e) => p.setData((prev) => ({ ...prev, current: e.target.value }))} disabled={!data.runs.length}>
              {!data.runs.length ? <option value="">尚无运行</option> : null}
              {data.runs.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name} · {r.stats.pass}/{r.stats.total}
                </option>
              ))}
            </select>
          </label>
          <label className="field inline">
            <span>对照</span>
            <select
              name="baseline"
              value={data.baseline.kind === "prompt" ? `p:${data.baseline.prompt}` : data.baseline.kind === "run" ? `r:${data.baseline.runId}` : "none"}
              onChange={(e) => {
                const v = e.target.value;
                const next: Baseline = v.startsWith("p:") ? { kind: "prompt", prompt: v.slice(2) } : v.startsWith("r:") ? { kind: "run", runId: v.slice(2) } : { kind: "none" };
                p.setData((prev) => ({ ...prev, baseline: next }));
              }}
            >
              <option value="none">不对照</option>
              {[...new Set((run?.columns ?? []).map((c) => c.prompt))].map((label) => (
                <option key={label} value={`p:${label}`}>
                  提示版本：{label.slice(0, 40)}
                </option>
              ))}
              {data.runs
                .filter((r) => r.id !== data.current)
                .map((r) => (
                  <option key={r.id} value={`r:${r.id}`}>
                    运行：{r.name}
                  </option>
                ))}
            </select>
          </label>
          <label className="field inline">
            <span>显示</span>
            <select name="filter" value={filter} onChange={(e) => setFilter(e.target.value as Filter)}>
              <option value="all">全部用例</option>
              <option value="fail">有未通过</option>
              <option value="regressed">有退步</option>
              <option value="changed">输出有变化</option>
              <option value="unreviewed">未通过且待复核</option>
            </select>
          </label>
          <label className="search">
            <Search size={14} aria-hidden="true" />
            <span className="sr-only">搜索用例</span>
            <input name="search" type="search" placeholder="搜索用例…" value={search} onChange={(e) => setSearch(e.target.value)} />
          </label>
          <div className="gate-wrap" ref={gateWrap}>
            <button className="ghost" aria-expanded={gateOpen} onClick={() => setGateOpen((v) => !v)}>
              <Gauge size={15} aria-hidden="true" /> 门槛 {pct(data.gate.minPassRate)}
            </button>
            {gateOpen ? (
              <div className="gate-pop" role="dialog" aria-label="发布门槛">
                <label className="field">
                  <span>最低通过率（%）</span>
                  <input
                    type="number"
                    name="min-pass"
                    min={0}
                    max={100}
                    step={1}
                    value={Math.round(data.gate.minPassRate * 100)}
                    onChange={(e) => p.setData((prev) => ({ ...prev, gate: { ...prev.gate, minPassRate: Math.min(1, Math.max(0, Number(e.target.value) / 100 || 0)) } }))}
                  />
                </label>
                <label className="field">
                  <span>允许的退步数</span>
                  <input
                    type="number"
                    name="max-regressions"
                    min={0}
                    step={1}
                    value={data.gate.maxRegressions}
                    onChange={(e) => p.setData((prev) => ({ ...prev, gate: { ...prev.gate, maxRegressions: Math.max(0, Math.trunc(Number(e.target.value) || 0)) } }))}
                  />
                </label>
                <label className="check">
                  <input type="checkbox" name="allow-errors" checked={data.gate.allowErrors} onChange={(e) => p.setData((prev) => ({ ...prev, gate: { ...prev.gate, allowErrors: e.target.checked } }))} />
                  执行错误不阻止发布
                </label>
                <button className="small" onClick={() => p.setData((prev) => ({ ...prev, gate: defaultGate }))}>
                  恢复默认
                </button>
              </div>
            ) : null}
          </div>
          <button ref={configButton} className={side === "config" ? "ghost on" : "ghost"} aria-pressed={side === "config"} onClick={() => setSide((s) => (s === "config" ? "inspector" : "config"))}>
            <Settings2 size={15} aria-hidden="true" /> 配置{draftCheck.error ? <span className="badge">!</span> : null}
          </button>
          <button className="ghost" disabled={!run} onClick={exportHtml}>
            <FileText size={15} aria-hidden="true" /> 报告
          </button>
        </div>
      </nav>

      <Notice error={p.error} notice={p.notice} onClose={() => (p.setError(""), p.setNotice(""))} />
      {confirmHost ? (
        <div className="confirm" role="alertdialog" aria-label="确认模型调用">
          <p>
            这次运行包含 Floatboat 模型列（{confirmHost.labels.join("、")}），将发起 <strong>{confirmHost.calls}</strong> 次真实模型调用，按 Floatboat 账户计费。录制回放、echo 和脚本列照常在本机执行。
          </p>
          <button className="primary" onClick={() => void startRun(true)}>
            确认并运行
          </button>
          <button onClick={() => setConfirmHost(null)}>取消</button>
        </div>
      ) : null}
      {runRef && missing[runRef.id] ? (
        <p className="notice error" role="alert">
          {missing[runRef.id]}
        </p>
      ) : null}

      <main className="desk" id="matrix">
        <div className="matrix-pane">
          {run || !runRef ? (
            <Matrix
              run={run}
              runId={runRef?.id ?? ""}
              suite={suite ?? draftCheck.suite}
              baseline={data.baseline}
              baselineRun={baselineRun}
              stats={stats}
              gate={data.gate}
              reviews={data.reviews}
              releases={data.releases}
              selected={selected}
              filter={filter}
              search={search}
              onSelect={(k) => {
                setSelected(k);
                setSide("inspector");
              }}
              onRelease={setRelease}
            />
          ) : (
            <div className="matrix-empty" role="status">
              {missing[runRef.id] ? "这次运行的结果不在本机。" : "正在读取运行结果…"}
            </div>
          )}
          {run && shown.length ? <p className="matrix-foot muted small">共 {shown.length} 个用例 · 方向键在单元格间移动 · 拖入文件即可导入</p> : null}
        </div>
        {side === "config" ? (
          <ConfigPanel
            text={configText}
            applied={!draftCheck.error && deferredConfig === configText}
            suite={draftCheck.suite}
            error={draftCheck.error}
            errorLine={draftCheck.line}
            hostModel={env.host.model}
            onChange={(v) => p.setDraft((prev) => ({ ...prev, config: v }))}
            onRevert={() =>
              p.setDraft((prev) => {
                const next = { ...prev };
                delete next.config;
                return next;
              })
            }
            onClose={() => { setSide("inspector"); configButton.current?.focus(); }}
            onImportCsv={() => csvInput.current?.click()}
            onAddHost={addHostColumn}
          />
        ) : side === "inspector" && run && cell && runRef ? (
          <Inspector
            key={cell.key}
            run={run}
            cell={cell}
            baseline={data.baseline}
            baselineRun={baselineRun}
            baselineLabel={baselineLabel}
            review={data.reviews[reviewKey(runRef.id, cell.key)] ?? { decision: "pending", note: "" }}
            onReview={(r) => setReview(reviewKey(runRef.id, cell.key), r)}
            onClose={() => setSide(null)}
          />
        ) : null}
      </main>
      <input ref={fileInput} className="sr-only" type="file" tabIndex={-1} aria-label="导入文件" accept=".yaml,.yml,.json,.csv,application/json,text/yaml,text/csv" onChange={onFile} />
      <input ref={csvInput} className="sr-only" type="file" tabIndex={-1} aria-label="导入用例 CSV" accept=".csv,text/csv" onChange={(e) => void onCsv(e)} />
    </div>
  );
}
