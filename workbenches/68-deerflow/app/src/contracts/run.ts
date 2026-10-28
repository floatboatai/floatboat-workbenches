import { boundedText, isRecord } from "./project.ts";
import { threadValue } from "./research.ts";
export const DEFAULT_MODEL = "gemini-3.8-flash";
export const remoteStatuses = [
  "pending",
  "running",
  "success",
  "error",
  "timeout",
  "interrupted",
];
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
  createdAt: string;
  updatedAt: string;
};
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
export function researchRunValue(v: unknown): ResearchRun {
  if (!isRecord(v) || typeof v.hasResult !== "boolean")
    throw new Error("研究记录格式无效。");
  for (const key of [
    "id",
    "projectId",
    "threadId",
    "prompt",
    "model",
    "origin",
    "phase",
    "runId",
    "runStatus",
    "error",
    "native",
    "createdAt",
    "updatedAt",
  ])
    if (typeof v[key] !== "string") throw new Error("研究记录缺少字段。");
  return v as unknown as ResearchRun;
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
