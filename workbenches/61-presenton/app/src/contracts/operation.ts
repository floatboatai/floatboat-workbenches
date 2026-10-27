import { boundedText, isRecord } from "./project.ts";
import type { Job } from "./jobs.ts";

const identifier = (value: unknown): string => {
  const id = boundedText(value, 100);
  if (!/^[A-Za-z0-9_-]{1,100}$/.test(id)) throw new Error("制作标识无效。");
  return id;
};

export type LocalOperation = {
  id: string;
  projectId: string;
  title: string;
  kind: "generate" | "export";
  createdAt: string;
};
export function localOperation(value: unknown): LocalOperation {
  if (!isRecord(value) || !["generate", "export"].includes(String(value.kind)))
    throw new Error("制作恢复记录无效。");
  const createdAt = boundedText(value.createdAt, 60);
  if (!Number.isFinite(Date.parse(createdAt)))
    throw new Error("制作恢复时间无效。");
  return {
    id: identifier(value.id),
    projectId: identifier(value.projectId),
    title: boundedText(value.title, 120),
    kind: value.kind === "export" ? "export" : "generate",
    createdAt,
  };
}
export function unresolvedOperation(
  operation: LocalOperation,
  state: "submitting" | "unknown" = "unknown",
): Job {
  return {
    ...operation,
    state,
    taskId: "",
    presentationId: "",
    path: "",
    updatedAt: operation.createdAt,
    artifact: null,
    message:
      state === "submitting"
        ? "正在提交制作。操作记录已保留，请等待确认。"
        : "此操作的提交结果尚未确认。请先查询操作记录；重新制作需要确认，可能产生额外费用。",
  };
}
export function mergeJobs(previous: Job[], incoming: Job[]): Job[] {
  const next = new Map(previous.map((job) => [job.id, job]));
  for (const job of incoming) next.set(job.id, job);
  return [...next.values()].sort((a, b) =>
    b.createdAt.localeCompare(a.createdAt),
  );
}
export function terminalJob(job: Job): boolean {
  return job.state === "completed" || job.state === "error";
}
