import { isRecord, boundedText } from "./project.ts";
import { documentsFromAnnotated, runInput, type RunInput } from "./evidence.ts";

export type HostRunStatus = "running" | "completed" | "failed" | "interrupted";
export interface AnnotatedDocument {
  document_id: string;
  text: string;
  extractions: unknown[];
}
export interface HostRun {
  id: string;
  projectId: string;
  model: string;
  status: HostRunStatus;
  input: RunInput;
  progress: { done: number; total: number };
  warnings: string[];
  result: AnnotatedDocument[] | null;
  message: string;
  createdAt: string;
  updatedAt: string;
}
const STATUSES: HostRunStatus[] = ["running", "completed", "failed", "interrupted"];
export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export function validateHostRun(v: unknown): HostRun {
  if (
    !isRecord(v) ||
    typeof v.id !== "string" ||
    !UUID.test(v.id) ||
    !STATUSES.includes(v.status as HostRunStatus) ||
    !isRecord(v.progress)
  )
    throw Error("模型任务响应无效。");
  const done = Number(v.progress.done),
    total = Number(v.progress.total);
  if (!Number.isInteger(done) || !Number.isInteger(total) || done < 0 || total < 0)
    throw Error("模型任务进度无效。");
  return {
    id: v.id,
    projectId: boundedText(v.projectId, 120),
    model: boundedText(v.model, 120),
    status: v.status as HostRunStatus,
    input: runInput(v.input),
    progress: { done, total },
    warnings: Array.isArray(v.warnings)
      ? v.warnings.slice(0, 200).map((w) => boundedText(w, 500))
      : [],
    result:
      v.result === null || v.result === undefined
        ? null
        : documentsFromAnnotated(Array.isArray(v.result) ? v.result : []).map((d) => ({
            document_id: d.id,
            text: d.originalText,
            extractions: d.extractions,
          })),
    message: boundedText(v.message, 2000),
    createdAt: boundedText(v.createdAt, 60),
    updatedAt: boundedText(v.updatedAt, 60),
  };
}
