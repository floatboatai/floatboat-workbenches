import { boundedText, isRecord } from "./project.ts";

export type ReviewRecord = {
  subject: string;
  owner: string;
  dueDate: string;
  summary: string;
  checklist: string[];
};
export type ReviewProject = {
  mode: "structured" | "model";
  source: string;
  input: ReviewRecord;
  selectedRunId: string;
};
export type RunStatus =
  | "running"
  | "waiting"
  | "completed"
  | "rejected"
  | "failed"
  | "interrupted"
  | "cancelled";
export type RunInput = {
  mode: ReviewProject["mode"];
  source: string;
  record: ReviewRecord;
};
export type ReviewDecision = {
  decision: "approve" | "reject";
  record: ReviewRecord;
  note: string;
};
export type RunView = {
  id: string;
  projectId: string;
  title: string;
  input: RunInput;
  status: RunStatus;
  version: number;
  createdAt: string;
  updatedAt: string;
  error: string;
  prepared: ReviewRecord | null;
  review: ReviewDecision | null;
  output: ReviewRecord | null;
  checkpoints: Array<{ id: string; at: string; step: number; next: string[] }>;
};

export function recordValue(
  value: unknown,
  required = true,
  working = false,
): ReviewRecord {
  if (
    !isRecord(value) ||
    !Array.isArray(value.checklist) ||
    value.checklist.length > (working ? 20001 : 40)
  )
    throw new Error("资料格式无效；检查项最多 40 条。");
  const result = {
    subject: boundedText(value.subject, 160),
    owner: boundedText(value.owner, 100),
    dueDate: boundedText(value.dueDate, 40),
    summary: boundedText(value.summary, 10000),
    checklist: value.checklist.map((item) =>
      boundedText(item, working ? 20000 : 500),
    ),
  };
  if (required && (!result.subject.trim() || !result.owner.trim()))
    throw new Error("请填写资料主题和负责人。");
  if (
    !working &&
    result.dueDate &&
    (!/^\d{4}-\d{2}-\d{2}$/.test(result.dueDate) ||
      !Number.isFinite(Date.parse(result.dueDate)) ||
      new Date(result.dueDate).toISOString().slice(0, 10) !== result.dueDate)
  )
    throw new Error("日期请使用 YYYY-MM-DD 格式，或留空。");
  return result;
}
function decodeProject(value: unknown, working: boolean): ReviewProject {
  if (
    !isRecord(value) ||
    (value.mode !== "structured" && value.mode !== "model")
  )
    throw new Error("项目格式无效。");
  return {
    mode: value.mode,
    source: boundedText(value.source, 40000),
    input: recordValue(value.input, false, working),
    selectedRunId: boundedText(value.selectedRunId, 80),
  };
}
export const projectValue = (value: unknown) => decodeProject(value, false);
export const restoreProjectDraft = (value: unknown) =>
  decodeProject(value, true);
export function inputValue(value: unknown): RunInput {
  if (
    !isRecord(value) ||
    (value.mode !== "structured" && value.mode !== "model")
  )
    throw new Error("运行输入无效。");
  const source = boundedText(value.source, 40000);
  if (value.mode === "model" && !source.trim())
    throw new Error("请先输入要整理的原始资料。");
  return {
    mode: value.mode,
    source,
    record: recordValue(value.record, value.mode === "structured"),
  };
}
export function decisionValue(value: unknown): ReviewDecision {
  if (
    !isRecord(value) ||
    (value.decision !== "approve" && value.decision !== "reject")
  )
    throw new Error("复核决定无效。");
  return {
    decision: value.decision,
    record: recordValue(value.record),
    note: boundedText(value.note, 2000),
  };
}
export function idValue(value: unknown): string {
  if (
    typeof value !== "string" ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      value,
    )
  )
    throw new Error("操作编号无效。");
  return value;
}
export function runValue(value: unknown): RunView {
  if (
    !isRecord(value) ||
    ![
      "running",
      "waiting",
      "completed",
      "rejected",
      "failed",
      "interrupted",
      "cancelled",
    ].includes(String(value.status)) ||
    !Number.isInteger(value.version) ||
    !Array.isArray(value.checkpoints)
  )
    throw new Error("任务响应无效。");
  return {
    id: idValue(value.id),
    projectId: idValue(value.projectId),
    title: boundedText(value.title, 120),
    input: inputValue(value.input),
    status: value.status as RunStatus,
    version: Number(value.version),
    createdAt: boundedText(value.createdAt, 50),
    updatedAt: boundedText(value.updatedAt, 50),
    error: boundedText(value.error, 3000),
    prepared: value.prepared === null ? null : recordValue(value.prepared),
    review: value.review === null ? null : decisionValue(value.review),
    output: value.output === null ? null : recordValue(value.output),
    checkpoints: value.checkpoints.slice(0, 30).map((item) => {
      if (
        !isRecord(item) ||
        !Array.isArray(item.next) ||
        typeof item.step !== "number"
      )
        throw new Error("检查点响应无效。");
      return {
        id: boundedText(item.id, 100),
        at: boundedText(item.at, 50),
        step: item.step,
        next: item.next.map((next) => boundedText(next, 100)),
      };
    }),
  };
}
export const seed: ReviewProject = {
  mode: "structured",
  source:
    "示例资料：季度操作手册由陈晓负责，于 2026-11-10 交付。交付物需要包含安装说明、常见故障排查和版本变更记录。",
  input: {
    subject: "季度操作手册 · 示例",
    owner: "陈晓",
    dueDate: "2026-11-10",
    summary: "整理本季度的安装、运维和版本变更内容，形成可交付的操作手册。",
    checklist: [
      "核对安装步骤与配图",
      "复查常见故障的处理方法",
      "补齐版本变更记录",
    ],
  },
  selectedRunId: "",
};

export const recordSchema = {
  type: "object",
  additionalProperties: false,
  required: ["subject", "owner", "dueDate", "summary", "checklist"],
  properties: {
    subject: { type: "string", minLength: 1, maxLength: 160 },
    owner: { type: "string", minLength: 1, maxLength: 100 },
    dueDate: { type: "string", pattern: "^(?:[0-9]{4}-[0-9]{2}-[0-9]{2})?$" },
    summary: { type: "string", maxLength: 10000 },
    checklist: { type: "array", items: { type: "string", maxLength: 500 }, maxItems: 40 },
  },
};
