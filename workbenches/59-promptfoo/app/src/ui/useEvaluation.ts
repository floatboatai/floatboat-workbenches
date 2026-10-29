// ABOUTME: 执行环境状态（本机引擎、Floatboat 模型、官方执行器）与评测任务的提交、轮询、停止。
import { useCallback, useEffect, useRef, useState } from "react";
import { request } from "./requests";
import { isRecord } from "../contracts/project";
import type { RunRef } from "../contracts/evaluation";
import { loadRun } from "./files";

export interface HostStatus {
  available: boolean;
  status: string;
  model: string;
  message: string;
  checking: boolean;
}
export interface RunnerStatus {
  connected: boolean;
  configured: boolean;
  allowJavascript: boolean;
  message: string;
  start: string;
  checking: boolean;
}
export interface TaskState {
  id: string;
  kind: "local" | "official";
  state: string;
  done: number;
  total: number;
  hostCalls: number;
  error: string;
  run: RunRef | null;
}
const terminal = new Set(["completed", "failed", "cancelled", "interrupted"]);

export function useEnvironment() {
  const [host, setHost] = useState<HostStatus>({ available: false, status: "checking", model: "", message: "正在检查 Floatboat…", checking: true });
  const [runner, setRunner] = useState<RunnerStatus>({ connected: false, configured: false, allowJavascript: false, message: "正在检查官方执行器…", start: "", checking: true });
  const checkHost = useCallback(async () => {
    setHost((h) => ({ ...h, checking: true }));
    try {
      const v = await request("/api/host-status");
      if (!isRecord(v)) throw new Error();
      setHost({ available: v.available === true, status: String(v.status ?? ""), model: String(v.model ?? ""), message: String(v.message ?? ""), checking: false });
    } catch {
      setHost({ available: false, status: "offline", model: "", message: "无法检查 Floatboat 状态。回放、echo 与脚本列不受影响。", checking: false });
    }
  }, []);
  const checkRunner = useCallback(async () => {
    setRunner((r) => ({ ...r, checking: true }));
    try {
      const v = await request("/api/runner");
      if (!isRecord(v)) throw new Error();
      setRunner({
        connected: v.connected === true,
        configured: v.configured === true,
        allowJavascript: v.allowJavascript === true,
        message: String(v.message ?? ""),
        start: String(v.start ?? ""),
        checking: false,
      });
    } catch {
      setRunner((r) => ({ ...r, connected: false, message: "无法检查官方执行器。", checking: false }));
    }
  }, []);
  useEffect(() => {
    void checkHost();
    void checkRunner();
  }, [checkHost, checkRunner]);
  return { host, runner, checkHost, checkRunner };
}

function taskValue(v: unknown, kind: "local" | "official"): TaskState {
  if (!isRecord(v) || typeof v.id !== "string" || typeof v.state !== "string") throw new Error("任务响应无效。");
  return {
    id: v.id,
    kind,
    state: v.state,
    done: typeof v.done === "number" ? v.done : 0,
    total: typeof v.total === "number" ? v.total : 0,
    hostCalls: typeof v.hostCalls === "number" ? v.hostCalls : 0,
    error: typeof v.error === "string" ? v.error : "",
    run: isRecord(v.run) && typeof v.run.id === "string" ? (v.run as unknown as RunRef) : null,
  };
}

/**
 * 任务标识先写入工作副本草稿再提交；刷新后按原 ID 继续查询，不会重复提交。
 * 完成时把运行加入项目；失败、停止或中断时保留说明。
 */
export function useTask(opts: {
  pending: { id: string; kind: "local" | "official"; name: string } | null;
  documentKey: string;
  onDone: (run: RunRef, kind: "local" | "official") => void;
  onEnd: (message: string) => void;
}) {
  const [task, setTask] = useState<TaskState | null>(null);
  const ref = useRef(opts);
  ref.current = opts;
  const pendingId = opts.pending?.id ?? "",
    kind = opts.pending?.kind ?? "local";
  useEffect(() => {
    if (!pendingId) {
      setTask(null);
      return;
    }
    let alive = true,
      timer: ReturnType<typeof setTimeout> | undefined,
      misses = 0;
    const key = opts.documentKey;
    const poll = async () => {
      try {
        const v = taskValue(await request(kind === "local" ? `/api/evaluations/${pendingId}` : `/api/official-jobs/${pendingId}`), kind);
        if (!alive || ref.current.documentKey !== key) return;
        setTask(v);
        misses = 0;
        if (v.state === "completed" && v.run) {
          await loadRun(v.run.id).catch(() => undefined);
          if (alive && ref.current.documentKey === key) ref.current.onDone(v.run, kind);
          return;
        }
        if (terminal.has(v.state)) {
          ref.current.onEnd(
            v.error || (v.state === "cancelled" ? "评测已停止。" : "评测没有完成。"),
          );
          return;
        }
        timer = setTimeout(poll, v.state === "queued" ? 500 : 700);
      } catch (e) {
        if (!alive) return;
        if (isRecord(e) && e.status === 404) {
          setTask({ id: pendingId, kind, state: "not-submitted", done: 0, total: 0, hostCalls: 0, error: "提交尚未到达服务端。", run: null });
          timer = setTimeout(poll, 1500);
          return;
        }
        misses++;
        timer = setTimeout(poll, Math.min(8000, 1000 * misses));
      }
    };
    timer = setTimeout(poll, 250);
    return () => {
      alive = false;
      if (timer) clearTimeout(timer);
    };
  }, [pendingId, kind, opts.documentKey]);
  return task;
}
