// ABOUTME: 推演台状态：自动保存的工作对象、各阶段选择、本地推演与结果缓存、导入导出、Host 与 MiroFish 通道。
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useWorkbenchState } from "./autosave-client";
import { request, download } from "./requests";
import { readSeedFile, uploadNative, decodeText, type UploadResult } from "./files";
import { useSimulationControl } from "./useSimulationControl";
import { useHostModel } from "./useHostModel";
import { isRecord } from "../contracts/project";
import { importedDraft } from "../contracts/run";
import { exampleScenario } from "../contracts/example";
import { extractGraph, layoutGraph } from "../contracts/extract";
import { generateAgents } from "../contracts/personas";
import { buildReport } from "../contracts/report";
import type { SimResult } from "../contracts/engine";
import {
  LIMITS,
  blankScenario,
  simInput,
  type RunRecord,
  type Scenario,
  type RunSummary,
  type Robustness,
  type SeedDoc,
} from "../contracts/scenario";
import { restoreScenario, scenarioProblem, scenarioValue } from "../contracts/validate";

export const STAGES = [
  { id: "seed", label: "资料" },
  { id: "graph", label: "图谱" },
  { id: "agents", label: "人设" },
  { id: "run", label: "推演" },
  { id: "observe", label: "观察" },
  { id: "report", label: "报告" },
] as const;
export type Stage = (typeof STAGES)[number]["id"];
const str = (v: unknown, d = "") => (typeof v === "string" ? v : d);
const shortId = () => crypto.randomUUID().slice(0, 8);

export function useStudio() {
  const p = useWorkbenchState(exampleScenario(), scenarioValue, "滨河低排放区推演", {
    storageKey: "mirofish-scenario-v2",
    restoreDraftData: restoreScenario,
  });
  const s = p.data;
  const epoch = useRef(p.documentKey);
  epoch.current = p.documentKey;
  const [io, setIo] = useState("");
  const [results, setResults] = useState<Record<string, SimResult>>({});
  const [resultState, setResultState] = useState<Record<string, string>>({});
  const [service, setService] = useState({ available: false, message: "正在检查 MiroFish 后端…", url: "", defaultUrl: "", configured: false, checked: false });
  const [simulations, setSimulations] = useState<Array<{ id: string; status: string }>>([]);
  const control = useSimulationControl(p, service.available);
  const mutable = !p.loading && !p.busy && !io && !control.busy;

  const stageRaw = str(p.draft.stage);
  const stage: Stage = STAGES.some((x) => x.id === stageRaw) ? (stageRaw as Stage) : s.runs.length ? "observe" : "seed";
  const setStage = (next: Stage) => p.setDraft((d) => ({ ...d, stage: next }));
  const setPick = (key: string, value: string) => p.setDraft((d) => ({ ...d, [key]: value }));
  const activeRun = s.runs.find((r) => r.id === s.activeRun) ?? s.runs[s.runs.length - 1];
  const result = activeRun ? results[activeRun.resultId || "legacy:" + activeRun.id] : undefined;
  const problem = useMemo(() => scenarioProblem(s), [s]);

  // ---- results -------------------------------------------------------------
  const loading = useRef(new Set<string>());
  const loadResult = useCallback(
    async (run: RunRecord) => {
      const key = run.resultId || "legacy:" + run.id;
      if (loading.current.has(key)) return;
      loading.current.add(key);
      const doc = epoch.current;
      setResultState((m) => ({ ...m, [key]: "loading" }));
      try {
        if (run.legacyActions) {
          const up = await uploadNative(JSON.stringify(run.legacyActions), run.sourceName || "0.5 复核", "");
          if (doc !== epoch.current) return;
          p.setData((d) => ({ ...d, runs: d.runs.map((r) => (r.id === run.id ? { ...r, resultId: up.resultId, fingerprint: up.fingerprint, summary: up.summary, legacyActions: null } : r)) }));
          const value = (await request("/api/results/" + up.resultId)) as SimResult;
          setResults((m) => ({ ...m, [up.resultId]: value, [key]: value }));
          setResultState((m) => ({ ...m, [key]: "" }));
          return;
        }
        // Deterministic local runs are (re)generated from their saved input; the call is idempotent
        // and returns the stored copy when this machine already has it.
        if (run.input) await request("/api/simulate", { method: "POST", body: JSON.stringify({ input: run.input }) });
        let value: SimResult;
        try {
          value = (await request("/api/results/" + encodeURIComponent(run.resultId))) as SimResult;
        } catch (e) {
          if ((e as { status?: number }).status === 404)
            throw new Error("此导入结果不在本机结果库中：请重新导入原生动作文件，或导入包含结果数据的推演文件。");
          throw e;
        }
        if (run.fingerprint && value.fingerprint !== run.fingerprint)
          throw new Error(`结果指纹与记录不一致（${value.fingerprint} ≠ ${run.fingerprint}），可能来自不同引擎版本；请重新运行。`);
        setResults((m) => ({ ...m, [key]: value }));
        setResultState((m) => ({ ...m, [key]: "" }));
      } catch (e) {
        setResultState((m) => ({ ...m, [key]: e instanceof Error ? e.message : "结果读取失败" }));
      } finally {
        loading.current.delete(key);
      }
    },
    [p.setData],
  );
  useEffect(() => {
    if (activeRun && !result && !resultState[activeRun.resultId || "legacy:" + activeRun.id]) void loadResult(activeRun);
  }, [activeRun?.id, activeRun?.resultId, result, p.documentKey]);
  const resultError = activeRun ? resultState[activeRun.resultId || "legacy:" + activeRun.id] ?? "" : "";

  async function runLocal() {
    if (problem) return p.setError("推演前请先修正：" + problem);
    if (!s.agents.length) return p.setError("还没有智能体：先在“人设”阶段按图谱生成。");
    if (s.runs.length >= LIMITS.runs) return p.setError(`最多保留${LIMITS.runs}次运行，请先在运行记录中删除旧的运行。`);
    const doc = epoch.current;
    const input = simInput(s);
    setIo("正在推演…");
    try {
      const r = (await request("/api/simulate", { method: "POST", body: JSON.stringify({ input, robustness: true }) })) as {
        resultId: string;
        fingerprint: string;
        summary: RunSummary;
        robustness: Robustness | null;
      };
      if (doc !== epoch.current) return;
      const record: RunRecord = {
        id: "run-" + shortId(),
        label: `推演 #${s.runs.length + 1} · 种子 ${input.params.seed}`,
        engine: "local",
        createdAt: new Date().toISOString(),
        resultId: r.resultId,
        fingerprint: r.fingerprint,
        sourceName: "本地规则推演",
        summary: r.summary,
        robustness: r.robustness,
        input,
        legacyActions: null,
      };
      p.setData((d) => ({ ...d, runs: [...d.runs, record], activeRun: record.id }));
      p.setDraft((d) => ({ ...d, stage: "observe", round: "all" }));
      p.setNotice(`推演完成：${r.summary.actions} 条动作，指纹 ${r.fingerprint}`);
    } catch (e) {
      if (doc === epoch.current) p.report(e);
    } finally {
      setIo("");
    }
  }
  function removeRun(id: string) {
    p.setData((d) => {
      const runs = d.runs.filter((r) => r.id !== id);
      return { ...d, runs, activeRun: d.activeRun === id ? runs[runs.length - 1]?.id ?? "" : d.activeRun };
    });
  }
  function selectRun(id: string) {
    p.setData((d) => ({ ...d, activeRun: id }));
  }

  // ---- seeds, graph, personas ---------------------------------------------
  async function addSeedFiles(files: File[]) {
    if (!files.length) return;
    const doc = epoch.current;
    setIo("正在读取资料…");
    try {
      const docs: SeedDoc[] = [];
      for (const f of files) {
        const text = (await readSeedFile(f, (page, total) => setIo(`正在读取 ${f.name}：第 ${page}/${total} 页`))).trim();
        docs.push({ id: "doc-" + shortId(), name: f.name.slice(0, 200), text });
      }
      if (doc !== epoch.current) return;
      const total = s.seeds.reduce((n, d) => n + d.text.length, 0) + docs.reduce((n, d) => n + d.text.length, 0);
      if (s.seeds.length + docs.length > LIMITS.seedDocs) throw new Error(`最多${LIMITS.seedDocs}份资料`);
      if (total > LIMITS.seedChars)
        throw new Error(`资料合计 ${total.toLocaleString()} 字，超过 ${LIMITS.seedChars.toLocaleString()} 字：请摘取与推演问题相关的章节后再导入。`);
      p.setData((d) => ({ ...d, seeds: [...d.seeds, ...docs] }));
      p.setDraft((d) => ({ ...d, docId: docs[docs.length - 1].id }));
      p.setNotice(`已加入 ${docs.length} 份资料，共 ${docs.reduce((n, d) => n + d.text.length, 0).toLocaleString()} 字`);
    } catch (e) {
      if (doc === epoch.current) p.report(e);
    } finally {
      setIo("");
    }
  }
  function extract() {
    const ex = extractGraph(s.seeds, s.topic);
    if (!ex.entities.length) return p.setError("资料中没有识别到机构、群体或人物。可以在图谱中手动添加实体，或用【名称】标注后重新抽取。");
    const entities = layoutGraph(ex.entities, ex.relations, true);
    p.setData((d) => ({ ...d, entities, relations: ex.relations, aspects: d.aspects.length ? d.aspects : ex.aspects, agents: [], events: d.events.map((e) => ({ ...e, author: null, target: e.target.startsWith("entity:") ? "all" : e.target })) }));
    p.setDraft((d) => ({ ...d, stage: "graph", selEntity: "", selRelation: "" }));
    p.setNotice(`规则抽取：${ex.sentences} 句资料 → ${entities.length} 个实体、${ex.relations.length} 条关系。请在图谱中核对。`);
  }
  function generate(perGroup: number) {
    if (!s.entities.length) return p.setError("先在图谱中准备实体。");
    const agents = generateAgents(s.entities, s.relations, s.aspects, { perGroup, seed: s.params.seed + "|personas" });
    if (!agents.length) return p.setError("图谱里只有议题类实体，无法生成发言者。");
    const ids = new Set(agents.map((a) => a.id));
    p.setData((d) => ({ ...d, agents, events: d.events.map((e) => (e.author !== null && !ids.has(e.author) ? { ...e, author: null } : e)) }));
    p.setNotice(`按图谱生成 ${agents.length} 个智能体人设（规则）。`);
  }

  // ---- report ----------------------------------------------------------------
  function ruleReport() {
    if (!activeRun || !result) return p.setError("先完成一次推演并等待结果载入。");
    p.setData((d) => ({ ...d, report: { runId: activeRun.id, markdown: buildReport(d, activeRun, result), source: "rule", updatedAt: new Date().toISOString() } }));
    p.setNotice("已按当前运行生成规则报告。");
  }

  function discard(key: string) {
    p.setDraft((d) => {
      const next = { ...d };
      delete next[key];
      return next;
    });
  }
  const host = useHostModel({ p, epoch, setIo, activeRun, result, discard });

  // ---- MiroFish backend (optional) -------------------------------------------
  async function checkService() {
    try {
      const v = await request("/api/service");
      if (!isRecord(v)) throw new Error("状态无效");
      setService({ available: v.available === true, message: str(v.message), url: str(v.url), defaultUrl: str(v.defaultUrl), configured: v.configured === true, checked: true });
      if (v.available === true) {
        const list = await request("/api/simulations");
        if (!Array.isArray(list)) throw new Error("模拟列表无效");
        setSimulations(list.filter(isRecord).map((x) => ({ id: str(x.id), status: str(x.status) })));
      } else setSimulations([]);
    } catch (e) {
      setService((x) => ({ ...x, available: false, message: e instanceof Error ? e.message : "检查失败", checked: true }));
    }
  }
  useEffect(() => {
    void host.checkModel();
    void checkService();
  }, []);
  function canLeave() {
    if (control.unresolved) {
      p.setError("MiroFish 运行命令仍待核对，请先核对状态；不会重复发送。");
      return false;
    }
    return true;
  }
  function importedRun(up: UploadResult, engine: "mirofish" | "import"): RunRecord {
    return {
      id: "run-" + shortId(),
      label: (engine === "mirofish" ? "MiroFish · " : "导入 · ") + (up.simulationId || up.sourceName).slice(0, 60),
      engine,
      createdAt: new Date().toISOString(),
      resultId: up.resultId,
      fingerprint: up.fingerprint,
      sourceName: up.sourceName,
      summary: up.summary,
      robustness: null,
      input: null,
      legacyActions: null,
    };
  }
  async function fromService(id: string, startedAt?: string) {
    if (!canLeave() || !id) return;
    const doc = epoch.current;
    setIo("正在读取 MiroFish 结果…");
    try {
      const up = (await request("/api/simulations/" + encodeURIComponent(id) + (startedAt ? "/runs/" + encodeURIComponent(startedAt) : "") + "/result")) as UploadResult;
      if (doc !== epoch.current) return;
      if (s.runs.length >= LIMITS.runs) throw new Error(`最多保留${LIMITS.runs}次运行，请先删除旧的运行。`);
      const run = importedRun(up, "mirofish");
      p.setData((d) => ({ ...d, runs: [...d.runs, run], activeRun: run.id }));
      p.setDraft((d) => ({ ...d, stage: "observe" }));
    } catch (e) {
      if (doc === epoch.current) p.report(e);
    } finally {
      setIo("");
    }
  }

  // ---- file lifecycle ----------------------------------------------------------
  async function guarded(task: () => Promise<boolean>) {
    if (!canLeave()) return false;
    setIo("正在切换…");
    try {
      return await task();
    } finally {
      setIo("");
    }
  }
  const fresh = () => guarded(() => p.replace(blankScenario(), "未命名推演", { stage: "seed" }));
  const example = () => guarded(() => p.fresh());
  const open = (id: string) => guarded(() => p.open(id));
  async function importNative(text: string, name: string, platform: string) {
    if (!canLeave()) return false;
    setIo("正在导入 MiroFish 结果…");
    try {
      const up = await uploadNative(text, name, platform, (done, total) => setIo(`正在上传 ${done}/${total}`));
      const run = importedRun(up, "import");
      const data: Scenario = { ...blankScenario(), origin: "import", question: up.simulationId ? `MiroFish 模拟 ${up.simulationId}` : name, runs: [run], activeRun: run.id };
      const ok = await p.replace(data, (up.simulationId || name).slice(0, 100), { stage: "observe" });
      if (ok) p.setNotice(`已导入 ${up.summary.actions} 条动作${up.ignoredEvents ? `，跳过 ${up.ignoredEvents} 条元事件` : ""}。立场为词典估计。`);
      return ok;
    } catch (e) {
      // Keep the unapplied native text so the user can pick a platform and retry.
      p.setDraft((d) => ({ ...d, nativeRaw: text.length < 600_000 ? text : "", nativeName: name, nativeError: e instanceof Error ? e.message : "导入失败" }));
      p.report(e);
      return false;
    } finally {
      setIo("");
    }
  }
  async function importBundle(v: Record<string, unknown>) {
    if (!canLeave()) return false;
    let title = str(v.title, "导入的推演"),
      data: unknown = v.data,
      extra: unknown = v.draft;
    if (isRecord(v.snapshot)) {
      title = str(v.snapshot.title, title);
      data = v.snapshot.data;
      extra = v.snapshot.extra;
    }
    const scenario = restoreScenario(data);
    setIo("正在导入推演文件…");
    try {
      const embedded = isRecord(v.results) ? v.results : {};
      for (const run of scenario.runs) {
        const actions = embedded[run.resultId];
        if (run.engine !== "local" && Array.isArray(actions)) {
          const up = await uploadNative(JSON.stringify(actions), run.sourceName || title, "");
          run.resultId = up.resultId;
        }
      }
      return await p.replace(scenario, title.slice(0, 120), { ...importedDraft(extra), stage: str(isRecord(extra) ? extra.stage : "", "") });
    } finally {
      setIo("");
    }
  }
  async function importFile(file: File) {
    try {
      if (!/\.(json|jsonl|ndjson)$/i.test(file.name)) {
        await addSeedFiles([file]);
        return;
      }
      if (file.size > 40 * 1024 * 1024) throw new Error("文件超过40MB，请按轮次分段导出。");
      const text = decodeText(new Uint8Array(await file.arrayBuffer()));
      let parsed: unknown = undefined;
      try {
        parsed = JSON.parse(text);
      } catch {
        /* JSONL native log */
      }
      if (isRecord(parsed) && (parsed.format === "floatboat-mirofish-v2" || parsed.format === "floatboat-mirofish-v1" || isRecord(parsed.snapshot))) await importBundle(parsed);
      else await importNative(text, file.name, "");
    } catch (e) {
      p.report(e);
    }
  }
  async function exportBundle() {
    setIo("正在打包推演文件…");
    try {
      const embedded: Record<string, unknown> = {};
      for (const run of s.runs)
        if (run.engine !== "local" && run.resultId) {
          const r = results[run.resultId] ?? ((await request("/api/results/" + encodeURIComponent(run.resultId))) as SimResult);
          embedded[run.resultId] = r.actions;
        }
      const draft = { ...p.draft };
      delete draft.personaSuggestion;
      delete draft.reportSuggestion;
      download(new Blob([JSON.stringify({ format: "floatboat-mirofish-v2", title: p.title, data: s, draft, results: embedded }, null, 2)], { type: "application/json" }), safeName(p.title) + ".mirofish.json");
    } catch (e) {
      p.report(e);
    } finally {
      setIo("");
    }
  }

  return {
    p,
    s,
    io,
    mutable,
    stage,
    setStage,
    setPick,
    problem,
    activeRun,
    result,
    resultError,
    loadResult,
    runLocal,
    removeRun,
    selectRun,
    addSeedFiles,
    extract,
    generate,
    ruleReport,
    ...host,
    discard,
    service,
    simulations,
    checkService,
    control,
    fromService,
    fresh,
    example,
    open,
    importFile,
    importNative,
    exportBundle,
  };
}
export type Studio = ReturnType<typeof useStudio>;
export const safeName = (t: string) => (t.trim() || "推演").replace(/[\\/:*?"<>|]+/g, "_").slice(0, 80);
