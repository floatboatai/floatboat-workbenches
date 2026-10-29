// ABOUTME: 转写任务：固定 ID、不可变输入快照（音频、语言、transcribe 参数）、远端结果与运行信息校验。
import { boundedText, isRecord } from "./project.ts";
import { audioSource, type AudioSource, type Segment } from "./transcript.ts";
import { languageValue, optionsValue, wireOptions, type TranscribeOptions } from "./options.ts";
import { validateSegments } from "./subtitles.ts";

export type JobStatus =
  | "submitting"
  | "queued"
  | "running"
  | "completed"
  | "failed"
  | "cancelled"
  | "unknown"
  | "interrupted";
export const terminal: JobStatus[] = ["completed", "failed", "cancelled", "interrupted"];
export interface JobInput {
  source: AudioSource;
  language: string;
  options: TranscribeOptions;
}
export interface JobInfo {
  language: string;
  languageProbability: number;
  duration: number;
  durationAfterVad: number;
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
  info: JobInfo | null;
}
export const jobId = (v: unknown): string => {
  if (
    typeof v !== "string" ||
    !/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(v)
  )
    throw new Error("任务标识无效。");
  return v;
};
export const jobInput = (v: unknown): JobInput => {
  if (!isRecord(v)) throw new Error("转写参数无效。");
  const options = optionsValue(v.options);
  const language = languageValue(v.language);
  if (options.task === "translate" && language === "en")
    throw new Error("源语言已是英语，无需翻译。");
  return { source: audioSource(v.source), language, options };
};
const num = (n: unknown) => (typeof n === "number" && Number.isFinite(n) ? n : 0);
export function jobInfo(v: unknown): JobInfo | null {
  if (!isRecord(v)) return null;
  return {
    language: typeof v.language === "string" ? v.language.slice(0, 12) : "",
    languageProbability: num(v.language_probability ?? v.languageProbability),
    duration: num(v.duration),
    durationAfterVad: num(v.duration_after_vad ?? v.durationAfterVad),
  };
}
/** Same canonical JSON on both sides so the connector can prove the service ran the captured input. */
export const wireSignature = (o: TranscribeOptions) => JSON.stringify(wireOptions(o));
export function remoteResult(v: unknown): {
  status: JobStatus;
  error: string;
  model: string;
  segments: Segment[] | null;
  info: JobInfo | null;
} {
  if (
    !isRecord(v) ||
    !["queued", "running", "completed", "failed", "cancelled", "interrupted"].includes(String(v.status))
  )
    throw new Error("转写服务返回了未知状态。");
  return {
    status: v.status as JobStatus,
    error: boundedText(v.error ?? "", 1000),
    model: boundedText(v.model ?? "", 120),
    segments: v.status === "completed" ? validateSegments(v.segments) : null,
    info: v.status === "completed" ? jobInfo(v.info) : null,
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
    segments: v.segments === null || v.segments === undefined ? null : validateSegments(v.segments),
    info: jobInfo(v.info),
  };
}
