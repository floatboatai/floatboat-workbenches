import { boundedText, isRecord } from "./project.ts";
import {
  audioSource,
  languageValue,
  validateSegments,
  type AudioSource,
  type Segment,
} from "./transcript.ts";
export type JobStatus =
  | "submitting"
  | "queued"
  | "running"
  | "completed"
  | "failed"
  | "cancelled"
  | "unknown"
  | "interrupted";
export interface JobInput {
  source: AudioSource;
  language: string;
}
export interface Job {
  id: string;
  projectId: string;
  input: JobInput;
  status: JobStatus;
  createdAt: string;
  updatedAt: string;
  error: string;
  model: string;
  segments: Segment[] | null;
}
export const jobId = (v: unknown): string => {
  if (
    typeof v !== "string" ||
    !/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(
      v,
    )
  )
    throw new Error("任务标识无效。");
  return v;
};
export const jobInput = (v: unknown): JobInput => {
  if (!isRecord(v)) throw new Error("转写参数无效。");
  return { source: audioSource(v.source), language: languageValue(v.language) };
};
export function remoteResult(v: unknown): {
  status: JobStatus;
  error: string;
  model: string;
  segments: Segment[] | null;
} {
  if (
    !isRecord(v) ||
    ![
      "queued",
      "running",
      "completed",
      "failed",
      "cancelled",
      "interrupted",
    ].includes(String(v.status))
  )
    throw new Error("转写服务返回了未知状态。");
  return {
    status: v.status as JobStatus,
    error: boundedText(v.error ?? "", 1000),
    model: boundedText(v.model ?? "", 120),
    segments: v.status === "completed" ? validateSegments(v.segments) : null,
  };
}
export function parseJob(v: unknown): Job {
  if (
    !isRecord(v) ||
    ![
      "submitting",
      "queued",
      "running",
      "completed",
      "failed",
      "cancelled",
      "unknown",
      "interrupted",
    ].includes(String(v.status))
  )
    throw new Error("任务记录无效。");
  return {
    id: jobId(v.id),
    projectId: jobId(v.projectId),
    input: jobInput(v.input),
    status: v.status as JobStatus,
    createdAt: boundedText(v.createdAt, 60),
    updatedAt: boundedText(v.updatedAt, 60),
    error: boundedText(v.error, 1000),
    model: boundedText(v.model, 120),
    segments: v.segments === null ? null : validateSegments(v.segments),
  };
}
