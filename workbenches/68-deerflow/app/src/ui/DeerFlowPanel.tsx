// ABOUTME: DeerFlow 通道：服务状态/启动方式/重新检查，按确认计划提交后台研究，SSE 实时进度，载入结果与读取已有会话。
import { useEffect, useRef, useState } from "react";
import { RefreshCw, Play, ArrowDownToLine, Radio } from "lucide-react";
import { request, download } from "./workspace";
import { isRecord } from "../contracts/project";
import { researchRunValue, runEventValue, runLabels, streamLabels, activePhases, DEFAULT_MODEL, type ResearchRun, type RunEvent } from "../contracts/run";
import { deerflowBrief } from "../contracts/plan";
import { threadValue } from "../contracts/research";
import type { Desk } from "./useDesk";

type Service = { configured: boolean; source: string; url: string; suggested: string; checked: boolean; reachable: boolean; models: string[]; message: string; tokenConfigured: boolean };
function serviceValue(v: unknown): Service {
  if (!isRecord(v)) throw new Error("服务状态无效。");
  return {
    configured: v.configured === true,
    source: String(v.source ?? "none"),
    url: String(v.url ?? ""),
    suggested: String(v.suggested ?? "http://localhost:2026"),
    checked: v.checked === true,
    reachable: v.reachable === true,
    models: Array.isArray(v.models) ? v.models.filter((m): m is string => typeof m === "string") : [],
    message: String(v.message ?? ""),
    tokenConfigured: v.tokenConfigured === true,
  };
}
const time = new Intl.DateTimeFormat("zh-CN", { hour: "2-digit", minute: "2-digit", second: "2-digit" });

/** Live progress for one run over EventSource; replays from the last seen event after reconnects. */
function useRunEvents(run: ResearchRun | null, onRun: (r: ResearchRun) => void) {
  const [events, setEvents] = useState<RunEvent[]>([]);
  const [connected, setConnected] = useState(false);
  const onRunRef = useRef(onRun);
  onRunRef.current = onRun;
  const id = run?.id ?? "";
  const live = Boolean(run && (activePhases.includes(run.phase) || run.stream === "connected" || run.stream === "retrying"));
  useEffect(() => {
    setEvents([]);
    if (!id) return;
    if (!live || typeof EventSource === "undefined") {
      let active = true;
      request("/api/research/" + encodeURIComponent(id) + "/log")
        .then((v) => {
          if (active && Array.isArray(v)) setEvents(v.map(runEventValue).slice(-200));
        })
        .catch(() => {});
      return () => {
        active = false;
      };
    }
    const source = new EventSource("/api/research/" + encodeURIComponent(id) + "/events");
    source.onopen = () => setConnected(true);
    source.onerror = () => setConnected(false);
    source.addEventListener("progress", (e) => {
      try {
        const ev = runEventValue(JSON.parse((e as MessageEvent).data));
        setEvents((list) => (list.some((x) => x.seq === ev.seq) ? list : [...list, ev].slice(-200)));
      } catch {
        /* ignore malformed frame */
      }
    });
    source.addEventListener("run", (e) => {
      try {
        onRunRef.current(researchRunValue(JSON.parse((e as MessageEvent).data)));
      } catch {
        /* ignore malformed frame */
      }
    });
    source.addEventListener("done", () => {
      source.close();
      setConnected(false);
    });
    return () => {
      source.close();
      setConnected(false);
    };
  }, [id, live]);
  return { events, connected };
}

export function DeerFlowPanel({ d }: { d: Desk }) {
  const { p } = d;
  const projectId = p.current?.id ?? null;
  const [service, setService] = useState<Service | null>(null);
  const [checking, setChecking] = useState(false);
  const [address, setAddress] = useState("");
  const [runs, setRuns] = useState<ResearchRun[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [pendingCommand, setPendingCommand] = useState(false);
  const epoch = useRef(p.documentKey);
  epoch.current = p.documentKey;
  const model = typeof p.draft.researchModel === "string" ? p.draft.researchModel : DEFAULT_MODEL;
  const threadInput = typeof p.draft.threadInput === "string" ? p.draft.threadInput : p.data.threadId;

  async function check() {
    setChecking(true);
    try {
      const s = serviceValue(await request("/api/service-status/check", { method: "POST" }));
      setService(s);
      if (s.reachable && s.models.length && !s.models.includes(model) && p.draft.researchModel === undefined) p.setDraft((x) => ({ ...x, researchModel: s.models[0] }));
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "无法检查服务。");
    } finally {
      setChecking(false);
    }
  }
  async function saveAddress() {
    setChecking(true);
    try {
      setService(serviceValue(await request("/api/service-settings", { method: "PUT", body: JSON.stringify({ url: address }) })));
      setMessage("");
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "无法保存地址。");
    } finally {
      setChecking(false);
    }
  }
  useEffect(() => {
    let live = true;
    request("/api/service-status")
      .then((v) => {
        if (!live) return;
        const s = serviceValue(v);
        setService(s);
        setAddress(s.url || s.suggested);
        if (s.configured) void check();
      })
      .catch(() => live && setMessage("无法读取服务配置。"));
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    let live = true;
    const key = p.documentKey;
    setRuns([]);
    setPendingCommand(false);
    if (!projectId) return;
    request("/api/projects/" + projectId + "/research")
      .then((raw) => {
        if (live && epoch.current === key && Array.isArray(raw)) setRuns(raw.map(researchRunValue));
      })
      .catch(() => live && setMessage("研究记录暂时无法读取，原记录仍保留。"));
    return () => {
      live = false;
    };
  }, [projectId, p.documentKey]);
  const upsert = (r: ResearchRun) => setRuns((list) => [r, ...list.filter((x) => x.id !== r.id)].sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
  const active = runs.find((r) => activePhases.includes(r.phase)) ?? null;
  const watched = active ?? runs[0] ?? null;
  const { events, connected } = useRunEvents(watched, (r) => {
    if (epoch.current === p.documentKey) upsert(r);
  });

  async function perform(fn: () => Promise<void>) {
    if (busy) return;
    setBusy(true);
    setMessage("");
    try {
      await fn();
    } catch (e) {
      p.report(e);
    } finally {
      setBusy(false);
    }
  }
  const submit = () =>
    perform(async () => {
      const key = epoch.current;
      const saved = await p.save();
      if (!saved) throw new Error("请先完善研究，使其能保存，再提交。");
      if (key !== epoch.current) return;
      const id = crypto.randomUUID();
      setPendingCommand(true);
      p.setDraft((x) => ({ ...x, lastResearchId: id }));
      try {
        const value = researchRunValue(
          await request("/api/research", { method: "POST", body: JSON.stringify({ id, projectId: saved.id, prompt: deerflowBrief(saved.data), model }) }),
        );
        if (key === epoch.current) upsert(value);
        setPendingCommand(false);
      } catch (e) {
        if (isRecord(e) && typeof e.status === "number" && e.status >= 400 && e.status < 500) setPendingCommand(false);
        throw new Error((e instanceof Error ? e.message : "提交响应未到达。") + " 系统会从持久记录核对，不会自动重发研究。");
      }
    });
  const refresh = (row: ResearchRun) =>
    perform(async () => {
      const value = researchRunValue(await request("/api/research/" + row.id + "/refresh", { method: "POST" }));
      if (epoch.current === p.documentKey) upsert(value);
    });
  const load = (row: ResearchRun) =>
    perform(async () => {
      const key = epoch.current;
      const value = researchRunValue(await request("/api/research/" + row.id));
      if (!value.native || value.phase !== "success") throw new Error("研究结果尚不可读取。");
      if (key === epoch.current) d.applyNative(value.native, value.threadId);
    });
  const receipt = (row: ResearchRun) =>
    perform(async () => {
      const value = researchRunValue(await request("/api/research/" + row.id));
      download(new Blob([JSON.stringify(value, null, 2)], { type: "application/json" }), "deerflow-research-" + row.id + ".json");
    });
  const syncThread = () =>
    perform(async () => {
      const key = epoch.current;
      const threadId = threadValue(threadInput.trim());
      const saved = await p.save();
      if (!saved) throw new Error("请先完善研究，使其能保存，再读取会话。");
      const r = await request("/api/syncs", { method: "POST", body: JSON.stringify({ projectId: saved.id, id: crypto.randomUUID(), threadId }) });
      if (!isRecord(r)) throw new Error("读取结果无效。");
      if (r.status !== "completed" || typeof r.native !== "string") throw new Error(typeof r.error === "string" && r.error ? r.error : "会话读取失败。");
      if (key === epoch.current) d.applyNative(r.native, threadId);
    });

  const ready = Boolean(service?.reachable);
  const blockers = [
    !p.data.plan.confirmed ? "计划尚未确认" : "",
    !service?.configured ? "尚未设置服务地址" : !ready ? "服务尚未连通" : "",
    active || pendingCommand ? "已有研究在运行或回执待核对" : "",
    !model.trim() ? "请填写模型名称" : "",
  ].filter(Boolean);
  return (
    <div className="deerflow-panel">
      <section className={"service-card " + (ready ? "ok" : "warn")} aria-labelledby="service-title">
        <header>
          <h3 id="service-title">DeerFlow 服务</h3>
          <span className="chip">{!service ? "检查中" : ready ? "已连接" : service.configured ? "未连通" : "未设置"}</span>
          <button disabled={checking || !service?.configured} onClick={() => void check()}>
            <RefreshCw size={13} aria-hidden="true" />
            {checking ? "检查中…" : "重新检查"}
          </button>
        </header>
        <p role="status">
          {service?.url ? <code>{service.url}</code> : null} {service?.checked ? service.message : service?.configured ? "尚未检查连通性。" : "DeerFlow 是可选通道；不连接也能用本地检索完成整份研究。"}
        </p>
        {!ready ? (
          <div className="howto">
            <strong>启动方式（在 DeerFlow 仓库中执行）</strong>
            <ol>
              <li>
                <code>git clone https://github.com/bytedance/deer-flow.git &amp;&amp; cd deer-flow</code>
              </li>
              <li>
                <code>make setup</code> 选择模型与搜索工具，生成 <code>config.yaml</code> 与 <code>.env</code>
              </li>
              <li>
                <code>make docker-init &amp;&amp; make docker-start</code>，默认地址 <code>{service?.suggested ?? "http://localhost:2026"}</code>
              </li>
              <li>启用访问令牌时，在本工作台服务端设置 <code>DEERFLOW_TOKEN</code> 后重启。</li>
            </ol>
          </div>
        ) : null}
        {service && service.source !== "env" ? (
          <div className="row address">
            <label htmlFor="deerflow-url">服务地址</label>
            <input id="deerflow-url" name="deerflowUrl" type="url" autoComplete="off" spellCheck={false} value={address} onChange={(e) => setAddress(e.target.value)} />
            <button disabled={checking} onClick={() => void saveAddress()}>
              保存并检查
            </button>
          </div>
        ) : service ? (
          <p className="muted">地址来自启动环境变量 DEERFLOW_URL。</p>
        ) : null}
        {message ? <p className="step-error">{message}</p> : null}
      </section>

      <section className="submit-card" aria-labelledby="submit-title">
        <h3 id="submit-title">按确认计划提交研究</h3>
        <details>
          <summary>查看将要提交的研究简报</summary>
          <pre>{deerflowBrief(p.data)}</pre>
        </details>
        <div className="row">
          <label htmlFor="deerflow-model">模型</label>
          {service?.models.length ? (
            <select id="deerflow-model" value={model} onChange={(e) => p.setDraft((x) => ({ ...x, researchModel: e.target.value }))}>
              {[...new Set([model, ...service.models])].map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          ) : (
            <input id="deerflow-model" name="deerflowModel" autoComplete="off" value={model} onChange={(e) => p.setDraft((x) => ({ ...x, researchModel: e.target.value }))} />
          )}
          <button className="primary" disabled={busy || blockers.length > 0} onClick={() => void submit()}>
            <Play size={14} aria-hidden="true" />
            提交到 DeerFlow
          </button>
        </div>
        <p className="muted">{blockers.length ? "暂不能提交：" + blockers.join("；") + "。" : "后台运行独立于本页；回执丢失时只读核对，不会自动重发。会消耗 DeerFlow 侧的模型与工具配额。"}</p>
      </section>

      {runs.length ? (
        <section className="run-records" aria-labelledby="runs-title">
          <h3 id="runs-title">研究记录</h3>
          {runs.map((row) => (
            <article key={row.id} className={"run-record " + row.phase}>
              <header>
                <strong>{runLabels[row.phase] ?? row.phase}</strong>
                <small>
                  {row.model} · {new Date(row.createdAt).toLocaleString("zh-CN")}
                </small>
              </header>
              {row.error ? <p className="step-error">{row.error}</p> : null}
              {row.progress?.todos.length ? (
                <ul className="native-todos">
                  {row.progress.todos.map((t, i) => (
                    <li key={i} className={t.status}>
                      {t.status === "completed" ? "✓" : t.status === "in_progress" ? "›" : "·"} {t.content}
                    </li>
                  ))}
                </ul>
              ) : null}
              {row.progress?.last ? <p className="muted">最新：{row.progress.last}</p> : null}
              {row === watched && events.length ? (
                <div className="event-log" aria-live="polite">
                  <p className="stream-state">
                    <Radio size={12} aria-hidden="true" /> {connected ? "已连接进度事件流" : streamLabels[row.stream] || "事件流未连接"}
                  </p>
                  <ol>
                    {events.slice(-30).map((e) => (
                      <li key={e.seq} className={e.event}>
                        <time>{Number.isFinite(Date.parse(e.at)) ? time.format(new Date(e.at)) : ""}</time> {e.summary}
                      </li>
                    ))}
                  </ol>
                </div>
              ) : null}
              <div className="row">
                <button disabled={busy || !service?.configured} onClick={() => void refresh(row)}>
                  <RefreshCw size={13} aria-hidden="true" />
                  查询状态
                </button>
                {row.hasResult && row.phase === "success" ? (
                  <button className="primary" disabled={busy || !d.mutable} onClick={() => void load(row)}>
                    载入研究结果
                  </button>
                ) : null}
                <button disabled={busy} onClick={() => void receipt(row)}>
                  <ArrowDownToLine size={13} aria-hidden="true" />
                  任务记录
                </button>
              </div>
            </article>
          ))}
        </section>
      ) : null}

      <details className="sync-card">
        <summary>读取已有的 DeerFlow 会话（只读）</summary>
        <div className="row">
          <label htmlFor="thread-id">会话编号</label>
          <input id="thread-id" name="threadId" autoComplete="off" spellCheck={false} value={threadInput} onChange={(e) => p.setDraft((x) => ({ ...x, threadInput: e.target.value }))} />
          <button disabled={busy || !ready} onClick={() => void syncThread()}>
            读取会话
          </button>
        </div>
        <p className="muted">{ready ? "调用官方 GET /api/threads/{id}/state，不启动新研究。" : "服务连通后可读取；也可在「研究」菜单导入原生会话 JSON。"}</p>
      </details>
    </div>
  );
}
