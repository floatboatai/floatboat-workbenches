import { isRecord } from "./project.ts";
export const states = [
  "preparing",
  "submitting",
  "uncertain",
  "pending",
  "running",
  "success",
  "failure",
  "paused",
] as const;
export type JobState = (typeof states)[number];
export interface Job {
  id: string;
  filename: string;
  inputHash: string;
  taskId: string | null;
  state: JobState;
  message: string;
  createdAt: string;
  updatedAt: string;
}
export function jobValue(v: unknown): Job {
  if (
    !isRecord(v) ||
    typeof v.id !== "string" ||
    typeof v.filename !== "string" ||
    typeof v.inputHash !== "string" ||
    !(v.taskId === null || typeof v.taskId === "string") ||
    !states.includes(v.state as JobState) ||
    typeof v.message !== "string" ||
    typeof v.createdAt !== "string" ||
    typeof v.updatedAt !== "string"
  )
    throw new Error("转换记录响应无效。");
  return v as unknown as Job;
}
