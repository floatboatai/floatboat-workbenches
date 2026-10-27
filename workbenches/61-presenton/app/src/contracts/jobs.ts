import { isRecord } from "./project.ts";
export type JobState =
  | "submitting"
  | "unknown"
  | "pending"
  | "completed"
  | "error"
  | "stopped";
export type Artifact = { id: string; bytes: number; format: "pptx" | "pdf" };
export type Job = {
  id: string;
  projectId: string;
  title: string;
  kind: "generate" | "export" | "import";
  state: JobState;
  taskId: string;
  presentationId: string;
  path: string;
  createdAt: string;
  updatedAt: string;
  message: string;
  artifact: Artifact | null;
};
export function jobValue(v: unknown): Job {
  if (
    !isRecord(v) ||
    ![
      "submitting",
      "unknown",
      "pending",
      "completed",
      "error",
      "stopped",
    ].includes(String(v.state)) ||
    !["generate", "export", "import"].includes(String(v.kind))
  )
    throw new Error("制作记录格式无效。");
  for (const key of [
    "id",
    "projectId",
    "title",
    "taskId",
    "presentationId",
    "path",
    "createdAt",
    "updatedAt",
    "message",
  ])
    if (typeof v[key] !== "string") throw new Error("制作记录格式无效。");
  if (
    v.artifact !== null &&
    (!isRecord(v.artifact) ||
      typeof v.artifact.id !== "string" ||
      typeof v.artifact.bytes !== "number" ||
      !["pptx", "pdf"].includes(String(v.artifact.format)))
  )
    throw new Error("文件记录格式无效。");
  return v as Job;
}
export const states: Record<JobState, string> = {
  submitting: "正在提交",
  unknown: "提交结果待确认",
  pending: "正在生成",
  completed: "已完成",
  error: "制作失败",
  stopped: "已停止跟踪",
};
