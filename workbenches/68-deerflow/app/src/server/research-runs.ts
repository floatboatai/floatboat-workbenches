// ABOUTME: DeerFlow 研究运行账本：持久命令先于远端写入、只读恢复、加入官方SSE事件流并转为可回放的进度事件。
import { randomUUID } from "node:crypto";
import { EventEmitter } from "node:events";
import type { DatabaseSync } from "node:sqlite";
import { isRecord } from "../contracts/project.ts";
import { runInput, runPayload, remoteRun, activePhases, type ResearchRun, type RunEvent, type RunProgress } from "../contracts/run.ts";
import { compactNative, nativeValue } from "../contracts/native.ts";
import { StoreError } from "./store.ts";
import { gateway, configuredOrigin, GatewayError, joinStream, type SseFrame } from "./research-gateway.ts";
import { fetchNative } from "./deerflow.ts";

type Gateway = typeof gateway;
type Stream = (threadId: string, runId: string, lastEventId: string, signal: AbortSignal) => Promise<AsyncIterable<SseFrame>>;
export type RunOptions = { stream?: Stream; sleep?: (ms: number) => Promise<void>; follow?: boolean; maxReconnects?: number };
const MAX_EVENTS = 400;
const roleLabel = (r: unknown) => (r === "human" || r === "user" ? "研究要求" : r === "tool" ? "工具返回" : r === "ai" || r === "assistant" ? "助手" : "消息");
const preview = (s: string, n = 140) => {
  const t = s.replace(/\s+/g, " ").trim();
  return t.length > n ? t.slice(0, n) + "…" : t;
};
function contentText(m: Record<string, unknown>) {
  if (typeof m.content === "string") return m.content;
  if (Array.isArray(m.content)) return m.content.map((b) => (isRecord(b) && typeof b.text === "string" ? b.text : "")).join(" ");
  return "";
}
/** Progress derived from a `values` frame: todo list, message count and the latest visible message. */
export function progressOf(values: unknown): RunProgress | null {
  if (!isRecord(values)) return null;
  const messages = Array.isArray(values.messages) ? values.messages.filter(isRecord) : [];
  const visible = messages.filter((m) => !(isRecord(m.additional_kwargs) && m.additional_kwargs.hide_from_ui === true));
  const last = visible.at(-1);
  const todos = Array.isArray(values.todos) ? values.todos.filter(isRecord) : [];
  return {
    todos: todos.slice(0, 100).map((t) => ({ content: String(t.content ?? "").slice(0, 500), status: String(t.status ?? "").slice(0, 40) })),
    messages: messages.length,
    last: last ? `${roleLabel(last.type ?? last.role)}：${preview(contentText(last), 300)}` : "",
  };
}
/** Human-readable line for one upstream SSE frame. */
export function summarizeFrame(frame: SseFrame): string {
  let data: unknown = null;
  try {
    data = frame.data ? JSON.parse(frame.data) : null;
  } catch {
    data = frame.data;
  }
  if (frame.event === "metadata") return "运行已开始" + (isRecord(data) && typeof data.run_id === "string" ? `（${data.run_id}）` : "");
  if (frame.event === "values") {
    const p = progressOf(data);
    if (!p) return "状态已更新";
    const done = p.todos.filter((t) => t.status === "completed").length;
    return `状态更新：${p.messages} 条消息${p.todos.length ? `，任务 ${done}/${p.todos.length}` : ""}${p.last ? "。" + preview(p.last, 160) : ""}`;
  }
  if (frame.event === "updates" && isRecord(data)) {
    const nodes = Object.keys(data).slice(0, 4);
    const parts = nodes.map((n) => {
      const u = data[n];
      const ms = isRecord(u) && Array.isArray(u.messages) ? u.messages.filter(isRecord) : [];
      const m = ms.at(-1);
      return m ? `${n}：${roleLabel(m.type ?? m.role)} ${preview(contentText(m), 100)}` : n;
    });
    return "节点更新 · " + (parts.join("；") || "（无内容）");
  }
  if (frame.event === "error") return "上游报告错误：" + preview(isRecord(data) ? String(data.message ?? data.error ?? JSON.stringify(data)) : String(data), 300);
  if (frame.event === "end") return "事件流结束";
  if (frame.event === "gap") return "上游事件缓存已过期，改为读取完整状态";
  return `${frame.event}：${preview(typeof data === "string" ? data : JSON.stringify(data), 160)}`;
}

export function createResearchRuns(
  db: DatabaseSync,
  http: Gateway = gateway,
  origin: () => string = configuredOrigin,
  native: (id: string) => Promise<string> = fetchNative,
  options: RunOptions = {},
) {
  const stream: Stream = options.stream ?? ((t, r, last, signal) => joinStream(t, r, last, signal));
  const sleep = options.sleep ?? ((ms) => new Promise<void>((r) => setTimeout(r, ms)));
  const follow = options.follow ?? true;
  const flights = new Map<string, Promise<unknown>>();
  const followers = new Map<string, AbortController>();
  const changes = new EventEmitter();
  changes.setMaxListeners(200);
  const emit = (id: string) => changes.emit(id);
  const read = (id: string): ResearchRun => {
    const r = db.prepare("SELECT * FROM deerflow_research_runs WHERE id=?").get(id);
    if (!r) throw new StoreError(404, "研究记录不存在。");
    let progress: RunProgress | null = null;
    if (r.live_native)
      try {
        progress = progressOf(JSON.parse(String(r.live_native)));
      } catch {
        progress = null;
      }
    return {
      id: String(r.id),
      projectId: String(r.project_id),
      threadId: String(r.thread_id),
      prompt: String(r.prompt),
      model: String(r.model),
      origin: String(r.origin),
      phase: String(r.phase),
      runId: String(r.run_id),
      runStatus: String(r.run_status),
      error: String(r.error),
      native: String(r.native),
      hasResult: Boolean(r.native),
      stream: String(r.stream_status ?? ""),
      progress,
      createdAt: String(r.created_at),
      updatedAt: String(r.updated_at),
    };
  };
  const summary = (id: string) => {
    const r = read(id);
    return { ...r, prompt: r.prompt.slice(0, 400), native: "" };
  };
  const update = (id: string, phase: string, error = "") => {
    db.prepare("UPDATE deerflow_research_runs SET phase=?,error=?,updated_at=? WHERE id=?").run(phase, error.slice(0, 500), new Date().toISOString(), id);
    emit(id);
  };
  const setStream = (id: string, status: string) => {
    db.prepare("UPDATE deerflow_research_runs SET stream_status=? WHERE id=?").run(status, id);
    emit(id);
  };
  function addEvent(id: string, event: string, text: string, upstreamId = "") {
    const count = Number(db.prepare("SELECT COUNT(*) AS n FROM deerflow_run_events WHERE run_id=?").get(id)?.n ?? 0);
    if (count >= MAX_EVENTS && (event === "values" || event === "updates")) return;
    const seq = Number(db.prepare("SELECT COALESCE(MAX(seq),0)+1 AS n FROM deerflow_run_events WHERE run_id=?").get(id)?.n ?? 1);
    db.prepare("INSERT INTO deerflow_run_events(run_id,seq,upstream_id,event,summary,created_at) VALUES(?,?,?,?,?,?)").run(id, seq, upstreamId.slice(0, 200), event.slice(0, 60), text.slice(0, 1000), new Date().toISOString());
    emit(id);
  }
  db.prepare("UPDATE deerflow_research_runs SET phase='unknown',error='服务重启，提交回执待核对；不会自动重新发送。' WHERE phase IN ('creating_thread','submitting')").run();
  async function accept(id: string, value: unknown) {
    const r = read(id),
      receipt = remoteRun(value, r.threadId, id);
    if (r.runId && r.runId !== receipt.id) throw new Error("上游运行编号发生变化，拒绝替换原研究记录。");
    db.prepare("UPDATE deerflow_research_runs SET run_id=?,run_status=?,phase=?,error='',updated_at=? WHERE id=?").run(receipt.id, receipt.status, receipt.status, new Date().toISOString(), id);
    emit(id);
    if (receipt.status === "success" && !r.native) {
      try {
        if (origin() !== r.origin) throw new Error("请恢复原上游地址再读取研究结果。");
        const text = compactNative(await native(r.threadId));
        nativeValue(text);
        db.prepare("UPDATE deerflow_research_runs SET native=?,updated_at=? WHERE id=?").run(text, new Date().toISOString(), id);
        emit(id);
      } catch (e) {
        update(id, "success", e instanceof Error ? e.message : "结果读取失败，可查询状态重试读取。");
      }
    }
  }
  async function submit(id: string) {
    let r = read(id);
    try {
      const thread = await http("/api/threads", "POST", { thread_id: r.threadId, metadata: { floatboat_operation_id: id } }, undefined, r.origin);
      if (!isRecord(thread) || thread.thread_id !== r.threadId || !isRecord(thread.metadata) || thread.metadata.floatboat_operation_id !== id)
        throw new Error("上游线程回执不匹配，未继续提交研究。");
      update(id, "submitting");
      r = read(id);
      await accept(id, await http(`/api/threads/${r.threadId}/runs`, "POST", runPayload(id, r.prompt, r.model), id, r.origin));
      ensureFollow(id);
    } catch (e) {
      const rejected = e instanceof GatewayError && [400, 401, 403, 404, 422].includes(e.status);
      update(id, rejected ? "rejected" : "unknown", e instanceof Error ? e.message : "回执不明，等待只读核对。");
    }
  }
  /** Read-only status check: GET run detail, or GET run list matched by operation ID. */
  async function check(id: string) {
    const r = read(id);
    try {
      if (origin() !== r.origin) throw new Error("上游地址已改变，恢复原地址后再核对。");
      if (r.runId) await accept(id, await http(`/api/threads/${r.threadId}/runs/${r.runId}`, "GET", undefined, undefined, r.origin));
      else if (activePhases.includes(r.phase)) {
        const values = await http(`/api/threads/${r.threadId}/runs`, "GET", undefined, undefined, r.origin);
        if (!Array.isArray(values) || values.length > 100) throw new Error("上游运行列表无效，不能确认提交状态。");
        const matches = values.filter((v) => isRecord(v) && isRecord(v.metadata) && v.metadata.floatboat_operation_id === id);
        if (matches.length === 1) await accept(id, matches[0]);
        else if (matches.length > 1) throw new Error("上游存在多个相同命令记录，请人工核对。");
        else update(id, "unknown", "尚未找到匹配的运行，不代表未执行。不会自动重发；请继续只读刷新或到上游核对。");
      }
    } catch (e) {
      update(id, r.runId ? r.phase : "unknown", e instanceof Error ? e.message : "状态查询失败，原记录保留。");
    }
  }
  /** Consume one join stream: whether the upstream signalled the end, and how many frames arrived. */
  async function consume(id: string, signal: AbortSignal) {
    let count = 0;
    const r = read(id);
    const last = String(db.prepare("SELECT last_event_id FROM deerflow_research_runs WHERE id=?").get(id)?.last_event_id ?? "");
    const frames = await stream(r.threadId, r.runId, last, signal);
    setStream(id, "connected");
    for await (const frame of frames) {
      if (signal.aborted) return { ended: false, count };
      count++;
      if (frame.id) db.prepare("UPDATE deerflow_research_runs SET last_event_id=? WHERE id=?").run(frame.id.slice(0, 200), id);
      if (frame.event === "values" && frame.data.length < 800000)
        try {
          const values: unknown = JSON.parse(frame.data);
          if (isRecord(values)) db.prepare("UPDATE deerflow_research_runs SET live_native=?,updated_at=? WHERE id=?").run(JSON.stringify(values), new Date().toISOString(), id);
        } catch {
          /* progress stays at the previous snapshot */
        }
      addEvent(id, frame.event, summarizeFrame(frame), frame.id);
      if (frame.event === "end" || frame.event === "gap") return { ended: true, count };
    }
    return { ended: false, count };
  }
  function ensureFollow(id: string) {
    if (!follow || followers.has(id)) return;
    const r = read(id);
    if (!r.runId || !["pending", "running"].includes(r.phase)) return;
    const controller = new AbortController();
    followers.set(id, controller);
    void (async () => {
      let failures = 0;
      try {
        while (!controller.signal.aborted) {
          const current = read(id);
          if (!["pending", "running"].includes(current.phase)) break;
          try {
            const { ended, count } = await consume(id, controller.signal);
            // Progress resets the backoff; an immediate end while the run still looks active does not.
            failures = ended && count > 1 ? 0 : failures + 1;
            if (!ended) addEvent(id, "stream", "上游事件流提前关闭，读取运行状态后重连");
          } catch (e) {
            failures++;
            addEvent(id, "stream", "事件流连接失败：" + (e instanceof Error ? e.message : "未知错误").slice(0, 300));
            setStream(id, "retrying");
          }
          await check(id);
          if (!["pending", "running"].includes(read(id).phase)) break;
          if (failures > (options.maxReconnects ?? 6)) {
            setStream(id, "paused");
            return;
          }
          await sleep(Math.min(30000, 1000 * 2 ** failures));
        }
        setStream(id, "ended");
      } finally {
        followers.delete(id);
        emit(id);
      }
    })();
  }
  return {
    read,
    summary,
    events(id: string, after = 0): RunEvent[] {
      return db
        .prepare("SELECT seq,event,summary,created_at FROM deerflow_run_events WHERE run_id=? AND seq>? ORDER BY seq LIMIT 500")
        .all(id, after)
        .map((e) => ({ seq: Number(e.seq), event: String(e.event), summary: String(e.summary), at: String(e.created_at) }));
    },
    subscribe(id: string, fn: () => void) {
      changes.on(id, fn);
      return () => void changes.off(id, fn);
    },
    following: (id: string) => followers.has(id),
    list(projectId: string) {
      return db
        .prepare("SELECT id FROM deerflow_research_runs WHERE project_id=? ORDER BY created_at DESC LIMIT 30")
        .all(projectId)
        .map((x) => summary(String(x.id)));
    },
    /** Rejoin event streams for runs that were active when the service stopped (read-only). */
    resume() {
      for (const row of db.prepare("SELECT id FROM deerflow_research_runs WHERE run_id<>'' AND phase IN ('pending','running')").all()) ensureFollow(String(row.id));
    },
    stop() {
      for (const c of followers.values()) c.abort();
    },
    start(projectId: string, id: string, prompt: unknown, model: unknown) {
      const input = runInput(prompt, model);
      if (!/^[0-9a-f-]{36}$/i.test(id)) throw new Error("研究命令编号无效。");
      if (db.prepare("SELECT id FROM deerflow_research_runs WHERE id=?").get(id)) {
        const r = read(id);
        if (r.projectId !== projectId || r.prompt !== input.prompt || r.model !== input.model) throw new StoreError(409, "同一研究命令不能改变输入。");
        return summary(id);
      }
      const source = origin();
      if (!db.prepare("SELECT id FROM projects WHERE id=?").get(projectId)) throw new StoreError(404, "请先保存研究项目。");
      if (db.prepare("SELECT id FROM deerflow_research_runs WHERE project_id=? AND phase IN ('creating_thread','submitting','unknown','pending','running')").get(projectId))
        throw new StoreError(409, "这个项目已有运行或待核对的研究；请先刷新并核对，避免重复任务。");
      const now = new Date().toISOString();
      db.prepare("INSERT INTO deerflow_research_runs(id,project_id,thread_id,prompt,model,origin,phase,created_at,updated_at) VALUES(?,?,?,?,?,?,'creating_thread',?,?)").run(id, projectId, randomUUID(), input.prompt, input.model, source, now, now);
      addEvent(id, "command", "研究命令已保存，正在创建上游会话");
      const task = submit(id);
      flights.set(id, task);
      void task.finally(() => flights.delete(id));
      return summary(id);
    },
    async refresh(id: string) {
      if (flights.has(id)) return summary(id);
      const job = check(id);
      flights.set(id, job);
      try {
        await job;
      } finally {
        flights.delete(id);
      }
      ensureFollow(id);
      return summary(id);
    },
  };
}
