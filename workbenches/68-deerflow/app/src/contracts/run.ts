// ABOUTME: DeerFlow 研究运行：提交载荷、上游回执校验、持久记录与流式进度事件的跨端契约。
import { boundedText, isRecord } from "./project.ts";
import { threadValue } from "./native.ts";

export const DEFAULT_MODEL = "gemini-3.8-flash";
export const STREAM_MODES = ["values", "updates"];
export const remoteStatuses = ["pending", "running", "success", "error", "timeout", "interrupted"];
export const activePhases = ["creating_thread", "submitting", "unknown", "pending", "running"];
export type RunProgress = { todos: { content: string; status: string }[]; messages: number; last: string };
export type ResearchRun = {
  id: string;
  projectId: string;
  threadId: string;
  prompt: string;
  model: string;
  origin: string;
  phase: string;
  runId: string;
  runStatus: string;
  error: string;
  native: string;
  hasResult: boolean;
  stream: string;
  progress: RunProgress | null;
  createdAt: string;
  updatedAt: string;
};
export type RunEvent = { seq: number; event: string; summary: string; at: string };

export function runInput(prompt: unknown, model: unknown) {
  const p = boundedText(prompt, 30000).trim(),
    m = boundedText(model, 150).trim();
  if (!p || !m) throw new Error("请填写研究简报和上游模型名称。");
  return { prompt: p, model: m };
}
export function runPayload(id: string, prompt: string, model: string) {
  return {
    input: { messages: [{ id, role: "user", content: prompt }] },
    context: { model_name: model },
    metadata: { floatboat_operation_id: id },
    stream_mode: STREAM_MODES,
    multitask_strategy: "reject",
    on_disconnect: "continue",
  };
}
export function remoteRun(v: unknown, threadId: string, operationId: string) {
  if (
    !isRecord(v) ||
    typeof v.run_id !== "string" ||
    v.run_id.length > 200 ||
    !/^[a-zA-Z0-9_-]+$/.test(v.run_id) ||
    v.thread_id !== threadValue(threadId) ||
    !remoteStatuses.includes(String(v.status)) ||
    !isRecord(v.metadata) ||
    v.metadata.floatboat_operation_id !== operationId
  )
    throw new Error("上游运行回执与本次研究不一致，保留记录等待核对。");
  return { id: v.run_id, status: String(v.status) };
}
function progressValue(v: unknown): RunProgress | null {
  if (!isRecord(v) || !Array.isArray(v.todos)) return null;
  return {
    todos: v.todos
      .filter((t): t is Record<string, unknown> => isRecord(t))
      .slice(0, 100)
      .map((t) => ({ content: String(t.content ?? "").slice(0, 500), status: String(t.status ?? "").slice(0, 40) })),
    messages: typeof v.messages === "number" ? v.messages : 0,
    last: typeof v.last === "string" ? v.last.slice(0, 400) : "",
  };
}
export function researchRunValue(v: unknown): ResearchRun {
  if (!isRecord(v) || typeof v.hasResult !== "boolean") throw new Error("研究记录格式无效。");
  for (const key of ["id", "projectId", "threadId", "prompt", "model", "origin", "phase", "runId", "runStatus", "error", "native", "createdAt", "updatedAt"])
    if (typeof v[key] !== "string") throw new Error("研究记录缺少字段。");
  return { ...(v as unknown as ResearchRun), stream: typeof v.stream === "string" ? v.stream : "", progress: progressValue(v.progress) };
}
export function runEventValue(v: unknown): RunEvent {
  if (!isRecord(v) || typeof v.seq !== "number") throw new Error("进度事件无效。");
  return { seq: v.seq, event: boundedText(v.event, 60), summary: boundedText(v.summary, 1000), at: boundedText(v.at, 40) };
}
export const runLabels: Record<string, string> = {
  creating_thread: "正在创建研究会话",
  submitting: "正在提交研究",
  unknown: "回执待核对",
  pending: "等待运行",
  running: "研究中",
  success: "研究完成",
  error: "研究失败",
  timeout: "运行超时",
  interrupted: "需要在上游继续",
  rejected: "提交被拒绝",
};
export const streamLabels: Record<string, string> = {
  connected: "实时事件已连接",
  retrying: "事件流中断，正在重连",
  paused: "事件流已暂停，点“查询状态”继续",
  ended: "事件流已结束",
  "": "",
};
