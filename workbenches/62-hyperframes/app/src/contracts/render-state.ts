import { isRecord, boundedText } from "./project.ts";
export const states = [
  "submitting",
  "unknown",
  "queued",
  "running",
  "completed",
  "failed",
  "cancelled",
  "interrupted",
] as const;
export type RenderState = (typeof states)[number];
export type RendererJob = {
  id: string;
  state: RenderState;
  createdAt: string;
  error: string;
};
export type RenderJob = RendererJob & { projectId: string };
export const terminal = (state: string) =>
  ["completed", "failed", "cancelled", "interrupted"].includes(state);
export function remoteJob(v: unknown, expectedId?: string): RendererJob {
  if (
    !isRecord(v) ||
    typeof v.id !== "string" ||
    !/^[0-9a-f-]{36}$/.test(v.id) ||
    (expectedId !== undefined && v.id !== expectedId) ||
    typeof v.state !== "string" ||
    !states.includes(v.state as RenderState) ||
    typeof v.createdAt !== "string" ||
    !Number.isFinite(Date.parse(v.createdAt))
  )
    throw new Error("渲染任务响应无效。");
  return {
    id: v.id,
    state: v.state as RenderState,
    createdAt: v.createdAt,
    error: boundedText(v.error ?? "", 1000),
  };
}
export function jobValue(v: unknown): RenderJob {
  const j = remoteJob(v);
  if (!isRecord(v) || typeof v.projectId !== "string")
    throw new Error("渲染项目响应无效。");
  return { ...j, projectId: v.projectId };
}
export function nextState(current: RenderState, next: RenderState) {
  if (terminal(current)) return current;
  if (
    current === "running" &&
    ["queued", "submitting", "unknown"].includes(next)
  )
    return current;
  if (current === "queued" && ["submitting", "unknown"].includes(next))
    return current;
  return next;
}
export function mergeJobs(previous: RenderJob[], incoming: RenderJob[]) {
  const map = new Map(previous.map((j) => [j.id, j]));
  for (const j of incoming) {
    const old = map.get(j.id);
    map.set(j.id, old && nextState(old.state, j.state) !== j.state ? old : j);
  }
  return [...map.values()]
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 20);
}
