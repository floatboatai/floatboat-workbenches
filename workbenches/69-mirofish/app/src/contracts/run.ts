import { isRecord } from "./project.ts";
export const statuses = [
  "idle",
  "starting",
  "running",
  "paused",
  "stopping",
  "stopped",
  "completed",
  "failed",
] as const;
export type RunStatus = (typeof statuses)[number];
export interface Run {
  simulationId: string;
  status: RunStatus;
  startedAt: string | null;
  updatedAt: string | null;
  round: number;
  total: number;
  actions: number;
  error: string | null;
}
export interface CommandInput {
  id: string;
  simulationId: string;
  action: "start" | "stop";
  platform: "twitter" | "reddit" | "parallel";
  rounds: number;
  startedAt: string | null;
}
export interface Command extends CommandInput {
  phase: "submitting" | "unknown" | "acknowledged" | "observed" | "rejected";
  run: Run | null;
  message: string;
}
export const terminal = (s: RunStatus) =>
  ["stopped", "completed", "failed"].includes(s);
export function runValue(v: unknown, id: string): Run {
  if (
    !isRecord(v) ||
    v.simulation_id !== id ||
    !statuses.includes(v.runner_status as RunStatus)
  )
    throw new Error("上游运行身份或状态无效");
  const stamp = (x: unknown) =>
    x === null || x === undefined
      ? null
      : typeof x === "string" &&
          x.length < 100 &&
          Number.isFinite(Date.parse(x))
        ? x
        : (() => {
            throw new Error("运行时间无效");
          })();
  const n = (x: unknown) =>
    typeof x === "number" && Number.isFinite(x) && x >= 0 ? x : 0;
  const startedAt = stamp(v.started_at);
  if (v.runner_status !== "idle" && !startedAt)
    throw new Error("运行缺少 started_at，无法确认本次身份");
  return {
    simulationId: id,
    status: v.runner_status as RunStatus,
    startedAt,
    updatedAt: stamp(v.updated_at),
    round: n(v.current_round),
    total: n(v.total_rounds),
    actions: n(v.total_actions_count),
    error: typeof v.error === "string" ? v.error.slice(0, 2000) : null,
  };
}
export function mergeRun(old: Run | null, next: Run): Run {
  if (!old || old.simulationId !== next.simulationId) return next;
  if (old.startedAt !== next.startedAt) {
    if (!next.startedAt) return old;
    if (
      old.startedAt &&
      Date.parse(next.startedAt) <= Date.parse(old.startedAt)
    )
      return old;
    return next;
  }
  if (terminal(old.status)) return old;
  if (
    old.updatedAt &&
    next.updatedAt &&
    Date.parse(next.updatedAt) < Date.parse(old.updatedAt)
  )
    return old;
  if (
    old.status === "stopping" &&
    ["starting", "running", "paused"].includes(next.status)
  )
    return old;
  return {
    ...next,
    round: Math.max(old.round, next.round),
    actions: Math.max(old.actions, next.actions),
  };
}
export function commandInput(v: unknown): CommandInput {
  if (
    !isRecord(v) ||
    typeof v.id !== "string" ||
    !/^[a-f0-9-]{36}$/.test(v.id) ||
    typeof v.simulationId !== "string" ||
    !/^[a-zA-Z0-9_-]{1,100}$/.test(v.simulationId) ||
    !["start", "stop"].includes(String(v.action)) ||
    !["twitter", "reddit", "parallel"].includes(String(v.platform)) ||
    !Number.isInteger(v.rounds) ||
    Number(v.rounds) < 1 ||
    Number(v.rounds) > 100
  )
    throw new Error("运行命令无效");
  if (
    v.startedAt !== null &&
    (typeof v.startedAt !== "string" ||
      !Number.isFinite(Date.parse(v.startedAt)))
  )
    throw new Error("运行身份无效");
  if (
    (v.action === "start" && v.startedAt !== null) ||
    (v.action === "stop" && !v.startedAt)
  )
    throw new Error("启动与停止的运行身份不匹配");
  return {
    id: v.id,
    simulationId: v.simulationId,
    action: v.action as "start" | "stop",
    platform: v.platform as CommandInput["platform"],
    rounds: Number(v.rounds),
    startedAt: v.startedAt as string | null,
  };
}
export function importedDraft(value: unknown): Record<string, unknown> {
  const draft = isRecord(value) ? { ...value } : {};
  if (draft.pendingRun !== undefined) {
    draft.importedRun = draft.pendingRun;
    delete draft.pendingRun;
  }
  delete draft.runSelection;
  return draft;
}

export function mergeCommand(old: Command | null, next: Command): Command {
  if (!old || old.id !== next.id) return next;
  return {
    ...next,
    phase: old.phase === "acknowledged" ? "acknowledged" : next.phase,
    run: next.run ? mergeRun(old.run, next.run) : old.run,
  };
}
